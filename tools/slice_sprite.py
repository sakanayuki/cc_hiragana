#!/usr/bin/env python3
"""assets-source/aka.jpeg の 4x4 スプライトを 1 枚ずつ背景透過 PNG に切り出す。

出力:
  public/icons/01-a.png ... 11-n.png   アプリが使うアイコン (512x512, RGBA)
  public/app-icon-192.png / app-icon-512.png / apple-touch-icon.png / favicon.png
  tools/out/contact-sheet.png          目視確認用のコンタクトシート

生成物はコミットするので CI では実行しない。素材を差し替えたときだけ手で流す:

    python3 -m pip install pillow numpy
    python3 tools/slice_sprite.py
"""

from __future__ import annotations

import sys
from collections import deque
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SPRITE = ROOT / "assets-source" / "aka.jpeg"
ICON_DIR = ROOT / "public" / "icons"
PUBLIC = ROOT / "public"
OUT_DIR = ROOT / "tools" / "out"

# --- スプライトのグリッド ------------------------------------------------
# 1024x1024 に 4x4。輝度プロファイルから実測した値 (origin=40, pitch≈246.7)。
# タイル枠より一回り小さい窓で抜き、最後に絵の外接矩形でトリムするので
# 多少のズレは結果に影響しない。
GRID_ORIGIN = 40.0
GRID_PITCH = 246.7
WINDOW = 208
COLS = 4

# 切り出し対象 11 マス。ここに (romaji, 五十音の並び順ID) を持つ。
TILES = [
    (1, "a"), (2, "i"), (3, "u"), (4, "e"), (5, "o"),
    (6, "ka"), (7, "ki"), (8, "ku"), (9, "ke"), (10, "ko"),
    (11, "n"),
]

# 背景とみなす色の判定。ページ地 (#F6F7F1) とタイル地 (#E5E9EC) の両方を拾う。
BG_TOLERANCE = 62
# タイル左上の番号が収まる領域 (タイル幅に対する比率)。
NUMBER_BOX = (0.36, 0.32)
OUTPUT_SIZE = 512
PAD_RATIO = 0.08
APP_BG = (255, 247, 232)


def is_backgroundish(px: np.ndarray) -> np.ndarray:
    """地の候補 = 彩度が低く、暗すぎない画素。

    ページ地 (#F6F7F1)、タイル地 (#E5E9EC)、タイルの丸角枠 (#8A8E8F〜#989B9B) を
    まとめて拾う。枠を含めないと塗りが枠で止まり、タイル地が抜けずに残る。
    絵は輪郭線 (ほぼ黒) で閉じているか十分に彩度が高いので巻き込まれない。
    """
    mx = px.max(axis=-1)
    mn = px.min(axis=-1)
    return (mn > 132) & ((mx - mn) < 30)


def flood_outside(rgb: np.ndarray) -> np.ndarray:
    """窓の四辺から地色を塗り広げ、絵の外側だけを True にしたマスクを返す。

    塗り広げなので、うし・おにぎりのように輪郭線で囲まれた白は残る。
    """
    h, w, _ = rgb.shape
    cand = is_backgroundish(rgb)
    outside = np.zeros((h, w), dtype=bool)
    q: deque[tuple[int, int]] = deque()

    def push(y: int, x: int) -> None:
        if 0 <= y < h and 0 <= x < w and not outside[y, x] and cand[y, x]:
            outside[y, x] = True
            q.append((y, x))

    for x in range(w):
        push(0, x)
        push(h - 1, x)
    for y in range(h):
        push(y, 0)
        push(y, w - 1)

    while q:
        y, x = q.popleft()
        push(y - 1, x)
        push(y + 1, x)
        push(y, x - 1)
        push(y, x + 1)

    # 地色そのものではないが地に極めて近い画素 (アンチエイリアスの縁) も外側に寄せる
    ref = rgb[outside].mean(axis=0) if outside.any() else np.array([240.0, 242.0, 240.0])
    near = np.abs(rgb - ref).sum(axis=-1) < BG_TOLERANCE
    grown = outside.copy()
    q = deque(zip(*np.nonzero(outside)))
    while q:
        y, x = q.popleft()
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not grown[ny, nx] and near[ny, nx]:
                grown[ny, nx] = True
                q.append((ny, nx))
    return grown


def label_components(mask: np.ndarray) -> tuple[np.ndarray, int]:
    """4 近傍の連結成分にラベルを振る。"""
    h, w = mask.shape
    labels = np.zeros((h, w), dtype=np.int32)
    current = 0
    for sy in range(h):
        for sx in range(w):
            if not mask[sy, sx] or labels[sy, sx]:
                continue
            current += 1
            labels[sy, sx] = current
            q = deque([(sy, sx)])
            while q:
                y, x = q.popleft()
                for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                    ny, nx = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx < w and mask[ny, nx] and not labels[ny, nx]:
                        labels[ny, nx] = current
                        q.append((ny, nx))
    return labels, current


def drop_number(opaque: np.ndarray, rgb: np.ndarray) -> np.ndarray:
    """タイル左上の番号 (濃紺の数字) を消す。

    「左上コーナー内で完結している」かつ「絵の主要部分ではない」成分だけを落とすので、
    絵の一部を巻き込む心配がない。
    """
    h, w = opaque.shape
    box_h = int(h * NUMBER_BOX[1])
    box_w = int(w * NUMBER_BOX[0])
    labels, n = label_components(opaque)
    if n == 0:
        return opaque

    sizes = np.bincount(labels.ravel(), minlength=n + 1)
    sizes[0] = 0
    main = int(sizes.argmax())

    cleaned = opaque.copy()
    for lab in range(1, n + 1):
        if lab == main or sizes[lab] == 0:
            continue
        ys, xs = np.nonzero(labels == lab)
        if ys.max() < box_h and xs.max() < box_w:
            cleaned[labels == lab] = False
    return cleaned


