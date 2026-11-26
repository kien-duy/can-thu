-- Cần Thủ: schema Postgres (Supabase). Migration đầu tiên.
-- Nguyên tắc:
--   * Nội dung game (loài, nhịp phao, địa điểm, đồ nghề, mồi) nằm trong file JSON của client.
--     DB chỉ giữ 2 bảng tham chiếu (species, locations) để làm khoá ngoại và để server kiểm tra giới hạn.
--     Hai bảng này được seed từ chính các file JSON đó bằng script.
--   * Mọi dữ liệu của người chơi có cột user_id = auth.users.id, và bật RLS.
--   * Bảng catches và fishing_sessions KHÔNG cho client insert/update trực tiếp.
--     Client chỉ ghi qua các hàm RPC (security definer); các hàm này kiểm tra giới hạn cơ bản.
--   * id của session và catch do client sinh (uuid v4): gửi lại lần hai thì "on conflict do nothing",
--     nhờ đó hàng đợi offline có thể gửi lại an toàn.
--   * Thời gian luôn lưu timestamptz UTC; múi giờ của người chơi lưu trong profiles.tz.
--   * Tiền trong game là xu, kiểu integer. Không có tiền thật nên không cần cột tiền tệ.
--   * Cân nặng lưu bằng gam (integer) để tránh lỗi số thực.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- helpers
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------- reference data (seeded)
create table species (
  id            text primary key,                 -- 'ro_phi_den', 'chep', ...
  name_vi       text not null,
  min_weight_g  integer not null check (min_weight_g > 0),
  max_weight_g  integer not null,
  content_rev   integer not null default 1,       -- phiên bản dữ liệu JSON đã seed
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint species_weight_range check (max_weight_g > min_weight_g)
);

