# Quantize docs PNGs to 256 colours (dithered) and downscale the big board exports.
import os, sys
from PIL import Image
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'docs')
before = after = 0
for d in ['screenshots', 'tutorial', 'case-safepay', 'case-safepay/evidence', 'v2', 'v3', 'v4', 'v5', 'v6', 'v7', 'v8']:
    for f in sorted(os.listdir(os.path.join(root, d))):
        if not f.endswith('.png'): continue
        p = os.path.join(root, d, f); before += os.path.getsize(p)
        im = Image.open(p).convert('RGB')
        if im.width > 2400:  # board exports render at up to 2x; 2400px is plenty for docs
            im = im.resize((2400, round(im.height * 2400 / im.width)), Image.LANCZOS)
        q = im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
        q.save(p, optimize=True); after += os.path.getsize(p)
print('docs PNGs: %.1f MB -> %.1f MB' % (before / 1e6, after / 1e6))
