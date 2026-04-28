#!/usr/bin/env python3
"""
Jerry Wiki Vector Store — 基于智谱 embedding-3 的语义检索
用法:
  python3 vector_store.py build    # 对所有 wiki 页面建索引
  python3 vector_store.py query "AI Agent"  # 语义查询
  python3 vector_store.py stats   # 查看索引状态
"""
import os, sys, json, glob, hashlib
from pathlib import Path

WIKI_DIR = Path(__file__).parent.parent / "wiki"
INDEX_FILE = WIKI_DIR / ".vector-index.json"
EMBED_CACHE = WIKI_DIR / ".embed-cache.json"

# ====== Embedding ======
def get_embedding(text: str, api_key: str = None) -> list:
    """调用智谱 embedding-3 API 获取向量"""
    import urllib.request, urllib.error
    
    key = api_key or os.environ.get("ZHIPUAI_API_KEY", "")
    if not key:
        # 尝试从 openclaw 配置读取
        cfg_path = Path.home() / ".openclaw" / "config.yaml"
        if cfg_path.exists():
            import yaml
            try:
                cfg = yaml.safe_load(cfg_path.read_text())
                key = cfg.get("zhipu", {}).get("apiKey", "") or cfg.get("providers", {}).get("zhipu", {}).get("apiKey", "")
            except: pass
    
    if not key:
        print("⚠️ 未找到 ZHIPUAI_API_KEY，请设置环境变量或在 .env 中配置")
        return None
    
    url = "https://open.bigmodel.cn/api/paas/v4/embeddings"
    payload = json.dumps({
        "model": "embedding-3",
        "input": text[:8000],  # 截断过长文本
        "dimensions": 1024
    }).encode()
    
    req = urllib.request.Request(url, data=payload, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {key}"
    })
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            return data["data"][0]["embedding"]
    except Exception as e:
        print(f"⚠️ Embedding API 错误: {e}")
        return None

# ====== 文件扫描 ======
def scan_wiki_files() -> list:
    """扫描所有 wiki markdown 文件，返回 (path, content, meta) 列表"""
    files = []
    for md_file in sorted(WIKI_DIR.rglob("*.md")):
        # 跳过隐藏文件和特殊文件
        if any(p.startswith(".") for p in md_file.parts):
            continue
        
        text = md_file.read_text(encoding="utf-8", errors="ignore")
        if len(text.strip()) < 50:  # 跳过太短的文件
            continue
        
        # 提取 frontmatter 之后的正文用于 embedding
        body = text
        if text.startswith("---"):
            parts = text.split("---", 2)
            if len(parts) >= 3:
                body = parts[2].strip()
        
        # 截取前 2000 字符作为 embedding 内容（标题+摘要+关键内容）
        embed_text = body[:2000]
        
        rel_path = str(md_file.relative_to(WIKI_DIR))
        files.append({
            "path": rel_path,
            "full_path": str(md_file),
            "title": md_file.stem,
            "body": body,
            "embed_text": embed_text,
            "size": len(text),
            "category": rel_path.split("/")[0] if "/" in rel_path else "root"
        })
    
    return files

