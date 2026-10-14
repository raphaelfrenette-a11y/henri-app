"""Full planning workflow through actual controls, using fictitious TXT imports."""
from pathlib import Path
from datetime import date, timedelta
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from tempfile import TemporaryDirectory
from threading import Thread
from playwright.sync_api import sync_playwright

ROOT=Path(__file__).resolve().parents[1]
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self,*args): pass

def check(page, expression):
    assert page.evaluate(expression),expression

server=ThreadingHTTPServer(('127.0.0.1',0),partial(Quiet,directory=str(ROOT)))
Thread(target=server.serve_forever,daemon=True).start()
try:
    with TemporaryDirectory() as temporary, sync_playwright() as p:
        tmp=Path(temporary)
        lines=[];day=date(2026,8,31);cycle=1
        while day<=date(2027,6,23):
            if day.weekday()<5:
                special='Congé' if day==date(2026,12,25) else 'Pédagogique' if day==date(2026,11,20) else None
                lines.append(f'{day.isoformat()} {special or "Jour "+str(cycle)}')
                if not special:cycle=cycle%9+1
            day+=timedelta(days=1)
        (tmp/'calendar.txt').write_text('\n'.join(lines))
        schedule=[]
        for i in range(1,10):
            schedule.extend([f'Jour {i}','Période 1 EDU2G1-01'])
            if i%2:schedule.append('Période 3 EDU4G2-02')
        (tmp/'teacher.txt').write_text('\n'.join(schedule))
        for name,heading in [('group1','Secondaire 2 Groupe 01'),('group2','Secondaire 4 Groupe 02')]:
            (tmp/f'{name}.txt').write_text(heading+'\n'+'\n'.join(['Alice Exemple','Benoît Exemple','Camille Exemple','David Exemple','Émilie Exemple','Félix Exemple','Gabrielle Exemple','Hugo Exemple']))
        browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
        page=browser.new_page(viewport={'width':1440,'height':1000})
        page.route('https://**/*',lambda r:r.abort())
        errors=[];answers=[];cancel_next=[False]
        page.on('pageerror',lambda e:errors.append(str(e)))
        def dialog(d):
            if cancel_next[0]:cancel_next[0]=False;d.dismiss()
            elif d.type=='prompt':d.accept(answers.pop(0) if answers else d.default_value)
            else:d.accept()
        page.on('dialog',dialog)
        page.goto(f'http://127.0.0.1:{server.server_port}/',wait_until='networkidle')
        page.get_by_role('button',name='Paramètres',exact=True).click()
        page.locator('#teacherScheduleFile').set_input_files(str(tmp/'teacher.txt'))
        page.wait_for_function('setupFiles.teacherSchedule')
        page.locator('#groupSheetsFile').set_input_files([str(tmp/'group1.txt'),str(tmp/'group2.txt')])
        page.wait_for_function('setupFiles.groupSheets && groupsData.length===2')
        page.locator('#schoolCalendarFile').set_input_files(str(tmp/'calendar.txt'))
        page.wait_for_function('!generateScheduleBtn.disabled')
        page.locator('#generateScheduleBtn').click()
        page.wait_for_function("document.getElementById('home').classList.contains('active')")
        check(page,"!scheduleEntries['2026-12-25'] && !scheduleEntries['2026-11-20'] && Object.keys(schoolDays).length>180")
        first,second=page.evaluate('groupsData.map(g=>g.id)')
        page.locator('.nav[data-screen="plan"]').click()
        page.locator('#plan .planMenuCard').first.click()
        page.locator('.annualBulk summary').click()
        page.get_by_role('button',name='Tous les groupes avec des périodes',exact=True).click()
        page.locator('#annualHenriModeBtn').click()
        page.wait_for_function('!planningActionBusy && Object.values(annualPlans).every(blocks=>blocks.length>0)')
        check(page,"groupsData.every(g=>annualPlans[g.id].reduce((n,b)=>n+b.courses,0)===getGroupCourseSlots(g.id))")
        check(page,"groupsData.every(g=>annualPlans[g.id].filter(b=>b.comp==='C1').length<=1 && annualPlans[g.id].filter(b=>b.comp==='C2').length>annualPlans[g.id].filter(b=>b.comp==='C3').length)")
        check(page,"getGroupCourseSlots(groupsData[0].id)!==getGroupCourseSlots(groupsData[1].id)")
        second_before=page.evaluate('(id)=>JSON.stringify(annualPlans[id])',second)
        page.get_by_role('button',name='Seulement le groupe affiché',exact=True).click()
        page.locator('#annualManualModeBtn').click()
        page.locator('#annualSequenceCount').fill('10')
        page.locator('#annualBuildBtn').click()
        page.wait_for_function('!planningActionBusy && annualPlans[annualGroup.value].length===10')
        assert page.evaluate('(id)=>JSON.stringify(annualPlans[id])',second)==second_before
        check(page,"annualPlans[annualGroup.value].every(b=>b.comp==='C2') && Number(annualRemaining.textContent)===0")
        page.locator('.nav[data-screen="plan"]').click()
        page.locator('#plan .planMenuCard').first.click()
        assert page.locator('#annualWorkspace').is_visible()
        assert page.locator('#annualList .annualItem').count()==10
        page.get_by_role('button',name='Enregistrer ma planification annuelle',exact=True).click()
        assert page.locator('#macroSequenceList .macroSeqCard').count()==10
        page.locator('#macroSequenceList .macroSeqCard').first.click()
        page.locator('#macroSport').select_option('Badminton')
        page.locator('#macroCount').fill('4')
        page.locator('#sequenceChoice button[onclick="createSequenceFromMacro(true)"]').click()
        page.wait_for_function("document.getElementById('sequenceEditor').classList.contains('active')")
        check(page,"activeSequence.sessions.length===4 && activeSequence.sessions.every(s=>s.blocks.every(b=>b.notes.length>20))")
        block=page.evaluate('activeSequence.annualBlockId')
        page.locator('#sequenceLessons .seqNum').first.click()
        answers.extend(['Éducatif personnalisé','Consignes manuscrites à conserver','12'])
        page.locator('#editBlocks .editBlock').nth(1).get_by_role('button',name='Modifier',exact=True).click()
        check(page,"activeSequence.sessions[0].blocks[1].notes==='Consignes manuscrites à conserver'")
        answers.append('Éducatif supplémentaire')
        page.get_by_role('button',name='+ Ajouter une section',exact=True).click()
        assert page.locator('#editBlocks .editBlock').count()==5
        page.locator('#editBlocks .editBlock').last.get_by_role('button',name='Supprimer',exact=True).click()
        page.wait_for_function('activeSequence.sessions[0].blocks.length===4')
        page.locator('#sessionEditor .back').click()
        page.get_by_role('button',name='Enregistrer la séquence',exact=True).click()
        page.wait_for_function("document.getElementById('henriActionStatus').textContent.startsWith('Séquence enregistrée')")
        page.locator('.nav[data-screen="plan"]').click();page.locator('#plan .planMenuCard').first.click()
        page.locator(f'#annual-comp-{block}').click()
        page.locator(f'#annual-comp-{block}').select_option('C3')
        page.wait_for_function("getSavedSequence(annualGroup.value,annualPlans[annualGroup.value][0].id).comp==='C3'")
        check(page,"getSavedSequence(annualGroup.value,annualPlans[annualGroup.value][0].id).sessions[0].blocks[1].notes==='Consignes manuscrites à conserver'")
        page.locator('#annualList .annualItem').first.get_by_role('button',name='Ajouter un cours',exact=True).click()
        page.wait_for_function("getSavedSequence(annualGroup.value,annualPlans[annualGroup.value][0].id).sessions.length===5")
        cancel_next[0]=True
        page.locator('#annualList .annualItem').first.get_by_role('button',name='Retirer un cours',exact=True).click()
        check(page,"getSavedSequence(annualGroup.value,annualPlans[annualGroup.value][0].id).sessions.length===5")
        page.locator('#annualList .annualItem').first.get_by_role('button',name='Retirer un cours',exact=True).click()
        page.wait_for_function("getSavedSequence(annualGroup.value,annualPlans[annualGroup.value][0].id).sessions.length===4")
        page.locator('#annualList .annualItem').first.locator('.annualReorder button').last.click()
        check(page,"annualPlans[annualGroup.value][1].id===activeSequence.annualBlockId")
        page.get_by_role('button',name='Compléter les périodes restantes',exact=True).click()
        check(page,'Number(annualRemaining.textContent)===0')
        page.get_by_role('button',name='Enregistrer ma planification annuelle',exact=True).click()
        page.locator('#macroSequenceList .macroSeqCard').first.click()
        page.locator('#macroSport').select_option('Volleyball');page.locator('#macroCount').fill('3')
        page.locator('#sequenceChoice button[onclick="createSequenceFromMacro(false)"]').click()
        page.wait_for_function("document.getElementById('sequenceEditor').classList.contains('active')")
        check(page,"activeSequence.sessions.length===3 && activeSequence.objective==='' && activeSequence.sessions.every(s=>s.objective===''&&s.blocks.every(b=>b.title===''&&b.notes===''))")
        # Calendar links open the correct saved lesson and persist a teacher's changes.
        page.locator('#sequenceLessons .seqNum').first.click()
        answers.extend(['Échauffement maison','Activité écrite par le professeur','7'])
        page.locator('#editBlocks .editBlock').first.get_by_role('button',name='Modifier',exact=True).click()
        page.locator('#sessionEditor .back').click()
        page.get_by_role('button',name='Enregistrer la séquence',exact=True).click()
        page.wait_for_function("document.getElementById('henriActionStatus').textContent.startsWith('Séquence enregistrée')")
        slot=page.evaluate('getSequenceOccurrences(activeSequence)[0]')
        page.evaluate('(slot)=>openCourseEntry(slot.date,slot.index)',slot)
        page.get_by_role('button',name='Ouvrir la séance',exact=True).click()
        assert 'Activité écrite par le professeur' in page.locator('#editBlocks').inner_text()
        page.locator('#sessionEditor .back').click()
        assert page.locator('#dayPlan').is_visible()
        page.reload(wait_until='networkidle')
        check(page,"Object.values(savedSequences).some(s=>s.sessions?.some(ss=>ss.blocks.some(b=>b.notes==='Consignes manuscrites à conserver'))) && Object.values(savedSequences).some(s=>s.sessions?.some(ss=>ss.blocks.some(b=>b.notes==='Activité écrite par le professeur')))")
        check(page,"(async()=> (await henriBankAll()).some(item=>item.mode==='Copie avant modification'&&item.sequence?.sessions?.some(s=>s.blocks.some(b=>b.notes==='Consignes manuscrites à conserver'))))()")
        page.evaluate("openMacroSequence(groupsData[0].id,annualPlans[groupsData[0].id][0].id);continueSavedSequence()")
        stored=page.evaluate("JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k=>/henriAnnualPlans$|henriSequences$|henriActiveSequence$/.test(k)).map(k=>[k,localStorage.getItem(k)])))")
        page.evaluate("() => {window.originalStorageSet=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(String(key).endsWith('henriSequences'))throw new DOMException('Storage full','QuotaExceededError');return originalStorageSet.call(this,key,value)};}")
        page.get_by_role('button',name='Enregistrer la séquence',exact=True).click()
        page.wait_for_function("document.getElementById('henriActionStatus').textContent.startsWith('Action non confirmée')")
        assert page.evaluate("JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k=>/henriAnnualPlans$|henriSequences$|henriActiveSequence$/.test(k)).map(k=>[k,localStorage.getItem(k)])))")==stored
        page.evaluate('() => {Storage.prototype.setItem=originalStorageSet;}')
        page.get_by_role('button',name='Enregistrer la séquence',exact=True).click()
        page.wait_for_function("document.getElementById('henriActionStatus').textContent.startsWith('Séquence enregistrée')")
        # Real populated screens, including large counts and native editing controls.
        for width,height in [(1440,1000),(834,1112),(390,844),(320,700)]:
            page.set_viewport_size({'width':width,'height':height})
            for action in ['openAnnualPlanner()', 'openSequenceSetup()', "openMacroSequence(groupsData[0].id,annualPlans[groupsData[0].id][0].id)", 'continueSavedSequence()', "openSessionEditor(0,'sequence')", "go('settings')"]:
                page.evaluate(action)
                assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(width,action)
        assert not errors,errors
        print('PASS full TXT imports, annual calendar, multi-group recommendation, manual 10 C2 blocks, reopen/save without sports, editable Henri and blank templates, cancellation/archive, period counts, reorder, calendar links, persistence and responsive planning.')
        browser.close()
finally:server.shutdown();server.server_close()
