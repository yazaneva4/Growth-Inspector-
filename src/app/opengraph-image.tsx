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
          {/* G-mark logo — flat solid fills, tile floats above the arm */}
          <svg width="53" height="67" viewBox="60 15 185 235">
            <path d="M 228 160 A 78 78 0 1 1 155 83" stroke="#F26522" strokeWidth="50" fill="none" strokeLinecap="round" />
            <rect x="155" y="135" width="82" height="50" rx="25" fill="#F26522" />
            <rect x="150" y="24" width="72" height="72" rx="16" fill="#16255C" />
            <circle cx="177" cy="52" r="11.5" fill="none" stroke="#ffffff" strokeWidth="5" />
            <line x1="185" y1="60" x2="194" y2="69" stroke="#ffffff" strokeWidth="5.8" strokeLinecap="round" />
            <path d="M 199 34 C 200.2 38.8 201.4 40 205.8 41.2 C 201.4 42.4 200.2 43.6 199 48.4 C 197.8 43.6 196.6 42.4 192.2 41.2 C 196.6 40 197.8 38.8 199 34 Z" fill="#ffffff" />
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
