#!/usr/bin/env python3
"""Direct Cloudflare Pages deployment without wrangler."""
import os, hashlib, json, urllib.request, urllib.error, base64, sys, io
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
import blake3 as blake3_lib

MIME_TYPES = {
    ".css":   "text/css",
    ".js":    "application/javascript",
    ".mjs":   "application/javascript",
    ".html":  "text/html",
    ".htm":   "text/html",
    ".json":  "application/json",
    ".png":   "image/png",
    ".jpg":   "image/jpeg",
    ".jpeg":  "image/jpeg",
    ".svg":   "image/svg+xml",
    ".ico":   "image/x-icon",
    ".webp":  "image/webp",
    ".woff":  "font/woff",
    ".woff2": "font/woff2",
    ".ttf":   "font/ttf",
    ".txt":   "text/plain",
    ".xml":   "application/xml",
    ".map":   "application/json",
}

def get_mime(filepath):
    ext = os.path.splitext(filepath)[1].lower()
    return MIME_TYPES.get(ext, "application/octet-stream")

TOKEN = "your_cloudflare_token_here"
ACCOUNT = "your_cloudflare_account_id_here"
PROJECT = "brasilfutebolcard"
DEPLOY_DIR = "/tmp/cf-pages-deploy"
COMPAT_DATE = "2025-09-24"
COMPAT_FLAGS = ["nodejs_compat"]

def cf_request(method, path, data=None, headers_extra=None, base="https://api.cloudflare.com/client/v4"):
    url = f"{base}{path}"
    headers = {"Authorization": f"Bearer {TOKEN}"}
    if headers_extra:
        headers.update(headers_extra)
    if data is not None and isinstance(data, (dict, list)):
        body = json.dumps(data).encode()
        headers["Content-Type"] = "application/json"
    elif data is not None:
        body = data
    else:
        body = None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        body = e.read()
        try:
            return json.loads(body)
        except:
            raise Exception(f"HTTP {e.code}: {body[:200]}")

def build_multipart(fields):
    """Build multipart/form-data manually. Returns (boundary, body_bytes)."""
    boundary = "----CFDeploy" + hashlib.md5(str(fields).encode()).hexdigest()
    parts = []
    for name, content, content_type in fields:
        part = f'--{boundary}\r\n'
        if isinstance(content, str):
            content = content.encode('utf-8')
            if content_type is None:
                content_type = 'text/plain'
        elif isinstance(content, bytes):
            if content_type is None:
                content_type = 'application/octet-stream'
        part += f'Content-Disposition: form-data; name="{name}"\r\n'
        part += f'Content-Type: {content_type}\r\n\r\n'
        parts.append(part.encode() + content + b'\r\n')
    body = b''.join(parts) + f'--{boundary}--\r\n'.encode()
    return boundary, body

def build_multipart_file(fields_and_files):
    """Build multipart/form-data. fields_and_files: list of (name, value, filename, content_type)"""
    boundary = "----WranglerClone" + hashlib.md5(b"fixed").hexdigest()
    parts = []
    for item in fields_and_files:
        name, value, filename, content_type = item
        if isinstance(value, str):
            value = value.encode('utf-8')
        header = f'--{boundary}\r\n'
        if filename:
            header += f'Content-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
        else:
            header += f'Content-Disposition: form-data; name="{name}"\r\n'
        if content_type:
            header += f'Content-Type: {content_type}\r\n'
        header += '\r\n'
        parts.append(header.encode() + value + b'\r\n')
    body = b''.join(parts) + f'--{boundary}--\r\n'.encode()
    return boundary, body

def hash_file(filepath, content):
    """Compute file hash matching wrangler's blake3(base64content + ext)[:32] format."""
    ext = os.path.splitext(filepath)[1].lstrip('.')
    b64 = base64.b64encode(content).decode('ascii')
    return blake3_lib.blake3((b64 + ext).encode('utf-8')).hexdigest()[:32]

# Step 1: Collect all files
print("Step 1: Collecting files...")
file_map = {}
for root, dirs, fnames in os.walk(DEPLOY_DIR):
    for fname in fnames:
        fpath = os.path.join(root, fname)
        relpath = os.path.relpath(fpath, DEPLOY_DIR)
        with open(fpath, "rb") as f:
            content = f.read()
        h = hash_file(relpath, content)
        file_map[relpath] = {"hash": h, "content": content, "path": fpath}

