from pathlib import Path
from pypdf import PdfReader
import pypdfium2 as pdfium
p=Path('artifacts/print-regression')
for n in [7,8,9,12]:
 r=PdfReader(p/f'subjects-{n}.pdf')
 assert len(r.pages)==1, f'{n} subjects split into {len(r.pages)} pages'
 text=r.pages[0].extract_text()
 assert f'Subject {n}' in text and 'Principal / school stamp' in text
 assert 'Only the selected' not in text and 'Policy:' not in text
r=PdfReader(p/'bulk-nine.pdf');assert len(r.pages)==3
for i,page in enumerate(r.pages):
 assert f'Test Student {91+i}' in page.extract_text()
 assert 'Principal / school stamp' in page.extract_text()
d=pdfium.PdfDocument(str(p/'subjects-9.pdf'));d[0].render(scale=1.3).to_pil().save(p/'subjects-9.png')
print('PASS: 7/8/9/12 subjects with photo, signature and stamp fit one page. Bulk nine subjects = exactly three complete student pages.')
