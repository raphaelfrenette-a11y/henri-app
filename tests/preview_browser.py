"""Verify that preview updates preserve prior test data and isolate production."""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from functools import partial
from tempfile import TemporaryDirectory
from threading import Thread
import importlib.util
import sys
sys.dont_write_bytecode = True
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('preview_builder', ROOT / 'scripts/build-preview.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)
class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *args): pass

with TemporaryDirectory() as temporary:
    builder.build(Path(temporary) / 'preview/refonte')
    server = ThreadingHTTPServer(('127.0.0.1',0), partial(Quiet,directory=temporary))
    Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
            page = browser.new_page()
            page.route('https://**/*',lambda r:r.abort())
            errors = []
            page.on('pageerror',lambda e:errors.append(str(e)))
            page.goto(f'http://127.0.0.1:{server.server_port}/preview/refonte/',wait_until='networkidle')
            page.evaluate("""async () => {
              localStorage.setItem('henriGroupsData','production-sentinel');
              localStorage.setItem('henriAnnualPlans','plans-sentinel');
              localStorage.setItem('previewHenriSlate:henriGroupsData',JSON.stringify([{id:'previous-group',name:'Groupe fictif conservé',students:[{id:'previous-student',name:'Élève fictif',skill:4,gender:'U',leader:true,compatible:[],incompatible:[]}]}]));
              localStorage.setItem('previewHenriSlate:henriAnnualPlans',JSON.stringify({'previous-group':[{id:'previous-plan',comp:'C2',sport:'Badminton',courses:5}]}));
              await henriBankPut({id:'previous-bank',type:'sequence',title:'Séquence précédente',sequence:{sport:'Ultimate',sessions:[{title:'Séance fictive',blocks:[]} ]}});
            }""")
            page.reload(wait_until='networkidle')
            assert page.evaluate("groupsData[0].id==='previous-group' && groupsData[0].students[0].skill===4 && annualPlans['previous-group'][0].id==='previous-plan'")
            assert page.evaluate("localStorage.getItem('henriGroupsData')==='production-sentinel' && localStorage.getItem('henriAnnualPlans')==='plans-sentinel'")
            assert page.evaluate("(async()=>!!(await henriBankGet('previous-bank')))()")
            names = page.evaluate('(async()=> (await indexedDB.databases()).map(db=>db.name))()')
            assert 'preview-henri-slate-planning-bank-v1' in names
            assert 'henri-planning-bank-v1' not in names
            assert page.locator('.previewNotice').is_visible()
            illustration = page.locator('.homeEmptyIllustration use').get_attribute('href')
            assert illustration.startswith('henri-illustrations.svg?v=') and illustration.endswith('#start')
            assert not errors, errors
            print('PASS preview update preserves groups, pupil profiles, annual plans and bank; production storage stays untouched.')
            browser.close()
    finally:
        server.shutdown()
        server.server_close()
