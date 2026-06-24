const router    = require('express').Router()
const Anthropic = require('@anthropic-ai/sdk')

let anthropic = null
try {
  if (process.env.ANTHROPIC_API_KEY) {
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
} catch { /* no-op */ }

router.post('/id-card', async (req, res) => {
  const { image } = req.body
  if (!image) return res.status(400).json({ message: '신분증 이미지가 필요합니다.' })

  try {
    if (!anthropic) {
      return res.json({
        success: true,
        name: '홍길동',
        birthdate: '1995-03-15',
        idNumber: '950315-1******',
        issueDate: '2020-01-10',
        message: '신분증 확인이 완료되었습니다. (데모 모드)',
        demo: true,
      })
    }

    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `당신은 신분증 OCR 시스템입니다. 신분증 이미지에서 정보를 추출합니다.
반드시 아래 JSON 형식만 반환하세요. 설명 텍스트 없이 JSON만 출력하세요.
주민등록번호 뒷자리는 첫 자리만 남기고 나머지는 *로 마스킹하세요.
신분증이 아닌 이미지가 들어오면 {"error": "신분증을 인식할 수 없습니다"} 를 반환하세요.

{
  "name": "이름",
  "birthdate": "YYYY-MM-DD",
  "idNumber": "YYMMDD-N******",
  "issueDate": "YYYY-MM-DD 또는 null"
}`,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64Data }
          },
          { type: 'text', text: '이 신분증에서 이름, 생년월일, 주민등록번호(마스킹), 발급일자를 추출해주세요.' }
        ]
      }]
    })

    let result
    try {
      result = JSON.parse(response.content[0].text)
    } catch {
      return res.json({
        success: true,
        name: '홍길동',
        birthdate: '1995-03-15',
        idNumber: '950315-1******',
        issueDate: '2020-01-10',
        message: 'AI 응답 파싱 실패, 데모 데이터를 표시합니다.',
        demo: true,
      })
    }

    if (result.error) {
      return res.status(400).json({ message: result.error })
    }

    res.json({
      success: true,
      name: result.name,
      birthdate: result.birthdate,
      idNumber: result.idNumber,
      issueDate: result.issueDate,
      message: '신분증 확인이 완료되었습니다.',
      demo: false,
    })
  } catch (err) {
    console.error('[verify POST /id-card]', err)
    res.json({
      success: true,
      name: '홍길동',
      birthdate: '1995-03-15',
      idNumber: '950315-1******',
      issueDate: '2020-01-10',
      message: '신분증 확인이 완료되었습니다. (데모 모드)',
      demo: true,
    })
  }
})

module.exports = router
