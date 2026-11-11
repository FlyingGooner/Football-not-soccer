# Spec: Football, not soccer

## Idé
De flesta fotbollsappar är fulla av nyheter, reklam, notiser och konton. Den här appen svarar bara på tre frågor, snabbt och på mobilen: *Hur ser tabellen ut? Vilka matcher spelas härnäst? Hur gick det för mitt lag?* Appen omfattar **Premier League, LaLiga och Serie A (herr)** samt **Champions League**. Man ser en liga som helhet och kan välja ett lag i dess tabell för att följa just det laget (t.ex. Real Madrid). Inget lag är hårdkodat. Användaren matar aldrig in matcher – all matchdata hämtas från datakällan.

## Mål
- Tabell, kommande matcher och senaste resultat syns direkt vid start, utan att skrolla.
- Byta liga med ett tryck (Premier League, LaLiga, Serie A).
- Byta till ett lag med två tryck och se lagets matcher i alla turneringar.
- Live-ställning under pågående matcher utan att ladda om.
- Fungera offline med senast hämtad data, installerbar från Chrome (Android) och Safari (iOS, "Lägg till på hemskärmen").

## Icke-mål
- Andra ligor än de tre, inmatning av matcher, nyheter, trupp, detaljerad statistik.
- Följa flera lag samtidigt.
- Konto, backend, pushnotiser, automatisk hämtning i bakgrunden.

## Begrepp
- **Liga**: en av `CONFIG.leagues` – Premier League (`eng.1`), LaLiga (`esp.1`), Serie A (`ita.1`). Vald liga sparas; första start är Premier League.
- **Ligavy**: flikarna Matcher och Tabell visar vald liga som helhet.
- **Lagvy**: fliken Lag visar valt lag: tabellrad i lagets egen liga, matcher och form. Lagets liga sparas med laget, så att Real Madrid alltid visar LaLiga-tabellen. Valt lag sparas.
- **Match**: en match i någon av de konfigurerade turneringarna, med tillstånd `pre` (kommande), `in` (pågår) eller `post` (spelad).
- **Turneringar** i lagläge: lagets liga, Champions League, Europa League och Conference League (`CONFIG.teamCompetitions`). Matcher hämtas från alla och slås ihop; turneringar där laget saknar matcher syns inte.
- **Zoner** i tabellen, per liga (`CONFIG.leagues[].zones`): Champions League (1–4), Europa (5–6) och nedflyttning (18–20). Antal lag läses från tabellen.
- **Form**: V/O/F i lagets 5 senaste ligamatcher.
- **Flik**: en av fyra vyer i menyn nertill. Vald flik sparas (`fns.tab.v1`) och appen öppnas på den; första start är Matcher (Lag om ett lag redan är valt).

## Skärmar
Samma struktur som simple-nutrition (beslut 2026-11-11): statusrad ("Senast uppdaterad …", fel och offline), rubrikrad med appens namn och versionsetikett, innehållet i en kolumn (max 520 px) och menyn nertill: **⚽ Matcher · 📋 Tabell · ⭐ Lag · ⚙️ Inst.** Bara mobillayout (se `../STIL.md`); på bredare skärm centreras kolumnen. Ingen uppdatera-knapp.

### 1. Matcher
```
┌──────────────────────────────┐
│ Football, not soccer  v0.13.0│
│ PL  LaLiga  Serie A  CL      │
│ ━━                           │
│ ┌──────────────────────────┐ │
│ │Aktuella Kommande Spelade │ │
│ │━━━━━━━━                  │ │
│ │ PÅGÅR NU                 │ │
│ │ Arsenal   2–1   Chelsea  │ │
│ │       LIVE 45'+3         │ │
│ │ IDAG                     │ │
│ │ Spurs    17:30  Liverpool│ │
│ │ [ Visa fler ]            │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│ ⚽Matcher 📋Tabell ⭐Lag ⚙️Inst.│
└──────────────────────────────┘
```
- **Ligaväljare** överst: små centrerade lådor (segmenterad knapp, beslut 2026-11-11), vald med `--primary-container`; många ligor → raden scrollar i sidled, samma på Matcher och Tabell. Byte visar sparad data direkt och hämtar bara det som behövs (se Datakälla och uppdatering).
- **Kortet Matcher** ersätter korten Aktuella matcher och Senaste resultat (beslut 2026-11-11). Ingen rubrik. Flikar överst i kortet, samma små centrerade lådor som ligaväljaren:
  - **Aktuella**: pågående matcher ("Pågår nu") och resten av dagens matcher ("Idag"). Matcher öppnas alltid på **Kommande** (beslut 2026-11-11).
  - **Kommande**: matcher efter i dag, per dag ("I morgon", datum), äldst först.
  - **Spelade**: resultat per dag, nyaste först.
  - Vald flik och utfällda matcher (även Visa fler) återställs när man byter vy (ingen ny lagring).
  - **Svep** åt vänster/höger på listan byter till nästa/föregående flik (Aktuella → Kommande → Spelade). Bara tydligt vågräta svep (minst 50 px, mer vågrätt än lodrätt), så att lodrät scroll inte påverkas.
