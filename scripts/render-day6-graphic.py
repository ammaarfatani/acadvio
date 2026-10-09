# Pixel-preserving composition: editable vector typography + original screenshot rasters.
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import base64, html, json, io
ROOT=Path('D:/CRM/school-crm'); OUT=ROOT/'artifacts/linkedin/day-06'; OUT.mkdir(parents=True,exist_ok=True)
S=3; BG='#faf9f6'; INK='#161719'; RED='#df1427'; GRAY='#626266'; BORDER='#dededb'
canvas=Image.new('RGBA',(1200*S,1200*S),BG); d=ImageDraw.Draw(canvas)
svg=['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="1200" height="1200" viewBox="0 0 1200 1200">', '<title>Day 06 / Building Acadvio — From Features to Experience.</title>', '<desc>Actual Acadivo school overview and examination screenshots. Account and institution identity regions are masked for publication. No UI or numerical data has been recreated.</desc>', '<defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="10" stdDeviation="13" flood-color="#252525" flood-opacity="0.12"/></filter><filter id="frontshadow" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="12" stdDeviation="15" flood-color="#222222" flood-opacity="0.18"/></filter></defs>', f'<rect width="1200" height="1200" fill="{BG}"/>']
regular='C:/Windows/Fonts/arial.ttf'; bold='C:/Windows/Fonts/arialbd.ttf'
def font(size,heavy=False):return ImageFont.truetype(bold if heavy else regular,round(size*S))
def text(x,y,value,size,color=INK,heavy=False,tracking=0):
 f=font(size,heavy)
 if tracking:
  cursor=x*S
  for c in value:d.text((cursor,y*S),c,font=f,fill=color,anchor='lt');cursor+=d.textlength(c,font=f)+tracking*S
 else:d.text((x*S,y*S),value,font=f,fill=color,anchor='lt')
 svg.append(f'<text x="{x}" y="{y}" dominant-baseline="text-before-edge" font-family="Arial, sans-serif" font-size="{size}" font-weight="{700 if heavy else 400}" letter-spacing="{tracking}" fill="{color}">{html.escape(value)}</text>')
def line(x1,y1,x2,y2,color,width=1):
 d.line((x1*S,y1*S,x2*S,y2*S),fill=color,width=round(width*S))
 svg.append(f'<path d="M{x1} {y1}L{x2} {y2}" stroke="{color}" stroke-width="{width}"/>')
def data(im):
 b=io.BytesIO();im.save(b,format='PNG');return 'data:image/png;base64,'+base64.b64encode(b.getvalue()).decode()
def paste(im,x,y,w,h):canvas.alpha_composite(im.convert('RGBA').resize((round(w*S),round(h*S)),Image.Resampling.LANCZOS),(round(x*S),round(y*S)))
def card(im,x,y,w,h,identity,front=False):
 radius=12; mask=Image.new('L',canvas.size);md=ImageDraw.Draw(mask);md.rounded_rectangle((x*S,(y+10)*S,(x+w)*S,(y+h+10)*S),radius=radius*S,fill=48 if front else 30);mask=mask.filter(ImageFilter.GaussianBlur((15 if front else 13)*S));layer=Image.new('RGBA',canvas.size,'#252525');layer.putalpha(mask);canvas.alpha_composite(layer)
 sized=im.convert('RGBA').resize((round(w*S),round(h*S)),Image.Resampling.LANCZOS);clip=Image.new('L',sized.size);ImageDraw.Draw(clip).rounded_rectangle((0,0,sized.width-1,sized.height-1),radius=radius*S,fill=255);sized.putalpha(clip);canvas.alpha_composite(sized,(round(x*S),round(y*S)));ImageDraw.Draw(canvas).rounded_rectangle((x*S,y*S,(x+w)*S,(y+h)*S),radius=radius*S,outline=BORDER,width=2)
 svg.append(f'<g id="{identity}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="white" filter="url(#{"frontshadow" if front else "shadow"})"/><clipPath id="clip-{identity}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}"/></clipPath><image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid meet" clip-path="url(#clip-{identity})" href="{data(im)}"/><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="none" stroke="{BORDER}"/></g>')
