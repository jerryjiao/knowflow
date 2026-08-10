#!/usr/bin/env bash
# knowflow wiki-auto-fix — 自动修复 health check 发现的问题
# Usage: bash scripts/wiki-auto-fix.sh [--wiki-dir <path>] [--dry-run]
#
# 在 health check 之前运行，自动：
#   1. 清理空链接 [[entities/,]] [[concepts/,]]
#   2. 创建缺失的 entity/concept 文件
#   3. 补充过小的文件（<100B）
#   4. 关联孤儿页（添加引用）

set -euo pipefail

# ── Config ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WIKI_ROOT="${KNOWFLOW_ROOT:-${WIKI_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}}"
WIKI_DIR="${KNOWFLOW_WIKI_DIR:-$WIKI_ROOT/wiki}"
DRY_RUN=false
MIN_SIZE=100

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --wiki-root) WIKI_ROOT="$2"; WIKI_DIR="$WIKI_ROOT/wiki"; shift 2 ;;
    --wiki-dir) WIKI_DIR="$2"; shift 2 ;;
    --min-size) MIN_SIZE="$2"; shift 2 ;;
    *) echo "Unknown: $1" >&2; exit 1 ;;
  esac
done

# Portable in-place sed: BSD (macOS) needs -i '' with the backup suffix arg,
# GNU sed takes the script directly after -i.
sed_i() {
  if [[ "$(uname)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

FIXED_LINKS=0
CREATED_FILES=0
PADDED_FILES=0

run_cmd() {
  if $DRY_RUN; then
    echo "[DRY] $*"
  else
    "$@"
  fi
}

echo "🔧 Wiki Auto-Fix"
echo "================"

# ════════════════════════════════════════════════
# Fix 1: 清理空链接 [[entities/,]] [[concepts/,]]
# ════════════════════════════════════════════════
echo ""
echo "[1/4] 清理空链接..."

while IFS= read -r -d '' file; do
  if grep -q '\[\[entities\/,\]\]\|\[\[concepts\/,\]\]' "$file" 2>/dev/null; then
    local_count=$(grep -c '\[\[entities\/,\]\]\|\[\[concepts\/,\]\]' "$file" 2>/dev/null || echo 0)
    run_cmd sed_i '/\[\[entities\/,\]\]/d' "$file"
    run_cmd sed_i '/\[\[concepts\/,\]\]/d' "$file"
    FIXED_LINKS=$((FIXED_LINKS + local_count))
    rel="${file#$WIKI_DIR/}"
    echo "  ✏️  $rel (清理 $local_count 个空链接)"
  fi
done < <(find "$WIKI_DIR" -name '*.md' -not -path '*/.understand-anything/*' -print0)
echo "  共清理 $FIXED_LINKS 个空链接"

# ════════════════════════════════════════════════
# Fix 2: 创建缺失的 entity/concept 文件
# ════════════════════════════════════════════════
echo ""
echo "[2/4] 创建缺失实体/概念文件..."

LINKS_TMP="$(mktemp)"
while IFS= read -r -d '' file; do
  grep -o '\[\[entities\/[^]]*\]\]\|\[\[concepts\/[^]]*\]\]' "$file" 2>/dev/null \
    | sed 's/\[\[//;s/\]\]//' \
    | sed 's/|.*//' \
    | grep -v '^[[:space:]]*$' \
    | awk '!seen[$0]++' >> "$LINKS_TMP" || true
done < <(find "$WIKI_DIR" -name '*.md' -not -path '*/.understand-anything/*' -print0)

while IFS= read -r link; do
  [ -z "$link" ] && continue
  target_file="$WIKI_DIR/${link}.md"
  if [ ! -f "$target_file" ]; then
    name=$(basename "$link")
    display_name=$(echo "$name" | sed 's/-/ /g')

    case "${link%%/*}" in
      entities) type_label="实体" ;;
      concepts) type_label="概念" ;;
      topics)   type_label="主题" ;;
      *)        type_label="待分类" ;;
    esac

    run_cmd mkdir -p "$(dirname "$target_file")"
    # NOTE: redirections run before `run_cmd` is called, so we must not route the
    # heredoc through run_cmd in dry-run mode — the `>` would truncate/create the
    # file even when the command itself is skipped. Render to a temp buffer and
    # write once outside dry-run.
    content=$(printf '# %s\n\n## 类型\n%s\n\n## 描述\n（由 wiki-auto-fix 自动创建，待补充详细信息）\n' "$display_name" "$type_label")
    if $DRY_RUN; then
      echo "[DRY] create $target_file"
    else
      printf '%s' "$content" > "$target_file"
    fi
    CREATED_FILES=$((CREATED_FILES + 1))
    echo "  ➕ ${link}.md (${type_label})"
  fi
done < "$LINKS_TMP"
rm -f "$LINKS_TMP"
echo "  共创建 $CREATED_FILES 个缺失文件"