- **Längd:** listan fyller skärmen ner till menyn (så många rader som får plats, minst 5) och slutar med **Visa fler**. Visa fler visar fler rader ur cachen; när cachen är slut hämtas en vecka till åt det hållet (Kommande framåt, Spelade bakåt). Aktuella har ingen Visa fler. Utfällt läge gäller bara under sessionen.
- **Tomt läge:** "Inga matcher i dag", "Inga kommande matcher", "Inga spelade matcher".
- **Matchrad, ihopfälld:** hemmalag (märke, namn), mitten, bortalag. Namn kortas med ellips, mitten står alltid centrerad. Radhöjd som i Tabell.
  - Kommande: avsparkstid.
  - Pågående: ställning, LIVE och tid med tilläggstid, t.ex. `45'+3` (första halvleken, tre tilläggsminuter) eller `67'`; `HT` i paus. Halvleken framgår av tiden, ingen egen etikett.
  - Spelad: ställning och `Slut`.
- **Matchrad, utfälld** (pågående och spelade, tryck på raden): se Matchdetaljer.
- Raden "Idag i alla ligor" är borttagen (beslut 2026-11-11).

### 2. Tabell
- Hela tabellen för vald liga (placering, lag, M, V, O, F, MS, P) med zonfärger och förklaring. På smal skärm döljs V/O/F. Raderna är tryckbara för att följa laget.

### 3. Lag
- **Hela vyn får plats utan scroll** på en vanlig telefon (beslut 2026-11-11): kompakta kort, matchrader på en rad.
- Valt lag: rad med märke, namn, **formen** (5 senaste ligamatcher, V/O/F) och **✕** (slutar följa, utan bekräftelse). Neutral bakgrund (`--surface-container-high`), lagets färg bara som kant till vänster. Ingen placering, ingen tabell (finns under Tabell).
- **Nästa match**: kompakt: märken, namn, tid, datum, turnering, hemma/borta, nedräkning. Pågår matchen visas ställning och LIVE-tid, rubriken blir **Pågår nu** och ställningen uppdateras var 30:e sekund. Under: 2 kommande på en rad var (datum och tid, motståndare (H/B), turnering kort). **Visa fler** fäller ut alla kommande som finns (lagets hela schema i de turneringar som hämtas).
- **Senaste match**: kompakt: resultat, V/O/F, turnering, datum och händelser. Under: 3 matcher innan, en rad var; **Visa fler** fäller ut resten. Utfällt läge gäller bara under sessionen.
- **Senast följda lag** längst ned.
- Inget lag valt: "Inget lag valt" och en knapp till Tabell.

### 4. Inställningar
- Grupper som fälls ut, som i simple-nutrition: **Lag** (Senast följda lag, ta bort), **Utseende** (Kortordning) och **Allmänt** (Data, Hjälp och manual, Installera appen). Sist en rad med version och "matchdata från ESPN".

### Välja och byta lag
- Tryck på ett lag i tabellen → dialog "Följ {lag}?" (inget lag valt) eller "Byt till {lag}?" (ett lag valt); efter Följ/Byt visas fliken Lag med **Följ/Byt** och **Avbryt**.
- Valt lags rad markeras med lagets egen färg från datakällan (vänsterkant och svag bakgrundston). Saknas färg används primärfärgen.

