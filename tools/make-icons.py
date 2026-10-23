# Draws the IBRA خطوط icon (black lacquer tile, gold rim, the word خط in Aref Ruqaa) and every size the app,
# web page, landing page and installer need.   python3 tools/make-icons.py .
import sys, os
from PIL import Image, ImageDraw, ImageFont
root = sys.argv[1] if len(sys.argv) > 1 else "."
S = 1024
GOLD = (201, 168, 76); GOLD2 = (230, 199, 112); DARK1 = (34, 30, 22); DARK2 = (10, 9, 7)
FONT = os.path.join(root, "web", "fonts", "ArefRuqaa-Bold.ttf")

def tile():
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    grad = Image.new("RGBA", (S, S))
    gd = ImageDraw.Draw(grad)
    for y in range(S):
        t = y / S
        gd.line([(0, y), (S, y)], fill=tuple(int(DARK1[i] * (1 - t) + DARK2[i] * t) for i in range(3)) + (255,))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([24, 24, S - 24, S - 24], radius=220, fill=255)
    img.paste(grad, (0, 0), mask)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([24, 24, S - 24, S - 24], radius=220, outline=GOLD + (255,), width=22)
    f = ImageFont.truetype(FONT, 640, layout_engine=ImageFont.Layout.RAQM)  # needs Pillow with libraqm (Arabic shaping)
    TXT = "خط"
    box = d.textbbox((0, 0), TXT, font=f, direction="rtl")
    w, h = box[2] - box[0], box[3] - box[1]
    d.text(((S - w) / 2 - box[0], (S - h) / 2 - box[1] - 30), TXT, font=f, fill=GOLD2, direction="rtl")
    # baseline rule, the calligrapher's guide line
    d.rounded_rectangle([210, 800, S - 210, 822], radius=11, fill=GOLD)
    return img

big = tile()
os.makedirs(f"{root}/assets", exist_ok=True)
for n in (256, 512):
    big.resize((n, n), Image.LANCZOS).save(f"{root}/assets/ibra-fonts-{n}.png")
big.save(f"{root}/assets/ibra-fonts.ico", sizes=[(16, 16), (20, 20), (24, 24), (32, 32), (40, 40), (48, 48), (64, 64), (128, 128), (256, 256)])
big.resize((192, 192), Image.LANCZOS).save(f"{root}/web/icon.png")
os.makedirs(f"{root}/site", exist_ok=True)
big.resize((192, 192), Image.LANCZOS).save(f"{root}/site/icon.png")

def side(w, h):
    img = Image.new("RGB", (w, h), DARK2)
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(DARK1[i] * (1 - t) + DARK2[i] * t) for i in range(3)))
    logo = big.resize((int(w * 0.62), int(w * 0.62)), Image.LANCZOS)
    img.paste(logo, ((w - logo.width) // 2, int(h * 0.28)), logo)
    d.rectangle([0, h - int(h * 0.012), w, h], fill=GOLD)
    return img
os.makedirs(f"{root}/installer", exist_ok=True)
for scale, (w, h) in {100: (164, 314), 150: (246, 459), 200: (328, 628)}.items():
    side(w, h).save(f"{root}/installer/wizard-side-{scale}.bmp")
for scale, n in {100: 55, 150: 83, 200: 110}.items():
    img = Image.new("RGB", (n, n), (255, 255, 255))
    logo = big.resize((n, n), Image.LANCZOS)
    img.paste(logo, (0, 0), logo)
    img.save(f"{root}/installer/wizard-corner-{scale}.bmp")
print("ok")
