"""Check the supplied CSS calendar format and floating-day behavior end to end.
Run: python3 tests/reference_calendar_browser.py
The timetable and roster fixtures represent extracted document contents; no real student names.
"""
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from threading import Thread
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
ROWS = [
    ['EDU4G2-02','EDU4G2-01','EDU4G2-01',None,'EDU3G2-02',None],
    ['EDU3G2-03','EDU2G2-05','EDU2G2-05',None,'EDU2G2-01',None],
    [None,'EDU4G2-04','EDU4G2-04',None,None,None],
    [None,'EDU3G2-05','EDU3G2-05',None,'EDU3G2-04',None],
    ['EDU2G2-03','EDU2G2-02','EDU2G2-02',None,'EDU4G2-02','EDU4G2-01'],
    ['EDU3G2-02',None,None,None,'EDU3G2-03','EDU2G2-05'],
    ['EDU2G2-01',None,None,None,None,'EDU4G2-04'],
    [None,None,None,None,None,'EDU3G2-05'],
    ['EDU3G2-04',None,None,None,'EDU2G2-03','EDU2G2-02'],
]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with TemporaryDirectory() as temporary, sync_playwright() as p:
        tmp = Path(temporary)
        calendar = tmp / 'calendrier.txt'
        calendar.write_text('Centre de services scolaire des Découvreurs\nSecondaire Calendrier scolaire 2026-2027\n180 journées d’enseignement\nDébut des cours pour les élèves : 31 août 2026\nFin des cours pour les élèves : 23 juin 2027\n3 journées pédagogiques flottantes\nJours x, y et z des 21, 22 et 23 juin 2027')
        groups = sorted({code for row in ROWS for code in row if code})
        for code in groups:
            (tmp / (code+'.txt')).write_text('Education physique\n'+code+'\nEnseignant Exemple\n'+'\n'.join('Nom'+chr(97+i)+', Prénom'+chr(97+i) for i in range(20)))
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: d.accept())
        page.route('https://**/*', lambda r: r.abort())
        page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='networkidle')
        assert page.evaluate("""()=>{
          const a={id:'a',name:'Secondaire 4 · Groupe 02',sourceCodes:['EDU4G1-02'],students:[]};
          const b={id:'b',name:a.name,sourceCodes:['EDU4G2-02'],students:[]};
          const merged=mergeImportedGroups([b],[a]);
          return merged.length===2&&merged[0].id==='b'&&mergeImportedGroups([{...b,id:'new'}],merged)[0].id==='b';
        }""")
        page.get_by_role('button', name='Paramètres', exact=True).click()
        page.evaluate("""rows=>{
          const times=['8 h 10','9 h 35','10 h 55','11 h 15','12 h 35','14 h 00'];
          const periods=[1,2,null,null,3,4];
          importedSetupData.teacherSchedule=Object.fromEntries(rows.map((row,i)=>['Jour '+(i+1),row.flatMap((code,j)=>code?[{time:times[j],period:periods[j],kind:j===2?'cognitive':'course',groupCode:code,group:code,activity:j===2?'Intervention cognitive':'Éducation physique'}]:[])]));
          setupFiles.teacherSchedule=true;updateGenerateState();
        }""", ROWS)
        assert page.evaluate("""async text=>{
          const doc={file:{name:'calendar.txt',type:'text/plain'},text:text+'\\n2026-07-01 Congé\\n2027-06-24 Pédagogique',words:[]};
          const parsed=await parseSchoolCalendarDocs([doc]);
          if(parsed['2026-07-01']||parsed['2027-06-24'])return false;
          try{await parseSchoolCalendarDocs([{...doc,text:text+'\\n2026-08-31 Jour 2'}]);return false;}catch(error){return error.message.includes('diffère');}
        }""",calendar.read_text())
        page.locator('#schoolCalendarFile').set_input_files(str(calendar))
        page.wait_for_function('setupFiles.schoolCalendar')
        page.locator('#groupSheetsFile').set_input_files([str(tmp / (code+'.txt')) for code in groups])
        page.wait_for_function('!generateScheduleBtn.disabled')
        assert page.evaluate('groupsData.length') == 11
        assert '2027-06-21' in page.locator('#importLinksReview').inner_text()
        page.locator('#generateScheduleBtn').click()
        page.wait_for_function("document.getElementById('home').classList.contains('active')")
        assert page.evaluate("Object.values(scheduleEntries).flat().filter(isPlanningEntry).length") == 440
        assert page.evaluate("Object.values(scheduleEntries).flat().filter(e=>e.kind==='cognitive').length") == 100
        assert page.evaluate("Object.values(scheduleEntries).flat().filter(HenriImport.isCognitive).every(e=>!e.planData&&!e.annualBlockId&&!e.sequenceId)")
        assert page.evaluate("""()=>{
          const date='2026-11-23',index=scheduleEntries[date].findIndex(HenriImport.isCognitive);
          const before=document.querySelector('.screen.active')?.id;
          openQuickSessionForCourse(date,index);openCalendarSession(date,index);openCalendarSequence(date,index);
          return document.querySelector('.screen.active')?.id===before;
        }""")
        assert page.evaluate("getGroupCourseOccurrences(groupsData.find(g=>g.sourceCodes.includes('EDU4G2-02')).id).length") == 40
        assert page.evaluate("scheduleEntries['2026-11-23'][0].groupCode==='EDU4G2-02' && scheduleEntries['2026-11-23'][0].time==='8 h 10'")
        assert page.evaluate("!scheduleEntries['2027-06-21'] && schoolDays['2027-06-21']==='Jour x'")
        page.evaluate("openDayPlan('2026-11-23')")
        page.get_by_role('button', name='Voir les élèves', exact=True).first.click()
        assert page.locator('#studentList .studentCard').count() == 20
        assert 'EDU4G2-02' in page.locator('#groupProfileTitle').inner_text()
        # Floating days block courses. Printed calendar cycles stay unchanged.
        page.evaluate("go('settings');toggleExceptionForm(true)")
        page.locator('#exceptionStart').fill('2026-09-08')
        page.evaluate("exceptionGroup.value='all';exceptionType.value='Journée pédagogique flottante';addCalendarException()")
        assert page.evaluate("schoolDays['2026-09-08']==='Jour 6' && getVisibleScheduleEntries('2026-09-08').length===0")
        assert page.evaluate("schoolDays['2026-09-09']==='Jour 7' && getVisibleScheduleEntries('2026-09-09')[0].groupCode==='EDU2G2-01'")
        page.reload(wait_until='networkidle')
        assert page.evaluate("schoolDays['2026-09-09']==='Jour 7' && getVisibleScheduleEntries('2026-09-08').length===0")
        assert not errors, errors
        print('PASS CSS calendar recognition, 440 PE courses + 100 cognitive blocks, roster links, unknown June cycles and floating days without cycle shifts.')
        browser.close()
finally:
    server.shutdown()
    server.server_close()
