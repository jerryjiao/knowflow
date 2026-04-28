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

if [ "${HEALTH_EXIT:-0}" -ne 0 ] && ! ${DRY_RUN:-false}; then
  exit 1 && ! ${DRY_RUN:-false}; then
  exit 1
fi
