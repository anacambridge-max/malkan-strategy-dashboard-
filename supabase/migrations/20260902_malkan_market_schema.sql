create table if not exists public.malkan_symbols (
  symbol text primary key,
  company_name text,
  sector text,
  exchange text not null default 'NSE',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.malkan_candles (
  symbol text not null references public.malkan_symbols(symbol) on delete cascade,
  timeframe text not null check (timeframe in ('1D','1W','1M')),
  candle_time date not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume bigint not null default 0,
  source text not null,
  created_at timestamptz not null default now(),
  primary key(symbol,timeframe,candle_time)
);

create index if not exists idx_malkan_candles_time on public.malkan_candles(timeframe,candle_time desc);
create index if not exists idx_malkan_candles_symbol on public.malkan_candles(symbol,timeframe,candle_time desc);

create table if not exists public.malkan_signals (
  id uuid primary key default gen_random_uuid(),
  symbol text not null references public.malkan_symbols(symbol) on delete cascade,
  signal_date date not null,
  setup_type text not null,
  status text not null check(status in ('FORMING','READY','TRIGGERED','FAILED','TARGET_HIT')),
  monthly_rsi numeric,
  weekly_rsi numeric,
  daily_rsi numeric,
  daily_rsi_previous numeric,
  relative_volume numeric,
  entry numeric,
  stop_loss numeric,
  target numeric,
  risk_reward numeric,
  score numeric,
  reasons jsonb not null default '[]'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(symbol,signal_date,setup_type)
);

create index if not exists idx_malkan_signals_date on public.malkan_signals(signal_date desc);
create index if not exists idx_malkan_signals_status on public.malkan_signals(status,score desc);

alter table public.malkan_symbols enable row level security;
alter table public.malkan_candles enable row level security;
alter table public.malkan_signals enable row level security;

create policy "malkan symbols read" on public.malkan_symbols for select using (true);
create policy "malkan candles read" on public.malkan_candles for select using (true);
create policy "malkan signals read" on public.malkan_signals for select using (true);
