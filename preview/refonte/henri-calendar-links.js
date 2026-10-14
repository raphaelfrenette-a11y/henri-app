let calendarCourseContext=null;
let calendarPlanEditing=false;
let calendarIndividualEditing=null;
let quickPrefillCourseKey=null;

function mergeImportedGroups(incoming,existing){
  const result=[];
  for(const group of incoming){
    const candidates=[...new Map([...existing,...result].map(g=>[g.id,g])).values()];
    const previous=HenriImport.matchGroup(group.sourceCodes?.[0]||group.name,candidates);
    const target=result.find(g=>g.id===previous?.id);
    const students=group.students.map(student=>{
      const old=previous?.students.find(s=>normalizeGroupAlias(s.name)===normalizeGroupAlias(student.name));
      return old?{...old,name:student.name}:student;
    });
    if(target){
      target.students=[...target.students,...students.filter(s=>!target.students.some(old=>normalizeGroupAlias(old.name)===normalizeGroupAlias(s.name)))];
      target.aliases=[...new Set([...(target.aliases||[]),...(group.aliases||[])])];
      target.sourceFiles=[...new Set([...(target.sourceFiles||[target.sourceFile]),group.sourceFile])];
    }else result.push({...group,id:previous?.id||group.id,students,sourceFiles:[group.sourceFile]});
  }
  return [...result,...existing.filter(g=>!result.some(x=>x.id===g.id))];
}
function refreshImportedLinks(){
  if(!importedSetupData.teacherSchedule)return;
  importedSetupData.teacherSchedule=HenriImport.relink(importedSetupData.teacherSchedule,importedSetupData.groupSheets||[]);
  localStorage.setItem('previewHenriSlate:henriImportedTeacherSchedule',JSON.stringify(importedSetupData.teacherSchedule));
}
function renderImportLinksReview(){
  const container=document.getElementById('importLinksReview');
  if(!container)return;
  const teacher=importedSetupData.teacherSchedule,calendar=importedSetupData.schoolCalendar,groups=importedSetupData.groupSheets;
  container.hidden=!teacher&&!calendar&&!groups;
  const report=HenriImport.review(teacher,calendar,groups);
  generateScheduleBtn.disabled=!(teacher&&calendar&&groups?.length&&Object.values(setupFiles).every(Boolean));
  container.replaceChildren();
  const title=document.createElement('strong');title.textContent='Liens entre tes documents';container.append(title);
  const summary=document.createElement('p');
  summary.textContent=report.dates.length?'Du '+report.dates[0]+' au '+report.dates.at(-1)+' · '+report.cycleDates.length+' jours de classe · '+report.lessons.filter(l=>l.matchedGroupId).length+'/'+report.lessons.length+' créneaux associés aux listes d’élèves.':'Importe le calendrier, ton horaire et tes listes de groupes, dans l’ordre de ton choix.';
  container.append(summary);
  for(const message of [...report.errors,...report.warnings]){const p=document.createElement('p');p.textContent=message;container.append(p);}
  if(report.ready){const p=document.createElement('p');p.textContent='Les documents sont reliés. Vérifie les cours ci-dessous, puis génère ton année.';container.append(p);}
  for(const [day,lessons] of Object.entries(teacher||{})){
    const details=document.createElement('details'),heading=document.createElement('summary');
    heading.textContent=day+' · '+lessons.filter(isPlanningEntry).length+' cours d’éducation physique'+(lessons.some(HenriImport.isCognitive)?' · intégration cognitive':'');details.append(heading);
    lessons.forEach((lesson,index)=>{
      const row=document.createElement('div');row.className='planField';row.style.padding='8px';
      const label=document.createElement('label');label.textContent=(lesson.groupCode||lesson.group)+' · '+(lesson.time||'Période à préciser')+(lesson.kind==='cognitive'?' · Intervention cognitive':'');row.append(label);
      const select=document.createElement('select');select.className='planControl';select.setAttribute('aria-label',day+' cours '+(index+1)+' : groupe');
      select.add(new Option('Choisir le groupe',''));
      for(const g of groups||[])select.add(new Option(g.name+' · '+g.students.length+' élèves',g.id));
      select.value=lesson.matchedGroupId||'';
      select.onchange=()=>{lesson.matchedGroupId=select.value||null;const group=groups.find(g=>g.id===select.value);if(group)lesson.group=group.name;localStorage.setItem('previewHenriSlate:henriImportedTeacherSchedule',JSON.stringify(teacher));renderImportLinksReview();};
      row.append(select);
      const time=document.createElement('input');time.className='planControl';time.value=lesson.time;time.placeholder='8 h 10 ou Période 1';time.setAttribute('aria-label',day+' cours '+(index+1)+' : heure ou période');
      time.onchange=()=>{if(!/^(?:\d{1,2}\s*h\s*\d{2}|\d{1,2}:\d{2}|Période\s*\d{1,2})$/i.test(time.value)||scheduleTimeMinutes(time.value)>=1440){alert('Indique une heure comme 8 h 10 ou une période comme Période 1.');return}lesson.time=time.value;const period=time.value.match(/Période\s*(\d+)/i);lesson.period=period?Number(period[1]):null;localStorage.setItem('previewHenriSlate:henriImportedTeacherSchedule',JSON.stringify(teacher));renderImportLinksReview();};
      row.append(time);details.append(row);
      const kind=document.createElement('select');kind.className='planControl';kind.setAttribute('aria-label',day+' créneau '+(index+1)+' : type');
      kind.add(new Option('Cours d’éducation physique','course'));kind.add(new Option('Intégration cognitive · devoirs (20 min)','cognitive'));
      kind.value=HenriImport.isCognitive(lesson)?'cognitive':'course';
      kind.onchange=()=>{lesson.kind=kind.value;lesson.activity=kind.value==='cognitive'?'Intégration cognitive':'Éducation physique';if(kind.value==='cognitive'){lesson.period=null;lesson.durationMinutes=20;}localStorage.setItem('previewHenriSlate:henriImportedTeacherSchedule',JSON.stringify(teacher));renderImportLinksReview();};
      row.append(kind);
    });container.append(details);
  }
  if(calendar){
    const details=document.createElement('details'),heading=document.createElement('summary');heading.textContent='Vérifier ou corriger les dates reconnues';details.append(heading);
    const hint=document.createElement('p');hint.textContent='Une date par ligne, par exemple : 2026-11-23 · Jour 1, 2026-12-25 · Congé. Complète les dates manquantes sans modifier les jours de tes documents.';details.append(hint);
    const input=document.createElement('textarea');input.rows=12;input.style.width='100%';input.setAttribute('aria-label','Dates du calendrier scolaire');input.value=report.dates.map(d=>d+' · '+calendar[d]).join('\n');details.append(input);
    const save=document.createElement('button');save.className='itemBtn';save.textContent='Appliquer les corrections';save.onclick=()=>{
      try{const parsed=HenriImport.calendarText(input.value);if(Object.keys(parsed).length!==input.value.split('\n').filter(s=>s.trim()).length)throw new Error('Chaque ligne doit indiquer une date valide et son jour-cycle, congé ou journée pédagogique.');importedSetupData.schoolCalendar=parsed;localStorage.setItem('previewHenriSlate:henriImportedSchoolCalendar',JSON.stringify(parsed));renderImportLinksReview();}catch(e){alert(e.message);}
    };details.append(save);container.append(details);
  }
}

