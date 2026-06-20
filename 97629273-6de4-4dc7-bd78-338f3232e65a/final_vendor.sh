#!/bin/bash
# 终极 vendor 方案：把缓存中所有 .crate 全部解压，包括所有版本
set -u
CRATES_IO="https://static.crates.io/crates"
CACHE="$HOME/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f"
PROJECT="/Users/paul/WorkSpace/TestSoloCoder/97629273-6de4-4dc7-bd78-338f3232e65a"

# 下载明确已知缺失的、版本匹配的 crate
download() {
    local name="$1" version="$2"
    local target="$CACHE/${name}-${version}.crate"
    if [ -f "$target" ] && [ "$(wc -c < "$target")" -gt 100 ]; then
        return 0
    fi
    echo "  DL $name $version"
    curl -sS --max-time 120 -o "$target" "$CRATES_IO/$name/${name}-${version}.crate"
    local sz=$(wc -c < "$target" 2>/dev/null || echo 0)
    if [ "$sz" -lt 100 ]; then rm -f "$target"; echo "  FAIL $name $version"; fi
}

# env_logger 0.11.10 的可选依赖
download anstream 1.0.0
download anstyle 1.0.14
download jiff 0.2.28

# tempfile 3.27.0 相关（可能有 linux/wasm 依赖但目标过滤了，先不管）

# strsim 老版本（clap 2.x）
download strsim 0.8.0

# hermit-abi 老版本（atty 0.2.x）
download hermit-abi 0.1.20

echo "=== 缓存中 .crate 数量: $(ls "$CACHE"/*.crate | wc -l) ==="

# 现在把所有缓存的 .crate 全部 vendor
cd "$PROJECT"
rm -rf vendor .cargo
python3 vendor_all.py 2>&1 | tail -n 3
