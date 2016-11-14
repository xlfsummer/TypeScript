/// <reference path='fourslash.ts' />

// Should give completions for ts files only when allowJs is false.

// @Filename: d/exportInterface.ts
//// export interface I { x: number; }

// @Filename: d/dd/onlyHereToCreateDir.ts
//// /*dummyMarker*/

// @Filename: d/importInterface.ts
//// import {I as I0} from "/*named0*/
//// import {I as I1} from "./*named1*/
//// import {I as I2} from ".//*named2*/
//// import {I as I3} from "../*named3*/
//// import {I as I4} from "..//*named4*/
//// import {I as I5} from "../d/*named5*/
//// import {I as I6} from "../d//*named6*/
//// import {I as I7} from "/tests/cases/fourslash/d//*named7*/
//// import {I as I8} from "/tests/cases/fourslash/d/../d/../../fourslash/d//*named8*/
////
//// import * as IModule0 from "/*module0*/
//// import * as IModule1 from "./*module1*/
//// import * as IModule2 from ".//*module2*/
//// import * as IModule3 from "../*module3*/
//// import * as IModule4 from "..//*module4*/
//// import * as IModule5 from "../d/*module5*/
//// import * as IModule6 from "../d//*module6*/
//// import * as IModule7 from "/tests/cases/fourslash/d//*module7*/
//// import * as IModule8 from "/tests/cases/fourslash/d/../d/../../fourslash/d//*module8*/
////
//// import IRequireModule0 from "/*requireModule0*/
//// import IRequireModule1 from "./*requireModule1*/
//// import IRequireModule2 from ".//*requireModule2*/
//// import IRequireModule3 from "../*requireModule3*/
//// import IRequireModule4 from "..//*requireModule4*/
//// import IRequireModule5 from "../d/*requireModule5*/
//// import IRequireModule6 from "../d//*requireModule6*/
//// import IRequireModule7 from "/tests/cases/fourslash/d//*requireModule7*/
//// import IRequireModule8 from "/tests/cases/fourslash/d/../d/../../fourslash/d//*requireModule8*/

const kinds = ["named", "module", "requireModule"];

function hasCurDirCompletions() {
    verify.completionListContains("dd");
    verify.completionListContains("exportInterface");
    verify.not.completionListItemsCountIsGreaterThan(2);
}

function hasParentCompletions() {
    verify.completionListContains("d");
    verify.not.completionListItemsCountIsGreaterThan(1);
}

for (const kind of kinds) {
    goTo.marker(`${kind}0`);
    verify.completionListIsEmpty();

    goTo.marker(`${kind}1`);
    goTo.marker(`${kind}2`);
    hasCurDirCompletions();
    goTo.marker(`${kind}3`);
    goTo.marker(`${kind}4`);
    hasParentCompletions();
    goTo.marker(`${kind}5`);
    hasParentCompletions();
    goTo.marker(`${kind}6`);
    hasCurDirCompletions();
    goTo.marker(`${kind}7`);
    hasCurDirCompletions();
    goTo.marker(`${kind}8`);
    hasCurDirCompletions();
}
