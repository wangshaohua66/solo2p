#!/usr/bin/env python3
"""手动创建 cargo vendor 目录，从已缓存的 .crate 文件和 Cargo.lock 提取。"""
import json
import os
import subprocess
import sys
import tarfile
from pathlib import Path

PROJECT = Path("/Users/paul/WorkSpace/TestSoloCoder/97629273-6de4-4dc7-bd78-338f3232e65a")
CACHE = Path.home() / ".cargo/registry/cache/index.crates.io-1949cf8c6b5b557f"
VENDOR = PROJECT / "vendor"

# 从 Cargo.lock 解析需要的包
def parse_lock(path: Path):
    pkgs = []
    in_pkg = False
    name = version = None
    for line in path.read_text().splitlines():
        if line.strip() == "[[package]]":
            in_pkg = True
            name = version = None
        elif in_pkg and line.startswith("name = "):
            name = line.split('"')[1]
        elif in_pkg and line.startswith("version = "):
            version = line.split('"')[1]
        elif in_pkg and line.strip() == "" and name and version:
            in_pkg = False
            if name != "patent-analyzer":
                pkgs.append((name, version))
    if in_pkg and name and version and name != "patent-analyzer":
        pkgs.append((name, version))
    return pkgs

def main():
    VENDOR.mkdir(exist_ok=True)
    pkgs = parse_lock(PROJECT / "Cargo.lock")
    print(f"Need {len(pkgs)} packages from Cargo.lock")

    missing = []
    for name, version in pkgs:
        # crate 文件名：name-version.crate，注意 name 中的下划线和连字符需要匹配
        candidates = [f"{name}-{version}.crate"]
        # 也尝试 name 中 - 和 _ 互换
        candidates.append(f"{name.replace('-', '_')}-{version}.crate")
        candidates.append(f"{name.replace('_', '-')}-{version}.crate")
        found = None
        for c in candidates:
            p = CACHE / c
            if p.exists():
                found = p
                break
        if not found:
            missing.append((name, version))
            continue
        # 解压到 vendor/name-version/
        dest = VENDOR / f"{name}-{version}"
        if not dest.exists():
            with tarfile.open(found, "r:gz") as tf:
                tf.extractall(VENDOR)
        # 写 checksum 配置（从 Cargo.lock 提取）

    if missing:
        print(f"Missing {len(missing)} crates in cache:")
        for n, v in missing:
            print(f"  {n} {v}")
        sys.exit(1)
    else:
        print(f"All {len(pkgs)} crates extracted to {VENDOR}")

    # 生成 vendor config.toml 片段（需要 Cargo.lock 的 checksums）
    # 用 cargo vendor 支持的格式
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
