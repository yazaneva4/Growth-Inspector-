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
          {/* G-mark logo — solid fills (next/og's renderer has limited gradient support) */}
          <svg width="56" height="67" viewBox="60 32 185 215">
            <path d="M 228 160 A 78 78 0 1 1 155 83" stroke="#F26522" strokeWidth="50" fill="none" strokeLinecap="round" />
            <rect x="155" y="135" width="82" height="50" rx="25" fill="#F26522" />
            <rect x="146" y="42" width="82" height="82" rx="18" fill="#16255C" />
            <circle cx="178" cy="76" r="13.5" fill="none" stroke="#ffffff" strokeWidth="5.5" />
            <line x1="187.5" y1="85.5" x2="198" y2="96" stroke="#ffffff" strokeWidth="6.5" strokeLinecap="round" />
            <path d="M 204 54 C 205.4 59.6 206.8 61 212 62.4 C 206.8 63.8 205.4 65.2 204 70.8 C 202.6 65.2 201.2 63.8 196 62.4 C 201.2 61 202.6 59.6 204 54 Z" fill="#ffffff" />
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
