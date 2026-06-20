#!/usr/bin/env python3
"""完整的依赖解析器：遍历 Cargo.toml，读取稀疏索引，下载所有需要的 .crate，生成 vendor/ 和 Cargo.lock"""
import subprocess, json, os, sys, tarfile, hashlib, re
from pathlib import Path
from collections import defaultdict

HOME = Path.home()
PROJECT = Path("/Users/paul/WorkSpace/TestSoloCoder/97629273-6de4-4dc7-bd78-338f3232e65a")
SPARSE = HOME / ".cargo/registry/index/index.crates.io-1949cf8c6b5b557f"
CACHE = HOME / ".cargo/registry/cache/index.crates.io-1949cf8c6b5b557f"
CRATES_IO = "https://static.crates.io/crates"

def index_rel(name):
    n = len(name)
    if n <= 2: return f"{n}/{name}"
    if n == 3: return f"3/{name[0]}/{name}"
    return f"{name[:2]}/{name[2:4]}/{name}"

def sha256_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1024*1024), b""): h.update(chunk)
    return h.hexdigest()

def read_index(name):
    """读取稀疏索引，返回 list of version dicts。如不存在则用 curl 下载。"""
    rel = index_rel(name)
    p = SPARSE / ".cache" / rel
    if not p.exists() or p.stat().st_size < 5:
        url = f"https://index.crates.io/{rel}"
        p.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(["curl", "-sS", "--max-time", "30", "-o", str(p), url], check=True)
    entries = []
    for line in open(p):
        line = line.strip()
        if not line.startswith("{"): continue
        entries.append(json.loads(line))
    return entries

def download_crate(name, version):
    """下载 .crate 到缓存，返回路径"""
    safe_ver = version.replace("+", "+")  # keep as-is
    fname = f"{name}-{safe_ver}.crate"
    target = CACHE / fname
    if target.exists() and target.stat().st_size > 100:
        return target
    url = f"{CRATES_IO}/{name}/{fname}"
    print(f"  DL crate {name} {version}")
    CACHE.mkdir(parents=True, exist_ok=True)
    subprocess.run(["curl", "-sS", "--max-time", "120", "-o", str(target), url], check=True)
    if target.stat().st_size < 100:
        target.unlink()
        raise RuntimeError(f"failed to download {name} {version}")
    return target

def parse_version(v):
    """将 semver 字符串转为可比较的 tuple，忽略 +build"""
    v = v.split("+")[0]
    parts = v.split(".")
    out = []
    for p in parts:
        m = re.match(r"(\d+)(.*)", p)
        out.append(int(m.group(1)) if m else 0)
        # pre-release 标记为低版本
        rest = m.group(2) if m else ""
        if rest:
            out.append(-1)  # pre-release
    return tuple(out + [0]*(3-len(out)))

def matches_constraint(version, constraint):
    """简单 semver 约束匹配：支持 *, ^, ~, >=, <=, >, <, =，以及多约束用逗号分隔"""
    if constraint.strip() == "*": return True
    constraints = [c.strip() for c in constraint.split(",") if c.strip()]
    for c in constraints:
        if c == "*": continue
        if not _match_one(version, c):
            return False
    return True

def _match_one(version, c):
    v = parse_version(version)
    if c.startswith("^"):
        base = c[1:].strip()
        b = parse_version(base)
        if b[0] > 0: return b <= v < (b[0]+1, 0, 0)
        if b[1] > 0: return b <= v < (0, b[1]+1, 0)
        return b <= v < (0, 0, b[2]+1)
    if c.startswith("~"):
        base = c[1:].strip()
        b = parse_version(base)
        return b <= v < (b[0], b[1]+1, 0)
    if c.startswith(">="):
        return v >= parse_version(c[2:].strip())
    if c.startswith("<="):
        return v <= parse_version(c[2:].strip())
    if c.startswith(">"):
        return v > parse_version(c[1:].strip())
    if c.startswith("<"):
        return v < parse_version(c[1:].strip())
    if c.startswith("="):
        return v == parse_version(c[1:].strip())
    # Cargo 默认：裸版本号视为 ^ 约束
    base = c.strip()
    b = parse_version(base)
    if b[0] > 0: return b <= v < (b[0]+1, 0, 0)
    if b[1] > 0: return b <= v < (0, b[1]+1, 0)
    return b <= v < (0, 0, b[2]+1)

def best_version(entries, constraint):
    """返回最高匹配版本"""
    valid = [e for e in entries if matches_constraint(e["vers"], constraint)]
    if not valid: return None
    valid.sort(key=lambda e: parse_version(e["vers"]))
    return valid[-1]

