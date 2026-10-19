"""Turns the frames recorded by e2e/media/glitchClip.spec.ts into an animated GIF.

    python scripts/make-gif.py media/frames media/typefight-glitch.gif

Needs Pillow (install it in a virtual environment, not globally). Each frame stays on screen for as
long as it took to capture the next one, so the GIF plays at real speed.
"""

import json
import sys
from pathlib import Path

from PIL import Image

WIDTH = 640


def main(frames_dir: str, out_path: str) -> None:
    folder = Path(frames_dir)
    stamps = json.loads((folder / "stamps.json").read_text())
    files = sorted(folder.glob("f*.png"))
    if not files or len(files) != len(stamps):
        raise SystemExit("The frames and stamps.json do not match; record the clip again.")
    frames = []
    for file in files:
        image = Image.open(file).convert("RGB")
        height = round(image.height * WIDTH / image.width)
        frames.append(image.resize((WIDTH, height), Image.LANCZOS).quantize(colors=128))
    # A GIF keeps time in 10 ms steps, and the last frame lingers a moment.
    durations = [max(2, round((b - a) / 10)) * 10 for a, b in zip(stamps, stamps[1:])] + [800]
    frames[0].save(
        out_path,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=True,
    )
    print(f"{len(frames)} frames, {sum(durations) / 1000:.1f} s -> {out_path}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
