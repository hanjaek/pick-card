const express = require('express')
const router = express.Router()
const multer = require('multer')
const fs = require('fs')
const path = require('path')

const RAG_URL = process.env.RAG_URL || 'http://localhost:8000'

// uploads 디렉토리 확인 및 생성
const uploadDir = path.join(__dirname, '../uploads')
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

// Multer 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname))
  }
})

const upload = multer({ storage: storage })

/* POST /api/ocr */
router.post('/', upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: '이미지 파일이 제공되지 않았습니다.' })
  }

  const absoluteFilePath = path.resolve(req.file.path)

  try {
    // 파이썬 RAG 서버로 파일 절대 경로 전달
    const response = await fetch(`${RAG_URL}/ocr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filepath: absoluteFilePath })
    })

    if (!response.ok) {
      throw new Error(`RAG 서버 응답 오류: ${response.status}`)
    }

    const data = await response.json()
    
    // 처리 완료 후 임시 파일 삭제
    fs.unlinkSync(absoluteFilePath)

    res.json({ text: data.text })

  } catch (error) {
    console.error('OCR 요청 에러:', error)
    
    // 에러 발생 시에도 임시 파일 정리
    if (fs.existsSync(absoluteFilePath)) {
      fs.unlinkSync(absoluteFilePath)
    }

    res.status(500).json({ message: 'OCR 처리 중 에러가 발생했습니다.' })
  }
})

module.exports = router
