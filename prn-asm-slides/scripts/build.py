#!/usr/bin/env python3
"""Ghép prn-asm-slides/index.html từ các mảnh trong src/.

Cách dùng:
    python scripts/build.py           # ghi index.html
    python scripts/build.py --check    # chỉ kiểm tra, không ghi

Bố cục đầu ra:
    <style> tokens + deck + prn + editor </style>
    <div id="root"></div>
    react-vendor.part   (React 16 UMD + ReactDOM, đã bọc <script>)
    slides.js.part      (18 slide React + điều hướng + ghi chú)
    #prn-baked-state    (JSON 18 slide rỗng cho editor)
    editor.js.part      (editor on-page, giữ nguyên cơ chế cũ)
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
OUT = ROOT / "index.html"
TOTAL = 18

CSS_PARTS = ["tokens.css.part", "deck.css.part", "prn.css.part", "editor.css.part"]

HEAD = """<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
  <meta name="theme-color" content="#F2F4F0" />
  <meta name="description" content="PRN ASM · Sudoku Online — 18 tờ trình chiếu theo rubric PRN232 Final Assignment (C4, ERD, REST, background job, Kafka, gRPC, Docker)." />
  <title>PRN232 · PRN ASM — Sudoku Online · 18 tờ trình chiếu</title>
  <style>
"""


def read_part(name: str) -> str:
    path = SRC / name
    if not path.exists():
        sys.exit(f"Thiếu mảnh: {path}")
    return path.read_text(encoding="utf-8").replace("\r\n", "\n").rstrip() + "\n"


def count_items(js: str, decl: str) -> int:
    """Đếm phần tử của một mảng literal dạng `const <decl>=[ ... ];`."""
    start = js.find(f"const {decl}=[")
    if start < 0:
        sys.exit(f"Không tìm thấy khai báo `const {decl}=[` trong slides.js.part")
    body_start = start + len(f"const {decl}=[")
    end = js.find("];", body_start)
    if end < 0:
        sys.exit(f"Không thấy `];` kết thúc mảng `{decl}`")
    body = js[body_start:end]
    depth = 0
    items = 1 if body.strip() else 0
    quote = None
    for ch in body:
        if quote:
            if ch == quote:
                quote = None
            continue
        if ch in "'\"":
            quote = ch
        elif ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif ch == "," and depth == 0:
            items += 1
    return items


def count_notes(js: str) -> int:
    start = js.find("const NOTES=[")
    if start < 0:
        sys.exit("Không tìm thấy `const NOTES=[` trong slides.js.part")
    end = js.find("\n];", start)
    block = js[start:end]
    return len(re.findall(r"^\s+'", block, re.M))


def brace_balance(css: str, name: str) -> None:
    if css.count("{") != css.count("}"):
        sys.exit(f"CSS lệch ngoặc trong {name}: {css.count('{')} mở / {css.count('}')} đóng")


def check(css: str, js: str) -> None:
    errors: list[str] = []

    n_slides = count_items(js, "slides")
    n_titles = count_items(js, "slideTitles")
    n_notes = count_notes(js)
    if n_slides != TOTAL:
        errors.append(f"`slides` có {n_slides} phần tử, cần {TOTAL}")
    if n_titles != TOTAL:
        errors.append(f"`slideTitles` có {n_titles} phần tử, cần {TOTAL}")
    if n_notes != TOTAL:
        errors.append(f"`NOTES` có {n_notes} phần tử, cần {TOTAL}")

    # Màu chỉ được khai báo trong tokens.css.part.
    for name in ["deck.css.part", "prn.css.part", "editor.css.part"]:
        part = read_part(name)
        stray = re.findall(r"#[0-9a-fA-F]{3,8}\b", part)
        if stray:
            errors.append(f"{name} còn mã màu cứng: {sorted(set(stray))}")

    balance = css.count("{") - css.count("}")
    if balance != 0:
        errors.append(f"CSS lệch {balance} dấu ngoặc nhọn")

    if re.search(r"url\(\s*['\"]?https?://", css):
        errors.append("CSS còn tham chiếu tài nguyên mạng; bản trình chiếu phải chạy offline")

    for needed in [".presentation-shell", ".stage", ".slide-canvas", ".slide-inner"]:
        if needed not in css:
            errors.append(f"Thiếu selector bắt buộc cho editor: {needed}")

    if errors:
        print("✗ Kiểm tra thất bại:")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    print(f"✓ {n_slides} slide · {n_titles} tiêu đề · {n_notes} ghi chú · CSS cân ngoặc · không mã màu ngoài tokens")


def node_check(js: str) -> None:
    """Nhờ Node kiểm tra cú pháp slides.js.part trước khi ghi file."""
    node = shutil.which("node")
    if not node:
        print("· Bỏ qua kiểm tra cú pháp (không thấy node trong PATH)")
        return
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "slides.js"
        path.write_text(js, encoding="utf-8")
        res = subprocess.run([node, "--check", str(path)], capture_output=True, text=True)
    if res.returncode != 0:
        detail = (res.stderr or res.stdout).strip().splitlines()
        sys.exit("✗ Lỗi cú pháp trong slides.js.part:\n" + "\n".join(detail[:12]))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true", help="chỉ kiểm tra, không ghi index.html")
    args = ap.parse_args()

    css_parts = [(name, read_part(name)) for name in CSS_PARTS]
    for name, text in css_parts:
        brace_balance(text, name)
    css = "\n".join(f"/* ===== {name} ===== */\n{text}" for name, text in css_parts)

    js = read_part("slides.js.part")
    check(css, js)
    node_check(js)

    if args.check:
        return

    vendor = read_part("react-vendor.part")
    if not vendor.rstrip().endswith("</script>"):
        sys.exit("react-vendor.part phải kết thúc bằng </script>")
    editor = read_part("editor.js.part")

    baked = json.dumps(
        {"version": 2, "slides": [{"texts": {}, "objects": []} for _ in range(TOTAL)]},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    if len(json.loads(baked)["slides"]) != TOTAL:
        sys.exit(f"Không dựng được #prn-baked-state với đúng {TOTAL} slide")

    html = (
        HEAD
        + css
        + "</style>\n</head>\n<body>\n<div id=\"root\"></div>\n"
        + vendor
        + '<script id="prn-slides">\n'
        + js
        + "</script>\n"
        + f'<script id="prn-baked-state" type="application/json">{baked}</script>\n'
        + editor
        + "</body>\n</html>\n"
    )

    opens = [l for l in html.splitlines() if re.fullmatch(r"\s*<script[^>]*>", l)]
    closes = [l for l in html.splitlines() if re.fullmatch(r"\s*</script>", l)]
    if len(opens) != len(closes):
        sys.exit(
            f"Thẻ script lệch: {len(opens)} mở / {len(closes)} đóng "
            "(một mảnh JS đang thiếu thẻ đóng)"
        )
    for marker in ['id="prn-baked-state"', 'id="prn-slide-editor"', 'id="root"']:
        if marker not in html:
            sys.exit(f"Thiếu mốc bắt buộc trong HTML: {marker}")

    OUT.write_text(html, encoding="utf-8", newline="\n")
    size = OUT.stat().st_size
    print(f"✓ Ghi {OUT.relative_to(ROOT)} — {size / 1024:.1f} KB")


if __name__ == "__main__":
    main()
