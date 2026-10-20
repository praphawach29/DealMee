import { loadGuides } from '@/lib/helpGuide'
import HelpGuideClient from './HelpGuideClient'

export const metadata = { title: 'คู่มือการใช้งาน | DealMee' }

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab, q } = await searchParams
  return <HelpGuideClient guides={loadGuides()} initialTab={tab} initialQuery={q} />
}
