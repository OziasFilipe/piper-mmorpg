"""Gera as folhas de sprites dos personagens (camadas tipo 'paper doll') em PNG.
Cada folha: 3 colunas (parado, passo1, passo2) x 4 linhas (baixo, esquerda, cima, direita).
Célula final 128x192 (desenhada em coordenadas lógicas 64x96, supersample 8x).
Uso: python3 tools/gen_chars.py  -> public/assets/chars/*.png + manifest.json
"""
import json, math, os, sys
from PIL import Image, ImageDraw, ImageFilter, ImageChops

LW, LH = 64, 96           # coordenadas lógicas
OUT_SCALE = 2             # célula final 128x192
SS = 6                    # supersample sobre o lógico
CW, CH = LW * SS, LH * SS
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'chars')
os.makedirs(OUT, exist_ok=True)

def hx(c):
    c = c.lstrip('#'); return tuple(int(c[i:i + 2], 16) for i in (0, 2, 4))
def mul(c, f):
    r, g, b = hx(c) if isinstance(c, str) else c[:3]
    return tuple(max(0, min(255, int(v * f))) for v in (r, g, b))
def mix(a, b, t):
    a = hx(a) if isinstance(a, str) else a; b = hx(b) if isinstance(b, str) else b
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def S(v): return v * SS
def mask(kind, g):
    m = Image.new('L', (CW, CH), 0); d = ImageDraw.Draw(m)
    if kind == 'ell': d.ellipse([S(g[0]), S(g[1]), S(g[2]), S(g[3])], fill=255)
    elif kind == 'rect': d.rounded_rectangle([S(g[0]), S(g[1]), S(g[2]), S(g[3])], radius=S(g[4]) if len(g) > 4 else 0, fill=255)
    elif kind == 'poly': d.polygon([(S(x), S(y)) for x, y in g], fill=255)
    elif kind == 'line': d.line([(S(x), S(y)) for x, y in g[0]], fill=255, width=int(S(g[1])), joint='curve')
    elif kind == 'arc': d.arc([S(g[0]), S(g[1]), S(g[2]), S(g[3])], g[4], g[5], fill=255, width=int(S(g[6])))
    return m