def drop_edge_speckle(opaque: np.ndarray) -> np.ndarray:
    """窓の外周に貼り付いた小さな取り残し (丸角枠の消え残り) を落とす。

    絵は窓の縁までは届かないので、外周帯に触れる小成分は枠の残骸とみなせる。
    """
    h, w = opaque.shape
    margin = 12
    limit = int(h * w * 0.02)
    labels, n = label_components(opaque)
    if n == 0:
        return opaque

    border = np.zeros((h, w), dtype=bool)
    border[:margin, :] = border[-margin:, :] = True
    border[:, :margin] = border[:, -margin:] = True

    cleaned = opaque.copy()
    sizes = np.bincount(labels.ravel(), minlength=n + 1)
    for lab in range(1, n + 1):
        sel = labels == lab
        if sizes[lab] < limit and (sel & border).any():
            cleaned[sel] = False
    return cleaned


def feather(alpha: np.ndarray) -> np.ndarray:
    """縁を 1px だけならして、抜いたあとのギザギザを目立たなくする。"""
    a = alpha.astype(np.float32)
    pad = np.pad(a, 1, mode="edge")
    blur = (
        pad[:-2, 1:-1] + pad[2:, 1:-1] + pad[1:-1, :-2] + pad[1:-1, 2:] + 4 * a
    ) / 8.0
    edge = (a > 0) & (
        (np.pad(a, 1, mode="edge")[:-2, 1:-1] == 0)
        | (np.pad(a, 1, mode="edge")[2:, 1:-1] == 0)
        | (np.pad(a, 1, mode="edge")[1:-1, :-2] == 0)
        | (np.pad(a, 1, mode="edge")[1:-1, 2:] == 0)
    )
    out = a.copy()
    out[edge] = blur[edge]
    return out.astype(np.uint8)


def cut_tile(sprite: np.ndarray, index: int) -> Image.Image:
    row, col = divmod(index, COLS)
    x0 = int(round(GRID_ORIGIN + col * GRID_PITCH))
    y0 = int(round(GRID_ORIGIN + row * GRID_PITCH))
    rgb = sprite[y0 : y0 + WINDOW, x0 : x0 + WINDOW].astype(np.int16)

    opaque = ~flood_outside(rgb)
    opaque = drop_edge_speckle(opaque)
    opaque = drop_number(opaque, rgb)
    if not opaque.any():
        raise RuntimeError(f"tile {index + 1}: 絵が残らなかった")

    ys, xs = np.nonzero(opaque)
    top, bottom, left, right = ys.min(), ys.max(), xs.min(), xs.max()

    alpha = feather(np.where(opaque, 255, 0).astype(np.uint8))
    rgba = np.dstack([rgb.astype(np.uint8), alpha])[top : bottom + 1, left : right + 1]
    img = Image.fromarray(rgba, "RGBA")

    # 正方形に余白付きで収める
    side = max(img.width, img.height)
    canvas_side = int(round(side * (1 + PAD_RATIO * 2)))
    canvas = Image.new("RGBA", (canvas_side, canvas_side), (0, 0, 0, 0))
    canvas.paste(img, ((canvas_side - img.width) // 2, (canvas_side - img.height) // 2))
    return canvas.resize((OUTPUT_SIZE, OUTPUT_SIZE), Image.LANCZOS)


def checkerboard(size: int, cell: int = 16) -> Image.Image:
    bg = Image.new("RGB", (size, size), (255, 255, 255))
    px = bg.load()
    for y in range(size):
        for x in range(size):
            if ((x // cell) + (y // cell)) % 2:
                px[x, y] = (216, 216, 216)
    return bg


def write_app_icons(source: Image.Image) -> None:
    for name, size in (
        ("app-icon-192.png", 192),
        ("app-icon-512.png", 512),
        ("apple-touch-icon.png", 180),
        ("favicon.png", 64),
    ):
        canvas = Image.new("RGBA", (size, size), APP_BG + (255,))
        inner = int(size * 0.78)
        art = source.resize((inner, inner), Image.LANCZOS)
        canvas.alpha_composite(art, ((size - inner) // 2, (size - inner) // 2))
        canvas.convert("RGB").save(PUBLIC / name)


def main() -> int:
    if not SPRITE.exists():
        print(f"素材が見つかりません: {SPRITE}", file=sys.stderr)
        return 1

    ICON_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    sprite = np.asarray(Image.open(SPRITE).convert("RGB"))

    cut: list[Image.Image] = []
    for tile_id, romaji in TILES:
        img = cut_tile(sprite, tile_id - 1)
        path = ICON_DIR / f"{tile_id:02d}-{romaji}.png"
        img.save(path)
        cut.append(img)
        print(f"  {path.relative_to(ROOT)}")

    write_app_icons(cut[0])

    # コンタクトシート (4 列)
    thumb = 200
    cols, rows = 4, (len(cut) + 3) // 4
    sheet = checkerboard(max(cols, rows) * thumb).resize((cols * thumb, rows * thumb))
    sheet = sheet.convert("RGBA")
    for i, img in enumerate(cut):
        r, c = divmod(i, cols)
        sheet.alpha_composite(img.resize((thumb, thumb), Image.LANCZOS), (c * thumb, r * thumb))
    sheet.convert("RGB").save(OUT_DIR / "contact-sheet.png")
    print(f"  {(OUT_DIR / 'contact-sheet.png').relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
