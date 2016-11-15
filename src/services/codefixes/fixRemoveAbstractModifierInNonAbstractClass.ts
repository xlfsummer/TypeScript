/* @internal */
namespace ts.codefix {
    registerCodeFix({
        errorCodes: [Diagnostics.Abstract_methods_can_only_appear_within_an_abstract_class.code],
        getCodeActions: (context: CodeFixContext) => {
            const sourceFile = context.sourceFile;
            const start = context.span.start;
            const token = getTokenAtPosition(sourceFile, start);

            Debug.assert(token.kind === SyntaxKind.AbstractKeyword);

            const propertyDeclaration = <PropertyDeclaration>token.parent;
            const classLikeDeclaration = <ClassLikeDeclaration>propertyDeclaration.parent;
            const classKeywordStart = classLikeDeclaration.getStart();

            return [
                {
                    description: `Remove abstract modifier from ${propertyDeclaration.name.getText()}.`,
                    changes: [{
                        fileName: sourceFile.fileName,
                        textChanges: [{
                            span: { start: start, length: context.span.length + /*space*/ 1 },
                            newText: ""
                        }]
                    }]
                },
                {
                    description: `Make class ${classLikeDeclaration.name.getText()} abstract.`,
                    changes: [{
                        fileName: sourceFile.fileName,
                        textChanges: [{
                            span: { start: classKeywordStart, length: 0 },
                            newText: "abstract "
                        }]
                    }]
                }
            ];
        }
    });
}
