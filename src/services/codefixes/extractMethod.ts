/* @internal */
namespace ts.codefix.extractMethod {
    registerCodeFix({
        errorCodes: [Diagnostics.Extract_method.code],
        getCodeActions: context => extractMethod(context)
    });

    export type RangeToExtract = Expression | Statement[];

    function extractMethod(context: CodeFixContext): CodeAction[] | undefined {
        const range = getRangeToExtract(context.sourceFile, context.span);
        if (!range) {
            return undefined;
        }
        // const checker = context.program.getTypeChecker();
        // // TODO: collecting data in scopes probably can be incremental
        // return collectEnclosingScopes(range).map(scope => extractMethodInScope(range, scope, checker));
    }

    function spanContainsNode(span:TextSpan, node: Node, file: SourceFile): boolean {
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
            let canExtract = true;
            let disallowJumps = false;
            visit(n);
            return canExtract;

            function visit(n: Node) {
                if (!n || isFunctionLike(n) || isClassLike(n)) {
                    return;
                }
                const savedDisallowJumps = disallowJumps;
                if (n.parent) {
                    switch (n.parent.kind) {
                        case SyntaxKind.ForStatement:
                        case SyntaxKind.ForInStatement:
                        case SyntaxKind.ForOfStatement:
                        case SyntaxKind.WhileStatement:
                        case SyntaxKind.DoStatement:
                            disallowJumps = (<ForStatement | ForInStatement | ForOfStatement | WhileStatement | DoStatement>n.parent).statement === n;
                            break;
                        case SyntaxKind.IfStatement:
                            disallowJumps = (<IfStatement>n.parent).thenStatement === n || (<IfStatement>n.parent).elseStatement === n;
                            break;
                        case SyntaxKind.TryStatement:
                            disallowJumps = (<TryStatement>n.parent).tryBlock === n || (<TryStatement>n.parent).finallyBlock === n;
                            break;
                        case SyntaxKind.CatchClause:
                            disallowJumps = (<CatchClause>n.parent).block === n;
                            break;
                    }
                }
                switch (n.kind) {
                    case SyntaxKind.AwaitExpression:
                    case SyntaxKind.YieldExpression:
                    case SyntaxKind.ReturnStatement:
                    case SyntaxKind.BreakStatement:
                    case SyntaxKind.ContinueStatement:
                        if (disallowJumps) {
                            canExtract = false;
                        }
                        break;
                    default:
                        forEachChild(n, visit);
                        break;
                }

            disallowJumps = savedDisallowJumps;
        }
    }

    // function collectEnclosingScopes(range: RangeToExtract) {
    //     // 2. collect enclosing scopes
    //     const scopes: (FunctionLikeDeclaration | SourceFile)[] = [];
    //     let current: Node = isArray(range) ? firstOrUndefined(range) : range;
    //     while (current) {
    //         if (isFunctionLike(current) || isSourceFile(current)) {
    //             scopes.push(current);
    //         }
    //         current = current.parent;
    //     }
    //     return scopes;
    // }

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
}