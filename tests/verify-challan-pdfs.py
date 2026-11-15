from pathlib import Path
from pypdf import PdfReader
root=Path('artifacts/fee-verification')
checks=0
for name in ['classic','modern','minimal','columns']:
 reader=PdfReader(root/(name+'-verified.pdf'))
 assert len(reader.pages)==1,(name,len(reader.pages))
 text=reader.pages[0].extract_text()
 for label in ['SCHOOL COPY','BANK COPY','STUDENT COPY']:
  assert text.count(label)==1,(name,label)
 if name!='columns':
  assert text.count('4,950.00')==3
  assert text.count('Annual charge')==3
  assert text.count('Prior invoices (pay separately)')==3
 checks+=1
reader=PdfReader(root/'five-students-verified.pdf')
assert len(reader.pages)==5
for index,page in enumerate(reader.pages):
 assert abs(float(page.mediabox.width)-595.276)<0.1
 assert abs(float(page.mediabox.height)-841.89)<0.1
 text=page.extract_text()
 amount='3,500.00' if index<3 else '2,500.00'
 assert text.count(amount)>=3,(index,text)
 for label in ['SCHOOL COPY','BANK COPY','STUDENT COPY']:
  assert text.count(label)==1,(index,label)
 assert text.count('Fictional Student '+str(index+1))==3
 checks+=1
print(f'PASS: {checks} PDF pages checked for dimensions, copy labels, student identities and correct amounts.')
