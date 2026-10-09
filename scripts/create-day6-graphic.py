from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import base64, json, html
ROOT=Path('D:/CRM/school-crm')
OUT=ROOT/'artifacts/linkedin/day-06'
OUT.mkdir(parents=True,exist_ok=True)
FONT='C:/Windows/Fonts/arial.ttf'
BOLD='C:/Windows/Fonts/arialbd.ttf'
files=[]
for folder in ['public/product-showcase','artifacts/ui-review','artifacts/video','artifacts/parent-portal','artifacts/school-audit','artifacts/organization','artifacts/trial-approval']:
 files += [p for p in (ROOT/folder).glob('*') if p.suffix.lower() in ['.png','.jpg','.jpeg']]
for page in range((len(files)+11)//12):
 sheet=Image.new('RGB',(1440,1200),'#ececea');draw=ImageDraw.Draw(sheet)
 for i,p in enumerate(files[page*12:(page+1)*12]):
  im=Image.open(p).convert('RGB');im.thumbnail((460,260))
  x,y=(i%3)*480+10,(i//3)*300+10;sheet.paste(im,(x,y));draw.text((x,y+264),str(p.relative_to(ROOT)),font=ImageFont.truetype(FONT,14),fill='#111111')
 sheet.save(OUT/f'asset-review-{page+1}.jpg',quality=92)
(OUT/'asset-inventory.json').write_text(json.dumps([str(p.relative_to(ROOT)) for p in files],indent=2))
print(len(files),'assets inventoried')