### Matchdetaljer
- Pågående och spelade matcher är tryckbara och fäller ut händelserna i tidsordning per lag (hemma vänster, borta höger): minut, ⚽ och målskytt, "(str.)" för straff, "(sj.)" för självmål, 🟨 gult kort och 🟥 rött kort (andra gula: 🟨🟥) med spelare. Saknas data: "Ingen matchinfo tillgänglig."
- I lagläge visas samma händelser direkt under ställningen i Nästa/Senaste match.
- Datan kommer från scoreboardens `details` (mål, gula och röda kort), inga extra anrop. Utfällt läge gäller bara under sessionen.

### Ligor och turneringar (beslut 2026-11-11)
- Alla i `LEAGUES` (`store.js`), med data kontrollerad hos ESPN 2026-11-11:
  - **Ligor:** Premier League `eng.1`, LaLiga `esp.1`, Serie A `ita.1`, Bundesliga `ger.1`, Ligue 1 `fra.1`, Eredivisie `ned.1`, Primeira Liga `por.1`, Allsvenskan `swe.1`.
  - **Europacuper:** Champions League `uefa.champions`, Europa League `uefa.europa`, Conference League `uefa.europa.conf` – ligafasens tabell med zonerna Åttondelsfinal (1–8) och Playoff (9–24). Inget slutspelsträd.
  - **Landslag:** VM `fifa.world`, EM `uefa.euro`, Copa América `conmebol.america`, Afrikanska mästerskapen `caf.nations`, Gold Cup `concacaf.gold` (Asiatiska mästerskapen saknar data). Tabellen visas per grupp (gruppens namn som rubrik), utan zoner. Mellan turneringarna visas senaste turneringens data eller tomt läge.
- **Ligaväljaren** visar de ligor användaren valt, i vald ordning (standard: PL, LaLiga, Serie A, CL; övriga dolda). Fler än fyra → raden kan scrollas i sidled. Väljs under Inställningar → Utseende → **Ligor**: samma lista som Kortordning (↑ ↓ flyttar, ●/○ visar/döljer, Återställ). Minst en måste visas. Döljs den valda ligan byts till första synliga. Gäller både Matcher och Tabell. Sparas i `fns.layout.v1` under `leagues` (exporteras som övrig kortordning).
- **Svep på Tabell** åt vänster/höger byter till nästa/föregående liga i ligaväljaren (samma regel som svep på Matcher).
- Lag i en europacups tabell kan följas; laget får då sin inhemska liga om den är en av ligorna ovan, annars visas bara cupens data. **Landslag** kan följas från turneringens tabell; laget får turneringen som liga och bara den turneringens matcher hämtas (inga europacuper).
- Reserven "varje lags schema" används bara för ligor, aldrig för cuper och landslagsturneringar (för många anrop).

### Senast följda lag
- Längst ned under Lag: rad med upp till 5 senast följda lag (märke + kort namn), samma lag som har sparad data (`CONFIG.teamCacheMax`). Ett tryck byter lag direkt utan dialog. Under Inställningar → Lag tar ✕ bort laget ur listan och dess cache.
- Är inte "flera lag samtidigt": bara ett lag är valt åt gången.

### Kortordning
- Som simple-nutrition: Inställningar → Utseende → Kortordning har en lista per vy (Matcher: bara kortet Matcher, så listan visas inte för vyn; Lag: Nästa match, Senaste match, Senast följda lag). ↑ ↓ flyttar, ●/○ visar/döljer, "Återställ" ger standard. Okända kort-id ignoreras, nya kort läggs sist.

### Kortet Hjälp
- Under Inställningar → Allmänt → Hjälp och manual. Samma text som `docs/MANUAL.md` (ändra båda): lägen, välja och byta lag, ligaväljaren, offline och vad ESPN ser.

### Kortet Data
- Enligt `../STANDARD.md` punkt 5 (undantag U5), mönstret från budget-buddy (`packData`/`unpackData`/`exportText`/`importText` i `store.js`, `backup.js`).
- Exporteras: valt lag, vald liga, senast följda lag (utan matchdata) och kortordning. Vald flik exporteras inte. Matchcachen exporteras aldrig – den hämtas om.
- Import validerar varje fält som vid läsning från `localStorage`; okänt `leagueId` eller lag-id som inte är `^\d{1,10}$` förkastas.
- **Radera all data** sist i kortet: tar bort alla `fns.*`-nycklar.

