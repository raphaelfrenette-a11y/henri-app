"""UX regression checks; synthetic pupils only. Requires Playwright and Chromium."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

server = ThreadingHTTPServer(('127.0.0.1', 0), partial(Quiet, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':1440, 'height':1000})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: d.accept())
        page.route('https://**/*', lambda r: r.abort())
        page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='networkidle')
        assert page.locator('#nextCourse').is_hidden()
        assert page.locator('#homeEmpty').is_visible()
        page.evaluate("""() => {
          groupsData=[{id:'test-a',name:'Secondaire 2 · Groupe 01',students:Array.from({length:24},(_,i)=>({id:'student-'+i,name:'Élève exemple '+(i+1),gender:'U',skill:3,leader:i<3,compatible:[],incompatible:[]}))},{id:'test-b',name:'Secondaire 4 · Groupe 02',students:[]}];
          const now=new Date();now.setDate(now.getDate()+1);
          const date=dateKey(now.getFullYear(),now.getMonth(),now.getDate());
          window.testDate=date;
          schoolDays[date]='Jour 2';
          scheduleEntries[date]=[{time:'8 h 10',endTime:'9 h 20',period:1,kind:'course',group:groupsData[0].name,matchedGroupId:'test-a'}, {time:'10 h 55',endTime:'11 h 15',kind:'cognitive',group:groupsData[0].name,matchedGroupId:'test-a'}, {time:'12 h 35',endTime:'13 h 45',period:3,kind:'course',group:groupsData[1].name,matchedGroupId:'test-b'}];
          annualPlans={'test-a':[{id:'annual-a',sport:'Badminton',comp:'C2',courses:1}], 'test-b':[{id:'annual-b',sport:'Ultimate',comp:'C2',courses:1}]};
          fillPlanGroupSelects();renderGroups();fillTeamBuilderGroups();saveGroups();rebuildPlanningAssignments();goHome();
        }""")
        assert page.locator('#nextCourseGroup').inner_text() == 'Secondaire 2 · Groupe 01'
        page.locator('#nextCourseOpen').click()
        assert page.locator('#courseDetail').is_visible()
        assert page.locator('#courseDetailGroup').inner_text() == 'Secondaire 2 · Groupe 01'
        # A blocked course is not featured; cognitive slots are not featured either.
        page.evaluate("calendarExceptions=[{id:'blocked',startDate:testDate,endDate:testDate,groupId:'test-a',type:'Sortie'}];rebuildPlanningAssignments();goHome()")
        assert page.locator('#nextCourseGroup').inner_text() == 'Secondaire 4 · Groupe 02'
        page.evaluate("calendarExceptions=[];rebuildPlanningAssignments()")
        page.locator('.nav[data-screen="groups"]').click()
        page.locator('#groupList .groupCard').first.click()
        assert page.locator('.nav[data-screen="groups"]').get_attribute('aria-current') == 'page'
        page.locator('#groupProfile .back').click()
        assert page.locator('#groups').is_visible()
        # Rebuilding options must retain a teacher's selected group.
        page.evaluate("quickGroup.value='test-b';fillPlanGroupSelects()")
        assert page.locator('#quickGroup').input_value() == 'test-b'
        page.evaluate('openQuickSession()')
        assert page.locator('label[for="quickSport"]').count() == 1
        assert page.locator('#quickSport').is_visible()
        assert page.locator('.henriSelectWrap').count() == 0
        page.locator('#quickSport').focus()
        page.keyboard.press('Home')
        page.keyboard.press('ArrowDown')
        page.keyboard.press('Tab')
        assert page.locator('#quickSport').input_value() == 'Basketball'
        page.evaluate('openTeamBuilder()')
        page.locator('#teamSkillToggle').click()
        page.wait_for_function("document.getElementById('teamSkillToggle').getAttribute('aria-checked')==='false'")
        page.locator('#teamGroupPicker').click()
        page.wait_for_function("document.activeElement.closest('[role=dialog]')")
        assert page.locator('.bottom').evaluate('(node)=>node.inert')
        page.locator('.pickerClose').focus()
        page.keyboard.press('Shift+Tab')
        assert page.locator('.pickerChoice').last.evaluate('(node)=>node===document.activeElement')
        page.keyboard.press('Escape')
        page.wait_for_function('document.activeElement.id === "teamGroupPicker"')
        assert not page.locator('.bottom').evaluate('(node)=>node.inert')
        page.locator('.teamGenerateBtn').click()
        assert page.locator('.generatedTeam').count() >= 2
        assert page.locator('.teamStudent').count() == 24
        page.evaluate("activeSequence=makeSequence({comp:'C2',sport:'Badminton',groupId:'test-a',groupName:groupsData[0].name,count:3,duration:'70 min',useHenri:true})")
        # Check horizontal overflow in actual working screens, not an empty shell.
        for width,height in [(1440,1000),(1194,834),(834,1112),(390,844),(320,700)]:
            page.set_viewport_size({'width':width,'height':height})
            for action in ["goHome()", "setCalendarView('month')", "go('plan')", "go('groups')", "openGroup('test-a')", "go('settings')", "toggleExceptionForm(true)", "openAnnualPlanner()", "openStandaloneSequence()", "renderSequenceEditor();go('sequenceEditor')", "openSessionEditor(0,'sequence')", "openQuickSession()", "openTeamBuilder()"]:
                page.evaluate(action)
                assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (width, action)
            page.locator('#teamGroupPicker').click()
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), (width, 'dialog')
            page.keyboard.press('Escape')
        page.emulate_media(reduced_motion='reduce')
        assert page.locator('#teamBuilder').evaluate("(node)=>getComputedStyle(node).animationName") == 'none'
        page.reload(wait_until='networkidle')
        assert page.evaluate("groupsData.length===2 && groupsData[0].students.length===24 && annualPlans['test-a'][0].sport==='Badminton'")
        assert not errors, errors
        print('PASS next course, blocked/cognitive exclusions, group navigation, selection preservation, native controls, labels, switches, dialog keyboard/focus, teams, five screen sizes, reduced motion and persistence.')
        browser.close()
finally:
    server.shutdown()
    server.server_close()
