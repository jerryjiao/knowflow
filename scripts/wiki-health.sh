#!/opt/homebrew/bin/bash
# knowflow health check — broken links, empty files, orphan pages
# Usage: bash scripts/wiki-health.sh [--wiki-root <path>] [--json]
#
# M2 改进:
#   - 添加 --json 选项输出结构化 JSON（方便 CLI 解析）
#   - 输出结构化格式，每行前缀统一
#   - 保持向后兼容（默认人类可读模式不变）
#
# Checks:
#   1. Broken links  — [[wikilinks]] and [md](path.md) that point to missing files
#   2. Empty files   — .md files < 100 bytes
#   3. Orphan pages  — .md files never referenced by any other page

set -euo pipefail

# ── Config ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WIKI_ROOT="${WIKI_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
MIN_SIZE=100
OUTPUT_FORMAT="text"  # text | json

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    --wiki-root) WIKI_ROOT="$2"; shift 2 ;;
    --json) OUTPUT_FORMAT="json"; shift ;;
    --min-size) MIN_SIZE="$2"; shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

WIKI_DIR="$WIKI_ROOT/wiki"

if [ ! -d "$WIKI_DIR" ]; then
  if [ "$OUTPUT_FORMAT" = "json" ]; then
    echo "{\"status\":\"error\",\"message\":\"Wiki directory not found: $WIKI_DIR\"}"
  else
    echo "Error: wiki directory not found at $WIKI_DIR" >&2
  fi
  exit 1
fi

# ── Counters ────────────────────────────────────────────
BROKEN_COUNT=0
EMPTY_COUNT=0
ORPHAN_COUNT=0

# JSON output accumulators (used only when --json)
JSON_BROKEN=""
JSON_EMPTY=""
JSON_ORPHAN=""

# ── Helper: resolve a wikilink to an absolute path ──
resolve_link() {
  local mode="$1"
  local basedir="$2"
  local target="$3"
  local abs_path

  if [[ "$target" == /* ]]; then
    abs_path="$WIKI_DIR${target}"
  elif [ "$mode" = "wiki" ]; then
    abs_path="$WIKI_DIR/$target"
  else
    abs_path="$WIKI_DIR/$basedir/$target"
  fi

  local dir_part="$(dirname "$abs_path")"
  local base_part="$(basename "$abs_path")"
  local norm_dir
  norm_dir="$(cd "$dir_part" 2>/dev/null && pwd)" 2>/dev/null || {
    return 1
  }
  echo "${norm_dir}/${base_part}"
}

# ── Helper: extract [[wikilinks]] (macOS grep compatible) ──
extract_wikilinks() {
  sed -n 's/\]\[/] [/g; s/.*\[\[\([^]]*\)\].*/\1/gp' "$1" 2>/dev/null \
    | sed 's/|.*//' \
    | grep -v '^[[:space:]]*$' \
    | awk '!seen[$0]++' || true
}

# ── Helper: extract [text](path.md) markdown links ──
extract_mdlinks() {
  sed -n 's/.*\] *\(([^)]*)\).*/\1/gp' "$1" 2>/dev/null \
    | sed 's/^(//;s/)$//' \
    | grep '\.md' \
    | awk '!seen[$0]++' || true
}

# ── Check 1: Broken Links ──────────────────────────────
check_broken_links() {
  local found=0
  local json_items=""

  while IFS= read -r -d '' file; do
    local relpath="${file#$WIKI_DIR/}"
    local basedir
    basedir="$(dirname "$relpath")"

    # Check [[wikilinks]]
    while IFS= read -r link; do
      [ -z "$link" ] && continue
      local target="${link%.md}.md"
      local resolved
      resolved="$(resolve_link wiki "$basedir" "$target")" || true

      if [ -z "$resolved" ] || [ ! -f "$resolved" ]; then
        if [ "$OUTPUT_FORMAT" = "json" ]; then
          json_items="${json_items:+$json_items, }{\"file\":\"$relpath\",\"link\":\"$link\",\"type\":\"wikilink\"}"
        else
          echo "  ✗ $relpath → [[$link]] (not found)"
        fi
        BROKEN_COUNT=$((BROKEN_COUNT + 1))
        found=1
      fi
    done < <(extract_wikilinks "$file")

    # Check [text](path.md) markdown links
    while IFS= read -r link; do
      [ -z "$link" ] && continue
      case "$link" in http:*|https:*|mailto:*) continue ;; esac
      local target="${link%.md}.md"
      local resolved
      resolved="$(resolve_link md "$basedir" "$target")" || true

      if [ -z "$resolved" ] || [ ! -f "$resolved" ]; then
        if [ "$OUTPUT_FORMAT" = "json" ]; then
          json_items="${json_items:+$json_items, }{\"file\":\"$relpath\",\"link\":\"$link\",\"type:\"markdown\"}"
        else
          echo "  ✗ $relpath → $link (not found)"
        fi
        BROKEN_COUNT=$((BROKEN_COUNT + 1))
        found=1
      fi
    done < <(extract_mdlinks "$file")

  done < <(find "$WIKI_DIR" -name '*.md' -not -path '*/.understand-anything/*' -print0 2>/dev/null)

  if [ "$found" -eq 0 ]; then
    if [ "$OUTPUT_FORMAT" != "json" ]; then
      echo "  ✓ All links resolve correctly"
    fi
  fi

  JSON_BROKEN="$json_items"
}

# ── Check 2: Empty Files ───────────────────────────────
check_empty_files() {
  local found=0
  local json_items=""

  while IFS= read -r -d '' file; do
    local relpath="${file#$WIKI_DIR/}"
    local size
    size="$(wc -c < "$file" | tr -d ' ')"

    if [ "$OUTPUT_FORMAT" = "json" ]; then
      json_items="${json_items:+$json_items, }{\"file\":\"$relpath\",\"size\":$size}"
    else
      echo "  ✗ $relpath ($size bytes)"
    fi
    EMPTY_COUNT=$((EMPTY_COUNT + 1))
    found=1
  done < <(find "$WIKI_DIR" -name '*.md' -not -path '*/.understand-anything/*' -size -${MIN_SIZE}c -print0 2>/dev/null)

  if [ "$found" -eq 0 ]; then
    if [ "$OUTPUT_FORMAT" != "json" ]; then
      echo "  ✓ No empty files found"
    fi
  fi

  JSON_EMPTY="$json_items"
}

# ── Check 3: Orphan Pages ──────────────────────────────
check_orphan_pages() {
  local found=0
  local json_items=""

  local ref_file
  ref_file="$(mktemp)"

  while IFS= read -r -d '' file; do
    local relpath="${file#$WIKI_DIR/}"
    local basedir
    basedir="$(dirname "$relpath")"

    while IFS= read -r link; do
      [ -z "$link" ] && continue
      local target="${link%.md}.md"
      local resolved
      resolved="$(resolve_link wiki "$basedir" "$target")" || continue
      echo "${resolved#$WIKI_DIR/}" >> "$ref_file"
    done < <(extract_wikilinks "$file")

    while IFS= read -r link; do
      [ -z "$link" ] && continue
      case "$link" in http:*|https:*|mailto:*) continue ;; esac
      local target="${link%.md}.md"
      local resolved
      resolved="$(resolve_link md "$basedir" "$target")" || continue
      echo "${resolved#$WIKI_DIR/}" >> "$ref_file"
    done < <(extract_mdlinks "$file")

  done < <(find "$WIKI_DIR" -name '*.md' -not -path '*/.understand-anything/*' -print0 2>/dev/null)

  while IFS= read -r -d '' file; do
    local relpath="${file#$WIKI_DIR/}"
    if [ "$relpath" = "index.md" ]; then
      continue
    fi
    if ! grep -qxF "$relpath" "$ref_file" 2>/dev/null; then
      if [ "$OUTPUT_FORMAT" = "json" ]; then
        json_items="${json_items:+$json_items, }{\"file\":\"$relpath\"}"
      else
        echo "  ✗ $relpath"
      fi
      ORPHAN_COUNT=$((ORPHAN_COUNT + 1))
      found=1
    fi
  done < <(find "$WIKI_DIR" -name '*.md' -not -path '*/.understand-anything/*' -print0 2>/dev/null)

  rm -f "$ref_file"

  if [ "$found" -eq 0 ]; then
    if [ "$OUTPUT_FORMAT" != "json" ]; then
      echo "  ✓ All pages are referenced"
    fi
  fi

  JSON_ORPHAN="$json_items"
}

