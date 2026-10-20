# Copied from praphawach29/checkmee-video kit/music.py (same owner): music and effects composed in code,
# no licensed audio. Usage: python3 music.py out.wav cues.json
import numpy as np, wave, sys
import json; CUE=json.load(open(sys.argv[2]))
HOLDS=sorted(CUE.get('holds',[]))
def sh(t): return t+sum(d for at,d in HOLDS if at<t)   # source time -> output time
for k in ('taps','keys','pops','whooshes','shutter','sting'):
    if k in CUE: CUE[k]=[sh(x) for x in CUE[k]]
if 'chimes' in CUE: CUE['chimes']=[[sh(t),n] for t,n in CUE['chimes']]
CUE['end']=sh(CUE['end']) if 'end' in CUE else CUE.get('end')
SR=48000; DUR=CUE["duration"]+sum(d for _,d in HOLDS); N=int(SR*DUR)
L=np.zeros(N); R=np.zeros(N)
BPM=112; B=60/BPM; BAR=4*B
rng=np.random.default_rng(7)
def f(m): return 440*2**((m-69)/12)
def add(sig,t0,g=1.0,pan=0.0):
    i=int(t0*SR); j=min(N,i+len(sig))
    if i>=N or j<=i: return
    s=sig[:j-i]*g
    L[i:j]+=s*np.sqrt((1-pan)/2)*1.414/1.414; R[i:j]+=s*np.sqrt((1+pan)/2)
def env(n,a,d):
    t=np.arange(n)/SR; e=np.minimum(1,t/max(a,1e-4))*np.exp(-t/d); return e
def lp(x,c):
    y=np.zeros_like(x);a=np.exp(-2*np.pi*c/SR);p=0.0
    for i in range(len(x)): p=(1-a)*x[i]+a*p; y[i]=p
    return y
def hp(x,c): return x-lp(x,c)
END=CUE['end']   # CTA: drums out, hold the chord
BED=CUE.get('bed',1.0)   # music level under a voiceover
prog=[(48,[60,64,67]),(43,[59,62,67]),(45,[57,60,64]),(41,[57,60,65])]  # C G Am F
nb=int(np.ceil(DUR/BAR))
for b in range(nb):
    t0=b*BAR; root,ch=prog[b%4]
    last = t0>=END-0.01 or t0+BAR>END
    # pad
    n=int(BAR*SR*1.15); t=np.arange(n)/SR
    pad=sum(sum(np.sin(2*np.pi*f(m)*k*t+k)/k**1.6 for k in range(1,6)) for m in ch+[ch[0]+12])
    e=np.minimum(1,t/0.25)*np.minimum(1,np.maximum(0,(BAR*1.15-t)/0.35))
    if t0>=END-BAR: pass
    add(pad*e,t0,0.020*BED)
    # bass + pluck arps, until the CTA
    for k in range(8):
        tt=t0+k*B/2
        if tt>=END: break
        n=int(0.32*SR); t=np.arange(n)/SR
        bass=(np.sin(2*np.pi*f(root)*t)+.35*np.sin(2*np.pi*f(root)*2*t))*env(n,.005,.16)
        add(bass,tt,(0.16 if k%2==0 else 0.09)*BED)
        m=(ch+[ch[0]+12,ch[1]+12])[[0,1,2,3,4,3,2,1][k]]+12
        n=int(0.45*SR); t=np.arange(n)/SR
        pl=(np.sin(2*np.pi*f(m)*t)+.4*np.sin(2*np.pi*f(m)*2*t)+.15*np.sin(2*np.pi*f(m)*3*t))*env(n,.003,.12)
        add(pl,tt,0.045*BED,pan=(-.35 if k%2 else .35))
# drums
nbeats=int(END/B)+1
for k in range(nbeats):
    tt=k*B
    if tt>=END: break
    n=int(.35*SR); t=np.arange(n)/SR
    ph=2*np.pi*np.cumsum(45+90*np.exp(-t/.035))/SR
    add(np.sin(ph)*env(n,.001,.13),tt,0.42*BED)
    if k%4 in (1,3):
        n=int(.25*SR); x=hp(rng.standard_normal(n),900)*env(n,.001,.07)
        add(lp(x,6000),tt,0.10*BED)
    n=int(.06*SR); h=hp(rng.standard_normal(n),7000)*env(n,.0005,.012)
    add(h,tt+B/2,0.07*BED,pan=.3)
# final chord: soft bells on the CTA
for i,m in enumerate([72,76,79,84]):
    n=int(3.0*SR); t=np.arange(n)/SR
    bell=(np.sin(2*np.pi*f(m)*t)+.3*np.sin(2*np.pi*f(m)*2.01*t))*env(n,.004,1.1)
    add(bell,END+0.05+i*0.09,0.05,pan=(i-1.5)*.2)
# --- effects, in key and under the music ---
def blip(m,g,t0,d=.06):
    n=int(.25*SR); t=np.arange(n)/SR; add(np.sin(2*np.pi*f(m)*t)*env(n,.001,d),t0,g)
for t0 in CUE.get('taps',[]): blip(88,0.05,t0,.03); blip(76,0.04,t0,.05)   # taps
for t0 in CUE.get('shutter',[]):
    n=int(.2*SR); add(lp(hp(rng.standard_normal(n),2500),9000)*env(n,.001,.03),t0,0.10)
def chime(t0,notes,g=0.06):
    for i,m in enumerate(notes):
        n=int(1.2*SR); t=np.arange(n)/SR
        add((np.sin(2*np.pi*f(m)*t)+.25*np.sin(2*np.pi*f(m)*3*t))*env(n,.003,.35),t0+i*.07,g)
for t0,notes in CUE.get('chimes',[]): chime(t0,notes)
def pop(t0):
    n=int(.12*SR); t=np.arange(n)/SR; ph=2*np.pi*np.cumsum(500+900*t/.12)/SR; add(np.sin(ph)*env(n,.002,.04),t0,0.06)
for t0 in CUE.get('pops',[]): pop(t0)
def whoosh(t0,d=.45):
    n=int(d*SR); t=np.arange(n)/SR; x=lp(hp(rng.standard_normal(n),400),3000)*np.sin(np.pi*t/d)**2; add(x,t0-d*.6,0.035)
for t0 in CUE.get('whooshes',[]): whoosh(t0)
# brand sting: pop as the icon lands, then the two-note "เช็ค-มี" as the tick finishes, a soft blink
for t0 in CUE.get('sting',[]):
    pop(t0+.4); whoosh(t0+.25,.35)
    chime(t0+.86,[79],0.08); chime(t0+1.04,[84],0.09)
    blip(91,0.025,t0+1.32,.03)
for t0 in CUE.get('keys',[]):
    n=int(.05*SR); add(lp(hp(rng.standard_normal(n),1800),7000)*env(n,.0005,.012),t0,0.03)
# master: gentle fade-in/out and soft limit
fade=np.ones(N); fade[:int(.02*SR)]=np.linspace(0,1,int(.02*SR)); k=int(.8*SR); fade[-k:]=np.linspace(1,0,k)**1.5
st=np.stack([L,R],1)*fade[:,None]; st=np.tanh(st*1.6)/np.tanh(1.6)
st=st/np.max(np.abs(st))*CUE.get('peak',0.89)
with wave.open(sys.argv[1],'wb') as w:
    w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes((st*32767).astype('<i2').tobytes())
print('ok')
