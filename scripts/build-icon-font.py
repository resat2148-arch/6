#!/usr/bin/env python3
"""Builds the tiny colour icon font embedded in css/style.css.

Windows 10's emoji font predates Emoji 13, so 🪙 🪖 🪨 🛖 render as empty boxes there.
This font draws those glyphs (COLR/CPAL colour layers) so they look the same everywhere.
Run after changing a glyph:  pip install fonttools && python3 scripts/build-icon-font.py
"""
import base64
import io
import math
import re
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.cu2quPen import Cu2QuPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib.tables import otTables  # noqa: F401  (registers COLR/CPAL)
from fontTools.colorLib.builder import buildCOLR, buildCPAL

UPM = 1000
ADV = 1250
CX, CY = ADV / 2, 330  # glyphs are centred on the text's middle
SCALE = 1.15  # drawn at ~1em, shown at emoji size


def hexrgba(h, a=1.0):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (a,)


# ---------------------------------------------------------------- shapes (lists of contours)
def circle(cx, cy, r):
    k = 0.5523 * r
    return [('curve', [(cx + r, cy), (cx + r, cy + k), (cx + k, cy + r), (cx, cy + r)],
             [(cx - k, cy + r), (cx - r, cy + k), (cx - r, cy)],
             [(cx - r, cy - k), (cx - k, cy - r), (cx, cy - r)],
             [(cx + k, cy - r), (cx + r, cy - k), (cx + r, cy)])]


def ellipse(cx, cy, rx, ry):
    kx, ky = 0.5523 * rx, 0.5523 * ry
    return [('curve', [(cx + rx, cy), (cx + rx, cy + ky), (cx + kx, cy + ry), (cx, cy + ry)],
             [(cx - kx, cy + ry), (cx - rx, cy + ky), (cx - rx, cy)],
             [(cx - rx, cy - ky), (cx - kx, cy - ry), (cx, cy - ry)],
             [(cx + kx, cy - ry), (cx + rx, cy - ky), (cx + rx, cy)])]


def poly(*pts):
    pts = list(pts)
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    return [('poly', pts if area > 0 else pts[::-1])]  # counter-clockwise like the curves, so overlaps never cut holes


def star(cx, cy, r, inner=0.45, n=5):
    pts = []
    for i in range(n * 2):
        a = math.pi / 2 + i * math.pi / n
        rr = r if i % 2 == 0 else r * inner
        pts.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    return poly(*pts)


def dome(cx, cy, rx, ry):
    """Upper half ellipse, flat side on y = cy."""
    kx, ky = 0.5523 * rx, 0.5523 * ry
    return [('curve', [(cx + rx, cy), (cx + rx, cy + ky), (cx + kx, cy + ry), (cx, cy + ry)],
             [(cx - kx, cy + ry), (cx - rx, cy + ky), (cx - rx, cy)])]


def draw(shapes):
    def t(p):
        return (round(CX + (p[0] - CX) * SCALE), round(CY + (p[1] - CY) * SCALE))

    tt = TTGlyphPen(None)
    pen = Cu2QuPen(tt, max_err=1.0, reverse_direction=True)
    for shape in shapes:
        for kind, *parts in shape:
            if kind == 'poly':
                pts = parts[0]
                pen.moveTo(t(pts[0]))
                for p in pts[1:]:
                    pen.lineTo(t(p))
                pen.closePath()
            else:
                first = parts[0]
                pen.moveTo(t(first[0]))
                pen.curveTo(*[t(p) for p in first[1:]])
                for seg in parts[1:]:
                    pen.curveTo(*[t(p) for p in seg])
                pen.closePath()
    return tt.glyph()


