/* A cancellation removes an occurrence, never a lesson or an annual block. */
function henriCancelCourses(date,indices,reason='Sortie scolaire'){
  const selections=[...new Set(indices)].map(index=>({index,entry:scheduleEntries[date]?.[index]})).filter(item=>item.entry&&isPlanningEntry(item.entry)&&getEntryGroupId(item.entry));
  const changes=selections.filter(({entry})=>!getCalendarException(date,getEntryGroupId(entry),entry));
  if(!changes.length){planningReport('Sélectionne au moins un cours non annulé.',true);return false;}
  const before=JSON.parse(JSON.stringify({calendarExceptions,individualSessions}));let committed=false;
  try{
    const backupKey='previewHenriSlate:backupBeforeCourseCancellation:'+planningId('backup');
    localStorage.setItem(backupKey,JSON.stringify({at:new Date().toISOString(),date,...before}));
    const records=changes.map(({entry,index})=>({id:planningId('exc'),date,startDate:date,endDate:date,groupId:getEntryGroupId(entry),courseKey:courseOccurrenceKey(date,entry),type:reason==='Sortie scolaire'?'Sortie scolaire':'Cours annulé',reason,originalIndex:index,originalIndividualId:entry.individualId||null}));
    calendarExceptions.push(...records);
    for(const record of records){
      const individual=individualSessions.find(session=>session.groupId===record.groupId&&(session.id===record.originalIndividualId||session.courseKey===record.courseKey));
      if(!individual)continue;
      const next=getGroupCourseOccurrences(record.groupId).find(slot=>slot.date>date&&!individualForOccurrence(record.groupId,slot));
      if(next){
        record.relocatedIndividual={id:individual.id,previous:{date:individual.date,courseKey:individual.courseKey||null,time:individual.time||null},destinationCourseKey:next.key};
        Object.assign(individual,{date:next.date,courseKey:next.key,time:next.entry.time});
      }else record.pendingIndividualId=individual.id;
    }
    henriPersistSharedState();committed=true;rebuildPlanningAssignments();renderCalendarExceptions();
    const ids=[...new Set(records.map(record=>record.groupId))];
    const overflow=ids.reduce((sum,id)=>sum+getScheduleConflict(id).overflow,0);
    const pending=records.filter(record=>record.pendingIndividualId).length;
    planningReport(records.length+' cours annulé(s). Les séances sont conservées et reportées dans le même ordre.'+(overflow?' '+overflow+' cours restent sans date en fin d’année; aucune séance n’a été supprimée.':'')+(pending?' '+pending+' séance individuelle reste à replacer faute de période disponible.':''));
    return true;
  }catch(error){
    if(!committed){calendarExceptions=before.calendarExceptions;individualSessions=before.individualSessions;}
    planningError(error);return false;
  }
}
function henriRestoreCancelledCourse(id,date){deleteCalendarException(id);openDayPlan(date);planningReport('Cours rétabli. Les séances ont retrouvé leurs dates selon l’horaire disponible.');}
function henriOpenCancellationForm(date,index=null){
  openDayPlan(date);
  document.getElementById('calendarCancellationForm')?.remove();
  const panel=document.createElement('div');panel.id='calendarCancellationForm';panel.className='planForm';
  const title=document.createElement('h2');title.textContent='Annuler des cours';
  const hint=document.createElement('p');hint.className='planHint';hint.textContent='Les contenus sont conservés. La séance sera reportée à la prochaine période disponible du groupe; les dates suivantes, dont celle de l’évaluation, pourront être décalées.';
  const list=document.createElement('div');
  (scheduleEntries[date]||[]).forEach((entry,i)=>{
    if(!isPlanningEntry(entry)||getCalendarException(date,getEntryGroupId(entry),entry))return;
    const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.value=i;input.checked=i===index;label.className='cancellationChoice';label.append(input,document.createTextNode(' '+henriCalendarGroupLabel(entry)+' · '+entry.time));list.append(label);
  });
  const field=document.createElement('label');field.textContent='Motif';const reason=document.createElement('input');reason.id='cancellationReason';reason.className='planControl';reason.value='Sortie scolaire';field.append(reason);
  const apply=document.createElement('button');apply.className='planPrimary';apply.textContent='Annuler et reporter ces cours';apply.onclick=()=>{const ids=Array.from(list.querySelectorAll('input:checked'),input=>Number(input.value));if(henriCancelCourses(date,ids,reason.value.trim()||'Cours annulé'))openDayPlan(date);};
  const cancel=document.createElement('button');cancel.className='itemBtn';cancel.textContent='Fermer';cancel.onclick=()=>panel.remove();
  panel.append(title,hint,list,field,apply,cancel);dayPlanCourses.prepend(panel);panel.scrollIntoView({block:'start'});
}

// Teacher-requested outing: apply only the two explicit course codes on this date.
// The per-code marker also respects a later deliberate restoration by the teacher.
function henriApplyOctober16Outing(){
  const date='2026-10-16',key='previewHenriSlate:outing2026-10-16:v1';
  try{
    const done=JSON.parse(localStorage.getItem(key)||'{"codes":[]}');
    const targets=new Set(['EDU4G201','EDU4G202'].filter(code=>!done.codes.includes(code)));
    if(!targets.size)return;
    const matched=new Set(),indices=[];
    (scheduleEntries[date]||[]).forEach((entry,index)=>{
      if(!isPlanningEntry(entry))return;
      const groupId=getEntryGroupId(entry),group=groupsData.find(group=>group.id===groupId);
      if(!group)return;
      const values=[entry.groupCode,entry.group,group.name,group.id,...(group.sourceCodes||[])];
      const codes=values.flatMap(value=>Array.from(String(value||'').toUpperCase().replace(/[^A-Z0-9]/g,'').matchAll(/EDU4G20?([12])(?!\d)/g),match=>'EDU4G20'+match[1]));
      const code=codes.find(code=>targets.has(code));if(!code)return;
      matched.add(code);if(!getCalendarException(date,groupId,entry))indices.push(index);
    });
    if(!matched.size)return;
    if(indices.length&&!henriCancelCourses(date,indices,'Sortie scolaire'))return;
    localStorage.setItem(key,JSON.stringify({at:new Date().toISOString(),codes:[...new Set([...done.codes,...matched])]}));
  }catch(error){planningError(error);}
}
