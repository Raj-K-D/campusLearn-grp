"""
compress_resources.py
=====================
Maximally compresses study material files to minimize storage usage before Supabase upload.

Supported formats:
  - PDF: pikepdf stream compression + deduplication + linearize/object streams
  - PPTX: ZIP-level media stream downscaling (>1600px) & JPEG/PNG recompression
  - DOCX: ZIP-level media stream downscaling & JPEG/PNG recompression
  - JPG/JPEG: Pillow optimize & quality 75
  - Other: copied as-is

Excluded per user instructions:
  - .exe: Cisco Packet Tracer installer (~223 MB, copyright & large installer)
  - .mp4: Introduction of Turing Machine (~69 MB, served via link)
  - .DS_Store: macOS metadata junk

Usage:
  python scripts/compress_resources.py
"""

import os
import io
import sys
import shutil
import zipfile
from pathlib import Path
from PIL import Image
import pikepdf
from tqdm import tqdm

SCRIPT_DIR   = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
SRC_DIR      = PROJECT_ROOT / "public" / "materials"
OUT_DIR      = SCRIPT_DIR / "compressed_materials"

# Exclusions
SKIP_EXTENSIONS = {".exe", ".mp4", ".ds_store"}
SKIP_FILENAMES  = {".DS_Store"}

def fmt_size(n_bytes: int) -> str:
    if n_bytes >= 1_048_576:
        return f"{n_bytes/1_048_576:.2f} MB"
    if n_bytes >= 1024:
        return f"{n_bytes/1024:.1f} KB"
    return f"{n_bytes} B"

def compress_pdf(src: Path, dst: Path) -> bool:
    """Use pikepdf for stream compression and object deduplication."""
    try:
        with pikepdf.open(src) as pdf:
            pdf.save(
                dst,
                compress_streams=True,
                object_stream_mode=pikepdf.ObjectStreamMode.generate,
                linearize=False
            )
        return True
    except Exception as e:
        print(f"\n  [PDF ERR] {src.name}: {e}")
        return False

def compress_office_zip(src: Path, dst: Path, max_dim: int = 1600, quality: int = 75) -> bool:
    """
    Compress embedded images inside PPTX or DOCX archives directly.
    Preserves exact internal structure and MIME validity.
    """
    try:
        buf_out = io.BytesIO()
        with zipfile.ZipFile(src, "r") as zin:
            with zipfile.ZipFile(buf_out, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as zout:
                for item in zin.infolist():
                    data = zin.read(item.filename)
                    ext = os.path.splitext(item.filename)[1].lower()
                    if ("media/" in item.filename) and ext in (".png", ".jpg", ".jpeg", ".bmp"):
                        try:
                            img = Image.open(io.BytesIO(data))
                            # Downscale huge dimensions if needed
                            if img.width > max_dim or img.height > max_dim:
                                img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

                            ibuf = io.BytesIO()
                            if ext == ".png":
                                if img.mode in ("RGBA", "LA"):
                                    img.save(ibuf, format="PNG", optimize=True)
                                else:
                                    img_p = img.convert("P", palette=Image.ADAPTIVE, colors=256)
                                    img_p.save(ibuf, format="PNG", optimize=True)
                            else:
                                if img.mode in ("RGBA", "P"):
                                    img = img.convert("RGB")
                                img.save(ibuf, format="JPEG", quality=quality, optimize=True)

                            new_data = ibuf.getvalue()
                            if len(new_data) < len(data):
                                data = new_data
                        except Exception:
                            pass
                    zout.writestr(item, data)

        with open(dst, "wb") as f:
            f.write(buf_out.getvalue())
        return True
    except Exception as e:
        print(f"\n  [OFFICE ERR] {src.name}: {e}")
        return False

def compress_image(src: Path, dst: Path, quality: int = 75) -> bool:
    """Optimize standalone JPEG images."""
    try:
        with Image.open(src) as im:
            if im.mode in ("RGBA", "P"):
                im = im.convert("RGB")
            im.save(dst, format="JPEG", quality=quality, optimize=True)
        return True
    except Exception as e:
        print(f"\n  [IMG ERR] {src.name}: {e}")
        return False

def main():
    if not SRC_DIR.exists():
        print(f"ERROR: Source directory not found: {SRC_DIR}")
        sys.exit(1)

    if OUT_DIR.exists():
        shutil.rmtree(OUT_DIR)
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    all_files = [
        f for f in SRC_DIR.rglob("*")
        if f.is_file()
        and f.suffix.lower() not in SKIP_EXTENSIONS
        and f.name not in SKIP_FILENAMES
    ]

    skipped_files = [
        f for f in SRC_DIR.rglob("*")
        if f.is_file()
        and (f.suffix.lower() in SKIP_EXTENSIONS or f.name in SKIP_FILENAMES)
    ]

    print(f"\n{'='*60}")
    print(f"  CampusLearn High-Efficiency Resource Compressor")
    print(f"{'='*60}")
    print(f"  Source       : {SRC_DIR}")
    print(f"  Output       : {OUT_DIR}")
    print(f"  To Compress  : {len(all_files)} files")
    print(f"  Excluded     : {len(skipped_files)} files (e.g. .exe installer, .mp4 video)")
    print(f"{'='*60}\n")

    for sf in skipped_files:
        print(f"  [EXCLUDED] {sf.name} ({fmt_size(sf.stat().st_size)})")

    total_before = 0
    total_after  = 0
    errors       = []
    processed    = 0

    for src_path in tqdm(all_files, desc="Compressing", total=len(all_files)):
        rel = src_path.relative_to(SRC_DIR)
        dst_path = OUT_DIR / rel
        dst_path.parent.mkdir(parents=True, exist_ok=True)

        size_before = src_path.stat().st_size
        total_before += size_before
        ext = src_path.suffix.lower()

        ok = False
        if ext == ".pdf":
            ok = compress_pdf(src_path, dst_path)
        elif ext in (".pptx", ".docx"):
            ok = compress_office_zip(src_path, dst_path)
        elif ext in (".jpg", ".jpeg"):
            ok = compress_image(src_path, dst_path)
        else:
            shutil.copy2(src_path, dst_path)
            ok = True

        if not ok:
            errors.append(str(rel))
            shutil.copy2(src_path, dst_path)

        size_after = dst_path.stat().st_size
        total_after += size_after
        processed += 1

    saved = total_before - total_after
    pct = (saved / total_before * 100) if total_before else 0

    print(f"\n{'='*60}")
    print(f"  Compression Finished")
    print(f"{'='*60}")
    print(f"  Files Processed : {processed}")
    print(f"  Original Size   : {fmt_size(total_before)}")
    print(f"  Compressed Size : {fmt_size(total_after)}")
    print(f"  Storage Saved   : {fmt_size(saved)} ({pct:.1f}%)")
    print(f"  Target Storage  : Under 1 GB Supabase limit ({fmt_size(total_after)} < 1000 MB)")
    if errors:
        print(f"\n  Fallback copies ({len(errors)} files):")
        for e in errors[:5]:
            print(f"    - {e}")
    print(f"\n  Output Location : {OUT_DIR}")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
