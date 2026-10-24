'use client'

import React from 'react'
import Navbar from './Navbar'
import HeroSection from './HeroSection'
import FeaturesSection from './FeaturesSection'
import HowItWorksSection from './HowItWorksSection'
import ChatSimulatorSection from './ChatSimulatorSection'
import DemoVideoSection from './DemoVideoSection'
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

      {/* 3. The promo clips, one chapter at a time */}
      <DemoVideoSection />

      {/* 4. 12 Core Features Grid */}
      <FeaturesSection />

      {/* 5. How It Works (Steps & Business Types) */}
      <HowItWorksSection />

      {/* 6. Simulated chat of real tools */}
      <ChatSimulatorSection />

      {/* 7. Merchant dashboard showcase */}
      <DashboardShowcase />

      {/* 8. Pricing Plans (4 Tiers) */}
      <PricingSection />

      {/* 9. Feature Comparison Matrix */}
      <PricingComparison />

      {/* 10. CTA with the admin LINE alert the product actually sends */}
      <CtaSection />

      {/* 11. Contact Info & FAQ */}
      <ContactFaqSection />

      {/* 12. Minimalist Footer */}
      <Footer />
    </div>
  )
}
