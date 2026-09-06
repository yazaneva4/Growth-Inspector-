"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Member = { user_id: string; email: string; name: string; role: string };
type Conversation = {
  id: string;
  kind: "personal" | "group";
  title: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  chat_participants: { user_id: string }[];
};
type Message = {
  id: string;
  conversation_id: string;
  author_id: string;
  author_email: string;
  body: string;
  created_at: string;
};

function initials(value: string) {
  return value.trim().charAt(0).toUpperCase() || "?";
}
function timeLabel(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function ChatsHub() {
  const [mode, setMode] = useState<"personal" | "group">("personal");
  const [members, setMembers] = useState<Member[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [orgId, setOrgId] = useState<string>("");
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showComposer, setShowComposer] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showMessages, setShowMessages] = useState(true);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const memberById = useMemo(() => new Map(members.map((member) => [member.user_id, member])), [members]);
  const visibleConversations = useMemo(
    () => conversations.filter((conversation) => conversation.kind === mode),
    [conversations, mode],
  );
  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;

  function conversationName(conversation: Conversation) {
    if (conversation.kind === "group") return conversation.title || "New group";
    const other = conversation.chat_participants.map((p) => memberById.get(p.user_id)).find((m) => m && m.user_id !== currentUserId);
    return other?.name || other?.email || "Personal chat";
  }

  function otherMember(conversation: Conversation) {
    if (conversation.kind !== "personal") return null;
    return conversation.chat_participants
      .map((participant) => memberById.get(participant.user_id))
      .find((member) => member && member.user_id !== currentUserId) ?? null;
  }

  function Avatar({ member, label }: { member: Member | null; label: string }) {
    const online = Boolean(member && onlineUserIds.has(member.user_id));
    return (
      <span
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${online ? "bg-emerald-100 text-emerald-700 ring-2 ring-emerald-500 ring-offset-1" : "bg-slate-100 text-slate-600 ring-2 ring-slate-300 ring-offset-1"}`}
        aria-label={`${label} · ${online ? "Online" : "Offline"}`}
        title={`${label} · ${online ? "Online" : "Offline"}`}
      >
        {initials(member?.name || member?.email || label)}
      </span>
    );
  }

  async function load() {
    setError(null);
    const response = await fetch("/api/chats", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to load chats");
    setMembers(data.members ?? []);
    setConversations(data.conversations ?? []);
    setCurrentUserId(data.currentUserId ?? "");
    setOrgId(data.orgId ?? "");
    setSelectedId((current) => current ?? data.conversations?.[0]?.id ?? null);
  }

  async function loadMessages(conversationId: string) {
    const response = await fetch(`/api/chats?conversationId=${encodeURIComponent(conversationId)}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Unable to load messages");
    setMessages(data.messages ?? []);
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : "Unable to load chats"));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void loadMessages(selectedId).catch((err) => setError(err instanceof Error ? err.message : "Unable to load messages"));
  }, [selectedId]);

  useEffect(() => {
    if (!currentUserId || !orgId) return;
    const supabase = createClient();
    const channel = supabase.channel(`internal-chat-presence:${orgId}`, {
      config: { presence: { key: currentUserId } },
    });

    const updatePresence = () => {
      const state = channel.presenceState<{ user_id: string }>();
      const online = new Set<string>();
      Object.values(state).forEach((entries) => {
        entries.forEach((entry) => {
          if (entry.user_id) online.add(entry.user_id);
        });
      });
      setOnlineUserIds(online);
    };

    channel
      .on("presence", { event: "sync" }, updatePresence)
      .on("presence", { event: "join" }, updatePresence)
      .on("presence", { event: "leave" }, updatePresence)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ user_id: currentUserId });
          updatePresence();
        }
      });

    return () => {
      void channel.untrack();
      void supabase.removeChannel(channel);
      setOnlineUserIds(new Set());
    };
  }, [currentUserId, orgId]);

  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`internal-chats:${currentUserId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (payload) => {
        const message = payload.new as Message;
        setMessages((current) => current.some((item) => item.id === message.id) || message.conversation_id !== selectedId ? current : [...current, message]);
        setConversations((current) => current.map((conversation) => conversation.id === message.conversation_id ? { ...conversation, updated_at: message.created_at } : conversation).sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_conversations" }, () => {
        void load().catch(() => undefined);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [currentUserId, selectedId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function createChat() {
    setError(null);
    if (mode === "personal" && selectedMembers.length !== 1) {
      setError("Choose one team member for a personal chat.");
      return;
    }
    if (mode === "group" && selectedMembers.length < 1) {
      setError("Choose at least one team member for a group.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", kind: mode, participantIds: selectedMembers, title: groupTitle }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to create chat");
      setShowComposer(false);
      setSelectedMembers([]);
      setGroupTitle("");
      await load();
      setSelectedId(data.conversation.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create chat");
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || !selectedId || busy) return;
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/api/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "message", conversationId: selectedId, text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to send message");
      setInput("");
      if (data.message) setMessages((current) => current.some((item) => item.id === data.message.id) ? current : [...current, data.message]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send message");
    } finally {
      setBusy(false);
    }
  }

  function toggleMember(id: string) {
    setSelectedMembers((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  }

  return (
    <div className="flex min-h-[72vh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:flex-row">
      <aside className={`w-full border-b border-slate-200 lg:w-80 lg:shrink-0 lg:border-b-0 lg:border-r ${selectedId ? "hidden lg:flex" : "flex"} flex-col`}>
        <div className="border-b border-slate-200 p-3">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
            <button onClick={() => setMode("personal")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "personal" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Personal Chats</button>
            <button onClick={() => setMode("group")} className={`rounded-lg px-3 py-2 text-sm font-semibold ${mode === "group" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>Group Chats</button>
          </div>
          <button onClick={() => { setError(null); setShowComposer(true); }} className="mt-3 w-full rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600">+ New {mode === "personal" ? "personal chat" : "group"}</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {visibleConversations.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No {mode} chats yet.</div>
          ) : visibleConversations.map((conversation) => (
            <button key={conversation.id} onClick={() => setSelectedId(conversation.id)} className={`mb-1 flex w-full items-center gap-3 rounded-xl p-3 text-left ${selectedId === conversation.id ? "bg-emerald-50" : "hover:bg-slate-50"}`}>
              <Avatar member={otherMember(conversation)} label={conversationName(conversation)} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{conversationName(conversation)}</span><span className="block truncate text-xs text-slate-400">{conversation.kind === "group" ? `${conversation.chat_participants.length} members` : "Personal"}</span></span>
            </button>
          ))}
        </div>
      </aside>

      <main className={`min-w-0 flex-1 flex-col ${selectedId ? "flex" : "hidden lg:flex"}`}>
        {selected ? (
          <>
            <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
              <button onClick={() => setSelectedId(null)} className="rounded-lg px-2 py-1 text-lg text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Back to chats">←</button>
              <Avatar member={otherMember(selected)} label={conversationName(selected)} />
              <div className="min-w-0 flex-1"><h2 className="truncate text-sm font-semibold text-slate-900">{conversationName(selected)}</h2><p className="text-xs text-slate-400">{selected.kind === "group" ? "Group chat" : "Personal chat"}</p></div>
              <button onClick={() => setShowMessages((value) => !value)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Messages</button>
            </header>

            {showMessages && <div className="flex-1 overflow-y-auto p-4" aria-label="Messages">
              {messages.length === 0 ? <p className="py-12 text-center text-sm text-slate-500">No messages yet. Start the conversation.</p> : messages.map((message) => {
                const mine = message.author_id === currentUserId;
                return <div key={message.id} className={`mb-3 flex gap-2 ${mine ? "flex-row-reverse" : ""}`}><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{initials(message.author_email)}</span><div className={`max-w-[82%] ${mine ? "text-right" : ""}`}><div className="text-[10px] text-slate-400">{mine ? "You" : message.author_email} · {timeLabel(message.created_at)}</div><div className={`mt-1 inline-block whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${mine ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-900"}`} dir="auto">{message.body}</div></div></div>;
              })}
              <div ref={bottomRef} />
            </div>}

            <div className="border-t border-slate-200 p-3"><div className="flex gap-2"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} rows={1} placeholder="Write a message…" className="min-h-11 flex-1 resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500" dir="auto"/><button onClick={() => void send()} disabled={busy || !input.trim()} className="self-end rounded-xl bg-emerald-500 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50">{busy ? "…" : "Send"}</button></div><p className="mt-1 text-[10px] text-slate-400">Enter sends · Shift+Enter makes a new line</p></div>
          </>
        ) : <div className="flex flex-1 items-center justify-center p-8 text-center"><div><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-2xl">💬</div><h2 className="mt-4 text-lg font-semibold text-slate-900">Choose a chat</h2><p className="mt-1 text-sm text-slate-500">Select a conversation or create a new one.</p></div></div>}
      </main>

      {showComposer && <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/30 p-3 sm:items-center"><div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">New {mode === "personal" ? "personal chat" : "group chat"}</h2><p className="text-xs text-slate-500">Choose members from your Growth Inspector workspace.</p></div><button onClick={() => setShowComposer(false)} className="rounded-lg px-2 py-1 text-slate-500">✕</button></div>{mode === "group" && <input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} placeholder="Group name" className="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-emerald-500"/>}<div className="mt-4 max-h-64 space-y-1 overflow-y-auto">{members.filter((member) => member.user_id !== currentUserId).map((member) => <button key={member.user_id} onClick={() => mode === "personal" ? setSelectedMembers([member.user_id]) : toggleMember(member.user_id)} className={`flex w-full items-center gap-3 rounded-xl p-3 text-left ${selectedMembers.includes(member.user_id) ? "bg-emerald-50 ring-1 ring-emerald-200" : "hover:bg-slate-50"}`}><span className={`relative flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold ring-2 ring-offset-1 ${onlineUserIds.has(member.user_id) ? "ring-emerald-500" : "ring-slate-300"}`} aria-label={`${member.name || member.email} · ${onlineUserIds.has(member.user_id) ? "Online" : "Offline"}`} title={`${member.name || member.email} · ${onlineUserIds.has(member.user_id) ? "Online" : "Offline"}`}>{initials(member.name || member.email)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{member.name}</span><span className="block truncate text-xs text-slate-400">{member.email}</span></span><span className="text-emerald-600">{selectedMembers.includes(member.user_id) ? "✓" : ""}</span></button>)}</div><button onClick={() => void createChat()} disabled={busy || selectedMembers.length === 0} className="mt-4 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Creating…" : "Create chat"}</button></div></div>}
      {error && <div className="fixed bottom-4 left-1/2 z-[60] -translate-x-1/2 rounded-xl bg-slate-900 px-4 py-3 text-xs text-white shadow-lg">{error}</div>}
    </div>
  );
}
