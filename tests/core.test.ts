import test from "node:test";
import assert from "node:assert/strict";
import { recognitionPalette } from "../src/data/recognitionPalette";
import { mardPaletteByCode } from "../src/data/mardPalette";
import { createBlankPattern, createEmptyCell } from "../src/utils/imageToPattern";
import { recognizeGridPatternFromPixels, buildChartLocalPalette } from "../src/utils/gridRecognition";
import { deltaE2000, hexToRgb, rgbToLab, createColorMatcher, findClosestBeadColorWithDebug } from "../src/utils/colorUtils";
import { validateLegend, applySafeCorrections, correctIsolatedCells, assignCellColor } from "../src/utils/legendValidation";
import { detectLegendRegions, parseLegendText, parseLegendWords } from "../src/utils/legendRecognition";
import { calculateColorStats } from "../src/utils/patternStats";
import type { GridCalibration } from "../src/types/calibration";

const color = (code:string) => mardPaletteByCode.get(code)!;
const legend = parseLegendText("B26 161\nB29 145").entries;
const calibration = (n:number):GridCalibration => ({imageWidth:n*10,imageHeight:n*10,selectionX:0,selectionY:0,selectionWidth:30,selectionHeight:30,cellWidth:10,cellHeight:10,originX:0,originY:0,columns:n,rows:n,rotation:0});
function solidGridData(n:number, code:string) {
  const data=new Uint8ClampedArray(n*n*100*4); const rgb=hexToRgb(color(code).hex); const size=n*10;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const line=x%10===0||y%10===0;const text=x%10>=4&&x%10<=5&&y%10>=4&&y%10<=5;
    const i=(y*size+x)*4;data[i]=line||text?0:rgb.r;data[i+1]=line||text?0:rgb.g;data[i+2]=line||text?0:rgb.b;data[i+3]=255;
  }
  return {width:size,height:size,data,colorSpace:"srgb"} as ImageData;
}
function countFixture(firstCode = "B26") {
  const grid=createBlankPattern(306,1,color("B29"));
  for(let i=0;i<158;i++)grid[0][i]=assignCellColor(grid[0][i],color(firstCode),undefined);
  grid[0].forEach(c=>{c.rawRgb=hexToRgb(color(c.colorCode).hex);c.confidence=.95;});
  const a=hexToRgb(color(firstCode).hex),b=hexToRgb(color("B29").hex);
  let midpoint=a,best=Infinity;
  for(let i=0;i<=1000;i++){
    const t=i/1000;const rgb={r:a.r*(1-t)+b.r*t,g:a.g*(1-t)+b.g*t,b:a.b*(1-t)+b.b*t};
    const d=Math.abs(deltaE2000(rgbToLab(rgb),rgbToLab(a))-deltaE2000(rgbToLab(rgb),rgbToLab(b)));
    if(d<best){best=d;midpoint=rgb;}
  }
  for(let i=158;i<161;i++)grid[0][i].rawRgb=midpoint;
  return grid;
}

