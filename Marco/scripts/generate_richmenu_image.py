from PIL import Image, ImageDraw, ImageFont

WIDTH = 2500
HEIGHT = 843
BG = "#FFF4DE"
TEXT = "#2D241B"
ACCENT = "#F39A2D"
ACCENT_2 = "#7AC6B6"
ACCENT_3 = "#F26D6D"


def load_font(size):
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    ]
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            continue
    return ImageFont.load_default()


image = Image.new("RGB", (WIDTH, HEIGHT), BG)
draw = ImageDraw.Draw(image)

panel_width = WIDTH // 3
panels = [
    (0, panel_width, ACCENT, "開始故事", "從第一頁開始"),
    (panel_width, panel_width * 2, ACCENT_2, "下一頁", "繼續往後看"),
    (panel_width * 2, WIDTH, ACCENT_3, "重來", "回到封面"),
]

title_font = load_font(88)
label_font = load_font(70)
sub_font = load_font(38)

draw.text((80, 60), "LINE 數位繪本", fill=TEXT, font=title_font)
draw.text((80, 165), "先用這張示意版圖文選單測試操作。", fill=TEXT, font=sub_font)

for left, right, color, title, subtitle in panels:
    draw.rounded_rectangle(
        (left + 35, 270, right - 35, 760),
        radius=48,
        fill=color,
    )
    title_box = draw.textbbox((0, 0), title, font=label_font)
    subtitle_box = draw.textbbox((0, 0), subtitle, font=sub_font)
    title_width = title_box[2] - title_box[0]
    subtitle_width = subtitle_box[2] - subtitle_box[0]
    center_x = (left + right) // 2
    draw.text((center_x - title_width / 2, 430), title, fill="white", font=label_font)
    draw.text((center_x - subtitle_width / 2, 540), subtitle, fill="white", font=sub_font)

image.save("assets/richmenu.png", "PNG")
