// Full demo (~2.5 min): problem → what DealMee is → 8 features → how to start → price → close.
// Feature scenes reuse the chats of clips.js / week2.js (shifted so a short chapter title replaces
// each clip's 2.8s opening); the admin-takeover scene is new.
const clips = require('./clips')
const week2 = require('./week2')

const CHAPTER = 2.0
const N = 8
const byId = (id) => [...clips, ...week2].find((c) => c.id === id)

function featureFrom(id, n, icon, title, vo) {
  const c = byId(id)
  const shift = c.hook.dur - CHAPTER
  const mv = (t) => +(t - shift).toFixed(2)
  const m = c.main
  const lastMsg = Math.max(...m.msgs.map((x) => x.t), ...(m.overlays || []).map((o) => Math.min(o.until, 99)))
  return {
    id: `demo-${n}-${id}`,
    tag: c.tag,
    duration: +(mv(lastMsg) + 2.6).toFixed(2),
    endDur: 0,
    hook: { dur: CHAPTER, icon, kicker: `ฟีเจอร์ ${n}/${N}`, title },
    vo,
    main: {
      ...m,
      callouts: m.callouts.map((x) => ({ ...x, t: mv(x.t) })),
      msgs: m.msgs.map((x) => ({ ...x, t: mv(x.t) })),
      overlays: (m.overlays || []).map((o) => ({ ...o, t: mv(o.t), until: o.until >= 99 ? 99 : mv(o.until), press: o.press ? mv(o.press) : undefined })),
    },
  }
}

const slide = (id, duration, hook, vo, tag = 'DealMee AI') => ({ id, tag, duration, endDur: 0, hook: { dur: 99, ...hook }, vo })

