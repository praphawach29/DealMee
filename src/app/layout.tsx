import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Geist_Mono, Prompt, Anuphan } from "next/font/google";
import "./globals.css";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  variable: "--font-ibm-plex-sans-thai",
  subsets: ["thai", "latin"],
});

const prompt = Prompt({
  weight: ['500', '600'],
  subsets: ['thai', 'latin'],
  variable: '--font-prompt',
  display: 'swap',
});

const anuphan = Anuphan({
  weight: ['500', '600'],
  subsets: ['thai', 'latin'],
  variable: '--font-anuphan',
  display: 'swap',
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DealMee AI - พนักงานขาย AI อัจฉริยะ 24 ชม. บน LINE OA | DealMee.app",
  description: "DealMee AI (DealMee.app) ระบบผู้ช่วยปิดการขายอัจฉริยะบน LINE Official Account รับออเดอร์ ตรวจสลิป EasySlip คำนวณค่าส่ง และออกใบเสนอราคา B2B อัตโนมัติ 24 ชั่วโมง",
  icons: {
    icon: "/logos/dealmee-icon.png",
    shortcut: "/logos/dealmee-icon.png",
    apple: "/logos/dealmee-app-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${ibmPlexSansThai.variable} ${geistMono.variable} ${prompt.variable} ${anuphan.variable} h-full antialiased`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