def parse_toml_section(text, section):
    """从 Cargo.toml 文本提取 [section] 段，返回 {name: req_str, features: {name: set}}"""
    deps = {}
    features = defaultdict(set)
    m = re.search(rf'\[{section}\]\n(.*?)(?=\n\[|\Z)', text, re.DOTALL)
    if not m: return deps, features
    for line in m.group(1).splitlines():
        line = line.strip()
        if not line or line.startswith("#"): continue
        m2 = re.match(r'^([A-Za-z0-9_\-]+)\s*=\s*"([^"]+)"', line)
        if m2:
            deps[m2.group(1)] = m2.group(2)
            continue
        m3 = re.match(r'^([A-Za-z0-9_\-]+)\s*=\s*\{(.*?)\}', line)
        if m3:
            name = m3.group(1)
            body = m3.group(2)
            mv = re.search(r'version\s*=\s*"([^"]+)"', body)
            if mv:
                deps[name] = mv.group(1)
            mf = re.search(r'features\s*=\s*\[(.*?)\]', body)
            if mf:
                for f in re.findall(r'"([^"]+)"', mf.group(1)):
                    features[name].add(f)
    return deps, features

def parse_cargo_toml_for_deps(path):
    """返回 (deps: {name: req}, features: {name: set})"""
    text = open(path).read()
    deps, features = parse_toml_section(text, "dependencies")
    dev_deps, dev_feats = parse_toml_section(text, "dev-dependencies")
    deps.update(dev_deps)
    features.update(dev_feats)
    return deps, features

def get_crate_deps_from_index(entry):
    """从稀疏索引条目提取 dependencies，返回 [(actual_pkg_name, alias_name, req, optional, kind, target)]"""
    out = []
    for d in entry.get("deps", []):
        alias = d["name"]
        pkg = d.get("package", alias)  # 如果有 package 字段，那是真实 crate 名
        out.append((pkg, alias, d["req"], d.get("optional", False), d.get("kind", "normal"), d.get("target")))
    return out

def get_default_features(entry):
    """获取 [features] 中 default 启用的 feature 名"""
    return entry.get("features", {}).get("default", [])

def is_target_active(target):
    """判断 target 是否匹配 macOS aarch64"""
    if not target: return True
    # 简单处理：只解析 cfg(target_os = "...") 形式
    # macOS aarch64
    if "target_os" in target and "windows" in target.lower(): return False
    if "target_os" in target and "linux" in target.lower(): return False
    if "target_os" in target and "wasi" in target.lower(): return False
    if "target_arch" in target and "wasm" in target.lower(): return False
    if "target_env" in target and "gnu" in target.lower(): return False
    if "unix" in target.lower(): return True
    return True  # 默认保留

def expand_features(entry, enabled_features):
    """展开 features：递归解析 feature -> features/deps 的映射，返回 (enabled_feat_set, enabled_dep_set)"""
    features_def = entry.get("features", {})
    # 最终启用的 dep 名集合
    enabled_deps = set()

    def expand_one(feat, seen=None):
        if seen is None: seen = set()
        if feat in seen: return
        seen.add(feat)
        if feat not in features_def:
            # 可能是一个可选依赖的名字（弱激活）
            # 检查 deps 中是否有同名可选 dep（可能是 alias 或 pkg 名）
            for dpkg, dalias, _, dopt, _, _ in get_crate_deps_from_index(entry):
                if dopt and (dalias == feat or dpkg == feat):
                    enabled_deps.add(dpkg)
            return
        for item in features_def[feat]:
            if item.startswith("dep:"):
                # dep:name 格式
                dep_ref = item[4:]
                # 在 deps 中查找 alias 或 pkg 匹配
                for dpkg, dalias, _, dopt, _, _ in get_crate_deps_from_index(entry):
                    if dopt and (dalias == dep_ref or dpkg == dep_ref):
                        enabled_deps.add(dpkg)
                        break
            elif "/" in item:
                # crate/feature 形式：启用对应可选依赖
                dep_ref = item.split("/")[0]
                for dpkg, dalias, _, dopt, _, _ in get_crate_deps_from_index(entry):
                    if dopt and (dalias == dep_ref or dpkg == dep_ref):
                        enabled_deps.add(dpkg)
                        break
            else:
                expand_one(item, seen)

    for feat in list(enabled_features):
        expand_one(feat)
    return enabled_deps

def resolve(root_deps, root_features=None):
    """BFS 解析依赖，返回 {name: (version, entry)}"""
    resolved = {}  # name -> (version, entry)
    # 队列：(name, req, enabled_features)
    extra = root_features or {}
    queue = []
    for name, req in root_deps.items():
        feats = set(extra.get(name, set()))
        if name == "tokio": feats.add("full")
        queue.append((name, req, feats))

    while queue:
        name, req, enabled_feats = queue.pop(0)
        if name in resolved: continue
        entries = read_index(name)
        best = best_version(entries, req)
        if not best:
            print(f"ERROR: no version match for {name} req={req}")
            sys.exit(1)

        # 合并 default features + 显式启用的
        default_feats = set(get_default_features(best))
        all_feats = default_feats | enabled_feats
        enabled_deps = expand_features(best, all_feats)

        resolved[name] = (best["vers"], best)
        crate_deps = get_crate_deps_from_index(best)
        for dpkg, dalias, dep_req, optional, kind, target in crate_deps:
            if kind in ("dev", "build"): continue
            if not is_target_active(target):
                continue
            if not optional:
                queue.append((dpkg, dep_req, set()))
            elif dpkg in enabled_deps or dalias in enabled_deps:
                queue.append((dpkg, dep_req, set()))
            else:
                # 可选但 cargo 仍要求 vendor 中有（用于解析）——也加入，但不带 features
                queue.append((dpkg, dep_req, set()))

    return resolved

