#!/bin/bash
# 下载所有缺失的 crate 版本并重新 vendor
set -u

CRATES_IO="https://static.crates.io/crates"
CACHE="$HOME/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f"
PROJECT="/Users/paul/WorkSpace/TestSoloCoder/97629273-6de4-4dc7-bd78-338f3232e65a"

download() {
    local name="$1"
    local version="$2"
    local fname="${name}-${version}.crate"
    local target="$CACHE/$fname"
    if [ -f "$target" ] && [ "$(wc -c < "$target")" -gt 100 ]; then
        return 0
    fi
    echo "  DL $name $version"
    curl -sS --max-time 60 -o "$target" "$CRATES_IO/$name/$fname"
    local sz=$(wc -c < "$target" 2>/dev/null || echo 0)
    if [ "$sz" -lt 100 ]; then
        echo "  FAIL $name $version ($sz)"
        rm -f "$target"
        return 1
    fi
}

# clap 2.x 需要的老版本
download strsim 0.8.0
download strsim 0.9.3
download ansi_term 0.12.1
download atty 0.2.14
download term_size 0.3.2
download vec_map 0.8.2
download yaml-rust 0.4.5
download bitflags 1.3.2
# 可能还需要的老版本 common deps
download unicode-width 0.1.14
download textwrap 0.11.0
# syn 1.x 完整依赖链（structopt-derive 用 syn 1.x）
download proc-macro2 1.0.106
download quote 1.0.45
download unicode-ident 1.0.24
# 再下载一批常见的老版本
download log 0.4.32
download cfg-if 1.0.4
download memchr 2.8.2
download itoa 1.0.18
download ryu 1.0.19
download serde 1.0.228
download serde_json 1.0.150
# 常见
download once_cell 1.21.4
download hashbrown 0.14.5
download hashbrown 0.15.2

echo "=== cached count: $(ls "$CACHE"/*.crate | wc -l) ==="

# 重新 vendor
cd "$PROJECT"
rm -rf vendor .cargo
python3 vendor_all.py 2>&1 | tail -n 3
