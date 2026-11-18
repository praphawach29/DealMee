import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildGeminiContents,
  buildClaudeMessages,
  buildOpenAiMessages,
  type PlanningTurn,
  type ImageAttachment,
} from '../src/lib/ai/salesAgentEngine.ts'

test('buildGeminiContents preserves text-only user turns exactly as before', () => {
  const turns: PlanningTurn[] = [{ role: 'user', text: 'มีเสื้อไหม' }]
  const contents = buildGeminiContents(turns)
  assert.equal(contents.length, 1)
  assert.deepEqual(contents[0], {
    role: 'user',
    parts: [{ text: 'มีเสื้อไหม' }],
  })
})

test('buildGeminiContents correctly packages inlineData image parts alongside customer text', () => {
  const images: ImageAttachment[] = [
    { type: 'image', mimeType: 'image/jpeg', base64: 'fakeBase64Jpeg' },
  ]
  const turns: PlanningTurn[] = [
    { role: 'user', text: 'รุ่นนี้มีของไหม', attachments: images },
  ]
  const contents = buildGeminiContents(turns)
  assert.equal(contents.length, 1)
  assert.deepEqual(contents[0], {
    role: 'user',
    parts: [
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: 'fakeBase64Jpeg',
        },
      },
      { text: 'รุ่นนี้มีของไหม' },
    ],
  })
})

test('buildGeminiContents handles image-only turns without losing part structure', () => {
  const images: ImageAttachment[] = [
    { type: 'image', mimeType: 'image/png', base64: 'fakeBase64Png' },
  ]
  const turns: PlanningTurn[] = [
    { role: 'user', text: '', attachments: images },
  ]
  const contents = buildGeminiContents(turns)
  assert.equal(contents.length, 1)
  assert.deepEqual(contents[0], {
    role: 'user',
    parts: [
      {
        inlineData: {
          mimeType: 'image/png',
          data: 'fakeBase64Png',
        },
      },
    ],
  })
})

test('buildClaudeMessages formats image attachments with base64 source blocks', () => {
  const images: ImageAttachment[] = [
    { type: 'image', mimeType: 'image/webp', base64: 'fakeWebpData' },
  ]
  const turns: PlanningTurn[] = [
    { role: 'user', text: 'ราคาเท่าไหร่ครับ', attachments: images },
  ]
  const messages = buildClaudeMessages(turns)
  assert.equal(messages.length, 1)
  assert.deepEqual(messages[0], {
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/webp',
          data: 'fakeWebpData',
        },
      },
      { type: 'text', text: 'ราคาเท่าไหร่ครับ' },
    ],
  })
})

test('buildOpenAiMessages formats image attachments as image_url content parts', () => {
  const images: ImageAttachment[] = [
    { type: 'image', mimeType: 'image/jpeg', base64: 'fakeJpegData' },
    { type: 'image', mimeType: 'image/png', url: 'https://example.com/sample.png' },
  ]
  const turns: PlanningTurn[] = [
    { role: 'user', text: 'อันนี้แท้ไหม', attachments: images },
  ]
  const messages = buildOpenAiMessages('sys prompt', turns)
  assert.equal(messages.length, 2) // system + user
  assert.deepEqual(messages[1], {
    role: 'user',
    content: [
      { type: 'text', text: 'อันนี้แท้ไหม' },
      {
        type: 'image_url',
        image_url: { url: 'data:image/jpeg;base64,fakeJpegData' },
      },
      {
        type: 'image_url',
        image_url: { url: 'https://example.com/sample.png' },
      },
    ],
  })
})
