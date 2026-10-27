# Reuses the helpers from the close-view script (run from the repo root).
OUT='assets/wide/'  # outputs keep their original names; they were renamed when copied in
exec(open('tools/art/make_scenery.py').read().split('sk=sky()')[0])
FONT.update({'Q':'010101101111011','0':'111101101101111','1':'010110010010111','2':'110001010100111','3':'110001010001110',
'4':'101101111001001','5':'111100110001110','6':'011100111101111','7':'111001010010010','8':'111101111101111','9':'111101111001110','/':'001001010100100'})

def grad(W,H,stops,name):
    im=Image.new('RGBA',(W,H)); p=im.load()
    for y in range(H):
        for i in range(len(stops)-1):
            y0,c0=stops[i]; y1,c1=stops[i+1]
            if y0<=y<y1: break
        t=(y-y0)/max(1,(y1-y0))
        for x in range(W): p[x,y]=C(c1) if c0!=c1 and BAYER[y%4][x%4]/16<t else C(c0)
    im.save(OUT+name); return im

L=(-0.62,-0.78)
def clump(p,W,H,cx,cy,r,pal,rng):
    ph=[rng.uniform(0,6.28) for _ in range(3)]
    for y in range(int(cy-r-3),int(cy+r+3)):
        for x in range(int(cx-r-3),int(cx+r+3)):
            if not(0<=x<W and 0<=y<H): continue
            dx,dy=x+.5-cx,y+.5-cy; d=math.hypot(dx,dy); a=math.atan2(dy,dx)
            rr=r*(1+0.12*math.sin(5*a+ph[0])+0.08*math.sin(9*a+ph[1])+0.05*math.sin(14*a+ph[2]))
            if d>rr: continue
            nx,ny=dx/(rr+.01),dy/(rr+.01); l=-(nx*L[0]+ny*L[1])
            v=l+0.45+(BAYER[y%4][x%4]/16-0.5)*0.45+rng.uniform(-0.18,0.18)
            i=0 if v<-0.1 else 1 if v<0.4 else 2 if v<0.85 else 3
            if d>rr-1.2 and dy>-rr*0.3: i=0
            p[x,y]=C(pal[i])

# ---------- 7. WIDE TREELINE ----------
def treeline_wide():
    W,H=640,86; rng=random.Random(21); im=Image.new('RGBA',(W,H),T); p=im.load()
    layers=[(2,10,7,11,(10,16),[0,2,0,3]),(10,20,6,10,(8,13),[1,3,2,1]),
            (18,30,6,9,(7,12),[0,1,3,2]),(28,38,5,9,(7,11),[1,2,0,3]),(36,46,5,8,(6,10),[3,1,2,0])]
    for ymin,ymax,rmin,rmax,step,pals in layers:
        x=-8
        while x<W+8:
            r=rng.uniform(rmin,rmax); cy=rng.uniform(ymin,ymax)+r
            clump(p,W,H,x,cy,r,PAL[rng.choice(pals)],rng); x+=rng.uniform(*step)
    for y in range(52,H):
        for x in range(W):
            if p[x,y][3]==0: p[x,y]=C(PAL[0][1] if BAYER[y%4][x%4]<8 else PAL[0][0])
    outline(im,C('#143633')); im.save(OUT+'07_wide_treeline_640x86.png'); return im

# ---------- 8. WIDE STANDS ----------
def crowd_tiny(p,x0,x1,y0,y1,shaded,rng,seat):
    f=0.62 if shaded else 1.0
    for y in range(y0,y1):
        for x in range(x0,x1): p[x,y]=dark(C(seat),f if shaded else 1.0) if (y-y0)%3!=2 else dark(C(seat),0.7)
    r=0
    for y in range(y0,y1-1,3):
        off=r%2; r+=1
        for x in range(x0+off,x1,2):
            if rng.random()<0.08: continue
            hat=rng.random()<0.25
            p[x,y]=dark(C(rng.choice(HAT) if hat else rng.choice(SKIN)),f)
            p[x,y+1]=dark(C(rng.choice(SHIRT)),f)
def railing_t(p,x0,x1,y):
    for x in range(x0,x1): p[x,y]=C('#f4f4ee')
