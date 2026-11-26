-- architect1.0 — foto's in de cloud (Supabase Storage, bucket "fotos", niet publiek).
-- Voer dit uit in de SQL-editor van je Supabase-project, NA 0001_projecten.sql.
-- Elke foto staat in de map van haar project: fotos/<project-id>/<foto-id>.jpg.
-- Wie het project mag lezen, mag de foto's lezen; wie het mag bewerken, mag ze toevoegen of wissen.

insert into storage.buckets (id, name, public) values ('fotos', 'fotos', false) on conflict (id) do nothing;

create or replace function public.foto_project(naam text) returns text
  language sql immutable as $$ select split_part(naam, '/', 1) $$;

drop policy if exists "fotos lezen" on storage.objects;
create policy "fotos lezen" on storage.objects for select to authenticated
  using (bucket_id = 'fotos' and (public.ben_eigenaar(public.foto_project(name)) or public.gedeeld_met_mij(public.foto_project(name), false)));
drop policy if exists "fotos toevoegen" on storage.objects;
create policy "fotos toevoegen" on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (public.ben_eigenaar(public.foto_project(name)) or public.gedeeld_met_mij(public.foto_project(name), true)));
drop policy if exists "fotos vervangen" on storage.objects;
create policy "fotos vervangen" on storage.objects for update to authenticated
  using (bucket_id = 'fotos' and (public.ben_eigenaar(public.foto_project(name)) or public.gedeeld_met_mij(public.foto_project(name), true)))
  with check (bucket_id = 'fotos' and (public.ben_eigenaar(public.foto_project(name)) or public.gedeeld_met_mij(public.foto_project(name), true)));
drop policy if exists "fotos wissen" on storage.objects;
create policy "fotos wissen" on storage.objects for delete to authenticated
  using (bucket_id = 'fotos' and (public.ben_eigenaar(public.foto_project(name)) or public.gedeeld_met_mij(public.foto_project(name), true)));
