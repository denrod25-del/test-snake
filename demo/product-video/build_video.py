#!/usr/bin/env python3
"""Build DeedScout product walkthrough MP4 from HTML slides + live captures."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SLIDES = ROOT / "slides"
ARTIFACT = Path("/opt/cursor/artifacts/deedscout-video")
FRAMES = ARTIFACT / "frames"
CAPTURES = ARTIFACT / "captures"
OUT = ARTIFACT / "out"
VIDEO = OUT / "DeedScout-Product-Walkthrough.mp4"
POSTER = OUT / "poster.jpg"

W, H = 1920, 1080
CHROME = shutil.which("google-chrome") or shutil.which("chromium-browser") or "google-chrome"
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"

# Sequence: (kind, source, duration_seconds, label)
# kind: slide | capture
SEQUENCE = [
    ("slide", "01-title.html", 4.0, "Title"),
    ("slide", "02-overview.html", 5.0, "Overview"),
    ("capture", "home.png", 5.5, "Homepage"),
    ("slide", "03-modules.html", 5.0, "Modules"),
    ("slide", "04-tax-deeds.html", 4.5, "Tax Deeds"),
    ("capture", "tax-deeds.png", 6.0, "Tax Deeds App"),
    ("slide", "05-research-tools.html", 5.0, "Research Tools"),
    ("capture", "permits.png", 5.5, "Permit Search"),
    ("capture", "parcel.png", 4.5, "Parcel Lookup"),
    ("slide", "06-trust.html", 5.0, "Trust Labels"),
    ("slide", "07-pricing.html", 5.0, "Pricing"),
    ("capture", "pricing.png", 4.5, "Pricing Page"),
    ("slide", "08-cta.html", 5.5, "Call to Action"),
]

LIVE_PAGES = [
    ("https://deedscout.app/", "home.png"),
    ("https://deedscout.app/tax-deeds.html", "tax-deeds.png"),
    ("https://deedscout.app/permit-search.html", "permits.png"),
    ("https://deedscout.app/parcel-lookup.html", "parcel.png"),
    ("https://deedscout.app/pricing.html", "pricing.png"),
]


def run(cmd: list[str], **kwargs) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, **kwargs)


def chrome_shot(url: str, dest: Path, wait_ms: int = 2500) -> None:
    """Screenshot via headless Chrome; kill when PNG lands (Chrome often hangs)."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(".tmp.png")
    if tmp.exists():
        tmp.unlink()
    user_dir = Path(f"/tmp/ds-chrome-{dest.stem}-{int(time.time() * 1000)}")
    user_dir.mkdir(parents=True, exist_ok=True)
    cmd = [
        CHROME,
        "--headless=new",
        "--no-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--disable-software-rasterizer",
        "--hide-scrollbars",
        "--no-first-run",
        "--no-default-browser-check",
        "--force-device-scale-factor=1",
        f"--window-size={W},{H}",
        f"--user-data-dir={user_dir}",
        f"--virtual-time-budget={wait_ms}",
        f"--screenshot={tmp}",
        url,
    ]
    print("+", " ".join(cmd), flush=True)
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    deadline = time.time() + 45
    try:
        while time.time() < deadline:
            if tmp.exists() and tmp.stat().st_size > 1000:
                time.sleep(0.2)  # finish write
                break
            if proc.poll() is not None:
                break
            time.sleep(0.1)
        else:
            raise RuntimeError(f"Screenshot timed out for {url}")
    finally:
        if proc.poll() is None:
            proc.kill()
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                proc.kill()
        shutil.rmtree(user_dir, ignore_errors=True)

    if not tmp.exists() or tmp.stat().st_size < 1000:
        raise RuntimeError(f"Screenshot failed for {url}")

    from PIL import Image

    im = Image.open(tmp).convert("RGB")
    if im.size != (W, H):
        canvas = Image.new("RGB", (W, H), (246, 242, 233))
        if im.width != W:
            im = im.resize((W, int(im.height * W / im.width)), Image.Resampling.LANCZOS)
        canvas.paste(im, (0, 0))
        im = canvas
    im.save(dest, "PNG", optimize=True)
    tmp.unlink(missing_ok=True)
    print(f"  wrote {dest} ({dest.stat().st_size} bytes)", flush=True)


def render_slides() -> None:
    for html in sorted(SLIDES.glob("*.html")):
        dest = FRAMES / f"{html.stem}.png"
        url = html.resolve().as_uri()
        chrome_shot(url, dest, wait_ms=3000)