def bricks_t(p,x0,x1,y0,y1):
    for y in range(y0,y1):
        for x in range(x0,x1):
            row=(y-y0)//2
            p[x,y]=C('#7a3a28') if (y-y0)%2==1 and (x+row)%3==0 else C('#9c4a32' if (x+y)%5 else '#ad5639')
def pav_w(p,x0,x1,ry,rng,ped=False,tb=26):
    for y in range(ry,ry+9):
        for x in range(x0,x1):
            k=y-ry
            if k==0: c='#143633'
            elif k==1: c='#9cc06a'
            elif k==8: c='#f0efe6'
            else: c=('#7aa04c' if k<4 else '#6d9347') if x%2 else ('#628843' if k<4 else '#557636')
            p[x,y]=C(c)
    if ped:
        cx=(x0+x1)//2
        for k in range(5):
            w=k+1
            for x in range(cx-w,cx+w+1): p[x,ry-5+k+1]=C('#e8dcc0' if x<cx+w else '#b8a888')
            p[cx-w,ry-4+k]=C('#4a2a1c'); p[cx+w,ry-4+k]=C('#4a2a1c')
        for y in range(max(0,ry-10),ry-4): p[cx,y]=C('#d0d0c8')
        for y in range(max(0,ry-10),max(0,ry-8)):
            for x in range(cx+1,cx+4): p[x,y]=C('#2fa84f' if y%2 else '#ffc425')
    crowd_tiny(p,x0,x1,ry+9,tb,True,rng,'#3a2f2e')
    for x in range(x0+8,x1-3,18):
        for y in range(ry+9,tb): p[x,y]=C('#e8e8e0')
    railing_t(p,x0,x1,tb)
    crowd_tiny(p,x0,x1,tb+1,tb+10,False,rng,'#3d6e4a')
    railing_t(p,x0,x1,tb+10)
    bricks_t(p,x0,x1,tb+11,46)
    for wx in range(x0+3,x1-4,7):
        for dy in range(3):
            for dx in range(3): p[wx+dx,tb+13+dy]=C('#2a2430')
    for y in range(ry,46):
        if y>ry: p[x0,y]=C('#3a1d14')
        p[x1-2,y]=dark(p[x1-2,y],0.7); p[x1-1,y]=C('#3a1d14')
def terrace_w(p,x0,x1,top,rng):
    crowd_tiny(p,x0,x1,top,36,False,rng,'#8a8f99'); railing_t(p,x0,x1,36)
    for y in range(37,46):
        for x in range(x0,x1): p[x,y]=C('#c9bfa8' if y%3 else '#a59a82')
def flood_w(p,cx,bot):
    for y in range(6,bot):
        for dx in range(-1,2):
            c='#a8aeb4' if dx<0 else '#5c6268'
            if (y+dx)%3==0: c='#3a4044'
            p[cx+dx,y]=C(c)
        p[cx-2,y]=C('#1f2a2e'); p[cx+2,y]=C('#1f2a2e')
    for y in range(0,7):
        for x in range(cx-10,cx+10):
            if y in(0,6) or x in(cx-10,cx+9): c='#1f2a2e'
            elif y==1: c='#b0b6bc'
            elif x%2==0: c='#4a5056'
            else: c='#fff8d0' if y%2 else '#e8e0b0'
            p[x,y]=C(c)
def scoreboard(p,x0,x1,y0):
    for y in range(y0,46):
        for x in range(x0,x1):
            if y<y0+2: c='#b0b6bc' if y==y0+1 else '#1f2a2e'
            elif y>=y0+31: c='#c9bfa8' if (x-x0)%12>3 else '#7e7a6e'
            else: c='#1c2b25'
            if x in(x0,x1-1) and y<y0+31: c='#0e1612'
            p[x,y]=C(c)
    for y in range(y0+2,y0+31): p[x1-2,y]=C('#141f1a')
    cx=(x0+x1)//2
    for dy in range(-2,3):
        for dx in range(-2,3):
            if dx*dx+dy*dy<=5: p[cx+dx,y0+5+dy]=C('#f4f4ee')
    p[cx,y0+4]=C('#1c2b25'); p[cx,y0+5]=C('#1c2b25'); p[cx+1,y0+5]=C('#1c2b25')
    text(p,'AUS 3/245',x0+12,y0+10,'#ffd23a')
    text(p,'ENG 163',x0+12,y0+17,'#f4f4ee')
    for yy in(y0+24,y0+27):
        for x in range(x0+5,x1-6):
            if x%2==0 and (x-x0)%19<15: p[x,yy]=C('#e8e0b0')
