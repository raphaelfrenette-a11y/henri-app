const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.HENRI_CHROMIUM?{executablePath:process.env.HENRI_CHROMIUM}:require('node:fs').existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:834,height:1194}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto((process.env.HENRI_TEST_URL||'http://127.0.0.1:8765')+'/preview/refonte/');
 await page.evaluate(()=>{
  groupsData=[{id:'g1',name:'G1',students:[]}];annualPlans={g1:[{id:'b',sport:'Badminton',comp:'C2',courses:5},{id:'v',sport:'Volleyball',comp:'C2',courses:3}]};savedSequences={};activeSequence=null;calendarExceptions=[];individualSessions=[];scheduleEntries={};schoolDays={};
  for(let i=0;i<8;i++){const date='2026-10-'+(19+i);schoolDays[date]='Jour 1';scheduleEntries[date]=[{group:'G1',matchedGroupId:'g1',time:'8 h 10',period:1,kind:'course'}];}
  const sequence=makeSequence({comp:'C2',sport:'Badminton',groupId:'g1',groupName:'G1',count:4,duration:'70 min',annualBlockId:'b',useHenri:true});savedSequences['g1::b']=sequence;
  localStorage.setItem('previewHenriSlate:henriSchoolDays',JSON.stringify(schoolDays));localStorage.setItem('previewHenriSlate:henriScheduleEntries',JSON.stringify(scheduleEntries));henriPersistSharedState();rebuildPlanningAssignments();goHome();
  // Seed the displayed week deterministically rather than relying on today's date.
  const monday=new Date('2026-10-19T12:00:00');henriWeekOffset=Math.round((monday-getWeekMonday())/(7*86400000));renderWeek();
 });
 await page.waitForTimeout(200);
 assert.match(await page.locator('#nextCoursePlan').innerText(),/Cours 1\/5/);
 assert.match(await page.locator('#weekGrid').innerText(),/Cours 3\/5/);assert.match(await page.locator('#weekGrid').innerText(),/Cours 5\/5/);
 await page.locator('.weekEvent').filter({hasText:'Cours 3/5'}).click();assert.equal(await page.locator('#editSessionMeta').innerText(),'Séance 3 sur 4');
 async function month(){await page.evaluate(()=>{goHome();shownYear=2026;shownMonth=9;renderMonth();setCalendarView('month');});await page.waitForTimeout(200);}
 await month();if(process.env.HENRI_TEST_SCREENSHOT)await page.screenshot({path:process.env.HENRI_TEST_SCREENSHOT,fullPage:true});const third=page.locator('.monthCourseButton[data-date="2026-10-21"]');assert.match(await third.innerText(),/Badminton\nCours 3\/5/);await third.click();assert.equal(await page.locator('#editSessionMeta').innerText(),'Séance 3 sur 4');
 await month();await page.locator('.monthCourseButton[data-date="2026-10-23"]').click();assert.equal(await page.locator('.screen.active').getAttribute('id'),'courseDetail');assert.match(await page.locator('#courseDetailMeta').innerText(),/Cours 5\/5/);
 assert.equal(await page.locator('#coursePlanningActions').getByRole('button',{name:'Créer / compléter la séquence',exact:true}).count(),1);
 await page.locator('#coursePlanningActions').getByRole('button',{name:'Créer une séance seule',exact:true}).click();assert.equal(await page.locator('#quickSport').inputValue(),'Badminton');assert.match(await page.locator('#quickContext').innerText(),/23 oct/);
 await page.evaluate(()=>{buildQuickSession();scheduleQuickSession();});
 const state=await page.evaluate(()=>{const slots=getGroupCourseOccurrences('g1');return {fifth:slots[4].entry.isIndividual,rank:henriCalendarLessonLabel(slots[4].date,slots[4].entry),next:slots[5].entry.annualBlockId,date:slots[5].date};});
 assert.deepEqual(state,{fifth:true,rank:'Cours 5/5',next:'v',date:'2026-10-24'});
 await page.reload();await month();await page.locator('.monthCourseButton[data-date="2026-10-23"]').click();assert.equal(await page.locator('.screen.active').getAttribute('id'),'sessionEditor');assert.match(await page.locator('#editSessionTitle').innerText(),/Badminton/);
 // An entirely unplanned block still has course numbers and a sequence creation path.
 await page.evaluate(()=>{savedSequences={};activeSequence=null;henriPersistSharedState();rebuildPlanningAssignments();});await month();await third.click();
 assert.match(await page.locator('#courseDetailMeta').innerText(),/Cours 3\/5/);await page.locator('#coursePlanningActions').getByRole('button',{name:'Créer la séquence',exact:true}).click();assert.equal(await page.locator('.screen.active').getAttribute('id'),'sequenceChoice');assert.equal(await page.locator('#macroCount').inputValue(),'5');
 assert.deepEqual(errors,[]);console.log('PASS: week/month course numbers, exact lesson 3, missing lesson choices, standalone lesson at course 5 without shifting following sport, reload.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
