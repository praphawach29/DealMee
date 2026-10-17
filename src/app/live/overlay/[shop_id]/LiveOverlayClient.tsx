'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Sparkles, ShoppingBag, Flame, Radio, CheckCircle2, Zap } from 'lucide-react'
import { LiveSessionState, LiveCommentItem, LiveOrderSummary } from '@/lib/live/liveStudioEngine'

interface LiveOverlayClientProps {
  shopId: string
  initialState: LiveSessionState
}

export default function LiveOverlayClient({ shopId, initialState }: LiveOverlayClientProps) {
  const [state, setState] = useState<LiveSessionState>(initialState)
  const [isAnimating, setIsAnimating] = useState(false)
  const [latestComment, setLatestComment] = useState<LiveCommentItem | null>(
    initialState.recent_comments?.[0] || null
  )
  const [activeCfToast, setActiveCfToast] = useState<LiveOrderSummary | null>(
    initialState.latest_cf_order || null
  )
  const [showCfBanner, setShowCfBanner] = useState(false)
  const lastSeenOrderIdRef = useRef<string | null>(initialState.latest_cf_order?.id || null)

  // Polling for instant OBS overlay updates (every 1 second)
  useEffect(() => {
    let prevBasket = state.current_basket_no

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/comment?shop_id=${shopId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.state) {
            // Check basket switch
            if (data.state.current_basket_no !== prevBasket) {
              setIsAnimating(true)
              setTimeout(() => setIsAnimating(false), 500)
              prevBasket = data.state.current_basket_no
            }

            // Check new CF order celebration toast
            const incomingCf = data.state.latest_cf_order
            if (incomingCf && incomingCf.id !== lastSeenOrderIdRef.current) {
              lastSeenOrderIdRef.current = incomingCf.id
              setActiveCfToast(incomingCf)
              setShowCfBanner(true)
              setTimeout(() => {
                setShowCfBanner(false)
              }, 4500)
            }

            setState(data.state)
            if (data.state.recent_comments && data.state.recent_comments.length > 0) {
              setLatestComment(data.state.recent_comments[0])
            }
          }
        }
      } catch (_err) {
        // Silent catch for live polling stability
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [shopId, state.current_basket_no])

  const product = state.current_product || state.baskets[0]

  if (!product) {
    return null
  }

  const savings = Math.max(0, product.regular_price - product.live_price)

  return (
    <div className="w-full h-full relative p-6 sm:p-10 flex flex-col justify-between items-start pointer-events-none font-sans overflow-hidden">
      {/* Top Header Layer: Live Watermark & Live Order Counter */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-rose-500/40 text-white shadow-xl">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
          <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5" /> LIVE
          </span>
          <span className="text-xs text-slate-200 font-medium">| {state.title}</span>
        </div>

        {/* Live Sales Counter */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/85 backdrop-blur-md border border-amber-500/40 text-white shadow-xl">
            <ShoppingBag className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
            <span className="text-xs font-bold text-amber-300">
              ยอด CF ในไลฟ์: {state.total_cf_orders || 0} ออเดอร์
            </span>
          </div>
        </div>
      </div>

      {/* Floating CF Purchase Celebration Banner (Top Center / Alert) */}
      {showCfBanner && activeCfToast && (
        <div className="self-center mt-4 max-w-lg w-full animate-in slide-in-from-top-4 fade-in duration-300">
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 p-[1.5px] shadow-2xl shadow-rose-950/60">
            <div className="bg-slate-950/95 backdrop-blur-xl rounded-2xl p-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white shrink-0 shadow-md">
                <CheckCircle2 className="w-6 h-6 animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-600 text-white">
                    CF ORDER CONFIRMED
                  </span>
                  <span className="text-[10px] text-amber-400 font-bold">
                    #{activeCfToast.order_no}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-white truncate mt-0.5">
                  คุณ <span className="text-emerald-400">{activeCfToast.username}</span> เพิ่งสั่งซื้อ{' '}
                  <span className="text-amber-300">{activeCfToast.product_name}</span> (ตะกร้า #{activeCfToast.basket_no}) x{activeCfToast.quantity} ชิ้น!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Area: Dynamic Product Card & Realtime Chat */}
      <div className="mt-auto space-y-3">
        {/* Real-time Comment Bubble (Pops up above product card) */}
        {latestComment && (
          <div className="max-w-md animate-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-blue-500/40 text-white shadow-xl">
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
                {latestComment.username.slice(0, 1)}
              </div>
              <div className="text-xs leading-snug">
                <span className="font-bold text-blue-400">{latestComment.username}: </span>
                <span className="text-slate-200">&ldquo;{latestComment.comment_text}&rdquo;</span>
              </div>
            </div>
          </div>
        )}

        {/* Main Dynamic Product Card Widget */}
        <div
          className={`w-full max-w-sm rounded-3xl overflow-hidden border border-white/20 bg-slate-950/90 backdrop-blur-xl shadow-2xl transition-all duration-500 transform ${
            isAnimating ? 'scale-105 ring-4 ring-rose-500/60' : 'scale-100'
          }`}
        >
          {/* Highlight Tag Header */}
          <div className="px-4 py-2 bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 flex items-center justify-between text-white">
            <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>{product.highlight_tag || 'สินค้าแนะนำในไลฟ์'}</span>
            </div>

            <div className="flex items-center gap-1 text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-full">
              <Flame className="w-3 h-3 text-amber-300" />
              <span>คงเหลือ {product.stock} ชิ้น</span>
            </div>
          </div>

          {/* Product Details Section */}
          <div className="p-4 flex gap-4 items-center">
            {/* Product Thumbnail with Basket Number */}
            <div className="relative shrink-0">
              <img
                src={product.image_url}
                alt={product.product_name}
                className="w-24 h-24 rounded-2xl object-cover border border-white/10 shadow-md"
              />
              <div className="absolute -top-2 -left-2 px-2.5 py-0.5 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-white text-xs font-black shadow-lg border border-white/30">
                #{product.basket_no}
              </div>
            </div>

            {/* Title, Pricing & CTA */}
            <div className="flex-1 min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-white truncate drop-shadow-sm">
                {product.product_name}
              </h3>

              {/* Price Line */}
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-amber-400 drop-shadow">
                  ฿{product.live_price.toLocaleString()}
                </span>
                {savings > 0 && (
                  <span className="text-xs text-slate-400 line-through">
                    ฿{product.regular_price.toLocaleString()}
                  </span>
                )}
              </div>

              {/* Savings Ribbon */}
              {savings > 0 && (
                <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 text-[10px] font-bold">
                  <Zap className="w-2.5 h-2.5 text-amber-400" />
                  <span>ลดทันที ฿{savings.toLocaleString()} เฉพาะในไลฟ์!</span>
                </div>
              )}

              {/* Prompt to Order */}
              <div className="mt-2 flex items-center gap-1.5">
                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                  <ShoppingBag className="w-3 h-3" />
                  <span>พิมพ์ &ldquo;CF&rdquo; เพื่อสั่งซื้อทันที</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Helper Bar */}
          <div className="px-4 py-2 bg-slate-900/95 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <span>💬 พิมพ์ &ldquo;ขอดูตะกร้า X&rdquo; สลับภาพสด</span>
            <span className="text-indigo-400 font-semibold">DealMee AI 24/7</span>
          </div>
        </div>
      </div>
    </div>
  )
}
