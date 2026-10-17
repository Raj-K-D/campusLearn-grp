"""
upload_to_supabase.py
======================
High-speed parallel uploader for CampusLearn compressed materials to Supabase Storage.
Uses ThreadPoolExecutor for concurrent uploads with automatic retry, extended 600s timeout,
and full resume support.

Usage:
  python scripts/upload_to_supabase.py
"""

import os
import sys
import json
import time
import threading
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
from supabase import create_client, Client, ClientOptions
from tqdm import tqdm

try:
    sys.stdout.reconfigure(encoding='utf-8')
    sys.stderr.reconfigure(encoding='utf-8')
except Exception:
    pass

SCRIPT_DIR   = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
SRC_DIR      = SCRIPT_DIR / "compressed_materials"
MANIFEST_OUT = SCRIPT_DIR / "upload_manifest.json"
BUCKET_NAME  = "materials"
MAX_WORKERS  = 3  # Stable concurrency preventing socket contention on large PDFs

load_dotenv(PROJECT_ROOT / ".env")

SUPABASE_URL      = os.getenv("VITE_SUPABASE_URL")
SERVICE_ROLE_KEY  = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SERVICE_ROLE_KEY:
    print("ERROR: VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not found in .env")
    sys.exit(1)

def fmt_size(n_bytes: int) -> str:
    if n_bytes >= 1_048_576:
        return f"{n_bytes/1_048_576:.2f} MB"
    if n_bytes >= 1024:
        return f"{n_bytes/1024:.1f} KB"
    return f"{n_bytes} B"

def get_content_type(path: Path) -> str:
    EXT_MAP = {
        ".pdf":  "application/pdf",
        ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ".ppt":  "application/vnd.ms-powerpoint",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".doc":  "application/msword",
        ".mp4":  "video/mp4",
        ".jpg":  "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png":  "image/png",
        ".txt":  "text/plain",
        ".pkt":  "application/octet-stream",
    }
    return EXT_MAP.get(path.suffix.lower(), "application/octet-stream")

def upload_single_file(file_path: Path, supabase: Client, lock: threading.Lock, manifest: dict):
    rel_path = file_path.relative_to(SRC_DIR)
    storage_key = rel_path.as_posix()
    content_type = get_content_type(file_path)
    file_size = file_path.stat().st_size

    # Check if already in manifest with matching size
    with lock:
        if storage_key in manifest and manifest[storage_key].get("size_bytes") == file_size:
            return {"status": "skipped", "key": storage_key, "size": file_size}

    MAX_RETRIES = 4
    last_err = ""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            with open(file_path, "rb") as f:
                file_bytes = f.read()

            supabase.storage.from_(BUCKET_NAME).upload(
                path=storage_key,
                file=file_bytes,
                file_options={
                    "content-type": content_type,
                    "upsert": "true"
                }
            )

            pub_url = supabase.storage.from_(BUCKET_NAME).get_public_url(storage_key)

            with lock:
                manifest[storage_key] = {
                    "public_url": pub_url,
                    "size_bytes": file_size,
                    "content_type": content_type,
                    "local_path": str(rel_path)
                }

            return {"status": "uploaded", "key": storage_key, "size": file_size}
        except Exception as e:
            last_err = str(e)
            time.sleep(2.0 * attempt)

    return {"status": "error", "key": storage_key, "error": last_err}

def main():
    if not SRC_DIR.exists():
        print(f"ERROR: Compressed materials not found at: {SRC_DIR}")
        sys.exit(1)

    all_files = [f for f in SRC_DIR.rglob("*") if f.is_file()]
    if not all_files:
        print("ERROR: No files found in compressed_materials/")
        sys.exit(1)

    manifest = {}
    if MANIFEST_OUT.exists():
        try:
            with open(MANIFEST_OUT, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            print(f"Loaded existing manifest with {len(manifest)} files.")
        except Exception:
            manifest = {}

    total_bytes = sum(f.stat().st_size for f in all_files)

    print(f"\n{'='*60}")
    print(f"  CampusLearn -> Parallel Supabase Storage Uploader")
    print(f"{'='*60}")
    print(f"  Target Bucket        : {BUCKET_NAME}")
    print(f"  Total Files          : {len(all_files)}")
    print(f"  Total Size           : {fmt_size(total_bytes)}")
    print(f"  Parallel Concurrency : {MAX_WORKERS} workers")
    print(f"  Storage Timeout      : 600s (for large books/PDFs)")
    print(f"{'='*60}\n")

    # Set storage timeout to 600 seconds
    options = ClientOptions(storage_client_timeout=600)
    supabase: Client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY, options=options)
    lock = threading.Lock()

    uploaded_count = 0
    skipped_count = 0
    error_list = []
    bytes_uploaded = 0
    completed_counter = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(upload_single_file, fp, supabase, lock, manifest): fp for fp in all_files}

        with tqdm(total=len(all_files), desc="Uploading Remaining") as pbar:
            for fut in as_completed(futures):
                res = fut.result()
                status = res.get("status")
                if status == "uploaded":
                    uploaded_count += 1
                    bytes_uploaded += res["size"]
                elif status == "skipped":
                    skipped_count += 1
                elif status == "error":
                    error_list.append((res["key"], res["error"]))

                completed_counter += 1
                if completed_counter % 10 == 0:
                    with lock:
                        with open(MANIFEST_OUT, "w", encoding="utf-8") as mf:
                            json.dump(manifest, mf, indent=2, ensure_ascii=False)

                pbar.update(1)

    with lock:
        with open(MANIFEST_OUT, "w", encoding="utf-8") as mf:
            json.dump(manifest, mf, indent=2, ensure_ascii=False)

    print(f"\n{'='*60}")
    print(f"  Upload Summary")
    print(f"{'='*60}")
    print(f"  Uploaded This Pass : {uploaded_count} files ({fmt_size(bytes_uploaded)})")
    print(f"  Skipped (Existing) : {skipped_count} files")
    print(f"  Total In Manifest  : {len(manifest)} / {len(all_files)} files")
    print(f"  Errors             : {len(error_list)}")
    if error_list:
        print("\n  Sample errors:")
        for k, err in error_list[:5]:
            print(f"    - {k}: {err}")
    print(f"\n  Manifest written to: {MANIFEST_OUT}")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    main()
