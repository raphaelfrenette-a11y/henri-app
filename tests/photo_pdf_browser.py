"""Real photo OCR and text/scanned PDF imports using local verified libraries.
Usage: python3 tests/photo_pdf_browser.py /path/to/npm/dependency/directory
Dependencies: tesseract.js@5.1.1, pdfjs-dist@3.11.174,
@tesseract.js-data/fra@1.0.0, @tesseract.js-data/eng@1.0.0.
Python: Playwright, Pillow, reportlab; system Chromium.
"""
import base64
import json
import shutil
import subprocess
import sys
from functools import partial
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from tempfile import TemporaryDirectory
from threading import Thread
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen.canvas import Canvas
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
dependencies = Path(sys.argv[1]).resolve()


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_):
        pass


server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT)))
Thread(target=server.serve_forever, daemon=True).start()
try:
    with TemporaryDirectory() as temporary, sync_playwright() as p:
        tmp = Path(temporary)
        lang = tmp / 'lang'
        lang.mkdir()
        for language in ['fra', 'eng']:
            shutil.copyfile(dependencies / 'node_modules' / '@tesseract.js-data' / language / '4.0.0' / (language+'.traineddata.gz'), lang / (language+'.traineddata.gz'))
        runner = tmp / 'ocr.cjs'
        runner.write_text('''const {createWorker}=require(process.argv[2]);
(async()=>{const worker=await createWorker('fra+eng',1,{langPath:process.argv[3],cachePath:process.argv[3]});
try{const result=await worker.recognize(process.argv[4]);process.stdout.write(JSON.stringify({data:{text:result.data.text,confidence:result.data.confidence,words:result.data.words}}));}finally{await worker.terminate();}})().catch(e=>{console.error(e);process.exitCode=1;});''')
        lines = ['Secondaire 2 Groupe 02','Alice Tremblay','Benoit Roy','Camille Gagnon','David Martin','Emilie Fortin','Felix Morin','Gabrielle Cote','Hugo Dubois']
        image = Image.new('RGB', (1200, 720), 'white')
        draw = ImageDraw.Draw(image)
        font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 36)
        for i, text in enumerate(lines):
            draw.text((40, 30+65*i), text, font=font, fill='black')
        image.save(tmp / 'groupe.png')
        image.save(tmp / 'groupe-scan.pdf', 'PDF')
        pdf = Canvas(str(tmp / 'horaire.pdf'))
        for day in [1, 2]:
            for i, text in enumerate([f'Jour {day}', 'Periode 1 EDU2G1-02', 'Periode 3 EDU2G1-02']):
                pdf.drawString(50, 760-i*40, text)
            pdf.showPage()
        pdf.save()
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        page = browser.new_page()
        errors, dialogs = [], []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('dialog', lambda d: (dialogs.append(d.message), d.accept()))
        page.route('https://**/*', lambda r: r.abort())
        page.route('**/pdf.worker.min.js', lambda r: r.fulfill(path=str(dependencies / 'node_modules/pdfjs-dist/build/pdf.worker.min.js'), content_type='application/javascript'))
        page.goto(f'http://127.0.0.1:{server.server_port}/', wait_until='networkidle')
        page.add_script_tag(path=str(dependencies / 'node_modules/pdfjs-dist/build/pdf.min.js'))
        assert page.evaluate("""()=>{
          const word=(text,x,y)=>({text,confidence:90,bbox:{x0:x,y0:y,x1:x+35,y1:y+15}});
          const complete={data:{text:'Jour 1 Jour 2 EDU4G2-02',confidence:65,words:[word('Jour 1',0,100),word('Jour 2',0,200),word('P1',200,0),word('EDU4G2-02',200,100)]}};
          const incomplete={data:{text:'Enseignant Education physique',confidence:99,words:[]}};
          return aiOCRScore(complete,'teacherSchedule')>aiOCRScore(incomplete,'teacherSchedule');
        }""")

        def recognize(data_url):
            (tmp / 'prepared.png').write_bytes(base64.b64decode(data_url.split(',', 1)[1]))
            result = subprocess.run(['node', str(runner), str(dependencies / 'node_modules/tesseract.js'), str(lang), str(tmp / 'prepared.png')], capture_output=True, text=True, check=True)
            return json.loads(result.stdout)

        # Browser canvas preprocessing and imports use real OCR in a local Node worker.
        # Only worker transport differs; no mock recognition text or TLS bypass is used.
        page.expose_function('recognizeLocally', recognize)
        page.evaluate("window.ocrPassCount=0;window.Tesseract={recognize:(source)=>{ocrPassCount++;return window.recognizeLocally(source.toDataURL('image/png'))}}")
        page.get_by_role('button', name='Paramètres', exact=True).click()
        page.locator('#groupSheetsFile').set_input_files(str(tmp / 'groupe.png'))
        page.wait_for_function('setupFiles.groupSheets', timeout=120000)
        assert page.evaluate('groupsData.length===1 && groupsData[0].students.length===8')
        assert page.evaluate('ocrPassCount===3')
        original_id = page.evaluate('groupsData[0].id')
        page.locator('#teacherScheduleFile').set_input_files(str(tmp / 'horaire.pdf'))
        page.wait_for_function('setupFiles.teacherSchedule', timeout=60000)
        assert page.evaluate("Object.keys(importedSetupData.teacherSchedule).length===2 && Object.values(importedSetupData.teacherSchedule).flat().every(x=>x.matchedGroupId===groupsData[0].id)")
        page.locator('#groupSheetsFile').set_input_files(str(tmp / 'groupe-scan.pdf'))
        page.wait_for_function("groupSheetsState.textContent.includes('importé')", timeout=120000)
        assert page.evaluate('groupsData.length===1 && groupsData[0].students.length===8')
        assert page.evaluate('groupsData[0].id') == original_id
        page.evaluate('openHenriBank()')
        page.locator('.henriBankPdfImport input').set_input_files(str(tmp / 'horaire.pdf'))
        page.wait_for_function("(async()=> (await henriBankAll()).some(item=>item.type==='pdf'&&item.sourceText.includes('Jour 1')&&item.sourceText.includes('Jour 2')))()",timeout=60000)
        assert page.evaluate("!henriBankClone({startCourseKey:'2026-11-23|P1',courseKey:'2026-11-23|P1'}).startCourseKey")
        assert not errors, errors
        assert not dialogs, dialogs
        print('PASS real photo preprocessing/OCR, multi-page text PDF, scanned PDF OCR, stable group identity, timetable associations, PDF bank text and detached reuse.')
        browser.close()
finally:
    server.shutdown()
    server.server_close()
