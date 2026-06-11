#!/usr/bin/env bash
# gdalinfo 对比脚本 - 验证 sentinel-cli inspect tile 与 gdalinfo 输出一致性
# Usage: ./compare_gdalinfo.sh <tiff_file> [output_dir]

set -euo pipefail

TIFF_FILE="${1:-}"
OUTPUT_DIR="${2:-/tmp/sentinel_compare}"

if [[ -z "$TIFF_FILE" ]]; then
  echo "Usage: $0 <tiff_file> [output_dir]"
  echo "  Compares sentinel-cli inspect tile output against gdalinfo"
  exit 1
fi

if [[ ! -f "$TIFF_FILE" ]]; then
  echo "Error: File not found: $TIFF_FILE"
  exit 1
fi

mkdir -p "$OUTPUT_DIR"

BASENAME=$(basename "$TIFF_FILE")
GDALINFO_OUT="$OUTPUT_DIR/${BASENAME}.gdalinfo.txt"
SENTINEL_OUT="$OUTPUT_DIR/${BASENAME}.sentinel.json"
SUMMARY_OUT="$OUTPUT_DIR/${BASENAME}.summary.txt"

echo "========================================"
echo "GeoTIFF Metadata Comparison"
echo "File: $TIFF_FILE"
echo "Output: $OUTPUT_DIR"
echo "========================================"
echo ""

# Check gdalinfo
if ! command -v gdalinfo &> /dev/null; then
  echo "[WARN] gdalinfo not found in PATH, skipping GDAL comparison"
  GDAL_AVAILABLE=0
else
  GDAL_AVAILABLE=1
fi

# Check sentinel CLI
SENTINEL_CLI="${SENTINEL_CLI:-}"
if [[ -z "$SENTINEL_CLI" ]]; then
  PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  SENTINEL_CLI="$PROJECT_ROOT/sentinel"
  if [[ ! -x "$SENTINEL_CLI" ]]; then
    SENTINEL_CLI="$(command -v sentinel 2>/dev/null || echo "")"
  fi
fi

if [[ -z "$SENTINEL_CLI" || ! -x "$SENTINEL_CLI" ]]; then
  echo "[ERROR] sentinel CLI not found. Build it first or set SENTINEL_CLI=/path/to/sentinel"
  exit 1
fi

echo "[1/3] Running gdalinfo..."
if [[ $GDAL_AVAILABLE -eq 1 ]]; then
  gdalinfo -json "$TIFF_FILE" > "$GDALINFO_OUT" 2>/dev/null || \
    gdalinfo "$TIFF_FILE" > "$GDALINFO_OUT" 2>/dev/null || {
    echo "[WARN] gdalinfo failed, continuing without GDAL data"
    GDAL_AVAILABLE=0
  }
  echo "  -> $GDALINFO_OUT"
else
  echo "  -> skipped (gdalinfo not available)"
fi

echo ""
echo "[2/3] Running sentinel inspect tile..."
if "$SENTINEL_CLI" inspect tile --input "$TIFF_FILE" --output "$SENTINEL_OUT" --format json --show-bands 2>/dev/null; then
  echo "  -> $SENTINEL_OUT"
  SENTINEL_OK=1
else
  echo "[ERROR] sentinel inspect tile failed"
  "$SENTINEL_CLI" inspect tile --input "$TIFF_FILE" --output "$SENTINEL_OUT" --format json --show-bands
  exit 1
fi

echo ""
echo "[3/3] Extracting and comparing key fields..."

# Extract values from sentinel output using python if available, else grep
extract_json() {
  local file="$1"
  local field="$2"
  if command -v python3 &> /dev/null; then
    python3 -c "
import json, sys
try:
    with open('$file') as f:
        data = json.load(f)
    keys = '$field'.split('.')
    val = data
    for k in keys:
        if isinstance(val, list):
            val = val[int(k)]
        else:
            val = val[k]
    if isinstance(val, float):
        print(f'{val:.6f}')
    else:
        print(val)
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
    sys.exit(1)
" 2>/dev/null
  fi
}

