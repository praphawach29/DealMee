'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, ArrowRight } from 'lucide-react'

export default function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled
          ? 'bg-[#060c1b]/90 backdrop-blur-md border-b border-white/10 shadow-lg shadow-black/20 py-3'
          : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <Image
            src="/logos/dealmee-icon.png"
            alt="DealMee Logo"
            width={40}
            height={40}
            className="w-10 h-10 object-contain drop-shadow-md group-hover:scale-105 transition-transform duration-200 shrink-0"
            priority
          />
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-xl tracking-wider text-white">
                DEAL<span className="text-cyan-400">MEE</span>
              </span>
              <span className="bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-[10px] font-semibold px-2 py-0.5 rounded-full tracking-wide">
                AI AGENT
              </span>
            </div>
            <span className="text-[10px] text-slate-400 -mt-0.5 tracking-tight font-medium">
              Sales Copilot • DealMee.app
            </span>
          </div>
        </Link>

        {/* Desktop Nav Links */}
        <nav className="hidden md:flex items-center gap-8 text-base font-semibold text-slate-200">
          <a
            href="#demo"
            className="hover:text-cyan-400 transition-colors duration-200"
          >
            ตัวอย่างแชทจริง
          </a>
          <a
            href="#features"
            className="hover:text-cyan-400 transition-colors duration-200"
          >
            ฟีเจอร์หลัก
          </a>
          <a
            href="#dashboard"
            className="hover:text-cyan-400 transition-colors duration-200"
          >
            แดชบอร์ด
          </a>
          <a
            href="#pricing"
            className="hover:text-cyan-400 transition-colors duration-200"
          >
            ราคาแพ็กเกจ
          </a>
          <a
            href="#faq"
            className="hover:text-cyan-400 transition-colors duration-200"
          >
            คำถามที่พบบ่อย
          </a>
        </nav>

        {/* Right CTA / Auth Buttons */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-base font-medium text-slate-200 hover:text-white transition-colors duration-200"
          >
            เข้าสู่ระบบ
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold text-base px-5 py-2.5 rounded-xl shadow-md shadow-blue-500/25 transition-all duration-200 active:scale-95"
          >
            <span>ทดลองใช้ฟรี</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 text-slate-300 hover:text-white rounded-lg hover:bg-white/10"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#0a1226]/98 border-b border-white/10 px-5 pt-3 pb-6 space-y-3 animate-fade-in backdrop-blur-xl">
          <a
            href="#demo"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2.5 text-base font-medium text-slate-200 hover:text-cyan-400 border-b border-white/5"
          >
            🔍 ตัวอย่างแชทจริง
          </a>
          <a
            href="#features"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2.5 text-base font-medium text-slate-200 hover:text-cyan-400 border-b border-white/5"
          >
            ⚡ ฟีเจอร์หลัก
          </a>
          <a
            href="#dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2.5 text-base font-medium text-slate-200 hover:text-cyan-400 border-b border-white/5"
          >
            📊 แดชบอร์ด
          </a>
          <a
            href="#pricing"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2.5 text-base font-medium text-slate-200 hover:text-cyan-400 border-b border-white/5"
          >
            🏷️ แพ็กเกจราคา
          </a>
          <a
            href="#faq"
            onClick={() => setMobileMenuOpen(false)}
            className="block py-2.5 text-base font-medium text-slate-200 hover:text-cyan-400"
          >
            ❓ คำถามที่พบบ่อย
          </a>

          <div className="pt-3 flex flex-col gap-2.5">
            <Link
              href="/login"
              className="text-center py-2.5 font-semibold text-slate-200 bg-white/5 rounded-xl border border-white/10"
            >
              เข้าสู่ระบบ
            </Link>
            <a
              href="#pricing"
              onClick={() => setMobileMenuOpen(false)}
              className="text-center py-3 font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-500 rounded-xl shadow-md"
            >
              ทดลองใช้งาน
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
