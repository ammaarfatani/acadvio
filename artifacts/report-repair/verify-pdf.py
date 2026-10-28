import pypdfium2 as pdfium
from pypdf import PdfReader
from pathlib import Path
p=Path('artifacts/report-repair/annual-weighted-verification.pdf')
r=PdfReader(p);print('PDF pages:',len(r.pages));text='\n'.join(x.extract_text() for x in r.pages);assert '86.00%' in text;assert 'WEIGHTED' in text;print('PASS: PDF contains authoritative 86.00% weighted result.')
d=pdfium.PdfDocument(p);d[0].render(scale=1.5).to_pil().save(p.with_suffix('.png'))
