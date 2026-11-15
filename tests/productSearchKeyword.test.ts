import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeProductSearchKeyword } from '../src/lib/ai/productSearchKeyword.ts'

test('broad catalog questions become no filter, so the whole catalog is listed', () => {
  for (const question of [
    'มีสินค้าอะไรบ้าง',
    'มีบริการอะไรบ้าง',
    'มีบริการอะไรบ้างครับ',
    'บริการ',
    'แพ็กเกจ',
    'มีแพ็คเกจอะไรบ้างคะ',
    'services',
    'what packages do you have',
  ]) {
    assert.equal(normalizeProductSearchKeyword(question), '', question)
  }
})

test('specific requests keep the word that names the item', () => {
  assert.equal(normalizeProductSearchKeyword('บริการนวดไทย'), 'นวดไทย')
  assert.equal(normalizeProductSearchKeyword('แพ็กเกจ Pro'), 'pro')
  assert.equal(normalizeProductSearchKeyword('มีเสื้อยืดไหม'), 'เสื้อยืดไหม')
})

test('non-string keywords are ignored', () => {
  assert.equal(normalizeProductSearchKeyword(undefined), '')
  assert.equal(normalizeProductSearchKeyword(42), '')
})
