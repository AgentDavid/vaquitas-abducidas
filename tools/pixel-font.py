"""Convierte la fuente pixel 5x7 del juego (FONT_SRC en index.html) en fonts/vaquitas-pixel.woff2,
para que los textos HTML (panel de premios, registro, privacidad) se vean igual que en el canvas.

Como en el juego: las minúsculas usan las mayúsculas y los acentos se quitan (Á -> A), salvo Ñ, Й y Ё.

    pip install fonttools brotli
    python tools/pixel-font.py

Vuelve a correrlo si cambias FONT_SRC.
"""
import re
import unicodedata
from pathlib import Path

from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ROOT = Path(__file__).resolve().parent.parent
html = (ROOT / "index.html").read_text(encoding="utf-8")
section = html[html.index("const FONT_SRC = {"):html.index("const FONT = {};")]

ROW = r"[01]{5}"
glyphs = {ch: bits for ch, bits in re.findall(rf"""['"](.)['"]: '({ROW}(?: {ROW}){{6}})'""", section)}
# Cirílico que reutiliza el dibujo de la letra latina igual (АA, ВB, …)
for cy, la in re.findall(r"'(.)(.)'", section[section.index("for (const [cy, la] of"):]):
    glyphs[cy] = glyphs[la]
# Signos que el juego no usa en el canvas pero sí aparecen en los textos HTML. En el juego '@' dibuja un
# corazón (ícono); aquí tiene que ser una arroba de verdad para los correos.
glyphs.update({
    "@": "01110 10001 10111 10101 10111 10000 01111",
    '"': "01010 01010 00000 00000 00000 00000 00000",
    "_": "00000 00000 00000 00000 00000 00000 11111",
    "…": "00000 00000 00000 00000 00000 00000 10101",
    ";": "00000 01100 01100 00000 01100 00100 01000",
    "%": "11001 11010 00010 00100 01000 01011 10011",
    "#": "01010 11111 01010 01010 01010 11111 01010",
    "&": "01100 10010 10100 01000 10101 10010 01101",
})

PX = 125                 # unidades por pixel: 8 pixeles = 1 em, así a 16 px cada pixel mide 2 px
ADVANCE = 6 * PX         # 5 de glifo + 1 de separación, como textWidth en el juego


def draw(bits):
    pen = TTGlyphPen(None)
    rows = bits.split()
    for r, row in enumerate(rows):
        y1 = (7 - r) * PX            # la fila de abajo se apoya en la línea base
        y0 = y1 - PX
        c = 0
        while c < 5:                 # une los pixeles seguidos de cada fila en un rectángulo
            if row[c] == "1":
                start = c
                while c < 5 and row[c] == "1":
                    c += 1
                x0, x1 = start * PX, c * PX
                pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
            else:
                c += 1
    return pen.glyph()


names = {ch: f"uni{ord(ch):04X}" for ch in glyphs}
order = [".notdef", "space"] + sorted(names.values())
glyf = {".notdef": draw("11111 10001 10001 10001 10001 10001 11111"), "space": TTGlyphPen(None).glyph()}
glyf.update({names[ch]: draw(bits) for ch, bits in glyphs.items()})

cmap = {0x20: "space", 0xA0: "space"}
for ch, name in names.items():
    cmap[ord(ch)] = name
# minúsculas y letras con acento: la glifa de su mayúscula sin acento (como norm() del juego)
for cp in range(0x20, 0x500):
    ch = chr(cp)
    if cp in cmap or not ch.isprintable():
        continue
    up = ch.upper()
    if len(up) == 1 and up in names:
        cmap[cp] = names[up]
        continue
    base = unicodedata.normalize("NFD", up)[0]
    if base in names:
        cmap[cp] = names[base]

fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder(order)
fb.setupCharacterMap(cmap)
fb.setupGlyf(glyf)
fb.setupHorizontalMetrics({n: (ADVANCE, 0) for n in order})
fb.setupHorizontalHeader(ascent=1000, descent=-250)
fb.setupNameTable({"familyName": "Vaquitas Pixel", "styleName": "Regular"})
fb.setupOS2(sTypoAscender=1000, sTypoDescender=-250, sTypoLineGap=0, usWinAscent=1000, usWinDescent=250,
            sxHeight=7 * PX, sCapHeight=7 * PX)
fb.setupPost()
fb.font.flavor = "woff2"
out = ROOT / "fonts" / "vaquitas-pixel.woff2"
fb.save(str(out))
print(f"{out.relative_to(ROOT)}: {len(glyphs)} glifos, {len(cmap)} caracteres, {out.stat().st_size} bytes")
