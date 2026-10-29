import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  greetingOnlyReply,
  isGreetingOnlyMessage,
  shouldBlockGreetingHandoff,
} from '../src/lib/ai/handoffGuard.ts'

test('plain Thai and English greetings are recognized', () => {
  for (const message of ['สวัสดีครับ', 'สวัสดีค่ะ 😊', 'หวัดดี', 'hello!', 'Hi there']) {
    assert.equal(isGreetingOnlyMessage(message), true, message)
  }
})

test('a greeting with a real request is not greeting-only', () => {
  for (const message of ['สวัสดี ขอใบเสนอราคาครับ', 'สวัสดี ขอคุยกับแอดมิน', 'hello, I need help']) {
    assert.equal(isGreetingOnlyMessage(message), false, message)
  }
})

test('greeting-only handoff is blocked on any turn', () => {
  const base = { message: 'สวัสดีครับ', isFirstCustomerTurn: true, toolName: 'request_human_agent' }
  assert.equal(shouldBlockGreetingHandoff(base), true)
  assert.equal(shouldBlockGreetingHandoff({ ...base, isFirstCustomerTurn: false }), true)
  assert.equal(shouldBlockGreetingHandoff({ ...base, toolName: 'search_knowledge_base' }), false)
  assert.equal(shouldBlockGreetingHandoff({ ...base, message: 'ขอคุยกับแอดมินครับ' }), false)
})

test('blocked handoff has a safe customer-facing greeting', () => {
  assert.match(greetingOnlyReply('th'), /สอบถาม/)
  assert.match(greetingOnlyReply('en'), /help/i)
})
