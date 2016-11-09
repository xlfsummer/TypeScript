/// <reference path="fourslash.ts" />

/////*1*/
////[|var x = 1;
////var y = 2;|]/*2*/

codefixes.extractMethod.verifyRangeToExtract({startMarker: "1", endMarker: "2"}, test.ranges()[0]);