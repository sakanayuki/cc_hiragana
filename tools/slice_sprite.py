#!/usr/bin/env python3
"""assets-source/ の 4x4 スプライトを 1 マスずつ背景透過 PNG に切り出す。

出力:
  public/icons/01-a.png ... 46-n.png   アプリが使うアイコン (512x512, RGBA)
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
SOURCE_DIR = ROOT / "assets-source"
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

# 切り出し対象。スプライトごとに (シート内のマス番号, 通し番号, ローマ字)。
# 通し番号は五十音の並び順で、出力ファイル名 "{通し番号:02d}-{ローマ字}.png" になる。
# 「ん」はおまけなので行が増えても末尾に居座るよう 46 に固定してある。
# 行を足すときは新しいスプライトをここに 1 ブロック追加するだけでよい。
SHEETS: list[tuple[str, list[tuple[int, int, str]]]] = [
    (
        "aka.jpeg",
        [
            (1, 1, "a"), (2, 2, "i"), (3, 3, "u"), (4, 4, "e"), (5, 5, "o"),
            (6, 6, "ka"), (7, 7, "ki"), (8, 8, "ku"), (9, 9, "ke"), (10, 10, "ko"),
            (11, 46, "n"),
        ],
    ),
    (
        "sata.jpeg",
        [
            (1, 11, "sa"), (2, 12, "shi"), (3, 13, "su"), (4, 14, "se"), (5, 15, "so"),
            (6, 16, "ta"), (7, 17, "chi"), (8, 18, "tsu"), (9, 19, "te"), (10, 20, "to"),
        ],
    ),
    (
        # 16 マス目まで埋まっていて、最後の「やかん」だけ や行の頭。
        # ふ は音声ファイルが hu.mp3 (訓令式) なのでローマ字も hu に合わせる。
        "nahama.jpeg",
        [
            (1, 21, "na"), (2, 22, "ni"), (3, 23, "nu"), (4, 24, "ne"), (5, 25, "no"),
            (6, 26, "ha"), (7, 27, "hi"), (8, 28, "hu"), (9, 29, "he"), (10, 30, "ho"),
            (11, 31, "ma"), (12, 32, "mi"), (13, 33, "mu"), (14, 34, "me"), (15, 35, "mo"),
            (16, 36, "ya"),
        ],
    ),
    (
        # や行の続き (ゆ・よ) から。9 マス目「えをかく」が を。
        "yurawa.jpeg",
        [
            (1, 37, "yu"), (2, 38, "yo"),
            (3, 39, "ra"), (4, 40, "ri"), (5, 41, "ru"), (6, 42, "re"), (7, 43, "ro"),
            (8, 44, "wa"), (9, 45, "wo"),
        ],
    ),
]

# 地色からの距離 (RGB 各チャンネル差の合計) のしきい値。
# タイル地 ≈ (220,227,231) に対し、はさみの刃 (171,172,177) は 151、
# やかんの銀 (203,207,210) は 68、まくらの白 (254,254,254) は 89 離れている。
# 44 まで絞ればこれらを残したまま地とアンチエイリアスだけ落とせる。
BG_TIGHT = 44
BG_LOOSE = 58
HALO_STEPS = 2
# 縁飾り (丸角枠 + 白いリング) を落とすために窓から削る幅。
TILE_INSET = 14

# タイル左上の番号が収まる領域 (タイル幅に対する比率)。
NUMBER_BOX = (0.36, 0.32)
OUTPUT_SIZE = 512
PAD_RATIO = 0.08
APP_BG = (255, 247, 232)


def ring_mask(size: int, inset: int, width: int = 3) -> np.ndarray:
    """窓の内側 inset の位置にある細いリング。地色のサンプリングに使う。"""
    m = np.zeros((size, size), dtype=bool)
    m[inset : inset + width, inset:-inset] = True
    m[-inset - width : -inset, inset:-inset] = True
    m[inset:-inset, inset : inset + width] = True
    m[inset:-inset, -inset - width : -inset] = True
    return m


def erase_number(rgb: np.ndarray) -> np.ndarray:
    """左上の番号を、周囲の色で塗り潰して消す。

    番号は濃紺 ((13,28,49)〜(30,60,94)) で、必ずタイルの左上に置かれている。
    たいていのタイルでは番号はタイル地の上に乗っているので、塗り潰した結果は
    地色になり、このあとの background_mask がまとめて落としてくれる。
    「ぬりえ」のように絵自身が白い台紙を持っていて番号がその上に乗っている
    タイルでも、台紙の色で塗り潰されるので跡が残らない。

    絵の輪郭線 (黒や濃い赤) を巻き込まないよう、青が赤より明確に強い
    暗い画素だけを番号とみなす。
    """
    h, w, _ = rgb.shape
    box_h, box_w = int(h * NUMBER_BOX[1]), int(w * NUMBER_BOX[0])
    box = rgb[:box_h, :box_w]
    r, g, b = box[..., 0], box[..., 1], box[..., 2]
    is_number = (b > r + 20) & (b < 150) & (r < 110) & (g < 130)
    if not is_number.any():
        return rgb

    # アンチエイリアスの縁まで含めるよう 2px 広げる
    grown = is_number.copy()
    for _ in range(2):
        nb = np.zeros_like(grown)
        nb[1:, :] |= grown[:-1, :]
        nb[:-1, :] |= grown[1:, :]
        nb[:, 1:] |= grown[:, :-1]
        nb[:, :-1] |= grown[:, 1:]
        grown |= nb & (b > r + 8) & (r < 190)

    filler = np.median(box[~grown], axis=0) if (~grown).any() else box.reshape(-1, 3).mean(axis=0)
    out = rgb.copy()
    out[:box_h, :box_w][grown] = filler.astype(rgb.dtype)
    return out


def background_mask(rgb: np.ndarray) -> np.ndarray:
    """タイル地と判定する画素を返す。

    呼び出し側で縁飾り (灰色の丸角枠とその内側の白いリング) を切り落としてから
    渡すので、ここに来るのは「タイル地 + 絵」だけ。あとは地色を実測して、
    その色に十分近い画素を落とすだけでよい。

    連結成分をたどらないので、ゆびわのように輪郭で囲まれた穴も地色なら抜ける。
    逆に、やかんの銀 (203,207,210)・はさみの刃 (171,172,177)・まくらの白
    (254,254,254) は地色 (≈222,228,232) から 68〜151 離れているので残る。
    """
    tile = rgb[ring_mask(rgb.shape[0], 1)].mean(axis=0)
    dist = np.abs(rgb - tile).sum(axis=-1)
    bg = dist < BG_TIGHT

    # 地と絵の境目に残るアンチエイリアスの縁を、地に接した画素から 2px だけ削る。
    # 無制限に広げると銀色や白の絵が端から丸ごと崩れるので回数で止める。
    loose = dist < BG_LOOSE
    for _ in range(HALO_STEPS):
        neighbour = np.zeros_like(bg)
        neighbour[1:, :] |= bg[:-1, :]
        neighbour[:-1, :] |= bg[1:, :]
        neighbour[:, 1:] |= bg[:, :-1]
        neighbour[:, :-1] |= bg[:, 1:]
        bg |= neighbour & loose
    return bg


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
    x0 = int(round(GRID_ORIGIN + col * GRID_PITCH)) + TILE_INSET
    y0 = int(round(GRID_ORIGIN + row * GRID_PITCH)) + TILE_INSET
    side = WINDOW - TILE_INSET * 2
    # 縁飾りは窓の外周 0〜12px に収まっており、絵がその下に潜り込むことはない。
    # 先に内側だけを取り出してしまえば、あとは地色を消すだけで済む。
    rgb = sprite[y0 : y0 + side, x0 : x0 + side].astype(np.int16)
    rgb = erase_number(rgb)

    opaque = ~background_mask(rgb)
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
    ICON_DIR.mkdir(parents=True, exist_ok=True)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    cut: dict[int, Image.Image] = {}
    for sheet_name, tiles in SHEETS:
        path = SOURCE_DIR / sheet_name
        if not path.exists():
            print(f"素材が見つかりません: {path}", file=sys.stderr)
            return 1
        sprite = np.asarray(Image.open(path).convert("RGB"))
        for tile_no, order, romaji in tiles:
            img = cut_tile(sprite, tile_no - 1)
            out = ICON_DIR / f"{order:02d}-{romaji}.png"
            img.save(out)
            cut[order] = img
            print(f"  {out.relative_to(ROOT)}")

    # アプリアイコンは「あり」を流用する
    write_app_icons(cut[1])

    # コンタクトシート (通し番号順、4 列)
    ordered = [cut[key] for key in sorted(cut)]
    thumb = 200
    cols, rows = 4, (len(ordered) + 3) // 4
    sheet = checkerboard(max(cols, rows) * thumb).resize((cols * thumb, rows * thumb))
    sheet = sheet.convert("RGBA")
    for i, img in enumerate(ordered):
        r, c = divmod(i, cols)
        sheet.alpha_composite(img.resize((thumb, thumb), Image.LANCZOS), (c * thumb, r * thumb))
    sheet.convert("RGB").save(OUT_DIR / "contact-sheet.png")
    print(f"  {(OUT_DIR / 'contact-sheet.png').relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
