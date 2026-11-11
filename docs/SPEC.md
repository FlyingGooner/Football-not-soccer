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
- **Ligaläge**: inget lag valt. Visar vald liga som helhet. Första start är alltid i ligaläge.
- **Lagläge**: ett lag valt. Visar lagets tabellrad i lagets egen liga, matcher och form. Lagets liga sparas med laget, så att Real Madrid alltid visar LaLiga-tabellen. Valt läge och lag sparas och appen öppnas i samma läge nästa gång.
- **Match**: en match i någon av de konfigurerade turneringarna, med tillstånd `pre` (kommande), `in` (pågår) eller `post` (spelad).
- **Turneringar** i lagläge: lagets liga, Champions League, Europa League och Conference League (`CONFIG.teamCompetitions`). Matcher hämtas från alla och slås ihop; turneringar där laget saknar matcher syns inte.
- **Zoner** i tabellen, per liga (`CONFIG.leagues[].zones`): Champions League (1–4), Europa (5–6) och nedflyttning (18–20). Antal lag läses från tabellen.
- **Form**: V/O/F i lagets 5 senaste ligamatcher.
- **Accordion**: ett kort med en alltid synlig sammanfattning och en utfällbar del. Alla är stängda vid första start; öppet/stängt sparas per läge.

## Skärmar
Ingen header eller uppdatera-knapp. Överst finns bara en statusrad: "Senast uppdaterad …" (och "Offline – visar sparad data" vid behov) samt versionsetiketten uppe till höger.

### 1. Ligaläge
```
┌──────────────────────────────┐
│ Senast uppdaterad lör 7 nov  │ v0.7.0
│ AKTUELLA MATCHER             │
│  PÅGÅR NU                    │
│  Arsenal    2–1   Chelsea    │
│             LIVE 67'         │
│  IDAG                        │
│  Spurs     17:30  Liverpool  │
│  Fler kommande matcher    ⌄  │
├──────────────────────────────┤
│ SENASTE RESULTAT             │
│  Everton    0–0   Fulham     │
│  Fler resultat            ⌄  │
├──────────────────────────────┤
│ PREMIER LEAGUE               │
│  1 Arsenal       11  26      │
│  2 Man City      11  24      │
│  3 Liverpool     11  23      │
│  Hela tabellen            ⌄  │
└──────────────────────────────┘
```
- **Aktuella matcher**: alla pågående matcher under "Pågår nu" (ställning, matchminut, LIVE), fyllt på med närmast kommande till minst 3 rader. Grupperat per dag med "Idag", "I morgon" eller datum. Utfällt: fler kommande, upp till två omgångar (20 matcher).
- **Senaste resultat**: de 2 senast spelade, nyaste först. Utfällt: upp till två omgångar (20 matcher).
- **Ligaväljare** överst: segmenterad knapp *PL · LaLiga · Serie A · CL* (se Champions League i ligaväljaren). Byte visar sparad data för ligan direkt och hämtar färsk.
- **Tabell**: topp 3 (placering, lag, M, V, O, F, MS, P). Utfällt: resten av samma tabell plus förklaring av zonerna. Raderna är tryckbara. På smal skärm döljs V/O/F.

### 2. Lagläge
```
┌──────────────────────────────┐
│ (●) Arsenal               ✕  │
│ NÄSTA MATCH                  │
│   Arsenal  17:30  Chelsea    │
│   PL · Hemma  om 2 d 4 h     │
│  Kommande matcher         ⌄  │
├──────────────────────────────┤
│ SENASTE MATCH                │
│   Spurs     1–3   Arsenal    │
│   ⚽ 12' Saka   ⚽ 40' Son    │
│  Tidigare matcher         ⌄  │
├──────────────────────────────┤
│ PREMIER LEAGUE               │
│  1 Arsenal       11  26      │
│  Form V V O V F           ⌄  │
└──────────────────────────────┘
```
- Överst en rad med lagets märke och namn samt **✕**, som tar tillbaka till ligaläge utan bekräftelse.
- **Nästa match**: motståndare (med klubbmärke), hemma/borta, turnering, datum och avsparkstid i lokal tid, nedräkning ("om 2 d 4 h"). Pågående match: ställning, matchminut och LIVE. Utfällt: de 5 därefter kommande.
- **Senaste match**: resultat, motståndare, H/B, turnering, datum och V/O/F. Utfällt: de 5 matcherna innan.
- **Tabell**: lagets rad och form. Utfällt: hela tabellen med laget markerat; raderna är tryckbara för att byta lag.
- Matcher i lagläge omfattar alla turneringar laget spelar i.

