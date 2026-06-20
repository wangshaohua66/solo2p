#!/usr/bin/env python3
"""Vendor ALL cached .crate files into vendor/ directory — cargo will pick needed ones"""
import json
import hashlib
import sys
import tarfile
from pathlib import Path

PROJECT = Path("/Users/paul/WorkSpace/TestSoloCoder/97629273-6de4-4dc7-bd78-338f3232e65a")
CACHE = Path.home() / ".cargo/registry/cache/index.crates.io-1949cf8c6b5b557f"
VENDOR = PROJECT / "vendor"

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()

def main():
    VENDOR.mkdir(exist_ok=True)
    crates = list(CACHE.glob("*.crate"))
    print(f"Found {len(crates)} cached .crate files")

    n_ok = 0
    n_skip = 0
    for cp in sorted(crates):
        try:
            with tarfile.open(cp, "r:gz") as tf:
                members = tf.getmembers()
                if not members:
                    n_skip += 1
                    continue
                top = members[0].name.split("/")[0]
                dest = VENDOR / top
                if not dest.exists():
                    tf.extractall(VENDOR)
            # compute package checksum
            pkg_sum = sha256(cp)
            cs_file = VENDOR / top / ".cargo-checksum.json"
            if cs_file.exists():
                n_ok += 1
                continue
            # compute file checksums
            file_sums = {}
            dest_dir = VENDOR / top
            if dest_dir.exists():
                for f in sorted(dest_dir.rglob("*")):
                    if not f.is_file():
                        continue
                    rel = str(f.relative_to(dest_dir))
                    if rel.startswith(".cargo"):
                        continue
                    file_sums[rel] = sha256(f)
            cs_file.write_text(json.dumps({"package": pkg_sum, "files": file_sums}))
            n_ok += 1
            if n_ok % 50 == 0:
                print(f"  processed {n_ok}/{len(crates)}")
        except Exception as e:
            print(f"  WARN {cp.name}: {e}", file=sys.stderr)
            n_skip += 1

    print(f"OK={n_ok}, skipped={n_skip}")

    config = '''[source.crates-io]
replace-with = "vendored-sources"

[source.vendored-sources]
directory = "vendor"
'''
    (PROJECT / ".cargo").mkdir(exist_ok=True)
    (PROJECT / ".cargo" / "config.toml").write_text(config)
    print("Wrote .cargo/config.toml")

if __name__ == "__main__":
    main()
