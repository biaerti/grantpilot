-- Organizations (podmioty)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nip text,
  address text,
  type text default 'external', -- 'own' (Pretium/Educandis/Ceduro) or 'external'
  created_at timestamptz default now()
);

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  project_number text not null, -- e.g. FEDS.07.03-IP.02-0039/25
  name text not null,
  short_name text, -- e.g. "Równość na co dzień"
  organization_id uuid references organizations(id),
  is_subcontractor boolean default false, -- true = we are subcontractor, no full budget
  start_date date not null,
  end_date date not null,
  indirect_cost_rate numeric default 0.20,
  total_budget numeric,
  grant_amount numeric,
  grant_rate numeric, -- e.g. 0.85
  advance_received numeric default 0, -- zaliczka otrzymana
  status text default 'active', -- active/completed/suspended
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tasks (Zadania)
create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  number int not null, -- 1, 2, 3...
  name text not null,
  description text,
  budget_direct numeric default 0,
  budget_indirect numeric default 0,
  budget_total numeric generated always as (budget_direct + budget_indirect) stored,
  created_at timestamptz default now()
);

-- Budget Lines (Pozycje budżetowe)
create table budget_lines (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references tasks(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  name text not null,
  unit text, -- szt, godzina, miesiąc, etc.
  unit_cost numeric,
  quantity_planned numeric,
  amount_planned numeric,
  category text default 'other', -- personnel, subcontracting, other, indirect
  notes text,
  created_at timestamptz default now()
);

-- Participants (Uczestnicy)
create table participants (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  pesel text,
  no_pesel boolean default false,
  technical_id text, -- from SL system
  gender text, -- K/M
  age_at_start int,
  education_level text,
  nationality text default 'Obywatelstwo polskie',
  country text default 'Polska',
  voivodeship text,
  county text,
  commune text,
  city text,
  postal_code text,
  degurba int, -- 1=miasto, 2=podmiejski, 3=wiejski
  phone text,
  email text,
  employment_status text,
  employment_detail text,
  support_type text,
  support_form text,
  support_start_date date,
  project_start_date date,
  project_end_date date,
  disability boolean default false,
  foreign_origin boolean default false,
  third_country_citizen boolean default false,
  minority boolean default false,
  homeless boolean default false,
  situation_at_end text,
  completed_path boolean,
  sl_added_by text,
  sl_added_at timestamptz,
  source text default 'manual', -- manual/import
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Staff (Personel - prowadzący, eksperci, psycholodzy)
create table staff (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  role text, -- psycholog, trener, prowadzący, etc.
  notes text,
  created_at timestamptz default now()
);

-- Events (Zdarzenia - szkolenia, warsztaty, konferencje, sesje, filmy, etc.)
create table events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id),
  budget_line_id uuid references budget_lines(id),
  name text not null,
  type text not null, -- training, workshop, conference, consulting, production, podcast, other
  status text default 'draft', -- draft, planned, accepted, completed, settled
  planned_date date,
  actual_date date,
  planned_end_date date,
  start_time time,
  end_time time,
  location text,
  planned_participants_count int default 0,
  actual_participants_count int,
  planned_cost numeric default 0,
  actual_cost numeric,
  send_invitations boolean default false,
  harmonogram_do_urzedu boolean default false,
  notes text,
  accepted_at timestamptz,
  accepted_by uuid,
  completed_at timestamptz,
  completed_by uuid,
  settled_at timestamptz,
  accounting_request_id uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Event Participants
create table event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  participant_id uuid references participants(id) on delete cascade,
  status text default 'planned', -- planned, confirmed, attended, absent
  send_invitation boolean default true,
  invitation_sent_at timestamptz,
  notes text,
  created_at timestamptz default now(),
  unique(event_id, participant_id)
);

-- Event Staff
create table event_staff (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete cascade,
  staff_id uuid references staff(id) on delete cascade,
  role text,
  hours_planned numeric,
  hours_actual numeric,
  rate numeric, -- stawka za godzinę
  created_at timestamptz default now()
);

-- Settlement Periods / Payment Requests (WNP)
create table settlement_periods (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  number int not null, -- WNP001, WNP002, etc.
  period_start date not null,
  period_end date not null,
  status text default 'draft', -- draft, submitted, approved, rejected
  advance_received boolean default false,
  advance_amount numeric default 0,
  total_claimed numeric default 0,
  total_approved numeric,
  submitted_at timestamptz,
  approved_at timestamptz,
  notes text,
  created_at timestamptz default now()
);

-- Expenses (Wydatki)
create table expenses (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  task_id uuid references tasks(id),
  budget_line_id uuid references budget_lines(id),
  event_id uuid references events(id),
  period_id uuid references settlement_periods(id),
  organization_id uuid references organizations(id),
  document_number text,
  accounting_number text,
  vendor_name text,
  vendor_nip text,
  document_date date,
  payment_date date,
  amount numeric not null,
  description text,
  status text default 'planned', -- planned, pending_invoice, invoiced, paid, settled
  notes text,
  created_at timestamptz default now()
);

-- Accounting Requests (Zlecenia dla Kamili)
create table accounting_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  event_id uuid references events(id),
  organization_id uuid references organizations(id),
  amount numeric not null,
  description text not null,
  details jsonb,
  status text default 'pending', -- pending, invoiced, paid
  notes_for_accountant text,
  invoice_number text,
  invoice_date date,
  expense_id uuid references expenses(id),
  created_by uuid,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- User profiles
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text default 'coordinator', -- coordinator, accountant, manager, viewer
  avatar_url text,
  created_at timestamptz default now()
);

-- RLS policies
alter table projects enable row level security;
alter table tasks enable row level security;
alter table budget_lines enable row level security;
alter table events enable row level security;
alter table participants enable row level security;
alter table event_participants enable row level security;
alter table expenses enable row level security;
alter table accounting_requests enable row level security;
alter table organizations enable row level security;
alter table settlement_periods enable row level security;
alter table staff enable row level security;
alter table event_staff enable row level security;
alter table user_profiles enable row level security;

-- Allow authenticated users to access everything (simplified for MVP)
create policy "Authenticated users can do everything" on projects for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on tasks for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on budget_lines for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on events for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on participants for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on event_participants for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on expenses for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on accounting_requests for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on organizations for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on settlement_periods for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on staff for all to authenticated using (true) with check (true);
create policy "Authenticated users can do everything" on event_staff for all to authenticated using (true) with check (true);
create policy "Authenticated users can read own profile" on user_profiles for all to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Function to handle new user
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
