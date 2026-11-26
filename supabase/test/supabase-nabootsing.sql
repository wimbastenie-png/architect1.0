create schema auth;
create table auth.users (id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('email', current_setting('request.jwt.claim.email', true)) $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
grant usage on schema public, auth to authenticated;
insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'an@voorbeeld.be'), ('22222222-2222-2222-2222-222222222222', 'bo@voorbeeld.be'), ('33333333-3333-3333-3333-333333333333', 'cas@voorbeeld.be');
-- nabootsing van Supabase Storage (alleen wat de regels nodig hebben)
create schema storage;
create table storage.buckets (id text primary key, name text not null, public boolean default false);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text not null, owner uuid default auth.uid(), unique (bucket_id, name));
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
