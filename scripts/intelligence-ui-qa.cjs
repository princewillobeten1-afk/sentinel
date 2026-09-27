// Presentation/interaction regression checks with labelled fixtures. No signing, quotes or transactions.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const mint = 'So11111111111111111111111111111111111111112';
const second = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const base = process.env.UI_PREVIEW_URL || 'http://localhost:3000';
const observation = new Date().toISOString();
const m = (id, label, category, value, unit='count', status='measured') => ({id,label,category,value,unit,status,observedAt:value===null?null:observation});
const metrics = [m('price','Price','market',0.000000001,'USD'),m('marketCap','Market cap','market',56000,'USD'),m('liquidity','Liquidity','market',6800,'USD','stale'),m('volume24h','Volume · 24h','market',49000,'USD'),m('top10','Top 10 holdings','ownership',40,'%'),m('dev','Developer holdings','ownership',0,'%'),m('snipers','Sniper holdings','ownership',null,'%','loading'),m('insiders','Insider holdings','ownership',null,'%','unavailable'),m('bundlers','Bundled holdings','ownership',3,'%'),m('holders','Holders','ownership',223),m('mintRevoked','Mint authority revoked','security',true,'boolean'),m('freezeRevoked','Freeze authority revoked','security',false,'boolean'),m('lpLocked','Liquidity lock verified','security',null,'boolean','unavailable'),m('launches','Recorded creator launches','creator',15),m('migrations','Recorded creator migrations','creator',2)];
const report = {schemaVersion:'2',methodologyVersion:'observed-evidence-v1',generatedAt:observation,token:{mint,chain:'solana',symbol:'LONGTOKEN',name:'A very long token name that must wrap without hiding report actions or overflowing the page',creator:mint},metrics,findings:[{id:'top10',title:'Concentrated ownership',severity:'attention',description:'The top ten holders control at least 35% of supply.',evidenceIds:['top10']}],coverage:{total:15,measured:11,stale:1,pending:1},lifecycle:{state:null,signature:null,pool:null,observedAt:null},limitations:['Missing evidence is not evidence of safety.']};
async function main(){
  const output=path.join(process.cwd(),'artifacts','intelligence');await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({headless:true});
  let page;
  try {
    const context=await browser.newContext({reducedMotion:'reduce',permissions:['clipboard-read','clipboard-write']});
    await context.routeWebSocket('**/ws',socket=>socket.close());
    let mode='normal', candidateMode='normal', reportCalls=0;
    await context.route('**/api/**',async route=>{
      const url=new URL(route.request().url());
      const ok=data=>route.fulfill({json:{success:true,data}});
      if(url.pathname==='/api/v1/watchlist') return route.fulfill({status:401,json:{success:false,error:{message:'Not signed in'}}});
      if(url.pathname==='/api/v1/intelligence/candidates') return ok({tokens:candidateMode==='empty'?[]:[{mint,name:report.token.name,symbol:'LONGTOKEN',marketCap:metrics[1],liquidity:metrics[2]}]});
      if(url.pathname.endsWith('/history')) return ok({status:'measured',observations:[{category:'ownership',observedAt:observation}]});
      if(url.pathname.startsWith('/api/v1/intelligence/solana/')) {
        reportCalls++;
        if(mode==='error') return route.fulfill({status:503,json:{success:false,error:{message:'Test failure'}}});
        if(mode==='slow') await new Promise(resolve=>setTimeout(resolve,1400));
        return ok({...report,token:{...report.token,mint:url.pathname.split('/').pop(),symbol:url.pathname.endsWith(second)?'SECOND':'LONGTOKEN'}}).catch(()=>{});
      }
      return route.fulfill({status:503,json:{success:false,error:{message:'UI fixture: unavailable'}}});
    });
    page=await context.newPage();page.setDefaultNavigationTimeout(120000);page.setDefaultTimeout(30000);
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+'/intelligence',{waitUntil:'domcontentloaded'});
    await page.getByRole('link',{name:/Analyze LONGTOKEN/}).waitFor();
    const measurements=[];
    async function capture(label){for(const [width,height] of [[1440,900],[1280,800],[768,1024],[390,844]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>{document.activeElement?.blur();document.documentElement.style.scrollBehavior='auto';window.scrollTo({top:0,behavior:'instant'});});await page.waitForFunction(()=>window.scrollY===0);await page.screenshot({path:path.join(output,`${label}-${width}.png`),fullPage:true});
      const actual=await page.evaluate(()=>document.documentElement.scrollWidth);
      assert.ok(actual<=width,`${label} horizontal overflow at ${width}: ${actual}`);measurements.push({label,width,height,actual});
    }}
    await capture('overview');
    const input=page.getByRole('textbox',{name:'Find a token or analyze an exact mint'});
    await input.fill('SOL');await page.getByRole('button',{name:'Analyze token',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Symbols are not unique'}).waitFor();assert.equal(reportCalls,0);
    await input.fill('not-a-token');await page.getByRole('heading',{name:'No current matches'}).waitFor();
    await input.fill('');candidateMode='empty';await page.getByRole('button',{name:'Refresh list'}).click();await page.getByRole('heading',{name:'No current tokens received'}).waitFor();
    candidateMode='normal';await page.getByRole('button',{name:'Refresh list'}).click();await page.getByRole('link',{name:/Analyze LONGTOKEN/}).waitFor();
    mode='slow';await input.fill(mint);await input.press('Enter');
    await page.waitForURL('**/intelligence/solana/'+mint,{timeout:120000});
    await page.getByRole('status').filter({hasText:'Loading measured evidence'}).waitFor();
    await page.getByRole('heading',{name:/LONGTOKEN/}).waitFor();mode='normal';
    assert.equal(await page.getByRole('link',{name:'Open Trade'}).getAttribute('href'),'/trade/solana/'+mint);
    await page.getByRole('button',{name:'Watchlist',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Watchlisted',exact:true}).getAttribute('aria-pressed'),'true');
    await page.getByRole('button',{name:'Copy mint'}).click();await page.getByRole('button',{name:'Copied'}).waitFor();
    assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),mint);
    await page.getByRole('button',{name:'Load observations'}).click();await page.getByText('ownership observed',{exact:true}).waitFor();
    await page.getByText('Methodology & limitations',{exact:true}).click();await page.getByText('Missing evidence is not evidence of safety.',{exact:true}).waitFor();
    await capture('report');
    mode='error';await page.getByRole('button',{name:'Refresh evidence'}).click();await page.getByRole('alert').filter({hasText:'Earlier observations remain visible'}).waitFor();
    assert.equal(await page.getByRole('heading',{name:/LONGTOKEN/}).count(),1);
    mode='normal';await page.getByRole('button',{name:'Retry',exact:true}).click();await page.getByRole('alert').filter({hasText:'Earlier observations'}).waitFor({state:'hidden'});
    await page.goto(base+'/intelligence/solana/'+second,{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:/SECOND/}).waitFor();
    assert.equal(await page.getByRole('heading',{name:/LONGTOKEN/}).count(),0);
    await page.goto(base+'/intelligence/solana/SOL',{waitUntil:'domcontentloaded'});await page.getByRole('heading',{name:'An exact Solana mint is required'}).waitFor();
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify({fixtures:true,measurements,errors,interactions:'passed'},null,2));
    assert.deepEqual(errors,[]);console.log(JSON.stringify({screens:8,interactions:'passed',errors}));
  }catch(error){if(page){await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});console.error('Browser state:',page.url(),(await page.locator('body').innerText()).slice(-5000));}throw error;}finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
