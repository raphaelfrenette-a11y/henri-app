const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function app(){
  const store=new Map();
  const c={console:{...console,error(){}},structuredClone,crypto:require('node:crypto').webcrypto,window:{addEventListener(){}},document:{getElementById(){return null;}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},groupsData:[{id:'g1',name:'G1'}],annualPlans:{g1:[{id:'u',sport:'Ultimate',courses:5},{id:'b',sport:'Badminton',courses:3}]},savedSequences:{},activeSequence:null,individualSessions:[],scheduleEntries:{},ensureAnnualPlan(){},rebuildCalendarEvents(){},renderMonth(){},renderWeek(){},individualForOccurrence(){return null;},getSavedSequence(g,b){return c.savedSequences[g+'::'+b]||null;},sequenceStorageKey:(g,b)=>g+'::'+b};
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
