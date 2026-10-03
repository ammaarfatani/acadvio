"""Render the existing approved storyboard; no product UI is generated."""
from pathlib import Path
import json, math, subprocess, sys, wave, zipfile
from functools import lru_cache
from PIL import Image, ImageDraw, ImageFont

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
W,H,FPS=1920,1080,30
RED='#E0000B'
FONT=Path('C:/Windows/Fonts')
@lru_cache(maxsize=128)
def font(n,bold=False): return ImageFont.truetype(str(FONT/('segoeuib.ttf' if bold else 'segoeui.ttf')),n)
scenes=[]
for line in (HERE/'storyboard.md').read_text(encoding='utf-8').splitlines():
 if line.startswith('| 0'):
  c=[v.strip() for v in line.split('|')[1:-1]]
  dur=int(c[0].split('/')[1].strip().removesuffix('s'))
  scenes.append(dict(duration=dur,title=c[1].split('. ',1)[1],caption=c[4],voiceover=c[5].strip('“”'),transition=c[6]))
assert len(scenes)==12 and sum(s['duration'] for s in scenes)==84
P=ROOT/'public/product-showcase'
paths=[
 [P/'school-admin.jpg'],
 [HERE/'admissions.jpg',HERE/'teacher-attendance.jpg',HERE/'exam-results.jpg',P/'finance.jpg'],
 [HERE/'super-admin.jpg',HERE/'super-admin-payments.jpg'],
 [P/'school-admin.jpg',HERE/'students.jpg',HERE/'classes.jpg'],
 [P/'receptionist.jpg',HERE/'admissions.jpg',HERE/'students.jpg'],
 [P/'teacher-full.jpg',HERE/'teacher-timetable.jpg',HERE/'teacher-attendance.jpg'],
 [HERE/'exam-schedules.jpg',HERE/'exam-marks.jpg',HERE/'exam-results.jpg',HERE/'exam-certificates.jpg'],
 [P/'finance.jpg',HERE/'finance-challans.jpg',HERE/'finance-reports.jpg'],
 [HERE/'super-admin.jpg',P/'school-admin.jpg',P/'teacher.jpg',P/'receptionist.jpg',P/'examination.jpg',P/'finance.jpg'],
 [P/'school-admin-insights.jpg',HERE/'finance-reports.jpg'],
 [P/'school-admin.jpg',HERE/'students.jpg',HERE/'teacher-attendance.jpg',HERE/'exam-results.jpg',P/'finance.jpg',P/'receptionist.jpg'],
 []]
images={}
for group in paths:
 for p in group:
  if not p.exists(): raise FileNotFoundError(p)
  images[str(p)]=Image.open(p).convert('RGB')
logo=Image.open(ROOT/'public/logo.png').convert('RGBA')
logo=logo.crop(logo.getbbox())
logo.thumbnail((650,200),Image.Resampling.LANCZOS)
def center(d,text,y,size,color='#111111',bold=False):
 f=font(size,bold)
 while d.textlength(text,font=f)>1740: size-=1; f=font(size,bold)
 d.text(((W-d.textlength(text,font=f))/2,y),text,font=f,fill=color)
def wrap(text,f,max_width):
 result=[]; row=''
 for word in text.split():
  if ImageDraw.Draw(Image.new('RGB',(1,1))).textlength((row+' '+word).strip(),font=f)>max_width:
   result.append(row); row=word
  else: row=(row+' '+word).strip()
 return result+[row]
@lru_cache(maxsize=24)
def resized(key,sw,sh):
 return images[key].resize((sw,sh),Image.Resampling.BILINEAR)

