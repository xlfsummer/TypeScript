/// <reference path="fourslash.ts" />

/////*s1*/
////[|var x = 1;
////var y = 2;|]/*e1*/
////
/////*s2*/
////var x = 1;
////var y = 2/*e2*/;
////
/////*s3*/var x = 1/*e3*/;
////var y = 2;
////
//// if (/*s4*/[|a && b && c && d|]/*e4*/) {
//// }
////
//// if /*s5*/(a && b && c && d/*e5*/) {
//// }
////
//// if (a && b && c && d) {
/////*s6*/    [|var x = 1;
////     console.log(x);|]    /*e6*/
//// }
////
//// /*s7*/
//// if (a) {
////     return 100;
//// } /*e7*/
////
//// function foo() {
/////*s8*/    [|if (a) {
////    }
////    return 100|] /*e8*/
//// }
////
//// /*s9*/
//// l1:
//// if (x) {
////     break l1;
//// }/*e9*/
////
//// /*s10*/
//// [|l2:
//// {
////     if (x) {
////     }
////     break l2;
//// }|]/*e10*/
//// while (true) {
//// /*s11*/    if(x) {
////     }
////     break;  /*e11*/
//// }
//// while (true) {
//// /*s12*/    if(x) {
////     }
////     continue;  /*e12*/
//// }
//// 
//// l3:
//// {
////    /*s13*/
////     if (x) {
////     }
////     break l3;/*e13*/
//// }


function check(n: number, expectedRangeIndex?: number): void {
    const startMarker = `s${n}`;
    const endMarker = `e${n}`;
    const expectedRange = test.ranges()[expectedRangeIndex];
    if (expectedRangeIndex !== undefined && !expectedRange) {
        throw new Error(`Cannot find range with index ${expectedRangeIndex}, available ranges: ${JSON.stringify(test.ranges())}`);
    }
    // goto marker to make file active
    goTo.marker(startMarker);
    codefixes.extractMethod.verifyRangeToExtract({startMarker, endMarker}, expectedRange);
}

check(1, /*expectedRangeIndex*/ 0);
check(2);
check(3);
check(4, /*expectedRangeIndex*/ 1);
check(5);
check(6, /*expectedRangeIndex*/ 2);
check(7);
check(8, /*expectedRangeIndex*/ 3);
check(9);
check(10, /*expectedRangeIndex*/ 4);
check(11);
check(12);
check(13);