test("CIEDE2000 reference pair and identical color",()=>{
  assert.ok(Math.abs(deltaE2000({l:50,a:2.6772,b:-79.7751},{l:50,a:0,b:-82.7485})-2.0425)<.0001);
  assert.equal(deltaE2000(rgbToLab({r:10,g:20,b:30}),rgbToLab({r:10,g:20,b:30})),0);
});
test("TEST 1 interior sampling ignores dark grid lines and center text",()=>{
  const grid=recognizeGridPatternFromPixels(solidGridData(20,"B29"),calibration(20),recognitionPalette);
  assert.equal(grid.flat().filter(c=>c.colorCode==="B29").length,400);
});
test("TEST 2 isolated near-color deviation is corrected or flagged",()=>{
  const palette=[{...color("B29"),code:"B29",hex:"#efb3c9"},{...color("B26"),code:"B26",hex:"#f0b4ca"}];
  const grid=createBlankPattern(5,5,palette[0]);
  grid.flat().forEach(c=>{c.rawRgb=hexToRgb("#efb3c9");c.confidence=.9;});
  grid[2][2]={...grid[2][2],colorCode:"B26",rawDetectedColor:"B26"};
  const cell=correctIsolatedCells(grid,palette)[2][2];
  assert.ok(cell.colorCode==="B29"||cell.suspectedMismatch);
  assert.equal(cell.rawDetectedColor,"B26");
});
test("TEST 3 actual single-cell dark eye and white highlight survive",()=>{
  const data=solidGridData(5,"B29");
  for(const [r,c,v] of [[2,2,0],[2,3,255]])for(let y=r*10+1;y<(r+1)*10;y++)for(let x=c*10+1;x<(c+1)*10;x++){
    const i=(y*data.width+x)*4;data.data[i]=data.data[i+1]=data.data[i+2]=v;
  }
  const grid=recognizeGridPatternFromPixels(data,calibration(5),recognitionPalette);
  assert.equal(grid[2][2].empty,false);assert.equal(grid[2][3].empty,false);
  assert.notEqual(grid[2][2].colorCode,"B29");assert.notEqual(grid[2][3].colorCode,"B29");
});
test("TEST 4 exact legend counts and totals",()=>{
  const grid=countFixture();
  for(let i=158;i<161;i++)grid[0][i]=assignCellColor(grid[0][i],color("B26"),"manual");
  const v=validateLegend(grid,legend);
  assert.ok(v.entries.every(e=>e.difference===0));assert.equal(v.expectedTotal,v.detectedTotal);
});
test("TEST 5 prioritizes precisely three ambiguous surplus cells; corrections recount",()=>{
  // Real B26/B29 are far apart. B13/B29 are a genuinely close pair in this palette.
  const closeLegend=parseLegendText("B13 161\nB29 145").entries;
  const grid=countFixture("B13"),v=validateLegend(grid,closeLegend);
  assert.deepEqual(v.entries.map(e=>e.difference),[-3,3]);
  assert.equal(v.suspiciousCells.length,3);
  assert.ok(v.suspiciousCells.every(s=>s.from==="B29"&&s.to==="B13"));
  const fixed=applySafeCorrections(grid,closeLegend);
  assert.ok(validateLegend(fixed,closeLegend).entries.every(e=>e.difference===0));
});
test("TEST 6 obvious color difference is never forced to fit legend",()=>{
  const grid=countFixture();for(let i=158;i<161;i++)grid[0][i].rawRgb=hexToRgb("#1010e0");
  const result=applySafeCorrections(grid,legend);
  assert.equal(result[0][158].colorCode,"B29");
  assert.equal(validateLegend(result,legend).suspiciousCells.length,0);
});
test("Unconfirmed OCR only suggests, never auto-corrects; manual confirmation stays",()=>{
  const closeLegend=parseLegendText("B13 161\nB29 145").entries;
  const grid=countFixture("B13"),unconfirmed=closeLegend.map(e=>({...e,confirmed:false,source:"ocr" as const}));
  assert.equal(applySafeCorrections(grid,unconfirmed)[0][158].colorCode,"B29");
  grid[0][158].validationConfirmed=true;
  assert.ok(!validateLegend(grid,closeLegend).suspiciousCells.some(s=>s.col===158));
});
test("Legal codes, count conflicts, OCR two-line alignment, and side candidates",()=>{
  assert.equal(parseLegendText("B26 161\nB26 162\nZZ99 5").entries.length,0);
  assert.equal(parseLegendText("B26 1.5\nB29 -3\nB26161").entries.length,0);
  assert.equal(parseLegendText("B26\n161\nB29 145").entries.length,2);
  const words=[{text:"B26",confidence:98,bbox:{x0:20,x1:60,y0:10,y1:30}},{text:"161",confidence:97,bbox:{x0:20,x1:60,y0:35,y1:55}}];
  assert.equal(parseLegendWords(words).entries[0].expectedCount,161);
  const c={...calibration(10),imageWidth:200,imageHeight:200,originX:20,originY:20};
  assert.deepEqual(detectLegendRegions(c).map(r=>r.label),["下方色表","右側色表","左側色表","上方色表"]);
});
test("TEST 9 automatic and known palettes exclude all configured special series",()=>{
  assert.ok(recognitionPalette.every(c=>!c.isSpecial&&!c.isTransparent&&/^[A-M]\d+$/.test(c.code)));
  const special=[...mardPaletteByCode.values()].find(c=>c.isSpecial)!;
  assert.equal(buildChartLocalPalette([{id:"x",code:special.code,sampledHex:special.hex,source:"manual",enabled:true,confidence:1}]).length,0);
});
test("Color cache preserves exact scores and reacts to updated calibration hex",()=>{
  const p=[{...color("B29")}];const rgb={r:192.125,g:45.5,b:71.25};
  assert.deepEqual(createColorMatcher(p)(rgb),findClosestBeadColorWithDebug(rgb,p));
  const before=findClosestBeadColorWithDebug(rgb,p);p[0].matchHex="#010101";
  assert.notEqual(findClosestBeadColorWithDebug(rgb,p).adjustedDistance,before.adjustedDistance);
});
test("Empty/cropped cells excluded; optional validation fields survive JSON storage",()=>{
  const c=calibration(5);c.cropRange={startRow:1,endRow:3,startCol:1,endCol:3};
  const grid=recognizeGridPatternFromPixels(solidGridData(5,"B29"),c,recognitionPalette);
  assert.equal(grid.length,3);assert.equal(grid[0].length,3);grid[0][0]=createEmptyCell(0,0);
  assert.equal(calculateColorStats(grid).reduce((n,s)=>n+s.total,0),8);
  assert.deepEqual(JSON.parse(JSON.stringify({grid,legend})).legend,legend);
});
