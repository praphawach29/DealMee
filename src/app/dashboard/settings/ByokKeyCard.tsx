'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, Trash2, Settings2, ExternalLink, HelpCircle, CheckCircle2 } from 'lucide-react'
import type { ShopAiKeyStatus } from '@/lib/billing/shopAiKey'
import { clearByokKeyAction, getByokStatusAction, saveByokKeyAction } from './byokActions'

interface ProviderMeta {
  value: string
  label: string
  defaultModel: string
  link?: string
  linkText?: string
  steps: string[]
  pricingHint: string
}

const PROVIDERS: ProviderMeta[] = [
  {
    value: 'gemini',
    label: 'Google Gemini (แนะนำ)',
    defaultModel: 'gemini-2.5-flash',
    link: 'https://aistudio.google.com/app/apikey',
    linkText: 'Google AI Studio',
    steps: [
      'ล็อกอินด้วยบัญชี Google ที่ Google AI Studio',
      'กดปุ่ม "Get API key" แล้วเลือก "Create API key"',
      'คัดลอก Key มาวางในช่องด้านล่าง',
    ],
    pricingHint: 'มี Free Tier ใช้งานฟรี และราคาประหยัดมาก',
  },
  {
    value: 'groq',
    label: 'Groq (Llama 3.3 70B - ตอบเร็วสุด 0.5s / ประหยัดมาก)',
    defaultModel: 'llama-3.3-70b-versatile',
    link: 'https://console.groq.com/keys',
    linkText: 'Groq Console',
    steps: [
      'สมัครสมาชิกหรือล็อกอินที่ Groq Console',
      'ไปที่เมนู API Keys แล้วกด "Create API Key"',
      'ตั้งชื่อ Key และคัดลอกมาวางในช่องด้านล่าง',
    ],
    pricingHint: 'ประมวลผลบนชิป LPU เร็วที่สุดในโลก ค่า Token ถูกมาก',
  },
  {
    value: 'deepseek',
    label: 'DeepSeek (V3 - คุณภาพสูงเทียบเท่า Claude แต่ราคาถูกกว่า 10 เท่า)',
    defaultModel: 'deepseek-chat',
    link: 'https://platform.deepseek.com/api_keys',
    linkText: 'DeepSeek Platform',
    steps: [
      'สมัครสมาชิกและเติมเงินเครดิตที่ DeepSeek Platform',
      'ไปที่เมนู "API Keys" แล้วกดสร้าง "Create API Key"',
      'คัดลอก Key มาวางในช่องด้านล่าง',
    ],
    pricingHint: 'ฉลาดตอบภาษาไทยดีเยี่ยม และราคาถูกที่สุดในบรรดาโมเดลระดับท็อป',
  },
  {
    value: 'openrouter',
    label: 'OpenRouter (ฮับรวมทุกโมเดล: Claude, GPT-4o, Llama)',
    defaultModel: 'deepseek/deepseek-chat',
    link: 'https://openrouter.ai/keys',
    linkText: 'OpenRouter Keys',
    steps: [
      'ล็อกอินและเติมเครดิตที่ OpenRouter.ai',
      'ไปที่หน้า Keys แล้วกด "Create Key"',
      'นำ Key มาใส่ โดยสามารถระบุ Model ID ใดก็ได้ในช่องโมเดล',
    ],
    pricingHint: 'สมัครที่เดียวสลับใช้ได้กว่า 200+ โมเดลทั่วโลก',
  },
  {
    value: 'openai',
    label: 'OpenAI (ChatGPT / GPT-4o-mini)',
    defaultModel: 'gpt-4o-mini',
    link: 'https://platform.openai.com/api-keys',
    linkText: 'OpenAI Platform',
    steps: [
      'ล็อกอินและเติมเครดิตที่ OpenAI Platform',
      'ไปที่ Dashboard -> API Keys แล้วกด "Create new secret key"',
      'คัดลอก Key มาวางในช่องด้านล่าง',
    ],
    pricingHint: 'โมเดลมาตรฐานสากล เสถียรสูง',
  },
  {
    value: 'claude',
    label: 'Anthropic Claude (Sonnet 3.5 / Haiku)',
    defaultModel: 'claude-3-5-haiku-20241022',
    link: 'https://console.anthropic.com/',
    linkText: 'Anthropic Console',
    steps: [
      'ล็อกอินและเติมเครดิตที่ Anthropic Console',
      'ไปที่ Settings -> API Keys แล้วกด "Create Key"',
      'คัดลอก Key มาวางในช่องด้านล่าง',
    ],
    pricingHint: 'ตอบภาษาไทยได้เป็นธรรมชาติและเข้าใจบริบทซับซ้อนได้ดีเยี่ยม',
  },
  {
    value: 'ollama',
    label: 'Ollama (Local AI รันในเครื่องหรือ VPS ส่วนตัว)',
    defaultModel: 'llama3.2',
    link: 'https://ollama.com/',
    linkText: 'เว็บไซต์ทางการ Ollama',
    steps: [
      'ติดตั้ง Ollama บนเครื่องหรือ VPS ของท่าน แล้วดึงโมเดล เช่น ollama run llama3.2',
      'ตั้งค่า Base URL ให้ชี้มาที่เซิร์ฟเวอร์ (เช่น http://localhost:11434/v1)',
      'ช่อง Key สามารถใส่คำว่า ollama หรือคำใดก็ได้',
    ],
    pricingHint: 'ฟรี 100% ไม่มีค่า Token ข้อมูลปลอดภัยอยู่บนเครื่องของท่านเอง',
  },
  {
    value: 'custom_openai',
    label: 'Custom OpenAI-Compatible (vLLM / LM Studio / อื่นๆ)',
    defaultModel: 'gpt-4o-mini',
    steps: [
      'รัน Engine ที่รองรับ OpenAI-compatible เช่น vLLM, LM Studio, หรือ LocalAI',
      'ระบุ Base URL ของ Endpoint ในช่องการตั้งค่าเพิ่มเติม',
      'ใส่ API Key (ถ้าเซิร์ฟเวอร์เปิดโหมด Authentication)',
    ],
    pricingHint: 'ยืดหยุ่นสูงสุดสำหรับองค์กรที่มี Server AI ส่วนตัว',
  },
]

