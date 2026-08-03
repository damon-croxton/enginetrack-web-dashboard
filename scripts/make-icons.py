"""Generates every EngineTrack icon from one definition.

Draws the lucide "Activity" pulse mark on the brand cyan->emerald gradient,
matching the logo tile in src/components/Header.tsx.

    pip install Pillow && python3 scripts/make-icons.py

Outputs to src/assets/. Re-run after changing the brand colours.
"""
from PIL import Image, ImageDraw
import os

SLATE = (2, 6, 23)        # slate-950 — matches theme-color and the Expo splash
CYAN = (8, 145, 178)      # cyan-600
EMERALD = (16, 185, 129)  # emerald-500
MARK = (34, 211, 238)     # cyan-400 — the pulse stroke, as in the header

ROOT = os.path.join(os.path.dirname(__file__), '..')

# Expo consumes these directly from disk, so they may be content-hashed by Vite.
APP_OUT = os.path.join(ROOT, 'src', 'assets')

# The web manifest and <link> tags need stable, unhashed URLs, so these are
# served verbatim out of public/.
WEB_OUT = os.path.join(ROOT, 'public')


def gradient(size, a, b):
    """Diagonal gradient bottom-left to top-right, matching CSS bg-gradient-to-tr."""
    img = Image.new('RGB', (size, size))
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = ((x / size) + (1 - y / size)) / 2
            px[x, y] = tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))
    return img


def rounded_mask(size, radius):
    m = Image.new('L', (size, size), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def pulse_points(cx, cy, w, h):
    """lucide Activity polyline (viewBox 24) scaled into a box centred on (cx, cy)."""
    raw = [(2, 12), (6, 12), (9, 3), (15, 21), (18, 12), (22, 12)]
    return [(cx - w / 2 + (x / 24) * w, cy - h / 2 + (y / 24) * h) for x, y in raw]


def build(size, *, full_bleed, mark_scale=0.46, plate_pad=0.14):
    """full_bleed paints the gradient edge to edge with a dark plate on top (iOS
    masks the icon itself); otherwise the gradient is clipped to a rounded tile."""
    base = Image.new('RGBA', (size, size), SLATE + (255,))
    grad = gradient(size, CYAN, EMERALD).convert('RGBA')

    if full_bleed:
        base.paste(grad, (0, 0))
        pad = round(size * plate_pad)
        plate = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        ImageDraw.Draw(plate).rounded_rectangle(
            [pad, pad, size - pad - 1, size - pad - 1],
            radius=round(size * 0.16), fill=SLATE + (255,),
        )
        base = Image.alpha_composite(base, plate)
    else:
        tile = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        tile.paste(grad, (0, 0), rounded_mask(size, round(size * 0.22)))
        base = Image.alpha_composite(base, tile)

    ImageDraw.Draw(base).line(
        pulse_points(size / 2, size / 2, size * mark_scale, size * mark_scale),
        fill=MARK + (255,),
        width=max(2, round(size * 0.055)),
        joint='curve',
    )
    return base


def main():
    os.makedirs(APP_OUT, exist_ok=True)
    os.makedirs(WEB_OUT, exist_ok=True)
    written = []

    def save(img, out_dir, name, *, drop_alpha=False):
        path = os.path.join(out_dir, name)
        (img.convert('RGB') if drop_alpha else img).save(path, optimize=True)
        written.append(path)

    # --- Expo app icons. No alpha on the app icon; the App Store rejects it. ---
    save(build(1024, full_bleed=True), APP_OUT, 'icon.png', drop_alpha=True)
    save(build(1024, full_bleed=False), APP_OUT, 'splash-icon.png')

    # --- Web / PWA icons ---
    save(build(192, full_bleed=False), WEB_OUT, 'pwa-192.png')
    save(build(512, full_bleed=False), WEB_OUT, 'pwa-512.png')

    # Maskable: Android crops to a circle, so the mark shrinks into the ~80%
    # safe area and the gradient runs edge to edge with no rounded corners.
    maskable = Image.new('RGBA', (512, 512), (0, 0, 0, 0))
    maskable.paste(gradient(512, CYAN, EMERALD).convert('RGBA'), (0, 0))
    ImageDraw.Draw(maskable).line(
        pulse_points(256, 256, 512 * 0.34, 512 * 0.34),
        fill=MARK + (255,), width=round(512 * 0.045), joint='curve',
    )
    save(maskable, WEB_OUT, 'pwa-512-maskable.png')

    # iOS home-screen icon: rendered at 180x180, and iOS applies its own mask.
    save(build(180, full_bleed=True), WEB_OUT, 'apple-touch-icon.png', drop_alpha=True)

    fav = build(512, full_bleed=False)
    fav.save(os.path.join(WEB_OUT, 'favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
    written.append(os.path.join(WEB_OUT, 'favicon.ico'))

    for path in written:
        rel = os.path.relpath(path, ROOT)
        print(f'{rel:34} {os.path.getsize(path):>8,} bytes')


if __name__ == '__main__':
    main()
