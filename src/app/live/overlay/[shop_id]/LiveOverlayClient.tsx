'use client'

import React, { useEffect, useState } from 'react'
import { Sparkles, ShoppingBag, Flame, Tag, Radio } from 'lucide-react'
import { LiveSessionState, LiveBasketItem, LiveCommentItem } from '@/lib/live/liveStudioEngine'

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

  // Polling for instant OBS overlay updates (every 1 second)
  useEffect(() => {
    let prevBasket = state.current_basket_no

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/live/comment?shop_id=${shopId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.state) {
            if (data.state.current_basket_no !== prevBasket) {
              // Trigger transition animation
              setIsAnimating(true)
              setTimeout(() => setIsAnimating(false), 500)
              prevBasket = data.state.current_basket_no
            }
            setState(data.state)
            if (data.state.recent_comments && data.state.recent_comments.length > 0) {
              setLatestComment(data.state.recent_comments[0])
            }
          }
        }
      } catch (err) {
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
    <div className="w-full h-full relative p-6 sm:p-10 flex flex-col justify-end items-start pointer-events-none font-sans">
      {/* Upper Live Streamer Watermark / Live Badge */}
      <div className="absolute top-6 left-6 flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-slate-950/80 backdrop-blur-md border border-rose-500/40 text-white shadow-lg">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
        <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5" /> LIVE
        </span>
        <span className="text-xs text-slate-300 font-medium">| {state.title}</span>
      </div>

      {/* Real-time Comment Bubble (Pops up above product card) */}
      {latestComment && (
        <div className="mb-3 max-w-md animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-blue-500/30 text-white shadow-xl">
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
              {latestComment.username.slice(0, 1)}
            </div>
            <div className="text-xs leading-snug">
              <span className="font-bold text-blue-400">{latestComment.username}: </span>
              <span className="text-slate-200">"{latestComment.comment_text}"</span>
            </div>
          </div>
        </div>
      )}

      {/* Main Dynamic Product Card Widget */}
      <div
        className={`w-full max-w-sm rounded-3xl overflow-hidden border border-white/20 bg-slate-950/85 backdrop-blur-xl shadow-2xl transition-all duration-500 transform ${
          isAnimating ? 'scale-105 ring-4 ring-blue-500/50' : 'scale-100'
        }`}
      >
        {/* Highlight Tag Header */}
        <div className="px-4 py-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-between text-white">
          <div className="flex items-center gap-1.5 text-xs font-extrabold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
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

            {/* Prompt to Order */}
            <div className="mt-2 flex items-center gap-1.5">
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold">
                <ShoppingBag className="w-3 h-3" />
                <span>พิมพ์ "CF" เพื่อสั่งซื้อทันที</span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Helper Bar */}
        <div className="px-4 py-2 bg-slate-900/90 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <span>💬 ถาม "ขอดูตะกร้า X" สลับภาพสด</span>
          <span className="text-indigo-400 font-semibold">DealMee AI 24/7</span>
        </div>
      </div>
    </div>
  )
}
