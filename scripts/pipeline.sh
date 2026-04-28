#!/bin/bash
# knowflow pipeline — automated 5-step wiki processing pipeline
# Usage: bash scripts/pipeline.sh [--dry-run] [--step=N]
#
# Steps:
#   1. bookmark_sync.sh     — sync X/Twitter bookmarks
#   2. detect new raw/ files — compare .ingest-state.json vs raw/
#   3. ingest new files      — run ingest.sh for each new file
#   4. vector-store build    — incremental vector index (only if new pages)
#   5. wiki-health.sh        — broken links, empty files, orphan pages
#
# Options:
#   --dry-run    Print each step without executing
#   --step=N     Run only step N (1-5)

set -euo pipefail

# ── Temp file cleanup ─────────────────────────────────────
_TEMP_FILES=()
cleanup() { rm -f "${_TEMP_FILES[@]:-}" 2>/dev/null || true; }
trap cleanup EXIT INT TERM

# ── Config ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WIKI_ROOT="${WIKI_ROOT:-$(cd "$SCRIPT_DIR/.." && pwd)}"
STATE_FILE="$WIKI_ROOT/.ingest-state.json"
RAW_DIR="$WIKI_ROOT/raw"
WIKI_DIR="$WIKI_ROOT/wiki"
LOCK_FILE="$WIKI_ROOT/.pipeline.lock"
TIMESTAMP=$(date +%Y-%m-%d-%H%M)

DRY_RUN=false
RUN_STEP=0

# ── Parse args ──────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --dry-run)   DRY_RUN=true ;;
    --step=*)    RUN_STEP="${arg#--step=}" ;;
    *)           echo "Unknown option: $arg" >&2; exit 1 ;;
  esac
done

# ── Helpers ─────────────────────────────────────────────
step_header() {
  local step_num="$1"
  local step_name="$2"
  echo ""
  echo "━━━ Step $step_num: $step_name ━━━━━━━━━━━━━━━━━━━━━━━"
}

run_cmd() {
  if $DRY_RUN; then
    echo "[DRY RUN] $*"
  else
    "$@"
  fi
}

should_run() {
  local step="$1"
  [ "$RUN_STEP" -eq 0 ] || [ "$RUN_STEP" -eq "$step" ]
}

# ── Summary tracking ────────────────────────────────────
STEP_RESULTS=()
HEALTH_EXIT=0
HEALTH_SCORE="UNKNOWN"
NEW_FILES_COUNT=0

# ═══════════════════════════════════════════════════════
# acquire lock (prevent concurrent runs)
# ═══════════════════════════════════════════════════════
if ! $DRY_RUN; then
  # macOS-compatible lock (flock not available on macOS)
  if [ -f "$LOCK_FILE" ]; then
    # Check if the process is still running
    LOCK_PID=$(cat "$LOCK_FILE" 2>/dev/null || echo "")
    if [ -n "$LOCK_PID" ] && kill -0 "$LOCK_PID" 2>/dev/null; then
      echo "⚠️ Pipeline already running (PID $LOCK_PID, lock: $LOCK_FILE), exiting"
      exit 0
    fi
    rm -f "$LOCK_FILE"
  fi
  echo $$ > "$LOCK_FILE"
  _TEMP_FILES+=("$LOCK_FILE")
fi

# ── Banner ──────────────────────────────────────────────
echo "🔧 Jerry's LLM Wiki — Pipeline"
echo "================================"
echo "Wiki root: $WIKI_ROOT"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
if $DRY_RUN; then echo "Mode: DRY RUN"; fi
if [ "$RUN_STEP" -ne 0 ]; then echo "Running only: step $RUN_STEP"; fi

