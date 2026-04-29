#!/usr/bin/env python3
"""
Jerry's LLM Wiki — Knowledge Graph Builder (M2 Enhanced)
Parses wiki/ markdown files, extracts [[wikilink]] relationships,
generates interactive graph.html (self-contained, no server needed).

M2 改进:
  - 支持增量更新（--incremental 模式，检查已有数据避免全量重建）
  - 输出详细节点统计信息到控制台
  - 确保 vis.js HTML 文件中的中文显示正常（UTF-8 BOM + 显式 charset）
  - 同时输出 knowledge-graph.json 供外部工具消费

Usage:
  python3 graph_builder.py [--wiki-dir WIKI_ROOT] [--output OUTPUT.html] [--incremental]
"""

import os
import re
import json
import argparse
import hashlib
import time
from pathlib import Path
from collections import defaultdict

# ── Configuration ──────────────────────────────────────────
DEFAULT_WIKI_DIR = os.path.expanduser("~/Documents/openclaw/workspace/knowflow/wiki")
DEFAULT_OUTPUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'graph', 'graph.html')
# 增量更新状态文件：记录每个文件的 hash，用于检测变更
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'graph', '.graph-state.json')

# Node colors by category
CATEGORY_COLORS = {
    "sources":   {"bg": "#E3F2FD", "border": "#1565C0", "text": "#0D47A1"},     # Blue
    "entities":  {"bg": "#F3E5F5", "border": "#7B1FA2", "text": "#4A148C"},     # Purple
    "concepts":  {"bg": "#E8F5E9", "border": "#2E7D32", "text": "#1B5E20"},     # Green
    "comparisons": {"bg": "#FFF3E0", "border": "#EF6C00", "text": "#E65100"},  # Orange
    "_special":  {"bg": "#FFEBEE", "border": "#C62828", "text": "#B71C1C"},     # Red (index/log/overview)
}

# Node shapes by category
CATEGORY_SHAPES = {
    "sources":      "box",
    "entities":      "dot",
    "concepts":      "diamond",
    "comparisons":   "hexagon",
    "_special":      "star",
}


def log(msg):
    """带时间戳的日志"""
    ts = time.strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