def main():
    # Step 1: 解析 Cargo.toml 获取顶层依赖
    print("=== Step 1: 解析顶层依赖 ===")
    root_deps, root_features = parse_cargo_toml_for_deps(PROJECT / "Cargo.toml")
    for n, r in root_deps.items():
        feats = root_features.get(n, set())
        print(f"  {n}: {r}{' features='+str(feats) if feats else ''}")

    # Step 2: 递归解析
    print(f"\n=== Step 2: 递归解析依赖树 ===")
    resolved = resolve(root_deps, dict(root_features))
    print(f"共解析 {len(resolved)} 个 crate")
    for n, (v, _) in sorted(resolved.items()):
        print(f"  {n} {v}")

    # Step 3: 下载所有 .crate
    print(f"\n=== Step 3: 下载 {len(resolved)} 个 .crate ===")
    for n, (v, _) in sorted(resolved.items()):
        download_crate(n, v)

    # Step 4: vendor 全部已解析的版本
    print(f"\n=== Step 4: 生成 vendor/ ===")
    vendor_dir = PROJECT / "vendor"
    if vendor_dir.exists():
        import shutil
        shutil.rmtree(vendor_dir)
    vendor_dir.mkdir()

    ok = 0
    for n, (v, entry) in sorted(resolved.items()):
        cp = CACHE / f"{n}-{v}.crate"
        if not cp.exists():
            print(f"  SKIP missing crate: {n}-{v}")
            continue
        pkg_sha = sha256_file(cp)
        # 解压
        with tarfile.open(cp, "r:gz") as tf:
            tf.extractall(vendor_dir)
        # 生成 checksum
        extracted = vendor_dir / f"{n}-{v}"
        files_checksums = {}
        for f in sorted(extracted.rglob("*")):
            if f.is_file() and f.name != ".cargo-checksum.json":
                rel = str(f.relative_to(extracted))
                files_checksums[rel] = sha256_file(f)
        cs = {"package": pkg_sha, "files": files_checksums}
        (extracted / ".cargo-checksum.json").write_text(json.dumps(cs))
        ok += 1
    print(f"  OK={ok}")

    # Step 5: 生成 Cargo.lock v4
    print(f"\n=== Step 5: 生成 Cargo.lock ===")
    lock_lines = ['# This file is automatically @generated by mini_resolver.', '# It is not intended for manual editing.', 'version = 4', '']
    for n, (v, entry) in sorted(resolved.items()):
        lock_lines.append(f'[[package]]')
        lock_lines.append(f'name = "{n}"')
        lock_lines.append(f'version = "{v}"')
        lock_lines.append(f'source = "sparse+https://index.crates.io/"')
        lock_lines.append(f'checksum = "{entry.get("cksum","")}"')
        # dependencies
        deps = get_crate_deps_from_index(entry)
        resolved_names = set(resolved.keys())
        dep_lines = []
        for dpkg, dalias, dr, dopt, dkind, dtgt in deps:
            if dkind in ("dev", "build"): continue
            if not is_target_active(dtgt): continue
            if dpkg in resolved_names:
                dv = resolved[dpkg][0]
                # 如果 alias != pkg，说明有 renaming
                if dalias != dpkg:
                    dep_lines.append(f'"{dalias} {dv}", package = "{dpkg}"')
                else:
                    dep_lines.append(f'"{dpkg} {dv}"')
        if dep_lines:
            lock_lines.append("dependencies = [")
            for dl in dep_lines:
                lock_lines.append(f"    {dl},")
            lock_lines.append("]")
        lock_lines.append("")

    (PROJECT / "Cargo.lock").write_text("\n".join(lock_lines))
    print(f"  写入 {len(resolved)} 个 crate 到 Cargo.lock")

    # Step 6: .cargo/config.toml
    config = PROJECT / ".cargo" / "config.toml"
    config.parent.mkdir(exist_ok=True)
    config.write_text("""[source.crates-io]
replace-with = "vendored-sources"

[source.vendored-sources]
directory = "vendor"
""")
    print(f"\n=== DONE ===")
    print(f"解析并 vendor 了 {ok} 个 crate")

if __name__ == "__main__":
    main()