## Datamodell (endast localStorage)
| Nyckel | Innehåll |
|---|---|
| `fns.cache.v4` | Senast hämtad data (se nedan) |
| `fns.recent.v1` | Senast följda lag, upp till 5: `[{ id, name, logo, color, leagueId }]`, nyast först |
| `fns.team.v2` | Valt lag `{ id, name, logo, color, leagueId }` eller saknas (= ligaläge). `.v1` (utan `leagueId`) läses en gång som `eng.1` |
| `fns.league.v1` | Vald liga i ligaläge, ett id ur `CONFIG.leagues` |
| `fns.tab.v1` | Vald flik: `matches`, `table`, `team` eller `settings` |
| `fns.layout.v1` | Kortordning per vy: `{ matches, team: { order: [kort-id], hidden: [kort-id] } }`, bara vyer som skiljer sig från standard |

```json
{
  "table": [{ "id": "359", "name": "Arsenal", "logo": "https://…", "color": "#ef0107",
              "rank": 1, "played": 11, "w": 8, "d": 2, "l": 1, "gd": 15, "pts": 26 }],
  "league": [{ "id": "…", "league": "Premier League", "leagueId": "eng.1", "date": "2026-11-07T15:00Z",
               "state": "post", "detail": "FT", "clock": "90'",
               "home": { "id": "359", "name": "Arsenal", "logo": "…", "color": "#ef0107" },
               "away": { "…": "…" }, "homeScore": 2, "awayScore": 1,
               "events": [{ "kind": "goal", "min": "12'", "name": "B. Saka", "teamId": "359", "pen": false, "og": false },
                          { "kind": "yellow", "min": "40'", "name": "M. Caicedo", "teamId": "363" }] }],
  "leagueFull": false,
  "range": { "from": "2026-11-04", "to": "2026-11-18" },
  "colors": { "359": "#ef0107" },
  "teams": { "359": { "matches": ["…"], "color": "#ef0107", "ts": 1762500000000 } },
  "updatedAt": { "table": 1762500000000, "league": 1762500000000, "359": 1762500000000 }
}
```
- Cachen (`fns.cache.v4`) har `table`, `league`, `leagueFull`, `range` (hämtat datumintervall) och `updatedAt` per liga-id: `{ "leagues": { "esp.1": { … } }, "colors": …, "teams": … }`. `kind` är `goal`, `yellow` eller `red`. Gammal `.v3` ignoreras (en första hämtning per liga).
- All cachad data valideras fält för fält vid läsning (`store.js`), eftersom den kan vara gammal eller manipulerad.
- Sparad data för de 5 senast valda lagen behålls (`CONFIG.teamCacheMax`).
- Ny struktur → ny nyckelversion (`.v4`); gammal data ignoreras.

## Datakälla och uppdatering
- **ESPN:s öppna JSON-API** (`site.api.espn.com`), inofficiellt, gratis, ingen nyckel.
  - Samma host för alla ligor och turneringar; bara `{liga}` i sökvägen skiljer (id enligt Ligor och turneringar).
  - Tabell: `/apis/v2/sports/soccer/{liga}/standings`
  - Ligans matcher: `/apis/site/v2/sports/soccer/{liga}/scoreboard?dates=YYYYMMDD-YYYYMMDD` i intervall om en vecka: först 1 vecka bakåt och 1 framåt plus dagens scoreboard; Visa fler hämtar en vecka till åt gången (högst 5 bakåt, 5 framåt).
  - Lagets matcher: `/apis/site/v2/sports/soccer/{turnering}/teams/{lag-id}/schedule` (+ `?fixture=true` för kommande), per turnering.
  - Live: scoreboard för pågående matchers turnering.
  - Reserv: ger scoreboard för få matcher byggs ligans matcher av varje lags schema. Live faller på samma sätt tillbaka till hemmalagets schema.
