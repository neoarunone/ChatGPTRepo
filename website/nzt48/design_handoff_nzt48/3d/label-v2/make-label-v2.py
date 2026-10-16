# Builds nzt48-bottle-cap-v2.glb: same geometry/parts as v1, new owner-supplied label art.
# Run: uv run --with pillow --with numpy python label-v2/make-label-v2.py <label.png>
import sys, io, json, struct, pathlib
import numpy as np
from PIL import Image
here = pathlib.Path(__file__).resolve().parent
src, glb_in, glb_out = sys.argv[1], here.parent / 'nzt48-bottle-cap.glb', here.parent / 'nzt48-bottle-cap-v2.glb'

im = Image.open(src).convert('RGB')
w, h = im.size
# Same placement as the v1 wrap: full width, 3:1 band starting 2% from the top (matched on stripe, NZT-48 and LOT box).
top = round(h * 14 / 697); band = round(w / 3)
albedo = im.crop((0, top, w, top + band)).resize((3072, 1024), Image.LANCZOS)
a = np.asarray(albedo).astype(np.float32)
# Printed black stock reads as soft charcoal in the product photos: lift pure black a little.
a = a + (1 - a / 255) * 20
albedo = Image.fromarray(a.clip(0, 255).round().astype(np.uint8))
albedo.save(here / 'label-albedo-v2.png', optimize=True)
r, g, b = a[..., 0], a[..., 1], a[..., 2]
yellow = np.clip((np.minimum(r, g) - b - 40) / 80, 0, 1)        # printed yellow/gold ink
white = np.clip((np.minimum(np.minimum(r, g), b) - 150) / 60, 0, 1) * (1 - yellow)
rough = 0.88 - 0.48 * yellow - 0.2 * white                         # stock matte, yellow ink satin
spec = 0.35 + 0.35 * yellow
mask = np.zeros((1024, 3072, 4), np.uint8)
mask[..., 1] = (rough * 255).round(); mask[..., 2] = 0; mask[..., 3] = (spec * 255).round()
Image.fromarray(mask, 'RGBA').save(here / 'label-pbr-mask-v2.png', optimize=True)

# Swap the two embedded label images inside the GLB.
data = glb_in.read_bytes()
jlen = struct.unpack('<I', data[12:16])[0]
gltf = json.loads(data[20:20 + jlen]); bin_ = data[20 + jlen + 8:]
new = {'albedo': (here / 'label-albedo-v2.png').read_bytes(), 'mask': (here / 'label-pbr-mask-v2.png').read_bytes()}
mat = next(m for m in gltf['materials'] if m['name'] == 'Matte black label with gold foil')
img_of = lambda tex: gltf['textures'][tex['index']]['source']
swap = {img_of(mat['pbrMetallicRoughness']['baseColorTexture']): new['albedo'],
        img_of(mat['pbrMetallicRoughness']['metallicRoughnessTexture']): new['mask']}
mat['pbrMetallicRoughness']['metallicFactor'] = 0
mat['name'] = 'Matte black label with gold foil'  # keep the name the site code looks for
mat['extras'] = {'artwork': 'NZT-48 Label.png (owner supplied 2026-10-16)', 'packedMap': 'G roughness / B metalness / A specular'}
out = bytearray(); views = []
for i, v in enumerate(gltf['bufferViews']):
    img = next((k for k, im_ in enumerate(gltf['images']) if im_.get('bufferView') == i), None)
    chunk = swap[img] if img in swap else bin_[v.get('byteOffset', 0): v.get('byteOffset', 0) + v['byteLength']]
    while len(out) % 4: out += b'\0'
    v = dict(v, byteOffset=len(out), byteLength=len(chunk)); views.append(v); out += chunk
while len(out) % 4: out += b'\0'
gltf['bufferViews'] = views; gltf['buffers'] = [{'byteLength': len(out)}]
gltf['nodes'][0].setdefault('extras', {})['labelArtwork'] = 'Owner supplied NZT-48 Label.png, 60 CAPS'
js = json.dumps(gltf, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
glb = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
glb_out.write_bytes(glb)
print('wrote', glb_out.name, len(glb), 'bytes; swapped images', sorted(swap))
