import { loadGuides } from '@/lib/helpGuide'
import HelpGuideClient from './HelpGuideClient'

export const metadata = { title: 'คู่มือการใช้งาน | DealMee' }

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams
  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8">
      <HelpGuideClient guides={loadGuides()} initialTab={tab} initialQuery={q} />
    </div>
  )
}
