import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Geist_Mono } from "next/font/google";
import "./globals.css";

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ['300', '400', '500', '600', '700'],
  variable: "--font-ibm-plex-sans-thai",
  subsets: ["thai", "latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DealMee - ผู้ช่วยขาย AI อัจฉริยะ 24 ชม. บน LINE OA & Social Commerce",
  description: "DealMee AI ระบบผู้ช่วยปิดการขายอัจฉริยะ ตรวจสลิป EasySlip ออกใบเสนอราคา A4 และดูแลลูกค้าอัตโนมัติตลอด 24 ชั่วโมง",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${ibmPlexSansThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