OLF = 2 * int(0.85 * SS) + 1
def paint(img, m, color, outline=True, shade=True, ol=None, clip=None, alpha=255, soft=1.0):
    if clip is not None: m = ImageChops.multiply(m, clip)
    col = hx(color) if isinstance(color, str) else color
    if outline:
        o = m.filter(ImageFilter.MaxFilter(OLF))
        img.paste(ol or mul(col, 0.32), (0, 0), o)
    if alpha < 255: m2 = m.point(lambda v: v * alpha // 255)
    else: m2 = m
    img.paste(col, (0, 0), m2)
    if shade:
        k = int(S(2.6) * soft)
        sh = ImageChops.subtract(m, ImageChops.offset(m, -k, -int(k * 0.8))).filter(ImageFilter.GaussianBlur(S(1.1)))
        sh = ImageChops.multiply(sh, m)
        img.paste(mul(col, 0.72), (0, 0), sh)
        k2 = int(S(1.6) * soft)
        hl = ImageChops.subtract(m, ImageChops.offset(m, k2, k2)).filter(ImageFilter.GaussianBlur(S(0.8)))
        hl = ImageChops.multiply(hl, m).point(lambda v: v * 160 // 255)
        img.paste(mix(col, (255, 255, 255), 0.28), (0, 0), hl)
    return m

def P(img, kind, g, color, **kw): return paint(img, mask(kind, g), color, **kw)
def new(): return Image.new('RGBA', (CW, CH), (0, 0, 0, 0))

# ------------------------------------------------------------------ POSES
def pose(d, f):
    bob = -1 if f else 0
    p = {'bob': bob, 'd': d}
    if d in (0, 2):
        p['legL'] = 2.2 if f == 1 else 0; p['legR'] = 2.2 if f == 2 else 0
        p['armL'] = -1.5 if f == 1 else (1.5 if f == 2 else 0); p['armR'] = -p['armL']
        p['handL'] = (17, 73 + bob + p['armL']); p['handR'] = (47, 73 + bob + p['armR'])
        p['head'] = (13, 14 + bob, 51, 52 + bob)
    else:
        p['front'] = -4 if f == 1 else (4 if f == 2 else 0)
        p['arm'] = 3 if f == 1 else (-3 if f == 2 else 0)
        p['hand'] = (32.5 + p['arm'], 73 + bob)
        p['head'] = (12, 14 + bob, 48, 52 + bob)
    return p

# ------------------------------------------------------------------ CORPO
EYE = '#3b6fb6'
def body(img, p, skin, pants='#3b3f58', shirt='#e9dfc6', boots='#5a3a22'):
    b = p['bob']
    if p['d'] in (0, 2):
        for (x0, x1, lift) in ((24, 31, p['legL']), (33, 40, p['legR'])):
            P(img, 'rect', (x0, 69 + b, x1, 86 - lift, 2), pants)
            P(img, 'rect', (x0 - 1, 81 - lift, x1 + 1, 91 - lift, 3), boots)
        for (x0, x1, a) in ((13, 21, p['armL']), (43, 51, p['armR'])):
            P(img, 'rect', (x0, 53 + b + a, x1, 71 + b + a, 4), shirt)
        P(img, 'rect', (20, 51 + b, 44, 75 + b, 7), shirt)
        for (hx_, hy) in (p['handL'], p['handR']):
            P(img, 'ell', (hx_ - 4, hy - 4, hx_ + 4, hy + 4), skin)
        P(img, 'rect', (28, 47 + b, 36, 54 + b, 2), skin, shade=False)
        if p['d'] == 0:
            P(img, 'ell', (10, 31 + b, 17, 41 + b), skin); P(img, 'ell', (47, 31 + b, 54, 41 + b), skin)
        P(img, 'ell', p['head'], skin, soft=1.4)
        if p['d'] == 0: face_front(img, b, skin)
    else:
        fr = p['front']
        for (dx, c) in ((-fr, mul(pants, 0.8)), (fr, pants)):
            x0 = 27 + dx; P(img, 'rect', (x0, 69 + b, x0 + 8, 86, 2), c)
            P(img, 'rect', (x0 - 2, 81, x0 + 8, 91, 3), boots if c == pants else mul(boots, 0.8))
        P(img, 'rect', (23, 51 + b, 41, 75 + b, 7), shirt)
        P(img, 'rect', (28, 47 + b, 35, 54 + b, 2), skin, shade=False)
        P(img, 'ell', p['head'], skin, soft=1.4)
        P(img, 'ell', (33, 33 + b, 40, 43 + b), skin)
        face_side(img, b, skin)
        ax = 28.5 + p['arm']
        P(img, 'rect', (ax, 53 + b, ax + 8, 71 + b, 4), shirt)
        hx_, hy = p['hand']; P(img, 'ell', (hx_ - 4, hy - 4, hx_ + 4, hy + 4), skin)

def eye(img, x, y, w=6.5):
    P(img, 'ell', (x, y, x + w, y + 9.5), '#2a2030', outline=False, shade=False)
    P(img, 'ell', (x + 0.6, y + 3.4, x + w - 0.6, y + 9), EYE, outline=False, shade=False)
    P(img, 'ell', (x + 1.6, y + 5.5, x + w - 1.6, y + 8.4), mul(EYE, 0.55), outline=False, shade=False)
    P(img, 'ell', (x + 0.9, y + 1.0, x + 3.6, y + 3.8), '#ffffff', outline=False, shade=False)
    P(img, 'ell', (x + w - 2.2, y + 6.6, x + w - 1.0, y + 7.8), '#ffffff', outline=False, shade=False)
def face_front(img, b, skin):
    eye(img, 21.5, 32.5 + b); eye(img, 36, 32.5 + b)
    P(img, 'ell', (17.5, 42.5 + b, 23.5, 46 + b), '#f08080', outline=False, shade=False, alpha=110)
    P(img, 'ell', (40.5, 42.5 + b, 46.5, 46 + b), '#f08080', outline=False, shade=False, alpha=110)
    P(img, 'ell', (31.3, 41.2 + b, 32.7, 42.4 + b), mul(skin, 0.75), outline=False, shade=False)
    P(img, 'arc', (29, 43.5 + b, 35, 48 + b, 20, 160, 1.1), '#7a2f2f', outline=False, shade=False)
def face_side(img, b, skin):
    eye(img, 16.5, 32.5 + b, 5.5)
    P(img, 'ell', (9.6, 38.5 + b, 14.5, 43 + b), skin, shade=False)
    P(img, 'ell', (15.5, 43 + b, 21, 46.3 + b), '#f08080', outline=False, shade=False, alpha=110)
    P(img, 'arc', (13.5, 44 + b, 18, 48 + b, 30, 150, 1.0), '#7a2f2f', outline=False, shade=False)

# ------------------------------------------------------------------ CABELO
def hair(img, p, style, col, part):
    b = p['bob']; d = p['d']; c = col
    if part == 'back':   # desenhado antes do corpo
        if style == 'longo':
            if d == 0: P(img, 'rect', (12, 26 + b, 52, 68 + b, 8), mul(c, 0.85))
            elif d == 2: pass
            else: P(img, 'rect', (28, 26 + b, 47, 68 + b, 7), mul(c, 0.85))
        return
    if d == 0:
        P(img, 'ell', (11, 10 + b, 53, 40 + b), c, clip=mask('rect', (0, 0, 64, 31 + b)))
        bangs = [(12, 30 + b), (16, 25 + b), (19, 35 + b), (23, 26 + b), (27, 33 + b), (31, 25 + b), (35, 33 + b), (39, 26 + b), (44, 35 + b), (47, 25 + b), (52, 30 + b), (52, 22 + b), (12, 22 + b)]
        P(img, 'poly', bangs, c)
        P(img, 'poly', [(11, 24 + b), (17, 24 + b), (16, 46 + b), (11, 42 + b)], c)
        P(img, 'poly', [(53, 24 + b), (47, 24 + b), (48, 46 + b), (53, 42 + b)], c)
        if style == 'longo':
            P(img, 'rect', (10, 30 + b, 17, 66 + b, 4), c); P(img, 'rect', (47, 30 + b, 54, 66 + b, 4), c)
        P(img, 'line', ([(21.5, 30.5 + b), (27.5, 29.8 + b)], 1.3), mul(c, 0.6), outline=False, shade=False)
        P(img, 'line', ([(36.5, 29.8 + b), (42.5, 30.5 + b)], 1.3), mul(c, 0.6), outline=False, shade=False)
        P(img, 'ell', (20, 13 + b, 30, 18 + b), mix(c, '#ffffff', 0.35), outline=False, shade=False, alpha=150)
    elif d == 2:
        if style == 'longo': P(img, 'rect', (11, 22 + b, 53, 70 + b, 9), c)
        P(img, 'ell', (11, 10 + b, 53, 52 + b), c)
        if style == 'rabo':
            P(img, 'ell', (28, 42 + b, 36, 50 + b), '#c03040')
            P(img, 'poly', [(27, 48 + b), (37, 48 + b), (35, 68 + b), (32, 72 + b), (29, 68 + b)], c)
        P(img, 'ell', (20, 13 + b, 32, 19 + b), mix(c, '#ffffff', 0.35), outline=False, shade=False, alpha=150)
    else:
        P(img, 'ell', (10, 10 + b, 50, 40 + b), c, clip=mask('rect', (0, 0, 64, 31 + b)))
        P(img, 'poly', [(30, 18 + b), (49, 22 + b), (50, 44 + b), (40, 50 + b), (32, 44 + b)], c)
        P(img, 'poly', [(10, 30 + b), (13, 22 + b), (24, 18 + b), (24, 27 + b), (19, 25 + b), (15, 34 + b)], c)
        if style == 'longo': P(img, 'poly', [(32, 30 + b), (49, 30 + b), (48, 68 + b), (34, 66 + b)], c)
        if style == 'rabo':
            P(img, 'ell', (45, 30 + b, 52, 38 + b), '#c03040')
            P(img, 'poly', [(49, 32 + b), (60, 40 + b), (58, 58 + b), (53, 63 + b), (50, 48 + b)], c)
        P(img, 'line', ([(16, 30.5 + b), (22.5, 30 + b)], 1.3), mul(c, 0.6), outline=False, shade=False)
        P(img, 'ell', (18, 13 + b, 28, 18 + b), mix(c, '#ffffff', 0.35), outline=False, shade=False, alpha=150)

def beard(img, p, c):
    b = p['bob']; d = p['d']
    if d == 0:
        P(img, 'poly', [(17, 40 + b), (21, 46 + b), (43, 46 + b), (47, 40 + b), (45, 52 + b), (38, 60 + b), (32, 63 + b), (26, 60 + b), (19, 52 + b)], c)
        P(img, 'arc', (28, 44 + b, 36, 49 + b, 20, 160, 1.1), '#5a2a2a', outline=False, shade=False)
    elif d in (1, 3):
        P(img, 'poly', [(11, 42 + b), (16, 45 + b), (26, 44 + b), (32, 40 + b), (31, 52 + b), (22, 60 + b), (14, 56 + b)], c)

# ------------------------------------------------------------------ ARMADURAS
ARMORS = {
    'none':      dict(kind='shirt'),
    'a_cloth':   dict(base='#9c8358', trim='#6e5634', kind='tunic', robe='#5b3fa0', rtrim='#e2b84a'),
    'a_leather': dict(base='#8a5530', trim='#5e3518', kind='leather', robe='#6e4a2c', rtrim='#d9a441'),
    'a_chain':   dict(base='#9aa4b0', trim='#5d6670', kind='chain', robe='#5d6f88', rtrim='#cfd8e0'),
    'a_plate':   dict(base='#cfd7e0', trim='#7d8794', kind='plate', robe='#cfd7e0', rtrim='#7d8794'),
    'a_robe':    dict(base='#2c3a8f', trim='#e2b84a', kind='tunic', robe='#24307e', rtrim='#f0c850', stars=True),
    'a_dragon':  dict(base='#b02a2e', trim='#e8b84a', kind='dragon', robe='#a0222a', rtrim='#f0c050'),
    'n_apron':   dict(base='#6b4a2a', trim='#3a2614', kind='apron'),
    'n_green':   dict(robe='#2f8a58', rtrim='#e2b84a', kind='robeonly'),
    'n_white':   dict(robe='#ecebe6', rtrim='#d4a93a', kind='robeonly'),
}
def armor(img, p, aid, robe):
    A = ARMORS[aid]; b = p['bob']; d = p['d']
    if A['kind'] == 'shirt': return
    if robe or A['kind'] == 'robeonly':
        rc, tc = A['robe'], A['rtrim']
        if d in (0, 2):
            P(img, 'poly', [(20, 52 + b), (44, 52 + b), (49, 88), (15, 88)], rc)
            P(img, 'rect', (19, 51 + b, 45, 66 + b, 7), rc)
            if d == 0:
                P(img, 'poly', [(30, 53 + b), (34, 53 + b), (35, 88), (29, 88)], tc, shade=False)
                P(img, 'poly', [(25, 51 + b), (39, 51 + b), (32, 60 + b)], mul(rc, 0.6), shade=False)
            P(img, 'rect', (15, 85, 49, 89, 1), tc, shade=False)
            P(img, 'rect', (19, 64 + b, 45, 67.5 + b, 1), tc, shade=False)
            for (x0, a) in ((12, p['armL']), (42, p['armR'])):
                P(img, 'poly', [(x0 + 2, 53 + b + a), (x0 + 8, 53 + b + a), (x0 + 10.5, 70 + b + a), (x0 - 0.5, 70 + b + a)], rc)
                P(img, 'rect', (x0 - 0.5, 68 + b + a, x0 + 10.5, 70.5 + b + a, 1), tc, shade=False)
            if A.get('stars') and d == 0:
                for (sx, sy) in ((22, 74), (40, 78), (25, 83), (37, 68)):
                    P(img, 'poly', [(sx, sy - 1.6), (sx + 0.6, sy), (sx, sy + 1.6), (sx - 0.6, sy)], '#ffe68a', outline=False, shade=False)
        else:
            P(img, 'poly', [(23, 52 + b), (41, 52 + b), (44, 88), (19, 88)], rc)
            P(img, 'rect', (19, 85, 44, 89, 1), tc, shade=False)
            P(img, 'rect', (23, 64 + b, 41, 67.5 + b, 1), tc, shade=False)
            ax = 28.5 + p['arm']
            P(img, 'poly', [(ax, 53 + b), (ax + 8, 53 + b), (ax + 10, 70 + b), (ax - 2, 70 + b)], rc)
            P(img, 'rect', (ax - 2, 68 + b, ax + 10, 70.5 + b, 1), tc, shade=False)
        return
    base, trim, kind = A['base'], A['trim'], A['kind']
    if d in (0, 2):
        P(img, 'rect', (19, 50 + b, 45, 76 + b, 7), base)
        if kind == 'tunic' or kind == 'apron':
            P(img, 'poly', [(19, 68 + b), (45, 68 + b), (47, 80 + b), (17, 80 + b)], base)
        if kind == 'apron' and d == 0:
            P(img, 'rect', (23, 56 + b, 41, 82 + b, 3), '#3a2a1a')
        if kind == 'chain':
            for yy in range(53, 75, 3):
                for xx in range(21, 44, 3):
                    P(img, 'ell', (xx, yy + b, xx + 1.6, yy + 1.6 + b), mul(base, 0.7), outline=False, shade=False)
        if kind == 'plate' and d == 0:
            P(img, 'rect', (23, 53 + b, 41, 66 + b, 5), mix(base, '#ffffff', 0.2))
            P(img, 'line', ([(32, 54 + b), (32, 65 + b)], 0.8), mul(base, 0.7), outline=False, shade=False)
        if kind == 'dragon':
            for row, yy in enumerate(range(54, 74, 4)):
                for xx in range(20 + (row % 2) * 2, 44, 4):
                    P(img, 'arc', (xx, yy + b, xx + 4, yy + 4 + b, 0, 180, 0.7), mul(base, 0.6), outline=False, shade=False)
        if kind == 'leather' and d == 0:
            P(img, 'line', ([(24, 54 + b), (24, 68 + b)], 0.6), mix(base, '#e8c890', 0.6), outline=False, shade=False)
            P(img, 'line', ([(40, 54 + b), (40, 68 + b)], 0.6), mix(base, '#e8c890', 0.6), outline=False, shade=False)
        if d == 0 and kind in ('tunic', 'leather'):
            P(img, 'poly', [(27, 50 + b), (37, 50 + b), (32, 57 + b)], '#e9dfc6', shade=False)
        P(img, 'rect', (19, 68 + b, 45, 72 + b, 1), '#4a2e18' if kind != 'dragon' else '#2a1a10')
        if d == 0: P(img, 'rect', (29.5, 67.5 + b, 34.5, 72.5 + b, 1), '#e2b84a')
        for (x0, x1, a) in ((13, 21, p['armL']), (43, 51, p['armR'])):
            P(img, 'rect', (x0, 53 + b + a, x1, 68 + b + a, 4), base if kind != 'apron' else '#e9dfc6')
        if kind in ('plate', 'dragon', 'leather', 'chain'):
            pc = trim if kind != 'plate' else base
            P(img, 'ell', (10, 48 + b, 24, 60 + b), pc if kind != 'leather' else mul(base, 1.1))
            P(img, 'ell', (40, 48 + b, 54, 60 + b), pc if kind != 'leather' else mul(base, 1.1))
            if kind == 'dragon':
                P(img, 'poly', [(12, 50 + b), (9, 43 + b), (16, 48 + b)], '#e8d8b0')
                P(img, 'poly', [(52, 50 + b), (55, 43 + b), (48, 48 + b)], '#e8d8b0')
    else:
        P(img, 'rect', (22, 50 + b, 42, 76 + b, 7), base)
        if kind in ('tunic', 'apron'): P(img, 'poly', [(22, 68 + b), (42, 68 + b), (44, 80 + b), (20, 80 + b)], base)
        if kind == 'apron': P(img, 'rect', (19, 56 + b, 26, 82 + b, 2), '#3a2a1a')
        if kind == 'chain':
            for yy in range(53, 75, 3):
                for xx in range(24, 41, 3): P(img, 'ell', (xx, yy + b, xx + 1.6, yy + 1.6 + b), mul(base, 0.7), outline=False, shade=False)
        P(img, 'rect', (22, 68 + b, 42, 72 + b, 1), '#4a2e18')
        ax = 28.5 + p['arm']
        P(img, 'rect', (ax, 53 + b, ax + 8, 68 + b, 4), base if kind != 'apron' else '#e9dfc6')
        if kind in ('plate', 'dragon', 'leather', 'chain'):
            P(img, 'ell', (ax - 3, 48 + b, ax + 11, 60 + b), trim if kind not in ('plate', 'leather') else mul(base, 1.08))

# ------------------------------------------------------------------ CAPACETES / CHAPÉUS
HELMS = {
    'h_leather': dict(c='#8a5530', kind='cap'),
    'h_iron':    dict(c='#9aa4b0', kind='helm'),
    'h_steel':   dict(c='#d6dde6', kind='helm', plume='#d23a3a'),
    'wizhat':    dict(c=None, kind='wiz'),
}
def helmet(img, p, hid, robecol=None):
    H = HELMS[hid]; b = p['bob']; d = p['d']
    if H['kind'] == 'wiz':
        c = robecol
        if d in (0, 2):
            P(img, 'ell', (4, 21 + b, 60, 33 + b), c)
            P(img, 'poly', [(15, 27 + b), (49, 27 + b), (40, 8 + b), (44, 0 + b), (34, 4 + b), (29, 8 + b)], c)
            P(img, 'poly', [(15.5, 23 + b), (48.5, 23 + b), (49.3, 27.5 + b), (14.7, 27.5 + b)], '#e2b84a', shade=False)
            if d == 0: P(img, 'poly', [(32, 11 + b), (33.3, 14 + b), (32, 17 + b), (30.7, 14 + b)], '#ffe68a', outline=False, shade=False)
        else:
            P(img, 'ell', (2, 21 + b, 56, 33 + b), c)
            P(img, 'poly', [(13, 27 + b), (46, 27 + b), (38, 8 + b), (48, 1 + b), (32, 4 + b), (25, 9 + b)], c)
            P(img, 'poly', [(13.5, 23 + b), (45.5, 23 + b), (46.3, 27.5 + b), (12.7, 27.5 + b)], '#e2b84a', shade=False)
        return
    c = H['c']
    if H['kind'] == 'cap':
        if d == 0: P(img, 'ell', (11, 9 + b, 53, 36 + b), c, clip=mask('rect', (0, 0, 64, 28 + b))); P(img, 'rect', (11, 24 + b, 53, 29 + b, 2), mul(c, 0.8))
        elif d == 2: P(img, 'ell', (11, 9 + b, 53, 44 + b), c)
        else: P(img, 'ell', (10, 9 + b, 50, 36 + b), c, clip=mask('rect', (0, 0, 64, 28 + b))); P(img, 'rect', (10, 24 + b, 50, 29 + b, 2), mul(c, 0.8)); P(img, 'rect', (36, 26 + b, 49, 44 + b, 3), c)
        return
    if d == 0:
        P(img, 'ell', (10, 7 + b, 54, 40 + b), c, clip=mask('rect', (0, 0, 64, 30 + b)))
        P(img, 'rect', (10, 24 + b, 54, 30 + b, 2), mul(c, 0.85))
        P(img, 'rect', (9, 26 + b, 16, 44 + b, 3), c); P(img, 'rect', (48, 26 + b, 55, 44 + b, 3), c)
        P(img, 'rect', (30, 26 + b, 34, 38 + b, 1.5), mul(c, 0.9))
    elif d == 2:
        P(img, 'ell', (10, 7 + b, 54, 44 + b), c); P(img, 'rect', (12, 34 + b, 52, 46 + b, 4), mul(c, 0.9))
    else:
        P(img, 'ell', (9, 7 + b, 51, 40 + b), c, clip=mask('rect', (0, 0, 64, 30 + b)))
        P(img, 'rect', (9, 24 + b, 51, 30 + b, 2), mul(c, 0.85))
        P(img, 'rect', (34, 26 + b, 50, 46 + b, 4), c)
    if H.get('plume'):
        if d in (0, 2): P(img, 'poly', [(29, 9 + b), (35, 9 + b), (38, 0 + b), (32, -2 + b), (26, 0 + b)], H['plume'])
        else: P(img, 'poly', [(26, 9 + b), (34, 8 + b), (46, 2 + b), (36, -2 + b), (24, 1 + b)], H['plume'])

# ------------------------------------------------------------------ ARMAS (desenhadas num quadro local, cabo em (0,0))
WEAPONS = {
    'w_dagger': 'dagger', 'w_sword': 'sword', 'w_axe': 'axe', 'w_long': 'long', 'w_hammer': 'hammer', 'w_dragon': 'dsword',
    'm_wand': ('wand', '#9ef0ff'), 'm_staff': ('staff', '#8cff8c'), 'm_ice': ('wand', '#70dcff'), 'm_fire': ('staff', '#ff9030'),
    'm_arcane': ('staff', '#d080ff'), 'm_dragon': ('staff', '#ff4040'), 'spear': 'spear', 'npc_hammer': 'hammer', 'sage_staff': ('staff', '#fff38a')
}
R = 64  # meia largura do quadro local
def local(): return Image.new('RGBA', (2 * R * SS, 2 * R * SS), (0, 0, 0, 0))
def Lmask(kind, g):
    m = Image.new('L', (2 * R * SS, 2 * R * SS), 0); d = ImageDraw.Draw(m); o = R
    if kind == 'ell': d.ellipse([S(g[0] + o), S(g[1] + o), S(g[2] + o), S(g[3] + o)], fill=255)
    elif kind == 'rect': d.rounded_rectangle([S(g[0] + o), S(g[1] + o), S(g[2] + o), S(g[3] + o)], radius=S(g[4]) if len(g) > 4 else 0, fill=255)
    elif kind == 'poly': d.polygon([(S(x + o), S(y + o)) for x, y in g], fill=255)
    return m
def LP(img, kind, g, c, **kw): return paint(img, Lmask(kind, g), c, **kw)
def glow(img, x, y, r, c):
    g = Image.new('RGBA', img.size, (0, 0, 0, 0)); m = Lmask('ell', (x - r, y - r, x + r, y + r)).filter(ImageFilter.GaussianBlur(S(r * 0.6)))
    g.paste(hx(c), (0, 0), m.point(lambda v: v * 170 // 255)); img.alpha_composite(g)
def weapon_img(wid):
    w = WEAPONS[wid]; orb = None
    if isinstance(w, tuple): w, orb = w
    im = local(); WOOD = '#7a4a22'; STEEL = '#dfe6ee'; GOLD = '#e2b84a'
    if w in ('dagger', 'sword', 'long', 'dsword'):
        L = {'dagger': 18, 'sword': 32, 'long': 44, 'dsword': 44}[w]
        bc = '#ff6a5a' if w == 'dsword' else STEEL
        LP(im, 'rect', (-1.6, -3, 1.6, 7, 1), '#5a3218')
        LP(im, 'ell', (-2.4, 6, 2.4, 10), GOLD)
        LP(im, 'poly', [(-2.6, -5), (2.6, -5), (2.6, -L + 4), (0, -L), (-2.6, -L + 4)], bc, soft=0.5)
        LP(im, 'rect', (-0.5, -L + 6, 0.5, -6), mul(bc, 0.75), outline=False, shade=False)
        if w == 'dsword':
            glow(im, 0, -L / 2, 6, '#ff5030')
            LP(im, 'poly', [(-9, -6), (-3, -3), (3, -3), (9, -6), (6, -2), (-6, -2)], '#2a1a1a')
        else:
            LP(im, 'rect', (-7, -6, 7, -3, 1.2), GOLD)
    elif w == 'axe':
        LP(im, 'rect', (-1.6, -30, 1.6, 10, 1), WOOD)
        LP(im, 'poly', [(-1, -29), (-13, -36), (-17, -26), (-13, -16), (-1, -21)], '#b8c2cc', soft=0.6)
        LP(im, 'poly', [(1, -28), (7, -26), (1, -22)], '#9aa4b0')
    elif w == 'hammer':
        LP(im, 'rect', (-1.6, -26, 1.6, 10, 1), WOOD)
        LP(im, 'rect', (-10, -36, 10, -24, 2), '#a8b2bc'); LP(im, 'rect', (-3, -37, 3, -23, 1), GOLD)
    elif w == 'spear':
        LP(im, 'rect', (-1.3, -46, 1.3, 14, 1), WOOD)
        LP(im, 'poly', [(-3, -45), (3, -45), (0, -56)], STEEL); LP(im, 'rect', (-2.5, -46, 2.5, -43, 0.5), GOLD)
    elif w == 'wand':
        LP(im, 'rect', (-1.3, -16, 1.3, 6, 1), '#5a3218')
        LP(im, 'rect', (-2.2, -17, 2.2, -14, 1), GOLD)
        glow(im, 0, -20, 6, orb); LP(im, 'ell', (-3.2, -23.5, 3.2, -16.8), orb, soft=0.6)
    elif w == 'staff':
        LP(im, 'rect', (-1.6, -42, 1.6, 16, 1), WOOD)
        for yy in (-30, -18, -6): LP(im, 'rect', (-2.2, yy, 2.2, yy + 2, 0.6), mul(WOOD, 0.75), outline=False)
        LP(im, 'poly', [(-1.5, -42), (-6, -50), (-4, -52), (0, -46), (4, -52), (6, -50), (1.5, -42)], GOLD)
        glow(im, 0, -50, 9, orb); LP(im, 'ell', (-4.3, -54.3, 4.3, -45.7), orb, soft=0.6)
    return im
_wcache = {}
def put_weapon(img, wid, hand, angle):
    key = wid
    if key not in _wcache: _wcache[key] = weapon_img(wid)
    w = _wcache[key].rotate(angle, resample=Image.BICUBIC)
    img.alpha_composite(w, (int(S(hand[0] - R)), int(S(hand[1] - R))))

# ------------------------------------------------------------------ ESCUDOS
SHIELDS = {'s_wood': '#9a6a3a', 's_iron': '#a8b2bc', 's_tower': '#cfd7e0', 's_guard': '#2f5aa8'}
def shield(img, p, sid):
    c = SHIELDS[sid]; b = p['bob']; d = p['d']
    if d == 0:
        x, y = p['handL'][0] - 1, p['handL'][1] - 9
        if sid == 's_wood':
            P(img, 'ell', (x - 11, y - 11, x + 11, y + 11), '#7a7f88')
            P(img, 'ell', (x - 9, y - 9, x + 9, y + 9), c)
            for xx in (-4, 0, 4): P(img, 'line', ([(x + xx, y - 8), (x + xx, y + 8)], 0.5), mul(c, 0.7), outline=False, shade=False)
            P(img, 'ell', (x - 3, y - 3, x + 3, y + 3), '#c8ced6')
        elif sid in ('s_iron', 's_guard'):
            P(img, 'poly', [(x - 10, y - 11), (x + 10, y - 11), (x + 10, y + 2), (x, y + 13), (x - 10, y + 2)], c)
            P(img, 'poly', [(x - 2, y - 8), (x + 2, y - 8), (x + 2, y + 6), (x - 2, y + 6)], '#e2b84a' if sid == 's_iron' else '#f0f0f0', shade=False)
            P(img, 'poly', [(x - 7, y - 3), (x + 7, y - 3), (x + 7, y + 1), (x - 7, y + 1)], '#e2b84a' if sid == 's_iron' else '#f0f0f0', shade=False)
        else:
            P(img, 'rect', (x - 11, y - 15, x + 11, y + 15, 4), c)
            P(img, 'rect', (x - 8, y - 12, x + 8, y + 12, 3), '#3a5ab0')
            P(img, 'rect', (x - 1.5, y - 10, x + 1.5, y + 10, 0.5), '#f0d070', shade=False); P(img, 'rect', (x - 6, y - 4, x + 6, y - 1, 0.5), '#f0d070', shade=False)
    elif d == 2:
        x, y = p['handR'][0] + 1, p['handR'][1] - 9
        P(img, 'ell' if sid == 's_wood' else 'rect', (x - 10, y - 12, x + 10, y + 12) + (() if sid == 's_wood' else (4,)), mul(c, 0.7))
        P(img, 'rect', (x - 8, y - 2, x + 8, y + 1, 0.5), '#4a2e18', shade=False)
    else:
        x, y = 42, 62 + b
        P(img, 'ell', (x - 5, y - 12, x + 5, y + 12), mul(c, 0.85))

# ------------------------------------------------------------------ MONTAGEM
def cell(layers_fn):
    sheet = Image.new('RGBA', (3 * LW * OUT_SCALE, 4 * LH * OUT_SCALE), (0, 0, 0, 0))
    for d in (0, 1, 2):
        for f in range(3):
            img = new(); layers_fn(img, pose(d, f))
            small = img.resize((LW * OUT_SCALE, LH * OUT_SCALE), Image.LANCZOS)
            sheet.paste(small, (f * LW * OUT_SCALE, d * LH * OUT_SCALE))
            if d == 1:
                sheet.paste(small.transpose(Image.FLIP_LEFT_RIGHT), (f * LW * OUT_SCALE, 3 * LH * OUT_SCALE))
    return sheet

SKINS = ['#f7d5b8', '#dca57e', '#8e5b3c']
HAIRC = {'preto': '#2b2329', 'castanho': '#6e4024', 'loiro': '#e6c25e', 'ruivo': '#c4492b', 'branco': '#ecebe7', 'azul': '#3c6bd2', 'rosa': '#e07ab0'}
STYLES = ['curto', 'longo', 'rabo']

def save(name, sheet):
    sheet.save(os.path.join(OUT, name + '.png'), optimize=True); print('ok', name)

def weapon_layer(wid):
    def fn(img, p):
        d = p['d']
        if d == 0: put_weapon(img, wid, p['handR'], -14)
        elif d == 2: put_weapon(img, wid, p['handL'], 14)
        else: put_weapon(img, wid, p['hand'], 28)
    return fn

JOBS = []
def run_job(i):
    n, fn = JOBS[i]; save(n, cell(fn))

if __name__ == '__main__':
    only = sys.argv[1] if len(sys.argv) > 1 else None
    man = {'cell': [LW * OUT_SCALE, LH * OUT_SCALE], 'sheets': []}
    jobs = []
    for i, s in enumerate(SKINS): jobs.append((f'body_{i}', lambda img, p, s=s: body(img, p, s)))
    for st in STYLES:
        for cn, cc in HAIRC.items():
            jobs.append((f'hair_{st}_{cn}', lambda img, p, st=st, cc=cc: hair(img, p, st, cc, 'front')))
            if st == 'longo': jobs.append((f'hairb_{st}_{cn}', lambda img, p, st=st, cc=cc: hair(img, p, st, cc, 'back')))
    for cn, cc in HAIRC.items(): jobs.append((f'beard_{cn}', lambda img, p, cc=cc: beard(img, p, cc)))
    for aid in ARMORS:
        if aid == 'none': continue
        if ARMORS[aid]['kind'] != 'robeonly': jobs.append((f'armor_{aid}', lambda img, p, aid=aid: armor(img, p, aid, False)))
        if 'robe' in ARMORS[aid]: jobs.append((f'robe_{aid}', lambda img, p, aid=aid: armor(img, p, aid, True)))
    for hid in HELMS:
        if hid == 'wizhat':
            for aid, A in ARMORS.items():
                if 'robe' in A: jobs.append((f'hat_{aid}', lambda img, p, A=A: helmet(img, p, 'wizhat', mul(A['robe'], 0.95))))
        else: jobs.append((f'helm_{hid}', lambda img, p, hid=hid: helmet(img, p, hid)))
    for wid in WEAPONS: jobs.append((f'wpn_{wid}', weapon_layer(wid)))
    for sid in SHIELDS: jobs.append((f'shd_{sid}', lambda img, p, sid=sid: shield(img, p, sid)))
    man['sheets'] = [n for n, _ in jobs]
    todo = [i for i, (n, _) in enumerate(jobs) if not only or n.startswith(only)]
    JOBS[:] = jobs
    from multiprocessing import Pool
    with Pool() as pool: pool.map(run_job, todo)
    json.dump(man, open(os.path.join(OUT, 'manifest.json'), 'w'))
