import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Shield, Lock, Eye, FileText, CheckCircle2 } from 'lucide-react'

export const metadata = {
  title: 'นโยบายความเป็นส่วนตัว (Privacy Policy) | DealMee AI',
  description: 'นโยบายคุ้มครองข้อมูลส่วนบุคคลตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) ของ DealMee AI',
}

export default function PrivacyPolicyPage() {
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold">
              <Shield className="w-3.5 h-3.5" />
              <span>คุ้มครองข้อมูลส่วนบุคคลตาม PDPA</span>
            </div>
            <h1 className="font-heading text-2xl sm:text-4xl font-semibold text-slate-900 tracking-tight">
              นโยบายความเป็นส่วนตัว (Privacy Policy)
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              DealMee AI Platform (dealmee.app) • อัปเดตล่าสุดเมื่อ: {lastUpdated}
            </p>
          </div>

          {/* Quick Notice Alert */}
          <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200/80 p-4 sm:p-5 flex items-start gap-3.5 text-xs sm:text-sm text-emerald-950 leading-relaxed">
            <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">คำมั่นสัญญาด้านความปลอดภัยของข้อมูล</p>
              <p className="text-emerald-800 mt-0.5">
                DealMee AI ให้ความสำคัญสูงสุดในการปกป้องข้อมูลส่วนบุคคลของท่านและลูกค้าของท่าน เราปฏิบัติตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA) อย่างเคร่งครัด
              </p>
            </div>
          </div>

          {/* Body Sections */}
          <div className="space-y-8 text-xs sm:text-sm text-slate-600 leading-relaxed">
            {/* Section 1 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                1. ข้อมูลส่วนบุคคลที่เราจัดเก็บ
              </h2>
              <p>เรามีการเก็บรวบรวมข้อมูลส่วนบุคคลเท่าที่จำเป็นต่อการให้บริการ โดยแบ่งออกเป็น 2 ส่วนหลัก:</p>

              <div className="space-y-3 pt-1">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <h3 className="font-heading font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600" />
                    <span>ข้อมูลของผู้ใช้บริการ (ร้านค้า / สมาชิก):</span>
                  </h3>
                  <ul className="list-disc pl-6 space-y-1 text-slate-600">
                    <li>ข้อมูลประจำตัว: ชื่อ-นามสกุล, ชื่อร้านค้า, หมายเลขโทรศัพท์</li>
                    <li>ข้อมูลบัญชี: ที่อยู่อีเมล, รหัสผ่านที่เข้ารหัสแล้ว (Hashed Password)</li>
                    <li>ข้อมูลการเงินเพื่อรับยอดขาย: หมายเลขบัญชีธนาคาร, เบอร์ PromptPay, ชื่อบัญชีสำหรับออก QR Code</li>
                    <li>ประวัติการใช้งาน: สถิติจำนวนข้อความแชท, ยอดการใช้งาน API, ประวัติการชำระค่าบริการแพ็กเกจ</li>
                  </ul>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
                  <h3 className="font-heading font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>ข้อมูลของลูกค้าปลายทาง (ลูกค้าที่คุยกับบอทใน LINE OA):</span>
                  </h3>
                  <ul className="list-disc pl-6 space-y-1 text-slate-600">
                    <li>LINE User ID, ชื่อโปรไฟล์ LINE</li>
                    <li>ข้อมูลที่ใช้ในการจัดส่งสินค้า: ชื่อผู้รับ, ที่อยู่จัดส่ง, หมายเลขโทรศัพท์ติดต่อ</li>
                    <li>ข้อมูลคำสั่งซื้อและยอดเงินที่ชำระ, รูปภาพสลิปโอนเงิน (เพื่อการตรวจยอดและกันสลิปปลอม)</li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 2 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                2. วัตถุประสงค์ในการประมวลผลข้อมูล
              </h2>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>เพื่อให้บริการระบบตอบแชทอัตโนมัติ AI และอำนวยความสะดวกในการปิดการขายตลอด 24 ชั่วโมง</li>
                <li>เพื่อสร้างและจัดส่งใบเสนอราคา (Flex Message) และ Dynamic PromptPay QR Code ให้แก่ลูกค้า</li>
                <li>เพื่อตรวจสอบความถูกต้องของสลิปโอนเงินและป้องกันการทุจริต</li>
                <li>เพื่อบันทึกคำสั่งซื้อ แจ้งเตือนยอดขายไปยังเจ้าของร้าน และจัดการคิวบริการ</li>
                <li>เพื่อการวิเคราะห์ปรับปรุงประสิทธิภาพของบอท AI และการสนับสนุนทางเทคนิค</li>
              </ul>
            </section>

            {/* Section 3 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                3. บทบาทตามกฎหมาย PDPA (ผู้ควบคุมข้อมูล vs. ผู้ประมวลผลข้อมูล)
              </h2>
              <p>
                ในความสัมพันธ์ระหว่างร้านค้าและ DealMee AI:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>ร้านค้า (ท่าน):</strong> ทำหน้าที่เป็น <em>"ผู้ควบคุมข้อมูลส่วนบุคคล" (Data Controller)</em> สำหรับข้อมูลของลูกค้าปลายทางของท่าน โดยท่านมีหน้าที่แจ้งนโยบายความเป็นส่วนตัวแก่ลูกค้าของท่านตามกฎหมาย</li>
                <li><strong>DealMee AI:</strong> ทำหน้าที่เป็น <em>"ผู้ประมวลผลข้อมูลส่วนบุคคล" (Data Processor)</em> โดยดำเนินการประมวลผลข้อมูลตามคำสั่งและการตั้งค่าของร้านค้าเท่านั้น และจะไม่นำข้อมูลของลูกค้าไปขายหรือเผยแพร่เพื่อประโยชน์อื่นใดทั้งสิ้น</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                4. มาตรการรักษาความปลอดภัยของข้อมูล
              </h2>
              <p>เราใช้มาตรฐานความปลอดภัยระดับสากลในการดูแลรักษาข้อมูล:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>การเข้ารหัสข้อมูล:</strong> ข้อมูลทั้งหมดที่ส่งผ่านเครือข่ายได้รับการเข้ารหัสด้วยโพรโทคอล HTTPS / TLS 1.3</li>
                <li><strong>ระบบฐานข้อมูลและการแบ่งแยกสิทธิ์:</strong> ฐานข้อมูลใช้ PostgreSQL บน Supabase พร้อมเทคโนโลยี Row Level Security (RLS) เพื่อให้แน่ใจว่าร้านค้าแต่ละแห่งจะสามารถเข้าถึงได้เฉพาะข้อมูลของตนเองเท่านั้น</li>
                <li><strong>การจัดเก็บ Token:</strong> Token ของ LINE OA และ Facebook ใช้เพื่อเชื่อมต่อช่องทางของร้านเท่านั้น และแยกสิทธิ์ตามร้านเช่นเดียวกับข้อมูลอื่น ส่วน API Key ของระบบ DealMee จัดเก็บแบบเข้ารหัส (AES-256)</li>
              </ul>
            </section>

            {/* Section 5 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                5. สิทธิของเจ้าของข้อมูลส่วนบุคคล
              </h2>
              <p>ตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 ท่านมีสิทธิดังต่อไปนี้:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>สิทธิในการขอเข้าถึงและขอรับสำเนาข้อมูลส่วนบุคคลของตนเอง</li>
                <li>สิทธิในการขอแก้ไขข้อมูลส่วนบุคคลให้ถูกต้อง เป็นปัจจุบัน และสมบูรณ์</li>
                <li>สิทธิในการขอลบ ทำลาย หรือระงับการใช้งานข้อมูลส่วนบุคคล</li>
                <li>สิทธิในการเพิกถอนความยินยอมในการประมวลผลข้อมูล</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section className="space-y-3">
              <h2 className="font-heading text-base sm:text-lg font-semibold text-slate-900">
                6. การติดต่อเจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล
              </h2>
              <p>
                หากท่านมีข้อสงสัย ข้อเสนอแนะ หรือต้องการใช้สิทธิเกี่ยวกับข้อมูลส่วนบุคคลของท่าน สามารถติดต่อเราได้ที่:
              </p>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1 text-slate-700">
                <p><strong>เจ้าหน้าที่คุ้มครองข้อมูลส่วนบุคคล (DPO) - DealMee AI</strong></p>
                <p>อีเมล: <a href="mailto:privacy@dealmee.app" className="text-blue-600 font-semibold hover:underline">privacy@dealmee.app</a> หรือ <a href="mailto:support@dealmee.app" className="text-blue-600 hover:underline">support@dealmee.app</a></p>
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
              href="/terms"
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              อ่านเงื่อนไขการให้บริการ (Terms of Service) →
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