### 3. Bred skärm (≥ 840 px, dator)
```
┌──────────────────────────┬──────────────────────┐
│ (valt lag            ✕)  │                      │
│ AKTUELLA MATCHER       ▲ │ PREMIER LEAGUE       │
│  upp till två omgångar,│ │  hela tabellen,      │
│  en omgång syns, resten│ │  alltid utfälld,     │
│  skrollas i kortet     ▼ │  med zonförklaring   │
│ SENASTE RESULTAT       ▲ │                      │
│  (samma)               ▼ │                      │
└──────────────────────────┴──────────────────────┘
```
- Matcher i vänsterkolumnen, tabellen i högerkolumnen. Inga accordions för matcher och tabell – allt visas. Hjälp och Data ligger under, som accordions, och nås genom att skrolla sidan.
- Övre delen fyller fönstrets höjd. Varje kort tar sin del av höjden (matcher och resultat hälften var, tabellen hela höjden) och skrollar inuti sig självt. Kortrubrik, dagrubrik och tabellhuvud stannar kvar överst; en dagrubrik följer bara med så länge dagens matcher syns.
- Ligaläge: Aktuella matcher och Senaste resultat innehåller upp till två omgångar (20 matcher).
- Lagläge: Nästa/Senaste match visar även listan med 5 kommande/tidigare. Tabellen visas hel med laget markerat och formen ovanför.
- Under 840 px (mobil och surfplatta) är det en kolumn med accordions; på surfplatta centrerad, max 640 px (se Design).

### Välja och byta lag
- Tryck på ett lag i tabellen → dialog "Följ {lag}?" (ligaläge) eller "Byt till {lag}?" (lagläge) med **Följ/Byt** och **Avbryt**.
- Valt lags rad markeras med lagets egen färg från datakällan (vänsterkant och svag bakgrundston). Saknas färg används primärfärgen.

### Matchdetaljer
- Pågående och spelade matcher i listorna är tryckbara och fäller ut målen: minut, ⚽ och målskytt per lag (hemma vänster, borta höger), "(str.)" för straff, "(sj.)" för självmål och 🟥 för röda kort. Saknas data: "Ingen matchinfo tillgänglig."
- I lagläge visas målen direkt under ställningen i Nästa/Senaste match.
- Datan kommer från scoreboardens `details`, inga extra anrop. Utfällt läge gäller bara under sessionen.

### Champions League i ligaväljaren
- Ligaväljaren har ett fjärde läge, *CL*. Det visar Aktuella matcher, Senaste resultat och ligafasens tabell (`uefa.champions`) med zonerna Åttondelsfinal (1–8) och Playoff (9–24), utan nedflyttning. Inget slutspelsträd.
- Lag i CL-tabellen kan följas; laget får då sin inhemska liga om den är en av de tre (från lagets schema), annars visas bara CL-tabellen.

### Idag i alla ligor
- Ligaläge, överst under ligaväljaren: en rad "Idag: PL 3 · LaLiga 2 · Serie A 4 · CL 0" med antal matcher idag per liga, byggd **bara av data som redan finns i cachen** (inga extra anrop). Ligor utan färsk data (äldre än i dag) visas inte. Tryck byter liga.