def stands_wide():
    rng=random.Random(31); im=Image.new('RGBA',(640,46),T); p=im.load()
    flood_w(p,475,20)
    pav_w(p,0,104,8,rng)
    terrace_w(p,104,140,18,rng)
    pav_w(p,140,290,6,rng,ped=True)
    terrace_w(p,290,322,20,rng)
    pav_w(p,322,444,7,rng,ped=True)
    terrace_w(p,444,600,20,rng)
    scoreboard(p,525,585,4)
    pav_w(p,600,640,9,rng)
    im.save(OUT+'08_wide_grandstands_scoreboard_640x46.png'); return im

# ---------- 9. WIDE FENCES ----------
def fence_picket_w():
    im=Image.new('RGBA',(640,14),T); p=im.load()
    for x in range(640):
        for y in(3,7): p[x,y]=C('#d8dcd4'); p[x,y+1]=C('#9aa49c')
    for x0 in range(0,640,5):
        for y in range(1,11):
            for dx,c in enumerate(['#143633','#ffffff','#d8dcd4','#143633']): p[x0+dx,y]=C(c)
        p[x0+1,0]=C('#143633'); p[x0+2,0]=C('#143633')
    for x in range(640):
        p[x,11]=C('#1f4f2e'); p[x,12]=C('#2f6b2a'); p[x,13]=C('#3c812c' if (x%2) else '#2f6b2a')
    im.save(OUT+'09a_wide_fence_picket_640x14.png'); return im
def fence_ads_w():
    im=Image.new('RGBA',(640,14),T); p=im.load()
    ads=[('KOOKA COLA','#d82a2a','#ffffff','#ffd23a'),('SUNRAY','#ffc425','#1b3a8a','#e23b3b'),
         ('GUMLEAF','#0a7a3a','#ffffff','#f2d23a'),('BOUNDA','#1b3a8a','#ffd23a','#ffffff'),
         ('WATTLE BANK','#f2d23a','#0a5a2a','#0a7a3a'),('ZAPP','#9b30d0','#ffffff','#50e8ff'),
         ('PIE CO','#ffffff','#c8202a','#f08a24'),('HOOROO','#f08a24','#ffffff','#1b3a8a'),
         ('SNAG HQ','#2f6fe0','#ffffff','#ffd23a'),('DOOLEY TYRES','#202830','#ffc425','#e23b3b')]
    for i,(name,bg,fg,ic) in enumerate(ads):
        x0=i*64
        for y in range(14):
            for x in range(x0,x0+64):
                if y==0 or y==3 or y==12 or x==x0: c=C('#143633')
                elif y in(1,2): c=C('#d8dcd4' if y==1 else '#aab2ac')
                elif y==4: b=C(bg); c=(min(255,b[0]+40),min(255,b[1]+40),min(255,b[2]+40),255)
                elif y==11: c=dark(C(bg),0.8)
                elif y==13: c=C('#2f6b2a')
                else: c=C(bg)
                p[x,y]=c
        tw=len(name)*4-1; tx=x0+(64-tw)//2+3
        for dy in range(5):
            for dx in range(5):
                if (dx-2)**2+(dy-2)**2<=5: p[tx-7+dx,5+dy]=C(ic)
        text(p,name,tx,5,fg)
    im.save(OUT+'09b_wide_fence_ads_640x14.png'); return im