def file_hash(filepath: str) -> str:
    """计算文件的 MD5 hash 用于增量检测"""
    try:
        with open(filepath, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception:
        return ""


def load_state() -> dict:
    """加载上次的构建状态（文件 hash 映射）"""
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_state(file_hashes: dict):
    """保存当前构建状态"""
    state_dir = os.path.dirname(STATE_FILE)
    os.makedirs(state_dir, exist_ok=True)
    with open(STATE_FILE, 'w', encoding='utf-8') as f:
        json.dump({
            "file_hashes": file_hashes,
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        }, f, ensure_ascii=False, indent=2)


def detect_category(filepath: str) -> str:
    """Detect category from file path."""
    parts = Path(filepath).parts
    if len(parts) >= 2:
        parent = parts[-2]
        if parent in CATEGORY_COLORS:
            return parent
    filename = Path(filepath).stem.lower()
    if filename in ("index", "log", "overview"):
        return "_special"
    return "sources"  # default


def extract_title(content: str, filepath: str) -> str:
    """Extract title from first H1 heading."""
    m = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
    if m:
        return m.group(1).strip()
    return Path(filepath).stem.replace("-", " ").title()


def extract_summary(content: str, max_len: int = 120) -> str:
    """Extract first meaningful paragraph as summary."""
    lines = content.split("\n")
    for line in lines:
        line = line.strip()
        if not line or line.startswith("#") or line.startswith(">") or line.startswith("|"):
            continue
        if line.startswith("-") or line.startswith("*"):
            continue
        clean = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', line)
        clean = re.sub(r'[*_`#]', '', clean)
        if len(clean) > 10:
            return clean[:max_len] + ("..." if len(clean) > max_len else "")
    return "(无摘要)"


def extract_wikilinks(content: str) -> list[tuple[str, int]]:
    """Extract all [[wikilink]] targets with their positions."""
    links = []
    for m in re.finditer(r'\[\[([^\]]+)\]\]', content):
        target = m.group(1).strip()
        links.append((target, m.start()))
    return links


def resolve_link(target: str, all_files: dict[str, str]) -> str | None:
    """
    Resolve a wikilink target to an actual file path.
    Handles various formats:
      - entities/karpathy → entities/karpathy.md
      - karpathy-andrej → find karpathy-andrej.md anywhere
    """
    # Direct match with .md extension
    if target + ".md" in all_files:
        return target + ".md"
    
    # Already has .md
    if target.endswith(".md") and target in all_files:
        return target
    
    # Partial match (filename without path)
    basename = Path(target).stem
    for filepath in all_files:
        if Path(filepath).stem == basename:
            return filepath
    
    # Fuzzy match (contains)
    for filepath in all_files:
        if basename in Path(filepath).stem.lower():
            return filepath
    
    return None


def build_graph(wiki_dir: str, incremental: bool = False) -> dict:
    """Build graph data from wiki directory."""
    nodes = {}       # id → node data
    edges = []       # list of edge data
    all_files = {}   # relative_path → full content
    
    # Read all markdown files
    wiki_path = Path(wiki_dir)
    if not wiki_path.exists():
        log(f"❌ Wiki directory not found: {wiki_dir}")
        return {"nodes": [], "edges": []}
    
    md_files = sorted(wiki_path.rglob("*.md"))
    
    # ── Incremental check ──
    prev_state = {}
    current_hashes = {}
    changed_files = set()
    
    if incremental:
        prev_state = load_state()
        log(f"📋 增量模式：加载上次状态 ({len(prev_state.get('file_hashes', {}))} 个文件记录)")
    
    for fpath in md_files:
        rel_path = str(fpath.relative_to(wiki_path))
        try:
            content = fpath.read_text(encoding="utf-8")
            all_files[rel_path] = content
            
            # 计算并记录 hash
            fh = file_hash(str(fpath))
            current_hashes[rel_path] = fh
            
            # 增量模式：检查是否有变更
            if incremental:
                prev_hash = prev_state.get('file_hashes', {}).get(rel_path, '')
                if fh != prev_hash:
                    changed_files.add(rel_path)
        except Exception as e:
            log(f"⚠️ Failed to read {rel_path}: {e}")
            continue
    
    if incremental and len(changed_files) == 0 and len(prev_state.get('file_hashes', {})) > 0:
        log("✅ 没有检测到文件变更，跳过重建（使用 --force 可强制重建）")
        # 返回空结果表示无需重建（调用方可以据此跳过）
        return {"nodes": [], "edges": [], "skipped": True, "reason": "no_changes"}
    
    if incremental:
        log(f"🔄 检测到 {len(changed_files)} 个文件有变更，开始增量构建...")
    
    # Build nodes
    for rel_path, content in all_files.items():
        category = detect_category(rel_path)
        title = extract_title(content, rel_path)
        summary = extract_summary(content)
        
        color = CATEGORY_COLORS.get(category, CATEGORY_COLORS["_special"])
        shape = CATEGORY_SHAPES.get(category, "ellipse")
        
        node = {
            "id": rel_path,
            "label": title,
            "title": f"{title}\n({rel_path})\n\n{summary}",
            "category": category,
            "color": {
                "background": color["bg"],
                "border": color["border"],
                "highlight": {"background": color["border"], "border": color["text"]},
            },
            "font": {"color": color["text"], "size": 14, "face": "Inter"},
            "shape": shape,
            "size": 20 if category == "_special" else 16,
        }
        
        # Special nodes are slightly larger
        if category == "_special":
            node["size"] = 25
            node["font"]["bold"] = True
        
        nodes[rel_path] = node
    
    # Build edges from wikilinks
    edge_id = 0
    seen_edges = set()  # avoid duplicates
    
    for rel_path, content in all_files.items():
        links = extract_wikilinks(content)
        for target, _pos in links:
            resolved = resolve_link(target, all_files)
            if resolved and resolved != rel_path:
                edge_key = tuple(sorted([rel_path, resolved]))
                if edge_key not in seen_edges:
                    seen_edges.add(edge_key)
                    edges.append({
                        "id": edge_id,
                        "from": rel_path,
                        "to": resolved,
                        "arrows": "to",
                        "color": {"color": "#90A4AE", "opacity": 0.4},
                        "width": 1.5,
                        "smooth": {"type": "curvedCW", "roundness": 0.15},
                    })
                    edge_id += 1
    
    # Compute degree for sizing
    degrees = defaultdict(int)
    for e in edges:
        degrees[e["from"]] += 1
        degrees[e["to"]] += 1
    
    for nid, node in nodes.items():
        deg = degrees.get(nid, 0)
        node["value"] = max(deg + 2, 5)  # minimum size
        node["degree"] = deg
    
    # Category breakdown
    categories = {}
    for n in nodes.values():
        cat = n["category"]
        categories[cat] = categories.get(cat, 0) + 1
    
    graph_data = {
        "nodes": list(nodes.values()),
        "edges": edges,
        "stats": {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "files_processed": len(all_files),
            "categories": categories,
        },
    }
    
    # Save state after successful build
    save_state(current_hashes)
    
    return graph_data


def generate_html(graph_data: dict, output_path: str):
    """Generate self-contained HTML with vis.js. UTF-8 ensured."""
    stats = graph_data["stats"]
    nodes_json = json.dumps(graph_data["nodes"], ensure_ascii=False)
    edges_json = json.dumps(graph_data["edges"], ensure_ascii=False)
    
    html = f'''<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🧠 Jerry's Wiki Knowledge Graph</title>
<script src="https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js"></script>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, 'Inter', 'SF Pro', 'PingFang SC', 'Microsoft YaHei', sans-serif; background: #fafafa; }}
  
  /* Header */
  header {{
    position: fixed; top: 0; left: 0; right: 0; z-index: 100;
    background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
    border-bottom: 1px solid #eee; padding: 12px 24px;
    display: flex; align-items: center; justify-content: space-between;
  }}
  header h1 {{ font-size: 18px; font-weight: 600; color: #333; }}
  header h1 span {{ opacity: 0.5; }}
  
  /* Stats bar */
  .stats {{ display: flex; gap: 16px; font-size: 13px; color: #666; }}
  .stat {{ display: flex; align-items: center; gap: 4px; }}
  .stat-dot {{ width: 8px; height: 8px; border-radius: 50%; display: inline-block; }}
  
  /* Legend */
  .legend {{ position: fixed; bottom: 20px; left: 20px; z-index: 100;
    background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
    border: 1px solid #e0e0e0; border-radius: 12px; padding: 14px 18px;
    font-size: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }}
  .legend-title {{ font-weight: 600; margin-bottom: 10px; color: #333; }}
  .legend-item {{ display: flex; align-items: center; gap: 8px; margin-bottom: 6px; color: #555; }}
  .legend-icon {{ width: 14px; height: 14px; border-radius: 3px; flex-shrink: 0; }}
  
  /* Controls */
  .controls {{ position: fixed; bottom: 20px; right: 20px; z-index: 100;
    display: flex; flex-direction: column; gap: 8px; }}
  .ctrl-btn {{
    background: white; border: 1px solid #ddd; border-radius: 8px;
    padding: 8px 14px; font-size: 12px; cursor: pointer; color: #555;
    transition: all 0.15s; box-shadow: 0 1px 3px rgba(0,0,0,0.05);
  }}
  .ctrl-btn:hover {{ border-color: #999; color: #333; }}
  
  /* Search */
  .search-box {{
    position: fixed; top: 60px; right: 24px; z-index: 100;
    background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
    border: 1px solid #ddd; border-radius: 8px; padding: 8px 12px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
  }}
  .search-box input {{ border: none; outline: none; font-size: 13px; width: 200px;
    background: transparent; color: #333; }}
  .search-box input::placeholder {{ color: #aaa; }}
  
  /* Graph container */
  #graph-container {{ 
    margin-top: 56px; width: 100vw; height: calc(100vh - 56px); 
  }}
  
  /* Info panel */
  #info-panel {{
    position: fixed; top: 60px; left: 24px; z-index: 100;
    background: rgba(255,255,255,0.95); backdrop-filter: blur(10px);
    border: 1px solid #e0e0e0; border-radius: 12px; padding: 16px 20px;
    max-width: 320px; max-height: 40vh; overflow-y: auto;
    font-size: 13px; line-height: 1.6; color: #444;
    box-shadow: 0 2px 8px rgba(0,0,0,0.06); display: none;
  }}
  #info-panel.visible {{ display: block; }}
  #info-panel h3 {{ font-size: 15px; margin-bottom: 8px; color: #222; }}
  #info-panel .meta {{ font-size: 11px; color: #888; margin-bottom: 10px; }}
  #info-panel .links {{ margin-top: 10px; }}
  #info-panel .link-item {{ display: inline-block; margin: 2px 4px 2px 0;
    padding: 2px 8px; background: #f0f0f0; border-radius: 10px; font-size: 11px; color: #555; }}

  @media (prefers-color-scheme: dark) {{
    body {{ background: #1a1a2e; }}
    header {{ background: rgba(26,26,46,0.95); border-color: #333; color: #eee; }}
    header h1 {{ color: #eee; }}
    .stats {{ color: #aaa; }}
    .legend, .controls, .search-box, #info-panel {{
      background: rgba(26,26,46,0.95); border-color: #333; color: #ccc; }}
    .ctrl-btn {{ background: #252540; border-color: #444; color: #ccc; }}
    .ctrl-btn:hover {{ border-color: #666; color: #fff; }}
    .search-box input {{ color: #ccc; }}
    .search-box input::placeholder {{ color: #666; }}
    #info-panel {{ color: #ccc; }}
    #info-panel h3 {{ color: #fff; }}
    #info-panel .meta {{ color: #888; }}
    #info-panel .link-item {{ background: #333; color: #aaa; }}
  }}
</style>
</head>
<body>

<header>
  <h1>🧠 Jerry's Wiki <span>Knowledge Graph</span></h1>
  <div class="stats">
    <div class="stat"><span class="stat-dot" style="background:#1565C0"></span>{stats['total_nodes']} 节点</div>
    <div class="stat"><span class="stat-dot" style="background:#90A4AE"></span>{stats['total_edges']} 链接</div>
    <div class="stat"><span class="stat-dot" style="background:#4CAF50"></span>{stats['files_processed']} 文件</div>
  </div>
</header>

<div class="search-box">
  🔍 <input type="text" id="search-input" placeholder="搜索节点..." />
</div>

<div id="info-panel">
  <h3 id="info-title">-</h3>
  <div class="meta" id="info-meta">-</div>
  <div id="info-summary">-</div>
  <div class="links" id="info-links"></div>
</div>

<div id="graph-container"></div>

<div class="legend">
  <div class="legend-title">📂 图例</div>
  <div class="legend-item"><span class="legend-icon" style="background:#E3F2BD;border:2px solid #1565C0"></span> 📥 来源 (Sources)</div>
  <div class="legend-item"><span class="legend-icon" style="background:#F3E5F5;border:2px solid #7B1FA2"></span> 👤 实体 (Entities)</div>
  <div class="legend-item"><span class="legend-icon" style="background:#E8F5E9;border:2px solid #2E7D32"></span> 💡 概念 (Concepts)</div>
  <div class="legend-item"><span class="legend-icon" style="background:#FFF3E0;border:2px solid #EF6C00"></span> ⚖️ 对比 (Comparisons)</div>
  <div class="legend-item"><span class="legend-icon" style="background:#FFEBEE;border:2px solid #C62828"></span> ⭐ 索引/日志</div>
</div>

<div class="controls">
  <button class="ctrl-btn" onclick="fitAll()">🎯 适应全部</button>
  <button class="ctrl-btn" onclick="togglePhysics()">⚡ 物理模拟</button>
  <button class="ctrl-btn" onclick="clusterByCategory()">📁 按类别聚类</button>
</div>

<script>
const nodes = new vis.DataSet({nodes_json});
const edges = new vis.DataSet({edges_json});

const container = document.getElementById('graph-container');
const options = {{
  physics: {{
    enabled: true,
    stabilization: {{ iterations: 150, fit: true }},
    barnesHut: {{
      gravitationalConstant: -2500,
      springConstant: 0.04,
      damping: 0.09,
      avoidOverlap: 0.5
    }}
  }},
  interaction: {{
    hover: true,
    tooltipDelay: 200,
    hideEdgesOnDrag: false,
    multiselect: true,
  }},
  nodes: {{
    font: {{ multi: false }},
    borderWidthSelected: 3,
    shadow: {{ enabled: true, color: 'rgba(0,0,0,0.2)', size: 10 }},
  }},
  edges: {{
    selectionWidth: 2,
    smooth: {{ forceDirection: 'none' }},
  }},
  layout: {{
    improvedLayout: true,
    clusterThreshold: 150,
  }}
}};

const network = new vis.Network(container, {{ nodes, edges }}, options);

// ── Event handlers ──
network.on("selectNode", function(params) {{
  if (params.nodes.length === 1) {{
    const nodeId = params.nodes[0];
    const node = nodes.get(nodeId);
    showInfo(node);
  }}
}});

network.on("deselectNode", function() {{
  document.getElementById('info-panel').classList.remove('visible');
}});

function showInfo(node) {{
  const panel = document.getElementById('info-panel');
  document.getElementById('info-title').textContent = node.label || nodeId;
  document.getElementById('info-meta').textContent = node.category + ' | 连接度: ' + (node.degree || 0);
  document.getElementById('info-summary').innerHTML = (node.title || '').replace(/\\n/g, '<br>');
  panel.classList.add('visible');
}}

// ── Controls ──
function fitAll() {{ network.fit({{ animation: {{ duration: 500, easingFunction: 'easeInOutQuad' }} }}); }}
let physicsEnabled = true;
function togglePhysics() {{
  physicsEnabled = !physicsEnabled;
  network.setOptions({{ physics: {{ enabled: physicsEnabled }} }});
}}
function clusterByCategory() {{
  network.fit({{ animation: {{ duration: 800 }} }});
}}

// ── Search ──
document.getElementById('search-input').addEventListener('input', function(e) {{
  const query = e.target.value.toLowerCase().trim();
  if (!query) {{
    nodes.update(nodes.map(n => ({{ id: n.id, hidden: false }})));
    return;
  }}
  const matched = nodes.getIds().filter(id => {{
    const n = nodes.get(id);
    return (n.label || '').toLowerCase().includes(query) || 
           (n.title || '').toLowerCase().includes(query) ||
           id.toLowerCase().includes(query);
  }});
  const unmatched = nodes.getIds().filter(id => !matched.includes(id));
  nodes.update(matched.map(id => ({{ id, hidden: false }})));
  nodes.update(unmatched.map(id => ({{ id, hidden: true }})));
  edges.update(edges.map(e => ({{
    id: e.id, 
    hidden: !matched.includes(e.from) || !matched.includes(e.to)
  }})));
}});

// ── Auto-fit on load ──
network.once("stabilizationIterationsDone", function() {{
  network.fit({{ animation: {{ duration: 600 }} }});
}});
</script>
</body>
</html>'''
    
    # Ensure output directory exists
    out_dir = os.path.dirname(output_path)
    os.makedirs(out_dir, exist_ok=True)
    
    # Write with explicit UTF-8 encoding (no BOM for HTML — charset meta tag handles it)
    with open(output_path, "w", encoding="utf-8", newline='\n') as f:
        f.write(html)
    
    # Also write raw JSON data for external tool consumption
    json_output = output_path.replace('.html', '.json')
    with open(json_output, "w", encoding="utf-8") as f:
        json.dump(graph_data, f, ensure_ascii=False, indent=2)


def print_stats(stats: dict):
    """Print detailed node statistics to console"""
    log("")
    log("=" * 50)
    log("📊 知识图谱统计信息")
    log("=" * 50)
    log(f"  节点总数:     {stats['total_nodes']}")
    log(f"  关系总数:     {stats['total_edges']}")
    log(f"  处理文件数:   {stats['files_processed']}")
    log("")
    log("📂 分类详情:")
    
    cat_labels = {
        "sources": "📥 来源 (Sources)",
        "entities": "👤 实体 (Entities)",
        "concepts": "💡 概念 (Concepts)",
        "comparisons": "⚖️ 对比 (Comparisons)",
        "_special": "⭐ 索引/日志",
    }
    
    # Sort by count descending
    sorted_cats = sorted(stats["categories"].items(), key=lambda x: -x[1])
    for cat, count in sorted_cats:
        label = cat_labels.get(cat, cat)
        bar = "█" * count + "░" * max(0, stats['total_nodes'] - count)
        log(f"  {label:30s} {count:4d}  {bar}")
    
    log("")
    log("=" * 50)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Jerry's Wiki Knowledge Graph Builder (M2)")
    parser.add_argument("--wiki-dir", default=DEFAULT_WIKI_DIR, help="Wiki root directory")
    parser.add_argument("--output", default=DEFAULT_OUTPUT, help="Output HTML path")
    parser.add_argument("--incremental", "-i", action="store_true",
                        help="Incremental mode: skip rebuild if no files changed")
    args = parser.parse_args()
    
    log("🕸️ 开始构建知识图谱...")
    if args.incremental:
        log("📋 增量更新模式已启用")
    
    start_time = time.time()
    graph_data = build_graph(args.wiki_dir, incremental=args.incremental)
    elapsed = time.time() - start_time
    
    # Check if skipped (no changes in incremental mode)
    if graph_data.get("skipped"):
        log(f"⏭️ 跳过构建（{graph_data['reason']}），耗时 {elapsed:.2f}s")
    else:
        generate_html(graph_data, args.output)
        print_stats(graph_data["stats"])
        log(f"✅ 完成！耗时 {elapsed:.2f}s")
        log(f"📄 HTML 输出: {args.output}")
        log(f"📄 JSON 数据: {args.output.replace('.html', '.json')}")
