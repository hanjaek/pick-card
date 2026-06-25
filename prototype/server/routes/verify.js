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

  // 이름: 한글 2~5자 (줄 전체 또는 줄 내 단독 한글 단어)
  const exclude = ['주민등록증', '대한민국', '운전면허증', '주민등록', '서울특별', '부산광역',
                   '경기도', '인천광역', '대구광역', '광주광역', '대전광역', '울산광역', '세종특별',
                   '강원도', '충청', '전라', '경상', '제주특별', '적성검사', '면허증', '기간']
  for (const line of lines) {
    if (name) break
    // 줄 전체가 한글 이름인 경우
    const exactMatch = line.match(/^([가-힣]{2,5})$/)
    if (exactMatch && !exclude.some(e => exactMatch[1].includes(e))) {
      name = exactMatch[1]
      break
    }
    // 줄 안에 한글 이름이 포함된 경우 (공백 구분)
    const words = line.split(/\s+/)
    for (const w of words) {
      const wm = w.match(/^([가-힣]{2,4})$/)
      if (wm && !exclude.some(e => wm[1].includes(e))) {
        name = wm[1]
        break
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
      return res.status(422).json({ success: false, message: '신분증에서 텍스트를 인식하지 못했습니다. 다시 촬영해주세요.' })
    }

    const parsed = parseIdCardText(ocrText)

    if (!parsed.name && !parsed.idNumber) {
      return res.status(422).json({ success: false, message: '신분증 정보를 추출할 수 없습니다. 신분증이 맞는지 확인 후 다시 촬영해주세요.' })
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
