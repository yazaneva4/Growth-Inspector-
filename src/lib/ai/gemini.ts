import { GoogleGenAI } from "@google/genai";

/** Free-tier Gemini model, used as a fallback provider and for the Growth Agent. */
export const GEMINI_MODEL = "gemini-2.5-flash";

/** Accept either name — Google's own docs use GOOGLE_API_KEY, ours documented
 *  GEMINI_API_KEY; support whichever the host has configured. */
function apiKey(): string | undefined {
  return process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
}

let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: apiKey() });
  }
  return client;
}

export function geminiConfigured(): boolean {
  return Boolean(apiKey());
}
