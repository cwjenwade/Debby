#!/usr/bin/env python3
"""
render_pipeline.py — Debby story image generation pipeline

Flow:
  1. Fetch asset manifest from Vercel/local admin
  2. For each node, render a card image using Pillow
  3. Upload to Cloudinary via REST API
  4. POST asset results back to admin

Usage:
  python3 scripts/render_pipeline.py --story-id story-01
  python3 scripts/render_pipeline.py --story-id story-01 --admin-url http://localhost:3002
  python3 scripts/render_pipeline.py --story-id story-01 --node-id dialogue-abc123

Env required:
  CLOUDINARY_URL  (cloudinary://api_key:api_secret@cloud_name)
  ADMIN_API_SECRET  (optional, if admin requires auth)
"""

import argparse
import base64
import hashlib
import io
import json
import os
import sys
import time
import urllib.parse
from textwrap import wrap

import requests
from PIL import Image, ImageDraw, ImageFont

# ── Card dimensions (matches LINE image card spec) ──────────────────────────
W, H = 1040, 720
HERO_H = 520    # hero area height
BODY_H = 200    # body text area height

# Warm colour palette
BG = "#FFFDF8"
TEXT_DARK = "#2D241B"
ACCENT = "#C8833D"
PANEL_BG = "#FFF4DE"
MUTED = "#8C7A6B"


# ── Fonts ────────────────────────────────────────────────────────────────────

def load_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/Library/Fonts/Arial Unicode.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for path in candidates:
        try:
            idx = 1 if bold else 0
            return ImageFont.truetype(path, size, index=idx)
        except (OSError, Exception):
            try:
                return ImageFont.truetype(path, size)
            except (OSError, Exception):
                continue
    return ImageFont.load_default()


FONT_LG = None
FONT_MD = None
FONT_SM = None
FONT_XS = None
FONT_TITLE = None


def ensure_fonts():
    global FONT_LG, FONT_MD, FONT_SM, FONT_XS, FONT_TITLE
    if FONT_LG is None:
        FONT_TITLE = load_font(52, bold=True)
        FONT_LG = load_font(40)
        FONT_MD = load_font(32)
        FONT_SM = load_font(26)
        FONT_XS = load_font(22)


# ── Helpers ──────────────────────────────────────────────────────────────────

def hex_to_rgb(hex_color):
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def bg_image(w=W, h=H, color=BG):
    img = Image.new("RGB", (w, h), hex_to_rgb(color))
    return img


def draw_accent_bar(draw, x1, y1, x2, y2, color=ACCENT):
    draw.rectangle([x1, y1, x2, y2], fill=hex_to_rgb(color))


def draw_text_wrapped(draw, text, x, y, max_width, font, fill=TEXT_DARK, line_spacing=8):
    """Draw text wrapped to max_width pixels, return final y."""
    fill_rgb = hex_to_rgb(fill)
    lines = []
    # Wrap by character count estimation, then refine
    raw_lines = str(text or "").split("\n")
    for raw in raw_lines:
        # Estimate ~20 chars per line for CJK at current font
        chars_per_line = max(8, int(max_width / (font.size * 0.65)))
        wrapped = wrap(raw, chars_per_line) or [""]
        lines.extend(wrapped)

    cur_y = y
    for line in lines:
        draw.text((x, cur_y), line, font=font, fill=fill_rgb)
        bbox = draw.textbbox((x, cur_y), line, font=font)
        cur_y = bbox[3] + line_spacing
    return cur_y


# ── Card renderers ───────────────────────────────────────────────────────────

