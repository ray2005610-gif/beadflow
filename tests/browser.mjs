import { chromium, expect } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const port=5192;
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{stdio:'pipe',windowsHide:true});
let output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
let browser;
try {
  for(let i=0;i<100&&!output.includes('Local:');i++) await new Promise(r=>setTimeout(r,100));
  assert.ok(output.includes('Local:'),output);
  browser=await chromium.launch({channel:'msedge',headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  page.on('dialog',dialog=>dialog.accept());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text()+" "+m.location().url);});
  page.on('response',r=>{if(r.status()>=400)console.log('HTTP',r.status(),r.url());});
  await page.goto(`http://127.0.0.1:${port}`);
  const baseline=existsSync('work/baseline-results.json') ? JSON.parse(readFileSync('work/baseline-results.json','utf8')) : null;
  const result=await page.evaluate(async baseline=>{
    const {recognizeGridPatternFromImage:recognize}=await import('/src/utils/gridRecognitionClient.ts');
    const {recognitionPalette:p}=await import('/src/data/recognitionPalette.ts');
    const profile=await import('/src/utils/recognitionProfile.ts');
    const stats=await import('/src/utils/patternStats.ts');
    const results=[];
    for(const n of [52,104]){
      const c=document.createElement('canvas');c.width=c.height=n*10;const ctx=c.getContext('2d');
      for(let r=0;r<n;r++)for(let col=0;col<n;col++){
        ctx.fillStyle=p[(Math.floor(r/8)+Math.floor(col/8)*3)%24].hex;ctx.fillRect(col*10,r*10,10,10);
        ctx.strokeStyle='#444';ctx.lineWidth=1;ctx.strokeRect(col*10,r*10,10,10);
        ctx.fillStyle='#222';ctx.fillRect(col*10+4,r*10+4,2,2);
      }
      const url=c.toDataURL();const cal={imageWidth:c.width,imageHeight:c.height,selectionX:0,selectionY:0,selectionWidth:30,selectionHeight:30,cellWidth:10,cellHeight:10,originX:0,originY:0,columns:n,rows:n,rotation:0};
      let ticks=0,maxGap=0,last=performance.now();const timer=setInterval(()=>{const now=performance.now();maxGap=Math.max(maxGap,now-last);last=now;ticks++},16);
      profile.beginRecognitionProfile();
      const t=performance.now();const grid=await recognize(url,cal,p);const ms=performance.now()-t;
      stats.calculateColorStats(grid);profile.finishRecognitionRender(0);
      await new Promise(r=>setTimeout(r,30));clearInterval(timer);
      const codes=grid.map(row=>row.map(x=>x.colorCode));
      const before=baseline?.results.find(x=>x.n===n);
      const changed=before ? codes.flat().filter((x,i)=>x!==before.codes.flat()[i]).length : null;
      results.push({n,ms,maxGap,ticks,changed,stages:globalThis.__beadflowProfile});
    }
    let photoChanged=null;
    if(baseline){
      const photo=await import('/src/utils/imageToPattern.ts');
      const converted=await photo.imageToPattern(baseline.photoUrl,32,32,p,photo.defaultBackgroundRemovalOptions,{imageKind:'photo'});
      const old=baseline.photoCodes.flat();
      photoChanged=converted.grid.flat().filter((c,i)=>c.colorCode!==old[i]).length;
    }
    const {recognizeLegend}=await import('/src/utils/legendRecognition.ts');
    const legendCanvas=document.createElement('canvas');legendCanvas.width=550;legendCanvas.height=190;
    const lc=legendCanvas.getContext('2d');lc.fillStyle='#fff';lc.fillRect(0,0,550,190);lc.fillStyle='#111';lc.font='32px Arial';
    lc.fillText('B26 161',70,65);lc.fillText('B29 145',70,130);
    lc.fillStyle=p.find(c=>c.code==='B26').hex;lc.fillRect(20,40,25,25);
    lc.fillStyle=p.find(c=>c.code==='B29').hex;lc.fillRect(20,105,25,25);
    const t=performance.now();
    const ocr=await recognizeLegend(legendCanvas.toDataURL(),{x:0,y:0,width:550,height:190,label:'test'},()=>{});
    const ocrMs=performance.now()-t;
    // A deliberately unconfirmed count sheet exercises the complete UI correction flow.
    const {createBlankPattern}=await import('/src/utils/imageToPattern.ts');
    const {rgbToLab,hexToRgb,deltaE2000}=await import('/src/utils/colorUtils.ts');
    const {parseLegendText}=await import('/src/utils/legendRecognition.ts');
    const a=p.find(c=>c.code==='B13'),b=p.find(c=>c.code==='B29');
    const grid=createBlankPattern(18,17,b);const ar=hexToRgb(a.hex),br=hexToRgb(b.hex);
    let mid=ar,best=Infinity;
    for(let i=0;i<=1000;i++){const t=i/1000,rgb={r:ar.r*(1-t)+br.r*t,g:ar.g*(1-t)+br.g*t,b:ar.b*(1-t)+br.b*t};const d=Math.abs(deltaE2000(rgbToLab(rgb),rgbToLab(ar))-deltaE2000(rgbToLab(rgb),rgbToLab(br)));if(d<best){best=d;mid=rgb}}
    grid.flat().forEach((c,i)=>{if(i<158)Object.assign(c,{colorCode:a.code,colorName:a.name,hex:a.hex,symbol:a.code});c.rawRgb=i>=158&&i<161?mid:hexToRgb(c.hex);c.confidence=.95;c.rawDetectedColor=c.colorCode;});
    const project={id:'validation-test',name:'校驗整合測試',sourceType:'grid_recognition',grid,size:{width:18,height:17},legend:parseLegendText('B13 161\nB29 145','ocr',.98).entries,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),status:'draft',tags:[]};
    localStorage.setItem('beadflow:projects',JSON.stringify([project]));
    return {results,photoChanged,ocr:ocr.entries,ocrMs};
  },baseline);
  assert.ok(result.results.every(x=>x.ticks>2),'worker keeps main thread responsive');
  if(baseline){assert.ok(result.results.every(x=>x.changed===0),'same grid output');assert.equal(result.photoChanged,0,'standard photo unchanged');}
  assert.deepEqual(result.ocr.map(e=>[e.colorCode,e.expectedCount]),[['B26',161],['B29',145]]);
  await page.reload();
  await page.getByRole('button',{name:'照片轉拼豆',exact:true}).first().click();
  await expect(page.getByRole('heading',{name:'辨識品質',exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'色彩數量',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'辨識格線圖紙',exact:true}).first().click();
  await page.getByRole('button',{name:'打開',exact:true}).click();
  await expect(page.getByText('圖紙校驗',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:/B13.*原圖 161｜辨識 158/})).toBeVisible();
  await page.getByRole('button',{name:/B13.*原圖 161｜辨識 158/}).click();
  await page.getByRole('button',{name:/定位第/}).first().click();
  await page.screenshot({path:'work/validation-desktop.png'});
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'改成建議色號 B13',exact:true}).first().click();
  await expect(page.getByRole('button',{name:/數量一致.*B13/})).toBeVisible();
  await expect(page.getByRole('button',{name:/數量一致.*B29/})).toBeVisible();
  await page.getByRole('button',{name:'儲存圖紙',exact:true}).click();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'匯出完整圖紙 PNG',exact:true}).click();
  const download=await downloadPromise;await download.saveAs('work/validation-export.png');
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'work/validation-mobile.png'});
  assert.ok(await page.locator('canvas').first().evaluate(c=>c.width>0&&c.height>0));
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false,'mobile width');
  await page.setViewportSize({width:1440,height:1000});
  await page.getByRole('button',{name:'返回入口',exact:true}).click();
  const chart=await page.evaluate(async()=>{
    const {recognitionPalette:p}=await import('/src/data/recognitionPalette.ts');
    const c=document.createElement('canvas');c.width=1040;c.height=1140;const ctx=c.getContext('2d');
    ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle=p.find(c=>c.code==='B29').hex;ctx.fillRect(0,0,1040,1040);
    ctx.strokeStyle='#222';ctx.lineWidth=1;
    for(let i=0;i<=104;i++){ctx.beginPath();ctx.moveTo(i*10,0);ctx.lineTo(i*10,1040);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*10);ctx.lineTo(1040,i*10);ctx.stroke();}
    ctx.fillStyle='#111';ctx.font='30px Arial';ctx.fillText('B29 10816',40,1110);
    return c.toDataURL();
  });
  await page.locator('input[type=file]').setInputFiles({name:'large-chart.png',mimeType:'image/png',buffer:Buffer.from(chart.split(',')[1],'base64')});
  await expect(page.getByLabel('起點 X',{exact:true})).toBeVisible();
  for(const [label,value] of [['起點 X','0'],['起點 Y','0'],['格寬','10'],['格高','10'],['欄數','104'],['列數','104'],['起始列','1'],['起始欄','1'],['結束列','104'],['結束欄','104']])await page.getByLabel(label,{exact:true}).fill(value);
  await page.getByRole('button',{name:'讀取框內色號與顆數',exact:true}).click();
  await expect(page.getByText(/讀到 1 個色號/)).toBeVisible({timeout:60000});
  await page.getByRole('button',{name:'確認全部數量',exact:true}).click();
  await page.getByRole('button',{name:'辨識圖紙',exact:true}).click();
  await expect(page.getByRole('button',{name:/數量一致.*B29.*10816/})).toBeVisible({timeout:30000});
  result.uiProfile=await page.evaluate(()=>globalThis.__beadflowProfile);
  assert.ok(result.uiProfile.canvasRender>0);
  assert.ok(result.uiProfile.reactCommit>=0);
  await page.getByRole('button',{name:'儲存圖紙',exact:true}).click();
  await expect.poll(async()=>page.evaluate(()=>JSON.parse(localStorage.getItem('beadflow:projects')).some(p=>p.id!=='validation-test'))).toBeTruthy();
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('beadflow:projects')).find(p=>p.id!=='validation-test'));
  assert.equal(saved.legend[0].expectedCount,10816);
  assert.equal(saved.grid.length,104);
  await page.screenshot({path:'work/recognition-complete.png'});
  mkdirSync('work',{recursive:true});writeFileSync('work/after-results.json',JSON.stringify(result,null,2));
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify(result,null,2));
  console.log('PASS: worker, OCR, comparison, live validation, save, export, mobile, no console/runtime errors');
} finally {
  await browser?.close();server.kill();
}
