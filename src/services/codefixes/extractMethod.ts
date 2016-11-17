/* @internal */
namespace ts.codefix.extractMethod {
    registerCodeFix({
        errorCodes: [Diagnostics.Extract_method.code],
        getCodeActions: context => extractMethod(context)
    });

    export type RangeToExtract = Expression | Statement[];

    export type Scope = FunctionLikeDeclaration | SourceFile;

    function extractMethod(context: CodeFixContext): CodeAction[] | undefined {
        const range = getRangeToExtract(context.sourceFile, context.span);
        return range && extractRange(range, context.sourceFile, context.program.getTypeChecker()); 
    }

    function getDescription(_range: RangeToExtract, _scope: Scope) {
        return "";
    }

    export function getRangeToExtract(sourceFile: SourceFile, span: TextSpan): RangeToExtract | undefined {
        const start = getParentNodeInSpan(getTokenAtPosition(sourceFile, span.start), sourceFile, span);
        const end = getParentNodeInSpan(findTokenOnLeftOfPosition(sourceFile, textSpanEnd(span)), sourceFile, span);
        if (!start || !end || start.parent !== end.parent) {
            return undefined;
        }
        if (start !== end) {
            // start and end should be statements and parent should be either block or a source file
            if (!isBlockLike(start.parent)) {
                return undefined;
            }
            if (!(isStatement(start) || isExpression(start)) && !(isStatement(end) || isExpression(end))) {
                return undefined;
            }
            const statements: Statement[] = [];
            for (const n of (<BlockLike>start.parent).statements) {
                if (n === start || statements.length) {
                    if (!canExtractNode(n)) {
                        return undefined;
                    }
                    statements.push(n);
                }
                if (n === end) {
                    break;
                }
            }
            return statements;
        }
        else {
            if (!canExtractNode(start)) {
                return undefined;
            }
            if (isStatement(start)) {
                return [start];
            }
            else if (isExpression(start)) {
                return start;
            }
            else {
                return undefined;
            }
        }

        function canExtractNode(n: Node): boolean {
            const enum PermittedJumps {
                None = 0,
                Break = 1 << 0,
                Continue = 1 << 1,
                Return = 1 << 2,
                Yield = 1 << 3,
                Await = 1 << 4
            }

            let canExtract = true;
            let permittedJumps = PermittedJumps.Return | PermittedJumps.Yield | PermittedJumps.Await;
            let seenLabels: string[];
            visit(n);
            return canExtract;

            function visit(n: Node) {
                if (!canExtract || !n || isFunctionLike(n) || isClassLike(n)) {
                    return;
                }
                const savedPermittedJumps = permittedJumps;
                if (n.parent) {
                    switch (n.parent.kind) {
                        case SyntaxKind.ForStatement:
                        case SyntaxKind.ForInStatement:
                        case SyntaxKind.ForOfStatement:
                        case SyntaxKind.WhileStatement:
                        case SyntaxKind.DoStatement:
                            if ((<ForStatement | ForInStatement | ForOfStatement | WhileStatement | DoStatement>n.parent).statement === n) {
                                // allow unlabeled break/continue inside loops
                                permittedJumps |= PermittedJumps.Break | PermittedJumps.Continue;
                            }
                            break;
                        case SyntaxKind.IfStatement:
                            if ((<IfStatement>n.parent).thenStatement === n || (<IfStatement>n.parent).elseStatement === n) {
                                // forbid all jumps inside thenStatement or elseStatement 
                                permittedJumps = PermittedJumps.None;
                            }
                            break;
                        case SyntaxKind.TryStatement:
                            if ((<TryStatement>n.parent).tryBlock === n || (<TryStatement>n.parent).finallyBlock === n) {
                                // forbid all jumps inside try or finally blocks
                                permittedJumps = PermittedJumps.None;
                            }
                            break;
                        case SyntaxKind.CatchClause:
                            if ((<CatchClause>n.parent).block === n) {
                                // forbid all jumps inside the block of catch clause
                                permittedJumps = PermittedJumps.None;
                            }
                            break;
                        case SyntaxKind.CaseClause:
                            if ((<CaseClause>n).expression !== n) {
                                // allow unlabeled break inside case clauses
                                permittedJumps |= PermittedJumps.Break;
                            }
                            break;
                    }
                }
                switch (n.kind) {
                    case SyntaxKind.LabeledStatement:
                        {
                            const label = (<LabeledStatement>n).label;
                            (seenLabels || (seenLabels = [])).push(label.text);
                            forEachChild(n, visit);
                            seenLabels.pop();
                            break;
                        }
                    case SyntaxKind.BreakStatement:
                    case SyntaxKind.ContinueStatement:
                        {
                            const label = (<BreakStatement | ContinueStatement>n).label;
                            if (label) {
                                if (!contains(seenLabels, label.text)) {
                                    // attempts to jump to label that is not in range to be extracted
                                    canExtract = false;
                                }
                            }
                            else {
                                if (!(permittedJumps & (SyntaxKind.BreakStatement ? PermittedJumps.Break : PermittedJumps.Continue))) {
                                    // attempt to break or continue in a forbidden context
                                    canExtract = false;
                                }
                            }
                            break;
                        }
                    case SyntaxKind.AwaitExpression:
                        if (!(permittedJumps & PermittedJumps.Await)) {
                            canExtract = false;
                        }
                        break;
                    case SyntaxKind.YieldExpression:
                        if (!(permittedJumps & PermittedJumps.Yield)) {
                            canExtract = false;
                        }
                        break;
                    case SyntaxKind.ReturnStatement:
                        if (!(permittedJumps & PermittedJumps.Return)) {
                            canExtract = false;
                        }
                        break;
                    default:
                        forEachChild(n, visit);
                        break;
                }

                permittedJumps = savedPermittedJumps;
            }
        }



        // const nullLexicalEnvironment: LexicalEnvironment = {
        //     startLexicalEnvironment: noop,
        //     endLexicalEnvironment: () => emptyArray
        // };

        // function extractMethodInScope(range: RangeToExtract, _scope: Node, checker: TypeChecker): CodeAction {
        //     if (!isArray(range)) {
        //         range = [createStatement(range)];
        //     }

        //     // compute combined range covered by individual entries in RangeToExtract
        //     // TODO: this is not dependent on scope and can be lifted
        //     //const combinedRange = range.reduce((p, c) => p ? createRange(p.pos, c.end) : c, <TextRange>undefined);

        //     const array = visitNodes(createNodeArray(range), visitor, isStatement);
        //     let typeParameters: TypeParameterDeclaration[];
        //     let parameters: ParameterDeclaration[];
        //     let modifiers: Modifier[];
        //     let asteriskToken: Token<SyntaxKind.AsteriskToken>;
        //     let returnType: TypeNode;

        //     const subtree = createFunctionDeclaration(
        //         /*decorators*/ undefined,
        //         modifiers,
        //         asteriskToken,
        //         createUniqueName("newFunction"),
        //         typeParameters,
        //         parameters,
        //         returnType,
        //         createBlock(array));

        //     // TODO:print the tree
        //     if (subtree) {

        //     }
        //     return undefined;

        //     // walk the tree, collect:
        //     // - variables that flow in
        //     // - variables as RHS of assignments
        //     // - variable declarations
        //     function visitor(n: Node): VisitResult<Node> {
        //         switch (n.kind) {
        //             case SyntaxKind.Identifier:
        //                 if (isPartOfExpression(n)) {
        //                     const symbol = checker.getSymbolAtLocation(n);
        //                     if (symbol && symbol.valueDeclaration) {
        //                         // parameters
        //                     }
        //                 }
        //                 break;
        //         }
        //         return visitEachChild(n, visitor, nullLexicalEnvironment);
        //     }
        // }
    }

