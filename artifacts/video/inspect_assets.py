from pathlib import Path
from PIL import Image, ImageDraw
root=Path(__file__).resolve().parents[2]
files=list((root/'artifacts/video').glob('*.jpg'))+list((root/'public/product-showcase').glob('*.jpg'))
sheet=Image.new('RGB',(1200,((len(files)+2)//3)*280),'#eeeeee')
d=ImageDraw.Draw(sheet)
for n,p in enumerate(files):
 im=Image.open(p); print(p.name,im.size)
 im.thumbnail((390,245)); x=(n%3)*400; y=(n//3)*280
 sheet.paste(im,(x,y+25)); d.text((x+5,y+5),p.name,fill='black')
sheet.save(root/'artifacts/video/asset-review.jpg')
