#!/bin/bash
# 下载缺失的 crates 并加入 vendor
set -u

CRATES_IO="https://static.crates.io/crates"
CACHE="$HOME/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f"
PROJECT="/Users/paul/WorkSpace/TestSoloCoder/97629273-6de4-4dc7-bd78-338f3232e65a"

download_one() {
    local name="$1"
    local version="$2"
    # 处理 + 号：crate 文件名中的 + 需要转义吗？不，保留即可
    local fname="${name}-${version}.crate"
    local target="$CACHE/$fname"
    if [ -f "$target" ] && [ "$(wc -c < "$target")" -gt 100 ]; then
        return 0
    fi
    echo "  downloading $name $version ..."
    curl -sS --max-time 120 -o "$target" "$CRATES_IO/$name/$fname"
    local sz=$(wc -c < "$target" 2>/dev/null || echo 0)
    if [ "$sz" -lt 100 ]; then
        echo "  FAILED $name $version (size=$sz)"
        rm -f "$target"
        return 1
    fi
    echo "  OK $name $version ($sz bytes)"
}

# 从之前的缺失列表 + 可能需要的常见包
downloads=(
"anstyle-wincon:3.0.11"
"foldhash:0.1.5"
"hashbrown:0.15.5"
"id-arena:2.3.0"
"jiff-static:0.2.28"
"leb128fmt:0.1.0"
"once_cell_polyfill:1.70.2"
"portable-atomic-util:0.2.7"
"prettyplease:0.2.37"
"r-efi:6.0.0"
"redox_syscall:0.5.18"
"unicode-xid:0.2.6"
"wasi:0.11.1+wasi-snapshot-preview1"
"wasip2:1.0.3+wasi-0.2.9"
"wasip3:0.4.0+wasi-0.3.0-rc-2026-01-06"
"wasm-encoder:0.244.0"
"wasm-metadata:0.244.0"
"wasmparser:0.244.0"
"wit-bindgen:0.51.0"
"wit-bindgen:0.57.1"
"wit-bindgen-core:0.51.0"
"wit-bindgen-rust:0.51.0"
"wit-bindgen-rust-macro:0.51.0"
"wit-component:0.244.0"
"wit-parser:0.244.0"
"anstream:1.0.0"
"anstyle:1.0.14"
"anstyle-parse:1.0.0"
"anstyle-query:1.1.5"
"colorchoice:1.0.5"
"is_terminal:0.4.12"
"is_terminal_polyfill:1.70.2"
"utf8parse:0.2.2"
"hermit-abi:0.4.0"
)

for pair in "${downloads[@]}"; do
    name="${pair%:*}"
    version="${pair#*:}"
    download_one "$name" "$version"
done

echo "=== done ==="
echo "cached: $(ls "$CACHE"/*.crate | wc -l)"

# 现在重新 vendor
cd "$PROJECT"
rm -rf vendor .cargo
python3 vendor_all.py 2>&1 | tail -n 5
