/// <reference path='fourslash.ts' />

// Should give completions for node modules and files within those modules with ts file extensions

// @Filename: tsconfig.json
//// {
////     "compilerOptions": {
////         "module": "commonjs",
////         "target": "es5"
////     }
//// }


// @Filename: provide.ts
//// export class A {
////     constructor() {
////         let a: string;
////         let c: number;
////     }
//// }

// @Filename: consume.ts
//// import { A } from './*0*/';
//// import { A } from './p/*1*/';

// @Filename: .vscode/settings.json
//// // Place your settings in this file to overwrite default and user settings.
//// {
//// }

// @Filename: tsconfig.json


goTo.marker("1");
verify.completionListContains("provide");
verify.completionListContains(".vscode");
verify.not.completionListItemsCountIsGreaterThan(2);

goTo.marker("0");
verify.completionListContains("provide");
verify.completionListContains(".vscode");
verify.not.completionListItemsCountIsGreaterThan(2);