### Senast följda lag
- I lagläge och på ligasidan: rad med upp till 5 senast följda lag (märke + kort namn), samma lag som har sparad data (`CONFIG.teamCacheMax`). Ett tryck byter lag direkt utan dialog. Långt tryck/✕ tar bort laget ur listan och dess cache.
- Är inte "flera lag samtidigt": bara ett lag är valt åt gången.

### Kortet Hjälp
- Sist i listan, stängt från början. Samma text som `docs/MANUAL.md` (ändra båda): lägen, välja och byta lag, ligaväljaren, offline och vad ESPN ser.

### Kortet Data
- Enligt `../STANDARD.md` punkt 5 (undantag U5), mönstret från budget-buddy (`packData`/`unpackData`/`exportText`/`importText` i `store.js`, `backup.js`).
- Exporteras: valt lag, vald liga, senast följda lag (utan matchdata), öppna accordions. Matchcachen exporteras aldrig – den hämtas om.
- Import validerar varje fält som vid läsning från `localStorage`; okänt `leagueId` eller lag-id som inte är `^\d{1,10}$` förkastas.
- **Radera all data** sist i kortet: tar bort alla `fns.*`-nycklar.

## Datamodell (endast localStorage)
| Nyckel | Innehåll |
|---|---|
| `fns.cache.v3` | Senast hämtad data (se nedan) |
| `fns.recent.v1` | Senast följda lag, upp till 5: `[{ id, name, logo, color, leagueId }]`, nyast först |
| `fns.team.v2` | Valt lag `{ id, name, logo, color, leagueId }` eller saknas (= ligaläge). `.v1` (utan `leagueId`) läses en gång som `eng.1` |
| `fns.league.v1` | Vald liga i ligaläge, ett id ur `CONFIG.leagues` |
| `fns.acc.v2` | Öppna accordions per läge: `{ league: { next, last, table }, team: { … } }` |

```json
{
  "table": [{ "id": "359", "name": "Arsenal", "logo": "https://…", "color": "#ef0107",
              "rank": 1, "played": 11, "w": 8, "d": 2, "l": 1, "gd": 15, "pts": 26 }],
  "league": [{ "id": "…", "league": "Premier League", "leagueId": "eng.1", "date": "2026-11-07T15:00Z",
               "state": "post", "detail": "FT", "clock": "90'",
               "home": { "id": "359", "name": "Arsenal", "logo": "…", "color": "#ef0107" },
               "away": { "…": "…" }, "homeScore": 2, "awayScore": 1,
               "events": [{ "kind": "goal", "min": "12'", "name": "B. Saka", "teamId": "359", "pen": false, "og": false }] }],
  "leagueFull": false,
  "colors": { "359": "#ef0107" },
  "teams": { "359": { "matches": ["…"], "color": "#ef0107", "ts": 1762500000000 } },
  "updatedAt": { "table": 1762500000000, "league": 1762500000000, "359": 1762500000000 }
}
```
- Cachen (`fns.cache.v3`) har `table`, `league`, `leagueFull` och `updatedAt` per liga-id: `{ "leagues": { "esp.1": { … } }, "colors": …, "teams": … }`. Gammal `.v2` ignoreras.
- All cachad data valideras fält för fält vid läsning (`store.js`), eftersom den kan vara gammal eller manipulerad.
- Sparad data för de 5 senast valda lagen behålls (`CONFIG.teamCacheMax`).
- Ny struktur → ny nyckelversion (`.v3`); gammal data ignoreras.

## Datakälla och uppdatering
- **ESPN:s öppna JSON-API** (`site.api.espn.com`), inofficiellt, gratis, ingen nyckel.
  - Samma host för alla ligor och Champions League; bara `{liga}` i sökvägen skiljer (`eng.1`, `esp.1`, `ita.1`, `uefa.champions`, `uefa.europa`, `uefa.europa.conf`).
  - Tabell: `/apis/v2/sports/soccer/{liga}/standings`
  - Ligans matcher: `/apis/site/v2/sports/soccer/{liga}/scoreboard?dates=YYYYMMDD-YYYYMMDD` i intervall om en vecka (3 veckor bakåt, 5 framåt) plus dagens scoreboard.
  - Lagets matcher: `/apis/site/v2/sports/soccer/{turnering}/teams/{lag-id}/schedule` (+ `?fixture=true` för kommande), per turnering.
  - Live: scoreboard för pågående matchers turnering.
  - Reserv: ger scoreboard för få matcher byggs ligans matcher av varje lags schema. Live faller på samma sätt tillbaka till hemmalagets schema.
