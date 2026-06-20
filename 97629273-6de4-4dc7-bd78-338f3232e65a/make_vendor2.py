#!/usr/bin/env python3
"""从 Cargo.lock + cache 提取所有 crate 到 vendor/ 并配置 cargo 使用 vendored sources"""
import json
import re
import shutil
import sys
import tarfile
from pathlib import Path

PROJECT = Path("/Users/paul/WorkSpace/TestSoloCoder/97629273-6de4-4dc7-bd78-338f3232e65a")
CACHE = Path.home() / ".cargo/registry/cache/index.crates.io-1949cf8c6b5b557f"
VENDOR = PROJECT / "vendor"

def parse_lock(path: Path):
    pkgs = []
    name = version = None
    in_pkg = False
    for line in path.read_text().splitlines():
        if line.strip() == "[[package]]":
            if in_pkg and name and version and name != "patent-analyzer":
                pkgs.append((name, version))
            in_pkg = True
            name = version = None
            continue
        if not in_pkg:
            continue
        m = re.match(r'^name = "([^"]+)"', line.strip())
        if m:
            name = m.group(1)
            continue
        m = re.match(r'^version = "([^"]+)"', line.strip())
        if m:
            version = m.group(1)
            continue
    if in_pkg and name and version and name != "patent-analyzer":
        pkgs.append((name, version))
    return pkgs

def compute_sha256(path: Path) -> str:
    import hashlib
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def crate_path(name: str, version: str) -> Path:
    """Try multiple name variations"""
    candidates = [
        f"{name}-{version}.crate",
        f"{name.replace('-', '_')}-{version}.crate",
        f"{name.replace('_', '-')}-{version}.crate",
    ]
    for c in candidates:
        p = CACHE / c
        if p.exists() and p.stat().st_size > 100:
            return p
    return None

def list_files_in_tar(path: Path):
    with tarfile.open(path, "r:gz") as tf:
        return [m.name for m in tf.getmembers()]

def main():
    pkgs = parse_lock(PROJECT / "Cargo.lock")
    # dedupe
    seen = set()
    unique = []
    for n, v in pkgs:
        k = (n, v)
        if k in seen:
            continue
        seen.add(k)
        unique.append(k)

    print(f"Need {len(unique)} unique packages from Cargo.lock")
    VENDOR.mkdir(exist_ok=True)

    missing = []
    checksums = {}
    for name, version in unique:
        cp = crate_path(name, version)
        if not cp:
            missing.append((name, version))
            continue
        # Extract the crate (tar.gz) into vendor/name-version/
        dest_name = f"{name}-{version}"
        dest = VENDOR / dest_name
        if not dest.exists():
            with tarfile.open(cp, "r:gz") as tf:
                tf.extractall(VENDOR)
        # Compute checksum for .crate file
        checksums[f"{name} {version}"] = compute_sha256(cp)
        # Write .cargo-checksum.json
        checksum_file = dest / ".cargo-checksum.json"
        # We need the checksum of the package AND the files
        # For vendored sources, cargo requires the package checksum
        # files: we need to list files under dest/
        file_checksums = {}
        for f in sorted(dest.rglob("*")):
            if f.is_file() and not str(f.relative_to(dest)).startswith(".cargo"):
                rel = str(f.relative_to(dest))
                file_checksums[rel] = compute_sha256(f)
        checksum_obj = {
            "package": checksums[f"{name} {version}"],
            "files": file_checksums,
        }
        checksum_file.write_text(json.dumps(checksum_obj))
        print(f"  OK {name} {version}")

    if missing:
        print(f"\nMissing {len(missing)} crates in cache:")
        for n, v in missing:
            print(f"  {n} {v}")
        sys.exit(1)

    # Write cargo config
    cargo_config = '''[source.crates-io]
replace-with = "vendored-sources"

[source.vendored-sources]
directory = "vendor"
'''
    (PROJECT / ".cargo").mkdir(exist_ok=True)
    (PROJECT / ".cargo" / "config.toml").write_text(cargo_config)
    print(f"\nAll {len(unique)} packages vendored successfully!")
    print(f"Wrote .cargo/config.toml with vendored-sources replacement")

if __name__ == "__main__":
    main()
