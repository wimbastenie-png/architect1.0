-- architect1.0 — cloudopslag van projecten (Supabase, Postgres).
-- Voer dit één keer uit in de SQL-editor van je Supabase-project (regio: EU, bv. Frankfurt).
-- Beveiliging: Row Level Security. Elke gebruiker ziet alleen zijn eigen projecten
-- en de projecten die met zijn e-mailadres gedeeld zijn.

create table if not exists public.projecten (
  id          text primary key,
  eigenaar    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  naam        text not null,
  data        jsonb not null,
  versie      integer not null default 1,
  gewijzigd   timestamptz not null default now(),
  gewijzigd_door text
);

create table if not exists public.project_leden (
  project_id  text not null references public.projecten(id) on delete cascade,
  email       text not null,
  rol         text not null check (rol in ('lezen', 'bewerken')),
  toegevoegd  timestamptz not null default now(),
  primary key (project_id, email)
);

alter table public.projecten enable row level security;
alter table public.project_leden enable row level security;

-- e-mailadres van de aangemelde gebruiker (kleine letters)
create or replace function public.mijn_email() returns text
  language sql stable as $$ select lower(coalesce(auth.jwt() ->> 'email', '')) $$;

-- gedeeld met mij? (security definer: leest project_leden zonder de RLS van die tabel)
create or replace function public.gedeeld_met_mij(p text, alleen_bewerken boolean) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_leden where project_id = p and lower(email) = mijn_email() and (not alleen_bewerken or rol = 'bewerken'))
$$;

create or replace function public.ben_eigenaar(p text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from projecten where id = p and eigenaar = auth.uid())
$$;

drop policy if exists "lezen" on public.projecten;
create policy "lezen" on public.projecten for select using (eigenaar = auth.uid() or public.gedeeld_met_mij(id, false));
drop policy if exists "aanmaken" on public.projecten;
create policy "aanmaken" on public.projecten for insert with check (eigenaar = auth.uid());
drop policy if exists "bewerken" on public.projecten;
create policy "bewerken" on public.projecten for update using (eigenaar = auth.uid() or public.gedeeld_met_mij(id, true)) with check (eigenaar = auth.uid() or public.gedeeld_met_mij(id, true));
drop policy if exists "verwijderen" on public.projecten;
create policy "verwijderen" on public.projecten for delete using (eigenaar = auth.uid());

drop policy if exists "leden lezen" on public.project_leden;
create policy "leden lezen" on public.project_leden for select using (public.ben_eigenaar(project_id) or public.gedeeld_met_mij(project_id, false));
drop policy if exists "leden beheren" on public.project_leden;
create policy "leden beheren" on public.project_leden for all
  using (public.ben_eigenaar(project_id))
  with check (public.ben_eigenaar(project_id));

-- Bewaren met versiecontrole: lukt alleen als niemand intussen een nieuwere versie bewaarde.
-- Geeft de nieuwe versie terug, of null bij een conflict.
create or replace function public.bewaar_project(p_id text, p_naam text, p_data jsonb, p_versie integer)
  returns integer language plpgsql security invoker as $$
declare nieuw integer;
begin
  if p_versie = 0 then
    insert into projecten (id, naam, data, versie, gewijzigd_door) values (p_id, p_naam, p_data, 1, mijn_email())
      on conflict (id) do nothing;
    if found then return 1; end if;
    return null;
  end if;
  update projecten set naam = p_naam, data = p_data, versie = versie + 1, gewijzigd = now(), gewijzigd_door = mijn_email()
    where id = p_id and versie = p_versie
    returning versie into nieuw;
  return nieuw;
end $$;

create index if not exists projecten_eigenaar on public.projecten (eigenaar);
create index if not exists project_leden_email on public.project_leden (lower(email));
