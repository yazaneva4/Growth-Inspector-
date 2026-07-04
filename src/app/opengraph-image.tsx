import { ImageResponse } from "next/og";

export const alt =
  "Growth Space — AI customer engagement for Saudi Arabia";
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
          {/* G-mark logo */}
          <svg width="56" height="56" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="14" fill="#ffffff" />
            <path d="M 50 32 A 18 18 0 1 1 32 14"
              stroke="#F26522" strokeWidth="8" fill="none" strokeLinecap="round" />
            <rect x="33" y="11" width="15" height="15" rx="3" fill="#1B2A6B" />
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
