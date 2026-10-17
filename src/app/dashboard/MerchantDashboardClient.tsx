'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  Sparkles,
  MessageSquare,
  Package,
  ShoppingBag,
  Banknote,
  Send,
  Megaphone,
  PlusSquare,
  Brain,
  QrCode,
  Zap,
  CheckCircle2,
} from 'lucide-react'
import ChatPlaygroundModal from './components/ChatPlaygroundModal'
import SetupChecklistCard, { type SetupChecklistItem } from './components/SetupChecklistCard'
import { PushQuotaInfo } from '@/lib/billing/pushQuota'

export interface MerchantDashboardProps {
  shopName: string
  botName: string
  botStatus: string
  plan: string
  productsCount: number
  knowledgeCount: number
  ordersCount: number
  totalRevenue: number
  totalMessages: number
  latestKnowledgeTitle: string
  latestKnowledgeDate: string
  pushQuotaInfo?: PushQuotaInfo
  setupChecklist?: SetupChecklistItem[]
}

export default function MerchantDashboardClient({
  shopName,
  botName,
  botStatus,
  plan,
  productsCount,
  knowledgeCount,
  ordersCount,
  totalRevenue,
  totalMessages,
  latestKnowledgeTitle,
  latestKnowledgeDate,
  setupChecklist = [],
  pushQuotaInfo = {
    totalQuota: 300,
    usedCount: 0,
    remainingCount: 300,
    period: new Date().toISOString().slice(0, 7),
    planName: 'PRO',
  },
}: MerchantDashboardProps) {
  const [isPlaygroundOpen, setIsPlaygroundOpen] = useState(false)

  const usedPercentage = Math.min(100, Math.round((pushQuotaInfo.usedCount / pushQuotaInfo.totalQuota) * 100))
  const remainingPercentage = 100 - usedPercentage

  return (
    <div className="flex flex-col w-full relative">
      {/* Ambient Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-fixed-dim/20 via-transparent to-secondary-fixed/20 pointer-events-none -z-10"></div>
      <div className="absolute top-20 right-20 w-96 h-96 bg-electric-blue/10 rounded-full blur-[100px] pointer-events-none -z-10"></div>
      <div className="absolute bottom-40 left-10 w-72 h-72 bg-tertiary-fixed-dim/10 rounded-full blur-[80px] pointer-events-none -z-10"></div>

      {/* Content Container */}
      <div className="px-4 sm:px-6 md:px-8 py-4 sm:py-6 space-y-5 sm:space-y-6 max-w-[1440px] mx-auto w-full">

        {/* Page Header & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
          <div>
            <h1 className="font-headline-md text-xl sm:text-2xl text-on-surface font-bold leading-tight">
              ภาพรวมระบบร้าน "{shopName}"
            </h1>
            <p className="font-body-md text-xs sm:text-sm text-on-surface-variant flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${botStatus === 'active' ? 'bg-success-green animate-pulse' : 'bg-warning-amber'}`}></span>
              พนักงาน AI ({botName}): {botStatus === 'active' ? 'กำลังทำงานปกติ' : 'หยุดพักชั่วคราว'}
              <span className="ml-2 px-2 py-0.5 rounded-md bg-electric-blue/10 text-electric-blue font-semibold text-[11px] uppercase">
                แพ็กเกจ {plan}
              </span>
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/dashboard/knowledge"
              className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 bg-surface-container rounded-xl text-on-surface hover:bg-surface-container-high transition-all duration-150 active:scale-[0.98] shadow-sm font-label-md text-xs font-semibold group cursor-pointer border border-outline-variant/40"
            >
              <Sparkles className="h-4 w-4 text-electric-blue" />
              <span>คลังความรู้ ({knowledgeCount})</span>
            </Link>
            <button
              onClick={() => setIsPlaygroundOpen(true)}
              className="flex-1 sm:flex-initial min-h-[44px] flex items-center justify-center gap-1.5 px-3.5 sm:px-4 py-2 bg-electric-blue rounded-xl text-white hover:bg-primary transition-all duration-150 active:scale-[0.98] shadow-md shadow-electric-blue/20 font-label-md text-xs font-semibold group cursor-pointer border-none"
            >
              <MessageSquare className="h-4 w-4 text-white" />
              <span>ทดสอบสนทนา</span>
            </button>
          </div>
        </div>

        <SetupChecklistCard items={setupChecklist} />

        {/* 4 Real Metric KPI Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 relative z-10">

          {/* KPI 1: AI Messages Handled */}
          <div className="bg-surface/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group border border-outline-variant/30 flex flex-col justify-between h-full min-h-[110px]">
            <div className="flex justify-between items-start mb-3 relative z-10">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <MessageSquare className="h-4 w-4" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-success-green/10 text-success-green font-label-sm flex items-center gap-1 text-[10px] font-semibold">
                <CheckCircle2 className="h-3 w-3" /> เรียลไทม์
              </span>
            </div>
            <div>
              <p className="font-label-md text-xs text-on-surface-variant mb-0.5 relative z-10 font-medium truncate">ข้อความตอบสะสม</p>
              <h3 className="font-headline-md text-lg sm:text-2xl font-bold text-on-surface relative z-10 font-mono">
                {totalMessages.toLocaleString()}
              </h3>
            </div>
          </div>

          {/* KPI 2: Products Count */}
          <div className="bg-surface/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group border border-outline-variant/30 flex flex-col justify-between h-full min-h-[110px]">
            <div className="flex justify-between items-start mb-3 relative z-10">
              <div className="w-8 h-8 rounded-xl bg-secondary flex items-center justify-center text-secondary-foreground shrink-0">
                <Package className="h-4 w-4" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-electric-blue/10 text-electric-blue font-label-sm flex items-center gap-1 text-[10px] font-semibold">
                สินค้า
              </span>
            </div>
            <div>
              <p className="font-label-md text-xs text-on-surface-variant mb-0.5 relative z-10 font-medium truncate">รายการสินค้าพร้อมส่ง</p>
              <h3 className="font-headline-md text-lg sm:text-2xl font-bold text-on-surface relative z-10 font-mono">
                {productsCount.toLocaleString()} <span className="text-xs font-normal text-on-surface-variant font-sans">รายการ</span>
              </h3>
            </div>
          </div>

          {/* KPI 3: Total Orders */}
          <div className="bg-surface/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group border border-outline-variant/30 flex flex-col justify-between h-full min-h-[110px]">
            <div className="flex justify-between items-start mb-3 relative z-10">
              <div className="w-8 h-8 rounded-xl bg-warning-amber/10 flex items-center justify-center text-warning-amber shrink-0">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-success-green/10 text-success-green font-label-sm flex items-center gap-1 text-[10px] font-semibold">
                <CheckCircle2 className="h-3 w-3" /> สำเร็จ
              </span>
            </div>
            <div>
              <p className="font-label-md text-xs text-on-surface-variant mb-0.5 relative z-10 font-medium truncate">คำสั่งซื้อทั้งหมด</p>
              <h3 className="font-headline-md text-lg sm:text-2xl font-bold text-on-surface relative z-10 font-mono">
                {ordersCount.toLocaleString()} <span className="text-xs font-normal text-on-surface-variant font-sans">ออเดอร์</span>
              </h3>
            </div>
          </div>

          {/* KPI 4: Total Sales Revenue */}
          <div className="bg-surface/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group border border-outline-variant/30 flex flex-col justify-between h-full min-h-[110px]">
            <div className="flex justify-between items-start mb-3 relative z-10">
              <div className="w-8 h-8 rounded-xl bg-success-green/10 flex items-center justify-center text-success-green shrink-0">
                <Banknote className="h-4 w-4" />
              </div>
              <span className="px-2 py-0.5 rounded-md bg-success-green/10 text-success-green font-label-sm flex items-center gap-1 text-[10px] font-semibold">
                ยอดขาย
              </span>
            </div>
            <div>
              <p className="font-label-md text-xs text-on-surface-variant mb-0.5 relative z-10 font-medium truncate">ยอดขายสะสมในระบบ</p>
              <h3 className="font-headline-md text-lg sm:text-2xl font-bold text-on-surface relative z-10 font-mono">
                ฿{totalRevenue.toLocaleString()}
              </h3>
            </div>
          </div>

        </div>

        {/* LINE Push Quota & Broadcast Monitor Banner */}
        <div className="bg-surface/90 backdrop-blur-xl rounded-2xl p-4 sm:p-5 shadow-sm border border-outline-variant/30 text-on-surface relative overflow-hidden group z-10 space-y-3.5">
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-electric-blue/10 border border-electric-blue/20 flex items-center justify-center text-electric-blue shrink-0 shadow-sm">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h3 className="font-bold text-sm sm:text-base text-on-surface font-headline-md">
                    โควต้า LINE Push
                  </h3>
                  <span className="px-2 py-0.5 rounded-md bg-surface-container-high text-on-surface-variant text-[10px] sm:text-xs font-medium border border-outline-variant/50 font-mono">
                    {pushQuotaInfo.period}
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-on-surface-variant font-medium">
                  แพ็กเกจ <span className="font-semibold text-on-surface">{pushQuotaInfo.planName}</span>
                </p>
              </div>
            </div>

            {/* Quota Badge */}
            <div className="px-3.5 py-1.5 rounded-xl bg-electric-blue/10 border border-electric-blue/20 text-right shrink-0">
              <div className="text-[11px] text-electric-blue font-bold">คงเหลือ</div>
              <div className="text-sm sm:text-base font-extrabold text-on-surface font-mono">
                {pushQuotaInfo.remainingCount.toLocaleString()} <span className="text-xs font-medium text-on-surface-variant">/ {pushQuotaInfo.totalQuota.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Description & Note */}
          <div className="text-xs text-on-surface-variant font-medium leading-relaxed bg-surface-container-low/80 p-3 rounded-xl border border-outline-variant/40">
            โควต้าข้อความสำหรับยิงบรอดแคสต์โปรโมชัน{' '}
            <span className="text-electric-blue font-semibold block sm:inline mt-0.5 sm:mt-0">
              (ตอบแชท AI ปกติใช้ Reply API ฟรี 100% ไม่ถูกหักโควต้านี้)
            </span>
          </div>

          {/* Quota Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs sm:text-sm font-semibold">
              <span className="text-on-surface-variant">
                ใช้ไปแล้ว <span className="text-on-surface font-bold font-mono">{pushQuotaInfo.usedCount.toLocaleString()}</span> ข้อความ ({usedPercentage}%)
              </span>
              <span className="text-electric-blue font-bold">
                คงเหลือ {remainingPercentage}% ({pushQuotaInfo.remainingCount.toLocaleString()} ข้อความ)
              </span>
            </div>
            <div className="w-full bg-surface-container-highest rounded-full h-2.5 overflow-hidden border border-outline-variant/40">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  remainingPercentage > 50
                    ? 'bg-gradient-to-r from-electric-blue to-blue-500 shadow-sm shadow-electric-blue/30'
                    : remainingPercentage > 15
                    ? 'bg-amber-500 shadow-sm shadow-amber-500/30'
                    : 'bg-rose-500 shadow-sm shadow-rose-500/30'
                }`}
                style={{ width: `${Math.max(2, remainingPercentage)}%` }}
              ></div>
            </div>
          </div>

          {/* Bottom Action Row */}
          <div className="pt-1 flex items-center justify-end">
            <Link
              href="/dashboard/broadcast"
              className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-1.5 px-4 py-2.5 bg-electric-blue hover:bg-primary text-white font-bold text-xs rounded-xl shadow-md shadow-electric-blue/20 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Megaphone className="h-4 w-4" />
              <span>ส่งบรอดแคสต์หาลูกค้า</span>
            </Link>
          </div>
        </div>

        {/* Dynamic Activity Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 relative z-10">
          {/* Quick Management Shortcuts */}
          <div className="lg:col-span-2 bg-surface/90 backdrop-blur-xl rounded-2xl p-5 shadow-sm border border-outline-variant/30 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headline-md text-base sm:text-lg font-bold text-on-surface">เมนูจัดการด่วนสำหรับร้านค้า</h2>
                <p className="font-label-md text-xs text-on-surface-variant font-medium">เข้าถึงฟีเจอร์หลักในการดูแลร้านค้าและ AI</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Link href="/dashboard/products" className="p-4 rounded-xl bg-surface-container/60 hover:bg-surface-container transition-all active:scale-[0.98] border border-outline-variant/30 flex flex-col gap-2 group">
                <div className="w-9 h-9 rounded-lg bg-electric-blue/10 flex items-center justify-center text-electric-blue group-hover:scale-110 transition-transform">
                  <PlusSquare className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-on-surface">เพิ่ม / นำเข้าสินค้า</h3>
                <p className="text-xs text-on-surface-variant">จัดการแคตตาล็อกสินค้าพร้อมส่ง และเขียนคำอธิบายด้วย AI</p>
              </Link>

              <Link href="/dashboard/knowledge" className="p-4 rounded-xl bg-surface-container/60 hover:bg-surface-container transition-all active:scale-[0.98] border border-outline-variant/30 flex flex-col gap-2 group">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                  <Brain className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-on-surface">ฝึกอบรมคลังความรู้ AI</h3>
                <p className="text-xs text-on-surface-variant">เพิ่มข้อมูล FAQ, โปรโมชั่น และข้อมูลตอบคำถามของร้าน</p>
              </Link>

              <Link href="/dashboard/settings" className="p-4 rounded-xl bg-surface-container/60 hover:bg-surface-container transition-all active:scale-[0.98] border border-outline-variant/30 flex flex-col gap-2 group">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                  <QrCode className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-sm text-on-surface">ตั้งค่าบัญชีโอนเงิน</h3>
                <p className="text-xs text-on-surface-variant">กำหนดเลขพร้อมเพย์ ธนาคาร และข้อความทักทายลูกค้า</p>
              </Link>
            </div>
          </div>

          {/* AI Knowledge Overview Panel */}
          <div className="bg-surface-container/60 backdrop-blur-md rounded-2xl p-4 sm:p-5 shadow-sm flex flex-col justify-between border border-outline-variant/30">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-secondary-foreground shrink-0">
                  <Brain className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-headline-md text-base font-bold text-on-surface leading-tight">คลังความรู้ AI ของร้าน</h3>
                  <p className="font-label-md text-xs font-medium text-on-surface-variant">
                    {latestKnowledgeDate ? `อัปเดตล่าสุด: ${latestKnowledgeDate}` : 'ยังไม่มีข้อมูลความรู้'}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="bg-surface rounded-xl p-3.5 shadow-xs flex items-start gap-3 border border-outline-variant/20">
                  <CheckCircle2 className="h-4 w-4 text-success-green mt-0.5 shrink-0" />
                  <div>
                    <p className="font-label-md text-xs font-bold text-on-surface">
                      {latestKnowledgeTitle || 'คลังข้อมูลสินค้าและคำถามพบบ่อย'}
                    </p>
                    <p className="font-label-sm text-[11px] font-medium text-outline mt-0.5">
                      พร้อมใช้งานในคลังความรู้ ({knowledgeCount} รายการ)
                    </p>
                  </div>
                </div>

                <div className="bg-surface rounded-xl p-3.5 shadow-xs flex items-start gap-3 relative overflow-hidden border border-outline-variant/20">
                  <Zap className="h-4 w-4 text-electric-blue mt-0.5 shrink-0" />
                  <div>
                    <p className="font-label-md text-xs font-bold text-on-surface">DealMee Brain Engine™</p>
                    <p className="font-label-sm text-[11px] font-medium text-outline mt-0.5">
                      สลับโมเดลอัตโนมัติ (Gemini 3.6 Flash / Claude Sonnet 5)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-outline-variant/30">
              <p className="font-label-sm text-[10px] font-bold text-outline uppercase tracking-wider mb-1.5">คำแนะนำ</p>
              <p className="font-body-md text-xs text-on-surface-variant italic bg-surface/50 p-3 rounded-xl relative border border-outline-variant/20 leading-relaxed">
                "AI จะดึงข้อมูลจากคลังความรู้ {knowledgeCount} รายการและสินค้า {productsCount} ชิ้นไปตอบลูกค้าแบบอัตโนมัติใน LINE OA"
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Interactive Chat Playground Simulator Modal */}
      <ChatPlaygroundModal
        isOpen={isPlaygroundOpen}
        onClose={() => setIsPlaygroundOpen(false)}
        initialBotName={botName}
      />
    </div>
  )
}
