const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function app(){
  const store=new Map();
  const c={HenriImport:{isCognitive:()=>false},console:{...console,error(){}},structuredClone,crypto:require('node:crypto').webcrypto,window:{addEventListener(){}},document:{getElementById(){return null;}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},groupsData:[{id:'g1',name:'G1'}],annualPlans:{g1:[{id:'u',sport:'Ultimate',courses:5},{id:'b',sport:'Badminton',courses:3}]},savedSequences:{},activeSequence:null,individualSessions:[],scheduleEntries:{},ensureAnnualPlan(){},rebuildCalendarEvents(){},renderMonth(){},renderWeek(){},individualForOccurrence(){return null;},getSavedSequence(g,b){return c.savedSequences[g+'::'+b]||null;},sequenceStorageKey:(g,b)=>g+'::'+b};
  for(let i=0;i<8;i++)c.scheduleEntries['2026-10-'+String(19+i).padStart(2,'0')]=[{time:'8:00',groupId:'g1'}];
  const occurrences=g=>Object.entries(c.scheduleEntries).flatMap(([date,entries])=>entries.filter(e=>e.groupId===g).map(entry=>({date,key:date+'|'+g,entry})));
  vm.createContext(c);
  for(const file of ['henri-planning.js','henri-calendar-links.js'])vm.runInContext(fs.readFileSync('preview/refonte/'+file,'utf8'),c);
  c.getGroupCourseOccurrences=occurrences;
  c.savedSequences['g1::u']={id:'seq',groupId:'g1',annualBlockId:'u',sport:'Ultimate',sessions:Array.from({length:4},(_,i)=>({title:'Séance '+(i+1),blocks:[]}))};
  return c;
}
test('KEEP: four sessions occupy first four of five slots; following block stays fixed',()=>{
  const c=app();c.rebuildCalendarPlanning();const slots=c.getGroupCourseOccurrences('g1');
  assert.equal(c.annualPlans.g1[0].courses,5);
  assert.deepEqual(slots.slice(0,4).map(s=>s.entry.sessionIndex),[0,1,2,3]);
  assert.equal(slots[4].entry.planData,null);assert.equal(slots[4].entry.session,'À planifier');assert.equal(slots[4].entry.sequenceId,null);
  assert.equal(slots[5].entry.annualBlockId,'b');
});
test('editing sequence never resizes annual block',()=>{
  const c=app();c.activeSequence=structuredClone(c.savedSequences['g1::u']);c.activeSequence.sessions[2].title='Modifiée';c.henriSyncSequenceToAnnual();
  assert.equal(c.annualPlans.g1[0].courses,5);assert.equal(c.savedSequences['g1::u'].sessions[2].title,'Modifiée');
});
test('annual sequence occurrences stop at block capacity',()=>{
  const c=app();const s=c.savedSequences['g1::u'];s.sessions.push({},{},{});assert.equal(c.getSequenceOccurrences(s).length,5);
});
test('multi-group validation rejects overflow without committing any group',async()=>{
  const c=app();c.activeSequence=structuredClone(c.savedSequences['g1::u']);c.groupsData.push({id:'g2',name:'G2'});c.annualPlans.g2=[{id:'u2',sport:'Ultimate',courses:3}];
  c.confirm=()=>true;c.henriPersistSharedState=()=>{throw Error('should not commit')};
  assert.equal(await c.henriSaveSequenceForGroups(['g1','g2']),false);assert.equal(c.savedSequences['g2::u2'],undefined);assert.equal(c.annualPlans.g1[0].courses,5);
});
test('multi-group saves use independent session IDs and content',async()=>{
  const c=app();c.activeSequence=structuredClone(c.savedSequences['g1::u']);c.groupsData.push({id:'g2',name:'G2'});c.annualPlans.g2=[{id:'u2',sport:'Ultimate',courses:5}];
  for(let i=0;i<5;i++)c.scheduleEntries['2026-11-'+String(1+i).padStart(2,'0')]=[{groupId:'g2',time:'9:00'}];
  c.confirm=()=>true;c.henriBankStoreSequence=async()=>{};c.henriPersistSharedState=()=>{};c.rebuildPlanningAssignments=c.rebuildCalendarPlanning;c.renderSequenceEditor=()=>{};
  assert.equal(await c.henriSaveSequenceForGroups(['g1','g2']),true);
  const a=c.savedSequences['g1::u'],b=c.savedSequences['g2::u2'];assert.notEqual(a.id,b.id);assert.notEqual(a.sessions[2].id,b.sessions[2].id);
  b.sessions[2].title='G2 seulement';assert.equal(a.sessions[2].title,'Séance 3');assert.equal(c.annualPlans.g1[0].courses,5);
});
test('failed persistence restores canonical memory',async()=>{
  const c=app();c.activeSequence=structuredClone(c.savedSequences['g1::u']);c.activeSequence.sessions[2].title='Draft';c.confirm=()=>true;c.henriBankStoreSequence=async()=>{};c.henriPersistSharedState=()=>{throw Error('QuotaExceededError')};
  assert.equal(await c.henriSaveSequenceForGroups(['g1']),false);assert.equal(c.savedSequences['g1::u'].sessions[2].title,'Séance 3');assert.equal(c.activeSequence.sessions[2].title,'Draft');
});
test('session ID migration preserves originals and reuses IDs for active saved copy',()=>{
  const c=app();c.activeSequence=structuredClone(c.savedSequences['g1::u']);c.henriPersistSharedState=()=>{};c.henriEnsureSessionIds();
  const backup=JSON.parse(c.localStorage.getItem('previewHenriSlate:backupBeforeSessionIds:v1'));
  assert.equal(backup.savedSequences['g1::u'].sessions[0].id,undefined);
  assert.equal(c.activeSequence.sessions[0].id,c.savedSequences['g1::u'].sessions[0].id);
  const id=c.activeSequence.sessions[0].id;c.henriEnsureSessionIds();assert.equal(c.activeSequence.sessions[0].id,id);
});
test('explicit jumps remain inside their annual block',()=>{
  const c=app();c.localStorage.setItem('previewHenriSlate:sequenceJumps:v1',JSON.stringify({'g1|2026-10-20|g1':{blockId:'u',sessionIndex:3}}));c.rebuildCalendarPlanning();
  const slots=c.getGroupCourseOccurrences('g1');assert.equal(slots[1].entry.sessionIndex,3);assert.equal(slots[5].entry.annualBlockId,'b');assert.equal(slots[2].entry.planData,null);
});
test('new draft does not replace previously saved sequence implicitly',()=>{
  const c=app();c.activeSequence=structuredClone(c.savedSequences['g1::u']);c.activeSequence.id='new-draft';c.activeSequence.sessions[0].title='Draft';c.henriSyncSequenceToAnnual();assert.equal(c.savedSequences['g1::u'].sessions[0].title,'Séance 1');
});
test('annual course ordinal exists even without a saved session',()=>{
 const c=app();c.rebuildCalendarPlanning();const slots=c.getGroupCourseOccurrences('g1');
 assert.equal(slots[4].entry.courseIndex,4);assert.equal(slots[4].entry.courseTotal,5);assert.equal(slots[4].entry.sessionIndex,null);
 assert.equal(slots[7].entry.courseIndex,2);assert.equal(slots[7].entry.courseTotal,3);assert.equal(slots[7].entry.planData,null);
});
test('standalone lesson occupies its numbered annual period without shifting the next sport',()=>{
 const c=app();c.individualSessions.push({id:'individual',groupId:'g1',courseKey:'2026-10-23|g1',sport:'Ultimate',title:'Séance seule',blocks:[]});c.rebuildCalendarPlanning();
 const slots=c.getGroupCourseOccurrences('g1');assert.equal(slots[4].entry.individualId,'individual');assert.equal(slots[4].entry.courseIndex,4);assert.equal(slots[4].entry.courseTotal,5);assert.equal(slots[5].entry.annualBlockId,'b');
});
test('annual multi-group application preserves four-course blocks with spare periods',async()=>{
 const c=app();c.annualPlans.g1=[{id:'u',sport:'Ultimate',comp:'C2',courses:4},{id:'f',sport:'Conditionnement physique',comp:'C3',courses:4}];c.groupsData.push({id:'g2',name:'G2'});
 for(let i=0;i<10;i++)c.scheduleEntries['2026-11-'+String(1+i).padStart(2,'0')]=[{groupId:'g2',time:'9:00'}];
 c.annualGroup={value:'g1'};c.annualTargetIds=()=>['g1','g2'];c.henriPersistSharedState=()=>{};c.getGroupCourseSlots=id=>c.getGroupAnnualOccurrences(id).length;c.rebuildPlanningAssignments=c.rebuildCalendarPlanning;c.go=()=>{};c.setCalendarView=()=>{};
 await c.saveAnnualAndPlanSequences();assert.deepEqual(Array.from(c.annualPlans.g2,b=>b.courses),[4,4]);assert.notEqual(c.annualPlans.g2[0].id,'u');
 const slots=c.getGroupCourseOccurrences('g2');assert.equal(slots[3].entry.courseTotal,4);assert.equal(slots[4].entry.annualPlan,'Conditionnement physique');assert.equal(slots[7].entry.courseTotal,4);assert.equal(slots[8].entry.annualBlockId,null);assert.equal(slots[9].entry.annualBlockId,null);
});
test('standalone lesson on a spare period reduces capacity without expanding annual blocks',()=>{
 const c=app();c.annualPlans.g1=[{id:'u',sport:'Ultimate',courses:4}];c.individualSessions.push({id:'free',groupId:'g1',courseKey:'2026-10-23|g1',independent:true,sport:'Jeux',title:'Séance seule',blocks:[]});c.rebuildCalendarPlanning();
 assert.equal(c.getGroupAnnualOccurrences('g1').length,7);const slots=c.getGroupCourseOccurrences('g1');assert.equal(slots[4].entry.individualId,'free');assert.equal(slots[4].entry.annualBlockId,null);assert.equal(slots[3].entry.courseTotal,4);assert.equal(slots[5].entry.annualBlockId,null);
});
test('an old oversized sequence never adds a fifth calendar course to an annual block of four',()=>{
 const c=app();c.annualPlans.g1=[{id:'u',sport:'Ultimate',courses:4}];c.savedSequences['g1::u'].sessions.push({id:'extra',title:'Ancienne séance 5',blocks:[]});c.rebuildCalendarPlanning();
 const slots=c.getGroupCourseOccurrences('g1');assert.equal(slots.filter(s=>s.entry.annualBlockId==='u').length,4);assert.equal(slots[3].entry.courseTotal,4);assert.equal(slots[4].entry.annualBlockId,null);c.getEntryGroupId=e=>e.groupId;assert.equal(c.henriCourseIsEvaluation(slots[3].entry),true);assert.equal(c.henriCourseIsEvaluation(slots[4].entry),false);
});
test('different standalone sport does not consume lesson 1 of the following annual block',()=>{
 const c=app();c.annualPlans.g1=[{id:'u',sport:'Ultimate',courses:4},{id:'b',sport:'Badminton',courses:3}];
 c.savedSequences['g1::b']={id:'badminton',groupId:'g1',annualBlockId:'b',sport:'Badminton',sessions:[{id:'bad-1'},{id:'bad-2'},{id:'bad-3'}]};
 c.individualSessions.push({id:'pool',groupId:'g1',courseKey:'2026-10-23|g1',annualBlockId:'b',independent:false,sport:'Poolball',title:'Poolball',blocks:[]});
 c.rebuildCalendarPlanning();const slots=c.getGroupCourseOccurrences('g1');
 assert.equal(slots[4].entry.annualPlan,'Poolball');assert.equal(slots[4].entry.annualBlockId,null);
 assert.deepEqual(slots.slice(5).map(s=>s.entry.courseIndex),[0,1,2]);assert.equal(slots[5].entry.sessionId,'bad-1');
 assert.equal(c.getSequenceOccurrences(c.savedSequences['g1::b'])[0].key,slots[5].key);
 c.rebuildCalendarPlanning();assert.equal(slots[5].entry.courseIndex,0);assert.equal(c.annualPlans.g1[1].courses,3);
});
test('matching standalone sport still counts once, with spelling normalization',()=>{
 const c=app();c.annualPlans.g1=[{id:'b',sport:' BADMINTON ',courses:3}];
 c.individualSessions.push({id:'first',groupId:'g1',courseKey:'2026-10-19|g1',sport:'Badminton',title:'Première séance',blocks:[]});
 c.rebuildCalendarPlanning();const slots=c.getGroupCourseOccurrences('g1');assert.equal(slots[0].entry.courseIndex,0);assert.equal(slots[1].entry.courseIndex,1);assert.equal(slots[2].entry.courseIndex,2);assert.equal(slots[3].entry.annualBlockId,null);
});