- All åtkomst via adapterfunktioner (`fetchTable()`, `fetchTeamMatches()`, `fetchLeagueMatches()`, `fetchLive()`) i `app.js`, så att källan kan bytas.
- **När data hämtas:** bara det den öppna fliken visar – när appen öppnas, när den visas igen, när fliken byts, när nätet kommer tillbaka och vid byte av liga eller lag – och bara om cachen inte längre gäller (nedan). Inställningar hämtar inget. Inga anrop i bakgrunden.
- **Cache per liga till nästa avspark (beslut 2026-11-11):** ligans data hämtas inte igen så länge ingen match i ligan har börjat eller pågår sedan förra hämtningen (en `pre`-match med avsparkstid ≤ nu, eller en `in`-match). Då hämtas bara dagens scoreboard, inte hela intervallet.
  - Spelade matcher (`post`) hämtas aldrig igen.
  - Tabellen hämtas bara när en match i ligan har gått till `post` efter förra tabellhämtningen.
  - Säkerhetsgräns: data äldre än 6 timmar hämtas ändå (flyttade matcher, nya tider).
  - Lag: samma regel för lagets schema (nästa match i lagets cache).
- **Live:** under pågående match, med appen synlig, uppdateras ställningen var 30:e sekund. Matcher: alla pågående ligamatcher; Lag: lagets match.
- Cachad data visas direkt vid start och ersätts sedan av färsk data. Har ligadatan byggts av alla lags scheman och är nyare än 10 minuter visas ett nyvalt lags ligamatcher direkt därifrån och hämtas inte igen.

### Integritet och säkerhet
- Anropen görs direkt från mobilen till ESPN; ESPN ser IP-adress, webbläsare och vad som hämtas. `no-referrer` gör att ESPN inte får veta sidans adress.
- Ingen inloggning, inga cookies, ingen spårning, inga analysverktyg.
- Data från API:t renderas alltid som text (`textContent`), aldrig som HTML. Bilder används bara om adressen börjar med `https://`.
- Content-Security-Policy i `index.html`: skript och stil bara från egen origin, anrop bara till `site.api.espn.com`, bilder bara över https.
- Arbetsytans agent `granskning` bestämmer över säkerheten (undantag U5, U6 – godkänt 2026-11-11, villkor i dess tabell). CSP: `connect-src https://site.api.espn.com; img-src 'self' https://a.espncdn.com` (inga `https:`/`data:`); beslutet "Avböjt – smalare `img-src`" nedan är upphävt.
- Exponering vid hämtning (kontrollerat 2026-11-11): ESPN ser IP, `User-Agent`, `Accept-Language`, `Origin` och vilka ligor/lag som hämtas. Ingen referer, inga cookies (API: `credentials:'omit'`; klubbmärken: `img.crossOrigin='anonymous'`, ESPN svarar `Access-Control-Allow-Origin: *`), ingen användardata. Ligor hämtas först när de öppnas. Fler ligor ändrar varken host eller CSP (`connect-src https://site.api.espn.com`), bara sökvägar. Liga-id i URL:er kommer alltid från `CONFIG`, aldrig från lagrad data eller API-svar; lagrat `leagueId` valideras mot `CONFIG.leagues`.
- Cache `.v4` (2026-11-11): nya fält `range` och händelsetypen `yellow` (spelarnamn och minut från API:t) valideras i `store.js` som övriga fält och renderas som text. Ingen ny host, ingen ändrad CSP, inget nytt undantag. Färre anrop än tidigare.
- Fler ligor och turneringar (2026-11-11): bara nya sökvägar på samma host, id ur `LEAGUES`. Ingen ny host, ingen ändrad CSP, inget nytt undantag, ingen ny nyckel. Ny lagrad del `layout.leagues` (id valideras mot `LEAGUES`), nytt cachefält `group` i tabellrader (text, max 60 tecken, renderas som text).
- `<head>` (2026-11-11): `viewport-fit=cover` och ändrade `theme-color`-värden (se PWA-krav). Ingen ändring av CSP eller anrop.
- Ombyggnad enligt `template/` (2026-11-11): appen är undantaget från regeln om inga nätverksanrop. Innan bygget kontrolleras att undantaget för ESPN finns kvar i `granskning`-tabellen och `tools/check.ps1`; saknas det → förhandsprövning.

