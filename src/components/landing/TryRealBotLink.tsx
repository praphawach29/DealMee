import Link from 'next/link'
import { PLAYGROUND_PATH } from '@/lib/auth/safeNext'

export default function TryRealBotLink({
  className = '',
  size = 'md',
}: {
  className?: string
  size?: 'md' | 'lg'
}) {
  const sizing = size === 'lg' ? 'min-h-12 px-7 py-3 text-sm sm:text-base' : 'min-h-11 px-5 py-2.5 text-sm'
  return (
    <Link
      href={PLAYGROUND_PATH}
      className={`inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#2F6BFF] font-sans font-semibold text-white shadow-lg shadow-[#2F6BFF]/25 transition-all duration-200 hover:bg-[#2457d6] active:scale-95 ${sizing} ${className}`}
    >
      ลองคุยกับบอทจริง
    </Link>
  )
}
