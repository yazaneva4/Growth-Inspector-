import { WhatsAppComposer } from "@/components/whatsapp-composer";

export default function ChatPage() {
  return (
    <div>
      <h1 className="text-xl font-bold text-slate-900">Chat</h1>
      <p className="mt-1 text-sm text-slate-500">
        Type a message and open it as a WhatsApp draft — pick the number, write
        your message, and hit the button to open WhatsApp ready to send.
      </p>
      <div className="mt-6">
        <WhatsAppComposer />
      </div>
    </div>
  );
}
