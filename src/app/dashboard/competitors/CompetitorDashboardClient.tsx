'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Sparkles,
  Eye,
  ThumbsUp,
  MessageCircle,
  Share2,
  Copy,
  Check,
  Trash2,
  ExternalLink,
  RefreshCw,
  Key,
  BookOpen,
  Send,
  Clapperboard,
  Lightbulb,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Users,
  Activity,
} from 'lucide-react'
import type { ScrapedCompetitorProfile, CompetitorPost } from '@/lib/competitors/scraperEngine'
import type { CompetitorRecord } from '@/lib/competitors/competitorStore'
import type { CompetitorQuotaInfo } from '@/lib/billing/competitorQuota'
import type { ViralVideoScript } from '@/lib/ai/competitorVideoScript'

interface CompetitorDashboardClientProps {
  shop: any
  initialCompetitors: CompetitorRecord[]
  shopProducts: any[]
  initialQuota?: CompetitorQuotaInfo
}

type Tab = 'posts' | 'analysis' | 'ideas'

const card = 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm'
const primaryButton =
  'inline-flex items-center justify-center gap-2 bg-electric-blue hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl transition-all text-xs sm:text-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
const secondaryButton =
  'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold transition-all cursor-pointer disabled:opacity-50'

function compact(n: number) {
  return Number(n || 0).toLocaleString('th-TH', { notation: 'compact', maximumFractionDigits: 1 })
}

function platformLabel(platform: string) {
  return platform === 'tiktok' ? 'TikTok' : platform === 'instagram' ? 'Instagram' : platform
}