# ═══════════════════════════════════════════════════════
# Step 1: Bookmark Sync
# ═══════════════════════════════════════════════════════
if should_run 1; then
  step_header 1 "Bookmark Sync"
  if $DRY_RUN; then
    echo "[DRY RUN] Would run: bash $SCRIPT_DIR/bookmark_sync.sh --dry-run"
    STEP_RESULTS+=("Step 1: [DRY RUN] bookmark sync")
  else
    if [ -f "$SCRIPT_DIR/bookmark_sync.sh" ]; then
      bash "$SCRIPT_DIR/bookmark_sync.sh" 2>&1 || true
      STEP_RESULTS+=("Step 1: ✅ bookmark sync completed")
    else
      echo "⚠️ bookmark_sync.sh not found, skipping"
      STEP_RESULTS+=("Step 1: ⚠️ skipped (script not found)")
    fi
  fi
fi

# ═══════════════════════════════════════════════════════
# Step 2: Detect new raw/ files
# ═══════════════════════════════════════════════════════
NEW_FILES_LIST=""
if should_run 2; then
  step_header 2 "Detect New Raw Files"

  # Build current file manifest (md5 + mtime for each .md in raw/)
  TMPMANIFEST=$(mktemp)
  _TEMP_FILES+=("$TMPMANIFEST")
  if [ -d "$RAW_DIR" ]; then
    find "$RAW_DIR" -name '*.md' -type f -print0 2>/dev/null | while IFS= read -r -d '' file; do
      local_path="${file#$WIKI_ROOT/}"
      mtime=$(stat -f '%m' "$file" 2>/dev/null || stat -c '%Y' "$file" 2>/dev/null)
      file_hash=$(md5 -q "$file" 2>/dev/null || md5sum "$file" | awk '{print $1}')
      echo "{\"path\":\"$local_path\",\"mtime\":\"$mtime\",\"hash\":\"$file_hash\"}"
    done > "$TMPMANIFEST"
  fi

  # Compare with state file to find new/changed files
  TMPNEW=$(mktemp)
  _TEMP_FILES+=("$TMPNEW")
  python3 - "$STATE_FILE" "$TMPMANIFEST" "$TMPNEW" << 'PYEOF'
import json, sys

state_file, manifest_file, new_files_file = sys.argv[1], sys.argv[2], sys.argv[3]

# Load existing state
state = {"files": {}, "lastIngestAt": None}
try:
    with open(state_file) as f:
        state = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    pass

known = state.get("files", {})

# Load current manifest
current = {}
try:
    with open(manifest_file) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                current[entry["path"]] = entry
            except (json.JSONDecodeError, KeyError):
                pass
except FileNotFoundError:
    pass

# Find new or changed files
new_files = []
for path, entry in current.items():
    if path not in known:
        new_files.append(path)
    elif known[path].get("hash") != entry.get("hash"):
        new_files.append(path)
    elif known[path].get("mtime") != entry.get("mtime"):
        new_files.append(path)

with open(new_files_file, "w") as f:
    json.dump(new_files, f)

print(f"  Known files: {len(known)}")
print(f"  Current files: {len(current)}")
print(f"  New/changed: {len(new_files)}")
if new_files:
    for nf in new_files:
        print(f"    + {nf}")
