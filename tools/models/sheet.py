"""Skleja zdjęcia z inspect_building.py w jeden arkusz z podpisami: python3 tools/models/sheet.py /tmp/sheet.png"""
import json, sys
from PIL import Image, ImageDraw, ImageFont
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 14)
items = json.load(open('/tmp/_inspect/list.json'))
ims = [(Image.open(p).convert('RGB'), l) for p, l in items]
w, h = ims[0][0].size
cols = 4
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * h), (20, 20, 20))
for i, (im, label) in enumerate(ims):
    x, y = (i % cols) * w, (i // cols) * h
    sheet.paste(im, (x, y))
    d = ImageDraw.Draw(sheet)
    d.rectangle([x, y, x + 10 + int(d.textlength(label, font=FONT)), y + 20], fill=(0, 0, 0))
    d.text((x + 5, y + 2), label, fill=(255, 255, 255), font=FONT)
sheet.save(sys.argv[1])
print(sys.argv[1], sheet.size)
