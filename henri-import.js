/* Document associations are deterministic; ambiguous OCR must be reviewed. */
(function(root){
  const clean=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  function aliases(value){
    const raw=String(value||'');
    const out=new Set([clean(raw)]);
    for(const m of raw.matchAll(/EDU\s*([1-5])\s*G\s*\d\s*[-–]?\s*(\d{1,2})/gi))out.add('S'+m[1]+'G'+Number(m[2]));
    const sg=raw.match(/(?:secondaire|sec\.?|s)\s*([1-5])[^\n]{0,25}(?:groupe|gr\.?|g)\s*0*(\d{1,2})/i)||raw.match(/^([1-5])\s*[-–]\s*0*(\d{1,2})$/);
    if(sg)out.add('S'+sg[1]+'G'+Number(sg[2]));
    const group=raw.match(/^(?:groupe|gr\.?)\s*0*(\d{1,3})$/i);
    if(group)out.add('G'+Number(group[1]));
    return [...out].filter(Boolean);
  }
  function matchGroup(value,groups){
    const codes=[...String(value||'').matchAll(/EDU\s*[1-5]\s*G\s*\d\s*[-–]?\s*\d{1,2}/gi)].map(m=>clean(m[0]));
    const byCode=groups.filter(g=>(g.sourceCodes||[]).some(code=>codes.includes(clean(code))));
    if(byCode.length)return byCode.length===1?byCode[0]:null;
    const exact=groups.filter(g=>[g.name,...(g.aliases||[]),...(g.sourceCodes||[])].some(a=>clean(a)===clean(value)));
    if(exact.length)return exact.length===1?exact[0]:null;
    const wanted=new Set(aliases(value));
    const matches=groups.filter(g=>!(codes.length&&g.sourceCodes?.length)&&[g.name,...(g.aliases||[]),...(g.sourceCodes||[])].flatMap(aliases).some(a=>wanted.has(a)));
    return matches.length===1?matches[0]:null;
  }
  function rosterLines(text){
    const lines=String(text||'').split('\n').map(line=>line.trim()).filter(Boolean);
    // Mozaïk attendance sheets have a separate teacher header, then Surname, Given name rows.
    // Keep the table body rather than treating every two-word header as a student.
    const commaName=/^[\d .#-]*[A-Za-zÀ-ÖØ-öø-ÿ'’ .-]+\s*,\s*[A-Za-zÀ-ÖØ-öø-ÿ'’ .-]+(?:\s*[|;].*)?$/;
    const nameRows=lines.map((line,index)=>commaName.test(line)?index:-1).filter(index=>index>=0);
    const body=nameRows.length>=2?lines.slice(nameRows[0]):lines;
    return body.filter(line=>!/^(?:[eé]ducation\s+physique|page\s+\d+\s+(?:de|sur|of)\s+\d+|moza[iï]k|https?:|www\.)/i.test(line));
  }
  function validDate(year,month,day){
    const d=new Date(Number(year),Number(month)-1,Number(day),12);
    if(d.getFullYear()!==Number(year)||d.getMonth()!==Number(month)-1||d.getDate()!==Number(day))return null;
    return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  }
  function label(value){
    const s=String(value||'').trim();
    if(/pedagog/i.test(s.normalize('NFD').replace(/[\u0300-\u036f]/g,'')))return 'Pédagogique';
    if(/cong[eé]|vacance|f[eê]ri[eé]/i.test(s))return 'Congé';
    const m=s.match(/\b(?:jour|j)\s*(\d{1,2})\b/i);
    if(m&&Number(m[1])>=1&&Number(m[1])<=20)return 'Jour '+Number(m[1]);
    const pending=s.match(/\bjour\s*([xyz])\b/i);
    return pending?'Jour '+pending[1].toLowerCase():'';
  }
  function decouvreursReference(text){
    const raw=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    // This profile is scoped to the supplied secondary-school calendar, never to other calendars.
    if(!/decouvreurs/.test(raw)||!/secondaire/.test(raw)||!/2026\s*[-–]\s*2027/.test(raw)||!/180\s+journees/.test(raw)||!/31\s+aout\s+2026/.test(raw)||!/23\s+juin\s+2027/.test(raw)||!/flottantes?/.test(raw))return null;
    const out={},pedagogical=new Set(['2026-10-05','2026-10-23','2026-11-19','2026-11-20','2027-01-04','2027-02-12','2027-04-09','2027-04-19','2027-05-10','2027-05-21']);
    const holidays=new Set(['2026-09-07','2026-10-12','2027-03-26','2027-03-29','2027-05-24']);
    for(const [start,end] of [['2026-12-21','2027-01-01'],['2027-03-01','2027-03-05']]){
      for(let d=new Date(start+'T12:00:00');d<=new Date(end+'T12:00:00');d.setDate(d.getDate()+1))holidays.add(validDate(d.getFullYear(),d.getMonth()+1,d.getDate()));
    }
    let cycle=1;
    for(let d=new Date(2026,7,31,12);d<=new Date(2027,5,23,12);d.setDate(d.getDate()+1)){
      if(d.getDay()===0||d.getDay()===6)continue;
      const key=validDate(d.getFullYear(),d.getMonth()+1,d.getDate());
      if(pedagogical.has(key))out[key]='Pédagogique';
      else if(holidays.has(key))out[key]='Congé';
      else if(key>='2027-06-21')out[key]='Jour '+['x','y','z'][d.getDate()-21];
      else {out[key]='Jour '+cycle;cycle=cycle%9+1;}
    }
    return out;
  }
  function calendarNumberGrid(words,startYear,endYear,classifyCell){
    const items=wordsWithLabels(words),names=['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
    const median=values=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor(sorted.length/2)];};
    const headings=[];
    for(const word of items){
      const name=word.text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z]/g,'');
      const month=names.indexOf(name);if(month<0)continue;
      const year=items.find(w=>/^20\d{2}$/.test(w.text)&&w.bbox.x0>=word.bbox.x1-4&&w.bbox.x0-word.bbox.x1<100&&Math.abs(w.y-word.y)<15);
      headings.push({...word,month,x:year?(word.bbox.x0+year.bbox.x1)/2:word.x});
    }
    // Identify the 4-by-3 month grid from its actual headings, excluding footer month names.
    const rows=[];
    for(const h of headings.sort((a,b)=>a.y-b.y)){
      const row=rows.find(r=>Math.abs(r[0].y-h.y)<Math.max(15,h.bbox.y1-h.bbox.y0));
      if(row)row.push(h);else rows.push([h]);
    }
    const grid=rows.filter(r=>r.length===4).map(r=>r.sort((a,b)=>a.x-b.x));
    if(grid.length!==3||new Set(grid.flat().map(h=>h.month)).size!==12)return {};
    const spacing=median([grid[1][0].y-grid[0][0].y,grid[2][0].y-grid[1][0].y]),out={};
    for(const row of grid)for(let column=0;column<4;column++){
      const heading=row[column],year=heading.month>=6?startYear:endYear;
      const left=column?(row[column-1].x+heading.x)/2:heading.x-(row[1].x-heading.x)/2;
      const right=column<3?(heading.x+row[column+1].x)/2:heading.x+(heading.x-row[column-1].x)/2;
      const width=(right-left)/7,firstDow=new Date(year,heading.month,1).getDay();
      const candidates=items.filter(w=>w.x>left&&w.x<right&&w.y>heading.bbox.y1+10&&w.y<heading.y+spacing-20&&/^\d{1,2}\*?$/.test(w.text)&&Number(w.text.replace('*',''))<=31);
      if(candidates.length<10)continue;
      const largeHeight=Math.max(...candidates.map(w=>w.bbox.y1-w.bbox.y0));
      const dates=candidates.filter(w=>w.bbox.y1-w.bbox.y0>=largeHeight*.75).map(w=>({...w,day:Number(w.text.replace('*',''))})).filter(w=>{
        const slot=firstDow+w.day-1;
        return validDate(year,heading.month+1,w.day)&&Math.abs(w.x-(left+(slot%7+.5)*width))<width*.4;
      });
      const bands=new Map();for(const w of dates){const band=Math.floor((firstDow+w.day-1)/7);(bands.get(band)||bands.set(band,[]).get(band)).push(w.y);}
      const centers=[...bands].map(([band,ys])=>({band,y:median(ys)})).sort((a,b)=>a.band-b.band);
      if(centers.length<3)continue;
      const height=median(centers.slice(1).map((c,i)=>(c.y-centers[i].y)/(c.band-centers[i].band)));
      if(height<largeHeight||height>largeHeight*4)continue;
      const origin=median(centers.map(c=>c.y-c.band*height));
      for(let day=1;validDate(year,heading.month+1,day);day++){
        const slot=firstDow+day-1,x=left+(slot%7+.5)*width,y=origin+Math.floor(slot/7)*height;
        const key=validDate(year,heading.month+1,day),color=classifyCell?.(x-width/2,y-height/2,x+width/2,y+height/2);
        if(color){out[key]=color;continue;}
        const small=items.filter(w=>Number(w.confidence??100)>=80&&/^(?:[1-9]|1\d|20|[xyz])$/i.test(w.text)&&w.bbox.y1-w.bbox.y0<largeHeight*.75&&w.x>x-width*.15&&w.x<x+width*.5&&w.y>y+largeHeight*.2&&w.y<y+height*.5);
        const values=[...new Set(small.map(w=>label('Jour '+w.text)).filter(Boolean))];
        if(values.length===1)out[key]=values[0];
      }
    }
    return out;
  }
  function calendarText(text){
    const out={}, months=['janvier','fevrier','mars','avril','mai','juin','juillet','aout','septembre','octobre','novembre','decembre'];
    const raw=String(text||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const dates=/(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})|\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})|\b(\d{1,2})\s+(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)\s+(20\d{2})/gi;
    const found=[...raw.matchAll(dates)];
    found.forEach((m,i)=>{
      const key=m[1]?validDate(m[1],m[2],m[3]):m[4]?validDate(m[6],m[5],m[4]):validDate(m[9],months.indexOf(m[8].toLowerCase())+1,m[7]);
      // Never borrow a label from the next date (PDF text can be one long line).
      const tail=raw.slice(m.index+m[0].length,found[i+1]?.index??raw.length).split('\n')[0];
      const type=label(tail);
      if(key&&type){
        if(out[key]&&out[key]!==type)throw new Error('Deux jours différents sont indiqués pour le '+key+'.');
        out[key]=type;
      }
    });
    return out;
  }
  function scheduleText(text){
    const out={};
    const raw=String(text||'');
    const days=[...raw.matchAll(/\bJour\s*(\d{1,2})\b/gi)];
    days.forEach((m,i)=>{
      const day=Number(m[1]);if(day<1||day>20)return;
      out['Jour '+day]??=[];
      const chunk=raw.slice(m.index+m[0].length,days[i+1]?.index??raw.length);
      const courses=[...chunk.matchAll(/EDU\s*[1-5]\s*G\s*\d\s*[-–]?\s*\d{1,2}|(?:Groupe|Gr\.?)\s*\d{1,3}\b/gi)];
      courses.forEach((course,j)=>{
        const preceding=chunk.slice(courses[j-1]?courses[j-1].index+courses[j-1][0].length:0,course.index);
        const times=[...preceding.matchAll(/\b(\d{1,2})\s*[h:]\s*(\d{2})\b/gi)];
        const periods=[...preceding.matchAll(/\b(?:p[eé]riode|p)\s*(\d{1,2})\b/gi)];
        const t=times.at(-1),p=periods.at(-1);
        const time=t&&Number(t[1])<24&&Number(t[2])<60?Number(t[1])+' h '+t[2]:p?'Période '+Number(p[1]):'';
        const cognitive=/cognit/i.test(preceding);
        (out['Jour '+day]??=[]).push({time,period:cognitive?null:p?Number(p[1]):null,kind:cognitive?'cognitive':'course',durationMinutes:cognitive?20:null,group:course[0].replace(/\s+/g,' ').trim(),groupCode:course[0],matchedGroupId:null,activity:cognitive?'Intégration cognitive':'Éducation physique'});
      });
    });
    return out;
  }
  function relink(teacher,groups){
    return Object.fromEntries(Object.entries(teacher||{}).map(([day,lessons])=>[day,lessons.map(lesson=>{
      const group=groups.find(g=>g.id===lesson.matchedGroupId)||matchGroup(lesson.groupCode||lesson.group,groups);
      return {...lesson,group:group?.name||lesson.groupCode||lesson.group,matchedGroupId:group?.id||null};
    })]));
  }
  function isCognitive(entry){
    return entry?.kind==='cognitive'||/cognit/i.test(entry?.activity||'');
  }
  function wordsWithLabels(words){
    const items=(words||[]).filter(w=>w.bbox&&Number(w.confidence??100)>=20);
    return items.map(w=>{
      const height=Math.max(1,w.bbox.y1-w.bbox.y0);
      const neighbours=items.filter(n=>n!==w&&n.bbox.x0>=w.bbox.x1-3&&n.bbox.x0-w.bbox.x1<height*3&&Math.abs((n.bbox.y0+n.bbox.y1)/2-(w.bbox.y0+w.bbox.y1)/2)<height*.6).sort((a,b)=>a.bbox.x0-b.bbox.x0);
      const next=neighbours[0];
      let text=w.text,bbox=w.bbox;
      if(/^(jour|p[eé]riode|p|groupe|gr\.?)$/i.test(text)&&next&&/^\d{1,3}[.:]?$/.test(next.text)){
        text+=' '+next.text;bbox={...bbox,x1:next.bbox.x1};
      }else if(/^EDU/i.test(text)){
        // Join only adjacent fragments of a valid course code, never student names.
        let right=bbox.x1;
        for(const n of neighbours.slice(0,4)){
          if(n.bbox.x0-right>height*1.5||!/^[-–0-9G]+$/i.test(n.text))break;
          text+=n.text;right=n.bbox.x1;
          if(/^EDU[1-5]G\d[-–]\d{2}$/i.test(text)){bbox={...bbox,x1:right};break;}
        }
        if(!/^EDU\s*[1-5]\s*G\s*\d\s*[-–]?\s*\d{1,2}$/i.test(text)){text=w.text;bbox=w.bbox;}
      }
      return {...w,text,bbox,x:(bbox.x0+bbox.x1)/2,y:(bbox.y0+bbox.y1)/2};
    });
  }
  function scheduleDayLabels(words){
    return wordsWithLabels(words).filter(w=>/^jour\s*\d{1,2}[.:]?$/i.test(w.text)).map(w=>({...w,day:Number(w.text.match(/\d+/)[0])})).filter(w=>w.day>=1&&w.day<=20);
  }
  function scheduleGrid(words){
    const items=wordsWithLabels(words);
    const days=scheduleDayLabels(words);
    if(days.length<2)return {};
    const spread=axis=>Math.max(...days.map(w=>w[axis]))-Math.min(...days.map(w=>w[axis]));
    const dayAxis=spread('x')>spread('y')?'x':'y',columnAxis=dayAxis==='x'?'y':'x';
    const nearest=(anchors,value,axis)=>anchors.reduce((best,a)=>Math.abs(a[axis]-value)<Math.abs(best[axis]-value)?a:best);
    const firstDay=Math.min(...days.map(w=>w[dayAxis]));
    const positions=[...new Set(days.map(w=>w[dayAxis]))].sort((a,b)=>a-b);
    const rowSpacing=Math.min(...positions.slice(1).map((p,i)=>p-positions[i]));
    const clockValues=text=>[...String(text).matchAll(/\b(\d{1,2})\s*[h:]\s*(\d{2})\b/gi)].filter(m=>Number(m[1])<24&&Number(m[2])<60).map(m=>({text:Number(m[1])+' h '+m[2],minutes:Number(m[1])*60+Number(m[2])}));
    const header=items.filter(w=>w[dayAxis]<firstDay);
    const columns=header.filter(w=>/^(?:p[eé]riode|p)\s*\d{1,2}$/i.test(w.text)).map(w=>({...w,period:Number(w.text.match(/\d+/)[0]),kind:'course'}));
    for(const word of header){
      if(/cognit/i.test(word.text))columns.push({...word,period:null,kind:'cognitive'});
      else if(/d[iî]ner|lunch/i.test(word.text))columns.push({...word,period:null,kind:'lunch'});
    }
    if(!columns.length){
      // Time-only headers are also supported, without assigning invented period numbers.
      for(const word of header.filter(w=>clockValues(w.text).length)){
        const existing=columns.find(c=>Math.abs(c[columnAxis]-word[columnAxis])<(word.bbox.y1-word.bbox.y0)*5);
        if(!existing)columns.push({...word,period:null,kind:'course'});
      }
    }
    if(!columns.length)return {};
    const ordered=columns.map(c=>c[columnAxis]).sort((a,b)=>a-b);
    const spacing=Math.min(...ordered.slice(1).map((v,i)=>v-ordered[i]));
    for(const word of header.filter(w=>clockValues(w.text).length)){
      if(Math.abs(nearest(columns,word[columnAxis],columnAxis)[columnAxis]-word[columnAxis])>spacing*.4){
        columns.push({...word,period:null,kind:'course'});
      }
    }
    columns.sort((a,b)=>a[columnAxis]-b[columnAxis]);
    for(const column of columns)column.clocks=[];
    for(const word of header){
      const clocks=clockValues(word.text);if(!clocks.length)continue;
      nearest(columns,word[columnAxis],columnAxis).clocks.push(...clocks);
    }
    for(const column of columns){
      const clocks=[...new Map(column.clocks.map(t=>[t.minutes,t])).values()].sort((a,b)=>a.minutes-b.minutes);
      column.time=clocks[0]?.text||(column.period?'Période '+column.period:'');
      column.endTime=clocks[1]?.text||null;
      column.durationMinutes=clocks.length>=2?clocks[1].minutes-clocks[0].minutes:null;
      // A separate unnumbered 20-minute column is supervision, not a PE period.
      if(column.kind==='course'&&column.period===null&&column.durationMinutes===20)column.kind='cognitive';
      if(column.kind==='cognitive')column.period=null;
    }
    const out={};
    for(const day of days)if(day.day>=1&&day.day<=20)out['Jour '+day.day]??=[];
    for(const word of items.filter(w=>/^EDU\s*[1-5]\s*G\s*\d\s*[-–]?\s*\d{1,2}$/i.test(w.text)||/^(?:groupe|gr\.?)\s*\d{1,3}$/i.test(w.text))){
      if(word[dayAxis]<firstDay-(word.bbox.y1-word.bbox.y0)*3)continue;
      const day=nearest(days,word[dayAxis],dayAxis),column=nearest(columns,word[columnAxis],columnAxis);
      // An unreadable day label must not move its courses to an adjacent day.
      if(Math.abs(day[dayAxis]-word[dayAxis])>rowSpacing*.65)continue;
      if(day.day<1||day.day>20||column.kind==='lunch')continue;
      (out['Jour '+day.day]??=[]).push({time:column.time,endTime:column.endTime,durationMinutes:column.durationMinutes,period:column.period,kind:column.kind,group:word.text,groupCode:word.text,activity:column.kind==='cognitive'?'Intégration cognitive':'Éducation physique'});
    }
    return out;
  }
  function review(teacher,calendar,groups){
    const errors=[],warnings=[],dates=Object.keys(calendar||{}).sort();
    const lessons=Object.values(teacher||{}).flat();
    const cycleDates=dates.filter(d=>/^Jour \d+$/.test(calendar[d]));
    const pendingDates=dates.filter(d=>/^Jour [xyz]$/.test(calendar[d]));
    if(pendingDates.length)warnings.push('Jours-cycle à préciser : '+pendingDates.join(', ')+'. Aucun groupe ne sera attribué à ces dates tant que leur jour-cycle n’est pas connu.');
    const absentCycles=[...new Set(cycleDates.map(d=>calendar[d]))].filter(day=>!Object.hasOwn(teacher||{},day));
    if(absentCycles.length)errors.push('Ces jours-cycle ne sont pas reconnus dans ton horaire : '+absentCycles.join(', ')+'. Vérifie les pages manquantes, y compris les jours sans cours.');
    if(!groups?.length)errors.push('Ajoute les listes de tes groupes.');
    if(!lessons.length)errors.push('Aucun cours reconnu dans ton horaire.');
    const unlinked=lessons.filter(l=>!groups?.some(g=>g.id===l.matchedGroupId));
    if(unlinked.length)errors.push(unlinked.length+' cours à associer à un groupe.');
    const timeKey=value=>{
      const time=String(value||'').match(/^(\d{1,2})\s*[h:]\s*(\d{2})$/i);
      if(time&&Number(time[1])<24&&Number(time[2])<60)return 'T'+(Number(time[1])*60+Number(time[2]));
      const period=String(value||'').match(/^p[eé]riode\s*(\d{1,2})$/i);
      return period&&Number(period[1])>=1&&Number(period[1])<=20?'P'+Number(period[1]):null;
    };
    if(lessons.some(l=>!timeKey(l.time)))errors.push('Des périodes ou heures de cours restent à préciser.');
    for(const [day,items] of Object.entries(teacher||{})){
      if(new Set(items.map(x=>timeKey(x.time))).size!==items.length)errors.push(day+' contient plusieurs cours à la même période.');
    }
    const span=dates.length?(new Date(dates.at(-1)+'T12:00:00')-new Date(dates[0]+'T12:00:00'))/86400000:0;
    if(cycleDates.length<80||span<180)errors.push('Le calendrier doit couvrir toute l’année scolaire, avec les jours-cycle et les congés.');
    const missing=[];
    if(dates.length){
      for(let d=new Date(dates[0]+'T12:00:00'),end=new Date(dates.at(-1)+'T12:00:00');d<=end;d.setDate(d.getDate()+1)){
        const key=validDate(d.getFullYear(),d.getMonth()+1,d.getDate());
        if(d.getDay()>0&&d.getDay()<6&&!calendar[key])missing.push(key);
      }
    }
    if(missing.length)errors.push(missing.length+' dates de semaine sans jour-cycle ni congé, dont '+missing.slice(0,3).join(', ')+'.');
    if(cycleDates.some(d=>[0,6].includes(new Date(d+'T12:00:00').getDay())))errors.push('Des jours-cycle sont placés la fin de semaine : vérifie le calendrier.');
    if(dates.some(d=>validDate(...d.split('-'))!==d||!label(calendar[d])))errors.push('Des dates ou jours scolaires sont invalides.');
    return {errors,warnings,pendingDates,dates,cycleDates,lessons,unlinked,missing,ready:!errors.length};
  }
  const api={aliases,matchGroup,rosterLines,validDate,label,calendarText,calendarNumberGrid,decouvreursReference,scheduleText,scheduleGrid,wordsWithLabels,scheduleDayLabels,relink,review,isCognitive};
  if(typeof module!=='undefined')module.exports=api;else root.HenriImport=api;
})(typeof globalThis!=='undefined'?globalThis:this);
