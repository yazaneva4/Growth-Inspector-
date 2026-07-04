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
          background: "linear-gradient(135deg, #071029 0%, #0e1c47 100%)",
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
            color: "#fb923c",
            marginBottom: 32,
          }}
        >
          {/* mini brand mark */}
          <svg width="52" height="52" viewBox="0 0 64 64">
            <rect width="64" height="64" rx="14" fill="#0e1c47" />
            <rect x="14" y="36" width="7" height="12" rx="2" fill="#f97316" opacity="0.55" />
            <rect x="24" y="28" width="7" height="20" rx="2" fill="#f97316" opacity="0.75" />
            <rect x="34" y="20" width="7" height="28" rx="2" fill="#f97316" />
            <circle cx="41" cy="24" r="12" fill="none" stroke="#ffffff" strokeWidth="4" />
            <line x1="49.5" y1="32.5" x2="57" y2="40" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" />
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
