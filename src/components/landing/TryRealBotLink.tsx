import Link from 'next/link'
import { PLAYGROUND_PATH } from '@/lib/auth/safeNext'

/**
 * Sign up (or log in) and open the playground on the visitor's own shop. The no-account demo
 * with sample shops is the #try section on the landing page; this is the step after it.
 */
export default function TryRealBotLink({
  className = '',
  size = 'md',
  label = 'ลองกับข้อมูลร้านของคุณ',
}: {
  className?: string
  size?: 'md' | 'lg'
  label?: string
}) {
  const sizing = size === 'lg' ? 'min-h-12 px-7 py-3 text-sm sm:text-base' : 'min-h-11 px-5 py-2.5 text-sm'
  return (
    <Link
      href={PLAYGROUND_PATH}
      className={`inline-flex items-center justify-center gap-2 rounded-[14px] bg-[#2F6BFF] font-sans font-semibold text-white shadow-lg shadow-[#2F6BFF]/25 transition-all duration-200 hover:bg-[#2457d6] active:scale-95 ${sizing} ${className}`}
    >
      {label}
    </Link>
  )
}
