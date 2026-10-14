const test=require('node:test');
const assert=require('node:assert/strict');
const pedagogy=require('../henri-pedagogy.js');

test('secondary profile keeps C1 capped and C2 dominant without inventing official quotas',()=>{
  for(let total=1;total<=100;total++){
    const counts=pedagogy.counts(total,{type:'secondary'},{});
    assert.equal(counts.C1+counts.C2+counts.C3,total);
    assert.ok(counts.C1<=1);
    assert.ok(counts.C2>counts.C3);
    if(total>=3)assert.ok(counts.C3>=1);
  }
});
test('annual distributions use every period exactly once even with uneven group capacities',()=>{
  for(const total of [1,7,23,37,40,83,213])for(const count of [1,3,10,total].filter(n=>n<=total)){
    const values=pedagogy.distribution(total,count);
    assert.equal(values.length,count);
    assert.equal(values.reduce((a,b)=>a+b,0),total);
    assert.ok(values.every(n=>Number.isInteger(n)&&n>=1));
  }
  assert.throws(()=>pedagogy.distribution(2,3));
});
test('manual templates are empty; every supported sport has concrete editable Henri activities',()=>{
  for(const sport of pedagogy.sports)for(const comp of ['C1','C2','C3']){
    const blank=pedagogy.session({sport,comp,index:0,count:5,duration:'70 min',useHenri:false});
    assert.equal(blank.objective,'');
    assert.deepEqual(blank.blocks.map(b=>b.type),['Échauffement','Éducatif 1','Éducatif 2','Situation de partie']);
    assert.ok(blank.blocks.every(b=>b.title===''&&b.notes===''));
    const plan=pedagogy.session({sport,comp,index:4,count:5,duration:'75 min',useHenri:true,level:{type:'secondary'}});
    assert.ok(plan.blocks.every(b=>b.title.length>5&&b.notes.length>50));
    assert.equal(plan.blocks.reduce((n,b)=>n+b.minutes,0),75);
    assert.ok(plan.objective.length>10);
    // Each call produces independent objects; editing a teacher's copy cannot alter templates.
    plan.blocks[0].notes='Modification';
    const next=pedagogy.session({sport,comp,index:0,count:5,duration:'70 min',useHenri:true});
    assert.notEqual(next.blocks[0].notes,'Modification');
  }
});
