"use client";

import { useState } from "react";

/** Country dial codes — Saudi Arabia first (the default). */
const COUNTRIES = [
  { code: "966", flag: "🇸🇦", name: "Saudi Arabia" },
  { code: "971", flag: "🇦🇪", name: "UAE" },
  { code: "965", flag: "🇰🇼", name: "Kuwait" },
  { code: "974", flag: "🇶🇦", name: "Qatar" },
  { code: "973", flag: "🇧🇭", name: "Bahrain" },
  { code: "968", flag: "🇴🇲", name: "Oman" },
  { code: "20", flag: "🇪🇬", name: "Egypt" },
  { code: "962", flag: "🇯🇴", name: "Jordan" },
  { code: "961", flag: "🇱🇧", name: "Lebanon" },
  { code: "91", flag: "🇮🇳", name: "India" },
  { code: "92", flag: "🇵🇰", name: "Pakistan" },
  { code: "44", flag: "🇬🇧", name: "UK" },
  { code: "1", flag: "🇺🇸", name: "USA / Canada" },
];

/** Builds a wa.me deep link that opens WhatsApp with the message pre-filled
 *  as a draft — you review and tap send yourself. No API, no auto-send.
 *  `dialCode` is the country code (e.g. 966); `local` is the rest of the
 *  number without the leading 0 or +. */
function draftLink(dialCode: string, local: string, message: string): string {
  const localDigits = local.replace(/[^\d]/g, "").replace(/^0+/, "");
  return `https://wa.me/${dialCode}${localDigits}?text=${encodeURIComponent(message)}`;
}

export function WhatsAppComposer() {
  const [dialCode, setDialCode] = useState(COUNTRIES[0].code); // Saudi Arabia
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");

  const localDigits = phone.replace(/[^\d]/g, "").replace(/^0+/, "");
  const ready = localDigits.length >= 6 && message.trim().length > 0;

  return (
    <div className="max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <label className="text-xs font-medium text-slate-500">WhatsApp number</label>
        <div className="mt-1 flex gap-2">
          <select
            value={dialCode}
            onChange={(e) => setDialCode(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm outline-none focus:border-emerald-500"
            aria-label="Country code"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.flag} {c.name} +{c.code}
              </option>
            ))}
          </select>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="5X XXX XXXX"
            inputMode="tel"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Pick the country — the code (+{dialCode}) is added automatically.
          {localDigits && ` Sending to +${dialCode} ${localDigits}.`}
        </p>
      </div>

      <div>
        <label className="text-xs font-medium text-slate-500">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type your message…"
          rows={5}
          dir="auto"
          className="mt-1 w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
      </div>

      {ready ? (
        <a
          href={draftLink(dialCode, phone, message)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91C21.96 6.45 17.5 2 12.04 2Zm5.8 14.1c-.24.68-1.4 1.3-1.93 1.38-.5.08-1.1.11-1.78-.11-.41-.13-.94-.3-1.62-.6-2.85-1.23-4.71-4.1-4.85-4.29-.14-.19-1.16-1.54-1.16-2.94 0-1.4.73-2.08.99-2.37.26-.29.57-.36.76-.36h.55c.18 0 .41-.03.64.49.24.53.8 1.83.87 1.96.07.13.12.29.02.47-.1.19-.15.3-.29.46-.14.16-.3.36-.43.48-.14.13-.29.28-.13.55.17.28.75 1.24 1.61 2.01 1.11.99 2.04 1.29 2.32 1.44.29.14.45.12.62-.07.17-.19.71-.83.9-1.11.19-.29.38-.24.63-.14.26.1 1.65.78 1.93.92.29.14.48.21.55.33.07.12.07.68-.17 1.36Z"/>
          </svg>
          Open WhatsApp draft
        </a>
      ) : (
        <button
          disabled
          className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-400"
        >
          Open WhatsApp draft
        </button>
      )}
      <p className="text-[11px] text-slate-400">
        Opens WhatsApp with your message ready — you tap send yourself. Nothing
        is sent automatically.
      </p>
    </div>
  );
}