    export function collectEnclosingScopes(range: RangeToExtract) {
        // 2. collect enclosing scopes
        const scopes: Scope[] = [];
        let current: Node = isArray(range) ? firstOrUndefined(range) : range;
        while (current) {
            if (isFunctionLike(current) || isSourceFile(current)) {
                scopes.push(current);
            }
            current = current.parent;
        }
        return scopes;
    }

    const nullTransformationContext: TransformationContext = {

    };

    function unaryExpressionHasWrite(n: Node): boolean {
        switch (n.kind) {
            case SyntaxKind.PostfixUnaryExpression:
                return true;
            case SyntaxKind.PrefixUnaryExpression:
                return (<PrefixUnaryExpression>n).operator === SyntaxKind.PlusPlusToken ||
                    (<PrefixUnaryExpression>n).operator === SyntaxKind.MinusMinusToken;
            default:
                return false;
        }
    }

    export function extractRange(range: RangeToExtract, sourceFile: SourceFile, program: Program, cancellationToken: CancellationToken): CodeAction[] {
        // 1. collect scopes where new function can be placed
        const scopes = collectEnclosingScopes(range);
        const enclosingRange = getEnclosingTextRange(range, sourceFile);
        
        const checker = program.getTypeChecker();
        // for every scope - list of values that flow into the range
        const flowOut = new Array<Symbol[]>(scopes.length);
        // for every scope - list of values that flow out of the range
        const flowIn = new Array<Symbol[]>(scopes.length);
        // for every scope - variable declarations that reside in the range but were used outside
        const visibleDeclarations = new Array<Symbol[]>(scopes.length);
        // set of processed symbols that were referenced in range as reads
        const processedReads = createMap<Symbol>();
        // set of processed symbol that were referenced in range as writes
        const processedWrites = createMap<Symbol>();
        const references = createMap<ReferencedSymbol[]>();

        let extractedFunctionBody: Statement;
        
        if (isArray(range)) {
            // list of statements
            extractedFunctionBody = createBlock(visitNodes(createNodeArray(range), visitor, isStatement));
        }
        else {
            // single expression - extracted into function with a return
            const visited = visitNode(range, visitor, isExpression);
            // TODO: return should also include values that flows out
            extractedFunctionBody = createReturn(visited);
        }

        return;

        function findReferences(symbol: Symbol) {
            const result = references[symbol.id];
            return result || (references[symbol.id] = FindAllReferences.findReferencedSymbols(checker, cancellationToken,
                program.getSourceFiles(), symbol.valueDeclaration.getSourceFile(), symbol.valueDeclaration.end,
               /*findInStrings*/ false, /*findInComments*/ false));
        }

        function visitor(n: Node): Node {
            switch (n.kind) {
                case SyntaxKind.Identifier:
                    if (isPartOfExpression(n)) {
                        const symbol = checker.getSymbolAtLocation(n);
                        // no symbol, no value declaration or value declaration is in the range being extracted - skip it
                        if (!symbol || !symbol.valueDeclaration || rangeContainsRange(enclosingRange, symbol.valueDeclaration)) {
                            return n;
                        }
                        if (isAssignmentTarget(n)) {
                            if (symbol.id in processedWrites) {
                                return n;
                            }
                            processedWrites[symbol.id] = symbol;
                            const references = findReferences(symbol);
                            for (let i = 0; i < scopes.length; i++) {
                                const current = scopes[i];
                                for (const refSymbol of references) {
                                    for (const ref of refSymbol.references) {
                                        // if scope 
                                    }
                                    ref.references[0]
                                }
                            }
                            // TODO: record writes
                        }
                        else {
                            if (symbol.id in processedReads) {
                                return n;
                            }
                            
                            // TODO: process read
                        }
                    }
                    else if (isPartOfTypeNode(n)) {

                    }
                    break;
                case SyntaxKind.ThisKeyword:
                    break;
                case SyntaxKind.VariableDeclaration:
                    break;
                default:
                    return visitEachChild(n, visitor, nullTransformationContext);
            }
        }
    }

    function getEnclosingTextRange(range: RangeToExtract, sourceFile: SourceFile): TextRange {
        return isArray(range)
            ? { pos: range[0].getStart(sourceFile), end: lastOrUndefined(range).getEnd() }
            : range;
    }

    function spanContainsNode(span: TextSpan, node: Node, file: SourceFile): boolean {
        return textSpanContainsPosition(span, node.getStart(file)) &&
            node.getEnd() <= textSpanEnd(span);
    }

    function getParentNodeInSpan(n: Node, file: SourceFile, span: TextSpan): Node {
        while (n) {
            if (!n.parent) {
                return undefined;
            }
            if (isSourceFile(n.parent) || !spanContainsNode(span, n.parent, file)) {
                return n;
            }

            n = n.parent;
        }
    }

    function isBlockLike(n: Node): n is BlockLike {
        switch (n.kind) {
            case SyntaxKind.Block:
            case SyntaxKind.SourceFile:
            case SyntaxKind.ModuleBlock:
            case SyntaxKind.CaseClause:
                return true;
            default:
                return false;
        }
    }

}