/* @internal */
namespace ts.codefix {
    registerCodeFix({
        errorCodes: [Diagnostics.Extract_method.code],
        getCodeActions: context => extractMethod(context)
    });

    type RangeToExtract = Expression | Statement[];

    function extractMethod(context: CodeFixContext): CodeAction[] | undefined {
        const range = getRangeToExtract(context.sourceFile, context.span);
        if (!range) {
            return undefined;
        }
        const checker = context.program.getTypeChecker();
        // TODO: collecting data in scopes probably can be incremental
        return collectEnclosingScopes(range).map(scope => extractMethodInScope(range, scope, checker));
    }

    function getRangeToExtract(sourceFile: SourceFile, span: TextSpan): RangeToExtract | undefined {
        // 1. determine syntactically if operation is applicable
        //   1.1. check that spans completely covers nodes
        //   1.2  check that span does not have break/continue statements or conditional returns
        let foundExpression: Expression;
        let foundStatementList: Statement[];

        let isBadSpan = false;
        let disallowJumps = false;
        findNodes(sourceFile);

        return isBadSpan ? undefined : foundExpression || foundStatementList;


        function findNodes(n: Node): void {
            // bail out early if:
            // - span is already known to be bad
            // - node and span don't overlap
            if (isBadSpan || !rangeOverlapsWithStartEnd(n, span.start, textSpanEnd(span))) {
                return;
            }

            // here is it known that node and span overlap
            const start = n.getStart(sourceFile);
            if (textSpanContainsPosition(span, start) && textSpanContainsPosition(span, textSpanEnd(span))) {
                // node is completely contained in the span
                if (isExpression(n)) {
                    // span should cover exactly one expression
                    if (foundStatementList || foundExpression) {
                        isBadSpan = true;
                    }
                    else {
                        foundExpression = n;
                    }
                }
                else if (isStatement(n)) {
                    // all covered statements should belong to the same parent
                    if (foundExpression || (foundStatementList && foundStatementList[0].parent !== n.parent)) {
                        isBadSpan = true;
                    }
                    else {
                        (foundStatementList || (foundStatementList = [])).push(n);
                    }
                }
                return;
            }
            return forEachChild(n, findNodes);
        }

        function checkNodesInSpan(n: Node) {
            if (!n || isBadSpan || isFunctionLike(n) || isClassLike(n)) {
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
                        isBadSpan = true;
                    }
                    break;
                default:
                    forEachChild(n, checkNodesInSpan);
                    break;
            }

            disallowJumps = savedDisallowJumps;
        }
    }

    function collectEnclosingScopes(range: RangeToExtract) {
        // 2. collect enclosing scopes
        const scopes: (FunctionLikeDeclaration | SourceFile)[] = [];
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
        endLexicalEnvironment: noop
    };

    function extractMethodInScope(range: RangeToExtract, _scope: Node, checker: TypeChecker): CodeAction {
        if (!isArray(range)) {
            range = [createStatement(range)];
        }
        const array = visitNodes(createNodeArray(range), visitor, isStatement);
        let typeParameters: TypeParameterDeclaration[];
        let parameters: ParameterDeclaration[];
        let modifiers: Modifier[];
        let asteriskToken: Token<SyntaxKind.AsteriskToken>;
        let returnType: TypeNode;
        const subtree = createFunctionDeclaration(
            /*decorators*/ undefined,
            modifiers,
            asteriskToken,
            createUniqueName("newFunction"),
            typeParameters,
            parameters,
            returnType,
            createBlock(array));
        
        // TODO:print the tree
        if (subtree) {

        }
        return undefined;

        // walk the tree, collect:
        // - variables that flow in
        // - variables as RHS of assignments
        // - variable declarations
        function visitor(n: Node): VisitResult<Statement> {
            switch (n.kind) {
                case SyntaxKind.Identifier:
                    if (isPartOfExpression(n)) {
                        const symbol = checker.getSymbolAtLocation(n);
                        if (symbol && checker.isUnknownSymbol(symbol)) {
                            
                        }
                    }
                    break;
            }
            return visitEachChild(n, visitor, nullLexicalEnvironment);
        }
    }
}