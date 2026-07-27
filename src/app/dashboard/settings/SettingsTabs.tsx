'use client'

import { useState } from 'react'
import SettingsForm from './SettingsForm'
import PaymentShippingForm from './PaymentShippingForm'

export default function SettingsTabs({ shop }: { shop: any }) {
  const [activeTab, setActiveTab] = useState<'bot' | 'payment'>('bot')

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
          <span className="material-symbols-outlined text-[18px] sm:text-[20px]">smart_toy</span>
          <span>บอท & LINE OA</span>
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
          <span className="material-symbols-outlined text-[18px] sm:text-[20px]">payments</span>
          <span>การชำระเงิน & จัดส่ง</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'bot' ? (
        <SettingsForm shop={shop} />
      ) : (
        <PaymentShippingForm shop={shop} />
      )}
    </div>
  )
}