# ====== Build Index ======
def build_index(force=False):
    """构建/更新向量索引"""
    print(f"📚 扫描 Wiki 目录: {WIKI_DIR}")
    files = scan_wiki_files()
    print(f"📊 找到 {len(files)} 个页面")
    
    # 加载已有缓存
    cache = {}
    if EMBED_CACHE.exists() and not force:
        cache = json.loads(EMBED_CACHE.read_text())
    
    index = []
    new_count = 0
    cache_count = 0
    
    for i, f in enumerate(files):
        # 用文件路径+大小+修改时间做 hash 判断是否需要重新 embedding
        file_hash = hashlib.md5(f"{f['path']}:{f['size']}".encode()).hexdigest()
        
        if file_hash in cache and not force:
            index.append({**f, "embedding": cache[file_hash], "_hash": file_hash})
            cache_count += 1
        else:
            print(f"  [{i+1}/{len(files)}] Embedding: {f['path']} ...", end=" ", flush=True)
            emb = get_embedding(f["embed_text"])
            if emb:
                f["embedding"] = emb
                f["_hash"] = file_hash
                index.append(f)
                cache[file_hash] = emb
                new_count += 1
                print("✅")
            else:
                print("❌ 跳过")
        
        # 每 10 个保存一次缓存
        if (i + 1) % 20 == 0:
            EMBED_CACHE.write_text(json.dumps(cache))
    
    # 保存最终结果
    EMBED_CACHE.write_text(json.dumps(cache))
    INDEX_FILE.write_text(json.dumps(index, ensure_ascii=False, indent=2))
    
    print(f"\n✅ 索引构建完成!")
    print(f"  新增: {new_count} | 缓存: {cache_count} | 总计: {len(index)}")
    print(f"  索引文件: {INDEX_FILE} ({INDEX_FILE.stat().st_size / 1024:.1f} KB)")
    print(f"  缓存文件: {EMBED_CACHE} ({EMBED_CACHE.stat().st_size / 1024:.1f} KB)")

# ====== Query ======
def query(text: str, top_k: int = 5, category_filter: str = None) -> list:
    """语义查询，返回最相关的页面"""
    if not INDEX_FILE.exists():
        print("❌ 索引不存在，请先运行: python3 vector_store.py build")
        return []
    
    index = json.loads(INDEX_FILE.read_text())
    if not index:
        print("❌ 索引为空")
        return []
    
    print(f"🔍 查询: \"{text}\"")
    query_emb = get_embedding(text)
    if not query_emb:
        return []
    
    # 余弦相似度
    def cosine_similarity(a, b):
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = sum(x * x for x in a) ** 0.5
        norm_b = sum(x * x for x in b) ** 0.5
        if norm_a == 0 or norm_b == 0: return 0
        return dot / (norm_a * norm_b)
    
    results = []
    for item in index:
        if category_filter and item.get("category") != category_filter:
            continue
        score = cosine_similarity(query_emb, item["embedding"])
        results.append({**item, "score": round(score, 4)})
    
    results.sort(key=lambda x: x["score"], reverse=True)
    top = results[:top_k]
    
    print(f"\n📋 Top {len(top)} 结果:\n")
    for r in top:
        cat_emoji = {"sources":"📄","entities":"🏷️","concepts":"💡","topics":"📑","root":"📁"}.get(r.get("category"), "📄")
        print(f"  {cat_emoji} [{r['score']:.3f}] {r['path']}")
        print(f"     ({r['size']} chars | {r['category']})")
        # 显示匹配到的关键词上下文
        body_preview = r.get("body", "")[:200].replace("\n", " ")
        print(f"     预览: {body_preview}...")
        print()
    
    return top

# ====== Stats ======
def show_stats():
    """显示索引统计"""
    if not INDEX_FILE.exists():
        print("❌ 索引不存在"); return
    
    index = json.loads(INDEX_FILE.read_text())
    categories = {}
    for item in index:
        c = item.get("category", "root")
        categories[c] = categories.get(c, 0) + 1
    
    print(f"📊 Vector Store 统计:")
    print(f"  总页面数: {len(index)}")
    print(f"  索引大小: {INDEX_FILE.stat().st_size / 1024:.1f} KB")
    print(f"  缓存大小: {EMBED_CACHE.stat().st_size / 1024:.1f} KB" if EMBED_CACHE.exists() else "")
    print(f"\n  按分类:")
    for c, cnt in sorted(categories.items(), key=lambda x: -x[1]):
        emoji = {"sources":"📄","entities":"🏷️","concepts":"💡","topics":"📑","root":"📁"}.get(c, "📁")
        print(f"    {emoji} {c}: {cnt}")

# ====== Main ======
if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "stats"
    
    if cmd == "build":
        build_index("--force" in sys.argv)
    elif cmd == "query":
        q = " ".join(sys.argv[2:])
        if not q:
            print("用法: python3 vector_store.py query \"搜索内容\"")
        else:
            query(q)
    elif cmd == "stats":
        show_stats()
    else:
        print(__doc__)
