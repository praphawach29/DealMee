'use client'

import { useState } from 'react'
import { Bot, Store, CreditCard } from 'lucide-react'
import SettingsForm from './SettingsForm'
import CompanySettingsForm from './CompanySettingsForm'
import PaymentShippingForm from './PaymentShippingForm'

export default function SettingsTabs({ shop }: { shop: any }) {
  const [activeTab, setActiveTab] = useState<'bot' | 'company' | 'payment'>('bot')

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Navigation Tabs Header */}
      <div className="flex border-b border-outline-variant/40 gap-2 sm:gap-4 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab('bot')}
          className={`flex items-center gap-2 px-4 py-3 font-label-md text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'bot'
              ? 'border-electric-blue text-electric-blue bg-electric-blue/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-t-xl'
          }`}
        >
          <Bot className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>บอท & LINE OA</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-2 px-4 py-3 font-label-md text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'company'
              ? 'border-electric-blue text-electric-blue bg-electric-blue/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-t-xl'
          }`}
        >
          <Store className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>ข้อมูลร้านค้า & เอกสาร</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('payment')}
          className={`flex items-center gap-2 px-4 py-3 font-label-md text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer ${
            activeTab === 'payment'
              ? 'border-electric-blue text-electric-blue bg-electric-blue/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-t-xl'
          }`}
        >
          <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>การชำระเงิน & จัดส่ง</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'bot' && <SettingsForm shop={shop} />}
      {activeTab === 'company' && <CompanySettingsForm shop={shop} />}
      {activeTab === 'payment' && <PaymentShippingForm shop={shop} />}
    </div>
  )
}
