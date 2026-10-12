'use client'

import { useState } from 'react'
import { Bot, Share2, Store, CreditCard } from 'lucide-react'
import SettingsForm from './SettingsForm'
import ChannelsSettingsForm from './ChannelsSettingsForm'
import CompanySettingsForm from './CompanySettingsForm'
import PaymentShippingForm from './PaymentShippingForm'

export default function SettingsTabs({ shop }: { shop: any }) {
  const [activeTab, setActiveTab] = useState<'bot' | 'channels' | 'company' | 'payment'>('bot')

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Navigation Tabs Header */}
      <div className="flex border-b border-outline-variant/40 gap-1.5 sm:gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          type="button"
          onClick={() => setActiveTab('bot')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 font-label-md text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'bot'
              ? 'border-electric-blue text-electric-blue bg-electric-blue/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-t-xl'
          }`}
        >
          <Bot className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>บอท AI & บุคลิกภาพ</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('channels')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 font-label-md text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
            activeTab === 'channels'
              ? 'border-electric-blue text-electric-blue bg-electric-blue/5 rounded-t-xl'
              : 'border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-t-xl'
          }`}
        >
          <Share2 className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>เชื่อมต่อ LINE & Facebook</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('company')}
          className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 font-label-md text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
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
          className={`flex items-center gap-1.5 sm:gap-2 px-3 py-2.5 sm:px-4 sm:py-3 font-label-md text-xs sm:text-sm font-semibold border-b-2 transition-all whitespace-nowrap cursor-pointer shrink-0 ${
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
      {activeTab === 'bot' && <SettingsForm shop={shop} onNavigateToChannels={() => setActiveTab('channels')} />}
      {activeTab === 'channels' && <ChannelsSettingsForm shop={shop} />}
      {activeTab === 'company' && <CompanySettingsForm shop={shop} />}
      {activeTab === 'payment' && <PaymentShippingForm shop={shop} />}
    </div>
  )
}
