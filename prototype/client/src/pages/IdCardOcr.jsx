import { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import './IdCardOcr.css'

export default function IdCardOcr() {
  const [mode, setMode] = useState('upload') // 'upload' | 'webcam'
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultText, setResultText] = useState('')
  const [error, setError] = useState('')
  
  // 웹캠용 Refs
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  // 모드가 바뀔 때마다 카메라 끄기
  useEffect(() => {
    if (mode === 'upload') {
      stopCamera()
    } else if (mode === 'webcam') {
      startCamera()
    }
    return () => stopCamera()
  }, [mode])

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      streamRef.current = stream
      setError('')
      setPreview('')
      setFile(null)
    } catch (err) {
      console.error(err)
      setError('카메라 접근 권한이 없거나 지원하지 않는 기기입니다.')
      setMode('upload')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    // 캔버스 이미지를 Blob(파일)로 변환
    canvas.toBlob((blob) => {
      if (blob) {
        const capturedFile = new File([blob], 'captured-id.jpg', { type: 'image/jpeg' })
        setFile(capturedFile)
        setPreview(URL.createObjectURL(blob))
        stopCamera() // 캡처 후 카메라 정지
      }
    }, 'image/jpeg', 0.9)
  }

  const resetWebcam = () => {
    setPreview('')
    setFile(null)
    setResultText('')
    startCamera()
  }

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0]
    if (selectedFile) {
      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
      setResultText('')
      setError('')
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setLoading(true)
    setError('')
    setResultText('')

    const formData = new FormData()
    formData.append('image', file)

    try {
      const response = await axios.post('/api/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setResultText(response.data.text)
    } catch (err) {
      console.error(err)
      setError('이미지 인식 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ocr-container">
      <div className="ocr-header">
        <h2>📷 신분증 인식 (AI OCR)</h2>
        <p>신분증이나 명함 사진을 업로드하거나 촬영하면 AI가 텍스트를 추출해 줍니다.</p>
        
        <div className="ocr-mode-toggle">
          <button 
            className={`toggle-btn ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => { setMode('upload'); setPreview(''); setFile(null); setResultText(''); }}
          >
            📂 사진 업로드
          </button>
          <button 
            className={`toggle-btn ${mode === 'webcam' ? 'active' : ''}`}
            onClick={() => { setMode('webcam'); setResultText(''); }}
          >
            📸 웹캠으로 촬영
          </button>
        </div>
      </div>

      <div className="ocr-content">
        <div className="ocr-upload-section">
          
          {mode === 'upload' ? (
            <label className="ocr-upload-box">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleFileChange} 
                style={{ display: 'none' }} 
              />
              {preview ? (
                <img src={preview} alt="미리보기" className="ocr-preview" />
              ) : (
                <div className="ocr-placeholder">
                  <span>클릭하여 사진 업로드</span>
                </div>
              )}
            </label>
          ) : (
            <div className="ocr-webcam-box">
              {preview ? (
                <>
                  <img src={preview} alt="캡처본" className="ocr-preview" />
                  <button className="ocr-retake-btn" onClick={resetWebcam}>🔄 다시 촬영</button>
                </>
              ) : (
                <>
                  <video ref={videoRef} autoPlay playsInline className="ocr-video" />
                  <button className="ocr-capture-btn" onClick={capturePhoto}>📸 캡처하기</button>
                </>
              )}
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          )}

          <button 
            className="ocr-submit-btn" 
            onClick={handleUpload} 
            disabled={!file || loading}
          >
            {loading ? '인식 중...' : '텍스트 추출하기'}
          </button>
        </div>

        <div className="ocr-result-section">
          <h3>추출 결과</h3>
          {error && <div className="ocr-error">{error}</div>}
          <div className="ocr-result-box">
            {loading ? (
              <div className="ocr-loading">AI가 사진을 읽고 있습니다...</div>
            ) : resultText ? (
              <pre>{resultText}</pre>
            ) : (
              <div className="ocr-empty-result">아직 추출된 텍스트가 없습니다.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