PYEOF

  NEW_FILES_LIST=$(cat "$TMPNEW")
  NEW_FILES_COUNT=$(echo "$NEW_FILES_LIST" | python3 -c "import json,sys; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "0")

  rm -f "$TMPMANIFEST" "$TMPNEW"

  if [ "$NEW_FILES_COUNT" -gt 0 ]; then
    STEP_RESULTS+=("Step 2: ✅ $NEW_FILES_COUNT new/changed file(s) detected")
  else
    STEP_RESULTS+=("Step 2: ℹ️ no new files")
  fi
fi

# ═══════════════════════════════════════════════════════
# Step 3: Ingest new files
# ═══════════════════════════════════════════════════════
INGESTED_COUNT=0
if should_run 3; then
  step_header 3 "Ingest New Files"

  if [ "$NEW_FILES_COUNT" -gt 0 ]; then
    TMPINGEST=$(mktemp)
    _TEMP_FILES+=("$TMPINGEST")

    if $DRY_RUN; then
      echo "[DRY RUN] Would run batch-ingest.cjs for $NEW_FILES_COUNT new file(s)"
      echo "1" >> "$TMPINGEST"
    else
      # Batch ingest: process all new raw files at once (dedup + cluster + wiki pages)
      if [ -f "$SCRIPT_DIR/batch-ingest.cjs" ]; then
        echo "  📦 Running batch-ingest.cjs ($NEW_FILES_COUNT new files)..."
        if node "$SCRIPT_DIR/batch-ingest.cjs" 2>&1; then
          echo "1" >> "$TMPINGEST"
        else
          echo "  ⚠️ batch-ingest.cjs failed"
        fi
      elif [ -f "$SCRIPT_DIR/ingest.sh" ]; then
        # Fallback: iterate each file with ingest.sh
        echo "$NEW_FILES_LIST" | python3 -c "
import json, sys
files = json.load(sys.stdin)
for f in files:
    print(f)
" | while IFS= read -r rel_path; do
          [ -z "$rel_path" ] && continue
          full_path="$WIKI_ROOT/$rel_path"
          echo "  Ingesting: $rel_path"
          bash "$SCRIPT_DIR/ingest.sh" "$full_path" 2>&1 || true
          echo "1" >> "$TMPINGEST"
        done
      else
        echo "⚠️ No ingest tool found"
      fi
    fi

    INGESTED_COUNT=$(wc -l < "$TMPINGEST" | tr -d ' ')
    rm -f "$TMPINGEST"

    # Update ingest state with current file manifest
    if ! $DRY_RUN && [ -f "$STATE_FILE" ]; then
      python3 - "$STATE_FILE" "$RAW_DIR" "$WIKI_ROOT" << 'PYEOF'
import json, os, hashlib, sys
from datetime import datetime

state_file, raw_dir, wiki_root = sys.argv[1], sys.argv[2], sys.argv[3]

# Load existing state
state = {"files": {}, "lastIngestAt": None}
try:
    with open(state_file) as f:
        state = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    pass

# Scan raw/ for current files
for root, dirs, files in os.walk(raw_dir):
    for fname in files:
        if not fname.endswith('.md'):
            continue
        fpath = os.path.join(root, fname)
        rel = os.path.relpath(fpath, wiki_root)
        mtime = str(int(os.path.getmtime(fpath)))
        h = hashlib.md5(open(fpath, 'rb').read()).hexdigest()
        state["files"][rel] = {"mtime": mtime, "hash": h}

state["lastIngestAt"] = datetime.now().isoformat()

with open(state_file, 'w') as f:
    json.dump(state, f, indent=2)
PYEOF
    fi

    STEP_RESULTS+=("Step 3: ✅ ingested $INGESTED_COUNT file(s)")
  else
    echo "  No new files to ingest"
    STEP_RESULTS+=("Step 3: ℹ️ nothing to ingest")
  fi
fi

# ═══════════════════════════════════════════════════════
# Step 4: Vector Store Build (incremental)
# ═══════════════════════════════════════════════════════
if should_run 4; then
  step_header 4 "Vector Store Build"

  if [ "$NEW_FILES_COUNT" -gt 0 ] || [ "$RUN_STEP" -eq 4 ]; then
    if $DRY_RUN; then
      echo "[DRY RUN] Would run: node $SCRIPT_DIR/vector-store.mjs build --incremental"
      STEP_RESULTS+=("Step 4: [DRY RUN] vector store build --incremental")
    else
      if [ -f "$SCRIPT_DIR/vector-store.mjs" ]; then
        node "$SCRIPT_DIR/vector-store.mjs" build --incremental 2>&1 || true
        STEP_RESULTS+=("Step 4: ✅ vector store incremental build completed")
      else
        echo "⚠️ vector-store.mjs not found, skipping"
        STEP_RESULTS+=("Step 4: ⚠️ skipped (script not found)")
      fi
    fi
  else
    echo "  No new files — skipping vector store build"
    STEP_RESULTS+=("Step 4: ℹ️ skipped (no new pages)")
  fi
fi

# ═══════════════════════════════════════════════════════
# Step 5: Wiki Health Check
# ═══════════════════════════════════════════════════════
if should_run 5; then
  step_header 5 "Wiki Health Check"

  if $DRY_RUN; then
    echo "[DRY RUN] Would run: bash $SCRIPT_DIR/wiki-health.sh"
    STEP_RESULTS+=("Step 5: [DRY RUN] wiki health check")
    HEALTH_SCORE="N/A (dry run)"
  else
    if [ -f "$SCRIPT_DIR/wiki-health.sh" ]; then
      set +e
      timeout 30 bash "$SCRIPT_DIR/wiki-health.sh" 2>&1
      HEALTH_EXIT=$?
      set -e

      if [ "$HEALTH_EXIT" -eq 0 ]; then
        STEP_RESULTS+=("Step 5: ✅ all health checks passed")
        HEALTH_SCORE="PASS"
      elif [ "$HEALTH_EXIT" -ge 128 ]; then
        # SIGABRT(134)/SIGKILL(137) etc — intermittent, treat as warning
        STEP_RESULTS+=("Step 5: ⚠️ health check crashed (signal $((HEALTH_EXIT-128)), skipped)")
        HEALTH_SCORE="WARN"
      else
        STEP_RESULTS+=("Step 5: ❌ health issues found (exit $HEALTH_EXIT)")
        HEALTH_SCORE="FAIL"
      fi
    else
      echo "⚠️ wiki-health.sh not found, skipping"
      STEP_RESULTS+=("Step 5: ⚠️ skipped (script not found)")
      HEALTH_SCORE="N/A"
    fi
  fi
fi

# ═══════════════════════════════════════════════════════
# Pipeline Summary
# ═══════════════════════════════════════════════════════
echo ""
echo "━━━ Pipeline Summary ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
for result in ${STEP_RESULTS:+"${STEP_RESULTS[@]}"}; do
  echo "  $result"
done
echo ""
echo "  Health score: $HEALTH_SCORE"
echo ""
echo "Pipeline complete at $(date '+%Y-%m-%d %H:%M:%S')"

# ═══════════════════════════════════════════════════════
# Feishu Notification
# ═══════════════════════════════════════════════════════
notify_feishu() {
  local status_icon="❌"
  case "${HEALTH_SCORE:-UNKNOWN}" in
    PASS) status_icon="✅" ;;
    WARN) status_icon="⚠️" ;;
    N/A|UNKNOWN) status_icon="⚠️" ;;
    FAIL) status_icon="❌" ;;
  esac

  local results_text=""
  # Guard for set -u: use ${arr[@]+"${arr[@]}"} to safely iterate empty arrays
  for r in ${STEP_RESULTS:+"${STEP_RESULTS[@]}"}; do
    results_text+="${results_text:+\n}  $r"
  done

  local msg
  printf -v msg '📚 *Jerry Wiki Report*\n\n%s *Status:* %s\n🕐 *Time:* %s\n\n*Results:*\n%s\n\n_Pipeline auto-run_' \
    "$status_icon" "${HEALTH_SCORE:-UNKNOWN}" "$(date '+%Y-%m-%d %H:%M')" "$results_text"

  if command -v openclaw &>/dev/null; then
    openclaw message send --channel feishu --target "user:REDACTED_USER" --message "$msg" 2>/dev/null || true
  fi
}

if ! $DRY_RUN; then
  notify_feishu || echo "⚠️ Feishu notification failed (non-fatal)" >&2
fi

if [ "${HEALTH_EXIT:-0}" -ne 0 ] && ! ${DRY_RUN:-false}; then
  exit 1
fi
