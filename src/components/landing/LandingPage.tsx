'use client'

import React from 'react'
import Navbar from './Navbar'
import HeroSection from './HeroSection'
import FeaturesSection from './FeaturesSection'
import HowItWorksSection from './HowItWorksSection'
import ChatSimulatorSection from './ChatSimulatorSection'
import DashboardShowcase from './DashboardShowcase'
import PricingSection from './PricingSection'
import PricingComparison from './PricingComparison'
import CtaSection from './CtaSection'
import ContactFaqSection from './ContactFaqSection'
import Footer from './Footer'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 selection:bg-cyan-500/20 selection:text-cyan-800">
      {/* 1. Header Navigation */}
      <Navbar />

      {/* 2. Hero: sample LINE chat of the real sales flow */}
      <HeroSection />

      {/* 3. 12 Core Features Grid */}
      <FeaturesSection />

      {/* 4. How It Works (Steps & Business Types) */}
      <HowItWorksSection />

      {/* 5. Simulated chat of real tools */}
      <ChatSimulatorSection />

      {/* 6. Merchant dashboard showcase */}
      <DashboardShowcase />

      {/* 7. Pricing Plans (4 Tiers) */}
      <PricingSection />

      {/* 8. Feature Comparison Matrix */}
      <PricingComparison />

      {/* 9. CTA with the admin LINE alert the product actually sends */}
      <CtaSection />

      {/* 10. Contact Info & FAQ */}
      <ContactFaqSection />

      {/* 11. Minimalist Footer */}
      <Footer />
    </div>
  )
}
