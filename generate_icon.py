from PIL import Image, ImageDraw, ImageFont
import math

SIZE = 1024
RADIUS = 230

def radial_gradient(size, inner_rgb, outer_rgb):
    """生成径向渐变背景"""
    img = Image.new('RGBA', (size, size))
    draw = ImageDraw.Draw(img)
    cx = cy = size // 2
    for y in range(size):
        for x in range(size):
            d = math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (size * 0.72)
            d = min(1.0, d)
            r = int(inner_rgb[0] * (1 - d) + outer_rgb[0] * d)
            g = int(inner_rgb[1] * (1 - d) + outer_rgb[1] * d)
            b = int(inner_rgb[2] * (1 - d) + outer_rgb[2] * d)
            draw.point((x, y), fill=(r, g, b, 255))
    return img

def rounded_mask(size, radius):
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
    return mask

def draw_text_outline(draw, text, pos, font, fill, outline, width=10):
    x, y = pos
    for dx in range(-width, width + 1, 2):
        for dy in range(-width, width + 1, 2):
            if dx * dx + dy * dy <= width * width:
                draw.text((x + dx, y + dy), text, font=font, fill=outline)
    draw.text((x, y), text, font=font, fill=fill)

# ---- 主画布 ----
img = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))

# 背景
bg = radial_gradient(SIZE, (88, 55, 28), (10, 7, 3))
img.paste(bg, (0, 0), rounded_mask(SIZE, RADIUS))

draw = ImageDraw.Draw(img)

# ---- 底部城墙 ----
wall_top = SIZE - 270
wall_color = (45, 40, 38, 255)
tower_w = 110

# 城墙主体
draw.rectangle([(50, wall_top), (SIZE - 50, SIZE - 50)], fill=wall_color)
# 城垛
crenel_w = 64
for i in range(15):
    x = 50 + i * crenel_w
    h = 50 if i % 2 == 0 else 35
    draw.rectangle([(x, wall_top - h), (x + crenel_w // 2, wall_top)], fill=wall_color)
# 塔楼
draw.rectangle([(20, wall_top - 160), (20 + tower_w, SIZE - 50)], fill=wall_color)
draw.polygon([(20, wall_top - 160), (20 + tower_w // 2, wall_top - 260), (20 + tower_w, wall_top - 160)], fill=wall_color)
draw.rectangle([(SIZE - 20 - tower_w, wall_top - 160), (SIZE - 20, SIZE - 50)], fill=wall_color)
draw.polygon([(SIZE - 20 - tower_w, wall_top - 160), (SIZE - 20 - tower_w // 2, wall_top - 260), (SIZE - 20, wall_top - 160)], fill=wall_color)
# 城门
gate_x = SIZE // 2 - 90
gate_y = wall_top + 40
draw.arc([(gate_x, gate_y), (gate_x + 180, gate_y + 180)], start=0, end=180, fill=(20, 18, 17, 255), width=36)
draw.rectangle([(gate_x + 36, gate_y + 90), (gate_x + 144, SIZE - 50)], fill=(20, 18, 17, 255))

# ---- 中心徽章 ----
badge_w, badge_h = 520, 560
badge_x = (SIZE - badge_w) // 2
badge_y = 150

badge = Image.new('RGBA', (badge_w, badge_h))
badge_draw = ImageDraw.Draw(badge)
# 徽章渐变（更亮，增强对比）
for y in range(badge_h):
    t = abs(y - badge_h // 2) / (badge_h * 0.55)
    t = min(1.0, t)
    r = int(74 - t * 30)
    g = int(68 - t * 28)
    b = int(64 - t * 26)
    badge_draw.line([(0, y), (badge_w, y)], fill=(r, g, b, 250))
# 边框
badge_draw.rounded_rectangle((0, 0, badge_w, badge_h), radius=44, outline=(251, 191, 36, 150), width=12)
badge_draw.rounded_rectangle((18, 18, badge_w - 18, badge_h - 18), radius=34, outline=(251, 191, 36, 60), width=2)

# 徽章阴影
shadow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle(
    (badge_x + 14, badge_y + 14, badge_x + badge_w + 14, badge_y + badge_h + 14),
    radius=44, fill=(0, 0, 0, 80)
)
img = Image.alpha_composite(img, shadow)
img.paste(badge, (badge_x, badge_y), badge)

# ---- 高光与边框（在文字之前） ----
highlight = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(highlight).rounded_rectangle((50, 40, SIZE - 50, 200), radius=120, fill=(255, 255, 255, 10))
img = Image.alpha_composite(img, highlight)

glow = Image.new('RGBA', (SIZE, SIZE), (0, 0, 0, 0))
ImageDraw.Draw(glow).rounded_rectangle((4, 4, SIZE - 4, SIZE - 4), radius=RADIUS - 4, outline=(251, 191, 36, 50), width=6)
img = Image.alpha_composite(img, glow)

# ---- 文字（最后绘制，避免 alpha_composite 后 draw 上下文失效） ----
draw = ImageDraw.Draw(img)
try:
    font_num = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc', 380)
    font_days = ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc', 72)
except Exception:
    font_num = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 380)
    font_days = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 72)

# 50
bbox = draw.textbbox((0, 0), '50', font=font_num)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]
text_x = (SIZE - text_w) // 2
text_y = badge_y + 70
draw_text_outline(draw, '50', (text_x, text_y), font_num, (251, 191, 36, 255), (120, 53, 15, 255), width=12)

# DAYS
bbox_days = draw.textbbox((0, 0), 'DAYS', font=font_days)
days_w = bbox_days[2] - bbox_days[0]
draw.text(((SIZE - days_w) // 2, badge_y + badge_h - 110), 'DAYS', font=font_days, fill=(214, 211, 209, 200))

# 顶部小星星装饰
for i in range(5):
    x = SIZE // 2 + (i - 2) * 44
    size = 14 if i == 2 else 10
    draw.regular_polygon((x, badge_y + 28, size), n_sides=5, fill=(251, 191, 36, 200))

# 保存
img.save('public/icon-1024.png')
img.resize((512, 512), Image.Resampling.LANCZOS).save('public/icon-512.png')
img.resize((192, 192), Image.Resampling.LANCZOS).save('public/icon-192.png')
img.resize((180, 180), Image.Resampling.LANCZOS).save('public/icon-180.png')
img.resize((120, 120), Image.Resampling.LANCZOS).save('public/icon-120.png')
print('Icons generated: icon-1024.png, icon-512.png, icon-192.png, icon-180.png, icon-120.png')
