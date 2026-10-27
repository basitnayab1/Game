from pathlib import Path
import json, re

ROOT = Path(__file__).resolve().parents[1]
report = {
    'dart_files': len(list((ROOT/'lib').rglob('*.dart'))),
    'backend_ts_files': len(list((ROOT/'backend').rglob('*.ts'))),
    'database_migrations': len(list((ROOT/'database/migrations').glob('*.sql'))),
    'missing_relative_imports': [],
    'final_languages': ['en','tr','hi','ur','ar'],
    'legacy_placeholder_hits': [],
}
for p in (ROOT/'lib').rglob('*.dart'):
    text=p.read_text(errors='ignore')
    for m in re.finditer(r"(?:import|export)\s+['\"](\.{1,2}/[^'\"]+)['\"]", text):
        target=(p.parent/m.group(1)).resolve()
        if not target.exists():
            report['missing_relative_imports'].append({'file':str(p.relative_to(ROOT)),'import':m.group(1)})
for root in [ROOT/'lib', ROOT/'backend']:
    for p in root.rglob('*'):
        if p.is_file() and p.suffix in {'.dart','.ts'}:
            text=p.read_text(errors='ignore').lower()
            for term in ['will be implemented in part', 'home-placeholder']:
                if term in text:
                    report['legacy_placeholder_hits'].append({'file':str(p.relative_to(ROOT)),'term':term})
report['status']='PASS' if not report['missing_relative_imports'] and not report['legacy_placeholder_hits'] else 'FAIL'
(ROOT/'docs/FINAL_STATIC_AUDIT.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
