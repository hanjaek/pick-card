const router = require('express').Router()
const fs     = require('fs')
const path   = require('path')

const RAG_URL    = process.env.RAG_URL || 'http://localhost:8000'
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

function parseIdCardText(text) {
  const fullText = text.replace(/\r/g, '')
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)

  let name = null
  let birthdate = null
  let idNumber = null
  let issueDate = null

  // 주민등록번호: 6자리 + 구분자 + 7자리 (공백/하이픈/대시 허용, 붙어있어도 가능)
  const idPatterns = [
    /(\d{6})\s*[-–—]\s*(\d{7})/,
    /(\d{6})\s*[-–—]\s*(\d)\s*\d{6}/,
    /(\d{6})[-–—]?(\d{7})/,
  ]
  for (const line of lines) {
    if (idNumber) break
    for (const pat of idPatterns) {
      const m = line.match(pat)
      if (m) {
        const front = m[1]
        const backFirst = m[2].length === 7 ? m[2][0] : m[2]
        idNumber = `${front}-${backFirst}******`
        const yy = front.slice(0, 2)
        const mm = front.slice(2, 4)
        const dd = front.slice(4, 6)
        const century = ['1', '2'].includes(backFirst) ? '19' : '20'
        birthdate = `${century}${yy}-${mm}-${dd}`
        break
      }
    }
  }

  // 이름: 주민번호가 있는 줄의 바로 윗줄에서 한글 이름 추출
  const exclude = ['주민등록증', '대한민국', '운전면허증', '주민등록', '면허증',
                   '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
                   '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
                   '특별시', '광역시', '특별자치', '적성검사', '기간', '통일', '조회']

  // 1차: 주민번호 줄 기준으로 위쪽에서 이름 찾기
  let idLineIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/\d{6}\s*[-–—]?\s*\d/)) { idLineIdx = i; break }
  }
  if (idLineIdx > 0) {
    for (let i = idLineIdx - 1; i >= 0; i--) {
      const words = lines[i].split(/\s+/)
      for (const w of words) {
        const m = w.match(/^([가-힣]{2,5})$/)
        if (m && !exclude.some(e => m[1].includes(e))) {
          name = m[1]
          break
        }
      }
      if (name) break
    }
  }

  // 2차 fallback: 전체 줄에서 한글 2~4자 단어 찾기 (주소/키워드 제외)
  if (!name) {
    for (const line of lines) {
      if (name) break
      const words = line.split(/\s+/)
      for (const w of words) {
        const m = w.match(/^([가-힣]{2,4})$/)
        if (m && !exclude.some(e => m[1].includes(e))) {
          name = m[1]
          break
        }
      }
    }
  }

  // 발급일: YYYY.MM.DD 또는 YYYY-MM-DD
  for (const line of lines) {
    if (issueDate) break
    const dateMatch = line.match(/(20\d{2})[.\-/\s](\d{1,2})[.\-/\s](\d{1,2})/)
    if (dateMatch) {
      issueDate = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`
    }
  }

  return { name, birthdate, idNumber, issueDate }
}

// OCR 서비스가 없거나 인식 실패해도 회원가입은 진행 — 직접 입력으로 폴백
function manualFallback(res, message) {
  return res.json({
    success: true, fallback: true,
    name: '', birthdate: '', idNumber: '', issueDate: '',
    message: message || '신분증 자동 인식이 어려워요. 정보를 직접 확인·입력해주세요.',
    demo: true,
  })
}

router.post('/id-card', async (req, res) => {
  const { image } = req.body
  if (!image) return res.status(400).json({ message: '신분증 이미지가 필요합니다.' })

  let tmpPath = null

  try {
    // base64 → 임시 파일 저장
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const fileName = `id-verify-${Date.now()}.jpg`
    tmpPath = path.join(UPLOAD_DIR, fileName)
    fs.writeFileSync(tmpPath, Buffer.from(base64Data, 'base64'))

    // RAG OCR 서비스 호출
    const response = await fetch(`${RAG_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filepath: tmpPath }),
    })

    if (!response.ok) {
      throw new Error(`RAG OCR 응답 오류: ${response.status}`)
    }

    const data = await response.json()
    const ocrText = data.text || ''

    if (!ocrText.trim()) {
      return manualFallback(res, '신분증에서 텍스트를 인식하지 못했어요. 정보를 직접 입력해주세요.')
    }

    const parsed = parseIdCardText(ocrText)

    if (!parsed.name && !parsed.idNumber) {
      return manualFallback(res, '신분증 정보를 자동으로 읽지 못했어요. 정보를 직접 입력해주세요.')
    }

    res.json({
      success: true,
      name: parsed.name || '',
      birthdate: parsed.birthdate || '',
      idNumber: parsed.idNumber || '',
      issueDate: parsed.issueDate || '',
      message: '신분증 확인이 완료되었습니다.',
      demo: false,
    })
  } catch (err) {
    console.error('[verify POST /id-card]', err.message)
    // OCR 서비스(RAG :8000) 미실행/오류 → 회원가입 막지 않고 수동 입력으로 폴백
    return manualFallback(res, '신분증 자동 인식 서비스에 연결하지 못했어요. 정보를 직접 입력해주세요.')
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath)
    }
  }
})

module.exports = router
