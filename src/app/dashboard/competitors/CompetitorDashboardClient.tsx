'use client'

import React, { useState } from 'react'
import {
  Radar,
  Search,
  Sparkles,
  TrendingUp,
  DollarSign,
  Share2,
  ThumbsUp,
  Eye,
  MessageCircle,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  Flame,
  Lightbulb,
  CheckCircle2,
  Database,
  ArrowRight,
  ShieldCheck,
  Zap,
  RefreshCw,
  Key,
} from 'lucide-react'
import { ScrapedCompetitorProfile } from '@/lib/competitors/scraperEngine'
import { CompetitorRecord } from '@/lib/competitors/competitorStore'

interface CompetitorDashboardClientProps {
  shop: any
  initialCompetitors: CompetitorRecord[]
  shopProducts: any[]
}

export default function CompetitorDashboardClient({
  shop,
  initialCompetitors = [],
  shopProducts = [],
}: CompetitorDashboardClientProps) {
  const [competitors, setCompetitors] = useState<CompetitorRecord[]>(initialCompetitors)
  const [inputUrl, setInputUrl] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [activeAnalysis, setActiveAnalysis] = useState<ScrapedCompetitorProfile | null>(
    initialCompetitors[0]?.profile_data || null
  )
  const [activeTab, setActiveTab] = useState<'price' | 'viral' | 'copilot'>('price')
  const [copiedTag, setCopiedTag] = useState('')
  const [copiedCaption, setCopiedCaption] = useState(false)
  const [showSqlModal, setShowSqlModal] = useState(false)
  const [showApiModal, setShowApiModal] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [isSavingKey, setIsSavingKey] = useState(false)
  const [savedKeySuccess, setSavedKeySuccess] = useState('')

  // Sync when initialCompetitors prop changes
  React.useEffect(() => {
    if (initialCompetitors && initialCompetitors.length > 0) {
      setCompetitors(initialCompetitors)
      if (!activeAnalysis && initialCompetitors[0]?.profile_data) {
        setActiveAnalysis(initialCompetitors[0].profile_data)
      }
    }
  }, [initialCompetitors])

  // Automatically refresh competitor list on client mount
  React.useEffect(() => {
    if (!shop?.id) return
    fetch(`/api/competitors?shop_id=${shop.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.competitors && Array.isArray(data.competitors) && data.competitors.length > 0) {
          setCompetitors(data.competitors)
          if (!activeAnalysis && data.competitors[0]?.profile_data) {
            setActiveAnalysis(data.competitors[0].profile_data)
          }
        }
      })
      .catch(() => {})
  }, [shop?.id])

  const handleSaveApiKey = async () => {
    setIsSavingKey(true)
    setSavedKeySuccess('')
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_api_key',
          shop_id: shop.id,
          rapidapi_key: apiKeyInput,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSavedKeySuccess('บันทึก Key เรียบร้อยแล้ว!')
        setTimeout(() => setSavedKeySuccess(''), 3000)
      }
    } catch (err: any) {
      alert(err.message || 'บันทึกไม่สำเร็จ')
    } finally {
      setIsSavingKey(false)
    }
  }

  // Sample presets for quick testing
  const presets = [
    { label: '🔥 ร้านแฟชั่นไวรัล TikTok', url: 'https://www.tiktok.com/@korea_style_fashion' },
    { label: '💄 ร้านบิวตี้เครื่องสำอาง IG', url: 'https://www.instagram.com/aura_glow_official' },
    { label: '👟 ร้านสตรีทแวร์ & สนีกเกอร์ FB', url: 'https://www.facebook.com/streetwear.bkk' },
  ]

  const handleScan = async (targetUrlToScan?: string, forceRefresh = false) => {
    const url = targetUrlToScan || inputUrl
    if (!url || !url.trim()) {
      setErrorMsg('กรุณากรอกลิงก์ร้านคู่แข่ง (TikTok, Instagram, หรือ Facebook)')
      return
    }

    setErrorMsg('')
    setIsScanning(true)

    try {
      const res = await fetch('/api/competitors/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop_id: shop.id,
          url: url.trim(),
          force_refresh: forceRefresh,
        }),
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'ไม่สามารถสแกนข้อมูลร้านคู่แข่งได้')
      }

      setActiveAnalysis(data.data)

      // Refresh list
      const listRes = await fetch(`/api/competitors?shop_id=${shop.id}`)
      const listData = await listRes.json()
      if (listData.competitors) {
        setCompetitors(listData.competitors)
      }

      if (!targetUrlToScan) setInputUrl('')
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setIsScanning(false)
    }
  }

  const handleDelete = async (comp: CompetitorRecord) => {
    if (!confirm(`ต้องการลบการติดตามคู่แข่ง "${comp.name}" หรือไม่?`)) return

    try {
      await fetch(`/api/competitors?shop_id=${shop.id}&id=${comp.id}`, { method: 'DELETE' })
      setCompetitors((prev) => prev.filter((c) => c.id !== comp.id))
      if (activeAnalysis?.handle === comp.handle) {
        setActiveAnalysis(null)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const copyToClipboard = (text: string, tagId: string) => {
    navigator.clipboard.writeText(text)
    setCopiedTag(tagId)
    setTimeout(() => setCopiedTag(''), 2000)
  }

  const copyCaption = (caption: string) => {
    navigator.clipboard.writeText(caption)
    setCopiedCaption(true)
    setTimeout(() => setCopiedCaption(false), 2500)
  }

  const sqlMigrationContent = `-- วางคำสั่งนี้ใน Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform VARCHAR(50) NOT NULL,
  target_url TEXT NOT NULL,
  handle TEXT,
  avatar_url TEXT,
  follower_count BIGINT DEFAULT 0,
  avg_engagement_rate NUMERIC(6, 2) DEFAULT 0.00,
  price_range_min NUMERIC(12, 2) DEFAULT 0.00,
  price_range_max NUMERIC(12, 2) DEFAULT 0.00,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.competitor_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  competitor_id UUID NOT NULL REFERENCES public.competitors(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  post_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title_or_caption TEXT,
  views_count BIGINT DEFAULT 0,
  likes_count BIGINT DEFAULT 0,
  comments_count BIGINT DEFAULT 0,
  shares_count BIGINT DEFAULT 0,
  engagement_rate NUMERIC(6, 2) DEFAULT 0.00,
  hashtags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);`

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/20 p-6 sm:p-8 text-white shadow-xl shadow-indigo-950/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-electric-blue/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-electric-blue/20 border border-electric-blue/30 text-electric-blue text-xs font-semibold mb-3">
              <Radar className="w-3.5 h-3.5 animate-pulse" />
              <span>DealMee Competitor Spy & Market Intelligence</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2.5">
              ระบบส่องร้านคู่แข่งและวิเคราะห์การตลาด
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-2xl">
              ดึงข้อมูลราคา คอนเทนต์ไวรัล และแฮชแท็กติดเทรนด์ของคู่แข่งบน TikTok, IG, FB
              พร้อม AI Copilot ช่วยร่างสคริปต์และกลยุทธ์ปิดการขายที่เหนือกว่า
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowApiModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 border border-amber-500/30 text-xs font-semibold text-amber-300 transition-all cursor-pointer shadow-sm"
            >
              <Zap className="w-4 h-4 text-amber-400" />
              <span>วิธีดึงข้อมูลสด & ประหยัดโควต้า</span>
            </button>
            <button
              onClick={() => setShowSqlModal(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition-all cursor-pointer"
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span>ดูโครงสร้างฐานข้อมูล SQL</span>
            </button>
          </div>
        </div>

        {/* Search URL Input Bar */}
        <div className="mt-8 relative max-w-3xl">
          <div className="flex flex-col sm:flex-row items-stretch gap-2.5 bg-slate-950/80 p-2 rounded-2xl border border-indigo-500/30 backdrop-blur-md shadow-2xl">
            <div className="relative flex-1 flex items-center">
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="วางลิงก์โปรไฟล์คู่แข่ง เช่น tiktok.com/@shop, instagram.com/brand..."
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScan()}
                className="w-full bg-transparent pl-11 pr-4 py-3 text-sm text-white placeholder-slate-400 focus:outline-none"
              />
            </div>
            <button
              onClick={() => handleScan()}
              disabled={isScanning}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/30 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isScanning ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>กำลังสแกนตลาด...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>สแกนร้านคู่แข่ง</span>
                </>
              )}
            </button>
          </div>

          {/* Quick Preset Buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">ลองสแกนด่วน:</span>
            {presets.map((p, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputUrl(p.url)
                  handleScan(p.url)
                }}
                className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>

          {errorMsg && (
            <p className="mt-2.5 text-xs text-rose-400 font-medium flex items-center gap-1.5">
              <span>⚠️ {errorMsg}</span>
            </p>
          )}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ร้านคู่แข่งที่ติดตามอยู่
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Radar className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {competitors.length}
            </span>
            <span className="text-xs text-slate-500">ร้านค้าในเรดาร์</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              เรต Engagement เฉลี่ยคู่แข่ง
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {activeAnalysis ? `${activeAnalysis.avg_engagement_rate}%` : '5.4%'}
            </span>
            <span className="text-xs text-emerald-600 font-medium">สูงกว่ามาตรฐาน 1.8x</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ช่วงราคาขายของคู่แข่ง
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
              {activeAnalysis ? `฿${activeAnalysis.price_range_min} - ฿${activeAnalysis.price_range_max}` : '฿290 - ฿990'}
            </span>
            <span className="text-xs text-slate-500">บาท/ชิ้น</span>
          </div>
        </div>
      </div>

      {/* Main Analysis Workspace */}
      {activeAnalysis ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-6">
          {/* Target Profile Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <img
                src={activeAnalysis.avatar_url}
                alt={activeAnalysis.name}
                className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700 shadow"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {activeAnalysis.name}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {activeAnalysis.platform}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>{activeAnalysis.handle}</span>
                  <span>•</span>
                  <span>ผู้ติดตาม: {activeAnalysis.follower_count.toLocaleString()} คน</span>
                  <span>•</span>
                  <span>ความเคลื่อนไหว: อัปเดตล่าสุดวันนี้</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {(activeAnalysis as any).from_cache && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
                  <Zap className="w-3.5 h-3.5 text-emerald-500" />
                  <span>แคช 24 ชม. (ประหยัดโควต้า 100%)</span>
                </span>
              )}
              <button
                onClick={() => handleScan(activeAnalysis.target_url, true)}
                disabled={isScanning}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all cursor-pointer"
                title="ดึงข้อมูลสดจาก Social Media ใหม่อีกครั้ง"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin text-blue-500' : ''}`} />
                <span>สแกนสดใหม่</span>
              </button>
              <a
                href={activeAnalysis.target_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
              >
                <span>เปิดดูโปรไฟล์จริง</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveTab('price')}
              className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                activeTab === 'price'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              📊 การเปรียบเทียบราคากับร้านคุณ
            </button>
            <button
              onClick={() => setActiveTab('viral')}
              className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                activeTab === 'viral'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              🔥 คอนเทนต์ไวรัลยอดวิวสูงสุด (Top Posts)
            </button>
            <button
              onClick={() => setActiveTab('copilot')}
              className={`pb-3 px-4 font-bold text-sm border-b-2 transition-all cursor-pointer ${
                activeTab === 'copilot'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
              }`}
            >
              ✨ DealMee AI Copilot แนะนำกลยุทธ์
            </button>
          </div>

          {/* TAB 1: Price Comparison Matrix */}
          {activeTab === 'price' && (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 text-xs sm:text-sm text-blue-900 dark:text-blue-300 flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">บทวิเคราะห์ราคา: </span>
                  {activeAnalysis.aiPlaybook.pricingStrategyVerdict}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-500">
                      <th className="py-3 px-4">สินค้าในร้านคุณ</th>
                      <th className="py-3 px-4">ราคาร้านคุณ</th>
                      <th className="py-3 px-4">ราคาคู่แข่งในตลาด</th>
                      <th className="py-3 px-4">ผลต่างราคา</th>
                      <th className="py-3 px-4">ข้อได้เปรียบทางธุรกิจ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                    {activeAnalysis.priceComparison.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all">
                        <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                          {item.myProduct.name}
                        </td>
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                          ฿{item.myProduct.price.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                          ฿{item.competitorEquivalent.estimatedPrice.toLocaleString()}
                        </td>
                        <td className="py-3.5 px-4">
                          {item.competitorEquivalent.priceDifference > 0 ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              ถูกกว่า ฿{item.competitorEquivalent.priceDifference}
                            </span>
                          ) : (
                            <span className="text-slate-500">ใกล้เคียงกัน</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {item.competitorEquivalent.advantageLabel}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: Viral Posts Feed */}
          {activeTab === 'viral' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeAnalysis.posts.map((post) => (
                <div
                  key={post.id}
                  className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-md transition-all flex flex-col justify-between bg-slate-50/30 dark:bg-slate-950/30"
                >
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                      <span className="inline-flex items-center gap-1 text-rose-500 font-bold">
                        <Flame className="w-3.5 h-3.5" />
                        คลิปไวรัลยอดวิวสูง
                      </span>
                      <span>อัตรามีส่วนร่วม: {post.engagement_rate}%</span>
                    </div>

                    <p className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2">
                      {post.title_or_caption}
                    </p>

                    {/* Viral Metrics */}
                    <div className="grid grid-cols-4 gap-2 my-3 text-center text-xs">
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                        <div className="flex items-center justify-center gap-1 text-slate-500 mb-0.5">
                          <Eye className="w-3 h-3" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {(post.views_count / 1000).toFixed(0)}k
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                        <div className="flex items-center justify-center gap-1 text-slate-500 mb-0.5">
                          <ThumbsUp className="w-3 h-3" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {(post.likes_count / 1000).toFixed(1)}k
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                        <div className="flex items-center justify-center gap-1 text-slate-500 mb-0.5">
                          <MessageCircle className="w-3 h-3" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {post.comments_count}
                        </span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60">
                        <div className="flex items-center justify-center gap-1 text-slate-500 mb-0.5">
                          <Share2 className="w-3 h-3" />
                        </div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {post.shares_count}
                        </span>
                      </div>
                    </div>

                    {/* Hashtags */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {post.hashtags.map((tag, tIdx) => (
                        <button
                          key={tIdx}
                          onClick={() => copyToClipboard(tag, `${post.id}-${tIdx}`)}
                          className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span>{tag}</span>
                          {copiedTag === `${post.id}-${tIdx}` ? (
                            <Check className="w-3 h-3 text-emerald-500" />
                          ) : (
                            <Copy className="w-2.5 h-2.5 opacity-60" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB 3: AI Copilot Strategy */}
          {activeTab === 'copilot' && (
            <div className="space-y-6">
              {/* Strategic Video Hooks */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span>3 สูตรคำเปิดคลิป (Hooks) ที่ปรับแต่งเพื่อดึงดูดลูกค้าจากคู่แข่งรายนี้</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {activeAnalysis.aiPlaybook.topViralHooks.map((hook, hIdx) => (
                    <div
                      key={hIdx}
                      className="p-4 rounded-2xl border border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-b from-indigo-50/30 to-transparent dark:from-indigo-950/20 flex flex-col justify-between"
                    >
                      <div>
                        <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1 block">
                          สูตรที่ {hIdx + 1}
                        </span>
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-2">
                          "{hook.hookText}"
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                          💡 <span className="font-semibold">จิตวิทยา:</span> {hook.whyItWorks}
                        </p>
                      </div>
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
                        🎬 {hook.recommendedFormat}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Ready-to-use Caption Generator */}
              <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 text-white">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    แคปชั่นโพสต์ขายพร้อมคัดลอก (Winning Caption Draft)
                  </span>
                  <button
                    onClick={() => copyCaption(activeAnalysis.aiPlaybook.winningCaptionTemplate)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    {copiedCaption ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedCaption ? 'คัดลอกเรียบร้อย!' : 'คัดลอกแคปชั่น'}</span>
                  </button>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-xs sm:text-sm text-slate-200 leading-relaxed bg-slate-900/90 p-4 rounded-xl border border-slate-800">
                  {activeAnalysis.aiPlaybook.winningCaptionTemplate}
                </pre>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {/* Tracked Competitors List Table */}
      {competitors.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Radar className="w-4 h-4 text-blue-600" />
            <span>รายชื่อร้านคู่แข่งในระบบ ({competitors.length} ร้าน)</span>
          </h3>

          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {competitors.map((comp) => (
              <div
                key={comp.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 px-3 rounded-xl transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-sm text-slate-700 dark:text-slate-300">
                    {comp.platform === 'tiktok' ? 'TT' : comp.platform === 'instagram' ? 'IG' : 'FB'}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {comp.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {comp.handle} • ผู้ติดตาม {comp.follower_count.toLocaleString()} คน
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (comp.profile_data) {
                        setActiveAnalysis(comp.profile_data)
                      } else {
                        handleScan(comp.target_url)
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 text-xs font-semibold hover:bg-blue-100 transition-all cursor-pointer"
                  >
                    ดูวิเคราะห์เชิงลึก
                  </button>
                  <button
                    onClick={() => handleDelete(comp)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 transition-all cursor-pointer"
                    title="ลบการติดตาม"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SQL Migration Modal */}
      {showSqlModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-emerald-400" />
                <h3 className="font-bold text-base">คำสั่ง SQL สำหรับ Supabase Editor</h3>
              </div>
              <button
                onClick={() => setShowSqlModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕ ปิด
              </button>
            </div>

            <p className="text-xs text-slate-400 my-4">
              คัดลอกคำสั่งด้านล่างไปวางใน <strong>Supabase Dashboard ➡️ SQL Editor</strong> เพื่อสร้างตารางสำหรับเก็บข้อมูลคู่แข่งแบบถาวร (ปัจจุบันระบบมีโหมดสำรองข้อมูลอัตโนมัติให้แล้ว จึงใช้งานได้ทันทีแม้ยังไม่รัน SQL ครับ)
            </p>

            <pre className="bg-slate-950 p-4 rounded-xl text-xs text-emerald-400 font-mono overflow-x-auto max-h-72 border border-slate-800">
              {sqlMigrationContent}
            </pre>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => copyToClipboard(sqlMigrationContent, 'sql-copy')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
              >
                {copiedTag === 'sql-copy' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedTag === 'sql-copy' ? 'คัดลอกแล้ว' : 'คัดลอกคำสั่ง SQL'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* API & Quota Saver Guide Modal */}
      {showApiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 text-white shadow-2xl animate-in zoom-in-95 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">ระบบดึงข้อมูลสด & การประหยัดโควต้า (Quota Guard)</h3>
                  <p className="text-xs text-slate-400">รองรับ TikTok, Instagram, และ Facebook ดึงข้อมูลจริง</p>
                </div>
              </div>
              <button
                onClick={() => setShowApiModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕ ปิด
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-300">
              <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30">
                <div className="flex items-center gap-2 font-bold text-emerald-400 text-sm mb-1">
                  <ShieldCheck className="w-4 h-4" />
                  <span>1. ระบบ Smart 24-Hour Cache (ประหยัดค่าใช้จ่าย 100%)</span>
                </div>
                <p className="text-slate-300">
                  เมื่อคุณสแกนร้านใดแล้ว ระบบจะบันทึกข้อมูลและวิเคราะห์ลงฐานข้อมูล Supabase ไว้ 24 ชั่วโมง การเปิดดูซ้ำหรือเข้ามาดูสถิติจะไม่เสียโควต้า API แม้แต่ครั้งเดียว (0 บาท) หากต้องการข้อมูลสดใหม่จริง ให้กดปุ่ม <strong>"🔄 สแกนสดใหม่"</strong> ได้ตลอดเวลา
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 font-bold text-amber-300 text-sm">
                    <Key className="w-4 h-4" />
                    <span>2. วาง RapidAPI Key เพื่อดึงข้อมูลสด (ทำงานได้ทันที ไม่ต้องแก้โค้ด):</span>
                  </div>
                  {savedKeySuccess && (
                    <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" /> {savedKeySuccess}
                    </span>
                  )}
                </div>
                <p className="text-slate-400 mb-2.5">
                  คัดลอก <strong>Application Key</strong> จาก RapidAPI มาวางที่นี่ แล้วกดบันทึก ระบบจะเริ่มดึงยอด Followers จริงและคลิปไวรัลสดทันที:
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    placeholder="วาง RapidAPI Key เช่น e45b98f237msh..."
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 font-mono"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    disabled={isSavingKey || !apiKeyInput.trim()}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md disabled:opacity-50"
                  >
                    {isSavingKey ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                        <span>กำลังบันทึก...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>บันทึก Key เข้าสู่ระบบ</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-950/30 border border-blue-500/30">
                <div className="flex items-center gap-2 font-bold text-blue-400 text-sm mb-1">
                  <Sparkles className="w-4 h-4" />
                  <span>3. ระบบ Zero-Downtime Smart Simulator</span>
                </div>
                <p className="text-slate-300">
                  หากคุณยังไม่ได้ใส่ API Key หรือโควต้าของเดือนนั้นหมด ระบบ DealMee จะสลับมาใช้ <strong>Smart Simulator</strong> โดยอัตโนมัติ ทำให้หน้าเว็บของคุณไม่สะดุด ไม่ขึ้น Error และยังคงให้คำแนะนำด้านการตลาดแก่ร้านค้าได้เหมือนเดิม 100% ครับ
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setShowApiModal(false)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs cursor-pointer shadow-md"
              >
                เข้าใจแล้ว พร้อมใช้งาน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