# ── Main ────────────────────────────────────────────────
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S')"
TOTAL=$((BROKEN_COUNT + EMPTY_COUNT + ORPHAN_COUNT))

if [ "$OUTPUT_FORMAT" = "json" ]; then
  # ── JSON mode: run checks silently, output structured JSON ──
  check_broken_links || { BROKEN_COUNT=0; }
  check_empty_files || { EMPTY_COUNT=0; }
  check_orphan_pages || { ORPHAN_COUNT=0; }

  TOTAL=$((BROKEN_COUNT + EMPTY_COUNT + ORPHAN_COUNT))

  cat << EOF
{
  "status": "$([ $TOTAL -eq 0 ] && echo "ok" || echo "issues_found")",
  "timestamp": "$TIMESTAMP",
  "wiki_root": "$WIKI_DIR",
  "summary": {
    "broken_links": $BROKEN_COUNT,
    "empty_files": $EMPTY_COUNT,
    "orphan_pages": $ORPHAN_COUNT,
    "total_issues": $TOTAL,
    "min_size_bytes": $MIN_SIZE
  },
  "details": {
    "broken_links": [$JSON_BROKEN],
    "empty_files": [$JSON_EMPTY],
    "orphan_pages": [$JSON_ORPHAN]
  }
}
EOF

  [ $TOTAL -eq 0 ] && exit 0 || exit 1

else
  # ── Text mode (default, backward compatible) ──
  echo "🏥 Jerry's LLM Wiki — Health Check"
  echo "====================================="
  echo "Wiki root: $WIKI_DIR"
  echo "Time: $TIMESTAMP"
  echo ""

  echo "## 🔗 Broken Links"
  echo ""
  check_broken_links || { echo "  ⚠️ Broken links check interrupted"; BROKEN_COUNT=0; }
  echo ""

  echo "## 📄 Empty Files (< ${MIN_SIZE} bytes)"
  echo ""
  check_empty_files || { echo "  ⚠️ Empty files check interrupted"; EMPTY_COUNT=0; }
  echo ""

  echo "## 🏝️ Orphan Pages (never referenced)"
  echo ""
  check_orphan_pages || { echo "  ⚠️ Orphan pages check interrupted"; ORPHAN_COUNT=0; }
  echo ""

  TOTAL=$((BROKEN_COUNT + EMPTY_COUNT + ORPHAN_COUNT))

  echo "## 📊 Summary"
  echo ""
  echo "  Broken links:  $BROKEN_COUNT"
  echo "  Empty files:   $EMPTY_COUNT"
  echo "  Orphan pages:  $ORPHAN_COUNT"
  echo "  Total issues:  $TOTAL"
  echo ""

  if [ "$TOTAL" -eq 0 ]; then
    echo "✅ All checks passed"
    exit 0
  else
    echo "❌ $TOTAL issue(s) found"
    exit 1
  fi
fi
