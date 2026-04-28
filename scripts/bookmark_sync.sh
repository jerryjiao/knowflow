#!/bin/bash
# knowflow bookmark sync — X/Twitter 书签 → LLM Wiki 自动同步
# Usage: bash scripts/bookmark_sync.sh [--dry-run]
#
# 流程:
#   1. ft sync (同步最新书签到本地 SQLite)
#   2. ft list --json (导出新书签)
#   3. 对每条书签生成 raw/twitter/ 文件
#   4. 输出需要 Agent 处理的新书签清单

set -euo pipefail

WIKI_ROOT="$HOME/Documents/openclaw/workspace/knowflow"
RAW_DIR="$WIKI_ROOT/raw/twitter"
STATE_FILE="$WIKI_ROOT/.bookmark-state.json"
TIMESTAMP=$(date +%Y-%m-%d-%H%M)
DRY_RUN="${1:-}"

echo "🔖 Jerry's LLM Wiki — Bookmark Sync"
echo "======================================="
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# ── Step 1: Sync bookmarks ──────────────────────────
echo "📥 Step 1: Syncing bookmarks from X..."

if [ "$DRY_RUN" != "--dry-run" ]; then
  ft sync --target-adds 50 --max-minutes 5 --yes 2>&1 || echo "⚠️ Sync: no new bookmarks or error (continuing...)"
else
  echo "[DRY RUN] Would run: ft sync"
fi

# ── Step 2: Export & process new bookmarks ───────────
echo ""
echo "📋 Step 2: Exporting new bookmarks to raw/twitter/"

if [ "$DRY_RUN" != "--dry-run" ]; then
  mkdir -p "$RAW_DIR"

  # ft list --json outputs a JSON array, save to temp then process with python
  TMPJSON=$(mktemp)
  ft list --json > "$TMPJSON" 2>/dev/null || true

  python3 - "$TMPJSON" "$STATE_FILE" "$RAW_DIR" "$TIMESTAMP" << 'PYEOF'
import json, os, sys
from datetime import datetime

tmpjson, state_file, raw_dir, timestamp = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]

# Load state
last_seen = ''
if os.path.exists(state_file):
    with open(state_file) as f:
        state = json.load(f)
        last_seen = state.get('lastSeenId', '')

# Load bookmarks
with open(tmpjson) as f:
    bookmarks = json.load(f)

os.makedirs(raw_dir, exist_ok=True)
new_max_id = last_seen
new_count = 0

for bm in bookmarks:
    tweet_id = str(bm.get('id') or bm.get('tweetId', ''))
    if not tweet_id: continue

    # Skip already processed
    if last_seen and tweet_id <= last_seen:
        continue

    new_count += 1
    if not new_max_id or tweet_id > new_max_id:
        new_max_id = tweet_id

    author = bm.get('authorHandle', 'unknown')
    text = bm.get('text', '')
    created = bm.get('postedAt', timestamp)
    url = bm.get('url', '')

    # Metrics
    metrics = {}
    for k in ['likeCount','retweetCount','replyCount','bookmarkCount','viewCount']:
        v = bm.get(k)
        if v: metrics[k.replace('Count','').lower()] = v

    # Generate markdown
    lines = [
        f'# Bookmark from @{author}',
        '',
        f'> 来源: Twitter/X | 原始链接: {url}',
        f'> 收藏时间: {created}',
        '',
        f'## 📌 原文',
        '',
        text,
        '',
    ]
    if metrics:
        lines.append('## 📊 互动数据')
        lines.append('')
        for label, key in [('❤️ Likes','like'), ('🔁 Retweets','retweet'), ('💬 Replies','reply'), ('👁 Views','view')]:
            if key in metrics:
                lines.append(f'- {label}: {metrics[key]}')
        lines.append('')

    safe_author = author.lstrip('@')
    filename = f'{raw_dir}/{timestamp}-bookmark-{safe_author}-{tweet_id[:8]}.md'
    with open(filename, 'w') as f:
        f.write('\n'.join(lines))
    preview = text[:80].replace('\n', ' ') + ('...' if len(text) > 80 else '')
    print(f'  ✅ @{author}: {preview}')

# Save state
if new_max_id and new_count > 0:
    with open(state_file, 'w') as f:
        json.dump({'lastSeenId': new_max_id, 'lastSyncAt': datetime.now().isoformat(), 'newCount': new_count}, f, indent=2)
    print(f'\n📊 State updated: {new_count} new bookmarks, max_id={new_max_id}')
elif new_count == 0:
    print('  ℹ️ No new bookmarks since last sync')
PYEOF

  if [ $? -ne 0 ]; then
    echo "❌ Python processing failed" >&2
    rm -f "$TMPJSON"
    exit 1
  fi

  rm -f "$TMPJSON"
else
  echo "[DRY RUN] Would export new bookmarks to raw/twitter/"
fi

# ── Step 3: Auto Pipeline (ingest new raw → wiki) ──
echo ""
echo "🔄 Step 3: Running pipeline for new content..."
PIPELINE_LOG=$(bash "$WIKI_ROOT/scripts/pipeline.sh" --step=2,3,4,5 2>&1) && echo "$PIPELINE_LOG" || {
  PIPELINE_EXIT=$?
  echo "$PIPELINE_LOG"
  if [ $PIPELINE_EXIT -ne 0 ]; then
    echo "⚠️ Pipeline exited with code $PIPELINE_EXIT (may have issues to fix)"
  fi
}

# ── Summary ──────────────────────────────────────────
echo ""
echo "✅ Sync + Pipeline complete!"
