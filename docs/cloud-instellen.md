# Cloud instellen (Supabase, EU)

Met de cloud blijven je projecten vanzelf gelijk op gsm en pc, en kan je een project delen met een klant, architect of ingenieur. De app gebruikt **Supabase** (database + aanmelden per e-mail). Je maakt één keer een eigen Supabase-project aan; dat is gratis voor kleine aantallen.

> Je hebt het **projectadres** en de **publieke sleutel** nodig. De publieke sleutel mag in de app; de beveiliging zit in de databaseregels. Gebruik **nooit** de geheime sleutel (`service_role` of `sb_secret_…`): de app weigert die ook.

## 1. Project aanmaken (± 5 minuten)

1. Ga naar supabase.com en maak een account.
2. **New project**. Kies als regio **Central EU (Frankfurt)** of een andere EU-regio (privacy: GDPR). Bewaar het databasewachtwoord in je wachtwoordbeheerder; de app heeft het niet nodig.
3. Wacht tot het project klaar is.

## 2. Database klaarzetten

1. Open in Supabase **SQL Editor** → **New query**.
2. Kopieer de volledige inhoud van `supabase/migrations/0001_projecten.sql` uit deze repository, plak en klik **Run**. (Twee keer uitvoeren kan geen kwaad.)

Wat dit doet: een tabel `projecten` en `project_leden`, met Row Level Security: iedereen ziet alleen zijn eigen projecten en wat met zijn e-mailadres gedeeld is; "alleen bekijken" kan niet bewaren; alleen de eigenaar kan delen of verwijderen; bewaren op een oude versie wordt geweigerd (conflict).

## 3. Aanmelden per e-mail

1. **Authentication** → **Sign In / Providers** → **Email**: aan (standaard).
2. **Authentication** → **URL Configuration**:
   - **Site URL**: `https://wimbastenie-png.github.io/architect1.0/`
   - **Redirect URLs**: voeg dezelfde toe, en `http://localhost:5173/` om lokaal te testen.
3. Standaard verstuurt Supabase maar enkele mails per uur. Voor echt gebruik: **Authentication** → **SMTP** met je eigen mailserver.

## 4. Adres en sleutel in de app

Haal in Supabase bij **Project Settings** → **API** (of **API Keys**):
- het **Project URL**, bv. `https://abcd1234.supabase.co`
- de **publishable key** (`sb_publishable_…`) of de **anon key** (begint met `eyJ`).

Dan één van de twee:

- **Voor iedereen (aanbevolen):** in GitHub bij de repository → **Settings** → **Secrets and variables** → **Actions** → tab **Variables** → **New repository variable**:
  - `SUPABASE_URL` = het projectadres
  - `SUPABASE_ANON_KEY` = de publieke sleutel

  Bij de volgende publicatie (merge naar main) zit de instelling in de online app.
- **Alleen op één toestel (om te proberen):** in de app op **Cloud** tikken en adres + publieke sleutel ingeven.

## 5. Gebruiken

1. Op de gsm: **Cloud** → e-mailadres → **Stuur aanmeldlink** → link in de mail openen **op de gsm**.
2. Open je project → **Cloud** → **Bewaren in de cloud**.
3. Op de pc: zelfde aanmelding (link openen op de pc) → **Cloud** → project **Openen**.
4. Voortaan: wat je op het ene toestel wijzigt, staat op het andere zodra je de app daar opent (of binnen 30 s). Werkten beide toestellen tegelijk aan hetzelfde project zonder verbinding, dan vraagt de app welke versie je houdt.
5. Delen: **Cloud** → e-mailadres + "alleen bekijken" of "bewerken". De ander meldt zich aan met dat adres.

## Proberen zonder account

Open de app met `?cloud-demo` achter het adres. Alles blijft dan in die browser.

## Privacy en juridisch (nog te doen)

- Een opmeting van een woning (adres, plannen, notities) is een persoonsgegeven onder de GDPR. Sluit de verwerkersovereenkomst (DPA) af bij Supabase en vermeld de verwerking in je privacyverklaring.
- Spreek met klanten af wie toegang krijgt, en verwijder projecten die je niet meer nodig hebt.

## Testen van de databaseregels (voor ontwikkelaars)

`bash supabase/test/draai.sh` start een tijdelijke PostgreSQL 16, voert de migratie uit (twee keer) en speelt een scenario met drie gebruikers af (eigen projecten, delen om te lezen of te bewerken, conflicten, weigeringen).
