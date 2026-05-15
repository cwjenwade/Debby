from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH = 1200
HEIGHT = 900
OUT_DIR = Path("assets")

SCENES = [
    ("story-start.png", "#F8E6C1", "#6E4F2A", "故事起點", "熊熊遇到巨石擋路"),
    ("story-brave-1.png", "#F5D6A1", "#8A572A", "勇敢路線", "先翻越眼前的巨石"),
    ("story-brave-2.png", "#CFE3FF", "#486A96", "勇敢結局", "翻過阻礙後看見新天空"),
    ("story-careful-1.png", "#DDEFD7", "#57784E", "謹慎路線", "改走安全小路慢慢前進"),
    ("story-careful-2.png", "#E4D7F6", "#7053A6", "謹慎結局", "順利抵達營地安穩過夜"),
]


def load_font(size):
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


title_font = load_font(84)
body_font = load_font(48)

OUT_DIR.mkdir(exist_ok=True)

for filename, bg, accent, title, subtitle in SCENES:
    image = Image.new("RGB", (WIDTH, HEIGHT), bg)
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((60, 60, WIDTH - 60, HEIGHT - 60), radius=48, outline=accent, width=10)
    draw.ellipse((120, 120, 320, 320), fill=accent)
    draw.ellipse((880, 520, 1080, 720), fill=accent)
    draw.rounded_rectangle((220, 520, 820, 700), radius=40, fill="#FFFDF8")

    title_box = draw.textbbox((0, 0), title, font=title_font)
    subtitle_box = draw.multiline_textbbox((0, 0), subtitle, font=body_font, spacing=14)
    title_width = title_box[2] - title_box[0]
    subtitle_width = subtitle_box[2] - subtitle_box[0]

    draw.text(((WIDTH - title_width) / 2, 150), title, fill="white", font=title_font)
    draw.multiline_text(
        ((WIDTH - subtitle_width) / 2, 560),
        subtitle,
        fill="#2D241B",
        font=body_font,
        spacing=14,
        align="center",
    )

    image.save(OUT_DIR / filename, "PNG")