function thaiDateTime(iso?: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function CompetitorDashboardClient({
  shop,
  initialCompetitors = [],
  shopProducts = [],
  initialQuota,
}: CompetitorDashboardClientProps) {
  const router = useRouter()
  const [competitors, setCompetitors] = useState<CompetitorRecord[]>(initialCompetitors)
  const [quota, setQuota] = useState<CompetitorQuotaInfo | undefined>(initialQuota)
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null)
  const [maskedKey, setMaskedKey] = useState('')
  const [inputUrl, setInputUrl] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [active, setActive] = useState<ScrapedCompetitorProfile | null>(initialCompetitors[0]?.profile_data || null)
  const [tab, setTab] = useState<Tab>('posts')
  const [copied, setCopied] = useState('')
  const [notice, setNotice] = useState('')
  const [isSavingDraft, setIsSavingDraft] = useState(false)

  const [showKeyModal, setShowKeyModal] = useState(false)
  const [keyInput, setKeyInput] = useState('')
  const [isSavingKey, setIsSavingKey] = useState(false)

  const [scriptPost, setScriptPost] = useState<CompetitorPost | null>(null)
  const [scriptProductId, setScriptProductId] = useState<string>(shopProducts[0]?.id || '')
  const [script, setScript] = useState<ViralVideoScript | null>(null)
  const [scriptError, setScriptError] = useState('')
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)

  const refreshList = async () => {
    const res = await fetch('/api/competitors')
    const data = await res.json()
    if (Array.isArray(data.competitors)) setCompetitors(data.competitors)
    if (data.quota) setQuota(data.quota)
    if (typeof data.has_api_key === 'boolean') setHasApiKey(data.has_api_key)
    setMaskedKey(data.masked_api_key || '')
    return data
  }

  useEffect(() => {
    if (!shop?.id) return
    refreshList()
      .then((data) => {
        if (!active && data.competitors?.[0]?.profile_data) setActive(data.competitors[0].profile_data)
      })
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop?.id])

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    setTimeout(() => setCopied(''), 2000)
  }

  const flash = (message: string) => {
    setNotice(message)
    setTimeout(() => setNotice(''), 6000)
  }

  const handleScan = async (url = inputUrl, forceRefresh = false) => {
    if (!url.trim()) {
      setErrorMsg('วางลิงก์โปรไฟล์คู่แข่ง (TikTok หรือ Instagram)')
      return
    }
    setErrorMsg('')
    setIsScanning(true)
    try {
      const res = await fetch('/api/competitors/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), force_refresh: forceRefresh }),
      })
      const data = await res.json()
      if (data.quota) setQuota(data.quota)
      if (!res.ok || !data.success) throw new Error(data.error || 'สแกนไม่สำเร็จ')
      setActive(data.data)
      setTab('posts')
      setInputUrl('')
      await refreshList()
    } catch (err: any) {
      setErrorMsg(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setIsScanning(false)
    }
  }

  const handleDelete = async (comp: CompetitorRecord) => {
    if (!confirm(`เลิกติดตาม "${comp.name}" หรือไม่?`)) return
    await fetch(`/api/competitors?id=${comp.id}`, { method: 'DELETE' }).catch(() => {})
    setCompetitors((prev) => prev.filter((c) => c.id !== comp.id))
    if (active?.handle === comp.handle) setActive(null)
  }

  const handleSaveKey = async () => {
    setIsSavingKey(true)
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save_api_key', rapidapi_key: keyInput }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      setKeyInput('')
      setShowKeyModal(false)
      flash(data.message)
      await refreshList()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSavingKey(false)
    }
  }

  const handleSaveDraft = async () => {
    if (!active?.aiPlaybook) return
    setIsSavingDraft(true)
    try {
      const res = await fetch('/api/competitors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_knowledge',
          competitor_name: active.name,
          title: `แนวทางตอบเมื่อลูกค้าเทียบกับ ${active.name} (${active.handle})`,
          strategy_bullets: active.aiPlaybook.priceAdvantageBullets,
          verdict: active.aiPlaybook.pricingStrategyVerdict,
        }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      flash(data.message)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSavingDraft(false)
    }
  }

  const generateScript = async (post: CompetitorPost, productId: string) => {
    setIsGeneratingScript(true)
    setScript(null)
    setScriptError('')
    try {
      const res = await fetch('/api/competitors/generate-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitor_name: active?.name || 'คู่แข่ง',
          video_title: post.title_or_caption,
          product_id: productId || undefined,
        }),
      })
      const data = await res.json()
      if (!data.success || !data.script) throw new Error(data.error || 'สร้างสคริปต์ไม่สำเร็จ')
      setScript(data.script)
    } catch (err: any) {
      setScriptError(err.message)
    } finally {
      setIsGeneratingScript(false)
    }
  }

  const openScript = (post: CompetitorPost) => {
    setScriptPost(post)
    generateScript(post, scriptProductId)
  }

  const scriptAsText = (s: ViralVideoScript) =>
    [s.hook, s.problem, s.solution, s.offer, s.cta]
      .map((seg) => `[${seg.duration}] ${seg.spokenText}\n(ภาพ: ${seg.visualDirection})`)
      .join('\n\n')

  const quotaPct = quota && quota.total > 0 ? Math.min(100, Math.round((quota.used / quota.total) * 100)) : 0
  const playbook = active?.aiPlaybook || null

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 font-headline-md leading-tight">ส่องร้านคู่แข่ง</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-body-md">
            ดูโปรไฟล์และคลิปล่าสุดของคู่แข่งบน TikTok และ Instagram แล้วให้ AI แนะนำคอนเทนต์สำหรับสินค้าของร้านคุณ
          </p>
        </div>
        <button onClick={() => setShowKeyModal(true)} className={secondaryButton}>
          <Key className="w-4 h-4" /> RapidAPI Key
        </button>
      </div>

      {notice && (
        <div className="p-3 rounded-xl border border-success-green/30 bg-success-green/10 text-success-green text-xs font-semibold flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      {/* Scan */}
      <div className={`${card} p-4 sm:p-5 space-y-3`}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleScan()
          }}
          className="flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-500 dark:text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="วางลิงก์โปรไฟล์ เช่น tiktok.com/@ชื่อร้าน หรือ instagram.com/ชื่อร้าน"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-electric-blue"
            />
          </div>
          <button type="submit" disabled={isScanning || hasApiKey === false} className={primaryButton}>
            {isScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            {isScanning ? 'กำลังสแกน...' : 'สแกน'}
          </button>
        </form>

        {hasApiKey === false && (
          <p className="text-xs text-amber-600 flex items-start gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>
              ต้องตั้ง RapidAPI Key ก่อนจึงจะดึงข้อมูลคู่แข่งได้{' '}
              <button onClick={() => setShowKeyModal(true)} className="underline font-semibold cursor-pointer">
                ตั้งค่าตอนนี้
              </button>
            </span>
          </p>
        )}
        {errorMsg && <p className="text-xs text-error-red font-medium">{errorMsg}</p>}

        {quota && (
          <div>
            <div className="flex items-center justify-between text-xs mb-1 gap-2">
              <span className="text-slate-500 dark:text-slate-400">
                สแกนเดือนนี้ (แพ็กเกจ {quota.planName}) · สแกนบัญชีเดิมภายใน 24 ชม. ไม่เสียโควตา
              </span>
              <strong className="font-mono text-slate-900 dark:text-slate-100 whitespace-nowrap">
                {quota.used} / {quota.total}
              </strong>
            </div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${quotaPct >= 100 ? 'bg-error-red' : quotaPct >= 80 ? 'bg-amber-500' : 'bg-electric-blue'}`}
                style={{ width: `${quotaPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 sm:gap-5 items-start">
        {/* Tracked competitors */}
        <div className={`${card} p-3 space-y-1`}>
          <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2 py-1.5">คู่แข่งที่ติดตาม ({competitors.length})</h2>
          {competitors.length === 0 && (
            <p className="text-xs text-slate-500 dark:text-slate-400 px-2 pb-2">ยังไม่มี วางลิงก์ด้านบนเพื่อเริ่มติดตาม</p>
          )}
          {competitors.map((comp) => {
            const selected = active?.handle === comp.handle && active?.platform === comp.platform
            return (
              <div
                key={comp.id}
                className={`group flex items-center gap-2.5 p-2 rounded-xl transition-all ${
                  selected ? 'bg-electric-blue/10' : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <button
                  onClick={() => {
                    if (comp.profile_data) {
                      setActive(comp.profile_data)
                      setTab('posts')
                    } else {
                      handleScan(comp.target_url)
                    }
                  }}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left cursor-pointer"
                >
                  <RemoteImage src={comp.avatar_url} className="w-9 h-9 rounded-full object-cover shrink-0" />
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold truncate ${selected ? 'text-electric-blue' : 'text-slate-900 dark:text-slate-100'}`}>
                      {comp.name}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {platformLabel(comp.platform)} · {compact(comp.follower_count)} ผู้ติดตาม
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(comp)}
                  className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-error-red opacity-60 group-hover:opacity-100 cursor-pointer"
                  title="เลิกติดตาม"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Detail */}
        {!active ? (
          <div className={`${card} p-8 text-center text-sm text-slate-500 dark:text-slate-400`}>
            เลือกคู่แข่งจากรายการ หรือวางลิงก์โปรไฟล์ด้านบนเพื่อสแกน
          </div>
        ) : (
          <div className={`${card} p-4 sm:p-5 space-y-5`}>
            {/* Profile */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <RemoteImage src={active.avatar_url} className="w-14 h-14 rounded-full object-cover shrink-0" />
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate">{active.name}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {active.handle} · {platformLabel(active.platform)}
                    {active.last_scanned_at ? ` · สแกนเมื่อ ${thaiDateTime(active.last_scanned_at)}` : ''}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <a href={active.target_url} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
                  <ExternalLink className="w-4 h-4" /> เปิดโปรไฟล์
                </a>
                <button onClick={() => handleScan(active.target_url, true)} disabled={isScanning} className={secondaryButton}>
                  <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} /> สแกนใหม่
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Stat icon={<Users className="w-4 h-4" />} label="ผู้ติดตาม" value={active.follower_count.toLocaleString('th-TH')} />
              <Stat
                icon={<Activity className="w-4 h-4" />}
                label="Engagement เฉลี่ย"
                value={active.posts.length > 0 ? `${active.avg_engagement_rate}%` : '—'}
              />
              <Stat
                icon={<Clapperboard className="w-4 h-4" />}
                label="คลิปที่ดึงมา"
                value={active.posts.length > 0 ? `${active.posts.length} คลิปล่าสุด` : 'ไม่มีข้อมูลคลิป'}
              />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
              {(
                [
                  ['posts', 'คลิปล่าสุด'],
                  ['analysis', 'บทวิเคราะห์'],
                  ['ideas', 'ไอเดียคอนเทนต์'],
                ] as [Tab, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`px-3.5 pb-2.5 text-sm font-semibold border-b-2 whitespace-nowrap cursor-pointer transition-all ${
                    tab === key
                      ? 'border-electric-blue text-electric-blue'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'posts' &&
              (active.posts.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  ไม่มีข้อมูลคลิปของบัญชีนี้ ({platformLabel(active.platform)} ดึงได้เฉพาะข้อมูลโปรไฟล์)
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {active.posts.map((post) => (
                    <div key={post.id} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex gap-3">
                      <RemoteImage src={post.thumbnail_url} className="w-20 h-28 rounded-lg object-cover shrink-0 bg-slate-100 dark:bg-slate-800" />
                      <div className="flex-1 min-w-0 flex flex-col">
                        <p className="text-xs text-slate-900 dark:text-slate-100 line-clamp-3">{post.title_or_caption}</p>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1"><Eye className="w-3 h-3" />{compact(post.views_count)}</span>
                          <span className="inline-flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{compact(post.likes_count)}</span>
                          <span className="inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" />{compact(post.comments_count)}</span>
                          <span className="inline-flex items-center gap-1"><Share2 className="w-3 h-3" />{compact(post.shares_count)}</span>
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{post.engagement_rate}%</span>
                        </div>
                        <div className="mt-auto pt-2 flex gap-2">
                          <a href={post.post_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-electric-blue inline-flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> เปิดคลิป
                          </a>
                          <button onClick={() => openScript(post)} className="text-[11px] font-semibold text-electric-blue inline-flex items-center gap-1 cursor-pointer">
                            <Sparkles className="w-3 h-3" /> สคริปต์สำหรับร้านเรา
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            {tab === 'analysis' &&
              (!playbook ? (
                <PlaybookUnavailable />
              ) : (
                <div className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-electric-blue/10 text-sm text-slate-900 dark:text-slate-100 flex items-start gap-2.5">
                    <Lightbulb className="w-4 h-4 text-electric-blue shrink-0 mt-0.5" />
                    <span>{playbook.pricingStrategyVerdict}</span>
                  </div>
                  <ul className="space-y-2">
                    {playbook.priceAdvantageBullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-900 dark:text-slate-100">
                        <CheckCircle2 className="w-4 h-4 text-success-green shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      วิเคราะห์จากคลิปล่าสุดของคู่แข่งและสินค้าในร้านคุณ ระบบยังไม่มีข้อมูลราคาขายของคู่แข่ง จึงไม่ได้เทียบราคา
                    </p>
                    <button onClick={handleSaveDraft} disabled={isSavingDraft} className={`${secondaryButton} shrink-0`}>
                      {isSavingDraft ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
                      บันทึกเป็นร่างในคลังความรู้
                    </button>
                  </div>
                </div>
              ))}

            {tab === 'ideas' &&
              (!playbook ? (
                <PlaybookUnavailable />
              ) : (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">ประโยคเปิดคลิป</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {playbook.topViralHooks.map((hook, i) => (
                        <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">&ldquo;{hook.hookText}&rdquo;</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{hook.whyItWorks}</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">รูปแบบ: {hook.recommendedFormat}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">แคปชั่นตัวอย่าง</h3>
                      <div className="flex gap-2">
                        <button onClick={() => copy(playbook.winningCaptionTemplate, 'caption')} className={secondaryButton}>
                          {copied === 'caption' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied === 'caption' ? 'คัดลอกแล้ว' : 'คัดลอก'}
                        </button>
                        <button
                          onClick={() =>
                            router.push(
                              `/dashboard/broadcast?title=${encodeURIComponent(`ไอเดียจาก ${active.name}`)}&message=${encodeURIComponent(playbook.winningCaptionTemplate)}`
                            )
                          }
                          className={secondaryButton}
                        >
                          <Send className="w-4 h-4" /> ใช้ในบรอดแคสต์
                        </button>
                      </div>
                    </div>
                    <pre className="whitespace-pre-wrap font-sans text-sm text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 rounded-xl p-3.5">
                      {playbook.winningCaptionTemplate}
                    </pre>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">ข้อความในวงเล็บเหลี่ยมให้แทนด้วยโปรของร้านคุณเอง หรือลบออกถ้าไม่มี</p>
                  </div>

                  {playbook.recommendedHashtags.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">แฮชแท็ก</h3>
                        <button onClick={() => copy(playbook.recommendedHashtags.join(' '), 'tags')} className={secondaryButton}>
                          {copied === 'tags' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                          {copied === 'tags' ? 'คัดลอกแล้ว' : 'คัดลอกทั้งหมด'}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {playbook.recommendedHashtags.map((tag) => (
                          <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* RapidAPI key modal */}
      {showKeyModal && (
        <Modal title="RapidAPI Key" onClose={() => setShowKeyModal(false)}>
          <div className="space-y-3 text-sm text-slate-900 dark:text-slate-100">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ระบบดึงโปรไฟล์และคลิปของคู่แข่งผ่าน RapidAPI (TikTok Scraper และ Instagram Scraper) สมัครที่ rapidapi.com
              แล้วนำ key มาวางที่นี่ ค่าบริการ RapidAPI เรียกเก็บโดย RapidAPI ตามแพ็กเกจที่คุณเลือก
            </p>
            {maskedKey && (
              <p className="text-xs">
                Key ที่ใช้อยู่: <span className="font-mono">{maskedKey}</span>
              </p>
            )}
            <input
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              type="password"
              placeholder="วาง RapidAPI Key"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm outline-none focus:border-electric-blue"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowKeyModal(false)} className={secondaryButton}>
                ยกเลิก
              </button>
              <button onClick={handleSaveKey} disabled={isSavingKey || !keyInput.trim()} className={primaryButton}>
                {isSavingKey && <Loader2 className="w-4 h-4 animate-spin" />} บันทึก
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Script modal */}
      {scriptPost && (
        <Modal title="สคริปต์คลิปสำหรับร้านเรา" onClose={() => setScriptPost(null)}>
          <div className="space-y-4">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              จากคลิปของ {active?.name}: <span className="text-slate-900 dark:text-slate-100">&ldquo;{scriptPost.title_or_caption.slice(0, 120)}&rdquo;</span>
            </div>
            {shopProducts.length > 0 && (
              <div className="flex gap-2">
                <select
                  value={scriptProductId}
                  onChange={(e) => setScriptProductId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm"
                >
                  {shopProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (฿{Number(p.price || 0).toLocaleString()})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => generateScript(scriptPost, scriptProductId)}
                  disabled={isGeneratingScript}
                  className={secondaryButton}
                >
                  <RefreshCw className={`w-4 h-4 ${isGeneratingScript ? 'animate-spin' : ''}`} /> สร้างใหม่
                </button>
              </div>
            )}

            {isGeneratingScript && (
              <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> กำลังเขียนสคริปต์...
              </p>
            )}
            {scriptError && <p className="text-sm text-error-red">{scriptError}</p>}

            {script && (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{script.title}</h3>
                {[script.hook, script.problem, script.solution, script.offer, script.cta].map((seg, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                    <p className="text-[11px] font-mono text-electric-blue">{seg.duration}</p>
                    <p className="text-sm text-slate-900 dark:text-slate-100 mt-1">{seg.spokenText}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">ภาพ: {seg.visualDirection}</p>
                  </div>
                ))}
                <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3">
                  <p className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{script.caption}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">{script.hashtags.join(' ')}</p>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => copy(scriptAsText(script), 'script')} className={secondaryButton}>
                    {copied === 'script' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} คัดลอกบท
                  </button>
                  <button
                    onClick={() => copy(`${script.caption}\n\n${script.hashtags.join(' ')}`, 'script-caption')}
                    className={secondaryButton}
                  >
                    {copied === 'script-caption' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} คัดลอกแคปชั่น
                  </button>
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-100 dark:bg-slate-800 p-3">
      <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
        {icon} {label}
      </p>
      <p className="text-base font-bold text-slate-900 dark:text-slate-100 mt-1">{value}</p>
    </div>
  )
}

function PlaybookUnavailable() {
  return (
    <p className="text-sm text-slate-500 dark:text-slate-400">
      ยังไม่มีบทวิเคราะห์สำหรับบัญชีนี้ เพราะไม่พบคลิปให้วิเคราะห์ หรือระบบ AI ขัดข้อง ลองกด &quot;สแกนใหม่&quot; อีกครั้งภายหลัง
    </p>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 w-full sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl p-5 space-y-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">{title}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/**
 * Images from TikTok/Instagram CDNs: sent without a referrer (TikTok refuses
 * hot-linked requests that carry one) and replaced by a grey box when the signed
 * URL has expired, instead of a broken-image icon.
 */
function RemoteImage({ src, className }: { src?: string; className: string }) {
  const [failed, setFailed] = useState(false)
  const ref = React.useRef<HTMLImageElement>(null)
  useEffect(() => {
    // An image that failed before React hydrated never reaches onError
    const img = ref.current
    setFailed(Boolean(img && img.complete && img.naturalWidth === 0))
  }, [src])
  if (!src || failed) return <div className={`${className} bg-slate-100 dark:bg-slate-800`} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} src={src} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={className} />
  )
}