S_WIDTH=$(extract_json "$SENTINEL_OUT" "width" || echo "")
S_HEIGHT=$(extract_json "$SENTINEL_OUT" "height" || echo "")
S_EPSG=$(extract_json "$SENTINEL_OUT" "epsg_code" || echo "")
S_NUMBANDS=$(extract_json "$SENTINEL_OUT" "num_bands" || echo "")
S_DATATYPE=$(extract_json "$SENTINEL_OUT" "data_type" || echo "")
S_PROJ=$(extract_json "$SENTINEL_OUT" "projection" || echo "")
S_RESX=$(extract_json "$SENTINEL_OUT" "resolution_x" || echo "")
S_RESY=$(extract_json "$SENTINEL_OUT" "resolution_y" || echo "")
S_GT_ORIGINX=$(extract_json "$SENTINEL_OUT" "geo_transform.OriginX" || echo "")
S_GT_ORIGINY=$(extract_json "$SENTINEL_OUT" "geo_transform.OriginY" || echo "")

{
echo "========================================"
echo "Summary for: $TIFF_FILE"
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "========================================"
echo ""
echo "--- Key Metadata ---"
echo "Field                  sentinel-cli         gdalinfo             Match"
echo "---------------------  -------------------  -------------------  -----"

compare_field() {
  local name="$1"
  local s_val="$2"
  local g_val="$3"
  local match="?"
  if [[ -n "$s_val" && -n "$g_val" ]]; then
    if [[ "$s_val" == "$g_val" ]]; then
      match="YES"
    else
      # numeric comparison with tolerance
      if [[ "$s_val" =~ ^-?[0-9]*\.?[0-9]+$ && "$g_val" =~ ^-?[0-9]*\.?[0-9]+$ ]]; then
        local diff
        diff=$(awk -v a="$s_val" -v b="$g_val" 'BEGIN { d = a - b; if (d < 0) d = -d; print d < 0.001 ? "1" : "0" }')
        if [[ "$diff" == "1" ]]; then
          match="YES*"
        else
          match="NO"
        fi
      else
        match="NO"
      fi
    fi
  fi
  printf "%-21s  %-19s  %-19s  %s\n" "$name" "$s_val" "$g_val" "$match"
}

# gdalinfo extraction (if available)
G_WIDTH=""
G_HEIGHT=""
G_EPSG=""
G_NUMBANDS=""
G_DATATYPE=""
G_PROJ=""
G_RESX=""
G_RESY=""

if [[ $GDAL_AVAILABLE -eq 1 && -f "$GDALINFO_OUT" ]]; then
  if command -v python3 &> /dev/null; then
    G_WIDTH=$(python3 -c "
import json, sys, re
try:
    with open('$GDALINFO_OUT') as f:
        txt = f.read()
    m = re.search(r'Size is (\d+),\s*(\d+)', txt)
    if m: print(m.group(1))
except: pass
" 2>/dev/null || echo "")
    G_HEIGHT=$(python3 -c "
import json, sys, re
try:
    with open('$GDALINFO_OUT') as f:
        txt = f.read()
    m = re.search(r'Size is (\d+),\s*(\d+)', txt)
    if m: print(m.group(2))
except: pass
" 2>/dev/null || echo "")
    G_NUMBANDS=$(python3 -c "
import re
try:
    with open('$GDALINFO_OUT') as f:
        txt = f.read()
    bands = re.findall(r'Band \d+', txt)
    print(len(bands))
except: pass
" 2>/dev/null || echo "")
  fi
fi

compare_field "Width (px)" "$S_WIDTH" "$G_WIDTH"
compare_field "Height (px)" "$S_HEIGHT" "$G_HEIGHT"
compare_field "Band Count" "$S_NUMBANDS" "$G_NUMBANDS"
compare_field "EPSG Code" "$S_EPSG" ""
compare_field "Data Type" "$S_DATATYPE" ""
compare_field "Projection" "$S_PROJ" ""
compare_field "Resolution X" "$S_RESX" ""
compare_field "Resolution Y" "$S_RESY" ""
compare_field "Origin X" "$S_GT_ORIGINX" ""
compare_field "Origin Y" "$S_GT_ORIGINY" ""

echo ""
echo "--- Output Files ---"
echo "sentinel-cli: $SENTINEL_OUT"
if [[ $GDAL_AVAILABLE -eq 1 ]]; then
  echo "gdalinfo:     $GDALINFO_OUT"
fi
echo "summary:      $SUMMARY_OUT"
echo ""
echo "========================================"
echo "Validation Complete"
echo "========================================"

} | tee "$SUMMARY_OUT"

echo ""
echo "Full summary written to: $SUMMARY_OUT"