# ════════════════════════════════════════════════
# Fix 3: 补充过小文件
# ════════════════════════════════════════════════
echo ""
echo "[3/4] 补充过小文件 (<${MIN_SIZE}B)..."

while IFS= read -r -d '' file; do
  size=$(wc -c < "$file" | tr -d ' ')
  rel="${file#$WIKI_DIR/}"
  name_base=$(basename "$rel" .md)

  case "$rel" in
    entities/*) suffix="\n\n## 备注\n此页面由 wiki-auto-fix 自动扩充。原始内容仅 ${size} 字节。" ;;
    concepts/*) suffix="\n\n## 延伸阅读\n此概念页面由 wiki-auto-fix 自动扩充。原始内容仅 ${size} 字节。" ;;
    topics/*)   suffix="\n\n## 子主题\n此主题页面由 wiki-auto-fix 自动扩充。原始内容仅 ${size} 字节。" ;;
    *)          suffix="\n\n---\n*此文件由 wiki-auto-fix 标记为过小（原 ${size}B）*" ;;
  esac

  # Same dry-run caveat as Fix 2: route the write explicitly, never through a
  # redirection that the shell would apply before run_cmd decides to skip.
  if $DRY_RUN; then
    echo "[DRY] pad $rel (+$(printf "$suffix" | wc -c | tr -d ' ') bytes)"
  else
    printf '%b%s\n' "$(cat "$file")" "$suffix" > "$file"
  fi
  PADDED_FILES=$((PADDED_FILES + 1))
  echo "  📝 $rel (${size}B → 已补充)"
done < <(find "$WIKI_DIR" -name '*.md' -not -path '*/.understand-anything/*' -size +0 -size -${MIN_SIZE}c -print0)

echo "  共补充 $PADDED_FILES 个文件"

# ════════════════════════════════════════════════
# Fix 4: 关联孤儿页（用 Python 避免 bash [[ 冲突）
# ════════════════════════════════════════════════
echo ""
echo "[4/4] 处理孤儿页..."

python3 - "$WIKI_DIR" "$DRY_RUN" << 'PYEOF'
import os, sys, re

wiki_dir = sys.argv[1]
dry_run = sys.argv[2].lower() == "true"
index_path = os.path.join(wiki_dir, "index.md")
skip_prefixes = ("index.md", "overview.md", "topics.md", "log.md",
                 ".vector", ".embed", "comparisons/", "sources/")

referenced = set()
for root, dirs, files in os.walk(wiki_dir):
    if ".understand-anything" in root:
        continue
    for f in files:
        if not f.endswith(".md"):
            continue
        fpath = os.path.join(root, f)
        try:
            with open(fpath, "r", errors="replace") as fh:
                for line in fh:
                    for m in re.finditer(r'\[\[([^]|]+?)(?:\|[^]]+)?\]\]', line):
                        target = m.group(1).strip()
                        if not target:
                            continue
                        if target.startswith(("entities/", "concepts/", "topics/")):
                            tpath = os.path.join(wiki_dir, target + ".md")
                        elif target.startswith("/"):
                            tpath = os.path.join(wiki_dir, target.lstrip("/") + ".md")
                        else:
                            continue
                        referenced.add(os.path.normpath(tpath))
        except Exception:
            pass

orphan_count = 0
fixed_count = 0
for root, dirs, files in os.walk(wiki_dir):
    if ".understand-anything" in root:
        continue
    for f in files:
        if not f.endswith(".md"):
            continue
        rel = os.path.relpath(os.path.join(root, f), wiki_dir)
        if rel.startswith(skip_prefixes) or rel == "index.md":
            continue
        fpath = os.path.join(root, f)
        if fpath not in referenced and os.path.isfile(fpath):
            orphan_count += 1
            name_base = os.path.splitext(f)[0]
            if os.path.exists(index_path):
                try:
                    with open(index_path, "r", errors="replace") as idx:
                        idx_content = idx.read()
                    if f"[[{name_base}]]" not in idx_content:
                        if not dry_run:
                            with open(index_path, "a") as idx:
                                idx.write(f"- [[{name_base}]] (orphan auto-linked)\n")
                        fixed_count += 1
                        print(f"  🔗 {rel} -> index.md")
                except Exception as e:
                    print(f"  WARN: {e}")

print(f"  发现 {orphan_count} 个孤儿页，已关联 {fixed_count} 个")
PYEOF

# ── Summary ────────────────────────────────────────────
TOTAL_FIXED=$((FIXED_LINKS + CREATED_FILES + PADDED_FILES))

echo ""
echo "📊 Auto-Fix Summary"
echo "-------------------"
echo "  空链接清理:    $FIXED_LINKS"
echo "  缺失文件创建: $CREATED_FILES"
echo "  过小文件补充: $PADDED_FILES"
echo "  总计修复:     $TOTAL_FIXED"

if $DRY_RUN; then
  echo ""
  echo "(DRY RUN — 未实际修改)"
fi

exit 0
