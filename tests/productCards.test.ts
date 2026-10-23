import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { buildLineFlexProductCarousel } from '../src/lib/line/flexHelper.ts'
import {
  isKeywordProductQuery,
  isProductCardSuppressed,
  mergeProductCards,
  resolveChannelProductCards,
  selectKeywordCarouselProducts,
  toProductCards,
} from '../src/lib/ai/productCards.ts'

const shirt = {
  id: 'p-shirt',
  name: 'เสื้อยืด',
  price: 350,
  stock: 4,
  description: 'ตัวอย่างจากแคตตาล็อก',
  image_url: 'https://example.com/shirt.jpg',
  category: 'เสื้อ',
}
const pants = {
  id: 'p-pants',
  name: 'กางเกงขายาว',
  price: 590,
  stock: 0,
  category: 'กางเกง',
}
const unspaced = {
  id: 'p-long',
  name: 'เสื้อยืดคอกลม',
  price: 290,
  stock: 2,
  category: 'ของใช้',
}
const mug = {
  id: 'p-mug',
  name: 'แก้วน้ำ',
  price: 150,
  stock: 8,
  category: 'ครัว',
}

test('search rows keep the fields a carousel needs', () => {
  const [card] = toProductCards([shirt, { name: '   ' }, null])
  assert.equal(card.id, 'p-shirt')
  assert.equal(card.name, 'เสื้อยืด')
  assert.equal(card.price, 350)
  assert.equal(card.stock, 4)
  assert.equal(card.image_url, 'https://example.com/shirt.jpg')
  assert.equal(toProductCards([{ price: 10 }]).length, 0)
})

test('a later stock check adds cards without duplicating the same catalog id', () => {
  const merged = mergeProductCards(
    [shirt, pants],
    [{ ...shirt, stock: 3 }, { id: 'p-hat', name: 'หมวก', price: 199, stock: 1 }]
  )
  assert.deepEqual(merged.map((card) => card.id), ['p-shirt', 'p-pants', 'p-hat'])
  assert.equal(merged[0].stock, 4)
  assert.equal(mergeProductCards(Array.from({ length: 12 }, (_, i) => ({
    id: `p-${i}`,
    name: `สินค้า ${i}`,
    price: i,
  })), []).length, 10)
})

test('tool rows are sent even when the message would not match the keyword fallback', () => {
  const cards = resolveChannelProductCards({
    suppress: false,
    toolProducts: [shirt],
    userText: 'มีเสื้อตัวนี้ไหมครับ',
    catalogProducts: [shirt, pants, unspaced],
  })
  assert.deepEqual(cards.map((card) => card.id), ['p-shirt'])
})

test('tool rows are not concatenated with the keyword catalog', () => {
  const cards = resolveChannelProductCards({
    suppress: false,
    toolProducts: [pants],
    userText: 'ขอดูสินค้า',
    catalogProducts: [shirt, pants, unspaced],
  })
  assert.deepEqual(cards.map((card) => card.id), ['p-pants'])
})

test('keyword fallback still matches a named product or a catalog-wide ask', () => {
  assert.equal(isKeywordProductQuery('มีเสื้อยืดไหม'), true)
  assert.equal(isKeywordProductQuery('สวัสดีครับ'), false)

  const named = selectKeywordCarouselProducts('มีเสื้อยืดไหมครับ', [shirt, pants, unspaced])
  assert.deepEqual(named.map((card) => card.id), ['p-shirt'])

  const wide = selectKeywordCarouselProducts('แนะนำสินค้า', [mug, shirt])
  assert.deepEqual(wide.map((card) => card.id), ['p-mug', 'p-shirt'])

  // A name with no spaces is not a partial match. That heuristic stays as it was.
  const vague = selectKeywordCarouselProducts('มีเสื้อตัวนี้ไหมครับ', [unspaced])
  assert.deepEqual(vague, [])

  assert.deepEqual(
    resolveChannelProductCards({
      suppress: false,
      toolProducts: [],
      userText: 'ขอดูเสื้อ',
      catalogProducts: [shirt, pants],
    }).map((card) => card.id),
    ['p-shirt']
  )
})

test('quotation turns and a disabled recommendation send no cards', () => {
  assert.equal(isProductCardSuppressed('ขอใบเสนอราคา', []), true)
  assert.equal(isProductCardSuppressed('มีเสื้อยืดไหม', ['create_quotation']), true)
  assert.deepEqual(
    resolveChannelProductCards({
      suppress: true,
      toolProducts: [shirt],
      userText: 'มีเสื้อยืดไหม',
      catalogProducts: [shirt],
    }),
    []
  )
})

test('one LINE Flex carousel uses the real order button and does not repeat bubbles', () => {
  const flex = buildLineFlexProductCarousel([shirt, pants])
  assert.ok(flex)
  assert.equal(flex!.contents.type, 'carousel')
  assert.equal(flex!.contents.contents.length, 2)
  const orderButton = flex!.contents.contents[0].footer.contents[0]
  assert.equal(orderButton.action.label, 'สั่งซื้อสินค้านี้')
  assert.equal(orderButton.color, '#06C755')
  assert.equal(orderButton.action.text, 'สั่งซื้อ เสื้อยืด')
  const outOfStock = flex!.contents.contents[1].footer.contents[0]
  assert.equal(outOfStock.action.label, 'แจ้งเมื่อมีสินค้าเติม')
})

test('the live product handlers are the only ones and both channels share the selector', () => {
  const dispatcher = readFileSync(new URL('../src/lib/ai/toolDispatcher.ts', import.meta.url), 'utf8')
  const line = readFileSync(new URL('../src/app/api/webhook/[shop_id]/route.ts', import.meta.url), 'utf8')
  const messenger = readFileSync(new URL('../src/lib/facebook/processMessengerEntries.ts', import.meta.url), 'utf8')

  assert.equal((dispatcher.match(/if \(toolName === 'search_products'\)/g) || []).length, 1)
  assert.equal((dispatcher.match(/if \(toolName === 'check_stock'\)/g) || []).length, 1)
  assert.equal((dispatcher.match(/\(toolName as string\) === 'search_products'/g) || []).length, 0)
  assert.equal((dispatcher.match(/\(toolName as string\) === 'check_stock'/g) || []).length, 0)
  assert.match(dispatcher, /productsData: cards/)
  assert.doesNotMatch(line, /isExplicitProductQuery/)
  assert.doesNotMatch(messenger, /isExplicitProductQuery/)
  assert.match(line, /resolveChannelProductCards/)
  assert.match(messenger, /resolveChannelProductCards/)
})