- All åtkomst via adapterfunktioner (`fetchTable()`, `fetchTeamMatches()`, `fetchLeagueMatches()`, `fetchLive()`) i `app.js`, så att källan kan bytas.
- **När data hämtas:** när appen öppnas, när den visas igen efter bakgrunden (om datan är äldre än 1 minut), när nätet kommer tillbaka och vid byte av lag eller läge. Inga anrop i bakgrunden.
- **Live:** under pågående match, med appen synlig, uppdateras ställningen var 30:e sekund. Ligaläge: alla pågående ligamatcher; lagläge: lagets match.
- Cachad data visas direkt vid start och ersätts sedan av färsk data. Har ligadatan byggts av alla lags scheman och är nyare än 10 minuter visas ett nyvalt lags ligamatcher direkt därifrån och hämtas inte igen.

### Integritet och säkerhet
- Anropen görs direkt från mobilen till ESPN; ESPN ser IP-adress, webbläsare och vad som hämtas. `no-referrer` gör att ESPN inte får veta sidans adress.
- Ingen inloggning, inga cookies, ingen spårning, inga analysverktyg.
- Data från API:t renderas alltid som text (`textContent`), aldrig som HTML. Bilder används bara om adressen börjar med `https://`.
- Content-Security-Policy i `index.html`: skript och stil bara från egen origin, anrop bara till `site.api.espn.com`, bilder bara över https.
- Arbetsytans agent `granskning` bestämmer över säkerheten (undantag U5, U6 – godkänt 2026-11-11, villkor i dess tabell). CSP: `connect-src https://site.api.espn.com; img-src 'self' https://a.espncdn.com` (inga `https:`/`data:`); beslutet "Avböjt – smalare `img-src`" nedan är upphävt.
- Exponering vid hämtning (kontrollerat 2026-11-11): ESPN ser IP, `User-Agent`, `Accept-Language`, `Origin` och vilka ligor/lag som hämtas. Ingen referer, inga cookies (API: `credentials:'omit'`; klubbmärken: `img.crossOrigin='anonymous'`, ESPN svarar `Access-Control-Allow-Origin: *`), ingen användardata. Ligor hämtas först när de öppnas. Fler ligor ändrar varken host eller CSP (`connect-src https://site.api.espn.com`), bara sökvägar. Liga-id i URL:er kommer alltid från `CONFIG`, aldrig från lagrad data eller API-svar; lagrat `leagueId` valideras mot `CONFIG.leagues`.
- Ombyggnad enligt `template/` (2026-11-11): appen är undantaget från regeln om inga nätverksanrop. Innan bygget kontrolleras att undantaget för ESPN finns kvar i `granskning`-tabellen och `tools/check.ps1`; saknas det → förhandsprövning.

