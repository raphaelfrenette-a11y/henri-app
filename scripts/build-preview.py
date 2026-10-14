"""Build the isolated GitHub Pages preview; never modifies root production files.

Usage: python3 scripts/build-preview.py /path/to/publishing-checkout/preview/refonte
The output retains the existing preview storage namespace across updates.
"""
from pathlib import Path
import json
import re
import subprocess
import sys

SOURCE = Path(__file__).resolve().parents[1]
FILES = ['index.html', 'henri-v560.html', 'henri-design.css', 'henri-layout.css',
         'henri-ux.js', 'henri-visuals.js', 'henri-pedagogy.js', 'henri-planning.js', 'henri-import.js', 'henri-calendar-links.js',
         'henri-bank-v1.js', 'henri-icon.svg', 'henri-illustrations.svg']

def build(destination):
    if destination.resolve() == SOURCE:
        raise ValueError('La prévisualisation doit avoir son propre dossier.')
    commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=SOURCE, text=True).strip()
    keys = {'henriAnnualBankId:', 'henriDemoSchedule', 'henriSetupComplete',
            'henriTeamHistory', 'henriScheduleConflictIgnores'}
    for filename in FILES:
        text = (SOURCE / filename).read_text()
        keys.update(re.findall(r"localStorage\.(?:getItem|setItem|removeItem)\(['\"](henri[^'\"]+)['\"]", text))
    destination.mkdir(parents=True, exist_ok=True)
    for filename in FILES:
        text = (SOURCE / filename).read_text()
        if filename.endswith(('.js', '.html')):
            for key in sorted(keys, key=len, reverse=True):
                for quote in ["'", '"']:
                    text = text.replace(quote + key + quote, quote + 'previewHenriSlate:' + key + quote)
            text = text.replace("'henri-planning-bank-v1'", "'preview-henri-slate-planning-bank-v1'")
        if filename == 'henri-v560.html':
            text = text.replace('<title>Henri</title>', '<title>Henri · Prévisualisation</title>')
            text = text.replace('<main id="mainContent" tabindex="-1">', '<main id="mainContent" tabindex="-1"><div class="previewNotice" role="note"><strong>Prévisualisation de la refonte</strong><span>Les données de test sont séparées du site habituel.</span><a href="../../" target="_blank" rel="noopener">Ouvrir le site actuel ↗</a></div>')
        if filename == 'henri-design.css':
            text += '\n.previewNotice{max-width:1040px;margin:0 auto 28px;padding:12px 16px;border:1px solid var(--line);border-radius:10px;background:var(--card);display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;font-size:12px;color:var(--muted)}.previewNotice strong{color:var(--accent);font-size:12px}.previewNotice a{color:var(--accent);margin-left:auto;min-height:32px;display:flex;align-items:center}@media(max-width:699px){.previewNotice{display:block}.previewNotice span{display:block;margin-top:6px}.previewNotice a{margin-top:6px}}\n'
        if filename.endswith(('.html', '.js')):
            for asset in FILES:
                if asset.endswith(('.css', '.js', '.svg')):
                    text = text.replace('="' + asset + '"', '="' + asset + '?v=' + commit[:8] + '"')
            text = text.replace('henri-illustrations.svg#', 'henri-illustrations.svg?v=' + commit[:8] + '#')
        (destination / filename).write_text(text)
    (destination / 'manifest.json').write_text(json.dumps({'sourceCommit': commit,
        'previewPath': 'preview/refonte/', 'storagePrefix': 'previewHenriSlate:', 'files': FILES}, indent=2) + '\n')
    (destination / 'README.md').write_text('Prévisualisation isolée de Henri, commit ' + commit + '.\n\n'
        'Les clés localStorage conservent le préfixe previewHenriSlate: et la banque IndexedDB conserve le nom preview-henri-slate-planning-bank-v1. Les données des essais précédents restent accessibles. Aucun fichier de production à la racine du dépôt n’est remplacé.\n')
    print('Prévisualisation construite :', destination)

if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    build(Path(sys.argv[1]))
