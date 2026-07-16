import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Kufi_Arabic, Source_Serif_4 } from "next/font/google";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION } from "@/lib/site";
import "./globals.css";

// Plus Jakarta Sans — rounded, premium sans-serif matching the brand logomark style.
const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

// Arabic-native typeface so Khaleeji/MSA content renders beautifully.
const notoArabic = Noto_Kufi_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
});

// Editorial serif for headlines and formal documents — same register as the
// serif Anthropic uses for its own long-form/editorial text.
const sourceSerif = Source_Serif_4({
  variable: "--font-serif-brand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — AI customer engagement for Saudi Arabia`,
    template: `%s · ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "AI customer service",
    "Saudi Arabia",
    "Arabic AI",
    "WhatsApp automation",
    "social media AI",
    "Khaleeji dialect",
    "growth analytics",
  ],
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — AI customer engagement for Saudi Arabia`,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
    alternateLocale: "ar_SA",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — AI customer engagement for Saudi Arabia`,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakartaSans.variable} ${notoArabic.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
