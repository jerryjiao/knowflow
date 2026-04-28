#!/bin/bash
# jerry-wiki wechat article sync
# Searches for WeChat articles via Brave Search and ingests them
# Usage: bash scripts/wechat_sync.sh [--dry-run]
#
# Config: scripts/.wechat-accounts.json (search queries + accounts)
set -euo pipefail

WIKI_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RAW_DIR="$WIKI_ROOT/raw/wechat"
STATE_FILE="$WIKI_ROOT/.wechat-state.json"
TIMESTAMP=$(date +%Y-%m-%d-%H%M)
ACCOUNTS_FILE="$(dirname "$0")/.wechat-accounts.json"

mkdir -p "$RAW_DIR"

# ── Load config ────────────────────────────────────────
if [ ! -f "$ACCOUNTS_FILE" ]; then
  cat > "$ACCOUNTS_FILE" << 'EOF'
{
  "accounts": [
    {"name": "宝玉", "keywords": ["宝玉", "dotey", "Claude Code"]},
    {"name": "科技爱好者", "keywords": ["AI 工具", "AI 编程", "开源"]}
  ],
  "searchQueries": [
    "AI编程工具 site:mp.weixin.qq.com",
    "Claude Code 教程 site:mp.weixin.qq.com",
    "AI Agent 开发 site:mp.weixin.qq.com",
    "OpenClaw 使用 site:mp.weixin.qq.com"
  ],
  "maxResults": 10,
  "maxAgeDays": 7
}
EOF
  echo "📝 Created default $ACCOUNTS_FILE (edit to customize)"
fi

CONFIG=$(cat "$ACCOUNTS_FILE")

# Read queries into temp file (handle spaces in queries)
TMP_QUERIES=$(mktemp)
echo "$CONFIG" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for q in data.get('searchQueries', []):
    print(q)
" > "$TMP_QUERIES" 2>/dev/null || true

MAX_RESULTS=$(echo "$CONFIG" | python3 -c "import json,sys; print(json.load(sys.stdin).get('maxResults',5))" 2>/dev/null || echo 5)

if [ ! -s "$TMP_QUERIES" ]; then
  rm -f "$TMP_QUERIES"
  echo "❌ No search queries configured in $ACCOUNTS_FILE"
  exit 1
fi

DRY_RUN=false
case "${1:-}" in --dry-run) DRY_RUN=true ;; esac

# ── State tracking ─────────────────────────────────────
SEEN_URLS=$(python3 -c "
import json
state = {}
try:
    with open('$STATE_FILE') as f:
        state = json.load(f)
except: pass
for url in state.get('seenUrls', []):
    print(url)
" 2>/dev/null || true)

_TEMP_FILES=("$TMP_QUERIES")
cleanup() { rm -f "${_TEMP_FILES[@]:-}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# ── Search & Fetch ──────────────────────────────────────
echo "📱 WeChat Article Sync — $TIMESTAMP"
echo ""

NEW_COUNT=0
TMPJSON=$(mktemp)
_TEMP_FILES+=("$TMPJSON")

while IFS= read -r query; do
  [ -z "$query" ] && continue
  echo "🔍 Searching: $query"

  # Try brave-search first (reliable), fallback to exa
  OK=false
  if command -v mcporter &>/dev/null; then
    mcporter call 'brave-search.brave_web_search' query="$query" count="$MAX_RESULTS" > "$TMPJSON" 2>/dev/null && OK=true
    if [ "$OK" = false ]; then
      mcporter call 'exa.web_search_exa' query="$query" numResults="$MAX_RESULTS" includeDomains='["mp.weixin.qq.com"]' > "$TMPJSON" 2>/dev/null && OK=true
    fi
  fi

  if [ "$OK" = false ]; then
    echo "  ⚠️ All search providers failed, skipping query"
    continue
  fi

  # Parse results and download new articles
  # brave-search outputs plain text (Title/Description/URL blocks), exa outputs JSON
  python3 - "$TMPJSON" "$RAW_DIR" "$TIMESTAMP" "$STATE_FILE" << 'PYEOF'
import json, sys, os, subprocess, re
from datetime import datetime

tmpjson, raw_dir, timestamp, state_file = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

with open(tmpjson) as f:
    raw = f.read()

results = []

# Try JSON first (exa format)
try:
    start = raw.index('{')
    end = raw.rindex('}') + 1
    data = json.loads(raw[start:end])
    results = data.get('results', []) if isinstance(data, dict) else []
    if not results and isinstance(data, list):
        results = data
except Exception:
    pass

# Fallback: parse plain text format (brave-search)
if not results:
    # Split by "Title: " pattern to find result blocks
    blocks = re.split(r'(?=^Title:\s)', raw, flags=re.MULTILINE)
    for block in blocks[1:]:  # Skip header if any
        title_m = re.search(r'^Title:\s*(.+)', block, re.MULTILINE)
        url_m = re.search(r'^URL:\s*(https?://\S+)', block, re.MULTILINE)
        desc_m = re.search(r'^Description:\s*(.+?)(?=^URL:|^Title:|$)', block, re.MULTILINE | re.DOTALL)
        if url_m:
            results.append({
                'url': url_m.group(1).strip(),
                'title': (title_m.group(1).strip() if title_m else 'unknown'),
                'description': (desc_m.group(1).strip()[:500] if desc_m else ''),
            })

if not results:
    print("  ℹ️ No results")
    sys.exit(0)

state = {"seenUrls": [], "lastSyncAt": ""}
if os.path.exists(state_file):
    try:
        with open(state_file) as f:
            state = json.load(f)
    except: pass
seen = set(state.get("seenUrls", []))

new_count = 0
for r in results[:10]:
    url = r.get("url", "")
    if not url or url in seen or "mp.weixin.qq.com" not in url:
        continue
    
    title = str(r.get("title", "unknown"))
    published = str(r.get("publishedDate", ""))[:10]
    
    safe_title = re.sub(r'[/\\|:*?<>]', '-', title)[:60]
    filename = f"{timestamp}-{published}-{safe_title}.md"
    filepath = os.path.join(str(raw_dir), filename)
    
    if os.path.exists(filepath):
        continue
    
    try:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", "20", f"https://r.jina.ai/{url}"],
            capture_output=True, text=True, timeout=25
        )
        content = result.stdout.strip()
        if len(content) < 100:
            content = f"# {title}\n\n> Source: {url}\n> Published: {published}\n\n{r.get('text', '')[:2000]}"
        
        with open(filepath, 'w') as f:
            f.write(content)
        seen.add(url)
        new_count += 1
        print(f"  + {filename}")
    except Exception as e:
        print(f"  ✗ Failed: {title} ({e})")

state["seenUrls"] = list(seen)[-500:]
state["lastSyncAt"] = datetime.now().isoformat()
with open(state_file, 'w') as f:
    json.dump(state, f, indent=2, ensure_ascii=False)

print(f"\n  📊 {new_count} new articles saved")
PYEOF

done < "$TMP_QUERIES"

echo ""
echo "✅ WeChat sync complete. Run pipeline.sh to ingest → build."