/** Shown only on the BYOK plan: the shop's own AI key, which the bot then uses instead of DealMee's. */
export default function ByokKeyCard() {
  const [onByokPlan, setOnByokPlan] = useState(false)
  const [status, setStatus] = useState<ShopAiKeyStatus | null>(null)
  const [provider, setProvider] = useState('gemini')
  const [key, setKey] = useState('')
  const [model, setModel] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const activeProvider = PROVIDERS.find((p) => p.value === provider) || PROVIDERS[0]
  const isCustomOrLocal = provider === 'ollama' || provider === 'custom_openai'
  const allowsCustomModel = isCustomOrLocal || ['groq', 'deepseek', 'openrouter'].includes(provider)

  async function load() {
    const res = await getByokStatusAction()
    if ('error' in res) return
    setOnByokPlan(res.onByokPlan)
    setStatus(res.status)
    if (res.status) setProvider(res.status.provider)
  }

  useEffect(() => {
    load()
  }, [])

  if (!onByokPlan) return null

  async function save() {
    setBusy(true)
    setNotice(null)
    const effectiveKey = key.trim() || (provider === 'ollama' ? 'ollama' : '')
    const options = (model.trim() || baseUrl.trim())
      ? { model: model.trim() || undefined, baseUrl: baseUrl.trim() || undefined }
      : undefined

    const res = await saveByokKeyAction(provider, effectiveKey, options)
    setBusy(false)
    if ('error' in res) {
      setNotice({ ok: false, text: res.error })
    } else {
      setNotice({ ok: true, text: res.success })
      setKey('')
      load()
    }
  }

  async function clear() {
    if (!confirm('ลบ API Key ของร้าน? บอทจะตอบลูกค้าไม่ได้จนกว่าจะใส่ key ใหม่ (แชทจะส่งต่อให้แอดมิน)')) return
    setBusy(true)
    const res = await clearByokKeyAction()
    setBusy(false)
    setNotice('error' in res ? { ok: false, text: res.error } : { ok: true, text: res.success })
    load()
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-amber-600" />
          <span className="text-xs sm:text-sm font-bold text-on-surface">API Key ของร้าน (แพ็กเกจ BYOK)</span>
        </div>
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300 hover:underline cursor-pointer"
        >
          <HelpCircle className="w-3.5 h-3.5" />
          {showGuide ? 'ซ่อนคู่มือขอ Key' : 'วิธีขอ API Key'}
        </button>
      </div>

      <p className="text-[11px] text-on-surface-variant leading-relaxed">
        แพ็กเกจ BYOK ให้บอทใช้ key ของร้านเองเท่านั้น ค่า AI จ่ายตรงกับผู้ให้บริการ รองรับทั้ง Google Gemini, Groq, DeepSeek, OpenRouter, OpenAI, Claude หรือ Local AI (Ollama)
        key ถูกเข้ารหัสก่อนเก็บ และแสดงแค่ 4 ตัวท้าย หาก key มีปัญหาหรือโควตาหมด ระบบจะแจ้งเตือนและส่งต่อแชตให้แอดมินดูแลทันที
      </p>

      {status ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-300">
          ใช้ key {PROVIDERS.find((p) => p.value === status.provider)?.label || status.provider} ลงท้าย{' '}
          <span className="font-mono">…{status.hint}</span> · บันทึกเมื่อ {new Date(status.updatedAt).toLocaleString('th-TH')}
        </p>
      ) : (
        <p className="text-xs font-semibold text-rose-600">ยังไม่ได้ใส่ key ตอนนี้บอทตอบลูกค้าไม่ได้ แชทจะถูกส่งต่อให้แอดมิน</p>
      )}

      {/* Guide Card */}
      {showGuide && (
        <div className="rounded-lg border border-amber-500/20 bg-surface/70 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between font-semibold text-on-surface">
            <span>วิธีขอ API Key สำหรับ {activeProvider.label}</span>
            {activeProvider.link && (
              <a
                href={activeProvider.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-electric-blue hover:underline text-[11px]"
              >
                เปิดหน้า {activeProvider.linkText}
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
          <ol className="space-y-1 list-decimal list-inside text-on-surface-variant text-[11px]">
            {activeProvider.steps.map((s, idx) => (
              <li key={idx} className="leading-relaxed">{s}</li>
            ))}
          </ol>
          <div className="pt-1 text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
            <span>{activeProvider.pricingHint}</span>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value)
            if (e.target.value === 'ollama' || e.target.value === 'custom_openai') {
              setShowAdvanced(true)
            }
          }}
          className="sm:w-64 px-3 py-2 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs outline-none focus:border-electric-blue font-medium"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <input
          type="password"
          autoComplete="off"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={
            provider === 'ollama'
              ? 'Ollama Local (ใส่ค่าใดก็ได้ เช่น ollama)'
              : status
                ? 'วาง key ใหม่เพื่อเปลี่ยน'
                : 'วาง API Key'
          }
          className="flex-1 px-3 py-2 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs font-mono outline-none focus:border-electric-blue"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy || (!key.trim() && provider !== 'ollama')}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-electric-blue text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
          ทดสอบและบันทึก
        </button>
        {status && (
          <button
            type="button"
            onClick={clear}
            disabled={busy}
            title="ลบ key"
            className="inline-flex items-center justify-center px-3 py-2 rounded-xl border border-rose-500/30 text-rose-600 hover:bg-rose-500/10 text-xs cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {!showGuide && activeProvider.link && (
        <div className="flex items-center gap-1 text-[11px] text-electric-blue">
          <ExternalLink className="w-3 h-3" />
          <a
            href={activeProvider.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            เปิดหน้าขอ API Key จาก {activeProvider.linkText}
          </a>
        </div>
      )}

      {(allowsCustomModel || isCustomOrLocal) && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="inline-flex items-center gap-1 text-[11px] text-on-surface-variant hover:text-on-surface font-medium cursor-pointer"
          >
            <Settings2 className="w-3 h-3" />
            {showAdvanced ? 'ซ่อนการตั้งค่าเพิ่มเติม' : 'ตั้งค่าโมเดล / Base URL เพิ่มเติม'}
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              <div>
                <label className="text-[10px] text-on-surface-variant block mb-1">
                  โมเดล AI (เว้นว่างไว้จะใช้ค่าเริ่มต้น: {activeProvider.defaultModel})
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={activeProvider.defaultModel}
                  className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-merchant-bg text-on-surface text-xs font-mono outline-none focus:border-electric-blue"
                />
              </div>

              {(isCustomOrLocal || provider === 'ollama') && (
                <div>
                  <label className="text-[10px] text-on-surface-variant block mb-1">
                    API Base URL
                  </label>
                  <input
                    type="text"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.your-endpoint.com/v1'}
                    className="w-full px-3 py-1.5 rounded-lg border border-outline-variant bg-merchant-bg text-on-surface text-xs font-mono outline-none focus:border-electric-blue"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {notice && <p className={`text-xs ${notice.ok ? 'text-emerald-600' : 'text-rose-600'}`}>{notice.text}</p>}
    </div>
  )
}
