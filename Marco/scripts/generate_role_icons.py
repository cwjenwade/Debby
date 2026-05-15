from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path("public/story/01/roles")
OUT_DIR.mkdir(parents=True, exist_ok=True)

ROLES = [
    ("bear", "#B8947A", "熊"),
    ("inner-bear", "#8D739E", "心"),
    ("narrator", "#7D8F9B", "旁"),
    ("lily", "#E8A2AF", "兔"),
    ("dad", "#7E9F6E", "爸"),
    ("mom", "#D97C7C", "媽"),
    ("dream", "#F1C45D", "夢"),
    ("friends", "#6FB6CC", "友"),
    ("villager", "#C8AA70", "民"),
    ("beaver", "#C78F62", "狸"),
    ("deer", "#CDBB7A", "鹿"),
    ("owl", "#9B7C5A", "鷹"),
    ("bee", "#F2B935", "蜂"),
    ("journey", "#90A87A", "旅"),
    ("cave", "#9AA7C7", "洞"),
]


def load_font(size):
    for path in [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


font = load_font(118)

for filename, color, label in ROLES:
    image = Image.new("RGBA", (220, 220), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    draw.ellipse((8, 8, 212, 212), fill=color)
    draw.ellipse((24, 24, 196, 196), fill="#FFF8EE")
    draw.ellipse((36, 36, 184, 184), fill=color)

    bbox = draw.textbbox((0, 0), label, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    draw.text(((220 - width) / 2, (220 - height) / 2 - 12), label, fill="white", font=font)

    image.save(OUT_DIR / f"{filename}.png", "PNG")
