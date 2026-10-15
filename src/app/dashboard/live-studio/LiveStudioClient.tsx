'use client'

import React, { useState } from 'react'
import {
  Radio,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ShoppingBag,
  Send,
  MessageSquare,
  Flame,
  CheckCircle2,
  Tv,
  Layers,
  HelpCircle,
  Database,
  RefreshCw,
} from 'lucide-react'
import { LiveSessionState, LiveBasketItem } from '@/lib/live/liveStudioEngine'

interface LiveStudioClientProps {
  shop: any
  initialLiveState: LiveSessionState
}

export default function LiveStudioClient({ shop, initialLiveState }: LiveStudioClientProps) {
  const [liveState, setLiveState] = useState<LiveSessionState>(initialLiveState)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [simUsername, setSimUsername] = useState('ลูกค้าใจดี')
  const [simComment, setSimComment] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [lastBotReply, setLastBotReply] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'baskets' | 'settings'>('baskets')
  const [showSqlModal, setShowSqlModal] = useState(false)

  // Construct absolute OBS overlay URL
  const obsOverlayUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/live/overlay/${shop.id}`
    : `https://dealmee.app/live/overlay/${shop.id}`

  const handleCopyObsUrl = () => {
    navigator.clipboard.writeText(obsOverlayUrl)
    setCopiedUrl(true)
    setTimeout(() => setCopiedUrl(false), 2500)
  }

  // Quick test comment buttons
  const quickTestComments = [
    { label: '🛒 ขอดูตะกร้า 1', text: 'ขอดูตะกร้า 1 หน่อยค่ะ' },
    { label: '👖 ขอดูตะกร้า 2', text: 'ขอดูตะกร้า 2 หน่อยค่ะ' },
    { label: '👜 ขอดูตะกร้า 3', text: 'ขอดูตะกร้า 3 หน่อยค่ะ' },
    { label: '🎉 พิมพ์ CF 1 ตัว', text: 'CF 1 ตัวค่ะ พร้อมโอน' },
    { label: '🚚 ถามเรื่องค่าส่ง', text: 'ส่งฟรีกี่บาทคะ' },
    { label: '📦 เก็บปลายทางไหม', text: 'มีเก็บเงินปลายทางไหมคะ' },
  ]

  const handleSendComment = async (customText?: string) => {
    const textToSend = customText || simComment
    if (!textToSend.trim()) return

    setIsSending(true)
    try {
      const res = await fetch('/api/live/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shop.id,
          username: simUsername || 'ผู้ชมไลฟ์',
          comment_text: textToSend.trim(),
          platform: 'tiktok',
        }),
      })

      const data = await res.json()
      if (data.success && data.state) {
        setLiveState(data.state)
        setLastBotReply(data.ai_reply || 'ระบบรับเรื่องเรียบร้อยแล้วค่ะ')
        setSimComment('')
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsSending(false)
    }
  }

  const currentProduct = liveState.current_product || liveState.baskets[0]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Hero Streamer Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-rose-950 to-slate-900 border border-rose-500/20 p-6 sm:p-8 text-white shadow-xl shadow-rose-950/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-400 text-xs font-semibold mb-3">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>DealMee 24/7 AI Live Studio (Virtual Streamer)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              สตูดิโอ AI ไลฟ์สดขายของอัตโนมัติ 24 ชม.
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl">
              รองรับ TikTok Live, Facebook Live, และ Shopee Live โดยนำลิงก์ Browser Source
              ไปใส่ในโปรแกรม OBS Studio หน้าจอจะสลับการ์ดสินค้าตามคอมเมนต์ของผู้ชมอัตโนมัติในเสี้ยววินาที
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowSqlModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition-all cursor-pointer"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span>โครงสร้าง SQL Live Studio</span>
            </button>
          </div>
        </div>

        {/* OBS URL Copy Banner */}
        <div className="mt-6 p-4 rounded-2xl bg-slate-950/80 border border-white/10 backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 shrink-0">
              <Tv className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-semibold text-slate-400 block">
                OBS Browser Source Widget URL (สำหรับแปะในโปรแกรม OBS):
              </span>
              <span className="text-xs sm:text-sm font-mono text-white truncate block">
                {obsOverlayUrl}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyObsUrl}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/30 cursor-pointer"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'คัดลอกเรียบร้อย!' : 'คัดลอกลิงก์ OBS'}</span>
            </button>
            <a
              href={`/live/overlay/${shop.id}`}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all"
              title="เปิดดูพรีวิวแบบเต็มจอ"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* 2-Column Interactive Workspace: Left = Live Screen Simulation, Right = Real-time Comment Simulator */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Live Streamer Screen Mockup (5 Cols) */}
        <div className="lg:col-span-5 bg-slate-950 border border-slate-800 rounded-3xl p-5 text-white flex flex-col justify-between shadow-lg relative overflow-hidden min-h-[480px]">
          {/* Simulated Streamer Background video/poster */}
          <div className="absolute inset-0 z-0 opacity-40">
            <img
              src="https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80"
              alt="Live Backdrop"
              className="w-full h-full object-cover blur-[2px]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          </div>

          {/* Top Live Ticker Overlay */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600/90 text-white text-xs font-black shadow-lg">
              <span className="w-2 h-2 rounded-full bg-white animate-ping" />
              <span>LIVE</span>
              <span className="text-[10px] opacity-80">| 1.4k ผู้ชม</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-md px-3 py-1 rounded-full border border-white/10 text-xs">
              <ShoppingBag className="w-3.5 h-3.5 text-amber-400" />
              <span>ออเดอร์ CF: {liveState.total_cf_orders}</span>
            </div>
          </div>

          {/* Bottom Overlay Area (Dynamic Product Card in action) */}
          <div className="relative z-10 space-y-3 mt-auto pt-24">
            {/* Pop-up Comment Bubble */}
            {liveState.recent_comments && liveState.recent_comments.length > 0 && (
              <div className="animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900/90 backdrop-blur-md border border-blue-500/40 text-xs text-white shadow-xl max-w-xs">
                  <span className="font-bold text-blue-400">
                    {liveState.recent_comments[0].username}:
                  </span>
                  <span className="truncate">
                    "{liveState.recent_comments[0].comment_text}"
                  </span>
                </div>
              </div>
            )}

            {/* Active Pinned Dynamic Product Card */}
            {currentProduct && (
              <div className="rounded-2xl border border-white/20 bg-slate-950/90 backdrop-blur-xl p-3 shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="px-2 py-0.5 rounded-md bg-rose-600 font-extrabold text-[11px] text-white">
                    ตะกร้า #{currentProduct.basket_no}
                  </span>
                  <span className="text-[11px] text-amber-400 font-bold flex items-center gap-1">
                    <Flame className="w-3 h-3" /> เหลือ {currentProduct.stock} ชิ้น
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <img
                    src={currentProduct.image_url}
                    alt={currentProduct.product_name}
                    className="w-16 h-16 rounded-xl object-cover border border-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-extrabold text-white truncate">
                      {currentProduct.product_name}
                    </h4>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-xl font-black text-amber-400">
                        ฿{currentProduct.live_price.toLocaleString()}
                      </span>
                      <span className="text-xs text-slate-400 line-through">
                        ฿{currentProduct.regular_price.toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold block mt-0.5">
                      ✓ พิมพ์ "CF" เพื่อสั่งซื้อทันที
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Real-time Comment Simulator (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-rose-500" />
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  ตัวทดสอบคอมเมนต์สด (Live Comment Simulator)
                </h3>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                สถานะระบบ: AI พร้อมสลับตะกร้า Real-time
              </span>
            </div>

            {/* Quick Test Buttons */}
            <div className="mt-4">
              <span className="text-xs font-bold text-slate-500 block mb-2">
                คลิกทดสอบสถานการณ์ด่วน (จำลองผู้ชมพิมพ์ในไลฟ์):
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {quickTestComments.map((btn, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendComment(btn.text)}
                    disabled={isSending}
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-800 text-xs font-bold text-slate-700 dark:text-slate-300 transition-all text-left flex items-center justify-between cursor-pointer disabled:opacity-50"
                  >
                    <span>{btn.label}</span>
                    <Sparkles className="w-3 h-3 text-rose-500 shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Last Bot Voice / Reply Toast */}
            {lastBotReply && (
              <div className="mt-4 p-4 rounded-2xl bg-gradient-to-r from-rose-500/10 to-indigo-500/10 border border-rose-500/30 text-xs sm:text-sm text-slate-800 dark:text-slate-200 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 font-bold mb-1">
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>เสียง AI สตรีมเมอร์ตอบกลับผู้ชมในไลฟ์สด:</span>
                </div>
                <p className="font-medium italic">"{lastBotReply}"</p>
              </div>
            )}

            {/* Live Comment Feed List */}
            <div className="mt-4 space-y-2">
              <span className="text-xs font-bold text-slate-500 block">
                ประวัติคอมเมนต์สดในไลฟ์ ({liveState.total_comments} คอมเมนต์):
              </span>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {liveState.recent_comments?.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {c.username}
                      </span>
                      <span className="text-slate-400 ml-2">({c.platform}):</span>
                      <p className="mt-0.5 text-slate-700 dark:text-slate-300 font-medium">
                        "{c.comment_text}"
                      </p>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.action_type === 'basket_switch'
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400'
                          : c.action_type === 'cf_order'
                          ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {c.action_type === 'basket_switch'
                        ? `สลับตะกร้า #${c.basket_no_triggered}`
                        : c.action_type === 'cf_order'
                        ? 'สั่งซื้อ CF'
                        : 'ตอบคำถาม'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Interactive Input Form */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              placeholder="ชื่อผู้ชม (เช่น คุณแอน)"
              value={simUsername}
              onChange={(e) => setSimUsername(e.target.value)}
              className="sm:w-36 px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
            />
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                placeholder="พิมพ์ข้อความ เช่น 'ขอดูตะกร้า 2', 'CF เสื้อยืด'..."
                value={simComment}
                onChange={(e) => setSimComment(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendComment()}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none"
              />
              <button
                onClick={() => handleSendComment()}
                disabled={isSending || !simComment.trim()}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-rose-600/30 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>ส่ง</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Basket Lineup Organizer Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800 mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-900 dark:text-white text-base">
              ผังตะกร้าสินค้าในไลฟ์ (Live Basket Lineup)
            </h3>
          </div>
          <span className="text-xs text-slate-500">
            {liveState.baskets.length} รายการพร้อมขายบนจอไลฟ์
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                <th className="py-3 px-4">เลขตะกร้า</th>
                <th className="py-3 px-4">สินค้า</th>
                <th className="py-3 px-4">ราคาปกติ</th>
                <th className="py-3 px-4">ราคาพิเศษในไลฟ์</th>
                <th className="py-3 px-4">สต็อกคงเหลือ</th>
                <th className="py-3 px-4">ป้ายไฮไลท์</th>
                <th className="py-3 px-4 text-right">การกระทำ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {liveState.baskets.map((b) => (
                <tr
                  key={b.basket_no}
                  className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all ${
                    b.basket_no === liveState.current_basket_no
                      ? 'bg-rose-50/40 dark:bg-rose-950/20'
                      : ''
                  }`}
                >
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-xl bg-slate-900 text-white font-black text-xs">
                      #{b.basket_no}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={b.image_url}
                        alt={b.product_name}
                        className="w-10 h-10 rounded-lg object-cover border border-slate-200 dark:border-slate-700"
                      />
                      <span className="font-bold text-slate-900 dark:text-white">
                        {b.product_name}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-slate-400 line-through">
                    ฿{b.regular_price.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-black text-amber-500">
                    ฿{b.live_price.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {b.stock} ชิ้น
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold text-slate-700 dark:text-slate-300">
                      {b.highlight_tag || 'สินค้าขายดี'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleSendComment(`ขอดูตะกร้า ${b.basket_no}`)}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-100 transition-all cursor-pointer"
                    >
                      สลับขึ้นจอทันที
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SQL Migration Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">คำสั่ง SQL สำหรับ DealMee Live Studio</h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕ ปิด
              </button>
            </div>

            <p className="text-xs text-slate-400 my-4">
              คัดลอกคำสั่งด้านล่างไปวางใน <strong>Supabase Dashboard ➡️ SQL Editor</strong> เพื่อสร้างตารางสำหรับ Live Studio (ปัจจุบันระบบมีโหมดสำรองข้อมูลอัตโนมัติให้แล้ว จึงใช้งานได้ทันทีแม้ยังไม่รัน SQL ครับ)
            </p>

            <pre className="bg-slate-950 p-4 rounded-xl text-xs text-emerald-400 font-mono overflow-x-auto max-h-72 border border-slate-800">
{`CREATE TABLE IF NOT EXISTS public.live_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'DealMee 24/7 AI Live Stream',
  platform VARCHAR(50) NOT NULL DEFAULT 'tiktok',
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  current_basket_no INT NOT NULL DEFAULT 1,
  current_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  total_comments INT NOT NULL DEFAULT 0,
  total_cf_orders INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.live_baskets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  basket_no INT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  custom_live_price NUMERIC(12, 2),
  highlight_tag TEXT DEFAULT 'สินค้าขายดี',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, basket_no)
);`}
            </pre>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText('CREATE TABLE IF NOT EXISTS public.live_sessions...')
                  alert('คัดลอกเรียบร้อย!')
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                <span>คัดลอกคำสั่ง SQL</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