main=Image.open(ROOT/'public/product-showcase/school-admin.jpg').convert('RGB')
assert main.size==(1280,800)
# Clean solid masks, limited to account/institution identity; no replacement UI or numbers.
md=ImageDraw.Draw(main)
for rect,color in [((1085,8,1258,58),'#ffffff'),((20,65,245,104),'#ffffff'),((283,94,658,116),'#f7f8fa')]:md.rectangle(rect,fill=color)
main.save(OUT/'school-overview-publication.png')
exam=Image.open(ROOT/'public/product-showcase/examination.jpg').convert('RGB')
# Crop only the genuine exam heading, counts and quick-action workflow; exclude identity header and activity log.
exam=exam.crop((270,84,1250,490));exam.save(OUT/'examination-workflow-excerpt.png')
logo=Image.open(ROOT/'public/logo.png').convert('RGBA');logo=logo.crop(logo.getbbox());lw=190;lh=lw*logo.height/logo.width;paste(logo,938,58,lw,lh);svg.append(f'<image id="original-acadivo-logo" x="938" y="58" width="{lw}" height="{lh}" href="{data(logo)}"/>')
line(72,86,104,86,RED,2)
text(117,77,'DAY 06 / BUILDING ACADVIO',16,RED,True,2)
text(72,135,'From Features',78,INK,True)
text(72,223,'to ',78,INK,True)
to_width=d.textlength('to ',font(78,True))/S
text(72+to_width,223,'Experience.',78,RED,True)
text(72,319,'Building a more connected school management workflow.',25,GRAY)
text(72,379,'01 / SCHOOL OVERVIEW',14,GRAY,True,1.6)
card(main,72,411,1056,660,'school-overview')
# Supporting screen is a real module excerpt; its dimensions remain proportional to its source crop.
ImageDraw.Draw(canvas).rounded_rectangle((552*S,746*S,1128*S,810*S),radius=12*S,fill='white',outline=BORDER,width=2)
svg.append('<rect x="552" y="746" width="576" height="64" rx="12" fill="white" stroke="#dededb"/>')
text(570,762,'02 / EXAMINATIONS',14,RED,True,1.6)
card(exam,552,792,576,576*exam.height/exam.width,'examination-workflow',True)
line(72,1118,1128,1118,'#d8d8d4')
text(72,1144,'ACADVIO  •  Building in Public',17,GRAY)
line(1094,1154,1128,1154,RED,2)
svg.append('</svg>');(OUT/'acadvio-day-06-editable.svg').write_text('\n'.join(svg),encoding='utf-8')
canvas.convert('RGB').resize((1200,1200),Image.Resampling.LANCZOS).save(OUT/'acadvio-day-06-linkedin.png',dpi=(144,144))
metadata={'canvas':[1200,1200],'sources':['public/product-showcase/school-admin.jpg','public/product-showcase/examination.jpg','public/logo.png'],'referencePosts':['C:/Users/DT/Downloads/Acadivo Day 04 LinkedIn post.png','C:/Users/DT/Downloads/acadivo_day5_before_after.png'],'reviewedInventory':'asset-inventory.json','mainScreenshotMasks':[[1085,8,1258,58],[20,65,245,104],[283,94,658,116]],'examinationCrop':[270,84,1250,490],'screenshotNumericalDataModified':False,'logoRedrawn':False,'copySpelling':'User-requested ACADVIO retained in post copy; exact original Acadivo logo retained unchanged.'}
(OUT/'source-manifest.json').write_text(json.dumps(metadata,indent=2),encoding='utf-8')
(OUT/'README.md').write_text('''# Day 06 — From Features to Experience.

- Final: `acadvio-day-06-linkedin.png` — 1200 × 1200 RGB PNG.
- Editable: `acadvio-day-06-editable.svg` — self-contained SVG. Headline, labels, lines and footer remain editable vector elements; screenshot pixels and original logo are embedded.
- Builder: `scripts/render-day6-graphic.py` — reproducible local Pillow composition.

References: Day 04 and Day 05 graphics were found in the user Downloads directory and inspected. The design continues their off-white, bold black and red typography, with a fresh layered two-screen composition. The LinkedIn profile could not be fetched, so local references were used.

Actual school overview and examination workflow captures were selected after reviewing the screenshot contact sheets. Main screen identity areas were masked. The examination screen is a proportional crop excluding the account header and student activity log. No metrics, results or UI controls were invented or altered. The full original product logo is retained. User-requested ACADVIO spelling remains in the graphic copy.

For best font continuity when editing the SVG, use Arial / Arial Bold. Open in Figma, Illustrator or Inkscape; screenshots remain raster images by design.
''',encoding='utf-8')
print('Exported PNG',Image.open(OUT/'acadvio-day-06-linkedin.png').size)
