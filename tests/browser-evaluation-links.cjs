const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.HENRI_CHROMIUM?{executablePath:process.env.HENRI_CHROMIUM}:require('node:fs').existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:834,height:1194}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto((process.env.HENRI_TEST_URL||'http://127.0.0.1:8765')+'/preview/refonte/');
 await page.evaluate(()=>{
  groupsData=[{id:'g1',name:'G1',students:[{id:'s1',name:'Élève test',compatible:[],incompatible:[]}]},{id:'g2',name:'G2',students:[]}];annualPlans={};savedSequences={};activeSequence=null;individualSessions=[];calendarExceptions=[];schoolDays={};scheduleEntries={};
  for(const group of groupsData){
   annualPlans[group.id]=[{id:'first-'+group.id,sport:'Badminton',comp:'C2',courses:4},{id:'second-'+group.id,sport:'Badminton',comp:'C2',courses:5}];
   for(const block of annualPlans[group.id])savedSequences[sequenceStorageKey(group.id,block.id)]=makeSequence({comp:'C2',sport:'Badminton',groupId:group.id,groupName:group.name,count:block.courses,duration:'70 min',annualBlockId:block.id,useHenri:true});
  }
  for(let i=0;i<9;i++){const date='2026-10-'+(19+i);schoolDays[date]='Jour 1';scheduleEntries[date]=groupsData.map((g,j)=>({group:g.name,matchedGroupId:g.id,time:j?'9 h 35':'8 h 10',period:j+1,kind:'course'}));}
  localStorage.setItem('previewHenriSlate:henriSchoolDays',JSON.stringify(schoolDays));localStorage.setItem('previewHenriSlate:henriScheduleEntries',JSON.stringify(scheduleEntries));henriPersistSharedState();rebuildPlanningAssignments();
 });
 async function month(){await page.evaluate(()=>{goHome();shownYear=2026;shownMonth=9;renderMonth();setCalendarView('month');});await page.waitForTimeout(200);}
 await month();const badge=(date,index=0)=>page.locator('.dayCell').filter({has:page.locator('.monthCourseButton[data-date="'+date+'"][data-course-index="'+index+'"]')}).locator('.calendarEvaluationButton').nth(index);
 assert.equal(await page.locator('.calendarEvaluationButton').count(),4);assert.equal(await page.locator('.calendarEvaluationButton:disabled').count(),4);
 assert.equal(await badge('2026-10-22').isDisabled(),true);assert.equal(await badge('2026-10-27').isDisabled(),true);
 // Plan a real grid through the existing editor and choose the first of two Badminton sequences.
 await page.evaluate(()=>{henriEvalOpenBank();henriEvalNew(true);});await page.locator('.heGroup[value="g1"]').check();await page.selectOption('#heSport','Badminton');await page.selectOption('#heSequence','annual:first-g1');
 assert.equal(await page.locator('#heCourse').inputValue(),'4');await page.fill('#heTitle','Évaluation finale première séquence');await page.getByRole('button',{name:'Enregistrer la grille',exact:true}).click();
 await page.getByRole('button',{name:'Modifier / attribuer',exact:true}).click();assert.equal(await page.locator('#heSequence').inputValue(),'annual:first-g1');await page.getByRole('button',{name:'Enregistrer la grille',exact:true}).click();
 const firstId=await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('previewHenriSlate:evaluations:v1')))[0]);
 await month();assert.equal(await badge('2026-10-22').isEnabled(),true);assert.equal(await badge('2026-10-22',1).isDisabled(),true);assert.equal(await badge('2026-10-27').isDisabled(),true);
 await badge('2026-10-22').click();assert.equal(await page.locator('.screen.active').getAttribute('id'),'henriEvaluations');assert.match(await page.locator('#henriEvalContent h2').innerText(),/première séquence/);assert.match(await page.locator('#henriEvalContent').innerText(),/G1 · 2026-10-22/);
 await page.locator('.hePick[data-id="c0"][data-value="7"]').click();await page.locator('.hePick[data-id="c1"][data-value="8"]').click();await page.locator('.hePick[data-id="c2"][data-value="9"]').click();await page.getByRole('button',{name:'Enregistrer cette évaluation',exact:true}).click();
 await page.reload();await month();await badge('2026-10-22').click();assert.equal(await page.locator('.heScore[data-id="c0"]').inputValue(),'7');
 // Explicitly plan the second sequence's final fifth lesson, independently of the first.
 await page.evaluate(()=>{henriEvalOpenBank();henriEvalNew(true);});await page.locator('.heGroup[value="g1"]').check();await page.selectOption('#heSport','Badminton');await page.selectOption('#heSequence','annual:second-g1');assert.equal(await page.locator('#heCourse').inputValue(),'5');await page.fill('#heTitle','Évaluation finale deuxième séquence');await page.getByRole('button',{name:'Enregistrer la grille',exact:true}).click();
 await month();await badge('2026-10-27').click();assert.match(await page.locator('#henriEvalContent h2').innerText(),/deuxième séquence/);
 // Four actual sessions inside a five-period KEEP block mark session 4; period 5 remains unplanned.
 await page.evaluate(()=>{savedSequences['g1::second-g1'].sessions.pop();henriPersistSharedState();rebuildPlanningAssignments();});await month();assert.equal(await badge('2026-10-26').isEnabled(),true);assert.equal(await page.locator('.dayCell').filter({has:page.locator('.monthCourseButton[data-date="2026-10-27"][data-course-index="0"]')}).locator('.calendarEvaluationButton').count(),1); // G2 only
 await badge('2026-10-26').click();assert.match(await page.locator('#henriEvalContent h2').innerText(),/deuxième séquence/);
 // Deleting a planned grid disables its link but preserves saved scores.
 await page.evaluate(id=>henriEvalDelete(id),firstId);await month();assert.equal(await badge('2026-10-22').isDisabled(),true);assert.ok(await page.evaluate(()=>Object.keys(JSON.parse(localStorage.getItem('previewHenriSlate:evaluationScores:v1'))).length));
 const ambiguity=await page.evaluate(()=>{const grids=JSON.parse(localStorage.getItem('previewHenriSlate:evaluations:v1'));grids.legacy={id:'legacy',title:'Ancienne grille ambiguë',groupIds:['g1'],sport:'Badminton',courseNumber:4,criteria:[]};localStorage.setItem('previewHenriSlate:evaluations:v1',JSON.stringify(grids));return henriEvalForCourse(getGroupCourseOccurrences('g1')[3].entry).length;});assert.equal(ambiguity,0);
 assert.deepEqual(errors,[]);console.log('PASS: final courses 4/4 and 5/5, inactive without grid, exact group/sequence links, persisted scores, reload, KEEP 4/5, deletion preserves scores.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