def render_dialogue_card(node):
    ensure_fonts()
    img = bg_image()
    draw = ImageDraw.Draw(img)

    # Hero area (top 520px) — tinted background with decorative circles
    draw.rectangle([0, 0, W, HERO_H], fill=hex_to_rgb("#F5EED9"))
    draw.ellipse([W - 320, -120, W + 80, 280], fill=hex_to_rgb("#EDD9A3"))
    draw.ellipse([-80, HERO_H - 280, 280, HERO_H + 80], fill=hex_to_rgb("#EDD9A3"))

    # Speaker nameplate
    speaker = node.get("speakerCharacterId", "")
    if speaker:
        nameplate_text = speaker.replace("char-", "").replace("-", " ").upper()
        draw.rounded_rectangle([60, 60, 360, 120], radius=20, fill=hex_to_rgb(ACCENT))
        draw.text((80, 68), nameplate_text[:20], font=FONT_SM, fill=(255, 255, 255))

    # Dialogue text in speech bubble
    text = node.get("text", "")
    bubble_x1, bubble_y1, bubble_x2, bubble_y2 = 60, 150, W - 60, HERO_H - 40
    draw.rounded_rectangle(
        [bubble_x1, bubble_y1, bubble_x2, bubble_y2],
        radius=32, fill=(255, 255, 255), outline=hex_to_rgb("#E8D9B0"), width=3
    )
    draw_text_wrapped(draw, text, bubble_x1 + 40, bubble_y1 + 40,
                      bubble_x2 - bubble_x1 - 80, FONT_LG)

    # Body area (bottom 200px)
    draw.rectangle([0, HERO_H, W, H], fill=hex_to_rgb(BG))
    draw_accent_bar(draw, 0, HERO_H, W, HERO_H + 4)

    continue_label = node.get("continueLabel", "下一步")
    draw.text((W // 2 - 60, HERO_H + 80), continue_label, font=FONT_MD,
              fill=hex_to_rgb(ACCENT))

    return img


def render_narration_card(node):
    ensure_fonts()
    img = bg_image()
    draw = ImageDraw.Draw(img)

    # Full-bleed narration background
    draw.rectangle([0, 0, W, H], fill=hex_to_rgb("#FDF6E3"))
    draw.rectangle([0, 0, W, 8], fill=hex_to_rgb(ACCENT))

    # Decorative quote mark
    draw.text((60, 60), "「", font=load_font(120), fill=hex_to_rgb("#E8D9B0"))

    # Main narration text
    text = node.get("text", "")
    draw_text_wrapped(draw, text, 100, 160, W - 200, FONT_LG, fill=TEXT_DARK, line_spacing=16)

    # Bottom border
    draw.rectangle([0, H - 8, W, H], fill=hex_to_rgb(ACCENT))

    title = node.get("title", "")
    if title:
        draw.text((W - 300, H - 60), title[:20], font=FONT_XS, fill=hex_to_rgb(MUTED))

    return img


def render_choice_card(node):
    ensure_fonts()
    img = bg_image(color=PANEL_BG)
    draw = ImageDraw.Draw(img)

    # Top bar
    draw_accent_bar(draw, 0, 0, W, 12)

    # Prompt
    prompt = node.get("prompt", node.get("text", "請做出選擇"))
    draw_text_wrapped(draw, prompt, 80, 80, W - 160, FONT_LG, fill=TEXT_DARK)

    # Option A
    opt_a = node.get("optionA", {})
    label_a = opt_a.get("label", "選項 A") if isinstance(opt_a, dict) else str(opt_a)
    a_y = 300
    draw.rounded_rectangle([80, a_y, W - 80, a_y + 100], radius=24,
                            fill=hex_to_rgb(ACCENT), outline=None)
    draw.text((120, a_y + 28), label_a[:30], font=FONT_MD, fill=(255, 255, 255))

    # Option B
    opt_b = node.get("optionB", {})
    label_b = opt_b.get("label", "選項 B") if isinstance(opt_b, dict) else str(opt_b)
    b_y = 440
    draw.rounded_rectangle([80, b_y, W - 80, b_y + 100], radius=24,
                            fill=(255, 255, 255),
                            outline=hex_to_rgb(ACCENT))
    draw.text((120, b_y + 28), label_b[:30], font=FONT_MD, fill=hex_to_rgb(ACCENT))

    # Bottom bar
    draw_accent_bar(draw, 0, H - 12, W, H)

    return img


def render_transition_card(node):
    ensure_fonts()
    bg_color = node.get("backgroundColor", "#FFF4DE")
    img = bg_image(color=bg_color)
    draw = ImageDraw.Draw(img)

    # Decorative diagonal band
    draw.polygon([(0, H - 200), (W, H - 400), (W, H), (0, H)],
                 fill=hex_to_rgb("#EDD9A3"))
    draw_accent_bar(draw, 0, 0, W, 8)

    title = node.get("title", "")
    text = node.get("text", node.get("transitionText", ""))

    if title:
        draw.text((W // 2 - len(title) * 26, H // 2 - 120), title[:20],
                  font=FONT_TITLE, fill=hex_to_rgb(TEXT_DARK))

    draw_text_wrapped(draw, text, 100, H // 2 - 20, W - 200, FONT_LG,
                      fill=TEXT_DARK)

    continue_label = node.get("continueLabel", "繼續")
    draw.text((W // 2 - 40, H - 100), continue_label, font=FONT_MD,
              fill=hex_to_rgb(ACCENT))

    return img


def render_carousel_card(node):
    # Carousel container — render a summary cover page
    ensure_fonts()
    img = bg_image(color="#F0E6D3")
    draw = ImageDraw.Draw(img)

    draw.rectangle([0, 0, W, 12], fill=hex_to_rgb(ACCENT))
    draw.rectangle([0, H - 12, W, H], fill=hex_to_rgb(ACCENT))

    title = node.get("title", "")
    pages = node.get("pages", [])
    page_count = len(pages)

    draw.text((W // 2 - len(title) * 26, H // 2 - 100), title[:20],
              font=FONT_TITLE, fill=hex_to_rgb(TEXT_DARK))

    if page_count:
        label = f"共 {page_count} 頁"
        draw.text((W // 2 - 60, H // 2 + 20), label, font=FONT_MD,
                  fill=hex_to_rgb(MUTED))

    return img


RENDERERS = {
    "dialogue": render_dialogue_card,
    "narration": render_narration_card,
    "choice": render_choice_card,
    "transition": render_transition_card,
    "carousel": render_carousel_card,
}


def render_card(node_manifest_entry):
    card_type = node_manifest_entry.get("cardType", "dialogue")
    render_data = node_manifest_entry.get("renderData", node_manifest_entry)
    renderer = RENDERERS.get(card_type, render_dialogue_card)
    return renderer(render_data)


# ── Cloudinary upload ────────────────────────────────────────────────────────

def parse_cloudinary_url(url):
    """Parse cloudinary://api_key:api_secret@cloud_name"""
    parsed = urllib.parse.urlparse(url)
    return parsed.username, parsed.password, parsed.hostname


def sign_cloudinary(params, api_secret):
    sorted_params = "&".join(f"{k}={v}" for k, v in sorted(params.items())
                             if k not in ("file", "api_key", "resource_type"))
    to_sign = f"{sorted_params}{api_secret}"
    return hashlib.sha1(to_sign.encode("utf-8")).hexdigest()


def upload_to_cloudinary(img: Image.Image, public_id: str) -> str:
    """Upload PIL image to Cloudinary, return secure_url."""
    cloudinary_url = os.environ.get("CLOUDINARY_URL", "")
    if not cloudinary_url:
        raise RuntimeError("CLOUDINARY_URL env var not set")

    api_key, api_secret, cloud_name = parse_cloudinary_url(cloudinary_url)
    if not api_key or not api_secret or not cloud_name:
        raise RuntimeError("Could not parse CLOUDINARY_URL")

    # Convert image to JPEG bytes
    buf = io.BytesIO()
    img.convert("RGB").save(buf, format="JPEG", quality=88, optimize=True)
    buf.seek(0)
    img_bytes = buf.read()
    data_uri = "data:image/jpeg;base64," + base64.b64encode(img_bytes).decode()

    timestamp = str(int(time.time()))
    params_to_sign = {
        "overwrite": "true",
        "public_id": public_id,
        "timestamp": timestamp,
    }
    signature = sign_cloudinary(params_to_sign, api_secret)

    upload_url = f"https://api.cloudinary.com/v1_1/{cloud_name}/image/upload"
    resp = requests.post(upload_url, data={
        "file": data_uri,
        "public_id": public_id,
        "overwrite": "true",
        "timestamp": timestamp,
        "api_key": api_key,
        "signature": signature,
    }, timeout=60)

    resp.raise_for_status()
    result = resp.json()
    return result.get("secure_url") or result.get("url", "")


# ── Admin API helpers ────────────────────────────────────────────────────────

def admin_headers():
    secret = os.environ.get("ADMIN_API_SECRET", "")
    headers = {"Content-Type": "application/json", "x-lineat-role": "manager"}
    if secret:
        headers["x-admin-secret"] = secret
    return headers


def fetch_manifest(admin_url, story_id):
    # admin_url is the full API base, e.g. http://localhost:3002/api or https://...vercel.app/admin-api
    url = f"{admin_url.rstrip('/')}/stories/{story_id}/manifest"
    resp = requests.get(url, headers=admin_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


def post_asset_results(admin_url, story_id, results):
    url = f"{admin_url.rstrip('/')}/stories/{story_id}/asset-result"
    resp = requests.post(url, json={"results": results},
                         headers=admin_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


def fetch_line_ready(admin_url, story_id):
    url = f"{admin_url.rstrip('/')}/stories/{story_id}/line-ready"
    resp = requests.get(url, headers=admin_headers(), timeout=30)
    resp.raise_for_status()
    return resp.json()


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Debby render pipeline")
    parser.add_argument("--story-id", required=True, help="Story ID to render")
    parser.add_argument("--admin-url", default="http://localhost:3002/api",
                        help="Admin API base URL (default: http://localhost:3002/api; Vercel: https://<host>/admin-api)")
    parser.add_argument("--node-id", default="",
                        help="Render a single node by ID")
    parser.add_argument("--dry-run", action="store_true",
                        help="Render locally but do not upload or write back")
    parser.add_argument("--output-dir", default="",
                        help="Save rendered images to a local directory (for --dry-run)")
    args = parser.parse_args()

    story_id = args.story_id
    admin_url = args.admin_url
    dry_run = args.dry_run
    output_dir = args.output_dir

    print(f"\n🎨 Debby render pipeline")
    print(f"   story-id : {story_id}")
    print(f"   admin-url: {admin_url}")
    print(f"   dry-run  : {dry_run}")
    print("─" * 50)

    # 1. Fetch manifest
    print("\n📋 Fetching manifest...")
    try:
        manifest = fetch_manifest(admin_url, story_id)
    except Exception as e:
        print(f"❌ Failed to fetch manifest: {e}", file=sys.stderr)
        sys.exit(1)

    nodes = manifest.get("nodes", [])
    if args.node_id:
        nodes = [n for n in nodes if n.get("nodeId") == args.node_id]
        if not nodes:
            print(f"❌ Node {args.node_id!r} not found in manifest", file=sys.stderr)
            sys.exit(1)

    print(f"   Found {len(nodes)} node(s) to render")

    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    # 2. Render + upload
    results = []
    ok_count = 0

    for entry in nodes:
        node_id = entry.get("nodeId", "unknown")
        card_type = entry.get("cardType", "dialogue")
        public_id = entry.get("targetCloudinaryPublicId", f"lineat-picturebooks/{story_id}/{node_id}/main")

        print(f"\n  → [{card_type}] {node_id}")

        try:
            img = render_card(entry)
        except Exception as e:
            print(f"     ❌ Render failed: {e}", file=sys.stderr)
            results.append({"nodeId": node_id, "ok": False, "error": str(e)})
            continue

        if output_dir:
            out_path = os.path.join(output_dir, f"{node_id}.jpg")
            img.save(out_path, "JPEG", quality=88)
            print(f"     💾 Saved: {out_path}")

        if dry_run:
            print(f"     ⏭  Skipping upload (dry-run)")
            results.append({"nodeId": node_id, "ok": True, "finalImageUrl": "[dry-run]"})
            ok_count += 1
            continue

        try:
            secure_url = upload_to_cloudinary(img, public_id)
            print(f"     ✅ {secure_url}")
            results.append({"nodeId": node_id, "ok": True, "secureUrl": secure_url, "finalImageUrl": secure_url})
            ok_count += 1
        except Exception as e:
            print(f"     ❌ Upload failed: {e}", file=sys.stderr)
            results.append({"nodeId": node_id, "ok": False, "error": str(e)})

    # 3. Write back results
    if not dry_run and ok_count > 0:
        write_back = [r for r in results if r.get("ok") and (r.get("secureUrl") or r.get("finalImageUrl"))]
        print(f"\n💾 Writing {len(write_back)} result(s) back to admin...")
        try:
            resp = post_asset_results(admin_url, story_id,
                                      [{"nodeId": r["nodeId"],
                                        "secureUrl": r.get("secureUrl") or r.get("finalImageUrl"),
                                        "finalImageUrl": r.get("finalImageUrl") or r.get("secureUrl")}
                                       for r in write_back])
            print(f"   ✅ Updated: {resp.get('updated', [])}")
        except Exception as e:
            print(f"   ❌ Write-back failed: {e}", file=sys.stderr)

    # 4. LINE ready check
    if not dry_run:
        print(f"\n🔎 LINE ready check...")
        try:
            ready = fetch_line_ready(admin_url, story_id)
            status = "✅ READY" if ready.get("ready") else "⚠️  NOT READY"
            print(f"   {status} — {ready.get('readyNodes', 0)}/{ready.get('totalNodes', 0)} nodes")
            if ready.get("missing"):
                print(f"   Missing: {ready['missing']}")
        except Exception as e:
            print(f"   ❌ Ready check failed: {e}", file=sys.stderr)

    # 5. Summary
    failed = [r for r in results if not r.get("ok")]
    print(f"\n📊 Summary")
    print(f"   Total  : {len(results)}")
    print(f"   Success: {ok_count}")
    print(f"   Failed : {len(failed)}")
    if failed:
        print("\nFailed nodes:")
        for r in failed:
            print(f"  - {r['nodeId']}: {r.get('error', 'unknown')}")

    sys.exit(0 if len(failed) == 0 else 1)


if __name__ == "__main__":
    main()
