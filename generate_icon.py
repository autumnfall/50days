from PIL import Image, ImageDraw
import base64

INPUT = 'debug/50days.png'
BG = (25, 22, 20)  # 与源图背景色一致，保证无缝
SIZES = {
    1024: 'public/icon-1024.png',
    512: 'public/icon-512.png',
    192: 'public/icon-192.png',
    180: 'public/icon-180.png',
    120: 'public/icon-120.png',
}


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size, size), radius=radius, fill=255)
    return mask


def generate(size: int, path: str) -> None:
    src = Image.open(INPUT).convert('RGBA')
    # 让 logo 占据画布约 75%，保持比例
    max_dim = int(size * 0.75)
    src.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    canvas = Image.new('RGBA', (size, size), BG + (255,))
    x = (size - src.width) // 2
    y = (size - src.height) // 2
    canvas.paste(src, (x, y), src)

    radius = int(size * 0.2)
    mask = rounded_mask(size, radius)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0), mask)
    out.save(path)


for s, p in SIZES.items():
    generate(s, p)

# 生成 SVG：用 base64 内嵌原图，保证 PWA 优先读取 SVG 时也是新 logo
with open(INPUT, 'rb') as f:
    b64 = base64.b64encode(f.read()).decode('ascii')

svg = f'''\
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#{BG[0]:02x}{BG[1]:02x}{BG[2]:02x}"/>
  <image href="data:image/png;base64,{b64}" x="96" y="96" width="320" height="320" preserveAspectRatio="xMidYMid meet"/>
</svg>
'''
with open('public/icon.svg', 'w') as f:
    f.write(svg)

print('Generated:', ', '.join(SIZES.values()), 'and public/icon.svg')
