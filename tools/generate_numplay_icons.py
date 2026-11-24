#!/usr/bin/env python3
"""Generate launcher/include/numplay_icons_data.h from web/assets/icons/numplay/*.png."""

import json
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ICONS_DIR = os.path.join(ROOT, "web", "assets", "icons", "numplay")
CATALOG_PATH = os.path.join(ROOT, "web", "catalog.json")
COMMUNITY_PATH = os.path.join(ROOT, "web", "community_apps.json")
OUT_HEADER = os.path.join(ROOT, "launcher", "include", "numplay_icons_data.h")


def rgb_to_565(r: int, g: int, b: int) -> int:
    return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | ((b & 0xF8) >> 3)


def norm_id(app_id: str) -> str:
    s = (app_id or "").lower()[:15]
    if s.startswith("comm_"):
        s = s[5:]
    if s.startswith("np_"):
        s = s[3:]
    return s


def encode_png_20x20_4bpp(png_path: str):
    im = Image.open(png_path).convert("RGBA").resize((20, 20), Image.Resampling.LANCZOS)
    px = list(im.getdata())

    opaque_coords = []
    opaque_rgb = []
    for i, (r, g, b, a) in enumerate(px):
        if a >= 96:
            # Blend subtle edge anti-aliasing toward white/clean edge before quantization if translucent
            if a < 240:
                # Un-premultiply? PNGs are straight alpha, mild threshold preserves crisp colors
                pass
            opaque_coords.append(i)
            opaque_rgb.append((r, g, b))

    if not opaque_rgb:
        palette = [0x0000] * 15
        indices = [15] * 400
    else:
        unique_cols = list(dict.fromkeys(opaque_rgb))
        if len(unique_cols) <= 15:
            pal_rgb = unique_cols
        else:
            strip = Image.new("RGB", (len(opaque_rgb), 1))
            strip.putdata(opaque_rgb)
            q = strip.quantize(colors=15, method=Image.Quantize.MEDIANCUT)
            raw_pal = q.getpalette()[: 15 * 3]
            pal_rgb = [(raw_pal[j], raw_pal[j + 1], raw_pal[j + 2]) for j in range(0, len(raw_pal), 3)]
            pal_rgb = pal_rgb[:15]

        palette = [rgb_to_565(r, g, b) for (r, g, b) in pal_rgb]
        while len(palette) < 15:
            palette.append(0x0000)

        # Match each opaque pixel to closest RGB palette color
        indices = [15] * 400
        for idx_pos, (r, g, b) in zip(opaque_coords, opaque_rgb):
            best_i = 0
            best_d = 1 << 30
            for ci, (pr, pg, pb) in enumerate(pal_rgb):
                d = (r - pr) * (r - pr) + (g - pg) * (g - pg) + (b - pb) * (b - pb)
                if d < best_d:
                    best_d = d
                    best_i = ci
            indices[idx_pos] = best_i

    packed = []
    for i in range(0, 400, 2):
        packed.append((indices[i] & 0x0F) | ((indices[i + 1] & 0x0F) << 4))
    return palette, packed


def main():
    png_files = sorted(f for f in os.listdir(ICONS_DIR) if f.lower().endswith(".png"))
    slug_to_idx = {}
    icons = []
    for idx, fname in enumerate(png_files):
        slug = os.path.splitext(fname)[0].lower()
        slug_to_idx[slug] = idx
        pal, packed = encode_png_20x20_4bpp(os.path.join(ICONS_DIR, fname))
        icons.append((slug, pal, packed))

    key_map = {}
    # Ensure raw slug always maps
    for slug, idx in slug_to_idx.items():
        key_map[slug[:15]] = idx

    for json_path in (CATALOG_PATH, COMMUNITY_PATH):
        with open(json_path, "r", encoding="utf-8") as f:
            items = json.load(f)
        for item in items:
            icon_url = item.get("icon_url") or ""
            if "numplay/" not in icon_url:
                continue
            slug = os.path.splitext(os.path.basename(icon_url))[0].lower()
            if slug not in slug_to_idx:
                raise RuntimeError(f"Missing PNG for {item.get('id')} -> {icon_url}")
            k = norm_id(item.get("id", ""))
            if k in key_map and key_map[k] != slug_to_idx[slug]:
                raise RuntimeError(f"Normalized ID collision for {k}: {key_map[k]} vs {slug_to_idx[slug]}")
            key_map[k] = slug_to_idx[slug]

    sorted_keys = sorted(key_map.items(), key=lambda kv: kv[0])

    lines = [
        "/* Auto-generated 20x20 4bpp palette-indexed NumPlay icons from web/assets/icons/numplay */",
        "#ifndef NUMPLAY_ICONS_DATA_H",
        "#define NUMPLAY_ICONS_DATA_H",
        "",
        "#include <stdint.h>",
        "",
        "typedef struct {",
        "    uint16_t palette[15];",
        "    uint8_t pixels[200];",
        "} np_icon_20x20_t;",
        "",
        "typedef struct {",
        "    char key[16];",
        "    uint8_t icon_idx;",
        "} np_icon_map_entry_t;",
        "",
        f"static const np_icon_20x20_t s_np_icons[{len(icons)}] = {{",
    ]

    for idx, (slug, pal, packed) in enumerate(icons):
        pal_str = ", ".join(f"0x{c:04X}" for c in pal)
        pix_str = ", ".join(f"0x{b:02X}" for b in packed)
        lines.append(f"    /* [{idx}] {slug} */")
        lines.append(f"    {{ {{ {pal_str} }}, {{ {pix_str} }} }},")

    lines.append("};")
    lines.append("")
    lines.append(f"static const np_icon_map_entry_t s_np_icon_map[{len(sorted_keys)}] = {{")
    for k, idx in sorted_keys:
        c_key = k.replace("\\", "\\\\").replace('"', '\\"')
        lines.append(f'    {{ "{c_key}", {idx} }},')
    lines.append("};")
    lines.append("")
    lines.append(f"#define NP_ICON_MAP_COUNT {len(sorted_keys)}")
    lines.append("")
    lines.append("#endif /* NUMPLAY_ICONS_DATA_H */")
    lines.append("")

    with open(OUT_HEADER, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines))

    print(
        f"Generated {OUT_HEADER}: {len(icons)} icons ({len(icons) * 230} bytes), "
        f"{len(sorted_keys)} map entries ({len(sorted_keys) * 17} bytes)."
    )


if __name__ == "__main__":
    main()
