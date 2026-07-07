// LLM 응답에 섞여 나오는 **굵게** 마크다운만 최소한으로 파싱해서 렌더링한다.
// (전체 마크다운 파서를 붙이기엔 과해서, 챗봇에 흔한 볼드체 하나만 지원)
export function renderChatText(content) {
  return content.split('\n').map((line, i, arr) => (
    <span key={i}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={j}>{part.slice(2, -2)}</strong>
          : part
      )}
      {i < arr.length - 1 && <br />}
    </span>
  ))
}
