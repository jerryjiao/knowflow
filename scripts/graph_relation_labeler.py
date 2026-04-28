#!/usr/bin/env python3
"""
KnowFlow Graph Relation Labeler
Infers semantic relation types from wikilink context and updates graph.json
"""

import re, json, os
from pathlib import Path
from collections import defaultdict

WIKI_DIR = os.path.expanduser("~/Documents/openclaw/workspace/knowflow/wiki")
GRAPH_JSON = os.path.join(os.path.dirname(WIKI_DIR), "graph", "graph.json")

# ── Relation inference rules ──────────────────────────────

# Category-based default relations
CATEGORY_RELATIONS = {
    # source → entity: "cites" or "describes"
    ("sources", "entities"): "描述",
    ("sources", "concepts"): "阐述",
    ("sources", "comparisons"): "参考",
    ("sources", "sources"): "相关",
    # entity → concept: "implements" or "exemplifies"
    ("entities", "concepts"): "体现",
    ("entities", "entities"): "关联",
    ("entities", "sources"): "来源",
    # concept → entity: "applies_to" or "governs"
    ("concepts", "entities"): "适用于",
    ("concepts", "concepts"): "相关",
    ("concepts", "sources"): "引用",
    # comparison → others
    ("comparisons", "entities"): "对比",
    ("comparisons", "concepts"): "评估",
    ("comparisons", "sources"): "依据",
}

def detect_category(filepath):
    parts = Path(filepath).parts
    if len(parts) >= 2:
        parent = parts[-2]
        if parent in ["sources", "entities", "concepts", "comparisons"]:
            return parent
    stem = Path(filepath).stem.lower()
    if stem in ("index", "log", "overview"):
        return "_special"
    return "sources"

# Context-based relation refinement
CONTEXT_PATTERNS = [
    (r'(来源|来自|基于|引自|参考|参见)', "来源"),
    (r'(相关|关联|类似|同类|同属)', "关联"),
    (r'(对比|比较|vs\.?|versus)', "对比"),
    (r'(实现|使用|采用|应用|工具)', "使用"),
    (r'(属于|归类|分类|类型)', "属于"),
    (r'(替代|取代|替换)', "替代"),
    (r'(衍生|扩展|进化|发展)', "衍生"),
    (r'(姊妹|兄弟|姐妹项目)', "姊妹"),
    (r'(推荐|首选|建议)', "推荐"),
    (r'(创建者|作者|开发者|创始人)', "创建"),
    (r'(支持|兼容|集成|接入)', "支持"),
    (r'(竞争对手|竞品|对手)', "竞争"),
]

def infer_relation(from_path, to_path, from_content, all_categories):
    """Infer the most appropriate relation label for an edge."""
    from_cat = detect_category(from_path)
    to_cat = detect_category(to_path)
    
    # 1. Try category-based default
    default = CATEGORY_RELATIONS.get((from_cat, to_cat))
    
    # 2. Refine based on context around the wikilink
    link_target = Path(to_path).stem
    
    # Find the wikilink in content and check surrounding text
    pattern = r'\[\[' + re.escape(link_target) + r'([^\]]*)\]\]'
    matches = list(re.finditer(pattern, from_content))
    
    if matches:
        # Check context around each match (50 chars before/after)
        for m in matches:
            start = max(0, m.start() - 50)
            end = min(len(from_content), m.end() + 50)
            context = from_content[start:end]
            for pat, rel in CONTEXT_PATTERNS:
                if re.search(pat, context):
                    return rel
    
    # 3. Fall back to category default or generic
    return default or "链接"


def main():
    print("🏷️  开始为图谱边添加关系标签...")
    
    # Load existing graph
    with open(GRAPH_JSON, 'r', encoding='utf-8') as f:
        graph = json.load(f)
    
    # Read all wiki contents for context analysis
    wiki_path = Path(WIKI_DIR)
    contents = {}
    for md_file in wiki_path.rglob('*.md'):
        rel = str(md_file.relative_to(wiki_path))
        try:
            contents[rel] = md_file.read_text(encoding='utf-8')
        except:
            pass
    
    # Build category cache
    categories = {p: detect_category(p) for p in contents}
    
    # Process each edge
    updated = 0
    relation_counts = defaultdict(int)
    
    for edge in graph.get('edges', []):
        from_id = edge.get('from', '')
        to_id = edge.get('to', '')
        
        if not from_id or not to_id:
            continue
        
        from_content = contents.get(from_id, '')
        relation = infer_relation(from_id, to_id, from_content, categories)
        
        edge['relation'] = relation
        edge['title'] = f"{relation}"  # tooltip
        relation_counts[relation] += 1
        updated += 1
    
    # Also add relation info to node titles for better tooltips
    for node in graph.get('nodes', []):
        nid = node.get('id', '')
        cat = categories.get(nid, detect_category(nid))
        # Add Chinese category label
        cat_labels = {
            'sources': '📥 来源', 'entities': '👤 实体',
            'concepts': '💡 概念', 'comparisons': '⚖️ 对比',
            '_special': '⭐ 索引'
        }
        existing_title = node.get('title', '')
        if cat_labels.get(cat) and cat_labels[cat] not in existing_title:
            node['category_label'] = cat_labels[cat]
    
    # Save updated graph
    with open(GRAPH_JSON, 'w', encoding='utf-8') as f:
        json.dump(graph, f, ensure_ascii=False, indent=2)
    
    print(f"✅ 完成！更新了 {updated} 条边的关系标签")
    print(f"\n📊 关系分布:")
    for rel, count in sorted(relation_counts.items(), key=lambda x: -x[1]):
        bar = "█" * min(count, 40)
        print(f"  {rel:8s} {count:4d}  {bar}")
    
    # Stats
    total_edges = len(graph.get('edges', []))
    total_nodes = len(graph.get('nodes', []))
    
    # Count isolated nodes (degree 0)
    connected = set()
    for e in graph.get('edges', []):
        connected.add(e.get('from'))
        connected.add(e.get('to'))
    isolated = [n for n in graph.get('nodes', []) if n.get('id') not in connected]
    
    print(f"\n📈 图谱统计:")
    print(f"  总节点: {total_nodes}")
    print(f"  总边数: {total_edges}")
    print(f"  连接节点: {len(connected)}")
    print(f"  孤立节点: {len(isolated)} ({len(isolated)*100//max(total_nodes,1)}%)")
    
    if isolated:
        print(f"\n⚠️  孤立节点列表:")
        for n in isolated[:10]:
            print(f"  - {n.get('label', n.get('id'))} ({n.get('id')})")
        if len(isolated) > 10:
            print(f"  ... 还有 {len(isolated)-10} 个")

if __name__ == '__main__':
    main()
