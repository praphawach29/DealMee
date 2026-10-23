import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, ShieldCheck, FileText, CheckCircle2, AlertCircle } from 'lucide-react'

export const metadata = {
  title: 'เงื่อนไขการให้บริการ (Terms of Service) | DealMee AI',
  description: 'ข้อกำหนดและเงื่อนไขการใช้บริการแพลตฟอร์ม DealMee AI สำหรับร้านค้าและธุรกิจ',
}

export default function TermsPage() {
  const lastUpdated = '28 กันยายน 2569'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-body-md selection:bg-blue-600 selection:text-white">
      {/* Top Header Bar */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-slate-600 hover:text-blue-600 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>กลับสู่หน้าหลัก DealMee</span>
          </Link>
          <div className="flex items-center gap-2">
            <Image
              src="/logos/dealmee-icon.png"
              alt="DealMee Logo"
              width={28}
              height={28}
              className="w-7 h-7 object-contain drop-shadow-sm shrink-0"
            />
            <span className="font-extrabold text-sm text-slate-900 tracking-tight">
              <span className="text-blue-600">Deal</span><span className="text-cyan-500">Mee</span> AI
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
        <div className="bg-white rounded-3xl p-6 sm:p-12 shadow-sm border border-slate-200/80 space-y-10">
          {/* Document Header */}
          <div className="border-b border-slate-100 pb-8 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
              <FileText className="w-3.5 h-3.5" />
              <span>ข้อตกลงการใช้งานทางกฎหมาย</span>
            </div>
            <h1 className="font-heading text-2xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
              ข้อกำหนดและเงื่อนไขการให้บริการ
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              DealMee AI Platform (dealmee.app) • อัปเดตล่าสุดเมื่อ: {lastUpdated}
            </p>
          </div>

          {/* Quick Notice Alert */}
          <div className="rounded-2xl bg-blue-50/70 border border-blue-200/80 p-4 sm:p-5 flex items-start gap-3.5 text-xs sm:text-sm text-blue-900 leading-relaxed">
            <ShieldCheck className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">โปรดอ่านข้อตกลงนี้โดยละเอียดก่อนเริ่มใช้งาน</p>
              <p className="text-blue-800/90 mt-0.5">
                การสมัครสมาชิก หรือเข้าใช้งานระบบ DealMee AI ถือว่าท่านได้ยอมรับและตกลงที่จะปฏิบัติตามข้อกำหนดและเงื่อนไขทั้งหมดที่ระบุไว้ในเอกสารฉบับนี้
              </p>
            </div>
          </div>

          {/* Body Sections */}
          <div className="space-y-8 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                1. บทนำและข้อมูลเกี่ยวกับผู้ให้บริการ
              </h2>
              <p>
                แพลตฟอร์ม <strong>DealMee AI</strong> (ให้บริการผ่านเว็บไซต์ dealmee.app และระบบที่เกี่ยวข้อง) เป็นระบบซอฟต์แวร์บริการ (SaaS) ที่ช่วยร้านค้าและธุรกิจในการบริหารจัดการการขาย ตอบแชทอัตโนมัติบน LINE Official Account ด้วยเทคโนโลยีปัญญาประดิษฐ์ (AI Sales Agent), จัดทำใบเสนอราคา, สร้าง Dynamic PromptPay QR Code, ตรวจสอบสลิปโอนเงิน, และจัดการออเดอร์สินค้า
              </p>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                2. การสร้างบัญชีผู้ใช้งานและความปลอดภัย
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>ผู้ใช้บริการต้องให้ข้อมูลที่ถูกต้อง ครบถ้วน และเป็นจริงในการลงทะเบียนเปิดบัญชีร้านค้า</li>
                <li>ท่านมีหน้าที่เก็บรักษารหัสผ่าน ข้อมูลการเข้าสู่ระบบ และ Token เชื่อมต่อ (เช่น LINE Channel Secret, Access Token) ไว้เป็นความลับสูงสุด</li>
                <li>การกระทำใดๆ ที่เกิดขึ้นภายใต้บัญชีของท่าน ให้ถือว่าเป็นการกระทำของท่านเองทั้งสิ้น และ DealMee จะไม่รับผิดชอบต่อความเสียหายที่เกิดจากการละเลยการรักษาความปลอดภัยของบัญชีของท่าน</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                3. ขอบเขตการให้บริการและหน้าที่ของระบบ
              </h2>
              <p>ระบบของ DealMee AI มีฟังก์ชันการทำงานหลักดังนี้:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>AI Sales Closer</span>
                  </div>
                  <p className="text-[12px] text-slate-500">ตอบคำถามลูกค้า แนะนำสินค้า เชียร์ขาย และสรุปยอดสั่งซื้อตลอด 24 ชั่วโมง</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Dynamic PromptPay & Flex</span>
                  </div>
                  <p className="text-[12px] text-slate-500">สร้าง QR Code สแกนจ่ายตามยอดจริงและส่งใบเสนอราคา Flex Message หรูหรา</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ระบบตรวจสอบสลิปอัตโนมัติ</span>
                  </div>
                  <p className="text-[12px] text-slate-500">ตรวจสอบความถูกต้องและป้องกันสลิปโอนเงินปลอมผ่านระบบ API เชื่อมต่อธนาคาร</p>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Merchant Dashboard</span>
                  </div>
                  <p className="text-[12px] text-slate-500">ระบบบริหารสต็อก จัดการออเดอร์ และสลับตอบแชทด้วยตนเองได้ทุกเมื่อ</p>
                </div>
              </div>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                4. ข้อจำกัดและความรับผิดชอบเกี่ยวกับปัญญาประดิษฐ์ (AI)
              </h2>
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>คำชี้แจงสำคัญเกี่ยวกับเทคโนโลยี Generative AI</span>
                </div>
                <p className="text-xs leading-relaxed">
                  ปัญญาประดิษฐ์ (AI) ทำงานโดยการวิเคราะห์ข้อความและคลังความรู้ที่ร้านค้ากำหนดไว้ แม้ระบบจะมีกระบวนการควบคุมความถูกต้อง (Guardrails) แต่ AI อาจมีโอกาสสร้างคำตอบที่คลาดเคลื่อนได้ในบางกรณี ร้านค้าจึงมีหน้าที่ตรวจสอบความถูกต้องของข้อมูลสินค้า ราคา และนโยบายที่ป้อนเข้าสู่ระบบอย่างสม่ำเสมอ DealMee ไม่รับผิดชอบต่อความสูญเสียหรือความเสียหายอันเกิดจากข้อความที่ AI ประมวลผลจากข้อมูลที่ร้านค้าป้อนไม่ถูกต้อง
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                5. ค่าบริการ การชำระเงิน และนโยบายการคืนเงิน
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>ค่าบริการแพ็กเกจ (เช่น Starter, Pro, Business, BYOK) คิดเป็นรอบละ 30 วันตามที่แสดงในหน้าเว็บไซต์</li>
                <li>การชำระเงินทำโดยเติมเงินเข้ากระเป๋าเงิน (Wallet) ของร้านผ่าน PromptPay แล้วหักค่าแพ็กเกจหรือแพ็กเสริมจากยอดคงเหลือ ระบบต่ออายุแพ็กเกจจากยอดในกระเป๋าโดยอัตโนมัติเมื่อครบรอบ</li>
                <li>ท่านสามารถปิดการต่ออายุอัตโนมัติได้ทุกเมื่อ โดยระบบจะยังคงให้บริการจนสิ้นสุดรอบที่ได้ชำระไว้แล้ว</li>
                <li>เนื่องจากเป็นซอฟต์แวร์ประเภทดิจิทัลที่เปิดใช้งานทรัพยากรเซิร์ฟเวอร์และ AI API ทันทีหลังเปิดสิทธิ์ ค่าบริการที่ชำระแล้วจะไม่สามารถขอคืนเงิน (Non-refundable) ได้ เว้นแต่เป็นกรณีที่ระบบไม่สามารถให้บริการได้ตามเงื่อนไขที่ตกลงกันไว้</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                6. การเชื่อมต่อบริการภายนอก (Third-Party Services)
              </h2>
              <p>
                DealMee ทำงานร่วมกับผู้ให้บริการภายนอก ได้แก่ LINE Messaging API, Meta (Facebook Messenger), ผู้ให้บริการ AI (Google, OpenAI, Anthropic) และผู้ให้บริการตรวจสอบสลิป การหยุดชะงัก ช้า หรือข้อจำกัดที่เกิดจากนโยบายหรือโครงข่ายของผู้ให้บริการภายนอกดังกล่าวอยู่นอกเหนือการควบคุมของ DealMee
              </p>
            </section>

            {/* Section 7 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                7. ทรัพย์สินทางปัญญา
              </h2>
              <p>
                ซอร์สโค้ด การออกแบบ โลโก้ และเทคโนโลยีทั้งหมดของ DealMee เป็นทรัพย์สินทางปัญญาของผู้พัฒนา ส่วนข้อมูลสินค้า รูปภาพ แบรนด์ และข้อความของร้านค้า ยังคงเป็นทรัพย์สินของร้านค้าแต่เพียงผู้เดียว
              </p>
            </section>

            {/* Section 8 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                8. กฎหมายที่ใช้บังคับและช่องทางติดต่อ
              </h2>
              <p>
                ข้อกำหนดและเงื่อนไขนี้อยู่ภายใต้และการตีความตามกฎหมายของราชอาณาจักรไทย หากมีข้อสงสัยหรือข้อพิพาทใดๆ สามารถติดต่อทีมงานได้ที่:
              </p>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-slate-700">
                <p><strong>ทีมงานดูแลและสนับสนุน DealMee AI</strong></p>
                <p>อีเมล: <a href="mailto:support@dealmee.app" className="text-blue-600 font-semibold hover:underline">support@dealmee.app</a></p>
                <p>เว็บไซต์: <a href="https://dealmee.app" className="text-blue-600 hover:underline">https://dealmee.app</a></p>
              </div>
            </section>
          </div>

          {/* Footer Back Button */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link
              href="/"
              className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
            >
              ← กลับสู่หน้าหลัก DealMee AI
            </Link>
            <Link
              href="/privacy"
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              อ่านนโยบายความเป็นส่วนตัว (Privacy Policy) →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