#### Härdning (beslut 2026-11-07)
- **Infört – Trusted Types:** CSP har `require-trusted-types-for 'script'`. Appen använder inte `innerHTML`, så ingen policy behövs. Safari ignorerar direktivet.
- **Infört – presentationen utan `'unsafe-inline'`:** CSS och JS ligger i `docs/presentation.css` och `docs/presentation.js`, inga `style`-attribut. CSP `script-src 'self'; style-src 'self'`.
- **Avböjt – smalare `img-src`:** kräver verifiering mot ESPN och körtest; `logo()` kräver redan `https://`.
- **Infört vid ombygget (2026-11-11) – central tolkning av API-svar:** `store.js` tolkar ESPN-svaren och kör samma validering som för cachen (`cleanMatch`, `cleanRow`): id `^\d+$`, färg strikt `#rrggbb`, klubbmärken bara `https://a.espncdn.com/…`, text utan styr- och riktningstecken, max 60 tecken. Ersätter det tidigare avböjda beslutet.
- URL:er byggs bara av `espnUrl()` i `store.js` (turnering ur `LEAGUES`/`EUROPE`, lag-id `^\d{1,10}$`, datum `^\d{8}-\d{8}$`; annars kastas fel). `fetch` alltid med `credentials:'omit'`, `cache:'no-store'`, `referrerPolicy:'no-referrer'`.
- Ny lagring: `fns.team.v2`, `fns.league.v1`, `fns.recent.v1`, `fns.cache.v4` (se Datamodell); **Radera all data** tar bort alla `fns.*` och inget annat. Backup-fil enligt U5 (krypterad), bara inställningar.
- Tester (`tools/tests/`): flödestesterna kör mot en fejkad `fetch` (`ui-before.js`, laddas av `tools/test.ps1` före appen) och använder aldrig nätet. De kontrollerar CSP:ns nätverksdirektiv, att alla anrop går till `site.api.espn.com` med rätt fetch-inställningar, att märken från andra värdar inte laddas och att data från källan renderas som text. Exakt CSP i `index.html` kontrolleras av `tools/check.ps1`.

## PWA-krav
- `manifest.webmanifest`: `name`, `short_name`, `id`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `theme_color`, `background_color`, ikoner 192 & 512 (any + maskable). `icons/icon-180.png` som `apple-touch-icon` för iOS.
- **Systemfälten följer temat (beslut 2026-11-11):** installerad via Chrome på Android är systemets navigeringsfält under menyn i dag ljust (`#fff7fd` från manifestet) även i mörkt tema. Krav: fältet har samma färg som menyn nertill i båda temana.
  - `<meta name="viewport" … viewport-fit=cover>` så att sidan ritas under systemfälten; menyn nertill får `padding-bottom: env(safe-area-inset-bottom)` och dess bakgrund fyller ut till skärmkanten. Statusraden överst får på samma sätt `env(safe-area-inset-top)`.
  - `theme-color` (ljus/mörk, redan i `index.html`) ska vara menyns färg, inte sidans bakgrund, så att fälten smälter ihop med menyn.
  - Manifestet kan inte välja färg efter tema: `background_color`/`theme_color` sätts till det mörka temats färger (splash och reserv, se Design), eftersom ett ljust fält i mörkt läge syns mest. Ljust tema täcks av meta-taggen och `viewport-fit`.
  - Kontrolleras med skärmbild i båda temana i installerad app; ingen säkerhetsändring (bara `<head>`-meta utan CSP-ändring – noteras ändå i infor-push eftersom `<head>` ändras).
  - Gäller alla appar; förs över till `template/` vid nästa större release.
- `sw.js`: precache av appens egna filer, cache-first, cachenamn `fns-<version>`. Rensar bara sina egna gamla cacher (apparna delar origin på GitHub Pages). API-anrop och klubbmärken går förbi service workern; matchdata cachas i `localStorage`.
- Serveras över HTTPS via GitHub Pages: https://flyinggooner.github.io/Football-not-soccer/
- Versionsnummer i `version.js` visas uppe till höger och styr cachenamnet.
- Egen "Installera"-knapp längst ned (under innehållet) via `beforeinstallprompt`; dold när händelsen saknas eller appen redan är installerad. Påverkar inte layouten när den är dold.
- Ny service worker → snackbar "Ny version finns – Ladda om".
- Testfil för `file://`: `dist/football-not-soccer.html`, byggs med `tools/build-single.ps1` (ingen installation eller offline i den).