def screen(im,source,local,span):
 # A bounded viewport pans through the original full teacher capture.
 x,y,bw,bh=140,215,1640,740
 zoom=1+.035*min(1,local/max(.1,span))
 ratio=bw/source.width
 if source.height>1100:
  ratio=bw/source.width
 sw,sh=round(source.width*ratio*zoom),round(source.height*ratio*zoom)
 key=next(k for k,v in images.items() if v is source)
 shot=resized(key,sw,sh)
 if sh>bh:
  offset=round((sh-bh)*min(1,local/max(.1,span)))
  shot=shot.crop((max(0,(sw-bw)//2),offset,max(0,(sw-bw)//2)+bw,offset+bh))
  sw,sh=shot.size
 frame=Image.new('RGB',(bw,bh),'#ffffff')
 frame.paste(shot,((bw-sw)//2,(bh-sh)//2))
 d=ImageDraw.Draw(im)
 d.rounded_rectangle((x-9,y-9,x+bw+9,y+bh+9),18,fill='#e5e7eb')
 im.paste(frame,(x,y))
 # Editorial cursor and selection cue over genuine navigation, never fake records.
 u=min(1,local/.8); cx=x+360+int(90*u); cy=y+110+int(20*u)
 d=ImageDraw.Draw(im)
 if local>.65:
  d.rounded_rectangle((x+360,y+112,x+1320,y+175),7,outline=RED,width=3)
 d.polygon([(cx,cy),(cx+1,cy+25),(cx+8,cy+18),(cx+15,cy+29),(cx+20,cy+26),(cx+13,cy+15),(cx+25,cy+15)],fill='#111111',outline='white',width=2)
 return im
def make(i,t):
 s=scenes[i]; im=Image.new('RGB',(W,H),'#fafafa'); d=ImageDraw.Draw(im)
 d.rectangle((0,0,W,6),fill=RED)
 d.text((140,36),'ACADIVO',font=font(25,True),fill='#111111')
 d.text((1640,36),f'{i+1:02d} / 12',font=font(23),fill='#68707c')
 center(d,s['caption'],102,42,bold=True)
 if i==11 or (i==0 and t<1.7):
  im.paste(logo,((W-logo.width)//2,330),logo)
  d=ImageDraw.Draw(im)
  center(d,'School Management, Simplified.' if i==0 else 'One School. One Powerful Platform.',560,54,bold=True)
  if i==11:
   center(d,'Manage your school smarter.',650,36,color='#57606c')
   d.rounded_rectangle((775,755,1145,837),15,fill=RED)
   center(d,'Try Free Now',772,34,color='white',bold=True)
   center(d,'By AKTech Digital Solutions',912,24,color='#68707c')
 else:
  group=paths[i]
  available=s['duration']-(1.7 if i==0 else 0)
  rel=max(0,t-(1.7 if i==0 else 0)); span=available/len(group)
  shot=min(len(group)-1,int(rel/span)); part=rel-shot*span
  screen(im,images[str(group[shot])],part,span)
  # Cross-dissolve between real workflow captures.
  if shot>0 and part<.28:
   prev=Image.new('RGB',(W,H),'#fafafa'); prev.paste(im)
   screen(prev,images[str(group[shot-1])],span,span)
   im=Image.blend(prev,im,part/.28)
 d=ImageDraw.Draw(im)
 d.rectangle((140,1036,1780,1040),fill='#e6e8eb')
 elapsed=sum(v['duration'] for v in scenes[:i])+t
 d.rectangle((140,1036,140+int(1640*elapsed/84),1040),fill=RED)
 d.text((140,992),s['title'].upper(),font=font(19,True),fill='#68707c')
 return im

def get_encoder():
 wheels=list((HERE/'runtime').glob('imageio_ffmpeg*.whl'))
 assert wheels,'FFmpeg wheel is missing'
 runtime=HERE/'runtime/ffmpeg'; runtime.mkdir(exist_ok=True)
 with zipfile.ZipFile(wheels[0]) as z:
  name=next(n for n in z.namelist() if n.endswith('.exe') and 'ffmpeg' in n)
  dest=runtime/Path(name).name
  if not dest.exists(): dest.write_bytes(z.read(name))
 return str(dest)

def run(args): subprocess.run(args,check=True)
if __name__=='__main__':
 ff=get_encoder()
 out=HERE/'render'; out.mkdir(exist_ok=True)
 # Every clip starts at its approved scene timestamp and fits inside that scene.
 aud=[]; metadata=[]
 for i,s in enumerate(scenes):
  src=HERE/f'audio/scene-{i+1:02d}.wav'
  with wave.open(str(src)) as a: duration=a.getnframes()/a.getframerate()
  speed=max(1,duration/(s['duration']-.8))
  dst=out/f'audio-{i+1:02d}.wav'
  run([ff,'-y','-v','error','-i',str(src),'-af',f'atempo={speed},adelay=350|350,apad,atrim=duration={s["duration"]}','-ar','48000','-ac','2',str(dst)])
  aud.append(dst); metadata.append({**s,'start':sum(v['duration'] for v in scenes[:i]),'voiceDuration':duration,'voiceSpeed':speed,'assets':[str(p.relative_to(ROOT)) for p in paths[i]]})
 (out/'audio-list.txt').write_text('\n'.join("file '"+p.as_posix()+"'" for p in aud))
 run([ff,'-y','-v','error','-f','concat','-safe','0','-i',str(out/'audio-list.txt'),'-c:a','pcm_s16le',str(out/'voiceover.wav')])
 (HERE/'render-manifest.json').write_text(json.dumps({'duration':84,'size':[W,H],'fps':FPS,'scenes':metadata},indent=2),encoding='utf-8')
 cmd=[ff,'-y','-v','warning','-f','rawvideo','-pix_fmt','rgb24','-s',f'{W}x{H}','-r',str(FPS),'-i','pipe:0','-i',str(out/'voiceover.wav'),'-c:v','libx264','-preset','fast','-crf','19','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-t','84','-movflags','+faststart',str(HERE/'acadivo-product-demo.mp4')]
 process=subprocess.Popen(cmd,stdin=subprocess.PIPE)
 try:
  for i,s in enumerate(scenes):
   print(f'Rendering scene {i+1}/12: {s["title"]}',flush=True)
   for frame in range(s['duration']*FPS):
    t=frame/FPS; im=make(i,t)
    # Restrained 350ms light transition, no black or blank footage.
    if i>0 and t<.35:
     prev=make(i-1,scenes[i-1]['duration']-.01)
     a=(t/.35)**.7
     if i in (3,):
      pass # aligned sidebar match cut
     elif i==6:
      edge=int(H*a); prev.paste(im.crop((0,0,W,edge)),(0,0)); im=prev
     elif i in (1,4,8):
      edge=int(W*a); prev.paste(im.crop((0,0,edge,H)),(0,0)); im=prev
      ImageDraw.Draw(im).rectangle((max(0,edge-5),0,edge+5,H),fill=RED)
     else: im=Image.blend(prev,im,a)
    if frame==s['duration']*FPS//2: im.save(out/f'scene-{i+1:02d}-review.jpg',quality=92)
    process.stdin.write(im.tobytes())
 finally: process.stdin.close()
 if process.wait()!=0: raise RuntimeError('Encoding failed')
 print('Export complete',flush=True)
