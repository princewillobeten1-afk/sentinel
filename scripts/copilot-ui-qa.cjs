// Local presentation verification. Every API response is a test fixture; no AI calls or transactions.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.UI_PREVIEW_URL || 'http://localhost:3000';
const mint = 'So11111111111111111111111111111111111111112';
const sessionId = 'aa763b97-29ea-4563-b986-50b87b2bb615';
async function main() {
  const output = path.join(process.cwd(),'artifacts','copilot');
  await fs.mkdir(output,{recursive:true});
  const browser = await chromium.launch({headless:true});
  try {
    const context = await browser.newContext({reducedMotion:'reduce'});
    await context.routeWebSocket('**/ws',socket=>socket.close());
    await context.route('**/*',route=>route.request().headers()['next-action'] ? route.fulfill({status:503,body:'Test: action unavailable'}) : route.fallback());
    let configured = false, mode = 'answer', posts = [], deleted = false;
    const facts=[{id:'e_test',mint,metric:'liquidityUsd',label:'Liquidity',value:12345,unit:'USD',status:'measured',category:'market',observedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()}];
    const answer={validated:true,sections:[{title:'Evidence',text:'Measured public observations are available below. Check their observation times before acting.',evidenceIds:['e_test']}]};
    await context.route('**/api/**',async route=>{
      const req=route.request(), url=new URL(req.url());
      const ok=data=>route.fulfill({json:{success:true,data}});
      if(url.pathname==='/api/v1/auth/me') return route.fulfill({json:{user:{id:'ui-test',displayName:'UI Tester',role:'user'},linkedWallets:[]}});
      if(url.pathname==='/api/v1/ai') return ok({status:configured?'configured':'setup_required'});
      if(url.pathname==='/api/v1/ai/sessions') return ok({sessions:[]});
      if(url.pathname==='/api/v1/ai/sessions/'+sessionId) {
        if(req.method()==='DELETE'){deleted=true;return ok({deleted:true});}
        return ok({turns:[]});
      }
      if(url.pathname==='/api/v1/ai/copilot') {
        const body=req.postDataJSON(); posts.push(body);
        if(mode==='quota') return route.fulfill({status:429,json:{error:{message:'The pilot usage limit has been reached.'}}});
        if(mode==='slow') await new Promise(resolve=>setTimeout(resolve,1500));
        const events=[{type:'session',sessionId},{type:'progress',message:'Reviewing measured evidence...'},{type:'evidence',facts,notes:[]},{type:'answer',answer},{type:'done',requestId:body.requestId}];
        return route.fulfill({contentType:'text/event-stream',body:events.map(e=>'data: '+JSON.stringify(e)+'\n\n').join('')}).catch(()=>{});
      }
      return route.fulfill({status:503,json:{error:{message:'UI fixture: unavailable'}}});
    });
    const page=await context.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(120000);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/ai',{waitUntil:'domcontentloaded'});
    await page.getByText('Setup required.',{exact:false}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Ask Copilot',exact:true}).isDisabled(),true);
    configured=true;await page.getByRole('button',{name:'Check setup again'}).click();
    await page.getByText('Public-data pilot · analysis only').waitFor();
    await page.getByRole('checkbox').click();
    await page.getByRole('textbox',{name:'Exact Solana token mint (optional)'}).fill(mint);
    const input=page.getByRole('textbox',{name:'Public market question'});
    await input.fill('Buy 0.5 SOL');await page.getByRole('button',{name:'Ask Copilot',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'Public market questions only'}).waitFor();
    assert.equal(posts.length,0,'Private trade amounts never reach the API');
    await input.fill('Assess this token');await page.getByRole('button',{name:'Ask Copilot',exact:true}).click();
    await page.getByText('12,345 USD').waitFor();
    assert.equal(posts.length,1);assert.equal(posts[0].context.mint,mint);
    assert.deepEqual(Object.keys(posts[0]).sort(),['context','privacyAccepted','question','requestId']);
    assert.equal(await page.getByRole('link',{name:'Prepare trade'}).getAttribute('href'),'/trade/solana/'+mint);
    const measurements=[];
    for(const [width,height] of [[1440,900],[1280,800],[768,1024],[390,844]]) {
      await page.setViewportSize({width,height});
      await page.screenshot({path:path.join(output,'ai-'+width+'.png'),fullPage:true});
      const actual=await page.evaluate(()=>document.documentElement.scrollWidth);
      assert.ok(actual<=width,`No horizontal overflow at ${width}`); measurements.push({width,height,actual});
    }
    mode='quota';await input.fill('Analyze the chart');await page.getByRole('button',{name:'Ask Copilot',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'usage limit'}).waitFor();
    mode='slow';await input.fill('What changed?');await page.getByRole('button',{name:'Ask Copilot',exact:true}).click();
    await page.getByRole('button',{name:'Cancel',exact:true}).click();
    assert.equal(await page.getByRole('button',{name:'Ask Copilot',exact:true}).isEnabled(),false); // input cleared; not an active generation
    await page.getByRole('button',{name:'Delete',exact:true}).click();
    await page.getByRole('button',{name:'Delete conversation',exact:true}).click();
    await page.getByRole('heading',{name:'Evidence, before opinions.'}).waitFor();assert.equal(deleted,true);
    await page.goto(base+'/discover',{waitUntil:'domcontentloaded'});
    const launch=page.getByRole('button',{name:'Copilot',exact:true});await launch.waitFor();await launch.focus();await page.keyboard.press('Enter');
    const dialog=page.getByRole('dialog',{name:'Sentinel Copilot'});await dialog.waitFor();
    for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(el=>el.contains(document.activeElement)));}
    await page.screenshot({path:path.join(output,'discover-sheet-390.png')});
    await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
    assert.ok(await launch.evaluate(el=>el===document.activeElement),'Focus returns to launcher');
    await fs.writeFile(path.join(output,'report.json'),JSON.stringify({measurements,errors,interactions:'passed',fixtures:true},null,2));
    assert.deepEqual(errors,[]);console.log(JSON.stringify({screens:5,interactions:'passed',errors}));
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