## Design
- Material Design 3 enligt `../STIL.md`, samma stil som simple-nutrition. **Nyckelfärg gräsgrön `#4c8c2b`** (beslut 2026-11-11, ersätter plommonlila `#4b1d6e`). Gulare än simple-nutritions blågröna `#2f7d5b`, så att apparna skiljs åt på hemskärmen. Inte ligornas färger, logotyper eller typsnitt (klubbmärken från datakällan är ok).
- **Ljust och mörkt tema** följer telefonens inställning (`prefers-color-scheme`), inget eget val i appen. `color-scheme: light dark` så att tvingat mörkt läge inte färgar om sidan. Färger bara som variabler i `styles.css` (samma namn som simple-nutrition):

| Variabel | Ljust | Mörkt |
|---|---|---|
| `--primary` / `--on-primary` | `#3a6a1e` / `#ffffff` | `#a0d57d` / `#173800` |
| `--primary-container` / `--on-primary-container` | `#bbf296` / `#0a2100` | `#235104` / `#bbf296` |
| `--surface` (bakgrund) | `#f8fbf1` | `#11140e` |
| `--surface-container` (kort, menyn nertill) | `#ecefe5` | `#1d2119` |
| `--surface-container-high` | `#e6e9df` | `#272b23` |
| `--on-surface` / `--on-surface-variant` | `#191d16` / `#43483e` | `#e1e4d9` / `#c3c8bb` |
| `--outline` | `#73796d` | `#8d9286` |

  - Vald flik, segmenterad knapp och menyns aktiva ikon: `--primary-container` med `--on-primary-container`. Versionsetiketten likadant.
  - `theme-color` = `--surface-container` (ljust `#ecefe5`, mörkt `#1d2119`); manifest `theme_color #1d2119`, `background_color #11140e` (se PWA-krav).
  - Ikonerna (`icons/`) görs om i den nya gröna färgen.
  - Kontrast minst 4.5:1 för text i båda temana (kontrolleras med skärmbild ljust och mörkt).
  - Vid bygget uppdateras nyckelfärgen också i `../CLAUDE.md` och projektets `CLAUDE.md`.
- Resultatfärger: vinst grön, oavgjort grå, förlust röd. Zoner: CL grön, Europa blå, nedflyttning röd. CL-zonens grön ska skilja sig tydligt från temats grön (blågrönare ton), så att zonen inte ser ut som ett valt element.
- Siffror med `tabular-nums`.
- **Layout:** bara mobil (som simple-nutrition), en kolumn max 520 px, test 390 px. Menyn nertill, tryckytor ≥ 48 px, animation ≤ 200 ms, avstängd vid `prefers-reduced-motion`.
- Fungerar i aktuell Safari (iOS) och Chrome (Android).

## Acceptanskriterier v1
- [ ] Layout fungerar på 390 px, ljust och mörkt, med menyn nertill och Inställningar i grupper.
- [ ] Första start visar ligaläge: topp 3 i tabellen, aktuella matcher och senaste resultat grupperade per dag.
- [ ] Tryck på ett lag i tabellen → bekräftelse → lagläge för det laget.
- [ ] I lagläge: lagets rad med form syns direkt, hela tabellen fälls ut, laget markerat med sin färg.
- [ ] Nästa match visas med korrekt lokal tid och nedräkning; utfällt visas 5 kommande.
- [ ] Senaste match visas med resultat och V/O/F; utfällt visas 5 tidigare.
- [ ] ✕ tar tillbaka till ligaläge; valt läge och lag finns kvar efter omstart.
- [ ] Pågående match visar LIVE och uppdateras utan omladdning, i båda lägena.
- [ ] Utan nät visas sparad data med tidsstämpel; vid API-fel ett tydligt felmeddelande, aldrig en blank skärm.
- [ ] Installerad app startar offline. Installera-knappen syns bara när webbläsaren erbjuder installation.
- [ ] Ljust och mörkt tema i M3-stil, utan Premier Leagues varumärken.

## Framtida idéer
- Matchdetaljer med laguppställning och statistik (kräver extra anrop till `summary` – nytt underlag för granskning).
- Slutspelsträd för Champions League.
- Reservdatakälla: football-data.org med gratisnyckel som användaren anger i appen (sparas bara i `localStorage`).
- Offlinecache för klubbmärken.
- Allt nytt måste fortfarande hålla sig till: inga anrop i bakgrunden, data renderas som text, snäv CSP.
