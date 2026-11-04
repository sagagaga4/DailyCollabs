#!/usr/bin/env python3
"""Render the original DailyCollabs laptop product motion graphic.

Frames render a laptop scene from code. With --screen-capture, the display uses
the supplied actual-app screenshot in full; otherwise it renders a concept UI.
The film does not claim to be camera or AI-generated footage.
Requires Pillow, numpy, OpenCV and FFmpeg. Outputs H.264 MP4 and a matching poster.
"""
from pathlib import Path
import argparse
import math
import os
import subprocess
import numpy as np
import cv2
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'Frontend/client/public/welcome'
W, H, FPS, DURATION = 1280, 720, 24, 10
FONT_ROOT = Path('/System/Library/Fonts/Supplemental')
FONTS = {}
SCREEN_CAPTURE_IMAGE = None

def font(size, bold=False):
    key = (size, bold)
    if key not in FONTS:
        filename = 'Arial Bold.ttf' if bold else 'Arial.ttf'
        path = FONT_ROOT / filename
        if not path.exists():
            path = Path('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
        FONTS[key] = ImageFont.truetype(str(path), size)
    return FONTS[key]

def ease(value):
    value = max(0, min(1, value))
    return value * value * (3 - 2 * value)

def mix(a, b, amount): return tuple(int(x + (y - x) * amount) for x, y in zip(a, b))
def rounded(draw, box, radius=12, fill='#11171d', outline=None, width=1):
    draw.rounded_rectangle(tuple(int(v) for v in box), radius, fill=fill, outline=outline, width=width)
def text(draw, at, value, size=16, fill='#dce6ed', bold=False, anchor=None):
    draw.text(at, value, font=font(size, bold), fill=fill, anchor=anchor)
def lines(draw, x, y, widths, color='#34424f', height=5, gap=12):
    for idx, width in enumerate(widths): rounded(draw, (x, y+idx*gap, x+width, y+idx*gap+height), 2, color)
def circle(draw, xy, r, fill, outline=None, width=1):
    x,y=xy;draw.ellipse((x-r,y-r,x+r,y+r),fill=fill,outline=outline,width=width)

def db_art(image, box, phase):
    draw=ImageDraw.Draw(image)
    x,y,w,h=box
    rounded(draw,(x,y,x+w,y+h),10,'#102c32')
    for i in range(6):
        xa=x+16+i*(w-32)/5
        draw.line((xa,y+12,xa,y+h-12),fill='#19414a',width=1)
    for i in range(4):
        ya=y+12+i*(h-24)/3
        draw.line((x+14,ya,x+w-14,ya),fill='#19414a',width=1)
    cx,cy=x+w*.5,y+h*.5
    for level in (16,0,-16):
        draw.rectangle((cx-37,cy+level-8,cx+37,cy+level+8),fill='#1a788c')
        draw.ellipse((cx-37,cy+level-19,cx+37,cy+level+3),fill='#205d6c',outline='#70d9e9',width=2)
    for i in range(3):
        a=phase*1.5+i*2.09
        circle(draw,(cx+67*math.cos(a),cy+24*math.sin(a)),3,'#a0eff8')

def screen(t):
    if SCREEN_CAPTURE_IMAGE is not None:
        # Preserve the complete actual app display; contain it without cropping or invented UI.
        im=Image.new('RGB',(1000,620),'#090d12')
        capture=ImageOps.contain(SCREEN_CAPTURE_IMAGE,(1000,620),Image.Resampling.LANCZOS)
        im.paste(capture,((1000-capture.width)//2,(620-capture.height)//2))
        return im
    im=Image.new('RGB',(1000,620),'#090d12');d=ImageDraw.Draw(im)
    d.rectangle((0,0,175,620),fill='#10151b')
    d.line((175,0,175,620),fill='#28313a',width=1)
    rounded(d,(18,24,52,58),8,'#5bd8ed')
    text(d,(25,29),'dc',21,'#071217',True)
    text(d,(65,29),'DailyCollabs',15,bold=True)
    text(d,(22,89),'YOUR DAILY SPACE',9,'#718394',True)
    for index,label in enumerate(['Home','Communities','Posts','Bookmarks']):
        y=121+index*43
        chosen=(index==1 and t>=4.4) or (index==0 and t<4.4)
        if chosen:rounded(d,(13,y-8,162,y+26),8,'#1b353d')
        circle(d,(29,y+8),5,'#5bd8ed' if chosen else '#758596')
        text(d,(46,y),label,13,'#ccebf1' if chosen else '#80909e',chosen)
    rounded(d,(15,411,160,502),10,'#171f27',outline='#2a3540')
    text(d,(27,427),'Stay curious.',14,bold=True)
    text(d,(27,450),'Good ideas deserve',10,'#8293a1')
    text(d,(27,467),'good company.',10,'#8293a1')
    circle(d,(33,570),16,'#3e7684');text(d,(24,561),'Y',16,'#d6f7fa',True)
    text(d,(58,558),'Your daily space',10,bold=True)
    text(d,(58,576),'@curious',9,'#778b9c')
    d.rectangle((176,0,1000,65),fill='#0d1218')
    text(d,(202,22),'Discover',20,bold=True)
    text(d,(815,28),'A DAILY DOSE OF CURIOUS',8,'#7d8e9e',True)
    search_value='Redis'[:int(max(0,min(5,(t-.8)*5)))]
    if t<4.4:
        text(d,(206,94),'Your next rabbit hole starts here.',23,bold=True)
        text(d,(206,128),'Good reads, new perspectives, and people who get it.',12,'#8396a6')
        rounded(d,(205,159,964,205),13,'#141c24',outline='#48b8cf' if .6<t<2.2 else '#2b3945')
        circle(d,(229,181),6,None,'#74b6c6',2);d.line((234,186,239,191),fill='#74b6c6',width=2)
        text(d,(251,172),search_value if t>.8 else 'Search something you love',15,'#d5f2f7' if t>.8 else '#71889a')
        if .8<t<1.9:d.line((255+len(search_value)*8,173,255+len(search_value)*8,190),fill='#b3edf5',width=1)
        for i,label in enumerate(['Technology','Design','Music','Gaming']):
            x=206+i*104;rounded(d,(x,221,x+92,247),12,'#142b32' if i==0 else '#151d25')
            text(d,(x+12,229),label,10,'#86dbe9' if i==0 else '#8496a7')
        text(d,(208,274),'Redis / fresh perspectives' if t>2 else 'Worth your attention',15,bold=True)
        for idx in range(3):
            x=205+idx*257;y=307
            rounded(d,(x,y,x+244,550),12,'#111920',outline='#2a3540')
            db_art(im,(x+9,y+9,226,120),t+idx)
            d=ImageDraw.Draw(im)
            if idx==1:
                circle(d,(x+121,y+69),20,'#dff8fc');d.polygon([(x+116,y+59),(x+116,y+79),(x+131,y+69)],fill='#10242d')
            titles=[['Redis, without','the waiting.'],['A faster way to','understand caching.'],['Build something','worth sharing.']][idx]
            text(d,(x+13,y+146),'WATCH & LEARN' if idx==1 else 'TECHNOLOGY',8,'#6fd0e1',True)
            text(d,(x+13,y+167),titles[0],16,bold=True);text(d,(x+13,y+188),titles[1],16,bold=True)
            text(d,(x+13,y+218),'5 min read   /   Redis',9,'#768a9a')
    else:
        text(d,(206,96),'Communities.',30,bold=True)
        text(d,(206,139),'Find your corner of the internet.',13,'#8497a8')
        rounded(d,(205,172,964,245),13,'#14262e',outline='#2b414a')
        text(d,(225,188),'Big interests. Your kind of people.',20,bold=True)
        text(d,(225,218),'Open a board. Join a conversation. Make it yours.',11,'#8cacb9')
        for idx,(name,code) in enumerate([('Technology','/g/'),('Music','/mu/'),('Creative Studio','/ic/')]):
            x=205+idx*257;y=269
            rounded(d,(x,y,x+244,484),12,'#111920',outline='#2c4852' if idx==0 else '#29333d')
            rounded(d,(x+15,y+17,x+54,y+56),9,'#193c46' if idx==0 else '#1e2a37')
            text(d,(x+24,y+26),'T' if idx==0 else 'M' if idx==1 else 'C',17,'#80deed',True)
            text(d,(x+67,y+29),code,13,'#8295a7')
            text(d,(x+15,y+83),name,20,bold=True)
            lines(d,x+15,y+119,[202,183,146],height=4,gap=13)
            text(d,(x+15,y+178),'Find your people',10,'#81a1af')
            rounded(d,(x+145,y+167,x+229,y+199),14,'#58d2e7' if idx==0 else '#21313d')
            text(d,(x+163,y+177),'Joined' if idx==0 else 'Explore',10,'#0d2530' if idx==0 else '#c2d4de',True)
        rounded(d,(205,511,964,572),12,'#111c24',outline='#263d48')
        text(d,(223,525),'What are you building this week?',16,bold=True)
        text(d,(223,552),'A little less scrolling. A little more belonging.',11,'#839ba9')
    if 7.7<t:
        p=ease((t-7.7)/.4)
        rounded(d,(635,76,964,116),12,'#133832',outline='#3b8d78')
        text(d,(653,90),'Shared to Technology',14,'#a3edce',True)
        circle(d,(943,96),9,'#6eddb7');d.line([(938,96),(942,100),(948,91)],fill='#0a291f',width=2)
    return im


def build_background():
    yy,xx=np.mgrid[0:H,0:W]
    cyan=np.exp(-(((xx-690)/500)**2+((yy-440)/240)**2))
    peach=np.exp(-(((xx-1080)/320)**2+((yy-160)/330)**2))
    base=np.zeros((H,W,3),dtype=np.float32)
    for channel,value in enumerate([5,9,14]):base[:,:,channel]=value+cyan*[2,19,24][channel]+peach*[18,8,3][channel]
    return Image.fromarray(np.uint8(np.clip(base,0,255)))
BACKGROUND=build_background()

def device_points(t):
    yaw=.17*math.sin(2*math.pi*t/DURATION-.7)
    pitch=-.055+.015*math.cos(2*math.pi*t/DURATION)
    zoom=.67+.025*math.sin(2*math.pi*t/DURATION-.5)
    float_y=5*math.sin(2*math.pi*t/DURATION)
    def project(x,y,z=0):
        xz=x*math.cos(yaw)+z*math.sin(yaw)
        zz=-x*math.sin(yaw)+z*math.cos(yaw)
        yz=y*math.cos(pitch)-zz*math.sin(pitch)
        zz=y*math.sin(pitch)+zz*math.cos(pitch)
        factor=zoom*2100/(2100-zz)
        return (W/2+xz*factor,302+yz*factor+float_y)
    return project

def warp_screen(canvas, screen_image, points):
    source=np.float32([[0,0],[1000,0],[1000,620],[0,620]])
    matrix=cv2.getPerspectiveTransform(source,np.float32(points))
    result=cv2.warpPerspective(np.array(screen_image),matrix,(W,H),flags=cv2.INTER_LINEAR)
    mask=cv2.warpPerspective(np.full((620,1000),255,np.uint8),matrix,(W,H),flags=cv2.INTER_LINEAR)
    canvas.paste(Image.fromarray(result),(0,0),Image.fromarray(mask))

def frame(t):
    im=BACKGROUND.copy();d=ImageDraw.Draw(im)
    # Fine stage lines provide parallax without competing with the product.
    for idx in range(13):
        x=140+idx*84
        d.line((640+(x-640)*.24,462,x,H),fill='#13232c',width=1)
    for y in [494,530,578,640,710]:d.line((30,y,1250,y),fill='#13232c',width=1)
    text(d,(65,48),'DAILYCOLLABS',12,'#d6eef4',True)
    text(d,(65,71),'A PLACE FOR YOUR CURIOUS SIDE.',8,'#6a8a9d',True)
    rounded(d,(1075,45,1216,73),14,'#111d26',outline='#29404e')
    text(d,(1091,55),'PRODUCT IN MOTION',8,'#86becb',True)
    # Soft contact shadow beneath the floating laptop.
    shadow=Image.new('RGBA',(W,H));sd=ImageDraw.Draw(shadow)
    sd.ellipse((207,529,1073,647),fill=(0,0,0,210));shadow=shadow.filter(ImageFilter.GaussianBlur(25));im=Image.alpha_composite(im.convert('RGBA'),shadow).convert('RGB');d=ImageDraw.Draw(im)
    project=device_points(t)
    outer=[project(-520,-330),project(520,-330),project(520,330),project(-520,330)]
    # Back shell and lip with crisp cool highlights.
    lower=[project(-520,-330, -13),project(520,-330,-13),project(520,330,-13),project(-520,330,-13)]
    d.polygon(lower,fill='#29323b');d.polygon(outer,fill='#11171e',outline='#6f7e89')
    inner=[project(-500,-310),project(500,-310),project(500,310),project(-500,310)]
    warp_screen(im,screen(t),inner);d=ImageDraw.Draw(im)
    d.line(outer+[outer[0]],fill='#8d9da9',width=2)
    d.line([outer[0],outer[1]],fill='#aec2cc',width=2)
    camera=project(0,-320);circle(d,camera,2,'#49626e')
    # Keyboard deck: a foreshortened silver slab, with chamfered front lip.
    deck=[project(-520,330),project(520,330),project(603,403,210),project(-603,403,210)]
    lip=[deck[3],deck[2],(deck[2][0]-7,deck[2][1]+10),(deck[3][0]+7,deck[3][1]+10)]
    d.polygon(deck,fill='#78858e',outline='#bdcbd2');d.polygon(lip,fill='#414b55')
    d.line([deck[3],deck[2]],fill='#bdcbd2',width=2)
    for row in range(4):
        for col in range(26):
            xa=-477+col*37;ya=341+row*9.8;za=17+row*32
            key=[project(xa,ya,za),project(xa+29,ya,za),project(xa+30,ya+7,za+22),project(xa-1,ya+7,za+22)]
            d.polygon(key,fill='#242f38')
    track=[project(-116,382,156),project(116,382,156),project(125,396,197),project(-125,396,197)]
    d.polygon(track,fill='#83929c',outline='#a9bac3')
    # Small screen-following cursor + article drag transitioning into share bubbles.
    if SCREEN_CAPTURE_IMAGE is None and 1.5<t<4.2:
        x=780+30*math.sin(t*1.6);y=286+20*math.cos(t)
        d.polygon([(x,y),(x+5,y+19),(x+10,y+12),(x+19,y+12)],fill='#e9fbff',outline='#305364')
    if SCREEN_CAPTURE_IMAGE is None and 5.6<t<8.3:
        enter=ease((t-5.6)/.5);leave=1-ease((t-8.0)/.3)
        alpha=enter*leave
        card=Image.new('RGBA',(W,H));cd=ImageDraw.Draw(card)
        drag=ease((t-5.9)/1.6)
        x=764-170*drag;y=260+70*drag+7*math.sin(t*3)
        rounded(cd,(x,y,x+224,y+93),13,(17,41,51,int(245*alpha)),(80,198,218,int(230*alpha)),2)
        text(cd,(x+16,y+15),'Redis, without the waiting.',13,(225,249,255,int(255*alpha)),True)
        text(cd,(x+16,y+43),'Drag a good idea a little further.',10,(138,190,203,int(255*alpha)))
        text(cd,(x+16,y+66),'dailycollabs / Technology',9,(97,213,230,int(255*alpha)))
        for idx,label in enumerate(['Repost','Share','Save']):
            cx=482+idx*137;cy=500+8*math.sin(t*2+idx)
            active=idx==1 and t>6.8
            r=35+(5*ease((t-6.8)/.5) if active else 0)
            circle(cd,(cx,cy),r,(53,187,209,int(250*alpha)) if active else (20,40,52,int(240*alpha)),(104,211,228,int(255*alpha)),2)
            ink=(4,31,42,int(255*alpha)) if active else (175,230,240,int(255*alpha))
            if idx == 0:
                cd.line([(cx-11,cy-4),(cx-11,cy-11),(cx+10,cy-11)],fill=ink,width=2)
                cd.line([(cx+4,cy-17),(cx+10,cy-11),(cx+4,cy-5)],fill=ink,width=2)
                cd.line([(cx+11,cy+1),(cx+11,cy+8),(cx-10,cy+8)],fill=ink,width=2)
                cd.line([(cx-4,cy+2),(cx-10,cy+8),(cx-4,cy+14)],fill=ink,width=2)
            elif idx == 1:
                cd.line([(cx-10,cy+8),(cx+10,cy-12)],fill=ink,width=2)
                cd.line([(cx-3,cy-12),(cx+10,cy-12),(cx+10,cy+1)],fill=ink,width=2)
            else:
                cd.line([(cx-9,cy-4),(cx+9,cy-4)],fill=ink,width=3)
                cd.line([(cx,cy-13),(cx,cy+5)],fill=ink,width=3)
            text(cd,(cx,cy+r+16),label,11,(176,212,226,int(255*alpha)),anchor='mm')
        im=Image.alpha_composite(im.convert('RGBA'),card).convert('RGB');d=ImageDraw.Draw(im)
    # Editorial captions are outside the device, keeping the UI legible.
    caption=('Your interests. One connected feed.' if t<3.3 else 'News. Videos. Shared perspectives.' if t<6.0 else 'A daily space for what matters.' if t<8.4 else 'DailyCollabs. Made for your interests.') if SCREEN_CAPTURE_IMAGE is not None else ('Search what moves you.' if t<3.3 else 'Find people who get it.' if t<6.0 else 'Share your next rabbit hole.' if t<8.4 else 'Good ideas. Better company.')
    text(d,(W/2,650),caption,21,'#e6f5f9',True,'mm')
    text(d,(W/2,685),'DISCOVER  /  CONNECT  /  COLLABORATE',8,'#7899aa',True,'mm')
    # Timeline returns to the same lighting/geometry, supporting a calm looping film.
    d.line((480,709,800,709),fill='#233b47',width=2)
    d.line((480,709,480+320*t/DURATION,709),fill='#6bd8e9',width=2)
    return im

def ffmpeg_path():
    configured=os.environ.get('DAILYCOLLABS_FFMPEG')
    if configured:return configured
    candidate=ROOT.parent/'video-tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
    if candidate.exists():return str(candidate)
    import shutil
    found=shutil.which('ffmpeg')
    if found:return found
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:raise SystemExit('Set DAILYCOLLABS_FFMPEG to a working FFmpeg executable.')


def main():
    global SCREEN_CAPTURE_IMAGE
    parser=argparse.ArgumentParser()
    parser.add_argument('--poster-only',action='store_true')
    parser.add_argument('--screen-capture',default=os.environ.get('SCREEN_CAPTURE'),help='Path to an actual app screenshot, preserved in full on the laptop display.')
    args=parser.parse_args()
    if args.screen_capture:
        capture_path=Path(args.screen_capture).expanduser().resolve()
        if not capture_path.is_file():raise SystemExit(f'Actual screen capture does not exist: {capture_path}')
        SCREEN_CAPTURE_IMAGE=Image.open(capture_path).convert('RGB')
        print(f'Using actual app display: {capture_path}',flush=True)
    OUT.mkdir(parents=True,exist_ok=True)
    frame(5.4).save(OUT/'laptop-demo-poster.jpg',quality=94,subsampling=0)
    if args.poster_only:return
    ffmpeg=ffmpeg_path()
    command=[ffmpeg,'-y','-f','rawvideo','-vcodec','rawvideo','-s',f'{W}x{H}','-pix_fmt','rgb24','-r',str(FPS),'-i','-','-an','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',str(OUT/'laptop-demo.mp4')]
    process=subprocess.Popen(command,stdin=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        for index in range(FPS*DURATION):
            process.stdin.write(np.asarray(frame(index/FPS),dtype=np.uint8).tobytes())
            if index%FPS==0:print(f'Rendered {index//FPS}/{DURATION}s',flush=True)
        process.stdin.close()
        error=process.stderr.read().decode('utf8','replace')
        if process.wait()!=0:raise RuntimeError(error)
    except BaseException:
        process.kill();raise
    print(f'Rendered {W}x{H}, {FPS}fps, {DURATION}s H.264 MP4: {OUT / "laptop-demo.mp4"}',flush=True)

if __name__=='__main__':main()
