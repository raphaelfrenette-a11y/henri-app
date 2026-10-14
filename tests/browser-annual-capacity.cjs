const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.HENRI_CHROMIUM?{executablePath:process.env.HENRI_CHROMIUM}:require('node:fs').existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:834,height:1194}});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());await page.goto((process.env.HENRI_TEST_URL||'http://127.0.0.1:8765')+'/preview/refonte/');
 await page.evaluate(async()=>{
  groupsData=[{id:'g1',name:'G1',students:[]},{id:'g2',name:'G2',students:[]}];annualPlans={g1:[{id:'u',sport:'Ultimate',comp:'C2',courses:4},{id:'f',sport:'Conditionnement physique',comp:'C3',courses:4}]};savedSequences={};activeSequence=null;individualSessions=[];calendarExceptions=[];schoolDays={};scheduleEntries={};
  for(let i=0;i<10;i++){const date='2026-10-'+(19+i);schoolDays[date]='Jour 1';scheduleEntries[date]=[{group:'G2',matchedGroupId:'g2',time:'9 h 35',period:2,kind:'course'}];if(i<8)scheduleEntries[date].unshift({group:'G1',matchedGroupId:'g1',time:'8 h 10',period:1,kind:'course'});}
  localStorage.setItem('previewHenriSlate:henriScheduleEntries',JSON.stringify(scheduleEntries));localStorage.setItem('previewHenriSlate:henriSchoolDays',JSON.stringify(schoolDays));fillPlanGroupSelects();annualGroup.value='g1';annualBulkSelection=new Set(['g1','g2']);rebuildPlanningAssignments();await saveAnnualAndPlanSequences();openAnnualPlanner();annualGroup.value='g2';annualGroupChanged();
 });
 assert.equal(await page.locator('#annualRemaining').innerText(),'+2');
 const check=()=>page.evaluate(()=>({counts:annualPlans.g2.map(b=>b.courses),sports:getGroupCourseOccurrences('g2').map(s=>s.entry.annualPlan),totals:getGroupCourseOccurrences('g2').map(s=>s.entry.courseTotal)}));
 let state=await check();assert.deepEqual(state.counts,[4,4]);assert.deepEqual(state.sports,['Ultimate','Ultimate','Ultimate','Ultimate','Conditionnement physique','Conditionnement physique','Conditionnement physique','Conditionnement physique',null,null]);assert.deepEqual(state.totals,[4,4,4,4,4,4,4,4,null,null]);
 await page.reload();await page.evaluate(()=>{openAnnualPlanner();annualGroup.value='g2';annualGroupChanged();});assert.equal(await page.locator('#annualRemaining').innerText(),'+2');assert.deepEqual((await check()).counts,[4,4]);
 await page.evaluate(()=>{const slot=getGroupCourseOccurrences('g2')[8];openQuickSessionForCourse(slot.date,slot.index);quickSport.value='Jeux de coopération';buildQuickSession();scheduleQuickSession();});
 assert.equal(await page.locator('#annualRemaining').innerText(),'+1');
 await page.evaluate(()=>{openAnnualPlanner();annualGroup.value='g2';annualGroupChanged();annualComp.value='C2';annualSport.innerHTML=getAnnualSportOptions('C2');annualSport.value='Volleyball';annualCourses.value=1;addAnnualBlock();});
 assert.equal(await page.locator('#annualRemaining').innerText(),'0');
 const final=await page.evaluate(()=>{const slots=getGroupCourseOccurrences('g2');return {counts:annualPlans.g2.map(b=>b.courses),independent:slots[8].entry.isIndividual,sport:slots[9].entry.annualPlan};});assert.deepEqual(final,{counts:[4,4,1],independent:true,sport:'Volleyball'});assert.deepEqual(errors,[]);
 console.log('PASS: 4 Ultimate + 4 fitness remain exactly 4 in both groups; 2 spare periods, reload, independent lesson consumes one, explicit new block fills the other.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
