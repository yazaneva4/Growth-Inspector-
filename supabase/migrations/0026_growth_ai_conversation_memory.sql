-- Growth AI keeps the full saved conversation history available for future turns.
-- The UI can use this as durable conversational memory without a second database.
alter table public.ai_operator_conversations
  add column if not exists memory_enabled boolean not null default true;

comment on column public.ai_operator_conversations.memory_enabled is
  'When true, Growth AI includes older saved messages from this conversation as conversational memory.';
