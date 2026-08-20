#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""sync_upload.py — SCP upload + verify"""

import json, hashlib, subprocess, sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
CONFIG_FILE = PROJECT_ROOT / ".sync_config.json"

def load_config():
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def build_ssh_base(cfg):
    srv = cfg["server"]
    return ["ssh","-o","StrictHostKeyChecking=accept-new","-i",
            str(PROJECT_ROOT / srv["identity_file"]),"-p",str(srv["port"]),
            f"{srv['user']}@{srv['host']}"]

def build_scp_base(cfg):
    srv = cfg["server"]
    return ["scp","-o","StrictHostKeyChecking=accept-new","-i",
            str(PROJECT_ROOT / srv["identity_file"]),"-P",str(srv["port"]),"-r"]

def compute_local_hashes(local_dir):
    hashes = {}
    if not local_dir.is_dir():
        return hashes
    for fpath in local_dir.rglob("*"):
        if fpath.is_file():
            rel = fpath.relative_to(local_dir).as_posix()
            sha = hashlib.sha256(fpath.read_bytes()).hexdigest()
            hashes[rel] = sha
    return hashes

def fetch_remote_hashes(ssh_base, remote_dir):
    cmd = ssh_base + [f"cd {remote_dir} && find . -type f -exec sha256sum {{}} + 2>/dev/null || find . -type f -exec sha512sum {{}} + 2>/dev/null"]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    except Exception as e:
        print(f"  [ERROR] SSH: {e}")
        return {}
    if r.returncode != 0:
        print(f"  [ERROR] SSH rc={r.returncode} err={r.stderr.strip()}")
        return {}
    hashes = {}
    for line in r.stdout.strip().split("\n"):
        if not line.strip():
            continue
        parts = line.split(maxsplit=1)
        if len(parts) == 2:
            sha, fp = parts
            fp = fp[2:] if fp.startswith("./") else fp
            hashes[fp] = sha
    return hashes

def scp_upload(scp_base, local_dir, remote_dir):
    src = str(local_dir) + "/."
    dst = f"{scp_base[-2]}@{scp_base[-1]}:{remote_dir}/"
    cmd = scp_base[:-2] + [src, dst]
    print(f"  uploading {local_dir} ...")
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if r.returncode != 0:
        print(f"  [ERROR] SCP: {r.stderr.strip()}")
        return False
    print("  SCP done")
    return True

def verify_upload(local_dir, ssh_base, remote_dir):
    print("  verifying...")
    lh = compute_local_hashes(local_dir)
    rh = fetch_remote_hashes(ssh_base, remote_dir)
    if not lh and not rh:
        return True
    ls, rs = set(lh.keys()), set(rh.keys())
    miss = ls - rs
    extra = rs - ls
    diff = [f for f in (ls & rs) if lh[f] != rh[f]]
    if miss:
        print(f"  [WARN] remote missing: {miss}")
    if extra:
        print(f"  [WARN] remote extra: {extra}")
    if diff:
        print(f"  [WARN] content diff: {diff}")
    if not miss and not diff:
        print("  [OK] verified")
        return True
    return False

def main():
    cfg = load_config()
    ssb = build_ssh_base(cfg)
    scb = build_scp_base(cfg)
    print("=" * 60)
    print(" sync_upload — deploy to server")
    print("=" * 60)
    all_ok = True
    for m in cfg["sync_mappings"]:
        ld = (PROJECT_ROOT / m["local"])
        rd = m["remote"]
        print(f"\n--- {m['description']} ---")
        if not ld.exists():
            print(f"  [SKIP] missing: {ld}")
            continue
        if not scp_upload(scb, ld, rd):
            all_ok = False
            continue
        if not verify_upload(ld, ssb, rd):
            all_ok = False
    print("\n" + "=" * 60)
    print(" RESULT: " + ("ALL SYNCED" if all_ok else "FAILED — check errors"))
    sys.exit(0 if all_ok else 1)

if __name__ == "__main__":
    main()
