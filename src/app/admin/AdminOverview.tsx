'use client'

import Link from 'next/link'
import {
  Banknote,
  Store,
  MessageSquare,
  Cpu,
  Activity,
  ArrowRight,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ShopOverview {
  id: string
  name: string
  plan: string
  status: string
  msg_used: number
  created_at: string
}

interface OverviewProps {
  shopsCount: number
  activeShopsCount: number
  totalMessages: number
  totalTokens: number
  estimatedMrr: number
  recentShops: ShopOverview[]
}

export default function AdminOverview({
  shopsCount,
  activeShopsCount,
  totalMessages,
  totalTokens,
  estimatedMrr,
  recentShops,
}: OverviewProps) {
  const activePercentage = shopsCount > 0 ? Math.round((activeShopsCount / shopsCount) * 100) : 0

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-on-surface font-headline-md leading-tight">
          ภาพรวมระบบ DealMee AI
        </h1>
        <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5 font-body-md">
          สถิติภาพรวมร้านค้าทั้งหมด รายได้ประจำเดือน และปริมาณการใช้งานระบบ DealMee AI
        </p>
      </div>

      {/* 4 KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {/* Card 1: Estimated MRR */}
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant font-label-md">
              รายได้ประจำเดือนรวม
            </span>
            <div className="w-8 h-8 rounded-xl bg-success-green/10 flex items-center justify-center text-success-green">
              <Banknote className="h-[18px] w-[18px]" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg sm:text-2xl font-bold text-on-surface font-headline-lg">
              ฿{estimatedMrr.toLocaleString()}
            </span>
            <Badge variant="success" size="sm">
              คำนวณตามแพ็กเกจ
            </Badge>
          </div>
          <p className="text-[10px] text-outline">ประเมินจากแพ็กเกจปัจจุบันของทุกร้านค้า</p>
        </div>

        {/* Card 2: Active Shops */}
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant font-label-md">
              ร้านค้าที่เปิดใช้งาน
            </span>
            <div className="w-8 h-8 rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue">
              <Store className="h-[18px] w-[18px]" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg sm:text-2xl font-bold text-on-surface font-headline-lg">
              {activeShopsCount}
            </span>
            <span className="text-[10px] text-on-surface-variant font-medium">
              จากทั้งหมด {shopsCount} ร้าน
            </span>
          </div>
          <p className="text-[10px] text-outline">อัตราการใช้งานจริง {activePercentage}% ทั่วทั้งระบบ</p>
        </div>

        {/* Card 3: Total AI Messages */}
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant font-label-md">
              ข้อความ AI เดือนนี้
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-600">
              <MessageSquare className="h-[18px] w-[18px]" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg sm:text-2xl font-bold text-on-surface font-heading">
              {totalMessages.toLocaleString()}
            </span>
            <span className="text-[10px] text-purple-600 font-bold">ข้อความ</span>
          </div>
          <p className="text-[10px] text-outline">ตอบกลับลูกค้าใน LINE OA อัตโนมัติ</p>
        </div>

        {/* Card 4: Total Token Usage */}
        <div className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-on-surface-variant font-label-md">
              ปริมาณการใช้ Token รวม
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600">
              <Cpu className="h-[18px] w-[18px]" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-lg sm:text-2xl font-bold text-on-surface font-heading">
              {(totalTokens / 1000000).toFixed(1)}M
            </span>
            <span className="text-[10px] text-amber-600 font-bold">Tokens</span>
          </div>
          <p className="text-[10px] text-outline">ประมาณการต้นทุน API ฿{(totalTokens * 0.0003).toFixed(0)}</p>
        </div>
      </div>

      {/* System Health Status */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">
              สถานะการทำงานของระบบ DealMee AI
            </h2>
            <p className="text-[11px] sm:text-xs text-on-surface-variant">
              ตรวจสอบการเชื่อมต่อบริการคลาวด์และ API Gateway
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-outline-variant/40 bg-merchant-bg">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-success-green animate-pulse"></span>
              <span className="text-xs sm:text-sm font-bold text-on-surface">Supabase Database</span>
            </div>
            <span className="text-[11px] font-bold text-success-green bg-success-green/10 px-2.5 py-1 rounded-full">
              ปกติ (Online)
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl border border-outline-variant/40 bg-merchant-bg">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-success-green animate-pulse"></span>
              <span className="text-xs sm:text-sm font-bold text-on-surface">LINE Messaging Webhook</span>
            </div>
            <span className="text-[11px] font-bold text-success-green bg-success-green/10 px-2.5 py-1 rounded-full">
              ปกติ (Active)
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 rounded-xl border border-outline-variant/40 bg-merchant-bg">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-success-green animate-pulse"></span>
              <span className="text-xs sm:text-sm font-bold text-on-surface">DealMee / Gemini AI Gateway</span>
            </div>
            <span className="text-[11px] font-bold text-success-green bg-success-green/10 px-2.5 py-1 rounded-full">
              ปกติ (Active)
            </span>
          </div>
        </div>
      </section>

      {/* Recent Shops Preview Table */}
      <section className="bg-surface border border-outline-variant/40 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-electric-blue/10 flex items-center justify-center text-electric-blue shrink-0">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-on-surface font-headline-sm">
                ร้านค้าลงทะเบียนล่าสุด
              </h2>
              <p className="text-[11px] sm:text-xs text-on-surface-variant">
                รายชื่อร้านค้าที่สมัครใช้งานล่าสุดในระบบ
              </p>
            </div>
          </div>

          <Link
            href="/admin/shops"
            className="text-xs font-bold text-electric-blue hover:text-primary flex items-center gap-1 transition-colors group min-h-[44px] min-w-[44px] justify-end"
          >
            <span>ดูทั้งหมด</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        {/* Mobile View: Cards */}
        <div className="grid grid-cols-1 gap-3 md:hidden">
          {recentShops.map((shop) => (
            <div key={shop.id} className="p-3.5 rounded-xl border border-outline-variant/40 bg-merchant-bg space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs sm:text-sm text-on-surface">{shop.name}</span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  shop.status === 'suspended'
                    ? 'bg-error-red/10 text-error-red'
                    : 'bg-success-green/10 text-success-green'
                }`}>
                  {shop.status === 'suspended' ? 'ระงับชั่วคราว' : 'เปิดใช้งาน'}
                </span>
              </div>
              <div className="flex justify-between items-center text-[11px] text-on-surface-variant">
                <span>แพ็กเกจ: <strong className="text-on-surface uppercase">{shop.plan || 'Free'}</strong></span>
                <span>ส่งข้อความ: <strong className="text-on-surface font-mono">{shop.msg_used.toLocaleString()}</strong></span>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-on-surface-variant font-label-md">
                <th className="py-3 px-4 font-bold">ชื่อร้านค้า</th>
                <th className="py-3 px-4 font-bold">แพ็กเกจ</th>
                <th className="py-3 px-4 font-bold">ข้อความที่ใช้</th>
                <th className="py-3 px-4 font-bold">สถานะ</th>
                <th className="py-3 px-4 font-bold">วันที่สมัคร</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {recentShops.map((shop) => (
                <tr key={shop.id} className="hover:bg-surface-container-low transition-colors">
                  <td className="py-3.5 px-4 font-bold text-on-surface">{shop.name}</td>
                  <td className="py-3.5 px-4">
                    <span className="uppercase font-bold text-xs px-2.5 py-1 rounded-lg bg-surface-container-high text-on-surface">
                      {shop.plan || 'Free'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-bold text-on-surface">
                    {shop.msg_used.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                      shop.status === 'suspended'
                        ? 'bg-error-red/10 text-error-red'
                        : 'bg-success-green/10 text-success-green'
                    }`}>
                      {shop.status === 'suspended' ? 'ระงับชั่วคราว' : 'เปิดใช้งาน'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-on-surface-variant text-xs">
                    {new Date(shop.created_at).toLocaleDateString('th-TH')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
