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
        if (!range) {
            return undefined;
        }
        const checker = context.program.getTypeChecker();
        const enclosingSpan = getEnclosingTextSpan(range, context.sourceFile);
        const scopes = collectEnclosingScopes(range);

        // // TODO: collecting data in scopes probably can be incremental
        let result: CodeAction[];
        for (const scope of scopes) {
            const textChanges = extractRangeInScope(range, enclosingSpan, scope, context.sourceFile, checker);
            if (!textChanges) {
                continue;
            }
            const codeAction: CodeAction = {
                description: getDescription(range, scope),
                textChanges:[{
                    fileName: context.sourceFile.fileName,
                    textChanges
                }]
            };
            (result || (result = [])).push(codeAction);
        }
        return result;
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

    const nullLexicalEnvironment: LexicalEnvironment = {
        startLexicalEnvironment: noop,
        endLexicalEnvironment: () => undefined
    }

    function isUnaryExpressionConsideredAsWrite(n: Node): boolean {
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

    export function extractRangeInScope(range: RangeToExtract, enclosingSpan: TextSpan, scope: Scope, sourceFile: SourceFile, checker: TypeChecker): TextChange[] {
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

        let lastLhsOfAssignment: Node;
        function lhsVisitor(n: Node): Node {
            if (n.kind === SyntaxKind.Identifier) {
                // record write
            }
            else if (isBindingPattern(n)) {
                // visit binding patterns, record writes
            }
            return visitEachChild(n, lhsVisitor, nullLexicalEnvironment);
        }

        function visitor(n: Node): Node {
            if (n === lastLhsOfAssignment) {
                return lhsVisitor(n);
            }
            if (isAssignmentExpression(n)) {
                const savedLastLhsOfAssignment = lastLhsOfAssignment;
                lastLhsOfAssignment = (<BinaryExpression>n).left;
                const result = visitEachChild(n, visitor, nullLexicalEnvironment);
                lastLhsOfAssignment = savedLastLhsOfAssignment;
                return result;
            }
            else if (isUnaryExpressionConsideredAsWrite(n)) {
                return lhsVisitor()
            }
            if (n.kind === SyntaxKind.Identifier) {
                if (isPartOfExpression(n)) {
                    const symbol = checker.getSymbolAtLocation(n);
                    if (symbol && symbol.valueDeclaration) {
                        // if value declaration of a symbol is either outside of the scope of inside the enclosing span
                        // then node can be kept as is
                        // otherwise it should be rewritten 
                    }
                }
                else if (isPartOfTypeNode(n)) {

                }
            }
            else if (n.kind === SyntaxKind.ThisKeyword) {
                // TODO block cases when this keyword cannot be used 
            }
        }
    }

    function getEnclosingTextSpan(range: RangeToExtract, sourceFile: SourceFile) {
        return isArray(range)
            ? createTextSpanFromBounds(range[0].getStart(sourceFile), lastOrUndefined(range).getEnd())
            : createTextSpanFromBounds(range.getStart(sourceFile), range.getEnd());
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