def capture_live() -> None:
    for url, name in LIVE_PAGES:
        chrome_shot(url, CAPTURES / name, wait_ms=4000)


def make_capture_frame(src: Path, dest: Path, caption: str) -> None:
    """Composite live screenshot into a branded dark frame."""
    from PIL import Image, ImageDraw, ImageFont

    bg = Image.new("RGB", (W, H), (12, 19, 32))
    shot = Image.open(src).convert("RGB")
    # Fit into inset frame
    inset = (80, 56, W - 80, H - 100)
    box_w = inset[2] - inset[0]
    box_h = inset[3] - inset[1]
    # Cover-fit top
    scale = max(box_w / shot.width, box_h / shot.height)
    nw, nh = int(shot.width * scale), int(shot.height * scale)
    shot = shot.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - box_w) // 2
    top = 0
    shot = shot.crop((left, top, left + box_w, top + box_h))
    bg.paste(shot, (inset[0], inset[1]))

    draw = ImageDraw.Draw(bg)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
        font_b = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
    except OSError:
        font = ImageFont.load_default()
        font_b = font
    draw.text((104, H - 62), "LIVE SITE", fill=(201, 198, 189), font=font)
    draw.text((260, H - 64), caption, fill=(255, 255, 255), font=font_b)
    dest.parent.mkdir(parents=True, exist_ok=True)
    bg.save(dest, "PNG", optimize=True)


def assemble() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    clip_dir = ARTIFACT / "clips"
    if clip_dir.exists():
        shutil.rmtree(clip_dir)
    clip_dir.mkdir(parents=True)

    clips: list[Path] = []
    for i, (kind, source, dur, label) in enumerate(SEQUENCE, start=1):
        if kind == "slide":
            frame = FRAMES / Path(source).with_suffix(".png").name
        else:
            raw = CAPTURES / source
            frame = FRAMES / f"capture-{Path(source).stem}.png"
            make_capture_frame(raw, frame, label)

        if not frame.exists():
            raise FileNotFoundError(frame)

        clip = clip_dir / f"{i:02d}-{frame.stem}.mp4"
        # Subtle Ken Burns zoom for motion
        # zoompan: start 1.0 → 1.06 over duration
        frames_n = max(int(dur * 30), 1)
        vf = (
            f"scale={W}:{H}:force_original_aspect_ratio=increase,"
            f"crop={W}:{H},"
            f"zoompan=z='min(1.06,1+0.00035*on)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            f"d={frames_n}:s={W}x{H}:fps=30,"
            f"fade=t=in:st=0:d=0.35,fade=t=out:st={max(dur - 0.4, 0.1)}:d=0.4"
        )
        run(
            [
                FFMPEG,
                "-y",
                "-loop",
                "1",
                "-i",
                str(frame),
                "-vf",
                vf,
                "-t",
                str(dur),
                "-r",
                "30",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-preset",
                "medium",
                "-crf",
                "20",
                str(clip),
            ]
        )
        clips.append(clip)

    concat_list = clip_dir / "concat.txt"
    concat_list.write_text("".join(f"file '{c.resolve()}'\n" for c in clips))
    run(
        [
            FFMPEG,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_list),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            "-crf",
            "20",
            str(VIDEO),
        ]
    )

    # Poster from title frame
    title = FRAMES / "01-title.png"
    if title.exists():
        from PIL import Image

        Image.open(title).convert("RGB").save(POSTER, "JPEG", quality=90)

    meta = {
        "video": str(VIDEO),
        "poster": str(POSTER),
        "duration_seconds": sum(s[2] for s in SEQUENCE),
        "resolution": f"{W}x{H}",
        "segments": [
            {"label": label, "duration": dur, "kind": kind, "source": source}
            for kind, source, dur, label in SEQUENCE
        ],
        "live_site": "https://deedscout.app/",
    }
    (OUT / "manifest.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps(meta, indent=2), flush=True)
    print(f"\nDone → {VIDEO} ({VIDEO.stat().st_size / 1e6:.1f} MB)", flush=True)


def main() -> int:
    FRAMES.mkdir(parents=True, exist_ok=True)
    CAPTURES.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    print("Rendering slides…", flush=True)
    render_slides()
    print("Capturing live site…", flush=True)
    capture_live()
    print("Assembling video…", flush=True)
    assemble()
    return 0


if __name__ == "__main__":
    sys.exit(main())
