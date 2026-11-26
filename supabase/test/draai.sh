#!/bin/bash
# Test de databaseregels (Row Level Security) op een lokale PostgreSQL 16, zonder Supabase-account.
# Gebruik: bash supabase/test/draai.sh   (vraagt een lokale PostgreSQL; draait als gebruiker postgres)
set -euo pipefail
cd "$(dirname "$0")/../.."
D=$(mktemp -d /tmp/pgtest.XXXX); P=/usr/lib/postgresql/16/bin
chown postgres "$D" 2>/dev/null || true
su postgres -c "$P/initdb -D $D/data -A trust >/dev/null && $P/pg_ctl -D $D/data -o '-p 5499 -k $D' -l $D/log -w start >/dev/null"
trap 'su postgres -c "$P/pg_ctl -D $D/data stop -m fast >/dev/null"; rm -rf "$D"' EXIT
q() { psql -h "$D" -p 5499 -U postgres "$@"; }
q -q -c "create database t"
q -d t -q -f supabase/test/supabase-nabootsing.sql
q -d t -q -v ON_ERROR_STOP=1 -f supabase/migrations/0001_projecten.sql 2>/dev/null
q -d t -q -v ON_ERROR_STOP=1 -f supabase/migrations/0001_projecten.sql 2>/dev/null # tweede keer: moet ook lukken
q -d t -q -v ON_ERROR_STOP=1 -f supabase/migrations/0002_fotos.sql 2>/dev/null
q -d t -q -v ON_ERROR_STOP=1 -f supabase/migrations/0002_fotos.sql 2>/dev/null
uit=$(q -d t -A -t -q -f supabase/test/rls-scenario.sql 2>&1)
echo "$uit"
verwacht=("an bewaar nieuw|1" "an bewaar v1|2" "an conflict (oude versie 1)|" "bo ziet|0" "bo bewaar|" "bo ziet na delen|1" "bo bewaar (lezen)|" "bo bewaar (bewerken)|3" "bo verwijdert|0" "cas ziet|0" "an leest|Werf 1b|3" "an fotos|1" "bo fotos|2" "cas fotos|0" "cas wist fotos|0")
for v in "${verwacht[@]}"; do grep -qF -- "$v" <<<"$uit" || { echo "FOUT: verwacht '$v'"; exit 1; }; done
[ "$(grep -c 'geweigerd ok' <<<"$uit")" = 3 ] || { echo "FOUT: weigeringen"; exit 1; }
echo "RLS-scenario: alles zoals verwacht."
