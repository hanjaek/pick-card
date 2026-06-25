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

  // 이름 추출
  const excludeExact = new Set([
    '주민등록증', '대한민국', '운전면허증', '주민등록', '면허증', '자동차',
    '특별시', '광역시', '특별자치', '적성검사', '경찰청장', '경찰서장',
    '종보통', '종대형', '종소형', '종수동', '종보동', '종수령',
    // 구/동/로/시 등 주소 단어
    '서구', '동구', '남구', '북구', '중구', '달서', '수성', '달성',
    '해운대', '사하', '금정', '연제', '수영', '사상', '강서',
    '서대문', '동대문', '성동', '광진', '성북', '강북', '도봉', '노원',
    '은평', '마포', '양천', '강남', '서초', '송파', '강동', '관악', '구로', '금천',
    '영등포', '동작', '용산', '종로', '중랑',
    '미근동', '통일로',
  ])
  const excludePartial = [
    '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종',
    '경기', '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
    '통일', '조회', '기간', '발급', '검사', '특수', '보통', '수동',
    '면허', '도로', '교통', '안전', '공단', '경찰',
    '특별', '광역', '청장',
  ]

  const SURNAMES = '김이박최정강조윤장임한오서신권황안송류전홍고문양손배백허유남심노하곽성차주우구신임나전민유진지엄채원천방공강현함변염양변여추도소석선설마주길위표명기반왕금옥육인맹제모탁국어은편'
  const isNameCandidate = (w) => {
    if (w.length < 2 || w.length > 4) return false
    if (excludeExact.has(w)) return false
    if (excludePartial.some(e => w.includes(e))) return false
    if (/\d/.test(w)) return false
    if (/[()（）]/.test(w)) return false
    // 주소 패턴 제외 (4글자 이상 + 주소 접미사)
    if (w.length >= 3 && /[로길]$/.test(w)) return false
    if (w.length >= 4 && /대로$/.test(w)) return false
    // 2~3글자 + 성씨로 시작하면 이름으로 인정
    if (w.length <= 3 && SURNAMES.includes(w[0])) return true
    // 그 외 주소 접미사 제외
    if (/[구시군읍면]$/.test(w) && w.length >= 3) return false
    return true
  }

  // 1차: 주민번호 줄 기준으로 위 2줄 범위에서 이름 찾기
  let idLineIdx = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/\d{6}\s*[-–—]?\s*\d/)) { idLineIdx = i; break }
  }
  if (idLineIdx > 0) {
    const searchStart = Math.max(0, idLineIdx - 2)
    for (let i = idLineIdx - 1; i >= searchStart; i--) {
      const words = lines[i].split(/\s+/)
      for (const w of words) {
        const m = w.match(/([가-힣]{2,5})/)
        if (m && isNameCandidate(m[1])) {
          name = m[1]
          break
        }
      }
      if (name) break
    }
  }

  // 2차: 주민번호 줄 자체에서 한글 이름 찾기 (주민번호 앞에 이름이 붙는 경우)
  if (!name && idLineIdx >= 0) {
    const idLine = lines[idLineIdx]
    const beforeId = idLine.split(/\d{6}/)[0]
    const words = beforeId.split(/\s+/)
    for (const w of words) {
      const m = w.match(/([가-힣]{2,5})/)
      if (m && isNameCandidate(m[1])) {
        name = m[1]
        break
      }
    }
  }

  // 3차 fallback: 전체에서 검색
  if (!name) {
    for (const line of lines) {
      if (name) break
      const words = line.split(/\s+/)
      for (const w of words) {
        const m = w.match(/^([가-힣]{2,4})$/)
        if (m && isNameCandidate(m[1])) {
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

    // RAG OCR 서비스 호출 (도커 환경: /app/uploads → /tmp/bnk-uploads 변환)
    const ocrPath = tmpPath.replace('/app/uploads', '/tmp/bnk-uploads')
    const response = await fetch(`${RAG_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filepath: ocrPath }),
    })

    if (!response.ok) {
      throw new Error(`RAG OCR 응답 오류: ${response.status}`)
    }

    const data = await response.json()
    const ocrText = data.text || ''

    if (!ocrText.trim()) {
      return res.status(422).json({ success: false, message: '신분증에서 텍스트를 인식하지 못했습니다. 다시 촬영해주세요.' })
    }

    const parsed = parseIdCardText(ocrText)

    if (!parsed.idNumber) {
      return res.status(422).json({ success: false, message: '주민등록번호를 인식하지 못했습니다. 다시 촬영해주세요.' })
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

    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      return res.status(503).json({ success: false, message: 'OCR 서비스가 실행 중이지 않습니다. 관리자에게 문의해주세요.' })
    }

    res.status(500).json({ success: false, message: '신분증 인식 중 오류가 발생했습니다.' })
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath)
    }
  }
})

module.exports = router
