/* @internal */
namespace ts.codefix {
    registerCodeFix({
        errorCodes: [Diagnostics.Extract_method.code],
        getCodeActions: context => extractMethod(context)
    })

    function extractMethod(context: CodeFixContext): CodeAction[] | undefined {
        const nodes = getRangeToExtract(context.sourceFile, context.span);
        if (!(nodes && nodes.length)) {
            return undefined;
        }
        // TODO: collecting data in scopes probably can be incremental
        return collectEnclosingScopes(nodes).map(scope => extractMethodInScope(nodes, scope));
    }

    function getRangeToExtract(sourceFile: SourceFile, span: TextSpan): Node[] | undefined {
        // 1. determine syntactically if operation is applicable
        //   1.1. check that spans completely covers nodes
        //   1.2  check that span does not have break/continue statements or conditional returns
        let nodes: Node[];

        let isBadSpan = false;
        let isInConditional = false;
        findNodes(sourceFile);

        return isBadSpan ? undefined : nodes;


        function findNodes(n: Node) {
            // bail out early if:
            // - span is already known to be bad
            // - node and span don't overlap
            if (isBadSpan || !rangeOverlapsWithStartEnd(n, span.start, textSpanEnd(span))) {
                return;
            }

            // here is it known that node and span overlap
            // permitted cases - span completely covers the node 
            const start = n.getStart(sourceFile);
            // 1. if span exactly covers the node - 
            if (startEndContainsRange(n.getFullStart(), n.getStart()))
            if (rangeContainsStartEnd(n, span.start, textSpanEnd(span))) {
                // node contains span
            }
            if (startEndOverlapsWithStartEnd(start, end))
            if (textSpanContainsPosition(span, start) && textSpanContainsPosition(span, end)) {
                // if node is entirely in the span - add it and 
                (nodes || (nodes = [])).push(n);
                return checkNodesInSpan(n);
            }
            else if (startEndContainsRange(start, end, ))
        }
        function checkNodesInSpan(n: Node) {
            if (!n || isBadSpan || isFunctionLike(n) || isClassLike(n)) {
                return;
            }
            const savedIsInConditional = isInConditional;
            if (n.parent) {
                switch (n.parent.kind) {
                    case SyntaxKind.ForStatement:
                    case SyntaxKind.ForInStatement:
                    case SyntaxKind.ForOfStatement:
                    case SyntaxKind.WhileStatement:
                    case SyntaxKind.DoStatement:
                        isInConditional = (<ForStatement | ForInStatement | ForOfStatement | WhileStatement | DoStatement>n.parent).statement === n;
                        break;
                    case SyntaxKind.IfStatement:
                        isInConditional = (<IfStatement>n.parent).thenStatement === n || (<IfStatement>n.parent).elseStatement === n;
                        break;
                }
            }
            switch (n.kind) {
                case SyntaxKind.ReturnStatement:
                case SyntaxKind.BreakStatement:
                case SyntaxKind.ContinueStatement:
                    if (isInConditional) {
                        isBadSpan = true;
                        break;
                    }
                default:
                    forEachChild(n, checkNodesInSpan);
            }

            isInConditional = savedIsInConditional;
        }
    }

    function collectEnclosingScopes(nodes: Node[]) {
        // 2. collect enclosing scopes
        const scopes: (FunctionLikeDeclaration | SourceFile)[] = [];
        let current = nodes[0];
        while (current) {
            if (isFunctionLike(current) || isSourceFile(current)) {
                scopes.push(current);
            }
            current = current.parent;
        }
        return scopes;
    }

    function extractMethodInScope(range: Node[], scope: Node): CodeAction {

    }
}