import {test,expect} from '@playwright/test';
test('built release trains, captures decisions, saves/reopens archive and resumes',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('./');
 await expect(page.locator('i[data-lucide]')).toHaveCount(0);
 await page.getByRole('button',{name:'Pong Track and intercept a moving ball'}).click();
 await page.getByRole('button',{name:'Run one generation',exact:true}).click();
 await expect(page.locator('#archive-position')).toContainText('Viewing generation 1 of 1');
 await expect(page.locator('#choice-reason')).toContainText('Recorded evaluation decision 1');
 const first=await page.locator('#observation-list').innerText();
 await page.getByRole('button',{name:'Run one generation',exact:true}).click();
 await page.getByRole('button',{name:'Previous generation',exact:true}).click();
 await page.getByRole('button',{name:'Next move',exact:true}).click();
 await page.getByRole('button',{name:'Next move',exact:true}).click();
 await expect(page.locator('#choice-reason')).toContainText('Recorded evaluation decision 2');
 const inspection=await page.locator('#choice-reason').innerText();
 await page.getByRole('button',{name:'Save project',exact:true}).click();
 await expect(page.getByText('Champion, population, archive, replay and settings retained.',{exact:true})).toBeVisible();
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('neural-forge-project')!));
 expect(saved.version).toBe(2);expect(saved.archive).toHaveLength(2);expect(saved.engine.genomes).toHaveLength(120);expect(saved.archive[0].trace.provenance).toBe('evaluated');expect(saved.archive[0].steps[0].input[0]).toBe(.5);
 await page.reload();
 await page.getByRole('button',{name:'Open project',exact:true}).click();
 await expect(page.locator('#archive-position')).toContainText('Viewing generation 1 of 2');
 await expect(page.locator('#replay-position')).toContainText('MOVE 2 /');
 await expect(page.locator('#choice-reason')).toHaveText(inspection);
 await page.getByRole('button',{name:'Latest',exact:true}).click();
 await page.getByRole('button',{name:'Run one generation',exact:true}).click();
 await expect(page.locator('#archive-position')).toContainText('Viewing generation 3 of 3');
 // malformed data cannot erase the active archive or overwrite the original save.
 await page.evaluate(()=>localStorage.setItem('neural-forge-project','{"format":"neural-forge","version":999}'));
 await page.getByRole('button',{name:'Open project',exact:true}).click();
 await expect(page.getByText('Project not loaded',{exact:true})).toBeVisible();
 await expect(page.locator('#archive-position')).toContainText('Viewing generation 3 of 3');
 expect(await page.evaluate(()=>localStorage.getItem('neural-forge-project'))).toBe('{"format":"neural-forge","version":999}');
 expect(errors).toEqual([]);expect(first).toContain('Paddle');
 await page.screenshot({path:'test-results/release-save-reopen.png',fullPage:true});
});
test('release exposes verifiable build provenance and small JS payload',async({request})=>{
 const response=await request.get('./build-info.json');expect(response.ok()).toBeTruthy();const info=await response.json();expect(info.version).toBe('0.5.6');expect(info.sourceCommit).toMatch(/^[a-f0-9]{40}$/);expect(info.packageLockSha256).toMatch(/^[a-f0-9]{64}$/);const js=Object.entries(info.artifacts).filter(([p])=>p.endsWith('.js'));expect(js.length).toBeGreaterThan(0);expect(js.reduce((n,[,v]:any)=>n+v.size,0)).toBeLessThan(200000);
});
test('built-in training and project recovery work with all external network blocked',async({page})=>{
 const blocked:string[]=[];await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname!=='127.0.0.1'&&u.hostname!=='localhost'){blocked.push(u.origin);return route.abort();}return route.continue();});
 await page.goto('./');await page.getByRole('button',{name:'Pong Track and intercept a moving ball'}).click();await page.getByRole('button',{name:'Run one generation',exact:true}).click();await expect(page.locator('#archive-position')).toContainText('Viewing generation 1 of 1');await page.getByRole('button',{name:'Save project',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Open project',exact:true}).click();await expect(page.locator('#archive-position')).toContainText('Viewing generation 1 of 1');await page.getByRole('button',{name:'Next move',exact:true}).click();await expect(page.locator('#replay-position')).toContainText('MOVE 1 /');await page.getByRole('button',{name:'Custom screen task Unavailable in standalone edition'}).click();await expect(page.getByText('Screen tasks unavailable',{exact:true})).toBeVisible();expect(blocked).toEqual([]);
});
