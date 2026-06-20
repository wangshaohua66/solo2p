#!/bin/bash
# 为所有已缓存的 crates 补全 sparse registry index 条目
set -u

SPARSE_INDEX="$HOME/.cargo/registry/index/index.crates.io-1949cf8c6b5b557f"
CACHE_DIR="$HOME/.cargo/registry/cache/index.crates.io-1949cf8c6b5b557f"

mkdir -p "$SPARSE_INDEX"

index_rel() {
    local name="$1"
    local len=${#name}
    if (( len <= 2 )); then
        echo "$len/$name"
    elif (( len == 3 )); then
        echo "3/${name:0:1}/$name"
    else
        echo "${name:0:2}/${name:2:2}/$name"
    fi
}

total=$(ls "$CACHE_DIR"/*.crate 2>/dev/null | wc -l)
count=0
for crate in "$CACHE_DIR"/*.crate; do
    fname=$(basename "$crate" .crate)
    # 拆分为 name-version：从最后一个 '-' 处切分（版本号第一个字符一定是数字）
    name="${fname%-*}"
    version="${fname##*-}"
    # 若最后一段不是以数字开头，则再往前切
    if ! [[ "$version" =~ ^[0-9] ]]; then
        name="${name%-*}"
        rest="${fname#"$name"-}"
        version="$rest"
    fi
    rel=$(index_rel "$name")
    target="$SPARSE_INDEX/$rel"
    if [ -f "$target" ] && [ -s "$target" ]; then
        # 已有且非空，跳过
        count=$((count + 1))
        continue
    fi
    mkdir -p "$(dirname "$target")"
    curl -sS --max-time 20 -o "$target" "https://index.crates.io/$rel"
    count=$((count + 1))
    if (( count % 25 == 0 )); then
        echo "  $count/$total  $name $version"
    fi
done
echo "Done: $count crates processed"
find "$SPARSE_INDEX" -type f -empty -delete
echo "Non-empty index entries: $(find "$SPARSE_INDEX" -type f | wc -l)"