# Exclude _worker.js from asset upload (handled separately as worker bundle)
worker_js_entry = file_map.pop("_worker.js", None)
print(f"  Asset files: {len(file_map)} (worker.js excluded)")
print(f"  _worker.js: {len(worker_js_entry['content'])} bytes" if worker_js_entry else "  No _worker.js found!")

# Step 2: Get upload JWT
print("\nStep 2: Getting upload JWT...")
resp = cf_request("GET", f"/accounts/{ACCOUNT}/pages/projects/{PROJECT}/upload-token")
if not resp.get("success"):
    print(f"ERROR: {resp}")
    sys.exit(1)
jwt = resp["result"]["jwt"]
print(f"  JWT: {jwt[:40]}...")

# Step 3: Check which files are missing
print("\nStep 3: Checking missing files...")
all_hashes = [v["hash"] for v in file_map.values()]
check_body = json.dumps({"hashes": all_hashes}).encode()
check_req = urllib.request.Request(
    "https://api.cloudflare.com/client/v4/pages/assets/check-missing",
    data=check_body,
    headers={"Authorization": f"Bearer {jwt}", "Content-Type": "application/json"},
    method="POST"
)
with urllib.request.urlopen(check_req) as r:
    check_resp = json.loads(r.read())
missing_hashes = set(check_resp.get("result", []))
print(f"  Missing: {len(missing_hashes)} of {len(all_hashes)} files")

# Step 4: Upload missing files in batches
if missing_hashes:
    print(f"\nStep 4: Uploading {len(missing_hashes)} files...")
    missing_files = [v for v in file_map.values() if v["hash"] in missing_hashes]
    
    BATCH = 100
    for i in range(0, len(missing_files), BATCH):
        batch = missing_files[i:i+BATCH]
        upload_fields = []
        for f in batch:
            upload_fields.append({
                "key": f["hash"],
                "value": base64.b64encode(f["content"]).decode(),
                "metadata": {"contentType": get_mime(f["path"])},
                "base64": True
            })
        upload_body = json.dumps(upload_fields).encode()
        upload_req = urllib.request.Request(
            "https://api.cloudflare.com/client/v4/pages/assets/upload",
            data=upload_body,
            headers={"Authorization": f"Bearer {jwt}", "Content-Type": "application/json"},
            method="POST"
        )
        with urllib.request.urlopen(upload_req) as r:
            upload_resp = json.loads(r.read())
        if upload_resp.get("success"):
            print(f"  Batch {i//BATCH+1}: uploaded {len(batch)} files OK")
        else:
            print(f"  Batch {i//BATCH+1} ERROR: {upload_resp}")
            sys.exit(1)
else:
    print("\nStep 4: No new files to upload (all already cached)")

# Step 5: Build _worker.js content
print("\nStep 5: Using _worker.js directly...")
worker_content = worker_js_entry["content"]
print(f"  _worker.js: {len(worker_content)} bytes")

# Step 6: Build manifest (path -> hash for all static assets)
manifest = {f"/{k}": v["hash"] for k, v in file_map.items()}
print(f"\nStep 6: Building manifest with {len(manifest)} entries...")

# Step 7: Create deployment via multipart POST
print("\nStep 7: Creating deployment...")
deploy_fields = [
    ("manifest", json.dumps(manifest).encode(), None, "application/json"),
    ("_worker.js", worker_content, "_worker.js", "application/javascript+module"),
    ("commit_dirty", b"true", None, "text/plain"),
]
deploy_boundary, deploy_body = build_multipart_file(deploy_fields)

deploy_url = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/pages/projects/{PROJECT}/deployments"
deploy_req = urllib.request.Request(
    deploy_url,
    data=deploy_body,
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": f"multipart/form-data; boundary={deploy_boundary}"
    },
    method="POST"
)
try:
    with urllib.request.urlopen(deploy_req) as r:
        deploy_resp = json.loads(r.read())
except urllib.error.HTTPError as e:
    body = e.read()
    print(f"Deploy HTTP error {e.code}: {body[:500].decode()}")
    sys.exit(1)

if deploy_resp.get("success"):
    result = deploy_resp["result"]
    print(f"\n✅ Deployment created!")
    print(f"   ID: {result.get('id')}")
    print(f"   URL: {result.get('url')}")
    print(f"   Stage: {result.get('latest_stage', {}).get('name')}")
else:
    print(f"\n❌ Deployment failed: {deploy_resp.get('errors')}")
    sys.exit(1)