# ---------------------------------------------------------------- glyphs: [(colour, shapes)], first layer doubles as the plain outline
R = 430
GLYPHS = {
    0x1FA99: ('coin', [  # 🪙 gold
        ('#a86b0c', [circle(CX, CY, R)]),
        ('#f2b632', [circle(CX, CY + 18, R - 34)]),
        ('#d9951c', [circle(CX, CY + 18, R - 118)]),
        ('#ffd45c', [circle(CX, CY + 26, R - 142)]),
        ('#c9850f', [star(CX, CY + 16, 170)]),
        ('#fff3c4', [ellipse(CX - 175, CY + 215, 70, 42)]),
    ]),
    0x1FA96: ('helmet', [  # 🪖 military helmet
        ('#3f4d22', [dome(CX, CY - 150, 450, 560), poly((CX - 520, CY - 150), (CX + 520, CY - 150), (CX + 480, CY - 250), (CX - 480, CY - 250))]),
        ('#6b8036', [dome(CX, CY - 110, 400, 500)]),
        ('#86a045', [dome(CX - 60, CY + 60, 230, 290)]),
        ('#2f3a18', [poly((CX - 470, CY - 110), (CX + 470, CY - 110), (CX + 460, CY - 150), (CX - 460, CY - 150))]),
    ]),
    0x1FAA8: ('rock', [  # 🪨 rock
        ('#5b6068', [poly((CX - 470, CY - 300), (CX + 480, CY - 300), (CX + 430, CY + 40), (CX + 170, CY + 330), (CX - 180, CY + 360), (CX - 440, CY + 90))]),
        ('#8d939c', [poly((CX - 420, CY - 250), (CX + 20, CY - 250), (CX + 60, CY + 90), (CX - 160, CY + 310), (CX - 395, CY + 80))]),
        ('#a9afb8', [poly((CX - 160, CY + 310), (CX + 60, CY + 90), (CX + 380, CY + 40), (CX + 150, CY + 280))]),
        ('#737982', [poly((CX + 20, CY - 250), (CX + 430, CY - 250), (CX + 380, CY + 40), (CX + 60, CY + 90))]),
    ]),
    0x1F6D6: ('hut', [  # 🛖 hut
        ('#7a4a1e', [poly((CX - 360, CY - 330), (CX + 360, CY - 330), (CX + 360, CY + 20), (CX - 360, CY + 20))]),
        ('#a8672c', [poly((CX - 320, CY - 330), (CX + 320, CY - 330), (CX + 320, CY + 20), (CX - 320, CY + 20))]),
        ('#3b2410', [dome(CX, CY - 330, 120, 250)]),
        ('#b8862e', [poly((CX - 520, CY - 20), (CX + 520, CY - 20), (CX, CY + 440))]),
        ('#e0b552', [poly((CX - 420, CY + 20), (CX + 420, CY + 20), (CX, CY + 380))]),
        ('#b8862e', [poly((CX - 250, CY + 60), (CX - 215, CY + 60), (CX - 20, CY + 330), (CX - 55, CY + 330)),
                     poly((CX + 250, CY + 60), (CX + 215, CY + 60), (CX + 20, CY + 330), (CX + 55, CY + 330))]),
    ]),
}


def build():
    names = ['.notdef']
    glyphs = {'.notdef': TTGlyphPen(None).glyph()}
    cmap, layers, palette, advances = {}, {}, [], {'.notdef': (ADV, 0)}
    for cp, (name, parts) in GLYPHS.items():
        names.append(name)
        glyphs[name] = draw([s for s in parts[0][1]])
        advances[name] = (ADV, 0)
        cmap[cp] = name
        layers[name] = []
        for i, (colour, shapes) in enumerate(parts):
            lname = f'{name}.l{i}'
            names.append(lname)
            glyphs[lname] = draw(shapes)
            advances[lname] = (ADV, 0)
            rgba = hexrgba(colour)
            if rgba not in palette:
                palette.append(rgba)
            layers[name].append((lname, palette.index(rgba)))
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap(cmap)
    fb.setupGlyf(glyphs)
    metrics = {}
    for n, (adv, _) in advances.items():
        g = glyphs[n]
        g.recalcBounds(fb.font['glyf']) if hasattr(g, 'recalcBounds') else None
        metrics[n] = (adv, getattr(g, 'xMin', 0) or 0)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=800, descent=-200)
    fb.setupNameTable({'familyName': 'RR Icons', 'styleName': 'Regular'})
    fb.setupOS2(sTypoAscender=800, sTypoDescender=-200, usWinAscent=800, usWinDescent=200)
    fb.setupPost()
    fb.font['COLR'] = buildCOLR(layers)
    fb.font['CPAL'] = buildCPAL([palette])
    out = io.BytesIO()
    fb.save(out)
    return out.getvalue()


def main():
    data = build()
    b64 = base64.b64encode(data).decode()
    ranges = ', '.join(f'U+{cp:X}' for cp in GLYPHS)
    css_rule = (f"@font-face {{ font-family: 'RR Icons'; src: url(data:font/ttf;base64,{b64}) format('truetype'); "
                f"unicode-range: {ranges}; font-display: block; }}")
    path = Path(__file__).resolve().parent.parent / 'css' / 'style.css'
    css = path.read_text()
    begin, end = '/* icon-font:begin */', '/* icon-font:end */'
    block = f'{begin}\n{css_rule}\n{end}'
    if begin in css:
        css = re.sub(re.escape(begin) + r'.*?' + re.escape(end), lambda _: block, css, flags=re.S)
    else:
        css = block + '\n' + css
    path.write_text(css)
    print(f'icon font: {len(data)} bytes, {len(GLYPHS)} glyphs -> css/style.css')


if __name__ == '__main__':
    main()