function isPlanningEntry(entry){return !HenriImport.isCognitive(entry);}
function courseOccurrenceKey(date,entry){return date+'|'+(entry.period?'P'+entry.period:entry.time);}
function getGroupCourseOccurrences(groupId){
  return Object.keys(scheduleEntries).sort().flatMap(date=>getVisibleScheduleEntries(date).filter(entry=>isPlanningEntry(entry)&&getEntryGroupId(entry)===groupId).map(entry=>({date,key:courseOccurrenceKey(date,entry),entry,index:scheduleEntries[date].indexOf(entry)})));
}
function individualForOccurrence(groupId,slot){
  return individualSessions.find(x=>x.groupId===groupId&&(x.courseKey?x.courseKey===slot.key:x.date===slot.date&&getGroupCourseOccurrences(groupId).find(s=>s.date===slot.date)?.key===slot.key));
}
function datedSequences(groupId){return Object.values(savedSequences).filter(s=>s.groupId===groupId&&!s.annualBlockId&&s.startCourseKey);}
function getDatedSequenceOccurrences(sequence){
  const raw=Object.keys(scheduleEntries).sort().flatMap(date=>sortScheduleEntries(scheduleEntries[date]).filter(entry=>isPlanningEntry(entry)&&getEntryGroupId(entry)===sequence.groupId).map(entry=>({date,key:courseOccurrenceKey(date,entry),entry,index:scheduleEntries[date].indexOf(entry)})));
  const visible=new Set(getGroupCourseOccurrences(sequence.groupId).map(slot=>slot.key));
  const sequences=[...datedSequences(sequence.groupId).filter(s=>s.id!==sequence.id),sequence].sort((a,b)=>{
    return raw.findIndex(s=>s.key===a.startCourseKey)-raw.findIndex(s=>s.key===b.startCourseKey)||a.id.localeCompare(b.id);
  });
  const reserved=new Set();let result=[];
  for(const current of sequences){
    const start=raw.findIndex(s=>s.key===current.startCourseKey);
    const placed=start<0?[]:raw.slice(start).filter(s=>visible.has(s.key)&&!reserved.has(s.key)&&!individualForOccurrence(sequence.groupId,s)).slice(0,current.sessions.length);
    placed.forEach(s=>reserved.add(s.key));
    if(current.id===sequence.id)result=placed;
  }
  return result;
}
const henriSequenceJumpsKey='previewHenriSlate:sequenceJumps:v1';
function henriReadSequenceJumps(){
  try{return JSON.parse(localStorage.getItem(henriSequenceJumpsKey)||'{}');}
  catch(error){console.warn('Lecture des ajustements de séquence impossible',error);return {};}
}
function henriSequenceJumpId(groupId,slot){return String(groupId)+'|'+slot.key;}
function henriSaveSequenceJump(groupId,slot,target){
  const jumps=henriReadSequenceJumps();
  jumps[henriSequenceJumpId(groupId,slot)]=target;
  localStorage.setItem(henriSequenceJumpsKey,JSON.stringify(jumps));
  rebuildPlanningAssignments();
}
function getGroupAnnualOccurrences(groupId){
  const reserved=new Set(datedSequences(groupId).flatMap(getDatedSequenceOccurrences).map(s=>s.key));
  return getGroupCourseOccurrences(groupId).filter(s=>!individualForOccurrence(groupId,s)&&!reserved.has(s.key));
}
function getSequenceOccurrences(sequence){
  if(sequence?.startCourseKey)return getDatedSequenceOccurrences(sequence);
  if(!sequence?.annualBlockId)return [];
  const blocks=annualPlans[sequence.groupId]||[],index=blocks.findIndex(b=>b.id===sequence.annualBlockId);
  if(index<0)return [];
  const offset=blocks.slice(0,index).reduce((sum,b)=>sum+Math.max(0,Number(b.courses)||0),0);
  return getGroupAnnualOccurrences(sequence.groupId).slice(offset,offset+sequence.sessions.length);
}
function rebuildCalendarPlanning(){
  if(typeof groupsData==='undefined')return;
  for(const entry of Object.values(scheduleEntries).flat())Object.assign(entry,{annualPlan:null,sequence:null,session:null,annualBlockId:null,sequenceId:null,sessionIndex:null,individualId:null,planData:null,isIndividual:false});
  for(const group of groupsData){
    ensureAnnualPlan(group.id);
    for(const slot of getGroupCourseOccurrences(group.id)){
      const individual=individualForOccurrence(group.id,slot);
      if(individual)Object.assign(slot.entry,{annualPlan:individual.sport,sequence:'Séance individuelle',session:individual.title,isIndividual:true,individualId:individual.id,planData:{title:individual.title,objective:individual.objective,blocks:individual.blocks}});
    }
    for(const sequence of datedSequences(group.id))getDatedSequenceOccurrences(sequence).forEach((slot,index)=>Object.assign(slot.entry,{annualPlan:sequence.sport,sequence:sequence.sport,sequenceId:sequence.id,sessionIndex:index,session:'Séance '+(index+1)+'/'+sequence.sessions.length,planData:sequence.sessions[index]}));
    const queue=[];
    for(const block of annualPlans[group.id]){
      const saved=getSavedSequence(group.id,block.id);
      for(let index=0;index<Math.max(0,Number(block.courses)||0);index++)queue.push({annualPlan:block.sport,annualBlockId:block.id,sequenceId:saved?.id||null,sequence:saved?'Séquence planifiée':'Séquence à planifier',sessionIndex:index,session:'Séance '+(index+1)+'/'+block.courses,planData:saved?.sessions[index]||null});
    }
    const jumps=henriReadSequenceJumps();
    let queueIndex=0;
    getGroupAnnualOccurrences(group.id).forEach(slot=>{
      const jump=jumps[henriSequenceJumpId(group.id,slot)];
      if(jump){
        const target=queue.findIndex((item,i)=>i>=queueIndex&&item.annualBlockId===jump.blockId&&item.sessionIndex===jump.sessionIndex);
        if(target>=queueIndex)queueIndex=target;
      }
      if(queue[queueIndex])Object.assign(slot.entry,queue[queueIndex]);
      queueIndex++;
    });
  }
  localStorage.setItem('previewHenriSlate:henriScheduleEntries',JSON.stringify(scheduleEntries));
  rebuildCalendarEvents();renderMonth();renderWeek();
}
function renderSequenceDatePlacement(){
  const box=document.getElementById('sequenceDatePlacement'),select=document.getElementById('sequenceStartSlot');
  if(!box)return;box.hidden=!!activeSequence?.annualBlockId;
  if(box.hidden||!activeSequence)return;
  const previous=select.value;select.replaceChildren();
  for(const slot of getGroupCourseOccurrences(activeSequence.groupId))select.add(new Option(formatSequenceDate(slot.date)+' · '+slot.entry.time,slot.key));
  select.value=activeSequence.startCourseKey||previous||select.options[0]?.value||'';
}
function scheduleStandaloneSequence(){
  if(!activeSequence||activeSequence.annualBlockId)return;
  const key=document.getElementById('sequenceStartSlot').value;
  const candidate={...activeSequence,startCourseKey:key};
  const dates=getDatedSequenceOccurrences(candidate);
  if(!key||dates[0]?.key!==key||dates.length!==candidate.sessions.length){alert('Ce cours est occupé ou il ne reste pas assez de périodes pour placer toutes les séances. Choisis un autre cours.');return}
  const occupied=new Set(datedSequences(candidate.groupId).filter(s=>s.id!==candidate.id).flatMap(getDatedSequenceOccurrences).map(s=>s.key));
  if(dates.some(s=>occupied.has(s.key))){alert('Une autre séquence est déjà placée sur ces cours. Choisis une autre période.');return}
  activeSequence.startCourseKey=key;
  savedSequences['dated::'+activeSequence.id]=JSON.parse(JSON.stringify(activeSequence));
  henriPersistSharedState();rebuildPlanningAssignments();renderSequenceEditor();
  alert('Séquence placée dans le calendrier. Tu peux ouvrir chaque séance depuis son cours.');
}
function renderCoursePlanningActions(entry,date,index){
  const container=document.getElementById('coursePlanningActions');container.replaceChildren();
  const add=(text,fn)=>{const button=document.createElement('button');button.className='itemBtn';button.textContent=text;button.onclick=fn;container.append(button);};
  if(isPlanningEntry(entry)&&entry.planData)add('Ouvrir la séance',()=>openCalendarSession(date,index));
  else if(isPlanningEntry(entry))add('Préparer cette séance',()=>openQuickSessionForCourse(date,index));
  if(isPlanningEntry(entry)&&!entry.isIndividual)add('Remplacer cette période',()=>openQuickSessionForCourse(date,index));
  if(isPlanningEntry(entry)&&entry.annualBlockId)add('Changer de cours dans la séquence',()=>henriChooseSequenceCourse(date,index));
  if(isPlanningEntry(entry)&&(entry.annualBlockId||entry.sequenceId))add(entry.sequenceId?'Ouvrir la séquence':'Préparer la séquence',()=>openCalendarSequence(date,index));
  const groupId=getEntryGroupId(entry),group=groupsData.find(g=>g.id===groupId);
  if(group)add('Voir les '+group.students.length+' élèves',()=>openGroup(groupId));
}
function henriChooseSequenceCourse(date,index){
  const entry=scheduleEntries[date]?.[index];
  const groupId=entry&&getEntryGroupId(entry);
  const slot=groupId&&getGroupCourseOccurrences(groupId).find(s=>s.key===courseOccurrenceKey(date,entry));
  if(!slot||!entry.annualBlockId)return;
  const block=(annualPlans[groupId]||[]).find(b=>b.id===entry.annualBlockId);
  if(!block)return;
  const current=Number(entry.sessionIndex)||0;
  const count=Math.max(0,Number(block.courses)||0);
  const options=Array.from({length:Math.max(0,count-current)},(_,i)=>{
    const n=current+i+1;
    return n+' — '+(block.sport==='Ultimate'&&n===4?'Évaluation':'Cours '+n);
  });
  if(options.length<2){alert('Il n’y a pas de cours suivant dans cette séquence.');return;}
  const answer=prompt('Choisir le numéro du cours à faire maintenant pour ce groupe :\n'+options.join('\n')+'\n\nLes cours intermédiaires seront sautés, mais resteront dans la banque.',String(current+1));
  if(answer===null)return;
  const number=Number(answer);
  if(!Number.isInteger(number)||number<=current+1||number>count){alert('Choisis un numéro de cours suivant valide.');return;}
  if(!confirm('Passer directement au cours '+number+' ? Les cours intermédiaires seront sautés pour ce groupe seulement.'))return;
  henriSaveSequenceJump(groupId,slot,{blockId:block.id,sessionIndex:number-1});
  openCourseEntry(date,index);
}
function calendarSequenceFor(entry){
  return entry.annualBlockId?getSavedSequence(getEntryGroupId(entry),entry.annualBlockId):Object.values(savedSequences).find(s=>s.id===entry.sequenceId);
}
function openCalendarSequence(date,index){
  const entry=scheduleEntries[date]?.[index];if(!entry||!isPlanningEntry(entry))return;
  calendarCourseContext={date,index};calendarPlanEditing=true;
  const saved=calendarSequenceFor(entry);
  if(saved){activeSequence=JSON.parse(JSON.stringify(saved));renderSequenceEditor();go('sequenceEditor');}
  else if(entry.annualBlockId)openMacroSequence(getEntryGroupId(entry),entry.annualBlockId,true);
}
function openCalendarSession(date,index){
  const entry=scheduleEntries[date]?.[index];if(!entry||!isPlanningEntry(entry))return;
  calendarCourseContext={date,index};calendarPlanEditing=true;
  if(entry.isIndividual){
    const individual=individualSessions.find(x=>x.id===entry.individualId);if(!individual)return;
    calendarIndividualEditing=individual.id;quickSessionData=JSON.parse(JSON.stringify(individual));openSessionEditor(0,'quick');
  }else{
    const saved=calendarSequenceFor(entry);if(!saved)return;
    activeSequence=JSON.parse(JSON.stringify(saved));openSessionEditor(entry.sessionIndex,'sequence');
  }
}
function persistCalendarIndividual(){
  if(!calendarIndividualEditing||!quickSessionData)return;
  const index=individualSessions.findIndex(x=>x.id===calendarIndividualEditing);
  if(index<0)return;
  individualSessions[index]={...individualSessions[index],...JSON.parse(JSON.stringify(quickSessionData))};
  localStorage.setItem('previewHenriSlate:henriIndividualSessions',JSON.stringify(individualSessions));
  rebuildPlanningAssignments();
}