#### Härdning (beslut 2026-11-07)
- **Infört – Trusted Types:** CSP har `require-trusted-types-for 'script'`. Appen använder inte `innerHTML`, så ingen policy behövs. Safari ignorerar direktivet.
- **Infört – presentationen utan `'unsafe-inline'`:** CSS och JS ligger i `docs/presentation.css` och `docs/presentation.js`, inga `style`-attribut. CSP `script-src 'self'; style-src 'self'`.
- **Avböjt – smalare `img-src`:** kräver verifiering mot ESPN och körtest; `logo()` kräver redan `https://`.
- **Infört vid ombygget (2026-11-11) – central tolkning av API-svar:** `store.js` tolkar ESPN-svaren och kör samma validering som för cachen (`cleanMatch`, `cleanRow`): id `^\d+$`, färg strikt `#rrggbb`, klubbmärken bara `https://a.espncdn.com/…`, text utan styr- och riktningstecken, max 60 tecken. Ersätter det tidigare avböjda beslutet.
- URL:er byggs bara av `espnUrl()` i `store.js` (turnering ur `LEAGUES`/`EUROPE`, lag-id `^\d{1,10}$`, datum `^\d{8}-\d{8}$`; annars kastas fel). `fetch` alltid med `credentials:'omit'`, `cache:'no-store'`, `referrerPolicy:'no-referrer'`.
- Ny lagring: `fns.team.v2`, `fns.league.v1`, `fns.recent.v1`, `fns.cache.v3` (se Datamodell); **Radera all data** tar bort alla `fns.*` och inget annat. Backup-fil enligt U5 (krypterad), bara inställningar.
- Tester (`tools/tests/`): flödestesterna kör mot en fejkad `fetch` (`ui-before.js`, laddas av `tools/test.ps1` före appen) och använder aldrig nätet. De kontrollerar CSP:ns nätverksdirektiv, att alla anrop går till `site.api.espn.com` med rätt fetch-inställningar, att märken från andra värdar inte laddas och att data från källan renderas som text. Exakt CSP i `index.html` kontrolleras av `tools/check.ps1`.

## PWA-krav
- `manifest.webmanifest`: `name`, `short_name`, `id`, `start_url: "./"`, `scope: "./"`, `display: "standalone"`, `theme_color`, `background_color`, ikoner 192 & 512 (any + maskable). `icons/icon-180.png` som `apple-touch-icon` för iOS.
- `sw.js`: precache av appens egna filer, cache-first, cachenamn `fns-<version>`. Rensar bara sina egna gamla cacher (apparna delar origin på GitHub Pages). API-anrop och klubbmärken går förbi service workern; matchdata cachas i `localStorage`.
- Serveras över HTTPS via GitHub Pages: https://flyinggooner.github.io/Football-not-soccer/
- Versionsnummer i `version.js` visas uppe till höger och styr cachenamnet.
- Egen "Installera"-knapp längst ned (under innehållet) via `beforeinstallprompt`; dold när händelsen saknas eller appen redan är installerad. Påverkar inte layouten när den är dold.
- Ny service worker → snackbar "Ny version finns – Ladda om".
- Testfil för `file://`: `dist/football-not-soccer.html`, byggs med `tools/build-single.ps1` (ingen installation eller offline i den).

## Design
- Material Design 3 enligt den gemensamma stilen i `../CLAUDE.md`, nyckelfärg mörkt plommonlila `#4b1d6e`. Inte Premier Leagues färger, logotyper eller typsnitt (klubbmärken från datakällan är ok).
- Ljust och mörkt tema via `prefers-color-scheme`; `color-scheme: light dark` så att tvingat mörkt läge inte färgar om sidan.
- Resultatfärger: vinst grön, oavgjort grå, förlust röd. Zoner: CL grön, Europa blå, nedflyttning röd.
- Siffror med `tabular-nums`.
- **Layout: mobil, surfplatta, dator** (se `../CLAUDE.md`). Appen har inga flikar, så ingen sidomeny.
  - **Mobil (< 600 px, test 390 px):** en kolumn, kort som accordions.
  - **Surfplatta (600–839 px, iPad stående, test 820 px):** en centrerad kolumn max 640 px med 24 px marginaler; accordions som på mobil.
  - **Dator (≥ 840 px, även iPad liggande, test 1280 px):** matcher till vänster, tabellen till höger, alla kort utfällda och skrollar inne i sig själva.
- Accordions är `<button>` med `aria-expanded`; tryckytor ≥ 48 px; animation ≤ 200 ms, avstängd vid `prefers-reduced-motion`.
- Fungerar i aktuell Safari (iOS) och Chrome (Android).

## Acceptanskriterier v1
- [ ] Layout fungerar på 390 px (mobil), 820 px (iPad stående) och 1280 px (dator), ljust och mörkt.
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
