#!/bin/bash
# 重新下载所有 430+ 缓存 crate 的 sparse index 条目
# 使用正确的嵌套 URL 并强制覆盖
set -u

SPARSE_INDEX="$HOME/.cargo/registry/index/index.crates.io-1949cf8c6b5b557f"
CACHE_DIR="$HOME/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f"

index_rel() {
    local name="$1"
    local len=${#name}
    if (( len <= 2 )); then echo "$len/$name"
    elif (( len == 3 )); then echo "3/${name:0:1}/$name"
    else echo "${name:0:2}/${name:2:2}/$name"
    fi
}

parse_name_version() {
    # fname like "proc-macro-error-1.0.4.crate" → name=proc-macro-error, version=1.0.4
    local fname="$1"
    # remove .crate suffix
    local stem="${fname%.crate}"
    # find the last "-" followed by a digit
    local name=""
    local version=""
    # use sed: split at last '-' before a digit
    version=$(echo "$stem" | sed -E 's/.*-([0-9][^-]*)$/\1/')
    name="${stem%-$version}"
    echo "$name"
}

total=$(ls "$CACHE_DIR"/*.crate 2>/dev/null | wc -l | tr -d ' ')
count=0
bad=0
for crate in "$CACHE_DIR"/*.crate; do
    fname=$(basename "$crate")
    name=$(parse_name_version "$fname")
    rel=$(index_rel "$name")
    target="$SPARSE_INDEX/.cache/$rel"
    root_target="$SPARSE_INDEX/$rel"
    mkdir -p "$(dirname "$target")" "$(dirname "$root_target")"
    # download to both locations
    curl -sS --max-time 20 -o "$target" "https://index.crates.io/$rel"
    cp "$target" "$root_target"
    # validate: first non-space char should be '{'
    first=$(head -c 1 "$target")
    if [ "$first" != "{" ]; then
        echo "  BAD: $name ($rel) -> first char='$first' size=$(wc -c < "$target")"
        bad=$((bad + 1))
    fi
    count=$((count + 1))
    if (( count % 30 == 0 )); then
        echo "  [$count/$total]  OK=$((count-bad))  BAD=$bad"
    fi
done
echo "Done: $total crates, $bad bad downloads"
# cleanup empty / broken files
find "$SPARSE_INDEX/.cache" -type f ! -name '*.json' -empty -delete
find "$SPARSE_INDEX" -maxdepth 3 -type f ! -name '*.json' ! -name 'config.json' -empty -delete
echo "Non-empty .cache entries: $(find "$SPARSE_INDEX/.cache" -type f | wc -l)"
echo "Non-empty root entries: $(find "$SPARSE_INDEX" -maxdepth 3 -type f ! -name 'config.json' | wc -l)"
