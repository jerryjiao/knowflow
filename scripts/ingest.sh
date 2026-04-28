#!/bin/bash
# knowflow ingest pipeline — 自动识别来源并提取全文
# Usage: bash ingest.sh <url_or_content> [source_type]
# Source type: auto | twitter | xiaohongshu | wechat | web | youtube | text

set -euo pipefail

WIKI_ROOT="$HOME/Documents/openclaw/workspace/knowflow"
RAW_DIR="$WIKI_ROOT/raw"
TIMESTAMP=$(date +%Y-%m-%d-%H%M)

URL="${1:-}"
SOURCE_TYPE="${2:-auto}"

if [ -z "$URL" ]; then
  echo "❌ Usage: bash ingest.sh <url_or_text> [source_type]"
  exit 1
fi

# Auto-detect source type from URL
detect_source() {
  local url="$1"
  if echo "$url" | grep -qi 'x\.com\|twitter\.com'; then
    echo "twitter"
  elif echo "$url" | grep -qi 'xiaohongshu\|xhslink\|xhscdn'; then
    echo "xiaohongshu"
  elif echo "$url" | grep -qi 'mp\.weixin\|weixin.*article\|wx'; then
    echo "wechat"
  elif echo "$url" | grep -qi 'youtube\|youtu\.be'; then
    echo "youtube"
  elif echo "$url" | grep -qi '^https\?://'; then
    echo "web"
  else
    echo "text"
  fi
}

[ "$SOURCE_TYPE" = "auto" ] && SOURCE_TYPE=$(detect_source "$URL")

# ── URL Sanitization ─────────────────────────────────────
validate_url() {
  local url="$1"
  # Must be http(s)://, no spaces, no shell metacharacters
  if ! echo "$url" | grep -qE '^https?://[^[:space:]]+$'; then
    echo "❌ Invalid URL: $url" >&2
    return 1
  fi
  # Block obvious injection patterns
  if echo "$url" | grep -qE '[;|&`$\\\x00-\x1f]'; then
    echo "❌ Unsafe URL characters detected" >&2
    return 1
  fi
}
validate_url "$URL" || exit 1

OUTPUT_FILE=""
EXTRACT_METHOD=""