module.exports = [
  slide('demo-a-problem', 6.5, {
    icon: '😵‍💫', kicker: 'เจ้าของร้านที่ขายผ่าน LINE',
    title: 'ตอบแชททั้งวัน<br>เช็คสลิปทั้งคืน<br><em>ยังขายไม่ทัน?</em>',
    sub: 'ลูกค้าทักตอนดึก ถามซ้ำ ๆ ส่งสลิปมา\nแอดมินมีคนเดียว',
  }, 'ตอบแชททั้งวัน เช็คสลิปทั้งคืน ก็ยังขายไม่ทันใช่ไหมครับ ลูกค้าทักตอนดึก ถามคำถามเดิมซ้ำ ๆ แต่แอดมินมีคนเดียว'),
  slide('demo-b-what', 7, {
    icon: '🤖', kicker: 'รู้จัก DealMee',
    title: 'AI แชทบอท<br>ใน <em>LINE OA</em> ของร้านคุณ',
    sub: 'ตอบลูกค้า รับออเดอร์ ตรวจสลิป\nแจ้งเลขพัสดุ และส่งต่อแอดมิน\nไม่ต้องเขียนโค้ด',
  }, 'DealMee คือ AI แชทบอทที่ทำงานใน LINE OA ของร้านคุณ ตอบลูกค้า รับออเดอร์ ตรวจสลิป แจ้งเลขพัสดุ และส่งต่อให้แอดมิน โดยไม่ต้องเขียนโค้ด'),
  featureFrom('01-reply-24h', 1, '🌙', 'ตอบแชทแทนคุณ<br><em>24 ชม.</em>',
    'หนึ่ง ตอบแชทแทนคุณตลอด 24 ชั่วโมง ลูกค้าทักตอนตีสองก็ได้คำตอบทันที ตอบจากข้อมูลร้านจริง ไม่เดาเอง แล้วพาลูกค้าไปจนสั่งซื้อ'),
  featureFrom('02-close-sale-slip', 2, '🧾', 'ปิดการขาย<br><em>จบในแชท</em>',
    'สอง ปิดการขายจบในแชท บอทสรุปยอดกับค่าส่ง ส่งคิวอาร์พร้อมเพย์ตามยอดจริง ลูกค้าส่งสลิปมา ระบบตรวจยอดและบัญชีปลายทางให้'),
  featureFrom('p02-short-payment', 3, '🧮', 'สลิปผิดปกติ<br><em>ระบบไม่ยืนยันเอง</em>',
    'สาม ถ้ายอดโอนไม่ตรง หรือส่งสลิปซ้ำ ระบบไม่ยืนยันออเดอร์เอง บอกลูกค้า แล้วแจ้งเข้าไลน์แอดมินทันที'),
  featureFrom('p03-qr-reminder', 4, '⏰', 'ขอ QR แล้วเงียบ<br><em>บอทเตือนให้</em>',
    'สี่ ลูกค้าขอคิวอาร์แล้วเงียบ ครบเวลาที่ร้านตั้งไว้ บอทส่งข้อความเตือนให้เอง พอลูกค้าโอน ระบบก็ตรวจสลิปต่อ'),
  featureFrom('03-high-value-handoff', 5, '💎', 'สินค้าราคาสูง<br><em>ส่งต่อคนปิด</em>',
    'ห้า สินค้าราคาหลักหมื่น บอทตอบข้อมูลให้ก่อน เก็บชื่อกับเบอร์ลูกค้าที่สนใจ แล้วแจ้งเข้าไลน์แอดมิน ให้คุณโทรปิดการขายเอง'),
  {
    id: 'demo-6-admin-takeover',
    tag: 'แอดมินคุมได้',
    duration: 12.2,
    endDur: 0,
    hook: { dur: CHAPTER, icon: '🙋', kicker: `ฟีเจอร์ 6/${N}`, title: 'ลูกค้าอยากคุยกับคน<br><em>แอดมินรับต่อได้ทันที</em>' },
    vo: 'หก ลูกค้าอยากคุยกับคน บอทส่งเรื่องให้แอดมินทันที แจ้งเข้าไลน์ พอแอดมินตอบในกล่องข้อความ บอทก็พักแชทนั้นให้เอง',
    main: {
      shop: { name: 'Moonlight Skincare', emoji: '🧴' },
      callouts: [
        { t: 2.0, text: 'อยากคุยกับคน<br><em>บอทส่งต่อทันที</em>' },
        { t: 4.4, text: 'แจ้ง <em>LINE แอดมิน</em>' },
        { t: 7.6, text: 'แอดมินตอบ<br><em>บอทพักแชทนั้นเอง</em>' },
      ],
      msgs: [
        { t: 2.2, side: 'user', text: 'อยากคุยกับแอดมินค่ะ\nเรื่องเคลมสินค้า' },
        { t: 3.5, side: 'bot', text: 'ได้เลยค่ะ ส่งเรื่องให้แอดมินแล้ว\nแอดมินจะเข้ามาตอบในแชทนี้นะคะ 🙏' },
        { t: 7.7, side: 'sys', text: 'แอดมินตอบ · บอทพักแชทนี้ 1 ชม.' },
        { t: 8.3, side: 'admin', text: 'สวัสดีค่ะ แอดมินมาแล้วค่ะ\nขอดูรูปสินค้าหน่อยนะคะ' },
      ],
      overlays: [
        { kind: 'notify', t: 4.5, until: 7.4, body: '🔔 **ลูกค้าขอคุยกับแอดมิน**\nคุณเมย์ · เรื่องเคลมสินค้า\nดูแชทในกล่องข้อความ' },
      ],
    },
  },
  featureFrom('04-tracking', 7, '📦', 'แจ้งเลขพัสดุ<br><em>อัตโนมัติ</em>',
    'เจ็ด ใส่เลขพัสดุในหลังบ้านครั้งเดียว ลูกค้าได้รับในแชททันที ถามว่าของถึงไหน บอทตอบเลขพัสดุให้เอง'),
  featureFrom('05-service-knowledge', 8, '📂', 'ธุรกิจบริการ<br>ใช้<em>คลังความรู้</em>',
    'แปด ธุรกิจบริการที่ไม่มีสินค้า แค่อัปโหลดไฟล์ข้อมูลร้าน บอทก็ตอบตามข้อมูลของคุณ ลูกค้าอยากนัด บอทส่งต่อแอดมินพร้อมเบอร์โทร'),
  slide('demo-c-start', 9, {
    icon: '🚀', kicker: 'เริ่มใช้งาน 3 ขั้นตอน',
    title: 'เริ่มได้<br><em>ในวันเดียว</em>',
    sub: '1. สมัครที่ dealmee.app\n2. ใส่ข้อมูลร้าน สินค้า และคลังความรู้\n3. เชื่อม LINE OA แล้วทดสอบด้วยแชทจำลอง',
  }, 'เริ่มใช้งานแค่สามขั้นตอน สมัครที่ dealmee.app ใส่ข้อมูลร้าน สินค้า และคลังความรู้ แล้วเชื่อม LINE OA ของร้าน ทดสอบกับแชทจำลองก่อนเปิดจริงได้', 'เริ่มใช้งาน'),
  slide('demo-d-price', 8, {
    icon: '💸', kicker: 'ราคา (ต่อ 30 วัน)',
    title: 'ทดลองฟรี <em>14 วัน</em><br>ไม่ต้องผูกบัตร',
    sub: 'Starter 590 · Pro 1,690 · Business 4,490 บาท\nBYOK 790 บาท (ใช้ API Key ของร้าน)\nเติมเงินผ่านพร้อมเพย์ ไม่มีสัญญาผูกมัด',
  }, 'ทดลองใช้ฟรี 14 วัน ไม่ต้องผูกบัตร แพ็กเกจเริ่มต้น 590 บาทต่อ 30 วัน เติมเงินผ่านพร้อมเพย์ ไม่มีสัญญาผูกมัด', 'ราคา'),
  {
    id: 'demo-e-end',
    tag: '',
    duration: 6.5,
    endDur: 6.5,
    hook: { dur: 0, instant: true, title: '' },
    end: { title: 'ให้ <em>DealMee</em><br>ช่วยขายแทนคุณ', sub: 'AI แชทบอทสำหรับ LINE OA ของร้านไทย' },
    vo: 'ให้ DealMee ช่วยขายแทนคุณ ทักมาที่ไลน์ แอด ดีลมี หรือสมัครที่ dealmee.app ได้เลยครับ',
  },
]
