/// <reference path="fourslash.ts" />

/////*s1*/
////[|{|"name": 1|}var x = 1;
////var y = 2;|]/*e1*/
////
/////*s2*/
////var x = 1;
////var y = 2/*e2*/;
////
/////*s3*/var x = 1/*e3*/;
////var y = 2;
////
//// if (/*s4*/[|{|"name": 4|}a && b && c && d|]/*e4*/) {
//// }
////
//// if /*s5*/(a && b && c && d/*e5*/) {
//// }
////
//// if (a && b && c && d) {
/////*s6*/    [|{|"name": 6|}var x = 1;
////     console.log(x);|]    /*e6*/
//// }
////
//// /*s7*/
//// if (a) {
////     return 100;
//// } /*e7*/
////
//// function foo() {
/////*s8*/    [|{|"name": 8|}if (a) {
////    }
////    return 100|] /*e8*/
//// }
////
//// /*s9*/
//// [|{|"name": 9|}l1:
//// if (x) {
////     break l1;
//// }|]/*e9*/
////
//// /*s10*/
//// [|{|"name": 10|}l2:
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


function check(n: number, expectSuccess: boolean): void {
    const startMarker = `s${n}`;
    const endMarker = `e${n}`;
    let expectedRange: FourSlashInterface.Range;
    if (expectSuccess) {
        for (const range of test.ranges()) {
            if (range.marker.data.name === n) {
                expectedRange = range;
                break;
            }
        }
        if (!expectedRange) {
            throw new Error(`Cannot find range with index ${expectSuccess}, available ranges: ${JSON.stringify(test.ranges())}`);
        }
    }
    // goto marker to make file active
    goTo.marker(startMarker);
    try {
        codefixes.extractMethod.verifyRangeToExtract({startMarker, endMarker}, expectedRange);
    }
    catch (e) {
        throw new Error(`Error in test ${n}, ${e.message}`);
    }
}
debugger
check(1, /*expectSuccess*/ true);
check(2, /*expectSuccess*/ false);
check(3, /*expectSuccess*/ false);
check(4, /*expectSuccess*/ true);
check(5, /*expectSuccess*/ false);
check(6, /*expectSuccess*/ true);
check(7, /*expectSuccess*/ false);
check(8, /*expectSuccess*/ true);
check(9, /*expectSuccess*/ true);
check(10, /*expectSuccess*/ true);
check(11, /*expectSuccess*/ false);
check(12, /*expectSuccess*/ false);
check(13, /*expectSuccess*/ false);