/* Henri PACE — notes individuelles sur 10, par cours. */
(function(){
  'use strict';
  const STORAGE_KEY='henriPaceGradesV1';
  let current=null;
  let returnScreen='home';
  let gradebook=readSaved();

  function readSaved(){
    try{
      const data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
      return data&&typeof data==='object'&&!Array.isArray(data)?data:{};
    }catch(e){return {};}
  }
  function save(){
    try{
      localStorage.setItem(STORAGE_KEY,JSON.stringify(gradebook));
      return true;
    }catch(e){
      const status=document.getElementById('henriPaceStatus');
      if(status)status.textContent='Impossible de sauvegarder les notes sur cet appareil.';
      return false;
    }
  }
  function getEntry(date,index){
    return (typeof scheduleEntries!=='undefined'&&scheduleEntries[date]||[])[index]||null;
  }
  function getGroup(entry){
    return typeof groupsData!=='undefined'&&groupsData.find(g=>g.id===entry.matchedGroupId||g.name===entry.group)||null;
  }
  function courseKey(date,entry,group){
    return [date,group?.id||entry.group,String(entry.time||'')].join('::');
  }
  function displayCount(date,index){
    const entry=getEntry(date,index);
    if(!entry)return '';
    const group=getGroup(entry);
    if(!group?.students?.length)return '';
    const saved=gradebook[courseKey(date,entry,group)]||{};
    const total=group.students.filter(s=>Object.prototype.hasOwnProperty.call(saved,String(s.id??s.name))).length;
    return total?' · '+total+'/'+group.students.length:'';
  }
  function makeButton(date,index){
    const entry=getEntry(date,index);
    if(!entry)return null;
    const b=document.createElement('button');
    b.type='button';
    b.className='henriPaceCalendarBtn';
    b.dataset.paceDate=date;
    b.dataset.paceIndex=String(index);
    b.textContent='PACE /10'+displayCount(date,index);
    b.setAttribute('aria-label','Évaluer le PACE sur 10 : '+entry.group+', '+date+', '+entry.time);
    b.addEventListener('click',function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      openPace(date,index);
    });
    return b;
  }
  function readCourseLink(element){
    const raw=element?.getAttribute('onclick')||'';
    const match=raw.match(/openCourseEntry\('([^']+)',\s*(\d+)\)/);
    return match?{date:match[1],index:Number(match[2])}:null;
  }
  function enhanceWeek(){
    document.querySelectorAll('#weekGrid .weekEvent').forEach(event=>{
      if(event.dataset.henriPaceEnhanced)return;
      event.dataset.henriPaceEnhanced='1';
      const link=readCourseLink(event);
      if(!link)return; // A cancelled lesson is not evaluated.
      const action=document.createElement('div');
      action.className='henriPaceWeekAction';
      const button=makeButton(link.date,link.index);
      if(!button)return;
      action.appendChild(button);
      event.insertAdjacentElement('afterend',action);
    });
  }
  function enhanceDay(){
    document.querySelectorAll('#dayPlanCourses .dayPlanCard').forEach(card=>{
      if(card.dataset.henriPaceEnhanced)return;
      card.dataset.henriPaceEnhanced='1';
      const link=readCourseLink(card.querySelector('.sessionLink'));
      if(!link)return;
      const button=makeButton(link.date,link.index);
      if(!button)return;
      card.appendChild(button);
    });
  }
  function refreshButtons(){
    document.querySelectorAll('.henriPaceCalendarBtn').forEach(button=>{
      button.textContent='PACE /10'+displayCount(button.dataset.paceDate,Number(button.dataset.paceIndex));
    });
  }
  function ensureScreen(){
    let screen=document.getElementById('henriPace');
    if(screen)return screen;
    screen=document.createElement('section');
    screen.id='henriPace';
    screen.className='screen';
    screen.innerHTML=
      '<button class="back" id="henriPaceBack" type="button">‹ Retour au cours</button>'+
      '<div class="muted" id="henriPaceMeta"></div>'+
      '<h1>PACE <span class="henriPaceTitleSuffix">/10</span></h1>'+
      '<div class="henriPaceSummary" id="henriPaceSummary"></div>'+
      '<div class="henriPaceRoster" id="henriPaceRoster"></div>'+
      '<p class="henriPaceSaveHint" id="henriPaceStatus" role="status">Chaque note est sauvegardée automatiquement sur cet appareil.</p>';
    document.querySelector('main')?.appendChild(screen);
    screen.querySelector('#henriPaceBack').addEventListener('click',closePace);
    return screen;
  }
  function openPace(date,index){
    const entry=getEntry(date,index);
    if(!entry)return;
    const group=getGroup(entry);
    returnScreen=document.querySelector('.screen.active')?.id||'home';
    if(returnScreen==='henriPace')returnScreen='home';
    current={date,index,entry,group,key:courseKey(date,entry,group)};
    ensureScreen();
    const dateText=new Date(date+'T12:00:00').toLocaleDateString('fr-CA',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
    document.getElementById('henriPaceMeta').textContent=entry.group+' · '+dateText+' · '+(entry.time||'Cours');
    renderPace();
    if(typeof go==='function')go('henriPace');
  }
  function closePace(){
    current=null;
    if(typeof go==='function')go(returnScreen);
  }
  function renderPace(){
    const roster=document.getElementById('henriPaceRoster');
    roster.replaceChildren();
    const group=current?.group;
    if(!group){
      const empty=document.createElement('p');
      empty.className='henriPaceEmpty';
      empty.textContent='La liste de ce groupe n’est pas encore importée. Ajoute ses élèves dans Paramètres pour pouvoir les évaluer.';
      roster.appendChild(empty);
      updateSummary();
      return;
    }
    if(!group.students?.length){
      const empty=document.createElement('p');
      empty.className='henriPaceEmpty';
      empty.textContent='Aucun élève dans ce groupe. Importe une liste dans Paramètres.';
      roster.appendChild(empty);
      updateSummary();
      return;
    }
    const saved=gradebook[current.key]||{};
    group.students.forEach((student,i)=>{
      const studentId=String(student.id??student.name);
      const row=document.createElement('div');
      row.className='henriPaceStudent';
      const name=document.createElement('label');
      name.className='henriPaceStudentName';
      name.textContent=student.name||('Élève '+(i+1));
      const select=document.createElement('select');
      const selectId='henri-pace-'+i;
      select.id=selectId;
      select.className='henriPaceScore';
      select.setAttribute('aria-label','Note PACE sur 10 pour '+(student.name||'élève'));
      name.htmlFor=selectId;
      const ungraded=document.createElement('option');
      ungraded.value='';
      ungraded.textContent='— /10';
      select.appendChild(ungraded);
      for(let n=0;n<=10;n++){
        const opt=document.createElement('option');
        opt.value=String(n);
        opt.textContent=n+' /10';
        select.appendChild(opt);
      }
      const value=saved[studentId];
      select.value=Number.isInteger(value)&&value>=0&&value<=10?String(value):'';
      select.classList.toggle('graded',select.value!=='');
      select.addEventListener('change',()=>{
        const next=select.value;
        const courseGrades=gradebook[current.key]||(gradebook[current.key]={});
        if(next==='')delete courseGrades[studentId];
        else courseGrades[studentId]=Number(next);
        if(!Object.keys(courseGrades).length)delete gradebook[current.key];
        select.classList.toggle('graded',next!=='');
        const ok=save();
        if(ok)document.getElementById('henriPaceStatus').textContent='✓ Notes sauvegardées automatiquement sur cet appareil.';
        updateSummary();
        refreshButtons();
      });
      row.appendChild(name);
      row.appendChild(select);
      roster.appendChild(row);
    });
    updateSummary();
  }
  function updateSummary(){
    const target=document.getElementById('henriPaceSummary');
    if(!target||!current)return;
    const students=current.group?.students||[];
    const saved=gradebook[current.key]||{};
    const scores=students.map(s=>saved[String(s.id??s.name)]).filter(n=>Number.isInteger(n)&&n>=0&&n<=10);
    const mean=scores.length?(scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1).replace('.',',')+' /10':'—';
    target.replaceChildren();
    const progress=document.createElement('div');
    progress.innerHTML='<small>Élèves évalués</small><strong></strong>';
    progress.querySelector('strong').textContent=scores.length+' / '+students.length;
    const average=document.createElement('div');
    average.innerHTML='<small>Moyenne PACE du cours</small><strong></strong>';
    average.querySelector('strong').textContent=mean;
    target.appendChild(progress);
    target.appendChild(average);
  }
  function init(){
    ensureScreen();
    const week=document.getElementById('weekGrid');
    const day=document.getElementById('dayPlanCourses');
    const observer=new MutationObserver(()=>{enhanceWeek();enhanceDay();});
    if(week)observer.observe(week,{childList:true});
    if(day)observer.observe(day,{childList:true});
    enhanceWeek();
    enhanceDay();
  }
  const css=document.createElement('style');
  css.textContent=
    '.henriPaceWeekAction{display:flex;justify-content:flex-end;padding:0 14px 10px;background:#fff}'+
    '.weekDay.today .henriPaceWeekAction{background:#fbfdff}'+
    '.henriPaceCalendarBtn{border:1px solid #d2dfe6;background:#f4f8fa;color:var(--accent,#314a5b);padding:7px 11px;border-radius:10px;font-size:11px;font-weight:800;min-height:34px}'+
    '.henriPaceCalendarBtn:hover{background:#eaf1f5}'+
    '.dayPlanCard>.henriPaceCalendarBtn{margin:9px 0 0 8px}'+
    '.henriPaceTitleSuffix{color:var(--muted);font-weight:570;font-size:.7em}'+
    '.henriPaceSummary{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:18px 0 15px}'+
    '.henriPaceSummary>div{border:1px solid var(--line);background:#fff;padding:14px 15px;border-radius:16px}'+
    '.henriPaceSummary small{display:block;color:var(--muted);font-size:11px;font-weight:700;margin-bottom:5px}'+
    '.henriPaceSummary strong{display:block;font-size:22px;letter-spacing:-.025em}'+
    '.henriPaceRoster{border:1px solid var(--line);background:#fff;border-radius:18px;overflow:hidden}'+
    '.henriPaceStudent{display:grid;grid-template-columns:minmax(0,1fr) 100px;align-items:center;gap:12px;padding:10px 15px;min-height:63px}'+
    '.henriPaceStudent+.henriPaceStudent{border-top:1px solid #f0f1ef}'+
    '.henriPaceStudentName{font-size:14px;font-weight:650;line-height:1.3;min-width:0;overflow-wrap:anywhere}'+
    '.henriPaceScore{width:100%;min-height:42px;background:#f7f7f5;border:1px solid #e3e7e9;border-radius:11px;padding:8px 9px;font-size:13px;font-weight:730;color:#75818b}'+
    '.henriPaceScore.graded{background:#edf5ef;color:#245b43;border-color:#c7dccc}'+
    '.henriPaceSaveHint{font-size:12px;color:#657c71;margin:15px 0 24px;line-height:1.5}'+
    '.henriPaceEmpty{color:var(--muted);padding:18px;line-height:1.5}'+
    '@media(max-width:480px){.henriPaceStudent{grid-template-columns:minmax(0,1fr) 94px;padding:9px 12px}.henriPaceSummary>div{padding:13px 12px}}';
  document.head.appendChild(css);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();