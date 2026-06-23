import os
import httpx
import chromadb
import anthropic
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Pickard RAG Service")

BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000")

# 앱 시작 시 한 번만 로드
_embedder: SentenceTransformer | None = None
_chroma_client: chromadb.PersistentClient | None = None


def get_embedder() -> SentenceTransformer:
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer("jhgan/ko-sroberta-multitask")
    return _embedder


def get_collection():
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path="./chroma_db")
    return _chroma_client.get_or_create_collection("cards")


def card_to_doc(card: dict) -> str:
    benefits = card.get("benefits") or []
    benefit_text = " | ".join(b.get("desc", "") for b in benefits if b.get("desc"))
    return (
        f"카드명: {card.get('name', '')} "
        f"종류: {card.get('type', '')} "
        f"연회비: {card.get('annualFee', 0)}원 "
        f"브랜드: {card.get('brand', '')} "
        f"특징: {card.get('productFeature', '')} "
        f"혜택: {benefit_text}"
    )


class RecommendRequest(BaseModel):
    query: str
    model: str = "claude"   # "claude" | "gemini"
    top_k: int = 5


# ── 인덱싱 ─────────────────────────────────────────────────────────────────

@app.post("/index")
async def index_cards():
    """Express 서버에서 카드 목록을 받아 ChromaDB에 임베딩 저장"""
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BACKEND_URL}/api/cards")
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="카드 데이터 로드 실패")
        cards = r.json()

    if not cards:
        raise HTTPException(status_code=404, detail="인덱싱할 카드가 없습니다")

    embedder = get_embedder()
    collection = get_collection()

    docs      = [card_to_doc(c) for c in cards]
    embeddings = embedder.encode(docs).tolist()
    ids        = [str(c["id"]) for c in cards]
    metadatas  = [
        {
            "id":        str(c.get("id", "")),
            "name":      c.get("name", ""),
            "type":      c.get("type", ""),
            "annualFee": str(c.get("annualFee", 0)),
            "brand":     c.get("brand", ""),
        }
        for c in cards
    ]

    collection.upsert(
        documents=docs,
        embeddings=embeddings,
        ids=ids,
        metadatas=metadatas,
    )
    return {"indexed": len(cards), "message": f"{len(cards)}개 카드 인덱싱 완료"}


# ── 추천 ─────────────────────────────────────────────────────────────────

@app.post("/recommend")
async def recommend(req: RecommendRequest):
    """벡터 검색으로 관련 카드를 찾고 LLM이 추천 설명을 생성"""
    collection = get_collection()
    if collection.count() == 0:
        raise HTTPException(status_code=400, detail="먼저 POST /index 를 호출해 카드를 인덱싱하세요")

    # 1. 쿼리 임베딩 → top-k 검색
    embedder  = get_embedder()
    q_embed   = embedder.encode([req.query]).tolist()
    results   = collection.query(
        query_embeddings=q_embed,
        n_results=min(req.top_k, collection.count()),
    )

    docs  = results["documents"][0]
    metas = results["metadatas"][0]
    context = "\n".join(f"- {d}" for d in docs)

    system_prompt = f"""당신은 BNK 부산은행 카드 추천 전문가입니다.
아래 검색된 카드 정보를 바탕으로 사용자 상황에 맞는 카드를 추천하고 이유를 설명하세요.
항상 한국어로 친절하게 답하고, 구체적인 혜택을 근거로 설명하세요.

검색된 카드 정보:
{context}"""

    # 2. LLM 호출 (모델 선택)
    if req.model == "gemini":
        google_key = os.getenv("GOOGLE_API_KEY")
        if not google_key:
            raise HTTPException(status_code=500, detail="GOOGLE_API_KEY 환경변수가 없습니다")
        genai.configure(api_key=google_key)
        gemini = genai.GenerativeModel(
            model_name="gemini-2.0-flash",
            system_instruction=system_prompt,
        )
        response = gemini.generate_content(req.query)
        answer = response.text

    else:  # claude (기본값)
        claude_key = os.getenv("ANTHROPIC_API_KEY")
        if not claude_key:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY 환경변수가 없습니다")
        claude = anthropic.Anthropic(api_key=claude_key)
        response = claude.messages.create(
            model="claude-opus-4-8",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": req.query}],
        )
        answer = response.content[0].text

    return {
        "model": req.model,
        "recommendation": answer,
        "retrieved_cards": metas,
    }


# ── 헬스체크 ─────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    collection = get_collection()
    return {"status": "ok", "indexed_cards": collection.count()}
