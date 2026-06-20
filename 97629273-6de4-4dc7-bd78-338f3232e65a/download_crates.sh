#!/bin/bash
set -e

# 手动下载缺失的 crates 到 cargo 缓存与 sparse registry index
# 仅使用 curl（已验证可访问 index.crates.io 与 static.crates.io）

SPARSE_INDEX="$HOME/.cargo/registry/index/index.crates.io-1949cf8c6b5b557f"
CACHE_DIR="$HOME/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f"
mkdir -p "$SPARSE_INDEX" "$CACHE_DIR"

# sparse index 路径规则
index_path() {
    local name="$1"
    local len=${#name}
    if (( len <= 2 )); then
        echo "$SPARSE_INDEX/$len/$name"
    elif (( len == 3 )); then
        echo "$SPARSE_INDEX/3/${name:0:1}/$name"
    else
        echo "$SPARSE_INDEX/${name:0:2}/${name:2:2}/$name"
    fi
}

download_crate() {
    local name="$1"
    local version="$2"
    local ipath
    ipath=$(index_path "$name")
    local idir
    idir=$(dirname "$ipath")
    mkdir -p "$idir"
    # download index entry (JSONL)
    local safe_name
    safe_name=$(echo "$name" | tr '+' '-')
    curl -sS --max-time 30 -o "$ipath" "https://index.crates.io/$safe_name" 2>/dev/null || \
    curl -sS --max-time 30 -o "$ipath" "https://index.crates.io/${name:0:2}/${name:2:2}/$name"
    # download .crate file
    local crate_file="$CACHE_DIR/${name}-${version}.crate"
    if [ ! -f "$crate_file" ]; then
        curl -sS --max-time 60 -o "$crate_file" "https://static.crates.io/crates/$name/${name}-${version}.crate"
        echo "  downloaded $name-$version"
    else
        echo "  cached $name-$version"
    fi
}

echo "Downloading registry entries and crate files..."

# === structopt 0.3.x 完整依赖链（对照 Cargo.toml 0.3.26） ===
# structopt 0.3.26 -> clap ^3.0, structopt-derive 0.4.18, lazy_static 1.4
download_crate structopt 0.3.26
download_crate structopt-derive 0.4.18
download_crate lazy_static 1.5.0

# clap 3.x 依赖
download_crate clap 3.2.25
download_crate clap_derive 3.2.25
download_crate clap_lex 0.2.4
download_crate atty 0.2.14
download_crate bitflags 1.3.2
download_crate strsim 0.10.0
download_crate textwrap 0.16.1
download_crate terminal_size 0.3.0
download_crate os_str_bytes 6.6.1
download_crate indexmap 1.9.3
download_crate hashbrown 0.12.3
download_crate autocfg 1.5.1

# clap_derive 3.x 依赖 (syn/quote/proc-macro2/heck 已缓存)
download_crate proc-macro-error 1.0.4
download_crate proc-macro-error-attr 1.0.4
download_crate version_check 0.9.5

# === indicatif 0.17 完整依赖链 ===
download_crate indicatif 0.17.8
download_crate console 0.15.8
download_crate number_prefix 0.4.0
download_crate portable-atomic 1.9.0
download_crate unicode-width 0.1.14
download_crate libc 0.2.186

# console 额外依赖
download_crate encode_unicode 0.3.6
download_crate once_cell 1.21.4

# === quick-xml 0.31.x 完整依赖链 ===
download_crate quick-xml 0.31.0
download_crate encoding_rs 0.8.34
download_crate memchr 2.8.1
download_crate serde 1.0.228

# encoding_rs -> cfg-if
download_crate cfg-if 1.0.4

echo "All downloads complete."
ls -la "$CACHE_DIR/" | wc -l
echo "entries in index:"
find "$SPARSE_INDEX" -type f | wc -l
