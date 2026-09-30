"""Symbol der Integration zeichnen: schlichter Turmkran über einem Baustellencontainer (eigene Zeichnung).

Aufruf: uv run --no-project --with pillow python tools/symbol.py
Schreibt custom_components/baustelle/brand/icon.png (256 px) und icon@2x.png (512 px).
"""

from pathlib import Path

from PIL import Image, ImageDraw

def zeichnen(groesse: int) -> Image.Image:
    s = 4  # überabtasten für glatte Kanten
    n = groesse * s
    img = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = n / 256
    def r(x0, y0, x1, y1, farbe, rad=0):
        d.rounded_rectangle([x0 * u, y0 * u, x1 * u, y1 * u], radius=rad * u, fill=farbe)
    def l(pkte, farbe, breite):
        d.line([(x * u, y * u) for x, y in pkte], fill=farbe, width=round(breite * u), joint="curve")
    gelb, dunkel, grau = (245, 180, 0, 255), (38, 50, 56, 255), (96, 125, 139, 255)
    # Hintergrund: runde Kachel
    r(8, 8, 248, 248, (255, 243, 204, 255), rad=48)
    # Kran: Mast, Ausleger, Gegenausleger, Spitze, Seil, Haken
    r(70, 44, 90, 214, gelb)
    for y in range(58, 210, 22):                     # Fachwerk des Mastes
        l([(70, y), (90, y + 18)], dunkel, 3)
    r(40, 50, 222, 64, gelb)                          # Ausleger
    l([(80, 22), (40, 50)], dunkel, 4)                # Abspannung
    l([(80, 22), (222, 50)], dunkel, 4)
    r(74, 18, 86, 50, dunkel)                         # Turmspitze
    r(40, 64, 62, 84, grau)                           # Gegengewicht
    r(172, 64, 184, 70, dunkel)                       # Laufkatze
    l([(178, 70), (178, 132)], dunkel, 3)            # Seil
    l([(172, 132), (184, 132), (184, 140), (178, 146)], dunkel, 4)  # Haken
    # Container am Boden mit Rippen und Tür
    r(116, 156, 232, 214, (0, 121, 107, 255), rad=4)
    for x in range(128, 222, 14):
        l([(x, 162), (x, 208)], (0, 90, 80, 255), 3)
    r(204, 166, 224, 208, (255, 255, 255, 230), rad=2)
    # Boden
    r(28, 214, 236, 224, dunkel, rad=4)
    return img.resize((groesse, groesse), Image.LANCZOS)

ziel = Path(__file__).resolve().parent.parent / "custom_components" / "baustelle" / "brand"
ziel.mkdir(exist_ok=True)
zeichnen(256).save(ziel / "icon.png", optimize=True)
zeichnen(512).save(ziel / "icon@2x.png", optimize=True)
