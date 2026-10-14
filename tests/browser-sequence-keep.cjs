const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.HENRI_CHROMIUM?{executablePath:process.env.HENRI_CHROMIUM}:require('node:fs').existsSync('/usr/bin/chromium')?{executablePath:'/usr/bin/chromium'}:{}),args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:1024,height:768}});page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto((process.env.HENRI_TEST_URL||'http://127.0.0.1:8765')+'/preview/refonte/');
 assert.match(page.url(),/henri-v560\.html/);
 await page.evaluate(()=>{
  groupsData=[{id:'g1',name:'G1',students:[]},{id:'g2',name:'G2',students:[]}];annualPlans={};savedSequences={};activeSequence=null;calendarExceptions=[];individualSessions=[];
  const teacher={'Jour 1':[{time:'8 h 10',period:1,group:'G1',matchedGroupId:'g1',kind:'course',activity:'Éducation physique'}],'Jour 2':[{time:'9 h 35',period:2,group:'G2',matchedGroupId:'g2',kind:'course',activity:'Éducation physique'}]};
  const calendar={};for(let i=0;i<16;i++)calendar['2026-10-'+String(15+i).padStart(2,'0')]='Jour '+(i%2+1);
  Object.assign(importedSetupData,{teacherSchedule:teacher,schoolCalendar:calendar,groupSheets:groupsData});Object.assign(setupFiles,{teacherSchedule:true,schoolCalendar:true,groupSheets:true});
  for(const [key,value]of Object.entries({henriImportedTeacherSchedule:teacher,henriImportedSchoolCalendar:calendar,henriImportedGroups:groupsData}))localStorage.setItem('previewHenriSlate:'+key,JSON.stringify(value));
  generateMySchedule();
  for(const group of groupsData)annualPlans[group.id]=[{id:'ultimate-'+group.id,sport:'Ultimate',comp:'C2',courses:5},{id:'badminton-'+group.id,sport:'Badminton',comp:'C2',courses:3}];
  activeSequence=makeSequence({comp:'C2',sport:'Ultimate',groupId:'g1',groupName:'G1',count:4,duration:'70 min',annualBlockId:'ultimate-g1',useHenri:true});
  henriPersistSharedState();rebuildPlanningAssignments();renderSequenceEditor();go('sequenceEditor');
 });
 await page.waitForTimeout(500);await page.evaluate(()=>go('sequenceEditor'));
 // Each generated session can be opened and edited before explicit assignment.
 for(let i=0;i<4;i++){
  await page.evaluate(i=>openSessionEditor(i,'sequence'),i);await page.waitForTimeout(200);
  await page.selectOption('#sessionObjectiveSelect','__custom__');await page.waitForTimeout(100);await page.fill('#sessionObjectiveCustom','Objectif séance '+(i+1));
  await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);await page.click('#sessionEditor .back');
 }
 await page.click('button[onclick="saveSequence()"]');assert.equal(await page.locator('#sequenceSaveTargets input').count(),2);
 await page.locator('#sequenceSaveTargets input[value="g2"]').check();await page.getByRole('button',{name:'Confirmer l’enregistrement',exact:true}).click();
 await page.waitForFunction(()=>!document.getElementById('sequenceSaveTargets'));
 async function snapshot(){return page.evaluate(()=>Object.fromEntries(groupsData.map(g=>[g.id,getGroupCourseOccurrences(g.id).map(s=>({date:s.date,block:s.entry.annualBlockId,index:s.entry.sessionIndex,id:s.entry.sessionId,objective:s.entry.planData?.objective||null,title:s.entry.session}))])));}
 const before=await snapshot();assert.equal(before.g1[4].title,'À planifier');assert.equal(before.g2[4].title,'À planifier');assert.equal(before.g1[5].block,'badminton-g1');assert.notEqual(before.g1[2].date,before.g2[2].date);assert.notEqual(before.g1[2].id,before.g2[2].id);
 await page.reload();await page.waitForTimeout(150);
 assert.deepEqual(await snapshot(),before);
 await page.evaluate(()=>{const slot=getGroupCourseOccurrences('g1')[2];openCalendarSession(slot.date,slot.index);});
 assert.equal(await page.locator('#editSessionMeta').textContent(),'Séance 3 sur 4');
 await page.selectOption('#sessionObjectiveSelect','__custom__');await page.waitForTimeout(100);await page.fill('#sessionObjectiveCustom','Modifiée depuis calendrier');await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(200);await page.click('#sessionEditor .back');
 await page.reload();await page.waitForTimeout(150);
 const after=await snapshot();assert.equal(after.g1[2].objective,'Modifiée depuis calendrier');assert.equal(after.g2[2].objective,'Objectif séance 3');assert.equal(after.g1[5].date,before.g1[5].date);assert.equal(after.g1[4].title,'À planifier');
 await page.evaluate(()=>{activeSequence=JSON.parse(JSON.stringify(getSavedSequence('g1','ultimate-g1')));renderSequenceEditor();go('sequenceEditor');});
 assert.equal(await page.locator('.seqLessonObjective').nth(2).textContent(),'Modifiée depuis calendrier');
 const regression=await page.evaluate(async()=>{
  const source=JSON.parse(JSON.stringify(getSavedSequence('g1','ultimate-g1')));
  await henriBankStoreSequence(source,'Test de réutilisation');
  const bankBefore=JSON.stringify((await henriBankGet(source.bankId)).sequence);
  henriBankUseContext='annual';selectedAnnualGroupId='g1';selectedAnnualBlockId='ultimate-g1';
  await henriBankUse(source.bankId);
  const independent=activeSequence.id!==source.id&&activeSequence.sessions[0].id!==source.sessions[0].id;
  const unchanged=JSON.stringify((await henriBankGet(source.bankId)).sequence)===bankBefore;
  await henriBankPut({id:'test-pdf',type:'pdf',title:'PDF original',pdf:new Blob(['%PDF-1.4\n%%EOF'],{type:'application/pdf'})});
  const pdf=await henriBankGet('test-pdf');
  const students=Array.from({length:6},(_,i)=>({id:'student-'+i,name:'Élève '+i,gender:'U',skill:3,compatible:[],incompatible:[]}));
  const teams=buildTeamsTrial(students,2,teamBuilderSettings,new Set());
  go('settings');renderImportLinksReview();
  henriEvalOpenBank();henriEvalNew(true);
  document.querySelector('.heGroup[value="g1"]').checked=true;henriEvalGroupChanged();
  document.getElementById('heSport').value='Ultimate';henriEvalSportChanged();
  document.getElementById('heTitle').value='Grille Ultimate';henriEvalSave();
  const evaluations=Object.values(JSON.parse(localStorage.getItem('previewHenriSlate:evaluations:v1')));
  const slot=getGroupCourseOccurrences('g1')[2];openCourseEntry(slot.date,slot.index);
  return {independent,unchanged,courses:annualPlans.g1[0].courses,pdfType:pdf.pdf.type,pdfText:await pdf.pdf.text(),teamSizes:teams.map(t=>t.length),studentCount:new Set(teams.flat().map(s=>s.id)).size,evaluation:evaluations[0].title,criteria:evaluations[0].criteria.length};
 });
 assert.equal(regression.independent,true);assert.equal(regression.unchanged,true);assert.equal(regression.courses,5);
 assert.equal(regression.pdfType,'application/pdf');assert.equal(regression.pdfText,'%PDF-1.4\n%%EOF');assert.deepEqual(regression.teamSizes,[3,3]);assert.equal(regression.studentCount,6);assert.equal(regression.evaluation,'Grille Ultimate');assert.equal(regression.criteria,3);
 assert.deepEqual(errors,[]);console.log('PASS Chromium: imported schedule, two groups, four sessions, explicit multi-group save, reload, calendar edit, KEEP, independent copies; bank reuse, PDF blob preservation, teams, evaluation creation.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
