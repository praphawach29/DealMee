'use client'

import { useEffect, useState } from 'react'
import { KeyRound, Loader2, Trash2, Settings2, ExternalLink } from 'lucide-react'
import type { ShopAiKeyStatus } from '@/lib/billing/shopAiKey'
import { clearByokKeyAction, getByokStatusAction, saveByokKeyAction } from './byokActions'

const PROVIDERS = [
  {
    value: 'gemini',
    label: 'Google Gemini (แนะนำ)',
    link: 'https://aistudio.google.com/app/apikey',
    linkText: 'รับ API Key ฟรีจาก Google AI Studio',
  },
  {
    value: 'groq',
    label: 'Groq (Llama 3.3 70B - เร็วสูงสุด/ประหยัดมาก)',
    link: 'https://console.groq.com/keys',
    linkText: 'รับ API Key ฟรีจาก Groq Console (เร็วสุด 0.5 วินาที)',
  },
  {
    value: 'deepseek',
    label: 'DeepSeek (V3 - คุณภาพสูง/ราคาประหยัด)',
    link: 'https://platform.deepseek.com/api_keys',
    linkText: 'รับ API Key จาก DeepSeek Platform',
  },
  {
    value: 'openrouter',
    label: 'OpenRouter (รวมทุกค่าย: Claude, GPT, Llama)',
    link: 'https://openrouter.ai/keys',
    linkText: 'รับ API Key เดียวใช้ได้ทุกค่ายที่ OpenRouter',
  },
  {
    value: 'openai',
    label: 'OpenAI (ChatGPT)',
    link: 'https://platform.openai.com/api-keys',
    linkText: 'รับ API Key จาก OpenAI Platform',
  },
  {
    value: 'claude',
    label: 'Anthropic Claude',
    link: 'https://console.anthropic.com/',
    linkText: 'รับ API Key จาก Anthropic Console',
  },
  {
    value: 'ollama',
    label: 'Ollama (Local AI ในเครื่อง/โฮสต์เอง)',
    link: 'https://ollama.com/',
    linkText: 'ดาวน์โหลด Ollama รันโมเดลบนเครื่องตนเองฟรี',
  },
  {
    value: 'custom_openai',
    label: 'Custom OpenAI-Compatible (vLLM / LM Studio / อื่นๆ)',
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
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null)

  const activeProviderMeta = PROVIDERS.find((p) => p.value === provider)
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
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-amber-600" />
        <span className="text-xs sm:text-sm font-bold text-on-surface">API Key ของร้าน (แพ็กเกจ BYOK)</span>
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

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value)
            if (e.target.value === 'ollama' || e.target.value === 'custom_openai') {
              setShowAdvanced(true)
            }
          }}
          className="sm:w-64 px-3 py-2 rounded-xl border border-outline-variant bg-merchant-bg text-on-surface text-xs outline-none focus:border-electric-blue"
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

      {activeProviderMeta?.link && (
        <div className="flex items-center gap-1 text-[11px] text-electric-blue">
          <ExternalLink className="w-3 h-3" />
          <a
            href={activeProviderMeta.link}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            {activeProviderMeta.linkText}
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
                  โมเดล AI (เว้นว่างไว้หากใช้ค่าเริ่มต้น)
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={
                    provider === 'groq'
                      ? 'llama-3.3-70b-versatile'
                      : provider === 'deepseek'
                        ? 'deepseek-chat'
                        : provider === 'openrouter'
                          ? 'deepseek/deepseek-chat'
                          : provider === 'ollama'
                            ? 'llama3.2'
                            : 'ชื่อโมเดล'
                  }
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
