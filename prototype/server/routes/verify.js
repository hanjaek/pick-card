const router = require('express').Router()
const fs     = require('fs')
const path   = require('path')

const RAG_URL    = process.env.RAG_URL || 'http://localhost:8000'
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const DEMO_RESULT = {
  success: true,
  name: '홍길동',
  birthdate: '1995-03-15',
  idNumber: '950315-1******',
  issueDate: '2020-01-10',
  message: '신분증 확인이 완료되었습니다. (데모 모드)',
  demo: true,
}

function parseIdCardText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  let name = null
  let birthdate = null
  let idNumber = null
  let issueDate = null

  for (const line of lines) {
    // 주민등록번호 패턴: 6자리-7자리
    const idMatch = line.match(/(\d{6})\s*[-–]\s*(\d{7})/)
    if (idMatch && !idNumber) {
      const front = idMatch[1]
      const backFirst = idMatch[2][0]
      idNumber = `${front}-${backFirst}******`

      const yy = front.slice(0, 2)
      const mm = front.slice(2, 4)
      const dd = front.slice(4, 6)
      const century = ['1', '2'].includes(backFirst) ? '19' : '20'
      birthdate = `${century}${yy}-${mm}-${dd}`
    }

    // 이름: 한글 2~5자 (주민번호/날짜/주소 키워드 제외)
    const nameMatch = line.match(/^([가-힣]{2,5})$/)
    if (nameMatch && !name) {
      const candidate = nameMatch[1]
      const exclude = ['주민등록증', '대한민국', '운전면허증', '주민등록', '서울특별', '부산광역']
      if (!exclude.some(e => candidate.includes(e))) {
        name = candidate
      }
    }

    // 발급일: YYYY.MM.DD 또는 YYYY-MM-DD 또는 YYYY MM DD
    const dateMatch = line.match(/(20\d{2})[.\-\s](\d{1,2})[.\-\s](\d{1,2})/)
    if (dateMatch && !issueDate) {
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
      return res.json({ ...DEMO_RESULT, message: '텍스트를 인식하지 못했습니다. 데모 데이터를 표시합니다.' })
    }

    const parsed = parseIdCardText(ocrText)

    res.json({
      success: true,
      name: parsed.name || '(인식 실패)',
      birthdate: parsed.birthdate || '',
      idNumber: parsed.idNumber || '',
      issueDate: parsed.issueDate || '',
      ocrRawText: ocrText,
      message: parsed.name ? '신분증 확인이 완료되었습니다. (RAG OCR)' : 'OCR 인식 결과를 확인해주세요.',
      demo: false,
    })
  } catch (err) {
    console.error('[verify POST /id-card]', err.message)

    if (err.cause?.code === 'ECONNREFUSED' || err.message?.includes('ECONNREFUSED')) {
      return res.json({ ...DEMO_RESULT, message: 'RAG 서비스 미실행 — 데모 데이터를 표시합니다.' })
    }

    res.json(DEMO_RESULT)
  } finally {
    if (tmpPath && fs.existsSync(tmpPath)) {
      fs.unlinkSync(tmpPath)
    }
  }
})

module.exports = router
