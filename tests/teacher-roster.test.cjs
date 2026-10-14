const {test}=require('node:test');const assert=require('node:assert/strict');const api=require('../preview/refonte/henri-import.js');
function storage(seed={}){const values=new Map(Object.entries(seed));return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value)};}
const key='previewHenriSlate:henriGroupsData',importKey='previewHenriSlate:henriImportedGroups';
test('exact teacher name is removed with accents, reversed order and split fields; other Raphaëls stay',()=>{
 const groups=[{id:'g',sourceCodes:['EDU3G2-05'],students:[{id:'teacher',name:'Raphaël Frenette'},{id:'t2',name:'FRENETTE, RAPHAEL'},{id:'t3',firstName:'Raphael',lastName:'Frenette'},{id:'student',name:'Raphaël Dubois',compatible:['teacher'],incompatible:['t2']},{id:'other',name:'Frenette Marie'}]}];
 const result=api.cleanTeacherRosters(groups);assert.equal(result.count,3);assert.deepEqual(result.groups[0].students.map(s=>s.name),['Raphaël Dubois','Frenette Marie']);assert.deepEqual(result.groups[0].students[0].compatible,[]);assert.deepEqual(result.groups[0].sourceCodes,['EDU3G2-05']);assert.equal(groups[0].students.length,5);
});
test('stored and imported lists plus saved course teams are cleaned with backup and idempotence',()=>{
 const groups=[{id:'g',students:[{id:'t',name:'Raphaël Frenette'},{id:'s',name:'Élève test'}]}];const original=JSON.stringify(groups);
 const db=storage({[key]:original,[importKey]:original,'previewHenriSlate:courseTeams:v1':JSON.stringify({'g|2026-10-21|P1':{teams:[['t','s']],absent:['t']},'other|2026-10-21|P1':{teams:[['t']],absent:[]}})});
 api.removeTeacherFromStoredRosters(db);assert.equal(JSON.parse(db.getItem(key))[0].students.length,1);assert.equal(JSON.parse(db.getItem(importKey))[0].students.length,1);const teams=JSON.parse(db.getItem('previewHenriSlate:courseTeams:v1'));assert.deepEqual(teams['g|2026-10-21|P1'].teams,[['s']]);assert.deepEqual(teams['g|2026-10-21|P1'].absent,[]);assert.deepEqual(teams['other|2026-10-21|P1'].teams,[['t']]);assert.equal(JSON.parse(db.getItem('previewHenriSlate:backupBeforeTeacherRosterRemoval:v1')).values[key],original);assert.equal(api.removeTeacherFromStoredRosters(db),0);
});
test('document body excludes teacher even when its header appears between students',()=>{
 assert.deepEqual(api.rosterLines('Dubois, Alice\nFrenette, Raphaël\nEnseignant : Raphaël Frenette\nMartin, Louis'),['Dubois, Alice','Martin, Louis']);
});
test('a failed write restores the original lists',()=>{
 const original=JSON.stringify([{id:'g',students:[{id:'t',name:'Raphaël Frenette'}]}]);const db=storage({[key]:original,[importKey]:original});const write=db.setItem;let failed=false;db.setItem=(k,v)=>{if(k===importKey&&!failed){failed=true;throw Error('QuotaExceededError')}write(k,v)};assert.throws(()=>api.removeTeacherFromStoredRosters(db),/Quota/);assert.equal(db.getItem(key),original);assert.equal(db.getItem(importKey),original);
});
