import os
import httpx
import chromadb
import anthropic
import groq
from google import genai
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
from dotenv import load_dotenv
import pytesseract
from PIL import Image

# .env 파일에서 환경 변수를 불러옵니다 (API 키 등)
load_dotenv()

# FastAPI 애플리케이션 초기화 (API 문서 제목 설정)
app = FastAPI(title="Pickard RAG Service")

# Node.js 백엔드 서버의 주소 설정 (기본값: http://localhost:4000)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:4000")

# 글로벌 변수 선언: 앱 시작 후 임베딩 모델과 DB 클라이언트를 한 번만 로드하여 재사용하기 위함
_embedder = None
_chroma_client = None


def get_embedder() -> SentenceTransformer:
    """
    텍스트를 벡터(숫자 배열)로 변환해 주는 임베딩 모델을 반환합니다.
    (jhgan/ko-sroberta-multitask 모델 사용: 한국어 문장 임베딩에 탁월함)
    """
    global _embedder
    if _embedder is None:
        _embedder = SentenceTransformer("jhgan/ko-sroberta-multitask")
    return _embedder


def get_collection():
    """
    로컬 벡터 데이터베이스인 ChromaDB의 컬렉션(테이블 역할)을 반환합니다.
    './chroma_db' 폴더에 데이터를 영구 저장하며, 'cards'라는 이름의 컬렉션을 사용합니다.
    """
    global _chroma_client
    if _chroma_client is None:
        _chroma_client = chromadb.PersistentClient(path="./chroma_db")
    return _chroma_client.get_or_create_collection("cards")


def card_to_doc(card: dict) -> str:
    """
    카드 데이터(JSON/dict)를 하나의 긴 문자열(텍스트 문서)로 변환합니다.
    이 텍스트가 임베딩되어 벡터 DB에 저장되며, 이후 검색의 기준이 됩니다.
    """
    benefits = card.get("benefits") or []
    # 혜택 정보들을 ' | ' 로 연결하여 하나의 문자열로 만듦
    benefit_text = " | ".join(b.get("desc", "") for b in benefits if b.get("desc"))
    return (
        f"카드명: {card.get('name', '')} "
        f"종류: {card.get('type', '')} "
        f"연회비: {card.get('annualFee', 0)}원 "
        f"브랜드: {card.get('brand', '')} "
        f"특징: {card.get('productFeature', '')} "
        f"혜택: {benefit_text}"
    )


# ── 데이터 모델 정의 (요청/응답 스키마) ──────────────────────────────

class RecommendRequest(BaseModel):
    query: str              # 사용자의 질문 (예: "주유 할인되는 카드 추천해줘")
    model: str = "groq"     # 사용할 AI 모델 (기본값: groq)
    top_k: int = 5          # 검색할 추천 카드의 개수 (기본값: 5개)

class OCRRequest(BaseModel):
    filepath: str           # 분석할 이미지 파일의 절대 경로


# ── 1. 인덱싱 (데이터베이스에 카드 정보 저장) ─────────────────────────

@app.post("/index")
async def index_cards():
    """
    Node.js 백엔드 서버에서 전체 카드 목록을 가져와서(GET /api/cards),
    임베딩 모델을 통해 벡터로 변환한 뒤 ChromaDB에 저장하는 엔드포인트입니다.
    """
    # 백엔드 서버로부터 카드 데이터 요청
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{BACKEND_URL}/api/cards")
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="카드 데이터 로드 실패")
        cards = r.json()

    if not cards:
        raise HTTPException(status_code=404, detail="인덱싱할 카드가 없습니다")

    embedder = get_embedder()
    collection = get_collection()

    # 각 카드를 문서(텍스트)로 변환
    docs      = [card_to_doc(c) for c in cards]
    # 변환된 문서들을 벡터(숫자 배열)로 인코딩
    embeddings = embedder.encode(docs).tolist()
    # 고유 ID 및 추가 메타데이터(화면에 보여줄 정보) 준비
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

    # ChromaDB에 데이터 삽입 또는 업데이트 (upsert)
    collection.upsert(
        documents=docs,
        embeddings=embeddings,
        ids=ids,
        metadatas=metadatas,
    )
    return {"indexed": len(cards), "message": f"{len(cards)}개 카드 인덱싱 완료"}


# ── 2. 추천 (RAG 기반 질문 답변) ──────────────────────────────────────