case "$SOURCE_TYPE" in
  twitter)
    echo "🐦 检测到 Twitter/X 链接..."
    OUTPUT_FILE="$RAW_DIR/twitter/$TIMESTAMP-tweet.md"
    # Extract tweet via twitter CLI or Jina
    if command -v twitter &>/dev/null; then
      TWEET_ID=$(echo "$URL" | grep -oE '[0-9]{15,}' | head -1)
      if [ -n "$TWEET_ID" ]; then
        twitter get "$TWEET_ID" 2>/dev/null > "$OUTPUT_FILE" || \
          curl -sL "https://r.jina.ai/$URL" > "$OUTPUT_FILE" 2>/dev/null
      else
        curl -sL "https://r.jina.ai/$URL" > "$OUTPUT_FILE" 2>/dev/null
      fi
    else
      curl -sL "https://r.jina.ai/$URL" > "$OUTPUT_FILE" 2>/dev/null
    fi
    EXTRACT_METHOD="jina_reader"
    ;;

  xiaohongshu)
    echo "📕 检测到小红书链接..."
    OUTPUT_FILE="$RAW_DIR/xiaohongshu/$TIMESTAMP-xhs.md"
    # Use agent-browser for xiaohongshu (needs JS rendering)
    if command -v agent-browser &>/dev/null; then
      # Try Jina first, fallback to agent-browser
      HTTP_CODE=$(curl -sL -o "$OUTPUT_FILE" -w "%{http_code}" --max-time 15 "https://r.jina.ai/$URL" 2>/dev/null) || true
      if [ "$HTTP_CODE" != "200" ] || [ ! -s "$OUTPUT_FILE" ]; then
        echo "> ⚠️ Jina 提取失败，小红书可能需要浏览器渲染，已保存原始链接" > "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "**原始链接**: $URL" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "> 💡 提示: 小红书内容需要通过 agent-browser 渲染提取" >> "$OUTPUT_FILE"
      fi
    else
      curl -sL "https://r.jina.ai/$URL" > "$OUTPUT_FILE" 2>/dev/null || echo "**原始链接**: $URL" > "$OUTPUT_FILE"
    fi
    EXTRACT_METHOD="jina_reader"
    ;;

  wechat)
    echo "💬 检测到微信公众号链接..."
    OUTPUT_FILE="$RAW_DIR/wechat/$TIMESTAMP-wechat.md"
    curl -sL --max-time 20 "https://r.jina.ai/$URL" > "$OUTPUT_FILE" 2>/dev/null
    EXTRACT_METHOD="jina_reader"
    ;;

  youtube)
    echo "▶️ 检测到 YouTube 链接..."
    OUTPUT_FILE="$RAW_DIR/web/$TIMESTAMP-youtube.md"
    if command -v yt-dlp &>/dev/null; then
      # Get video info + transcript
      echo "# YouTube Video" > "$OUTPUT_FILE"
      echo "" >> "$OUTPUT_FILE"
      echo "**URL**: $URL" >> "$OUTPUT_FILE"
      echo "" >> "$OUTPUT_FILE"
      echo "## Video Info" >> "$OUTPUT_FILE"
      yt-dlp --print title --print description --print duration_string --no-download "$URL" >> "$OUTPUT_FILE" 2>/dev/null || true
      echo "" >> "$OUTPUT_FILE"
      echo "## Transcript / Subtitles" >> "$OUTPUT_FILE"
      yt-dlp --write-sub --sub-langs "zh,en" --skip-download -o "/tmp/wiki-yt-sub" "$URL" 2>/dev/null && \
        cat /tmp/wiki-yt-sub*.vtt 2>/dev/null | sed 's/<[^>]*>//g' | grep -v '^$' | head -200 >> "$OUTPUT_FILE" || \
        echo "(无字幕可用)" >> "$OUTPUT_FILE"
      rm -f /tmp/wiki-yt-sub* 2>/dev/null || true
    else
      curl -sL "https://r.jina.ai/$URL" > "$OUTPUT_FILE" 2>/dev/null
    fi
    EXTRACT_METHOD="yt-dlp+jina"
    ;;

  web)
    echo "🌐 检测到网页链接..."
    # Determine subdirectory by domain
    DOMAIN=$(echo "$URL" | sed 's|https\?://||' | cut -d'/' -f1)
    OUTPUT_FILE="$RAW_DIR/web/$TIMESTAMP-web-${DOMAIN%%.*}.md"
    curl -sL --max-time 20 "https://r.jina.ai/$URL" > "$OUTPUT_FILE" 2>/dev/null
    EXTRACT_METHOD="jina_reader"
    ;;

  text)
    echo "📝 纯文本内容..."
    OUTPUT_FILE="$RAW_DIR/web/$TIMESTAMP-text.md"
    echo "$URL" > "$OUTPUT_FILE"
    EXTRACT_METHOD="direct"
    ;;
esac

# Verify output
if [ -f "$OUTPUT_FILE" ] && [ -s "$OUTPUT_FILE" ]; then
  SIZE=$(wc -c < "$OUTPUT_FILE" | tr -d ' ')
  LINES=$(wc -l < "$OUTPUT_FILE" | tr -d ' ')
  echo ""
  echo "✅ 提取完成:"
  echo "   📄 文件: $OUTPUT_FILE"
  echo "   📏 大小: ${SIZE} bytes (${LINES} 行)"
  echo "   🔧 方法: $EXTRACT_METHOD"
  echo "   🏷️ 类型: $SOURCE_TYPE"
  echo ""
  echo "→ 下一步: 告诉 Agent 执行 ingest 处理此文件"
else
  echo ""
  echo "⚠️ 提取可能失败（文件为空或不存在）"
  echo "   原始链接: $URL"
  exit 1
fi
