from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path("assets")
OUT_DIR.mkdir(exist_ok=True)

SCENES = [
    ("pic1.png", "#F7E8D0", "PIC1", "早晨轉醒"),
    ("pic2.png", "#E9E3D2", "PIC2", "森林相遇"),
    ("pic3.png", "#D8D7DB", "PIC3", "空洞工作日"),
    ("pic4.png", "#EADACF", "PIC4", "家族的框架"),
    ("pic5.png", "#1E2642", "PIC5", "月下獨白"),
    ("pic6.png", "#D5C4A1", "PIC6", "夢中的勇者"),
    ("pic7.png", "#BCC7E8", "PIC7", "夢醒流淚"),
    ("pic8.png", "#D9C1B3", "PIC8", "衝突與爭執"),
    ("pic9.png", "#102447", "PIC9", "流星許願"),
    ("pic10.png", "#BFD6D0", "PIC10", "與河狸對話"),
    ("pic11.png", "#DCE6C5", "PIC11", "內在探索"),
    ("pic12.png", "#E6D7BE", "PIC12", "回家的路"),
    ("pic13.png", "#F0D7BC", "PIC13", "啟程與送別"),
    ("pic14.png", "#534131", "PIC14", "篝火與自由"),
    ("pic15.png", "#B6B0A9", "PIC15", "山崖挑戰"),
    ("pic16.png", "#AA8E69", "PIC16", "信心與力量"),
    ("pic17.png", "#C8DCF4", "PIC17", "高山之巔"),
    ("pic18.png", "#B5C79C", "PIC18", "洞穴入口"),
    ("pic19.png", "#CFC8E8", "PIC19", "鏡中倒影"),
    ("pic20.png", "#F2C97E", "PIC20", "自我肯定"),
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


title_font = load_font(92)
subtitle_font = load_font(52)

for filename, bg, code, subtitle in SCENES:
    image = Image.new("RGB", (1200, 1200), bg)
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((70, 70, 1130, 1130), radius=42, outline="#2D241B", width=8)
    draw.ellipse((120, 120, 360, 360), fill="#FFFFFF55")
    draw.ellipse((830, 810, 1080, 1060), fill="#FFFFFF55")
    draw.rounded_rectangle((140, 760, 1060, 1030), radius=36, fill="#FFF9F0")

    title_box = draw.textbbox((0, 0), code, font=title_font)
    subtitle_box = draw.textbbox((0, 0), subtitle, font=subtitle_font)
    title_width = title_box[2] - title_box[0]
    subtitle_width = subtitle_box[2] - subtitle_box[0]

    draw.text(((1200 - title_width) / 2, 280), code, fill="#2D241B", font=title_font)
    draw.text(((1200 - subtitle_width) / 2, 850), subtitle, fill="#2D241B", font=subtitle_font)

    image.save(OUT_DIR / filename, "PNG")
