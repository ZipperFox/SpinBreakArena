from pathlib import Path
import numpy as np, wave
from scipy.signal import butter,sosfilt
root=Path('/mnt/data/spinbreak_v105_work/public/sfx');root.mkdir(parents=True,exist_ok=True)
rate=32000

def filt(x,frequency,mode='lowpass',order=2):
    if isinstance(frequency,tuple):
        f=[max(50,min(rate/2-80,v)) for v in frequency]
    else:f=max(50,min(rate/2-80,frequency))
    return sosfilt(butter(order,f,btype=mode,fs=rate,output='sos'),x)

def sound(kind,seed,duration,low=1.0,brightness=1.):
    rng=np.random.default_rng(seed)
    n=int(rate*duration);t=np.arange(n,dtype=np.float64)/rate
    white=rng.normal(0,1,n)
    crackle=filt(white,3100,'highpass');crackle/=max(np.std(crackle),1e-4)
    attack=.5*np.exp(-t/0.003)+.32*np.exp(-t/.022)+.18*np.exp(-t/.085)
    wav=crackle*attack*.40*brightness
    deep=filt(white,280,'lowpass');deep/=max(np.std(deep),1e-4)
    wav+=deep*np.exp(-t/.060)*.36*low
    plate=filt(white,(400,3100),'bandpass');plate/=max(np.std(plate),1e-4)
    wav+=plate*np.exp(-t/.088)*.16*brightness
    # Inharmonic modal ringing approximates a struck thin metal ring, not a musical oscillator.
    freqs=[247,394,613,1009,1633,2611]
    for i,freq in enumerate(freqs):
        phase=rng.uniform(0,6.283);inharmonic=(freq*(.89+rng.uniform(-.07,.07)))*low**.12
        decay=[.071,.11,.15,.094,.075,.053][i]*(0.8+duration*.6)
        wav+=((.09 if i==0 else .052)/((i+1)**.14))*np.sin(2*np.pi*inharmonic*t+phase)*np.exp(-t/decay)
    if kind in ('counter','ko'):
        wav+=.16*np.sin(2*np.pi*(320+250*low)*t)*np.exp(-t/.13)
    fade=np.minimum(1,((duration-t)/.04).clip(0,1))
    wav=wav*fade
    # Gentle saturation to reduce sample clipping and give the snap a metallic edge.
    wav=np.tanh(wav*1.15)
    peak=max(.001,np.max(np.abs(wav)))
    wav=.76*wav/peak
    return wav

def whoosh(seed,duration,variant=0):
    rng=np.random.default_rng(seed);n=int(duration*rate);t=np.arange(n)/rate
    white=rng.normal(0,1,n)
    # Moving air; unlike a synth pitch slide this remains a textured noisy sweep.
    wave=filt(white,2300,'lowpass');wave/=max(1e-4,np.std(wave))
    sweep=np.sin(np.pi*t/duration)**.75
    thrum=filt(white,210,'lowpass');thrum/=max(1e-4,np.std(thrum))
    x=.31*wave*sweep +.25*thrum*sweep
    if variant==1:
        x+=.25*sound('hit',seed+50,duration,1.3,1.2)
    elif variant==2:
        x+=.19*sound('counter',seed+30,duration,1,1)
    else:
        x+=.06*np.sin(2*np.pi*73*t)*sweep
    x=np.tanh(x);x=x/max(.001,np.max(np.abs(x)))*.68
    return x

def save(name,x):
    with wave.open(str(root/(name+'.wav')),'wb') as wf:
        wf.setnchannels(1);wf.setsampwidth(2);wf.setframerate(rate)
        wf.writeframes(np.int16(np.clip(x,-1,1)*32767).tobytes())

save('hit_light',sound('hit',114,.25,low=.7,brightness=.75))
save('hit_heavy',sound('hit',115,.38,low=1.2,brightness=1.2))
save('hit_critical',sound('hit',116,.55,low=1.45,brightness=1.1))
save('wall',sound('wall',117,.19,low=.85,brightness=.6))
save('counter',sound('counter',118,.36,low=1.0,brightness=1.4))
save('charge',whoosh(210,.41,0))
save('skill',whoosh(211,.46,1))
save('ko',sound('ko',119,.62,low=1.2,brightness=.72))
save('warning',sound('warning',120,.29,low=.7,brightness=.55))
save('anomaly',whoosh(213,.56,2))
save('start',sound('hit',121,.21,low=.90,brightness=.55))
save('win',sound('counter',122,.63,low=1.05,brightness=.75))
for f in root.glob('*.wav'):print(f.name,f.stat().st_size)