create table locations (
  id            text primary key,                 -- 'ho_dich_vu_1', 'song_que', 'ho_nui'
  name_vi       text not null,
  kind          text not null check (kind in ('fee_pond','river','mountain_lake')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table location_species (
  location_id   text not null references locations(id) on delete cascade,
  species_id    text not null references species(id) on delete cascade,
  primary key (location_id, species_id)
);
create index on location_species (species_id);

create trigger species_updated   before update on species   for each row execute function set_updated_at();
create trigger locations_updated before update on locations for each row execute function set_updated_at();

-- ---------------------------------------------------------------- player
create table profiles (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  display_name  text check (display_name is null or char_length(display_name) between 2 and 24),
  tz            text not null default 'Asia/Ho_Chi_Minh',   -- IANA, dùng cho đồng hồ giờ thật
  settings      jsonb not null default '{}',                -- chất lượng đồ hoạ, âm thanh, chế độ văn phòng...
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();

-- Ảnh chụp trạng thái tiến độ: tiền, xp, túi đồ, rig, chậu mồi, nhiệm vụ.
-- Client là nguồn sự thật cho phần này (bản đầu không có bảng xếp hạng). Dùng version để tránh ghi đè giữa 2 máy.
create table player_state (
  user_id       uuid primary key references auth.users(id) on delete cascade,
  version       integer not null default 0 check (version >= 0),
  coins         integer not null default 500 check (coins >= 0),
  xp            integer not null default 0 check (xp >= 0),
  state         jsonb not null default '{}',               -- inventory, rig, bait, quests (schema = zod ở client)
  state_schema  integer not null default 1,                -- phiên bản schema của jsonb để migrate
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create trigger player_state_updated before update on player_state for each row execute function set_updated_at();

-- Một ca câu. Hồ dịch vụ: vé + thời lượng theo giờ thật. Sông, hồ núi: miễn phí, không giới hạn giờ.
create table fishing_sessions (
  id              uuid primary key,                         -- client sinh
  user_id         uuid not null references auth.users(id) on delete cascade,
  location_id     text not null references locations(id) on delete restrict,
  kind            text not null check (kind in ('paid_shift','free')),
  ticket_coins    integer not null default 0 check (ticket_coins >= 0),
  started_at      timestamptz not null,
  planned_end_at  timestamptz,                              -- null với ca miễn phí
  ended_at        timestamptz,
  outcome         text check (outcome in ('sold','released','mixed','abandoned')),
  earned_coins    integer not null default 0 check (earned_coins >= 0),
  weather         jsonb not null default '{}',              -- {kind, temp_c, wind_ms, water_temp_c} lúc bắt đầu
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint paid_has_end check (kind = 'free' or planned_end_at is not null),
  constraint end_after_start check (ended_at is null or ended_at >= started_at),
  constraint planned_after_start check (planned_end_at is null or planned_end_at > started_at)
);
create index on fishing_sessions (user_id, started_at desc);
create index on fishing_sessions (location_id);
-- mỗi người chỉ có tối đa 1 ca đang mở
create unique index one_open_session_per_user on fishing_sessions (user_id) where ended_at is null;
create trigger fishing_sessions_updated before update on fishing_sessions for each row execute function set_updated_at();

-- Mỗi con cá đã lên bờ. Đây là nguồn dữ liệu cho nhật ký và kỷ lục trong sổ tay.
create table catches (
  id            uuid primary key,                           -- client sinh
  user_id       uuid not null references auth.users(id) on delete cascade,
  session_id    uuid not null references fishing_sessions(id) on delete cascade,
  species_id    text not null references species(id) on delete restrict,
  location_id   text not null references locations(id) on delete restrict,
  weight_g      integer not null check (weight_g > 0),
  caught_at     timestamptz not null,
  local_hour    smallint not null check (local_hour between 0 and 23),  -- giờ địa phương lúc câu, để thống kê "giờ ăn"
  weather_kind  text not null check (weather_kind in ('sunny','cloudy','rain','storm','fog')),
  water_temp_c  numeric(4,1),
  depth_cm      integer check (depth_cm between 0 and 2000),
  bait          jsonb not null default '{}',                -- {recipe_id, axes:{fishy,sweet,sour,loose}, style}
  rig           jsonb not null default '{}',                -- {float_id, hook_id, setup:'4-2'}
  fate          text not null default 'kept' check (fate in ('kept','released','sold')),
  created_at    timestamptz not null default now()
);
create index on catches (user_id, caught_at desc);
create index on catches (user_id, species_id, weight_g desc);   -- kỷ lục theo loài
create index on catches (session_id);
create index on catches (species_id);
create index on catches (location_id);

-- Sinh vật đã gặp (bướm, cò, trâu...). Danh mục sinh vật nằm trong JSON của client nên không có khoá ngoại.
create table wildlife_sightings (
  user_id         uuid not null references auth.users(id) on delete cascade,
  creature_id     text not null check (creature_id ~ '^[a-z0-9_]{2,40}$'),
  first_location  text not null references locations(id) on delete restrict,
  first_seen_at   timestamptz not null,
  last_seen_at    timestamptz not null,
  times_seen      integer not null default 1 check (times_seen > 0),
  primary key (user_id, creature_id)
);
create index on wildlife_sightings (first_location);

-- ---------------------------------------------------------------- handbook view
create view handbook_entries with (security_invoker = true) as
select
  c.user_id,
  c.species_id,
  count(*)                          as total_caught,
  max(c.weight_g)                   as record_weight_g,
  min(c.caught_at)                  as first_caught_at,
  max(c.caught_at)                  as last_caught_at,
  array_agg(distinct c.location_id) as locations,
  mode() within group (order by c.local_hour) as favourite_hour
from catches c
group by c.user_id, c.species_id;

-- ---------------------------------------------------------------- RLS
alter table species            enable row level security;
alter table locations          enable row level security;
alter table location_species   enable row level security;
alter table profiles           enable row level security;
alter table player_state       enable row level security;
alter table fishing_sessions   enable row level security;
alter table catches            enable row level security;
alter table wildlife_sightings enable row level security;

create policy "reference readable" on species          for select using (true);
create policy "reference readable" on locations        for select using (true);
create policy "reference readable" on location_species for select using (true);

create policy "own profile read"   on profiles for select using (user_id = auth.uid());
create policy "own profile write"  on profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own state read"     on player_state for select using (user_id = auth.uid());
-- player_state ghi qua save_player_state() để kiểm tra version

create policy "own sessions read"  on fishing_sessions   for select using (user_id = auth.uid());
create policy "own catches read"   on catches            for select using (user_id = auth.uid());
create policy "own sightings read" on wildlife_sightings for select using (user_id = auth.uid());
-- Không có policy insert/update/delete: client chỉ ghi được qua các hàm RPC bên dưới.

-- ---------------------------------------------------------------- new user bootstrap
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (user_id) values (new.id) on conflict do nothing;
  insert into player_state (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function handle_new_user();

-- ---------------------------------------------------------------- RPC: sessions
create or replace function start_session(
  p_id uuid, p_location_id text, p_kind text, p_ticket_coins integer,
  p_started_at timestamptz, p_planned_end_at timestamptz, p_weather jsonb
) returns fishing_sessions
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  row fishing_sessions;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if p_started_at > now() + interval '2 minutes' or p_started_at < now() - interval '1 day' then
    raise exception 'bad_start_time' using errcode = '22023';
  end if;
  if p_kind = 'paid_shift' and (p_planned_end_at - p_started_at) > interval '8 hours' then
    raise exception 'shift_too_long' using errcode = '22023';
  end if;

  -- ca cũ còn mở (đóng tab giữa chừng) thì tự đóng thành 'abandoned'
  update fishing_sessions
     set ended_at = greatest(started_at, least(coalesce(planned_end_at, p_started_at), p_started_at)),
         outcome = coalesce(outcome, 'abandoned')
   where user_id = uid and ended_at is null and id <> p_id;

  insert into fishing_sessions (id, user_id, location_id, kind, ticket_coins, started_at, planned_end_at, weather)
  values (p_id, uid, p_location_id, p_kind, p_ticket_coins, p_started_at, p_planned_end_at, coalesce(p_weather, '{}'))
  on conflict (id) do nothing;

  select * into row from fishing_sessions where id = p_id and user_id = uid;
  if row.id is null then raise exception 'session_id_taken' using errcode = '23505'; end if;
  return row;
end $$;

create or replace function end_session(
  p_id uuid, p_ended_at timestamptz, p_outcome text, p_earned_coins integer
) returns fishing_sessions
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  row fishing_sessions;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  update fishing_sessions
     set ended_at = coalesce(ended_at, greatest(started_at, least(p_ended_at, now() + interval '2 minutes'))),
         outcome = coalesce(outcome, p_outcome),
         earned_coins = case when ended_at is null then greatest(p_earned_coins, 0) else earned_coins end
   where id = p_id and user_id = uid
  returning * into row;
  if row.id is null then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  return row;
end $$;

-- ---------------------------------------------------------------- RPC: catches
-- Kiểm tra cơ bản: ca thuộc về người gọi; thời điểm câu nằm trong ca (cho trễ 10 phút);
-- cân nặng nằm trong giới hạn của loài; loài có ở địa điểm đó; không quá 6 con mỗi 60 giây.
create or replace function record_catch(p jsonb) returns catches
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  s   fishing_sessions;
  sp  species;
  row catches;
  v_caught_at timestamptz := (p->>'caught_at')::timestamptz;
  v_weight integer := (p->>'weight_g')::integer;
  recent integer;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;

  -- gửi lại lần hai: trả về bản đã có
  select * into row from catches where id = (p->>'id')::uuid and user_id = uid;
  if row.id is not null then return row; end if;

  select * into s from fishing_sessions where id = (p->>'session_id')::uuid and user_id = uid;
  if s.id is null then raise exception 'session_not_found' using errcode = 'P0002'; end if;
  if v_caught_at < s.started_at
     or v_caught_at > coalesce(s.ended_at, s.planned_end_at, now()) + interval '10 minutes'
     or v_caught_at > now() + interval '2 minutes' then
    raise exception 'catch_outside_session' using errcode = '22023';
  end if;

  select * into sp from species where id = p->>'species_id';
  if sp.id is null then raise exception 'unknown_species' using errcode = '22023'; end if;
  if v_weight < sp.min_weight_g or v_weight > sp.max_weight_g then
    raise exception 'weight_out_of_range' using errcode = '22023';
  end if;
  if not exists (select 1 from location_species where location_id = s.location_id and species_id = sp.id) then
    raise exception 'species_not_in_location' using errcode = '22023';
  end if;

  select count(*) into recent from catches
   where user_id = uid and caught_at > v_caught_at - interval '60 seconds' and caught_at <= v_caught_at;
  if recent >= 6 then raise exception 'too_many_catches' using errcode = '22023'; end if;

  insert into catches (id, user_id, session_id, species_id, location_id, weight_g, caught_at, local_hour,
                       weather_kind, water_temp_c, depth_cm, bait, rig, fate)
  values ((p->>'id')::uuid, uid, s.id, sp.id, s.location_id, v_weight, v_caught_at,
          (p->>'local_hour')::smallint, p->>'weather_kind', (p->>'water_temp_c')::numeric,
          (p->>'depth_cm')::integer, coalesce(p->'bait','{}'), coalesce(p->'rig','{}'),
          coalesce(p->>'fate','kept'))
  on conflict (id) do nothing
  returning * into row;

  if row.id is null then  -- đua với một lần gửi song song
    select * into row from catches where id = (p->>'id')::uuid and user_id = uid;
  end if;
  return row;
end $$;

create or replace function set_catch_fate(p_id uuid, p_fate text) returns void
language sql security definer set search_path = public as $$
  update catches set fate = p_fate
   where id = p_id and user_id = auth.uid() and p_fate in ('kept','released','sold');
$$;

-- ---------------------------------------------------------------- RPC: progress + sightings
-- Optimistic concurrency: chỉ ghi khi version trên server bằng version client đang giữ.
-- Trả về version mới, hoặc -1 nếu xung đột (client tải bản mới về rồi gộp).
create or replace function save_player_state(
  p_expected_version integer, p_coins integer, p_xp integer, p_state jsonb, p_state_schema integer
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  v integer;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  if pg_column_size(p_state) > 64 * 1024 then raise exception 'state_too_large' using errcode = '22023'; end if;
  update player_state
     set version = version + 1, coins = p_coins, xp = p_xp, state = p_state, state_schema = p_state_schema
   where user_id = uid and version = p_expected_version
  returning version into v;
  return coalesce(v, -1);
end $$;

create or replace function record_sighting(p_creature_id text, p_location_id text, p_seen_at timestamptz)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  insert into wildlife_sightings (user_id, creature_id, first_location, first_seen_at, last_seen_at)
  values (auth.uid(), p_creature_id, p_location_id, least(p_seen_at, now()), least(p_seen_at, now()))
  on conflict (user_id, creature_id) do update
     set last_seen_at = greatest(wildlife_sightings.last_seen_at, excluded.last_seen_at),
         times_seen   = wildlife_sightings.times_seen + 1;
end $$;

-- Chỉ người đã đăng nhập mới gọi được RPC (khách ẩn danh của Supabase cũng có vai trò authenticated).
revoke all on function start_session, end_session, record_catch, set_catch_fate,
                       save_player_state, record_sighting from public, anon;
grant execute on function start_session, end_session, record_catch, set_catch_fate,
                          save_player_state, record_sighting to authenticated;
