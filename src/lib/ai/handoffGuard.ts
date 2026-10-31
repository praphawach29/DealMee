const THAI_GREETING_ONLY = /^(?:สวัสดี|หวัดดี|ดี)(?:ครับผม|นะครับ|ครับ|ค่ะ|คะ|จ้า|จ๊ะ)?$/u
const ENGLISH_GREETING_ONLY = /^(?:hi|hello|hey)(?: there)?$/u

function normalizeGreeting(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase('th-TH')
    .replace(/[!?.…,~。、]/gu, '')
    .replace(/\p{Extended_Pictographic}|\uFE0F/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function isGreetingOnlyMessage(text: string): boolean {
  const normalized = normalizeGreeting(text)
  return THAI_GREETING_ONLY.test(normalized) || ENGLISH_GREETING_ONLY.test(normalized)
}

export function shouldBlockGreetingHandoff(input: {
  message: string
  isFirstCustomerTurn?: boolean
  toolName: string
}): boolean {
  return (
    input.toolName === 'request_human_agent' &&
    isGreetingOnlyMessage(input.message)
  )
}

export function greetingOnlyReply(language: 'th' | 'en'): string {
  return language === 'en'
    ? 'Hello! How can I help you today?'
    : 'สวัสดีค่ะ 😊 วันนี้สนใจสอบถามเรื่องอะไรเป็นพิเศษคะ'
}
