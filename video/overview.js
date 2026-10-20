// The ~1-minute overview: seven segments rendered separately, joined with 0.4s crossfades.
// Segment times are seconds from the segment's own start. `vo` = the owner's voice-over line.
const chapter = (n, icon, title, sub) => ({ dur: 1.9, icon, kicker: `ฟีเจอร์ ${n}/5`, title, sub })

module.exports = [
  {
    id: 'ov0-intro',
    tag: 'DealMee AI',
    duration: 5.2,
    endDur: 0,
    hook: {
      dur: 99, icon: '💬', kicker: 'เจ้าของร้านที่ขายผ่าน LINE',
      title: 'ลูกค้าทักมา<br><em>เป็นร้อยแชท</em><br>แอดมินมีคนเดียว?',
      sub: 'DealMee AI ช่วยตอบ ขาย และตามงาน ใน LINE OA ของร้านคุณ',
      vo: 'ลูกค้าทักมาเป็นร้อยแชท แต่แอดมินมีคนเดียวใช่ไหมครับ',
    },
  },
  {
    id: 'ov1-reply',
    tag: 'ตอบแชท 24 ชม.',
    duration: 9.6,
    endDur: 0,
    hook: chapter(1, '🌙', 'ตอบแชทแทนคุณ<br><em>24 ชม.</em>'),
    vo: 'หนึ่ง ตอบแชทแทนคุณตลอด 24 ชั่วโมง จากข้อมูลร้านจริง ไม่เดาเอง แล้วพาลูกค้าไปจนสั่งซื้อ',
    main: {
      shop: { name: 'ร้านขนมบ้านนุ่น', emoji: '🍰' },
      callouts: [{ num: 1, t: 2.0, text: 'ลูกค้าทักตอน<em>ตี 2</em><br>บอทตอบทันที' }],
      msgs: [
        { t: 2.1, side: 'sys', text: '02:13' },
        { t: 2.3, side: 'user', text: 'ยังรับออเดอร์อยู่ไหมคะ\nเค้กส้มราคาเท่าไหร่' },
        { t: 3.6, side: 'bot', text: 'รับออเดอร์ตลอดค่ะ 😊\nเค้กส้ม 1 ปอนด์ 450 บาท\nสั่งล่วงหน้า 1 วันนะคะ' },
        { t: 5.4, side: 'user', text: 'เอา 1 ปอนด์ รับพรุ่งนี้ค่ะ' },
        { t: 6.6, side: 'bot', text: 'ได้เลยค่ะ ขอชื่อและเบอร์โทร\nสำหรับรับเค้กนะคะ' },
      ],
    },
  },
  {
    id: 'ov2-close',
    tag: 'ปิดการขาย + ตรวจสลิป',
    duration: 10.4,
    endDur: 0,
    hook: chapter(2, '🧾', 'ปิดการขาย<br><em>จบในแชท</em>'),
    vo: 'สอง ปิดการขายจบในแชท บอทสรุปยอด ส่ง QR พร้อมเพย์ ลูกค้าส่งสลิปมา ระบบตรวจให้',
    main: {
      shop: { name: 'Moonlight Skincare', emoji: '🧴' },
      callouts: [
        { num: 2, t: 2.0, text: 'สรุปยอด + ส่ง <em>QR พร้อมเพย์</em>' },
        { num: 2, t: 5.6, text: 'ลูกค้าส่งสลิป<br><em>ระบบตรวจให้</em>' },
      ],
      msgs: [
        { t: 2.2, side: 'user', text: 'เซรั่มวิตซี 2 ขวด ส่งเชียงใหม่ค่ะ' },
        { t: 3.3, side: 'bot', text: 'รวมค่าส่ง **840 บาท** ค่ะ' },
        { t: 4.1, side: 'bot', kind: 'qr', amount: '฿840.00', order: 'ORD-240518', think: 0.5 },
        { t: 5.8, side: 'user', kind: 'slip', amount: '฿840.00', to: 'Moonlight Skincare', when: 'วันนี้ 14:27' },
        { t: 7.2, side: 'bot', text: '✅ ตรวจสลิปแล้ว ยอดตรง\nออเดอร์ชำระแล้วค่ะ', think: 0.9, chime: true },
      ],
    },
  },
  {
    id: 'ov3-handoff',
    tag: 'ส่งต่อแอดมิน',
    duration: 9.8,
    endDur: 0,
    hook: chapter(3, '💎', 'สินค้าราคาสูง<br><em>ส่งต่อคนปิด</em>'),
    vo: 'สาม สินค้าราคาสูง บอทเก็บชื่อกับเบอร์ลูกค้าที่สนใจ แล้วแจ้งเข้าไลน์แอดมินทันที',
    main: {
      shop: { name: 'Bangkok Bike Studio', emoji: '🚲' },
      callouts: [{ num: 3, t: 2.0, text: 'แจ้ง <em>LINE แอดมิน</em><br>พร้อมเบอร์ลูกค้า' }],
      msgs: [
        { t: 2.2, side: 'user', text: 'รุ่น Aero 45,900 บาท\nขอลองปั่นก่อนได้ไหมครับ' },
        { t: 3.5, side: 'bot', text: 'ได้ค่ะ ขอชื่อและเบอร์โทร\nแอดมินจะติดต่อกลับนะคะ' },
        { t: 4.8, side: 'user', text: 'ต้น 089-xxx-4521' },
        { t: 5.8, side: 'bot', text: 'ส่งเรื่องให้แอดมินแล้วค่ะ 🙏' },
      ],
      overlays: [
        { kind: 'notify', t: 6.4, until: 99, body: '🔔 **ลูกค้าสนใจสินค้าราคาสูง**\nคุณต้น · 089-xxx-4521\nสนใจ: จักรยาน Aero 45,900 บาท' },
      ],
    },
  },
  {
    id: 'ov4-tracking',
    tag: 'แจ้งเลขพัสดุ',
    duration: 9.6,
    endDur: 0,
    hook: chapter(4, '📦', 'แจ้งเลขพัสดุ<br><em>อัตโนมัติ</em>'),
    vo: 'สี่ ใส่เลขพัสดุครั้งเดียว ลูกค้าได้รับในแชท ถามว่าของถึงไหน บอทตอบให้เอง',
    main: {
      shop: { name: 'Sunday Clothing', emoji: '👕' },
      callouts: [
        { num: 4, t: 2.0, text: 'ใส่<em>เลขพัสดุ</em>ในหลังบ้าน' },
        { num: 4, t: 5.0, text: 'ถาม<em>ของถึงไหน</em><br>บอทตอบเอง' },
      ],
      msgs: [
        { t: 2.0, side: 'sys', text: 'วันนี้' },
        { t: 4.9, side: 'bot', think: 0, chime: true, text: '📦 ออเดอร์ ORD-509098 จัดส่งแล้ว\nFlash Express · TH0123456789' },
        { t: 6.0, side: 'user', text: 'ของถึงไหนแล้วคะ 🥺' },
        { t: 7.1, side: 'bot', text: 'ส่งแล้วค่ะ เลขพัสดุ TH0123456789\nเช็คสถานะที่ลิงก์ของขนส่งได้เลยค่ะ' },
      ],
      overlays: [
        {
          kind: 'panel', t: 2.0, until: 4.7, top: 200, press: 4.2,
          title: '📦 จัดส่งออเดอร์ ORD-509098',
          fields: [{ label: 'ขนส่ง', value: 'Flash Express' }, { label: 'เลขพัสดุ', value: 'TH0123456789' }],
          button: 'บันทึกและเปลี่ยนเป็นจัดส่งแล้ว', done: '✓ บันทึกแล้ว',
        },
      ],
    },
  },
  {
    id: 'ov5-service',
    tag: 'ธุรกิจบริการ',
    duration: 8.8,
    endDur: 0,
    hook: chapter(5, '📂', 'ไม่มีสินค้า<br>ก็ใช้<em>คลังความรู้</em>'),
    vo: 'ห้า ธุรกิจบริการ แค่อัปโหลดไฟล์ข้อมูลร้าน บอทก็ตอบตามข้อมูลของคุณ',
    main: {
      shop: { name: 'คลินิกทันตกรรมยิ้มสวย', emoji: '🦷' },
      callouts: [{ num: 5, t: 2.0, text: 'ตอบจาก<em>ไฟล์ข้อมูลร้าน</em><br>ของคุณ' }],
      msgs: [
        { t: 2.2, side: 'user', text: 'ขูดหินปูนราคาเท่าไหร่คะ' },
        { t: 3.5, side: 'bot', text: 'เริ่มต้น 800 บาทค่ะ\nเปิดทุกวัน 10:00–20:00 น.' },
        { t: 5.0, side: 'user', text: 'อยากนัดเสาร์นี้ค่ะ' },
        { t: 6.1, side: 'bot', text: 'ขอชื่อและเบอร์โทร\nแอดมินจะยืนยันคิวให้นะคะ' },
      ],
    },
  },
  {
    id: 'ov6-outro',
    tag: 'เริ่มต้นใช้งาน',
    duration: 9.4,
    endDur: 5.4,
    hook: {
      dur: 4.0, icon: '💸', kicker: 'เริ่มต้นใช้งาน',
      title: 'ทดลองฟรี <em>14 วัน</em><br>ไม่ต้องผูกบัตร',
      sub: 'ใช้ LINE OA เดิมของร้านได้เลย',
    },
    end: {
      title: 'ให้ <em>DealMee</em><br>ช่วยขายแทนคุณ',
      sub: 'AI แชทบอทสำหรับ LINE OA ของร้านไทย',
      price: 'Starter <b>590</b> บาท / 30 วัน',
    },
    vo: 'ทดลองใช้ฟรี 14 วัน ไม่ต้องผูกบัตร ใช้ LINE OA เดิมของร้านได้เลย แพ็กเกจเริ่มต้น 590 บาทต่อ 30 วัน สมัครที่ dealmee.app ครับ',
  },
]
