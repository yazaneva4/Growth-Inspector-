import { GoogleGenAI } from "@google/genai";

/** Free-tier Gemini model, used as a fallback provider and for the Growth Agent. */
export const GEMINI_MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | null = null;

export function gemini(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}
