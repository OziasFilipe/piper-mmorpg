"""Gera imagens de interface: fundo do menu, logo do jogo e logo da Epiper Tecnologia.
Uso: python3 tools/gen_ui.py -> public/assets/ui/*"""
import math, os, random, shutil
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops

OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'ui')
FONTS = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'fonts')
os.makedirs(OUT, exist_ok=True); os.makedirs(FONTS, exist_ok=True)
LORA = '/usr/share/fonts/truetype/google-fonts/Lora-Variable.ttf'
POP = '/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf'
for f in (LORA, POP, '/usr/share/fonts/truetype/google-fonts/Poppins-Regular.ttf', '/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf'):
    shutil.copy(f, FONTS)
random.seed(7)

def lora(size, bold=True):
    f = ImageFont.truetype(LORA, size)
    try: f.set_variation_by_name('Bold' if bold else 'Regular')
    except Exception: pass
    return f
def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(len(a)))
def vgrad(w, h, stops):
    im = Image.new('RGB', (w, h)); px = im.load()
    for y in range(h):
        t = y / (h - 1)
        for i in range(len(stops) - 1):
            if stops[i][0] <= t <= stops[i + 1][0]:
                k = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]); c = lerp(stops[i][1], stops[i + 1][1], k); break
        for x in range(w): px[x, y] = c
    return im
def ridge(w, base, amp, rough, seed):
    rnd = random.Random(seed); pts = []
    octs = [(rnd.random() * 6.28, f, a) for f, a in ((0.002, 1), (0.006, 0.45), (0.017, 0.18 * rough), (0.05, 0.06 * rough))]
    for x in range(0, w + 8, 8):
        y = base - amp * sum(a * math.sin(x * f * 6.28 / 6.28 * 3.1 + ph) for ph, f, a in octs)
        pts.append((x, y))
    return pts

