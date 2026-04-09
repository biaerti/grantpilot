-- migration_005_leads_reminders.sql
-- Moduł rekrutacji: leady, dokumenty rekrutacyjne, przypomnienia/obdzwonki

-- 1. Rozszerzenie tabeli participants o pola rekrutacyjne
-- (participation_status już istnieje: 'lead' | 'active' | 'completed')
alter table participants
  add column if not exists lead_status text default 'nowy'
    check (lead_status in ('nowy','w_kontakcie','zakwalifikowany','odrzucony','uczestnik')),
  add column if not exists lead_source text default 'olx'
    check (lead_source in ('olx','tally','telefon','polecenie','inne')),
  add column if not exists tally_response_id text,          -- ID odpowiedzi z Tally
  add column if not exists form_answers jsonb,              -- surowe dane z formularza Tally
  add column if not exists assigned_to text,                -- inicjały / user_id osoby prowadzącej
  add column if not exists callback_at timestamptz,         -- kiedy oddzwonić
  add column if not exists callback_note text,              -- notatka do obdzwonki
  add column if not exists instant_email_sent_at timestamptz, -- kiedy wysłano pierwszy mail
  add column if not exists docs_email_sent_at timestamptz,  -- kiedy wysłano mail z dokumentami
  add column if not exists qualification_notes text;        -- notatki z kwalifikacji

-- 2. Typy dokumentów rekrutacyjnych (osobna tabela, bo to wzory — nie document_types które są per uczestnik)
create table if not exists recruitment_document_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  name text not null,                  -- np. "Formularz zgłoszeniowy"
  description text,
  file_url text,                       -- URL do wzoru PDF w Supabase Storage
  file_name text,
  required boolean default true,
  who_fills text default 'uczestnik'   -- 'uczestnik' | 'my' | 'zus' | 'up' | 'ops'
    check (who_fills in ('uczestnik','my','zus','up','ops','mops')),
  applies_to text default 'wszyscy'    -- 'wszyscy' | 'bezrobotni' | 'bierni' | 'niepelnosprawni' | 'ukr'
    check (applies_to in ('wszyscy','bezrobotni','bierni','niepelnosprawni','ukr','ops')),
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 3. Dokumenty rekrutacyjne konkretnych leadów/uczestników
create table if not exists lead_documents (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  doc_type_id uuid references recruitment_document_types(id) on delete set null,
  name text not null,
  delivered boolean default false,
  delivered_at timestamptz,
  file_url text,                        -- jeśli wgrali przez aplikację
  file_name text,
  notes text,
  created_at timestamptz default now()
);

-- 4. Przypomnienia / obdzwonki
create table if not exists reminders (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  assigned_to text not null,            -- inicjały lub user_id
  remind_at timestamptz not null,       -- kiedy ma być przypomnienie
  all_day boolean default false,        -- czy bez konkretnej godziny
  note text,                            -- "prosił zadzwonić o 10", "nie odebrał"
  done boolean default false,
  done_at timestamptz,
  created_by text,
  created_at timestamptz default now()
);

-- 5. Przypisanie formularza Tally do projektu
alter table projects
  add column if not exists tally_form_id text;  -- np. "zxrYp0"

-- Indeksy
create index if not exists idx_participants_lead_status on participants(lead_status) where participation_status = 'lead';
create index if not exists idx_participants_assigned_to on participants(assigned_to);
create index if not exists idx_lead_documents_participant on lead_documents(participant_id);
create index if not exists idx_reminders_project on reminders(project_id);
create index if not exists idx_reminders_remind_at on reminders(remind_at) where done = false;
create index if not exists idx_reminders_assigned_to on reminders(assigned_to) where done = false;

-- Seed: typy dokumentów rekrutacyjnych dla PnS
-- (uruchomić po migracji, wymaga project_id PnS)
insert into recruitment_document_types (project_id, name, description, required, who_fills, applies_to, sort_order)
values
  ('27721fc6-935a-46a3-863b-b485bc0db01c', 'Formularz zgłoszeniowy PnS',
   'Główny formularz rekrutacyjny – obowiązkowy dla każdego uczestnika',
   true, 'uczestnik', 'wszyscy', 1),
  ('27721fc6-935a-46a3-863b-b485bc0db01c', 'Wniosek ZUS US-7',
   'Wniosek o wydanie zaświadczenia – dotyczy osób niezarejestrowanych w UP (idą do ZUS); zarejestrowani proszą o zaświadczenie w swoim UP',
   true, 'zus', 'bezrobotni', 2),
  ('27721fc6-935a-46a3-863b-b485bc0db01c', 'Zaświadczenie z OPS/GOPS',
   'Dokument potwierdzający korzystanie z pomocy społecznej',
   false, 'ops', 'ops', 3),
  ('27721fc6-935a-46a3-863b-b485bc0db01c', 'Dokument potwierdzający status UKR',
   'Ochrona czasowa – specustawa ukraińska',
   false, 'uczestnik', 'ukr', 4),
  ('27721fc6-935a-46a3-863b-b485bc0db01c', 'Orzeczenie o niepełnosprawności',
   'Kopia orzeczenia lub inny dokument potwierdzający niepełnosprawność',
   false, 'uczestnik', 'niepelnosprawni', 5)
on conflict do nothing;
