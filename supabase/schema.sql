create extension if not exists pgcrypto;

create table if not exists public.host_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  role text not null default 'host' check (role in ('host', 'admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.quiz_sets (
  id uuid primary key,
  title text not null,
  description text not null default '',
  category text not null default 'Internal Learning',
  language text not null default 'th',
  mode text not null check (mode in ('knowledge_check', 'scenario_sprint', 'team_pulse')),
  created_by uuid references public.host_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.quiz_questions (
  id uuid primary key,
  quiz_set_id uuid not null references public.quiz_sets(id) on delete cascade,
  position integer not null,
  prompt text not null,
  choices jsonb not null,
  correct_choice_id text not null,
  time_limit_sec integer not null default 20,
  explanation text not null default '',
  facilitator_prompt text not null default '',
  theme_tag text not null default 'general',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (quiz_set_id, position)
);

create table if not exists public.live_sessions (
  id uuid primary key,
  quiz_set_id uuid not null references public.quiz_sets(id) on delete restrict,
  quiz_set_title text not null,
  join_code text not null unique,
  status text not null check (status in ('lobby', 'question_open', 'question_closed', 'leaderboard', 'finished')),
  show_leaderboard_every_round boolean not null default true,
  scoring_mode text not null default 'correct_plus_speed',
  created_by uuid references public.host_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  current_question_index integer not null default -1,
  last_closed_question_index integer,
  question_started_at timestamptz,
  question_ends_at timestamptz
);

create table if not exists public.session_participants (
  id uuid primary key,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  display_name text not null,
  team_name text not null,
  joined_at timestamptz not null default timezone('utc', now()),
  score integer not null default 0,
  correct_answers integer not null default 0
);

create table if not exists public.session_submissions (
  id uuid primary key,
  session_id uuid not null references public.live_sessions(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  participant_id uuid not null references public.session_participants(id) on delete cascade,
  selected_choice_id text not null,
  submitted_at timestamptz not null default timezone('utc', now()),
  response_ms integer not null,
  is_correct boolean not null,
  points_awarded integer not null default 0,
  unique (session_id, question_id, participant_id)
);

create index if not exists idx_quiz_questions_quiz_set on public.quiz_questions(quiz_set_id, position);
create index if not exists idx_live_sessions_join_code on public.live_sessions(join_code);
create index if not exists idx_session_participants_session on public.session_participants(session_id);
create unique index if not exists idx_session_participants_identity on public.session_participants(session_id, lower(display_name), lower(team_name));
create index if not exists idx_session_submissions_session on public.session_submissions(session_id);
create index if not exists idx_session_submissions_question on public.session_submissions(question_id);

alter table public.host_users enable row level security;
alter table public.quiz_sets enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.live_sessions enable row level security;
alter table public.session_participants enable row level security;
alter table public.session_submissions enable row level security;
