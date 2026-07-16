import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = { title: "Privacy Policy — Growth Inspector" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-white text-slate-950">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/">
            <Logo variant="light" />
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-700 hover:text-slate-950">
            ← Back home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-6 py-16 text-sm leading-relaxed text-slate-700">
        <h1 className="font-serif text-3xl font-semibold text-slate-950">Privacy Policy</h1>
        <p className="mt-2 text-slate-500">Last updated: July 2026</p>

        <p className="mt-8">
          This Privacy Policy explains how <strong>Growth Space</strong>{" "}
          (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) collects,
          uses, and protects information in connection with Growth Inspector
          (the &ldquo;Service&rdquo;).
        </p>

        <h2 className="mt-10 text-lg font-semibold text-slate-950">1. Information we collect</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li><strong>Account information:</strong> name, email, company/workspace details you provide when signing up or onboarding.</li>
          <li><strong>Conversation data:</strong> messages sent and received through the channels you connect (WhatsApp, Instagram, email, voice, etc.), and the AI&rsquo;s generated replies, classifications, and confidence scores.</li>
          <li><strong>Usage data:</strong> pages visited, features used, and general diagnostic/log information needed to operate and improve the Service.</li>
          <li><strong>Connected account credentials:</strong> tokens/IDs needed to send and receive messages on your behalf via the platforms you connect.</li>
        </ul>

        <h2 className="mt-10 text-lg font-semibold text-slate-950">2. How we use information</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>To operate the Service — routing customer messages, generating AI replies and analytics, and displaying your inbox and reports;</li>
          <li>To improve reliability and detect abuse or misuse of the Service;</li>
          <li>To communicate with you about your account, billing, or material changes to the Service;</li>
          <li>To comply with legal obligations.</li>
        </ul>

        <h2 className="mt-10 text-lg font-semibold text-slate-950">3. AI processing & sub-processors</h2>
        <p className="mt-3">
          To generate replies and analysis, message content is sent to
          third-party AI providers (such as Anthropic and Google) that
          process it under their own data-handling terms in order to return a
          response to the Service. We do not sell your data or your
          customers&rsquo; message content to third parties.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-slate-950">4. Data retention</h2>
        <p className="mt-3">
          We retain conversation and account data for as long as your
          workspace is active, plus a reasonable period afterward for backups,
          dispute resolution, and legal compliance, after which it is deleted
          or anonymized.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-slate-950">5. Your rights</h2>
        <p className="mt-3">
          You may request access to, correction of, or deletion of your
          account&rsquo;s personal data by contacting us at the email below,
          subject to any legal or legitimate business retention requirements.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-slate-950">6. Security</h2>
        <p className="mt-3">
          We use reasonable technical and organizational measures — including
          per-workspace data isolation and access controls — to protect
          account and conversation data. No method of transmission or storage
          is 100% secure, and we cannot guarantee absolute security.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-slate-950">7. Cookies</h2>
        <p className="mt-3">
          We use essential cookies to keep you signed in and to operate the
          dashboard. We do not use third-party advertising cookies.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-slate-950">8. Changes to this policy</h2>
        <p className="mt-3">
          We may update this Privacy Policy from time to time. Material
          changes will be reflected by updating the date at the top of this
          page.
        </p>

        <h2 className="mt-10 text-lg font-semibold text-slate-950">9. Contact</h2>
        <p className="mt-3">
          Questions about this policy or your data? Reach us at{" "}
          <a href="mailto:contact@growth-space.net" className="text-emerald-600 underline">
            contact@growth-space.net
          </a>
          .
        </p>
      </article>
    </main>
  );
}
