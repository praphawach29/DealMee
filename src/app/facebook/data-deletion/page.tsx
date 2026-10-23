export const metadata = { title: 'คำขอลบข้อมูล Facebook | DealMee' }

/** Status page Meta links a user to after a data deletion request */
export default async function FacebookDataDeletionPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 space-y-3 text-sm text-slate-700">
        <h1 className="font-heading text-lg font-semibold text-slate-900">คำขอลบข้อมูลจาก Facebook</h1>
        <p>
          DealMee ได้ตัดการเชื่อมต่อเพจทั้งหมดที่บัญชี Facebook นี้เชื่อมไว้ และลบ token ที่ใช้เข้าถึงเพจเรียบร้อยแล้ว
        </p>
        <p>
          ข้อความแชทที่ลูกค้าส่งถึงร้าน เป็นข้อมูลของร้านค้าแต่ละร้าน (ผู้ควบคุมข้อมูล) หากต้องการให้ลบ กรุณาติดต่อร้านค้านั้นโดยตรง
          หรือติดต่อ DealMee ที่ <a className="text-indigo-600 underline" href="mailto:privacy@dealmee.app">privacy@dealmee.app</a>
        </p>
        {code && (
          <p className="text-xs text-slate-500">
            รหัสยืนยัน: <span className="font-mono">{code}</span>
          </p>
        )}
      </div>
    </main>
  )
}
