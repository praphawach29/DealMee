const THAI_PARTICLE = 'ครับผม|นะครับ|นะคะ|นะค่ะ|ค้าบ+|คับ+|ครับ|ค่ะ|คะ|ค่า+|จ้า+|จ๊ะ|จ้ะ|งับ|ฮ่ะ|ฮะ|นะ'
const THAI_GREETING_ONLY = new RegExp(
  `^(?:สวัสดี|หวัดดี|ดี|ฮัลโหล่*|ฮัลโล่*|เฮลโหล่*|ฮัลโล)(?:\\s*(?:${THAI_PARTICLE}))?$`,
  'u',
)
const ENGLISH_GREETING_ONLY = /^(?:hi|hello|hey|hallo)(?: there)?$/u

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
