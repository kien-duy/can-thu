-- Stub tối thiểu của Supabase (role anon, authenticated; auth.users; auth.uid() đọc từ request.jwt.sub) để chạy test trên Postgres thường.
-- Trước khi chạy file này lần đầu trên một cluster: create role anon nologin; create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), is_anonymous boolean default true);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.sub', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;
