"""Integration checks for imports and calendar links (OCR is tested separately).
Run: python3 tests/calendar_browser.py
Requires the environment's Python Playwright and Chromium.
"""
from datetime import date, timedelta
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from tempfile import TemporaryDirectory
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]


def check(page, expression):
    assert page.evaluate(expression), expression


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with TemporaryDirectory() as temporary, sync_playwright() as p:
        tmp = Path(temporary)
        calendar = []
        day, cycle = date(2026, 8, 31), 1
        while day <= date(2027, 6, 23):
            if day.weekday() < 5:
                special = 'Congé' if day == date(2026, 12, 25) else 'Pédagogique' if day == date(2026, 11, 20) else None
                calendar.append(f'{day.isoformat()} {special or "Jour " + str(cycle)}')
                if not special:
                    cycle = cycle % 9 + 1
            day += timedelta(days=1)
        (tmp / 'calendrier.txt').write_text('\n'.join(calendar))
        (tmp / 'horaire.txt').write_text('\n'.join(f'Jour {i}\nPériode 1 EDU2G1-02\nPériode 3 EDU2G1-02' for i in range(1, 10)))
        (tmp / 'groupe.txt').write_text('Secondaire 2 Groupe 02\nAlice Tremblay\nBenoît Roy\nCamille Gagnon\nDavid Martin\nÉmilie Fortin\nFélix Morin\nGabrielle Côté\nHugo Dubois')
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page()
        errors, dialogs = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: (dialogs.append(d.message), d.accept()))
        # These checks exercise the document parser and UI, not remote OCR libraries.
        page.route('https://**/*', lambda r: r.abort())
        url = f'http://127.0.0.1:{server.server_port}/'
        page.goto(url, wait_until='networkidle')
        page.get_by_role('button', name='Paramètres', exact=True).click()
        check(page, """(()=>{
          const names=Array.from({length:20},(_,i)=>'Nom'+String.fromCharCode(97+i)+', Prénom'+String.fromCharCode(97+i));
          const text=['Education physique','EDU4G2-02','Enseignant Exemple','Page 1 de 1',...names,'mozaikportail.ca'].join('\\n');
          const groups=parseGroupDocuments([{file:{name:'liste-mozaik.png'},text,confidence:95,engine:'Photo'}]);
          return groups.length===1&&groups[0].students.length===20&&groups[0].sourceCodes[0]==='EDU4G2-02'&&groups[0].students.every(s=>!s.name.includes('Enseignant')&&!s.name.includes('Education'));
        })()""")
        page.locator('#teacherScheduleFile').set_input_files(str(tmp / 'horaire.txt'))
        page.wait_for_function('setupFiles.teacherSchedule')
        check(page, "Object.values(importedSetupData.teacherSchedule).flat().every(x=>!x.matchedGroupId)")
        page.locator('#schoolCalendarFile').set_input_files(str(tmp / 'calendrier.txt'))
        page.wait_for_function('setupFiles.schoolCalendar')
        assert page.locator('#generateScheduleBtn').is_disabled()
        page.locator('#groupSheetsFile').set_input_files(str(tmp / 'groupe.txt'))
        page.wait_for_function('!generateScheduleBtn.disabled')
        check(page, "Object.values(importedSetupData.teacherSchedule).flat().every(x=>x.matchedGroupId===groupsData[0].id)")
        check(page, 'groupsData[0].students.length===8')
        check(page, 'mergeImportedGroups([groupsData[0],groupsData[0]],groupsData).length===1')
        page.locator('#generateScheduleBtn').click()
        page.wait_for_function("document.getElementById('home').classList.contains('active')")
        check(page, "scheduleEntries['2026-08-31'].length===2 && !scheduleEntries['2026-12-25'] && !scheduleEntries['2026-11-20']")
        check(page, "getGroupCourseDates(groupsData[0].id).length===Object.values(scheduleEntries).flat().length")
        # Cognitive intervention is visible but must not consume a planned PE session.
        page.evaluate("scheduleEntries['2026-08-31'].push({...scheduleEntries['2026-08-31'][0],time:'10 h 55',endTime:'11 h 15',durationMinutes:20,period:null,kind:'cognitive',activity:'Intervention cognitive'});rebuildPlanningAssignments()")
        check(page, "getGroupCourseOccurrences(groupsData[0].id).length===Object.values(scheduleEntries).flat().length-1")
        page.evaluate("openCourseEntry('2026-08-31',2)")
        assert 'Intervention cognitive' in page.locator('#courseSessionTitle').inner_text()
        assert 'ne compte pas' in page.locator('#coursePlanContent').inner_text()
        assert page.get_by_role('button', name='Préparer cette séance', exact=True).count()==0
        check(page, "scheduleEntries['2026-08-31'][2].annualPlan===null")
        # Annual sessions must occupy both periods of the same date in order.
        page.evaluate("""() => {
          const g=groupsData[0]; annualPlans[g.id]=[{id:'annual-test',comp:'C2',sport:'Ultimate',courses:3}];
          const sequence=makeSequence({comp:'C2',sport:'Ultimate',groupId:g.id,groupName:g.name,count:3,duration:'70 min',annualBlockId:'annual-test',useHenri:true});
          setSavedSequence(g.id,'annual-test',sequence);rebuildPlanningAssignments();
        }""")
        check(page, "scheduleEntries['2026-08-31'][0].sessionIndex===0 && scheduleEntries['2026-08-31'][1].sessionIndex===1 && scheduleEntries['2026-09-01'][0].sessionIndex===2")
        page.evaluate("openDayPlan('2026-08-31')")
        page.locator('#dayPlanCourses .sessionLink').nth(1).click()
        page.get_by_role('button', name='Ouvrir la séance', exact=True).click()
        assert page.locator('#sessionEditor').is_visible()
        assert '2 sur 3' in page.locator('#editSessionMeta').inner_text()
        page.locator('#sessionEditor .back').click()
        assert page.locator('#dayPlan').is_visible()
        page.locator('#dayPlanCourses .sessionLink').first.click()
        page.get_by_role('button', name='Ouvrir la séquence', exact=True).click()
        assert page.locator('#sequenceEditor').is_visible()
        page.locator('#sequenceEditor .back').click()
        assert page.locator('#dayPlan').is_visible()
        # Insert an individual lesson only into period 3, leaving period 1 untouched.
        page.evaluate("openQuickSessionForCourse('2026-08-31',1);buildQuickSession()")
        page.get_by_role('button', name='Insérer dans l’horaire', exact=True).click()
        check(page, "!scheduleEntries['2026-08-31'][0].isIndividual && scheduleEntries['2026-08-31'][1].isIndividual && scheduleEntries['2026-09-01'][0].sessionIndex===1")
        page.evaluate("openCourseEntry('2026-08-31',1)")
        page.get_by_role('button', name='Ouvrir la séance', exact=True).click()
        page.evaluate("quickSessionData.objective='Objectif modifié depuis le calendrier'")
        page.locator('#sessionEditor .back').click()
        check(page, "scheduleEntries['2026-08-31'][1].planData.objective==='Objectif modifié depuis le calendrier'")
        # Independent sequence: exact start period, subsequent dates, reload and links.
        page.evaluate("""() => {
          const g=groupsData[0];activeSequence=makeSequence({comp:'C2',sport:'Badminton',groupId:g.id,groupName:g.name,count:2,duration:'70 min',useHenri:true});
          renderSequenceEditor();go('sequenceEditor');
        }""")
        key = page.evaluate("courseOccurrenceKey('2026-11-23',scheduleEntries['2026-11-23'][1])")
        page.evaluate('(key)=>document.getElementById("sequenceStartSlot").value=key', key)
        page.get_by_role('button', name='Placer dans le calendrier', exact=True).click()
        check(page, "scheduleEntries['2026-11-23'][1].annualPlan==='Badminton' && scheduleEntries['2026-11-24'][0].sessionIndex===1")
        page.reload(wait_until='networkidle')
        check(page, "scheduleEntries['2026-11-23'][1].annualPlan==='Badminton' && scheduleEntries['2026-08-31'][1].isIndividual")
        page.evaluate("openCourseEntry('2026-11-23',1)")
        page.get_by_role('button', name='Ouvrir la séquence', exact=True).click()
        assert page.locator('#sequenceEditor').is_visible()
        # Blocking a sequence's start moves it to the next available course without losing it.
        page.evaluate("calendarExceptions.push({id:'test',startDate:'2026-11-23',endDate:'2026-11-23',groupId:groupsData[0].id,type:'Sortie'});rebuildPlanningAssignments()")
        check(page, "getVisibleScheduleEntries('2026-11-23').length===0 && scheduleEntries['2026-11-24'][0].annualPlan==='Badminton'")
        page.evaluate("calendarExceptions=[];rebuildPlanningAssignments()")
        # A missing weekday prevents generation instead of silently inventing a date.
        page.evaluate("delete importedSetupData.schoolCalendar['2026-11-23'];go('settings');updateGenerateState()")
        assert page.locator('#generateScheduleBtn').is_disabled()
        assert 'dates de semaine' in page.locator('#importLinksReview').inner_text()
        # Failed imports preserve the previous usable source.
        (tmp / 'invalid.txt').write_text('aucun horaire ici')
        page.locator('#teacherScheduleFile').set_input_files(str(tmp / 'invalid.txt'))
        page.wait_for_function("teacherScheduleState.textContent==='Import précédent conservé'")
        check(page, "setupFiles.teacherSchedule && Object.keys(importedSetupData.teacherSchedule).length===9")
        assert not errors, errors
        print('PASS imports in any order, annual generation, holidays, multiple periods, session/sequence links, exact placement, editing, persistence and incomplete/failed imports.')
        browser.close()
finally:
    server.shutdown()
    server.server_close()
