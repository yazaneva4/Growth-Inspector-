import { ImageResponse } from "next/og";

export const alt =
  "Growth Inspector — AI customer engagement for Saudi Arabia";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #070F2E 0%, #0F1B4A 100%)",
          color: "#f1f5f9",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 34,
            color: "#F26522",
            marginBottom: 32,
          }}
        >
          {/* G-mark, traced from the brand reference (flat tile fill — the OG
              renderer has unreliable radial-gradient support) */}
          <svg width="62" height="64" viewBox="-5 -5 410 425">
            <path d="M 200 47.5 A 162.5 162.5 0 1 0 360 238.2 L 215 238.2"
              stroke="#F26522" strokeWidth="75" fill="none" strokeLinecap="butt" strokeLinejoin="round" />
            <rect x="220" y="0" width="180" height="175" rx="30" fill="#1B2C66" />
            <circle cx="283" cy="88" r="36" fill="none" stroke="#ffffff" strokeWidth="13" />
            <line x1="307" y1="112" x2="330" y2="135" stroke="#ffffff" strokeWidth="14" strokeLinecap="round" />
            <path d="M 365 6 Q 371 30 392 42 Q 371 54 365 78 Q 359 54 338 42 Q 359 30 365 6 Z" fill="#ffffff" />
          </svg>
          Growth Inspector
        </div>
        <div style={{ fontSize: 64, fontWeight: 700, lineHeight: 1.15, maxWidth: 980 }}>
          The AI that answers your customers — in their own dialect.
        </div>
        <div style={{ fontSize: 30, color: "#94a3b8", marginTop: 28, maxWidth: 900 }}>
          Autonomous Arabic + English replies across WhatsApp, Instagram, X,
          email &amp; phone calls · Built for Saudi Arabia 🇸🇦
        </div>
      </div>
    ),
    { ...size },
  );
}
