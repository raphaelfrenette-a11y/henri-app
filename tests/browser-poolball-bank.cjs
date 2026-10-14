const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.HENRI_TEST_URL||'http://127.0.0.1:8765')+'/preview/refonte/');
 const result=await page.evaluate(async()=>{
  await henriBankInit();
  await henriBankTransaction('readwrite',s=>s.clear());
  const sequence={id:'s1',groupId:'g1',sport:'Musculation',sessions:[{id:'l1',title:'Force',blocks:[{id:'a',title:'Squats',duration:10}]}]};
  const duplicate=JSON.parse(JSON.stringify(sequence));duplicate.id='s2';duplicate.groupId='g2';duplicate.sessions[0].id='l2';duplicate.sessions[0].blocks[0].id='b';
  const variant=JSON.parse(JSON.stringify(sequence));variant.sessions[0].blocks[0].duration=20;
  for(const [id,seq] of [['legacy1',sequence],['legacy2',duplicate],['variant',variant]])await henriBankTransaction('readwrite',s=>s.put({id,type:'sequence',sequence:seq}));
  await henriBankTransaction('readwrite',s=>s.put({id:'pdf-original',type:'pdf',blob:new Blob(['pdf'])}));
  henriBankDedupPromise=null;
  const items=await henriBankAll();const a=await henriBankGet('legacy1'),b=await henriBankGet('legacy2');
  const db=await henriBankOpenDb();const archives=await new Promise(resolve=>{const r=db.transaction('dedupArchives').objectStore('dedupArchives').getAll();r.onsuccess=()=>resolve(r.result)});db.close();
  await Promise.all([henriBankStoreSequence(sequence),henriBankStoreSequence(duplicate)]);
  const concurrent=(await henriBankAll()).length;
  sequence.sessions[0].blocks[0].title='Nouvelle variante';await henriBankStoreSequence(sequence);
  const old=await henriBankGet(a.id);
  groupsData=[{id:'g1',name:'G1',students:[]},{id:'g2',name:'G2',students:[]}];savedSequences={};activeSequence=null;annualPlans={g1:[{id:'b1',sport:'Poolball',courses:1}],g2:[{id:'b2',sport:'Poolball',courses:1}]};
  await henriBankStoreAnnual('g1',annualPlans.g1);await henriBankStoreAnnual('g2',annualPlans.g2);
  const annual=(await henriBankAll()).filter(x=>x.type==='annual').length;
  individualSessions=[];scheduleEntries={};schoolDays={};
  for(const [date,g] of [['2026-10-28','g1'],['2026-10-29','g2']]){schoolDays[date]='Jour 1';scheduleEntries[date]=[{group:g.toUpperCase(),matchedGroupId:g,time:'9 h 35',period:1,kind:'course'}]}
  individualSessions.push({id:'pool-one',groupId:'g1',date:'2026-10-28',courseKey:courseOccurrenceKey('2026-10-28',scheduleEntries['2026-10-28'][0]),sport:'Poolball',title:'Séance individuelle',blocks:[],independent:false});
  rebuildPlanningAssignments();goHome();shownYear=2026;shownMonth=9;renderMonth();setCalendarView('month');
  return {count:items.length,same:a.id===b.id,archives:archives.filter(x=>['legacy1','legacy2','variant'].includes(x.originalId)).length,concurrent,oldTitle:old.sequence.sessions[0].blocks[0].title,annual,labels:[...document.querySelectorAll('.monthCourseButton')].map(x=>x.innerText),evaluation:henriCourseIsEvaluation({annualPlan:'Poolball',courseIndex:1,courseTotal:1})};
 });
 assert.equal(result.count,3);assert.equal(result.same,true);assert.equal(result.archives,3);assert.equal(result.concurrent,3);assert.equal(result.oldTitle,'Squats');assert.equal(result.annual,1);assert.equal(result.labels.length,2);for(const label of result.labels){assert.match(label,/Poolball 1/);assert.doesNotMatch(label,/Cours 1\/|Séance individuelle|Évaluation/)}assert.equal(result.evaluation,false);
 assert.deepEqual(errors,[]);console.log('PASS: content deduplication, migration archives, legacy aliases, concurrency, distinct variants, annual reuse, PDF preservation and Poolball calendar labels.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
