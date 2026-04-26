"""
RAG Service — PDF Upload, Storage, and Semantic Search
Disk persistence: docs survive restarts via uploaded_docs.json
"""
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os, re, json, math, hashlib, time
from collections import Counter

app = FastAPI(title="AIPA RAG Service", version="2.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# Use /data (Render persistent disk) in production, local dir otherwise
_data_dir = "/data" if os.path.isdir("/data") else os.path.dirname(__file__)
PERSIST_FILE = os.path.join(_data_dir, "uploaded_docs.json")

# ── Vector Store ────────────────────────────────────────────────────────
class VectorStore:
    def __init__(self):
        self.docs: list[dict] = []
        self._load()

    def _load(self):
        if os.path.exists(PERSIST_FILE):
            try:
                with open(PERSIST_FILE, encoding="utf-8") as f:
                    saved = json.load(f)
                self.docs = saved
                pdfs = sum(1 for d in self.docs if d.get("metadata", {}).get("source") == "pdf")
                print(f"Loaded {len(self.docs)} docs ({pdfs} PDF chunks)")
            except Exception as e:
                print(f"Load error: {e}")

    def _save(self):
        try:
            with open(PERSIST_FILE, "w", encoding="utf-8") as f:
                json.dump(self.docs, f, ensure_ascii=False)
        except Exception as e:
            print(f"Save error: {e}")

    def _tokens(self, text: str) -> Counter:
        return Counter(re.findall(r"\b[a-z]{2,}\b", text.lower()))

    def _cosine(self, a: Counter, b: Counter) -> float:
        common = set(a) & set(b)
        if not common: return 0.0
        dot  = sum(a[k] * b[k] for k in common)
        norm = math.sqrt(sum(v*v for v in a.values())) * math.sqrt(sum(v*v for v in b.values()))
        return dot / norm if norm else 0.0

    def add(self, content: str, metadata: dict):
        self.docs.append({"content": content, "metadata": metadata})

    def query(self, query: str, top_k: int = 5, pdf_only: bool = False) -> list[dict]:
        q = self._tokens(query)
        results = []
        for doc in self.docs:
            if pdf_only and doc.get("metadata", {}).get("source") != "pdf":
                continue
            score = self._cosine(q, self._tokens(doc["content"]))
            results.append({**doc, "score": score})
        results.sort(key=lambda x: x["score"], reverse=True)
        if pdf_only:
            return results[:top_k]  # No score filter for PDF queries
        return [r for r in results if r["score"] > 0.01][:top_k]

    @property
    def pdf_count(self) -> int:
        return sum(1 for d in self.docs if d.get("metadata", {}).get("source") == "pdf")

    def get_pdfs(self) -> list[dict]:
        seen: set = set()
        out = []
        for d in self.docs:
            if d.get("metadata", {}).get("source") == "pdf":
                fn = d["metadata"].get("filename", "unknown")
                if fn not in seen:
                    seen.add(fn)
                    out.append({
                        "id": hashlib.md5(fn.encode()).hexdigest()[:12],
                        "filename": fn,
                        "source": "pdf",
                        "total_pages": int(d["metadata"].get("total_pages", 0)),
                    })
        return out

store = VectorStore()

# ── PDF Parsing ─────────────────────────────────────────────────────────
def parse_pdf(data: bytes) -> tuple[str, int]:
    try:
        import PyPDF2, io
        reader = PyPDF2.PdfReader(io.BytesIO(data))
        pages = [p.extract_text() or "" for p in reader.pages]
        return "\n\n".join(p.strip() for p in pages if p.strip()), len(reader.pages)
    except Exception as e:
        raise HTTPException(500, f"PDF parse failed: {e}")

def chunk_text(text: str, size: int = 1200, overlap: int = 150) -> list[str]:
    if len(text) <= size:
        return [text]
    chunks, start = [], 0
    while start < len(text):
        chunk = text[start:start + size].strip()
        if chunk:
            chunks.append(chunk)
        start += size - overlap
    return chunks

# ── Routes ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {
        "status": "ok", "service": "rag-service",
        "document_count": len(store.docs),
        "pdf_document_count": store.pdf_count,
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

@app.post("/upload")
async def upload_pdf(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(400, "Only PDF files supported")
    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "Max file size is 20MB")

    text, num_pages = parse_pdf(data)
    if not text.strip():
        raise HTTPException(400, "Could not extract text from PDF")

    chunks = chunk_text(text)
    meta_base = {"source": "pdf", "filename": file.filename, "total_pages": str(num_pages)}

    # Store a full summary chunk for broad queries
    store.add(text[:2000].strip(), {**meta_base, "chunk_type": "summary"})
    for i, chunk in enumerate(chunks):
        store.add(chunk, {**meta_base, "chunk_index": str(i)})
    store._save()

    total = len(chunks) + 1
    return {"success": True, "filename": file.filename, "pages": num_pages, "chunks_indexed": total}

class QueryReq(BaseModel):
    query: str
    top_k: int = 5
    pdf_only: bool = False

@app.post("/query")
async def query(req: QueryReq):
    results = store.query(req.query, req.top_k, req.pdf_only)
    return {"success": True, "contexts": results, "total_results": len(results)}

@app.get("/documents")
async def list_documents():
    return {"success": True, "documents": store.get_pdfs()}
