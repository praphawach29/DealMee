import { submitOnboarding } from './actions'
import { Button } from '@/components/ui/button'
import { Check } from 'lucide-react'
import Image from 'next/image'

const TEMPLATES = [
  { id: 'beauty', emoji: '💄', label: 'ความงาม & เครื่องสำอาง', type: 'retail', description: 'ร้านขายสกินแคร์, เครื่องสำอาง, เวชสำอาง' },
  { id: 'food', emoji: '🍜', label: 'อาหาร & เครื่องดื่ม', type: 'restaurant', description: 'ร้านอาหาร, ร้านเครื่องดื่ม, เดลิเวอรี่' },
  { id: 'fashion', emoji: '👕', label: 'เสื้อผ้า & แฟชั่น', type: 'retail', description: 'ร้านเสื้อผ้า, แบรนด์แฟชั่น, อุปกรณ์เสริม' },
  { id: 'clinic', emoji: '🏥', label: 'คลินิก & สุขภาพ', type: 'booking', description: 'คลินิกความงาม, คลินิกทั่วไป, ทันตกรรม' },
  { id: 'spa', emoji: '💆', label: 'สปา & นวด', type: 'booking', description: 'สปา, ร้านนวด, ร้านอโรมา' },
  { id: 'it', emoji: '💻', label: 'ไอที & อิเล็กทรอนิกส์', type: 'retail', description: 'ร้านคอมพิวเตอร์, มือถือ, อุปกรณ์ IT' },
  { id: 'fitness', emoji: '💪', label: 'ฟิตเนส & คลาสเรียน', type: 'booking', description: 'ฟิตเนส, โยคะ, มวย, คลาสเรียนต่างๆ' },
  { id: 'auto', emoji: '🔧', label: 'อู่ซ่อมรถ & ยานยนต์', type: 'booking', description: 'อู่ซ่อมรถ, เปลี่ยนยาง, ล้างรถ' },
  { id: 'retail', emoji: '📦', label: 'ร้านค้าทั่วไป', type: 'retail', description: 'ร้านค้าออนไลน์, ขายสินค้าทั่วไป' },
]

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const { error } = (await searchParams) || {}

  return (
    <div className="min-h-screen bg-merchant-bg py-12 px-4 sm:px-6 lg:px-8 flex justify-center items-center">
      <div className="max-w-3xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center gap-3 mb-6">
            <Image
              src="/logos/dealmee-icon.png"
              alt="DealMee Logo"
              width={48}
              height={48}
              priority
              className="w-12 h-12 object-contain drop-shadow-md"
            />
            <span className="text-3xl font-bold tracking-tight text-deep-indigo font-headline-xl">
              <span className="text-blue-600">Deal</span><span className="text-cyan-500">Mee</span> AI
            </span>
          </div>
          <h2 className="text-3xl font-bold text-on-surface font-headline-lg">ตั้งค่าร้านค้าของคุณ</h2>
          <p className="mt-2 text-on-surface-variant font-body-lg">กรุณากรอกข้อมูลเบื้องต้นเพื่อเริ่มต้นใช้งาน</p>
        </div>

        <div className="bg-surface rounded-3xl p-6 sm:p-8 shadow-sm border border-outline-variant">
          {error === 'create_failed' && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-sm font-semibold flex items-center gap-2">
              <span>⚠️ เกิดข้อผิดพลาด ไม่สามารถสร้างร้านค้าได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง หรือติดต่อแอดมิน</span>
            </div>
          )}
          <form action={submitOnboarding} className="space-y-8">
            {/* Step 1 */}
            <div>
              <h3 className="text-xl font-bold text-on-surface mb-4 font-headline-md flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-electric-blue/10 text-electric-blue text-sm font-bold">1</span>
                ชื่อร้านค้า (Shop Name)
              </h3>
              <div className="pl-0 sm:pl-10">
                <input
                  type="text"
                  name="shopName"
                  required
                  placeholder="เช่น ร้านค้าแฟชั่น DealMee"
                  className="w-full rounded-xl border border-outline-variant/60 px-4 py-3 text-on-surface bg-surface placeholder:text-outline focus:border-electric-blue focus:ring-2 focus:ring-electric-blue/20 transition-all outline-none text-sm font-medium"
                />
              </div>
            </div>

            <hr className="border-outline-variant/30" />

            {/* Step 2 & 3 Combined in UI for simplicity */}
            <div>
              <h3 className="text-xl font-bold text-on-surface mb-4 font-headline-md flex items-center gap-2">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-electric-blue/10 text-electric-blue text-sm font-bold">2</span>
                เลือกแม่แบบธุรกิจ (Template)
              </h3>
              <p className="text-on-surface-variant text-sm mb-4 pl-0 sm:pl-10 font-body-md">
                ระบบจะตั้งค่าลักษณะการตอบของ AI และเมนูที่เหมาะสมกับประเภทธุรกิจของคุณโดยอัตโนมัติ
              </p>
              
              <div className="pl-0 sm:pl-10">
                {/* Radio buttons styled as cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {TEMPLATES.map((tmpl, i) => (
                    <label key={tmpl.id} className="cursor-pointer relative">
                      <input 
                        type="radio" 
                        name="aiTemplate" 
                        value={tmpl.id} 
                        defaultChecked={i === 0}
                        className="peer sr-only" 
                      />
                      <input type="hidden" name="businessType" value={tmpl.type} disabled className="peer-checked:!block hidden" />
                      
                      <div className="p-4 rounded-2xl border-2 border-outline-variant/50 bg-surface hover:border-electric-blue/50 transition-all peer-checked:border-electric-blue peer-checked:bg-electric-blue/5 peer-checked:ring-1 peer-checked:ring-electric-blue group h-full">
                        <div className="flex justify-between items-start mb-2">
                          <div className="text-3xl filter drop-shadow-sm">{tmpl.emoji}</div>
                          <div className="hidden peer-checked:flex bg-electric-blue text-white rounded-full p-1 items-center justify-center">
                            <Check className="h-3 w-3" />
                          </div>
                        </div>
                        <h4 className="font-bold text-on-surface text-base mb-1 group-peer-checked:text-deep-indigo">{tmpl.label}</h4>
                        <p className="text-on-surface-variant text-xs line-clamp-2">{tmpl.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="pt-6">
              <Button type="submit" className="w-full bg-electric-blue hover:bg-primary text-white py-6 rounded-xl font-label-md text-lg shadow-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98] min-h-[48px]">
                เริ่มต้นใช้งาน Dashboard
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