# ------------------------------------------------------------ FUNDO DO MENU
def menu_bg(W=1920, H=1080):
    sky = vgrad(W, H, [(0, (14, 18, 52)), (0.35, (52, 42, 108)), (0.55, (190, 96, 120)), (0.66, (250, 170, 110)), (1, (250, 200, 140))]).convert('RGBA')
    # estrelas
    st = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(st)
    for _ in range(420):
        x, y = random.random() * W, (random.random() ** 1.8) * H * 0.5; r = random.choice([0.6, 0.8, 1, 1.4, 2])
        a = int(255 * (1 - y / (H * 0.5)) * random.uniform(0.4, 1)); d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 250, 230, a))
    sky.alpha_composite(st)
    # lua com brilho
    gl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(gl)
    mx, my = int(W * 0.72), int(H * 0.26)
    d.ellipse([mx - 260, my - 260, mx + 260, my + 260], fill=(255, 220, 190, 70)); gl = gl.filter(ImageFilter.GaussianBlur(90)); sky.alpha_composite(gl)
    m = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(m)
    d.ellipse([mx - 90, my - 90, mx + 90, my + 90], fill=(255, 244, 222, 255))
    for _ in range(9):
        cx, cy, r = mx + random.randint(-60, 60), my + random.randint(-60, 60), random.randint(8, 22)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(238, 222, 200, 255))
    mask = Image.new('L', (W, H), 0); ImageDraw.Draw(mask).ellipse([mx - 90, my - 90, mx + 90, my + 90], fill=255)
    m.putalpha(ImageChops.multiply(m.getchannel('A'), mask)); sky.alpha_composite(m)
    # nuvens
    cl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(cl)
    for _ in range(26):
        cx, cy = random.randint(-100, W + 100), random.randint(int(H * 0.18), int(H * 0.5))
        for k in range(7):
            rx, ry = random.randint(60, 160), random.randint(18, 40)
            x = cx + random.randint(-140, 140); y = cy + random.randint(-12, 12)
            d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=(255, 190, 200, 38))
    sky.alpha_composite(cl.filter(ImageFilter.GaussianBlur(14)))
    # montanhas em camadas
    layers = [(H * 0.60, 170, 1.0, (122, 92, 150)), (H * 0.66, 120, 1.3, (88, 64, 118)), (H * 0.73, 90, 1.6, (58, 44, 86))]
    for i, (base, amp, rough, col) in enumerate(layers):
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        pts = ridge(W, base, amp, rough, 10 + i); d.polygon(pts + [(W, H), (0, H)], fill=col + (255,))
        # neve / borda iluminada
        hl = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(hl).line(pts, fill=(255, 200, 170, 90), width=3)
        im.alpha_composite(hl.filter(ImageFilter.GaussianBlur(1.5)))
        sky.alpha_composite(im)
        fog = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(fog).rectangle([0, base - 10, W, base + 90], fill=(255, 190, 180, 45))
        sky.alpha_composite(fog.filter(ImageFilter.GaussianBlur(40)))
    # castelo no penhasco
    cs = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(cs); C = (34, 24, 48, 255)
    cx, cy = int(W * 0.26), int(H * 0.60)
    d.polygon([(cx - 260, H), (cx - 170, cy + 40), (cx - 120, cy + 10), (cx + 140, cy + 14), (cx + 200, cy + 60), (cx + 300, H)], fill=C)
    towers = [(-110, 150, 34), (-40, 230, 44), (40, 180, 38), (110, 130, 30), (-170, 100, 24)]
    d.rectangle([cx - 130, cy - 80, cx + 125, cy + 20], fill=C)
    for x in range(cx - 130, cx + 125, 18): d.rectangle([x, cy - 92, x + 10, cy - 80], fill=C)
    for dx, h, w in towers:
        x = cx + dx; d.rectangle([x - w // 2, cy - h, x + w // 2, cy + 20], fill=C)
        d.polygon([(x - w // 2 - 8, cy - h), (x + w // 2 + 8, cy - h), (x, cy - h - w * 1.6)], fill=C)
        d.line([(x, cy - h - w * 1.6), (x, cy - h - w * 1.6 - 26)], fill=C, width=3)
        d.polygon([(x, cy - h - w * 1.6 - 26), (x + 22, cy - h - w * 1.6 - 20), (x, cy - h - w * 1.6 - 14)], fill=(200, 60, 60, 255))
    win = Image.new('RGBA', (W, H), (0, 0, 0, 0)); dw = ImageDraw.Draw(win)
    for dx, h, w in towers:
        x = cx + dx
        for k in range(2):
            y = cy - h + 30 + k * 46; dw.rounded_rectangle([x - 4, y, x + 4, y + 14], 4, fill=(255, 200, 110, 255))
    for k in range(7): x = cx - 105 + k * 34; dw.rounded_rectangle([x, cy - 50, x + 7, cy - 36], 3, fill=(255, 200, 110, 255))
    cs.alpha_composite(win.filter(ImageFilter.GaussianBlur(6))); cs.alpha_composite(win)
    sky.alpha_composite(cs)
    # florestas
    for i, (base, col, sz) in enumerate([(H * 0.80, (36, 40, 62), 60), (H * 0.88, (24, 28, 44), 85), (H * 0.97, (14, 16, 28), 120)]):
        im = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
        d.rectangle([0, base, W, H], fill=col + (255,))
        x = -40
        while x < W + 60:
            s = sz * random.uniform(0.7, 1.3); y = base + random.uniform(-10, 10)
            if random.random() < 0.6:
                for k in range(4):
                    ww = s * (0.55 - k * 0.1); yy = y - k * s * 0.35
                    d.polygon([(x - ww, yy), (x + ww, yy), (x, yy - s * 0.65)], fill=col + (255,))
            else:
                d.ellipse([x - s * 0.5, y - s * 1.1, x + s * 0.5, y - s * 0.1], fill=col + (255,)); d.rectangle([x - 4, y - s * 0.2, x + 4, y + 10], fill=col + (255,))
            x += s * random.uniform(0.45, 0.8)
        sky.alpha_composite(im)
        if i < 2:
            fog = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(fog).rectangle([0, base - 20, W, base + 60], fill=(200, 160, 200, 40))
            sky.alpha_composite(fog.filter(ImageFilter.GaussianBlur(30)))
    # vagalumes
    ff = Image.new('RGBA', (W, H), (0, 0, 0, 0)); d = ImageDraw.Draw(ff)
    for _ in range(70):
        x, y = random.random() * W, H * random.uniform(0.72, 1); r = random.uniform(1.5, 3.5)
        d.ellipse([x - r * 4, y - r * 4, x + r * 4, y + r * 4], fill=(255, 230, 120, 40)); d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 245, 170, 230))
    sky.alpha_composite(ff.filter(ImageFilter.GaussianBlur(1)))
    # vinheta
    v = Image.new('L', (W, H), 0); ImageDraw.Draw(v).ellipse([-W * 0.25, -H * 0.3, W * 1.25, H * 1.3], fill=255)
    v = v.filter(ImageFilter.GaussianBlur(160)); dark = Image.new('RGBA', (W, H), (6, 4, 14, 255)); dark.putalpha(ImageChops.invert(v).point(lambda a: int(a * 0.75)))
    sky.alpha_composite(dark)
    sky.convert('RGB').save(os.path.join(OUT, 'menu_bg.jpg'), quality=86, optimize=True); print('menu_bg')

# ------------------------------------------------------------ TEXTO DOURADO
def gold_text(text, font, pad=40, top=(255, 244, 196), mid=(242, 190, 70), bot=(170, 96, 26), stroke=6):
    d0 = ImageDraw.Draw(Image.new('L', (1, 1))); bb = d0.textbbox((0, 0), text, font=font, stroke_width=stroke)
    w, h = bb[2] - bb[0] + pad * 2, bb[3] - bb[1] + pad * 2
    m = Image.new('L', (w, h), 0); ImageDraw.Draw(m).text((pad - bb[0], pad - bb[1]), text, font=font, fill=255)
    ms = Image.new('L', (w, h), 0); ImageDraw.Draw(ms).text((pad - bb[0], pad - bb[1]), text, font=font, fill=255, stroke_width=stroke, stroke_fill=255)
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    sh = Image.new('RGBA', (w, h), (0, 0, 0, 0)); sh.paste((0, 0, 0, 200), (0, 0), ms.filter(ImageFilter.GaussianBlur(10)))
    out.alpha_composite(sh, (4, 8))
    out.paste((58, 26, 10, 255), (0, 0), ms)
    g = vgrad(w, h, [(0, top), (0.45, mid), (0.55, (220, 150, 40)), (1, bot)]).convert('RGBA'); out.paste(g, (0, 0), m)
    hl = ImageChops.subtract(m, ImageChops.offset(m, 0, 3)).point(lambda v: v * 200 // 255); out.paste((255, 255, 235), (0, 0), hl)
    return out

def logo():
    sub = gold_text('As Aventuras do', lora(78), top=(255, 250, 230), mid=(236, 214, 170), bot=(180, 150, 110), stroke=5)
    big = gold_text('PIPER', lora(250), stroke=10)
    W = max(sub.width, big.width) + 80; H = sub.height + big.height - 70
    M = 260; im = Image.new('RGBA', (W + 2 * M, H + 40 + 2 * M), (0, 0, 0, 0))
    # espada e cajado cruzados atrás
    deco = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(deco)
    cx, cy = W // 2 + M, sub.height + big.height // 2 - 40 + M
    def blade(angle, col, kind):
        L = Image.new('RGBA', (900, 900), (0, 0, 0, 0)); dl = ImageDraw.Draw(L)
        if kind == 'sword':
            dl.polygon([(440, 120), (460, 120), (468, 560), (450, 600), (432, 560)], fill=(220, 228, 240, 255), outline=(60, 60, 80, 255), width=4)
            dl.rounded_rectangle([380, 580, 520, 600], 8, fill=(226, 184, 74, 255), outline=(90, 50, 10, 255), width=4)
            dl.rounded_rectangle([440, 600, 460, 690], 6, fill=(110, 60, 30, 255), outline=(50, 25, 10, 255), width=3)
            dl.ellipse([432, 686, 468, 722], fill=(226, 184, 74, 255), outline=(90, 50, 10, 255), width=4)
        else:
            dl.rounded_rectangle([440, 170, 460, 780], 8, fill=(122, 74, 34, 255), outline=(50, 25, 10, 255), width=4)
            g = Image.new('RGBA', L.size, (0, 0, 0, 0)); ImageDraw.Draw(g).ellipse([380, 70, 520, 210], fill=(190, 120, 255, 200)); L.alpha_composite(g.filter(ImageFilter.GaussianBlur(26)))
            dl.ellipse([420, 110, 480, 170], fill=(206, 150, 255, 255), outline=(60, 20, 90, 255), width=4); dl.ellipse([432, 120, 448, 136], fill=(255, 255, 255, 230))
        L = L.rotate(angle, resample=Image.BICUBIC)
        deco.alpha_composite(L, (cx - 450, cy - 450))
    blade(-38, None, 'sword'); blade(38, None, 'staff')
    im.alpha_composite(deco)
    im.alpha_composite(sub, ((W - sub.width) // 2 + M, M))
    im.alpha_composite(big, ((W - big.width) // 2 + M, sub.height - 70 + M))
    im = im.crop(im.getbbox())
    im.save(os.path.join(OUT, 'logo.png'), optimize=True); print('logo', im.size)

def epiper():
    S = 420; im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    g = Image.new('RGBA', (S, S), (0, 0, 0, 0)); ImageDraw.Draw(g).ellipse([40, 40, S - 40, S - 40], fill=(80, 170, 255, 160)); im.alpha_composite(g.filter(ImageFilter.GaussianBlur(30)))
    m = Image.new('L', (S, S), 0); dm = ImageDraw.Draw(m)
    hexp = [(S / 2 + 150 * math.cos(math.radians(a)), S / 2 + 150 * math.sin(math.radians(a))) for a in range(-90, 270, 60)]
    dm.polygon(hexp, fill=255)
    grad = vgrad(S, S, [(0, (110, 210, 255)), (0.5, (40, 110, 230)), (1, (20, 40, 140))]).convert('RGBA')
    border = Image.new('L', (S, S), 0); ImageDraw.Draw(border).polygon(hexp, outline=255, width=10)
    im.paste(grad, (0, 0), m); im.paste((230, 245, 255, 255), (0, 0), border)
    f = ImageFont.truetype(POP, 200); d = ImageDraw.Draw(im)
    bb = d.textbbox((0, 0), 'E', font=f); d.text(((S - bb[2] - bb[0]) / 2, (S - bb[3] - bb[1]) / 2 - 6), 'E', font=f, fill=(255, 255, 255, 255))
    # circuitos
    for a in (30, 150, 270):
        x, y = S / 2 + 150 * math.cos(math.radians(a)), S / 2 + 150 * math.sin(math.radians(a))
        d.ellipse([x - 12, y - 12, x + 12, y + 12], fill=(255, 255, 255, 255))
    im.save(os.path.join(OUT, 'epiper.png'), optimize=True); print('epiper')

if __name__ == '__main__':
    epiper(); logo(); menu_bg()
