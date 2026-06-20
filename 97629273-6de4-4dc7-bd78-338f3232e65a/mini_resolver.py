#!/usr/bin/env python3
"""
Mini cargo dependency resolver + lockfile generator.
- Reads sparse registry index entries (already downloaded via curl),
- Resolves semver constraints,
- Downloads missing .crate files via curl,
- Writes Cargo.lock (version = 4).
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tarfile
import urllib.request
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

PROJECT = Path("/Users/paul/WorkSpace/TestSoloCoder/97629273-6de4-4dc7-bd78-338f3232e65a")
CACHE = Path.home() / ".cargo/registry/cache/index.crates.io-1949cf8c6b5b557f"
SPARSE_INDEX = Path.home() / ".cargo/registry/index/index.crates.io-1949cf8c6b5b557f"
CRATES_IO = "https://static.crates.io/crates"
REGISTRY_URL = "sparse+https://index.crates.io/"

def index_rel(name: str) -> str:
    n = len(name)
    if n <= 2:
        return f"{n}/{name}"
    elif n == 3:
        return f"3/{name[0]}/{name}"
    else:
        return f"{name[:2]}/{name[2:4]}/{name}"

def read_index(name: str) -> List[dict]:
    rel = index_rel(name)
    p = SPARSE_INDEX / rel
    if not p.exists():
        # try .cache
        p2 = SPARSE_INDEX / ".cache" / rel
        if p2.exists():
            p = p2
    entries = []
    if p.exists():
        for line in p.read_text(errors="replace").splitlines():
            line = line.strip()
            if line:
                try:
                    entries.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
    return entries

def download_index(name: str) -> List[dict]:
    rel = index_rel(name)
    target = SPARSE_INDEX / ".cache" / rel
    if target.exists() and target.stat().st_size > 50:
        first = target.read_bytes()[:1]
        if first == b"{":
            return read_index(name)
    target.parent.mkdir(parents=True, exist_ok=True)
    url = f"https://index.crates.io/{rel}"
    try:
        result = subprocess.run(
            ["curl", "-sS", "--max-time", "30", "-o", str(target), url],
            capture_output=True, text=True, timeout=35)
        if result.returncode == 0 and target.exists() and target.stat().st_size > 50:
            # also copy to root index
            (SPARSE_INDEX / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, SPARSE_INDEX / rel)
    except Exception as e:
        print(f"  WARN: download index {name}: {e}", file=sys.stderr)
    return read_index(name)

def download_crate(name: str, version: str) -> Optional[Path]:
    """下载 .crate 文件到缓存目录，使用 curl"""
    fname = f"{name}-{version}.crate"
    target = CACHE / fname
    if target.exists() and target.stat().st_size > 100:
        return target
    CACHE.mkdir(parents=True, exist_ok=True)
    url = f"{CRATES_IO}/{name}/{fname}"
    try:
        result = subprocess.run(
            ["curl", "-sS", "--max-time", "120", "-o", str(target), url],
            capture_output=True, text=True, timeout=130)
        if result.returncode == 0 and target.exists() and target.stat().st_size > 100:
            print(f"  downloaded {name} {version} ({target.stat().st_size} bytes)")
            return target
        print(f"  WARN curl failed for {name} {version}: {result.stderr[:100]}", file=sys.stderr)
        if target.exists() and target.stat().st_size <= 100:
            target.unlink()
    except Exception as e:
        print(f"  ERROR downloading {name} {version}: {e}", file=sys.stderr)
    return None

# ----------------- semver parsing (subset sufficient for our needs) -----------------

def parse_version(v: str) -> Tuple[int, ...]:
    v = v.split("+")[0].split("-")[0]
    parts = []
    for p in v.split("."):
        try:
            parts.append(int(p))
        except ValueError:
            parts.append(0)
    while len(parts) < 3:
        parts.append(0)
    return tuple(parts[:3])

def ver_str(t: Tuple[int, ...]) -> str:
    return ".".join(str(x) for x in t)

def matches_constraint(version: str, constraint: str) -> bool:
    """简化版 semver 匹配，支持 ^, ~, >=, <=, >, <, =, * 以及逗号分隔多约束"""
    constraint = constraint.strip()
    v_parts = parse_version(version)
    # 处理多约束
    for part in re.split(r",\s*", constraint):
        part = part.strip()
        if not part:
            continue
        if part == "*":
            continue
        m = re.match(r"^([\^~><=]*)\s*(\d.*)", part)
        if not m:
            return True  # 宽松处理未知
        op, ver = m.groups()
        c_parts = parse_version(ver)
        if op in ("", "^"):
            # ^MAJOR.MINOR.PATCH
            if c_parts[0] == 0:
                if c_parts[1] == 0:
                    if not (v_parts[:3] == c_parts[:3]):
                        return False
                else:
                    if not (v_parts[:2] == c_parts[:2] and v_parts >= c_parts):
                        return False
            else:
                if not (v_parts[0] == c_parts[0] and v_parts >= c_parts):
                    return False
        elif op == "~":
            if not (v_parts[:2] == c_parts[:2] and v_parts >= c_parts):
                return False
        elif op == ">=":
            if not (v_parts >= c_parts):
                return False
        elif op == ">":
            if not (v_parts > c_parts):
                return False
        elif op == "<=":
            if not (v_parts <= c_parts):
                return False
        elif op == "<":
            if not (v_parts < c_parts):
                return False
        elif op == "=":
            if not (v_parts == c_parts):
                return False
    return True

def best_version(entries: List[dict], constraint: str) -> Optional[dict]:
    """返回最高匹配、未被 yank 的版本"""
    best = None
    best_ver = (-1, -1, -1)
    for e in entries:
        if e.get("yanked", False):
            continue
        v = e.get("vers", "0.0.0")
        if matches_constraint(v, constraint):
            vp = parse_version(v)
            if vp > best_ver:
                best = e
                best_ver = vp
    return best

# ----------------- main resolver -----------------

def parse_cargo_toml(path: Path):
    """very rough TOML parser — sufficient for our Cargo.toml"""
    deps = {}
    dev_deps = {}
    current = None
    for line in path.read_text().splitlines():
        s = line.strip()
        if s.startswith("[dependencies]"):
            current = deps
            continue
        if s.startswith("[dev-dependencies]"):
            current = dev_deps
            continue
        if s.startswith("["):
            current = None
            continue
        if current is None or not s or s.startswith("#"):
            continue
        # name = "version" 或 name = { version = "x", features = [...] }
        m = re.match(r'^([A-Za-z0-9_-]+)\s*=\s*"([^"]+)"', s)
        if m:
            current[m.group(1)] = m.group(2)
            continue
        m = re.match(r'^([A-Za-z0-9_-]+)\s*=\s*\{', s)
        if m:
            name = m.group(1)
            # extract version
            m2 = re.search(r'version\s*=\s*"([^"]+)"', s)
            if m2:
                current[name] = m2.group(1)
    return deps, dev_deps

def resolve(deps: Dict[str, str]) -> Dict[str, dict]:
    """BFS resolver returning {name: index_entry}"""
    resolved: Dict[str, dict] = {}
    queue: List[Tuple[str, str]] = list(deps.items())
    visited: Set[str] = set()
    while queue:
        name, constraint = queue.pop(0)
        if name in visited:
            continue
        visited.add(name)
        entries = read_index(name)
        if not entries:
            entries = download_index(name)
        if not entries:
            print(f"ERROR: no index for {name}", file=sys.stderr)
            continue
        entry = best_version(entries, constraint)
        if not entry:
            print(f"ERROR: no matching version for {name} {constraint}", file=sys.stderr)
            # fallback: highest version
            entry = entries[-1] if entries else None
        if not entry:
            continue
        resolved[name] = entry
        # add transitive deps
        for d in entry.get("deps", []):
            if d.get("kind") in ("dev", "build"):
                continue
            if d.get("optional", False):
                continue
            target = d.get("package", d["name"])
            if target in visited:
                continue
            queue.append((target, d["req"]))
    return resolved

def gen_lockfile(resolved: Dict[str, dict], pk_name: str, pk_version: str, direct_deps: List[str], dev_deps_names: List[str]) -> str:
    lines = [
        "# This file is automatically @generated by Cargo.",
        "# It is not intended for manual editing.",
        "version = 4",
        "",
        "[[package]]",
        f'name = "{pk_name}"',
        f'version = "{pk_version}"',
        "dependencies = [",
    ]
    for d in sorted(set(direct_deps + dev_deps_names)):
        if d in resolved:
            lines.append(f' "{d} {resolved[d]["vers"]}",')
    lines.append("]")
    lines.append("")
    for name in sorted(resolved.keys()):
        e = resolved[name]
        lines.append("[[package]]")
        lines.append(f'name = "{name}"')
        lines.append(f'version = "{e["vers"]}"')
        lines.append(f'source = "{REGISTRY_URL}"')
        if "cksum" in e:
            lines.append(f'checksum = "{e["cksum"]}"')
        sub = [d.get("package", d["name"]) for d in e.get("deps", [])
                if not d.get("kind") in ("dev", "build") and not d.get("optional", False)]
        if sub:
            lines.append("dependencies = [")
            for sd in sorted(set(sub)):
                if sd in resolved:
                    lines.append(f' "{sd} {resolved[sd]["vers"]}",')
            lines.append("]")
        lines.append("")
    return "\n".join(lines) + "\n"

def main():
    deps, dev_deps = parse_cargo_toml(PROJECT / "Cargo.toml")
    print(f"Direct deps:", list(deps.keys()))
    print(f"Dev deps:", list(dev_deps.keys()))
    all_deps = {**deps, **dev_deps}
    resolved = resolve(all_deps)
    print(f"\nResolved {len(resolved)} packages:")
    for n, e in sorted(resolved.items()):
        print(f"  {n} {e['vers']}")

    print(f"\nDownloading missing crates...")
    missing = 0
    for n, e in resolved.items():
        p = download_crate(n, e["vers"])
        if not p:
            missing += 1
    if missing:
        print(f"\n{missing} crates failed to download!", file=sys.stderr)

    # generate lock
    lock = gen_lockfile(
        resolved, "patent-analyzer", "0.1.0",
        list(deps.keys()), list(dev_deps.keys()))
    (PROJECT / "Cargo.lock").write_text(lock)
    print(f"\nWrote Cargo.lock ({len(lock)} bytes)")

if __name__ == "__main__":
    main()
