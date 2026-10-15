const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:834,height:1194}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.HENRI_TEST_URL||'http://127.0.0.1:8765')+'/preview/refonte/');
 await page.evaluate(()=>{
  groupsData=[{id:'edu3',name:'EDU3G2-04',students:[]},{id:'edu2',name:'EDU2G2-03',students:[]}];annualPlans={};savedSequences={};activeSequence=null;individualSessions=[];calendarExceptions=[];scheduleEntries={};schoolDays={};
  const dates=['2026-10-22','2026-10-23','2026-10-26','2026-10-27','2026-10-28','2026-11-05','2026-11-09','2026-11-12','2026-11-16','2026-11-19'];
  for(const date of dates){schoolDays[date]='Jour 1';scheduleEntries[date]=groupsData.map((g,i)=>({group:g.name,matchedGroupId:g.id,time:i?'12 h 35':'9 h 35',period:i+1,kind:'course'}));}
  for(const g of groupsData){
   annualPlans[g.id]=[{id:'u-'+g.id,sport:'Ultimate',courses:4},{id:'b-'+g.id,sport:'Badminton',courses:4},{id:'v-'+g.id,sport:'Volleyball',courses:1}];
   const seq=makeSequence({comp:'C2',sport:'Badminton',groupId:g.id,groupName:g.name,count:4,duration:'70 min',annualBlockId:'b-'+g.id,useHenri:true});savedSequences[g.id+'::b-'+g.id]=seq;
   const entry=scheduleEntries['2026-10-28'].find(e=>e.matchedGroupId===g.id);
   individualSessions.push({id:'pool-'+g.id,groupId:g.id,date:'2026-10-28',courseKey:courseOccurrenceKey('2026-10-28',entry),annualBlockId:'b-'+g.id,independent:false,sport:'Poolball',title:'Poolball',blocks:[]});
  }
  localStorage.setItem('previewHenriSlate:henriScheduleEntries',JSON.stringify(scheduleEntries));localStorage.setItem('previewHenriSlate:henriSchoolDays',JSON.stringify(schoolDays));henriPersistSharedState();rebuildPlanningAssignments();
 });
 async function check(){
  await page.evaluate(()=>{goHome();shownYear=2026;shownMonth=10;renderMonth();setCalendarView('month');});
  for(const button of await page.locator('.monthCourseButton[data-date="2026-11-05"]').all())assert.match(await button.innerText(),/Badminton\nCours 1\/4/);
  const projection=await page.evaluate(()=>groupsData.map(g=>{const slots=getGroupCourseOccurrences(g.id);return {numbers:slots.filter(s=>s.entry.annualPlan==='Badminton').map(s=>s.entry.courseIndex),first:getSequenceOccurrences(savedSequences[g.id+'::b-'+g.id])[0].date,last:slots.filter(s=>henriCourseIsEvaluation(s.entry)&&s.entry.annualPlan==='Badminton').map(s=>s.date),next:slots.at(-1).entry.courseIndex,pool:slots[4].entry.courseIndex}}));
  for(const value of projection)assert.deepEqual(value,{numbers:[0,1,2,3],first:'2026-11-05',last:['2026-11-16'],next:0,pool:null});
  await page.locator('.monthCourseButton[data-date="2026-11-05"]').first().click();assert.equal(await page.locator('#editSessionMeta').innerText(),'Séance 1 sur 4');
 }
 await check();await page.reload();await check();assert.deepEqual(errors,[]);
 console.log('PASS: two groups start Badminton 1/4 on Nov 5 after standalone Poolball; exact first lesson opens; all four courses and final evaluation remain; next sport restarts at 1; reload stable.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
