import { redirect } from 'next/navigation'

export default function Home() {
  // Redirect root path directly to dashboard
  // The dashboard layout will handle auth redirect if not logged in
  redirect('/dashboard')
}
