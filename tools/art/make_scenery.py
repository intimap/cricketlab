from PIL import Image
import random, math
OUT='assets/close/'  # run from the repo root (output names are renamed when copied in)
def C(h,a=255):
    h=h.lstrip('#'); return (int(h[0:2],16),int(h[2:4],16),int(h[4:6],16),a)
T=(0,0,0,0)
BAYER=[[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]
def dark(c,f=0.6): return (int(c[0]*f),int(c[1]*f),int(c[2]*f),255)

# ---------- 1. SKY ----------
def sky():
    im=Image.new('RGBA',(640,124)); p=im.load()
    stops=[(0,'#429efe'),(46,'#429efe'),(56,'#55aafe'),(86,'#55aafe'),(96,'#6bb4f0'),(106,'#6bb4f0'),(114,'#80bde1'),(124,'#80bde1')]
    for y in range(124):
        for i in range(len(stops)-1):
            y0,c0=stops[i]; y1,c1=stops[i+1]
            if y0<=y<y1: break
        t=(y-y0)/max(1,(y1-y0))
        for x in range(640):
            p[x,y]=C(c1) if c0!=c1 and BAYER[y%4][x%4]/16<t else C(c0)
    im.save(OUT+'01_close_sky_640x124.png'); return im

# ---------- helpers ----------
def outline(im,col):
    p=im.load(); w,h=im.size; edge=[]
    for y in range(h):
        for x in range(w):
            if p[x,y][3]==0: continue
            for dx,dy in((1,0),(-1,0),(0,1),(0,-1)):
                nx,ny=x+dx,y+dy
                if 0<=nx<w and 0<=ny<h and p[nx,ny][3]==0: edge.append((x,y));break
    for x,y in edge: p[x,y]=col

# ---------- 2. CLOUDS ----------
def cloud(w,rng):
    h=int(w*0.55)+4; m=set()
    base=h-1; base_h=max(3,w//8)
    blobs=[(w/2,base-base_h/2,w/2-2,base_h/2+1)]
    n=max(3,w//8)
    for i in range(n):
        t=i/max(1,n-1); mid=1-abs(t-0.5)*2
        r=(0.09+0.13*mid)*w*rng.uniform(0.8,1.25)+2.5
        cx=min(max(r,w*(0.2+0.6*t)+rng.uniform(-2,2)),w-r)
        cy=base-base_h*0.6-r*rng.uniform(0.35,0.8)
        blobs.append((cx,cy,r,r))
    for y in range(h):
        for x in range(w):
            for cx,cy,rx,ry in blobs:
                if y<=base and ((x+.5-cx)/rx)**2+((y+.5-cy)/ry)**2<=1: m.add((x,y));break
    top=min(y for _,y in m); h2=base-top+1
    im=Image.new('RGBA',(w,h2),T); p=im.load()
    under=max(2,h2//4)
    for x,y in m:
        yy=y-top
        if yy>=h2-under: c='#b5c5d6' if yy>=h2-max(1,under//2) else '#c9d4de'
        elif (x+2,y+2) not in m: c='#c9d4de'
        elif (x-2,y-2) not in m or (x-1,y-3) not in m: c='#f7f8f4'
        else: c='#e2e4de'
        p[x,yy]=C(c)
    outline(im,C('#9bb2c8'))
    return im
def clouds():
    rng=random.Random(7)
    widths=[20,26,32,38,46,54,62,70,80,90]
    ims=[cloud(w,rng) for w in widths]
    sheet=Image.new('RGBA',(400,120),T); x=4;y=4;rowh=0; boxes=[]
    for im in ims:
        if x+im.width>396: x=4;y+=rowh+6;rowh=0
        sheet.paste(im,(x,y),im); boxes.append((x,y,im.width,im.height))
        x+=im.width+8; rowh=max(rowh,im.height)
    sheet=sheet.crop((0,0,400,y+rowh+4)); sheet.save(OUT+'02_clouds_sheet.png')
    return ims,boxes

# ---------- 3. TREELINE ----------
PAL=[('#1f4f2e','#2f6b2a','#3c812c','#5fa62e'),
     ('#22512f','#3c812c','#449131','#6db33a'),
     ('#2e4f35','#4d6e3f','#6d9347','#8eae5c'),
     ('#29572c','#3f7a33','#5a8f3a','#7aa848')]
def treeline(W=640,H=74,seed=3,scale=1.0,solid_from=44,name='03_close_treeline_640x74.png'):
    rng=random.Random(seed); im=Image.new('RGBA',(W,H),T); p=im.load()
    L=(-0.62,-0.78)
    def clump(cx,cy,r,pal):
        ph=[rng.uniform(0,6.28) for _ in range(3)]
        for y in range(int(cy-r-3),int(cy+r+3)):
            for x in range(int(cx-r-3),int(cx+r+3)):
                if not(0<=x<W and 0<=y<H): continue
                dx,dy=x+.5-cx,y+.5-cy; d=math.hypot(dx,dy); a=math.atan2(dy,dx)
                rr=r*(1+0.10*math.sin(5*a+ph[0])+0.07*math.sin(9*a+ph[1])+0.05*math.sin(14*a+ph[2]))
                if d>rr: continue
                nx,ny=dx/(rr+.01),dy/(rr+.01); l=-(nx*L[0]+ny*L[1])
                v=l+0.35+ (BAYER[y%4][x%4]/16-0.5)*0.45 + rng.uniform(-0.18,0.18)
                i=0 if v<-0.15 else 1 if v<0.35 else 2 if v<0.8 else 3
                if d>rr-1.2 and dy>-rr*0.3: i=0
                p[x,y]=C(pal[i])
    # back row (darker, taller) then front row
    for layer,(ymin,ymax,rmin,rmax,step,pals) in enumerate([
        (4,18,11,18,(16,26),[0,2,0,3]),
        (16,30,9,15,(12,20),[1,3,2,1,0]),
        (30,44,9,14,(11,17),[0,1,3,2])]):
        x=-10
        while x<W+10:
            r=rng.uniform(rmin,rmax)*scale; cy=rng.uniform(ymin,ymax)*scale+r
            clump(x,cy,r,PAL[rng.choice(pals)]); x+=rng.uniform(*step)*scale
    for y in range(solid_from,H):
        for x in range(W):
            if p[x,y][3]==0: p[x,y]=C(PAL[0][1] if BAYER[y%4][x%4]<8 else PAL[0][0])
    # a few pale gum-trunk forks peeking through canopy
    for _ in range(0):
        x=rng.randrange(10,W-10); y0=int(rng.uniform(22,34)*scale)
        for k in range(10):
            yy=y0+k
            if yy<H and p[x,yy][3]: p[x,yy]=C('#d9d2c0'); 
            if yy<H and x+1<W and p[x+1,yy][3]: p[x+1,yy]=C('#a99f8a')
    outline(im,C('#143633'))
    im.save(OUT+name); return im

# ---------- crowd ----------
SKIN=['#f2c8a0','#e0a878','#b07444','#7a4a2a','#f6d6b8']
SHIRT=['#e23b3b','#f2d23a','#2f6fe0','#ffffff','#2fa84f','#f08a24','#9b4fd0','#1b3a8a','#e86aa8','#ffc425','#0a7a3a','#50c8e8']
HAT=['#f4f0e0','#ffd23a','#1b3a8a','#0a7a3a','#e23b3b']
def crowd(p,x0,x1,y0,y1,shaded,rng,seat):
    for y in range(y0,y1):
        for x in range(x0,x1): p[x,y]=C(seat) if (y-y0)%4!=3 else dark(C(seat),0.7)
    r=0
    for y in range(y0,y1-3,4):
        off=(r%2)*2; r+=1
        for x in range(x0+off,x1-1,3):
            if rng.random()<0.07: continue
            sk=C(rng.choice(SKIN)); sh=C(rng.choice(SHIRT))
            hat=C(rng.choice(HAT)) if rng.random()<0.25 else None
            f=0.62 if shaded else 1.0
            for dx in(0,1):
                p[x+dx,y]=dark(hat or sk,f)
                p[x+dx,y+1]=dark(sk,f)
                p[x+dx,y+2]=dark(sh,f)
            p[x+1,y+2]=dark(sh,f*0.8)

def bricks(p,x0,x1,y0,y1):
    for y in range(y0,y1):
        for x in range(x0,x1):
            row=(y-y0)//3
            if (y-y0)%3==2 or (x+(row%2)*2)%5==0: c='#7a3a28'
            else: c='#9c4a32' if (x+y)%7 else '#ad5639'
            p[x,y]=C(c)

def railing(p,x0,x1,y):
    for x in range(x0,x1):
        p[x,y]=C('#f4f4ee'); p[x,y+1]=C('#f4f4ee') if x%3==0 else C('#2a2430')

def pavilion(p,x0,x1,ry,rng,pediment=False,tier_bot=30):
    # roof
    for y in range(ry,ry+7):
        for x in range(x0,x1):
            c='#86ab55' if y==ry+1 else ('#6d9347' if x%2 else '#557636')
            if y==ry+6: c='#3f5a2a'
            p[x,y]=C(c)
    for x in range(x0,x1): p[x,ry]=C('#143633'); p[x,ry+7]=C('#f0efe6'); p[x,ry+8]=C('#f0efe6') if x%2==0 else C('#2a2226')
    if pediment:
        cx=(x0+x1)//2; hgt=7
        for k in range(hgt):
            w=(k+1)*2
            for x in range(cx-w,cx+w+1): p[x,ry-hgt+k]=C('#e8dcc0') if x<cx+w-1 else C('#b8a888')
            p[cx-w,ry-hgt+k]=C('#4a2a1c'); p[cx+w,ry-hgt+k]=C('#4a2a1c')
        p[cx,ry-hgt]=C('#4a2a1c')
        for dx in(-1,0,1):
            for dy in(-1,0,1): p[cx+dx,ry-3+dy]=C('#2a2430')
        p[cx,ry-3]=C('#f4f4ee')
        for y in range(max(0,ry-hgt-9),ry-hgt): p[cx,y]=C('#d0d0c8')
        for y in range(max(0,ry-hgt-9),max(0,ry-hgt-6)):
            for x in range(cx+1,cx+5): p[x,y]=C('#2fa84f') if y%2 else C('#ffc425')
    # covered tier
    crowd(p,x0,x1,ry+9,tier_bot,True,rng,'#3a2f2e')
    for x in range(x0+10,x1-4,22):
        for y in range(ry+9,tier_bot): p[x,y]=C('#e8e8e0'); p[x+1,y]=C('#8a8a84')
    railing(p,x0,x1,tier_bot); 
    crowd(p,x0,x1,tier_bot+2,tier_bot+11,False,rng,'#3d6e4a')
    railing(p,x0,x1,tier_bot+11)
    bricks(p,x0,x1,tier_bot+13,60)
    # windows
    for wx in range(x0+5,x1-6,11):
        y=tier_bot+15
        for dy in range(7):
            for dx in range(5):
                if dy==0 and dx in(0,4): continue
                p[wx+dx,y+dy]=C('#2a2430')
        p[wx+1,y+1]=C('#5a5870'); p[wx+1,y+2]=C('#5a5870')
        for dx in range(-1,6): p[wx+dx,y+7]=C('#e6dcc4')
    # edges: outline left, shadow right
    for y in range(ry,60):
        p[x0,y]=C('#3a1d14') if y>ry else p[x0,y]
        for k in(1,2):
            q=p[x1-k,y]; p[x1-k,y]=dark(q,0.7)
        p[x1-1,y]=C('#3a1d14')

def terrace(p,x0,x1,top,rng):
    crowd(p,x0,x1,top,43,False,rng,'#8a8f99')
    railing(p,x0,x1,43)
    for y in range(45,60):
        for x in range(x0,x1): p[x,y]=C('#c9bfa8') if (y%4) else C('#a59a82')
    for y in range(top,60): p[x1-1,y]=dark(p[x1-1,y],0.7)

def floodlight(p,cx,mast_bot):
    for y in range(9,mast_bot):
        for dx in range(-2,2):
            x=cx+dx; c='#a8aeb4' if dx<0 else '#5c6268'
            if (y+dx)%4==0 or (y-dx)%4==0: c='#3a4044'
            p[x,y]=C(c)
        p[cx-3,y]=C('#1f2a2e'); p[cx+2,y]=C('#1f2a2e')
    for y in range(0,10):
        for x in range(cx-14,cx+14):
            if y in(0,9) or x in(cx-14,cx+13): c='#1f2a2e'
            elif y%3==0 or x%3==0: c='#4a5056'
            else: c='#fff8d0' if (x+y)%2 else '#e8e0b0'
            p[x,y]=C(c)

def stands():
    rng=random.Random(11); im=Image.new('RGBA',(640,60),T); p=im.load()
    floodlight(p,425,33)
    pavilion(p,0,92,10,rng)
    terrace(p,92,138,22,rng)
    pavilion(p,138,276,7,rng,pediment=True)
    terrace(p,276,288,31,rng)
    # sightscreen
    for y in range(14,60):
        for x in range(288,352):
            c='#3b4046'
            if x==288 or y==14: c='#23282c'
            elif x==289 or y==15: c='#55606a'
            elif x>=350: c='#2a2e33'
            p[x,y]=C(c)
    terrace(p,352,364,31,rng)
    pavilion(p,364,410,12,rng)
    terrace(p,410,440,33,rng)
    pavilion(p,440,540,9,rng,pediment=True)
    terrace(p,540,556,27,rng)
    pavilion(p,556,640,11,rng)
    im.save(OUT+'04_close_grandstands_640x60.png'); return im

# ---------- 5. FENCE ----------
FONT={'A':'010101111101101','B':'110101110101110','C':'011100100100011','D':'110101101101110','E':'111100110100111',
'F':'111100110100100','G':'011100101101011','H':'101101111101101','I':'111010010010111','K':'101101110101101',
'L':'100100100100111','M':'101111111101101','N':'110101101101101','O':'010101101101010','P':'110101110100100',
'R':'110101110101101','S':'011100010001110','T':'111010010010010','U':'101101101101111','W':'101101111111101',
'Y':'101101010010010','Z':'111001010100111',' ':'000000000000000'}
def text(p,s,x,y,col):
    for ch in s:
        g=FONT[ch]
        for i in range(15):
            if g[i]=='1': p[x+i%3,y+i//3]=C(col)
        x+=4
def fence_picket():
    im=Image.new('RGBA',(640,12),T); p=im.load()
    for x in range(640):
        for y in(4,8): p[x,y]=C('#d8dcd4'); p[x,y+1]=C('#9aa49c')
    for x0 in range(0,640,6):
        for y in range(1,11):
            for dx,c in enumerate(['#143633','#ffffff','#d8dcd4','#143633']):
                p[x0+dx,y]=C(c)
        p[x0+1,0]=C('#143633'); p[x0+2,0]=C('#143633')
    for x in range(640): p[x,11]=C('#2f6b2a')
    im.save(OUT+'05a_close_fence_picket_640x12.png'); return im
def fence_ads():
    im=Image.new('RGBA',(640,12),T); p=im.load()
    ads=[('KOOKA COLA','#d82a2a','#ffffff','#ffd23a'),('SUNRAY','#ffc425','#1b3a8a','#e23b3b'),
         ('GUMLEAF','#0a7a3a','#ffffff','#f2d23a'),('BOUNDA','#1b3a8a','#ffd23a','#ffffff'),
         ('WATTLE BANK','#f2d23a','#0a5a2a','#0a7a3a'),('ZAPP','#9b30d0','#ffffff','#50e8ff'),
         ('PIE CO','#ffffff','#c8202a','#f08a24'),('DOOLEY TYRES','#202830','#ffc425','#e23b3b')]
    for i,(name,bg,fg,ic) in enumerate(ads):
        x0=i*80
        for y in range(0,12):
            for x in range(x0,x0+80):
                c=bg
                if y==0 or y==10 or x==x0: c='#143633'
                elif y==1: c=tuple(min(255,v+40) for v in C(bg)[:3])
                elif y==9: c=dark(C(bg),0.8)
                elif y==11: c='#1f3a2c'
                p[x,y]=C(c) if isinstance(c,str) else (c[0],c[1],c[2],255)
        tw=len(name)*4-1; tx=x0+(80-tw)//2+4
        for dy in range(5):
            for dx in range(5):
                if (dx-2)**2+(dy-2)**2<=5: p[tx-8+dx,3+dy]=C(ic)
        text(p,name,tx,3,fg)
    im.save(OUT+'05b_close_fence_ads_640x12.png'); return im

sk=sky(); cl,_=clouds(); tr=treeline(); st=stands(); fa=fence_picket(); fb=fence_ads()

# ---------- preview ----------
def preview(fence,name):
    pv=Image.new('RGBA',(640,190)); pv.paste(sk,(0,0))
    for im,(x,y) in zip(cl,[(20,6),(560,30),(120,20),(300,4),(420,16),(220,34),(500,2),(30,26),(470,40),(170,0)]):
        pv.alpha_composite(im,(x,y))
    pv.alpha_composite(tr,(0,28)); pv.alpha_composite(st,(0,58)); pv.alpha_composite(fence,(0,112))
    g=pv.load()
    for y in range(124,190):
        for x in range(640): g[x,y]=C('#5fa62e') if ((x+ (y-124)*3)//40)%2 else C('#449131')
    pv.resize((1280,380),Image.NEAREST).save(OUT+name)
preview(fa,'preview_close_picket_2x.png'); preview(fb,'preview_close_ads_2x.png')
