from pathlib import Path
import json, re, subprocess
HERE=Path(__file__).resolve().parent
ff=str(HERE/'runtime/ffmpeg.exe')
video=HERE/'acadivo-product-demo.mp4'
manifest=json.loads((HERE/'render-manifest.json').read_text(encoding='utf-8'))
checks={}
info=subprocess.run([ff,'-hide_banner','-i',str(video)],capture_output=True,text=True).stderr
checks['duration84']=bool(re.search(r'Duration: 00:01:24\.00',info))
checks['1080p30']=bool(re.search(r'1920x1080.*30 fps',info))
checks['audioAAC']=bool(re.search(r'Audio: aac.*48000 Hz, stereo',info))
check=subprocess.run([ff,'-hide_banner','-i',str(video),'-vf','blackdetect=d=0.05:pix_th=0.1:pic_th=0.98','-af','astats=metadata=0:reset=0','-f','null','-'],capture_output=True,text=True)
checks['fullDecode']=check.returncode==0
checks['noBlackFrames']='black_start:' not in check.stderr
checks['nonSilentAudio']='RMS level dB: -inf' not in check.stderr
checks['sceneCount']=len(manifest['scenes'])==12
checks['voiceTiming']=all(s['voiceDuration']/s['voiceSpeed']+.35<s['duration'] for s in manifest['scenes'])
frames=[round((s['start']+s['duration']/2)*30) for s in manifest['scenes']]
select='+'.join(f'eq(n,{n})' for n in frames)
subprocess.run([ff,'-y','-v','error','-i',str(video),'-vf',f"select='{select}',scale=640:360,tile=3x4",'-frames:v','1',str(HERE/'final-review.jpg')],check=True)
(HERE/'verification.json').write_text(json.dumps({'checks':checks,'bytes':video.stat().st_size,'mediaInfo':info,'voice':'Microsoft David Desktop; scene-aligned narration','manualReview':'Review final-review.jpg and browser playback separately.'},indent=2),encoding='utf-8')
(HERE/'decode-verification.log').write_text(check.stderr,encoding='utf-8')
print(json.dumps(checks,indent=2))
assert all(checks.values()),checks
