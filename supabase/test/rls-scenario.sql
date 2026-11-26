\set ON_ERROR_STOP on
grant select, insert, update, delete on public.projecten, public.project_leden to authenticated;
create or replace function pg_temp.als(sub text, mail text) returns void language sql as $$ select set_config('request.jwt.claim.sub', sub, false), set_config('request.jwt.claim.email', mail, false) $$;
set role authenticated;
-- An maakt een project
select pg_temp.als('11111111-1111-1111-1111-111111111111', 'an@voorbeeld.be');
select 'an bewaar nieuw' t, public.bewaar_project('p1', 'Werf 1', '{"a":1}', 0) v;
select 'an bewaar v1' t, public.bewaar_project('p1', 'Werf 1', '{"a":2}', 1) v;
select 'an conflict (oude versie 1)' t, public.bewaar_project('p1', 'Werf 1', '{"a":3}', 1) v;
-- Bo ziet niets
select pg_temp.als('22222222-2222-2222-2222-222222222222', 'bo@voorbeeld.be');
select 'bo ziet' t, count(*) from public.projecten;
select 'bo bewaar' t, public.bewaar_project('p1', 'X', '{}', 2) v;
select 'bo kan geen lid toevoegen' t; 
do $$ begin insert into public.project_leden values ('p1', 'bo@voorbeeld.be', 'bewerken'); raise exception 'MOCHT NIET'; exception when insufficient_privilege then raise notice 'geweigerd ok'; end $$;
-- An deelt met Bo (lezen)
select pg_temp.als('11111111-1111-1111-1111-111111111111', 'an@voorbeeld.be');
insert into public.project_leden values ('p1', 'Bo@Voorbeeld.be', 'lezen');
select pg_temp.als('22222222-2222-2222-2222-222222222222', 'bo@voorbeeld.be');
select 'bo ziet na delen' t, count(*) from public.projecten;
select 'bo bewaar (lezen)' t, public.bewaar_project('p1', 'X', '{}', 2) v;
select 'bo ziet leden' t, count(*) from public.project_leden;
-- rol bewerken
select pg_temp.als('11111111-1111-1111-1111-111111111111', 'an@voorbeeld.be');
update public.project_leden set rol = 'bewerken' where project_id = 'p1';
select pg_temp.als('22222222-2222-2222-2222-222222222222', 'bo@voorbeeld.be');
select 'bo bewaar (bewerken)' t, public.bewaar_project('p1', 'Werf 1b', '{"b":1}', 2) v;
with x as (delete from public.projecten where id = 'p1' returning 1) select 'bo verwijdert' t, count(*) from x;
-- Cas ziet niets
select pg_temp.als('33333333-3333-3333-3333-333333333333', 'cas@voorbeeld.be');
select 'cas ziet' t, count(*) from public.projecten;
select 'cas maakt project met andere eigenaar' t;
do $$ begin insert into public.projecten (id, eigenaar, naam, data) values ('p9', '11111111-1111-1111-1111-111111111111', 'x', '{}'); raise exception 'MOCHT NIET'; exception when insufficient_privilege then raise notice 'geweigerd ok'; end $$;
select pg_temp.als('11111111-1111-1111-1111-111111111111', 'an@voorbeeld.be');
select 'an leest' t, naam, versie, data, gewijzigd_door from public.projecten;
