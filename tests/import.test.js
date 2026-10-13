const {test}=require('node:test');
const assert=require('node:assert/strict');
const H=require('../henri-import');
const groups=[{id:'g2',name:'Secondaire 2 · Groupe 02',students:[]},{id:'g3',name:'Groupe 3',students:[]}];
function schoolYear(){
  const calendar={};let cycle=1;
  for(let d=new Date(2026,7,31,12);d<=new Date(2027,5,23,12);d.setDate(d.getDate()+1)){
    if(d.getDay()===0||d.getDay()===6)continue;
    const key=H.validDate(d.getFullYear(),d.getMonth()+1,d.getDate());
    calendar[key]=key==='2026-12-25'?'Congé':'Jour '+cycle;
    if(calendar[key]!=='Congé')cycle=cycle%9+1;
  }return calendar;
}
test('group aliases link EDU codes; ambiguous identifiers are never guessed',()=>{
  assert.equal(H.matchGroup('EDU2G1-02',groups).id,'g2');
  assert.equal(H.matchGroup('Groupe 03',groups).id,'g3');
  assert.equal(H.matchGroup('Groupe 2',groups),null);
  assert.equal(H.matchGroup('EDU2G1-02',[...groups,{...groups[0],id:'duplicate'}]),null);
});
test('Mozaïk roster headers are excluded and complete course codes take priority',()=>{
  const students=Array.from({length:20},(_,i)=>'Nom'+String.fromCharCode(97+i)+', Prénom'+String.fromCharCode(97+i));
  const text=['Education physique','EDU4G2-02','Enseignant Exemple','Page 1 de 1',...students,'mozaikportail.ca'].join('\n');
  assert.deepEqual(H.rosterLines(text),students);
  const candidates=[{id:'a',name:'Secondaire 4 · Groupe 02',sourceCodes:['EDU4G1-02']},{id:'b',name:'Secondaire 4 · Groupe 02',sourceCodes:['EDU4G2-02']}];
  assert.equal(H.matchGroup('EDU4G2-02',candidates).id,'b');
  assert.equal(H.matchGroup('Secondaire 4 Groupe 02',candidates),null);
});
test('relinking works after importing the timetable before the groups',()=>{
  const teacher=H.scheduleText('Jour 1\nPériode 1 EDU2G1-02\nPériode 3 EDU2G1-02\nJour 2\n9 h 35 Groupe 3');
  assert.equal(teacher['Jour 1'].length,2);
  assert.equal(H.relink(teacher,[])['Jour 1'][0].matchedGroupId,null);
  const linked=H.relink(teacher,groups);
  assert.equal(linked['Jour 1'][1].matchedGroupId,'g2');
  assert.equal(linked['Jour 2'][0].time,'9 h 35');
});
test('explicit calendar labels stay with their date; invalid dates and conflicting photos are rejected',()=>{
  assert.deepEqual(H.calendarText('2026-11-23 Jour 1 2026-11-24 Jour 2\n25 décembre 2026 Congé'),{'2026-11-23':'Jour 1','2026-11-24':'Jour 2','2026-12-25':'Congé'});
  assert.deepEqual(H.calendarText('2026-02-30 Jour 1\n2026-11-23\nJour 2'),{});
  assert.throws(()=>H.calendarText('2026-11-23 Jour 1\n2026-11-23 Jour 2'));
  assert.equal(H.label('Jour 10'),'Jour 10');
});
test('annual readiness rejects sparse calendars, missing weekdays, unlinked groups and duplicate periods',()=>{
  const teacher=H.relink(H.scheduleText('Jour 1 Période 1 EDU2G1-02\n'+Array.from({length:8},(_,i)=>'Jour '+(i+2)+' Aucun cours').join('\n')),groups),calendar=schoolYear();
  assert.equal(H.review(teacher,calendar,groups).ready,true);
  assert.equal(H.review(teacher,{'2026-11-23':'Jour 1'},groups).ready,false);
  const missing={...calendar};delete missing['2026-11-23'];
  assert.equal(H.review(teacher,missing,groups).ready,false);
  assert.equal(H.review(H.scheduleText('Jour 1 Période 1 EDU2G1-02'),calendar,groups).ready,false);
  assert.equal(H.review({'Jour 1':[...teacher['Jour 1'],...teacher['Jour 1']]},calendar,groups).ready,false);
});
test('photo grid supports days in rows and columns without inventing periods',()=>{
  const w=(text,x,y)=>({text,confidence:95,bbox:{x0:x,y0:y,x1:x+30,y1:y+15}});
  const rows=[w('Jour 1',10,100),w('Jour 2',10,200),w('P1',100,10),w('P3',300,10),w('EDU2G1-02',100,100),w('EDU2G1-02',300,200)];
  assert.equal(H.scheduleGrid(rows)['Jour 2'][0].time,'Période 3');
  const columns=rows.map(word=>({...word,bbox:{x0:word.bbox.y0,y0:word.bbox.x0,x1:word.bbox.y1,y1:word.bbox.x1}}));
  assert.equal(H.scheduleGrid(columns)['Jour 1'][0].time,'Période 1');
  assert.deepEqual(H.scheduleGrid(rows.filter(w=>!/^P/.test(w.text))),{});
});
test('nine-day schedule reads four teaching periods, cognitive blocks and lunch independently',()=>{
  const word=(text,x,y)=>({text,confidence:95,bbox:{x0:x-30,y0:y-10,x1:x+30,y1:y+10}});
  const xs=[200,420,640,860,1080,1300];
  const headers=['Période 1','Période 2','Int. cognitive','Période du dîner','Période 3','Période 4'];
  const hours=['8h10 à 9h20','9h35 à 10h45','10h55 à 11h15','11h15 à 12h35','12h35 à 13h45','14h00 à 15h10'];
  const rows=[
    ['EDU4G2-02','EDU4G2-01','EDU4G2-01',null,'EDU3G2-02',null],
    ['EDU3G2-03','EDU2G2-05','EDU2G2-05',null,'EDU2G2-01',null],
    [null,'EDU4G2-04','EDU4G2-04',null,null,null],
    [null,'EDU3G2-05','EDU3G2-05',null,'EDU3G2-04',null],
    ['EDU2G2-03','EDU2G2-02','EDU2G2-02',null,'EDU4G2-02','EDU4G2-01'],
    ['EDU3G2-02',null,null,null,'EDU3G2-03','EDU2G2-05'],
    ['EDU2G2-01',null,null,null,null,'EDU4G2-04'],
    [null,null,null,null,null,'EDU3G2-05'],
    ['EDU3G2-04',null,null,null,'EDU2G2-03','EDU2G2-02']
  ];
  const words=headers.flatMap((text,i)=>[word(text,xs[i],100),word(hours[i],xs[i],140)]);
  rows.forEach((row,i)=>{words.push(word('Jour '+(i+1),40,240+i*130));row.forEach((code,j)=>{if(code)words.push(word(code,xs[j],220+i*130));});});
  const schedule=H.scheduleGrid(words),entries=Object.values(schedule).flat();
  assert.equal(Object.keys(schedule).length,9);
  assert.equal(entries.filter(e=>e.kind==='course').length,22);
  assert.equal(entries.filter(e=>e.kind==='cognitive').length,5);
  assert.equal(entries.some(e=>e.kind==='lunch'),false);
  assert.equal(schedule['Jour 1'][0].groupCode,'EDU4G2-02');
  assert.equal(schedule['Jour 1'][0].time,'8 h 10');
  assert.equal(schedule['Jour 1'][0].durationMinutes,70);
  assert.equal(schedule['Jour 1'][2].time,'10 h 55');
  assert.equal(schedule['Jour 1'][2].durationMinutes,20);
  assert.equal(schedule['Jour 5'][3].groupCode,'EDU4G2-02');
  assert.equal(schedule['Jour 5'][3].time,'12 h 35');
  assert.equal(schedule['Jour 5'][4].period,4);
  assert.equal(schedule['Jour 5'][4].time,'14 h 00');
});
const referenceText='Centre de services scolaire des Découvreurs Secondaire Calendrier scolaire 2026-2027\n180 journées d’enseignement\nDébut des cours pour les élèves : 31 août 2026\nFin des cours pour les élèves : 23 juin 2027\n3 journées pédagogiques flottantes';
test('CSS reference preserves printed cycles, holidays and unknown x/y/z days',()=>{
  const calendar=H.decouvreursReference(referenceText);
  assert.equal(Object.values(calendar).filter(type=>/^Jour \d+$/.test(type)).length,180);
  assert.equal(calendar['2026-08-31'],'Jour 1');
  assert.equal(calendar['2026-11-23'],'Jour 1');
  assert.equal(calendar['2026-11-19'],'Pédagogique');
  assert.equal(calendar['2026-12-25'],'Congé');
  assert.equal(calendar['2027-03-05'],'Congé');
  assert.equal(calendar['2027-06-18'],'Jour 9');
  assert.equal(calendar['2027-06-21'],'Jour x');
  assert.equal(calendar['2027-06-22'],'Jour y');
  assert.equal(calendar['2027-06-23'],'Jour z');
  assert.equal(H.decouvreursReference(referenceText.replace('Découvreurs','Autre centre')),null);
  assert.equal(H.decouvreursReference(referenceText.replace('2026-2027','2027-2028')),null);
  assert.deepEqual(H.calendarText('2027-06-21 Jour x\n2027-06-22 Jour y'),{'2027-06-21':'Jour x','2027-06-22':'Jour y'});
});
test('four-by-three calendar separates date digits from small cycle digits',()=>{
  const calendar=H.decouvreursReference(referenceText),words=[];
  const months=['juillet','août','septembre','octobre','novembre','décembre','janvier','février','mars','avril','mai','juin'];
  const indices=[6,7,8,9,10,11,0,1,2,3,4,5];
  const w=(text,x,y,width,height)=>({text,confidence:95,bbox:{x0:x-width/2,x1:x+width/2,y0:y-height/2,y1:y+height/2}});
  months.forEach((month,i)=>{
    const x=150+(i%4)*300,y=100+Math.floor(i/4)*350,mi=indices[i],year=mi>=6?2026:2027;
    words.push(w(month,x-25,y,90,20),w(String(year),x+50,y,40,20));
    const first=new Date(year,mi,1).getDay();
    for(let day=1;H.validDate(year,mi+1,day);day++){
      const slot=first+day-1,dx=x-150+(slot%7+.5)*(300/7),dy=y+60+Math.floor(slot/7)*45;
      words.push(w(String(day),dx,dy,18,18));
      const type=calendar[H.validDate(year,mi+1,day)];
      if(type?.startsWith('Jour '))words.push(w(type.slice(5),dx+12,dy+14,8,8));
    }
  });
  const parsed=H.calendarNumberGrid(words,2026,2027);
  assert.equal(Object.keys(parsed).length,183);
  assert.equal(parsed['2026-11-23'],'Jour 1');
  assert.equal(parsed['2027-06-23'],'Jour z');
  assert.equal(parsed['2026-12-25'],undefined);
});