# ---------- 10. FOREGROUND TREES ----------
def leafy(p,W,H,cx,cy,R,pal,rng):
    subs=[]
    for i in range(int(R*R/14)):
        a=rng.uniform(0,6.28); d=R*math.sqrt(rng.random())
        subs.append((cx+d*math.cos(a),cy+d*math.sin(a),rng.uniform(4,7)))
    subs.sort(key=lambda s:s[1])
    for sx,sy,sr in subs:
        gx,gy=(sx-cx)/R,(sy-cy)/R; ph=rng.uniform(0,6.28)
        for y in range(int(sy-sr-2),int(sy+sr+2)):
            for x in range(int(sx-sr-2),int(sx+sr+2)):
                if not(0<=x<W and 0<=y<H): continue
                dx,dy=x+.5-sx,y+.5-sy; d=math.hypot(dx,dy); a=math.atan2(dy,dx)
                rr=sr*(1+0.18*math.sin(6*a+ph))
                if d>rr: continue
                l=-(0.55*(dx/rr*L[0]+dy/rr*L[1])+0.75*(gx*L[0]+gy*L[1]))
                v=l+0.35+(BAYER[y%4][x%4]/16-0.5)*0.4
                i=0 if v<-0.2 else 1 if v<0.3 else 2 if v<0.8 else 3
                if d>rr-1 and dy>0: i=max(0,i-2)
                p[x,y]=C(pal[i])
def fg_tree(W,H,right,seed,name):
    rng=random.Random(seed); im=Image.new('RGBA',(W,H),T); p=im.load()
    ox=W if right else 0
    def X(v): return ox-v if right else v
    for y in range(H):
        for x in range(W):
            u=(abs(x-ox))/(W*0.72); v=(H-y)/(H*0.62)
            if u*u+v*v<1: p[x,y]=C(PAL[0][0])
    pts=[]
    for k in range(13):
        t=k/12*math.pi/2+rng.uniform(-0.05,0.05); R=rng.uniform(17,27)
        bx=W*0.93*math.cos(t)-R*0.55*math.cos(t); by=H-H*0.84*math.sin(t)+R*0.55*math.sin(t)
        pts.append((X(bx),by,R))
    for _ in range(22):
        t=rng.uniform(0,math.pi/2); s=rng.uniform(0.05,0.8)
        pts.append((X(W*s*math.cos(t)),H-H*0.85*s*math.sin(t),rng.uniform(18,26)))
    pts.sort(key=lambda q:q[1])
    for cx,cy,R in pts: leafy(p,W,H,cx,cy,R,PAL[rng.choice([0,1,1,3,2])],rng)
    outline(im,C('#143633'))
    # keep screen-edge sides and bottom solid (no outline on the frame edges)
    for y in range(H):
        for x in range(W):
            edge = y==H-1 or (x==W-1 if right else x==0)
            if edge and p[x,y][3] and p[x,y]==C('#143633'): p[x,y]=C(PAL[0][1])
    im.save(OUT+name); return im

sw=grad(640,60,[(0,'#429efe'),(20,'#429efe'),(28,'#55aafe'),(42,'#55aafe'),(48,'#6bb4f0'),(52,'#6bb4f0'),(56,'#80bde1'),(60,'#80bde1')],'06_wide_sky_640x60.png')
tw=treeline_wide(); stw=stands_wide(); fpw=fence_picket_w(); faw=fence_ads_w()
fl=fg_tree(250,105,False,41,'10a_wide_foreground_trees_left_250x105.png')
fr=fg_tree(280,105,True,57,'10b_wide_foreground_trees_right_280x105.png')

ims=[cloud(w,random.Random(w)) for w in (24,40,30,56)]
def preview(fence,name):
    pv=Image.new('RGBA',(640,360)); pv.paste(sw,(0,0))
    for im,(x,y) in zip(ims,[(60,4),(250,8),(400,2),(540,10)]): pv.alpha_composite(im,(x,y))
    g=pv.load()
    for y in range(60,360):
        for x in range(640):
            g[x,y]=C('#5fa62e') if (x//40)%2 else C('#449131')
    for y in range(160,330):
        for x in range(300,340): g[x,y]=C('#c9b57a') if (x+y)%7 else C('#b8a468')
    pv.alpha_composite(tw,(0,14)); pv.alpha_composite(stw,(0,56)); pv.alpha_composite(fence,(0,98))
    pv.alpha_composite(fl,(0,255)); pv.alpha_composite(fr,(360,255))
    pv.resize((1280,720),Image.NEAREST).save(OUT+name)
preview(fpw,'preview_wide_picket_2x.png'); preview(faw,'preview_wide_ads_2x.png')
for f in sorted(__import__('glob').glob(OUT+'0[6-9]*.png')+__import__('glob').glob(OUT+'10*.png')):
    i=Image.open(f); print(f.split('/')[-1],i.size,sorted(set(i.getchannel('A').tobytes())))