@app.post("/recommend")
async def recommend(req: RecommendRequest):
    """
    사용자의 질문을 벡터로 변환하여 ChromaDB에서 가장 유사한 카드를 검색(Retrieval)하고,
    검색된 정보를 바탕으로 LLM(거대 언어 모델)이 추천 답변을 생성(Generation)합니다.
    """
    collection = get_collection()
    if collection.count() == 0:
        raise HTTPException(status_code=400, detail="먼저 POST /index 를 호출해 카드를 인덱싱하세요")

    # [1단계] 사용자 질문(query) 임베딩 및 가장 유사한 카드(top-k) 검색
    embedder  = get_embedder()
    q_embed   = embedder.encode([req.query]).tolist()
    results   = collection.query(
        query_embeddings=q_embed,
        n_results=min(req.top_k, collection.count()),
    )

    docs  = results["documents"][0]
    metas = results["metadatas"][0]
    
    # 검색된 카드 정보들을 하나의 문자열 문맥(Context)으로 결합
    context = "\n".join(f"- {d}" for d in docs)

    # LLM에게 지시할 시스템 프롬프트(역할 부여 및 맥락 제공)
    system_prompt = f"""당신은 BNK 부산은행 카드 추천 전문가입니다.
아래 검색된 카드 정보를 바탕으로 사용자 상황에 맞는 카드를 추천하고 이유를 설명하세요.
항상 한국어로 친절하게 답하고, 구체적인 혜택을 근거로 설명하세요.

검색된 카드 정보:
{context}"""

    # [2단계] 선택된 LLM(Groq, Gemini, Claude)을 호출하여 최종 답변 생성
    if req.model == "groq":
        # 완전 무료이면서 매우 빠른 Groq API (Llama 3 모델) 사용
        groq_key = os.getenv("GROQ_API_KEY")
        if not groq_key:
            raise HTTPException(status_code=500, detail="GROQ_API_KEY 환경변수가 없습니다")
        client = groq.Groq(api_key=groq_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": req.query}
            ],
            max_tokens=1024,
            temperature=0.7
        )
        answer = response.choices[0].message.content

    elif req.model == "gemini":
        # 구글 Gemini API 사용
        google_key = os.getenv("GOOGLE_API_KEY")
        if not google_key:
            raise HTTPException(status_code=500, detail="GOOGLE_API_KEY 환경변수가 없습니다")
        try:
            client = genai.Client(api_key=google_key)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=req.query,
                config=genai.types.GenerateContentConfig(
                    system_instruction=system_prompt,
                )
            )
            answer = response.text
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg or "RESOURCE_EXHAUSTED" in error_msg:
                raise HTTPException(status_code=429, detail="구글 Gemini API의 무료 제공량(Quota)이 초과되었거나 해당 계정/지역에서 사용할 수 없습니다.")
            raise HTTPException(status_code=500, detail=f"Gemini API 호출 중 에러가 발생했습니다: {error_msg}")

    else:
        # Anthropic Claude API 사용 (기본값 대응)
        claude_key = os.getenv("ANTHROPIC_API_KEY")
        if not claude_key:
            raise HTTPException(status_code=500, detail="ANTHROPIC_API_KEY 환경변수가 없습니다")
        claude = anthropic.Anthropic(api_key=claude_key)
        response = claude.messages.create(
            model="claude-opus-4-8", # 현재 적용된 모델명
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": req.query}],
        )
        answer = response.content[0].text

    # 모델이 생성한 추천 답변과, 참고한 카드 메타데이터를 프론트엔드로 반환
    return {
        "model": req.model,
        "recommendation": answer,
        "retrieved_cards": metas,
    }


# ── 3. 헬스체크 ──────────────────────────────────────────────────────────

@app.get("/health")
def health():
    """서버가 정상적으로 띄워졌는지, 그리고 DB에 몇 개의 카드가 인덱싱되었는지 확인합니다."""
    collection = get_collection()
    return {"status": "ok", "indexed_cards": collection.count()}


# ── 4. OCR (신분증/문서 인식) ─────────────────────────────────────────────

@app.post("/ocr")
def perform_ocr(req: OCRRequest):
    """
    서버에 저장된 이미지 파일의 경로를 받아, 
    Tesseract 오픈소스 OCR 엔진을 사용하여 텍스트를 추출해 반환합니다.
    """
    try:
        if not os.path.exists(req.filepath):
            raise HTTPException(status_code=404, detail="이미지 파일을 찾을 수 없습니다.")
        
        # 한국어(kor)와 영어(eng)를 동시 인식하도록 lang="kor+eng" 설정
        # PIL.Image로 파일을 열어 pytesseract에 전달합니다.
        text = pytesseract.image_to_string(Image.open(req.filepath), lang="kor+eng")
        
        # 추출된 텍스트의 앞뒤 공백을 제거하고 응답합니다.
        return {"text": text.strip()}
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

