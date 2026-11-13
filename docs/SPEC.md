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
- **Favorit**: ett lag (mittknappen), visas som hel lagvy. **Följda lag**: högst 8 inklusive favoriten, visas samlat under Lag. Varje lags liga sparas med laget, så att Real Madrid alltid hämtar LaLiga.
- **Match**: en match i någon av de konfigurerade turneringarna, med tillstånd `pre` (kommande), `in` (pågår) eller `post` (spelad).
- **Turneringar** i lagläge: lagets liga, Champions League, Europa League och Conference League (`CONFIG.teamCompetitions`). Matcher hämtas från alla och slås ihop; turneringar där laget saknar matcher syns inte.
- **Zoner** i tabellen, per liga (`CONFIG.leagues[].zones`): Champions League (1–4), Europa (5–6) och nedflyttning (18–20). Antal lag läses från tabellen.
- **Form**: V/O/F i lagets 5 senaste ligamatcher.
- **Flik**: en av fem vyer i menyn nertill. Vald flik sparas (`fns.tab.v1`) och appen öppnas på den; första start är Matcher (Favorit om en favorit redan är vald).

## Skärmar
Samma struktur som simple-nutrition (beslut 2026-11-11): rubrikrad med appens namn och versionsetikett, och under namnet en liten statusrad ("Uppdaterad 14:32", datum bara om inte idag, fel och offline; beslut 2026-11-11, sparar plats), innehållet i en kolumn (max 520 px) och menyn nertill: **⚽ Matcher · 📋 Tabell · [favoritens märke] · ⭐ Följer · ⚙️ Inst.** Bara mobillayout (se `../STIL.md`); på bredare skärm centreras kolumnen. Ingen uppdatera-knapp.

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
- **Ligaväljare** överst: textflikar utan ramar, centrerade och symmetriska (lika breda), vald i fetstil med tunn linje under (beslut 2026-11-11); många ligor → raden scrollar i sidled, samma på Matcher och Tabell. Byte visar sparad data direkt och hämtar bara det som behövs (se Datakälla och uppdatering).
- **Kortet Matcher** ersätter korten Aktuella matcher och Senaste resultat (beslut 2026-11-11). Ingen rubrik. Flikar överst i kortet, samma centrerade textflikar som ligaväljaren:
  - **Aktuella**: pågående matcher ("Pågår nu") och resten av dagens matcher ("Idag"). Matcher öppnas på **Aktuella** om det finns pågående matcher eller matcher i dag, annars på **Kommande** (beslut 2026-11-11).
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

### 3. Favorit (mittknappen, beslut 2026-11-13)
- Mittknappen i menyn är favoritlagets märke (namn under). Utan favorit: tom ☆ "Favorit", vyn visar "Inget favoritlag valt" och knappen **Välj lag** (öppnar lagväljaren).
- **Hela vyn får plats utan scroll** på en vanlig telefon: kompakta kort, matchrader på en rad.
- Favoritlaget: rad med märke, namn och **formen** (5 senaste ligamatcher, V/O/F). Neutral bakgrund (`--surface-container-high`), lagets färg bara som kant till vänster. Ingen placering, ingen tabell.
- **Nästa match**: kompakt: märken, namn, tid, datum, turnering, hemma/borta, nedräkning. Pågår matchen visas ställning och LIVE-tid, rubriken blir **Pågår nu** och ställningen uppdateras var 20:e sekund. Under: 3 kommande på en rad var (datum och tid, motståndare (H/B), turnering kort). **Visa fler** fäller ut alla kommande.
- **Senaste match**: resultat, V/O/F, turnering och datum – inga målskyttar eller kort. Under: 3 matcher innan; **Visa fler** fäller ut resten. Tryck på en spelad match → målen (se Matchdetaljer). Utfällt läge gäller bara under sessionen.

### 4. Följer (alla följda lag, beslut 2026-11-13)
```
│ [Alla] (ARS)(LIV)(RMA) [+]  │
│ ● PÅGÅR NU                  │
│ RMA 1–1 BAR      67' LaLiga │
│▌🔴 Arsenal                  │
│  Kommande  lör 18:30 CHE (H)│
│  Spelad    V 1–0 HUL  7 nov▸│
```
- **Märkesrad** överst: **Alla**, sedan ett märke per följt lag (favoriten först) och **[+]** (öppnar lagväljaren). Tryck på ett märke → bara det lagets kort och pågående match, med Kommande och Spelad utfällda så att listorna fyller skärmen (hälften var, minst 5; Visa fler → resten); tryck igen (eller Alla) → alla.
- **Pågår nu** (bara när någon följd match pågår): en rad per match med ställning, minut och turnering, uppdateras var 20:e sekund. Tryck → målen.
- **Ett kort per lag**: favoriten först, sedan efter nästa avspark. Lagnamn, sedan raderna **Kommande** (nästa match: dag, tid, motståndare (H/B)) och **Spelad** (V/O/F, resultat, motståndare, datum). Pågår lagets match visas den under Pågår nu och Kommande är matchen efter.
- Tryck på **Kommande** eller **Spelad** → 5 matcher till i samma kolumn, **Visa fler** → resten; tryck igen fäller ihop. Tryck på en spelad match → målen. Utfällt läge gäller bara under sessionen.
- Inga lag följda: "Inga lag följda" och knappen **Välj lag**.

### 5. Inställningar
- Grupper som fälls ut, som i simple-nutrition: **Lag** (följda lag: ★ gör till favorit, ✕ slutar följa, samt **Välj lag**), **Utseende** (Kortordning) och **Allmänt** (Data, Hjälp och manual, Installera appen). Sist en rad med version och "matchdata från ESPN".

### Lagväljaren (beslut 2026-11-13)
- Egen vy (← tillbaka) från [+] under Följer, **Välj lag** och Inställningar → Lag. Listar ligorna i `LEAGUES` (inte cuper), alla ihopfällda. Tryck på en liga → dess lag i bokstavsordning (märke, namn, **☆/★** favorit, **+/✓** följ); flera ligor kan vara öppna.
- Lagen tas ur ligans tabell (cachad tabell först, annars ett anrop när ligan fälls ut).
- Högst 8 följda lag, favoriten inräknad; det 9:e ger ett meddelande. Bara en favorit; ny favorit ersätter den gamla, som fortsätter följas. Favorit följs automatiskt; slutar man följa favoriten finns ingen favorit.
- Tabellen har ingen följ-dialog längre. Följda lags rader markeras med lagets egen färg (vänsterkant och svag bakgrundston), saknas färg används primärfärgen.

### Matchdetaljer
- Pågående och spelade matcher är tryckbara och fäller ut händelserna i tidsordning per lag (hemma vänster, borta höger): minut, ⚽ och målskytt, "(str.)" för straff, "(sj.)" för självmål. **Pågående** matcher visar även 🟨 gult och 🟥 rött kort (andra gula: 🟨🟥); **spelade** visar bara mål (beslut 2026-11-13). Saknas data: "Ingen matchinfo tillgänglig."
- Inga händelser visas direkt i listorna, bara efter tryck.
- Datan kommer från scoreboardens `details` när matchen finns i ligacachen. Annars (t.ex. från lagets schema, som saknar mål) hämtas `summary` för matchen vid tryck (ett anrop, "Hämtar…" under tiden) och målen sparas permanent i `fns.goals.v1` (högst 200 matcher, äldst tas bort först). Utfällt läge gäller bara under sessionen.

### Ligor och turneringar (beslut 2026-11-11)
- Alla i `LEAGUES` (`store.js`), med data kontrollerad hos ESPN 2026-11-11:
  - **Ligor:** Premier League `eng.1`, LaLiga `esp.1`, Serie A `ita.1`, Bundesliga `ger.1`, Ligue 1 `fra.1`, Eredivisie `ned.1`, Primeira Liga `por.1`, Allsvenskan `swe.1`.
  - **Europacuper:** Champions League `uefa.champions`, Europa League `uefa.europa`, Conference League `uefa.europa.conf` – ligafasens tabell med zonerna Åttondelsfinal (1–8) och Playoff (9–24). Inget slutspelsträd.
  - **Landslag:** VM `fifa.world`, EM `uefa.euro`, Copa América `conmebol.america`, Afrikanska mästerskapen `caf.nations`, Gold Cup `concacaf.gold` (Asiatiska mästerskapen saknar data). Tabellen visas per grupp (gruppens namn som rubrik), utan zoner. Mellan turneringarna visas senaste turneringens data eller tomt läge.
- **Ligaväljaren** visar de ligor användaren valt, i vald ordning (standard: PL, LaLiga, Serie A, CL; övriga dolda). Fler än fyra → raden kan scrollas i sidled. Väljs under Inställningar → Utseende → **Ligor**: samma lista som Kortordning (↑ ↓ flyttar, ●/○ visar/döljer, Återställ). Minst en måste visas. Döljs den valda ligan byts till första synliga. Gäller både Matcher och Tabell. Sparas i `fns.layout.v1` under `leagues` (exporteras som övrig kortordning).
- **Svep på Tabell** åt vänster/höger byter till nästa/föregående liga i ligaväljaren (samma regel som svep på Matcher).
- Lag i en europacups tabell kan följas; laget får då sin inhemska liga om den är en av ligorna ovan, annars visas bara cupens data. **Landslag** kan följas från turneringens tabell; laget får turneringen som liga och bara den turneringens matcher hämtas (inga europacuper).
- Reserven "varje lags schema" används bara för ligor, aldrig för cuper och landslagsturneringar (för många anrop).

### Följda lags data
- Sparad data behålls för alla följda lag (högst 8); slutar man följa ett lag tas dess cache bort. Ersätter "Senast följda lag" (2026-11-13): `fns.team.v2` och `fns.recent.v1` läses en gång – valt lag blir favorit, senast följda blir följda (högst 8).

### Kortordning
- Som simple-nutrition: Inställningar → Utseende → Kortordning har en lista per vy (Matcher: bara kortet Matcher, så listan visas inte för vyn; Favorit: Nästa match, Senaste match). ↑ ↓ flyttar, ●/○ visar/döljer, "Återställ" ger standard. Okända kort-id ignoreras, nya kort läggs sist.

### Kortet Hjälp
- Under Inställningar → Allmänt → Hjälp och manual. Samma text som `docs/MANUAL.md` (ändra båda): lägen, välja och byta lag, ligaväljaren, offline och vad ESPN ser.

### Kortet Data
- Enligt `../STANDARD.md` punkt 5 (undantag U5), mönstret från budget-buddy (`packData`/`unpackData`/`exportText`/`importText` i `store.js`, `backup.js`). Lösenordsgenerator och Kopiera som simple-nutrition (2026-11-13): **Skapa slumpmässigt lösenord**, färgkodad förhandsvisning, **Kopiera** bara för genererat lösenord (U5), dolt användarnamn ”Football not soccer backup”.
- Exporteras: följda lag och favorit, vald liga (utan matchdata) och kortordning. Vald flik exporteras inte. Matchcachen exporteras aldrig – den hämtas om.
- Import validerar varje fält som vid läsning från `localStorage`; okänt `leagueId` eller lag-id som inte är `^\d{1,10}$` förkastas.
- **Radera all data** sist i kortet: tar bort alla `fns.*`-nycklar.

## Datamodell (endast localStorage)
| Nyckel | Innehåll |
|---|---|
| `fns.cache.v4` | Senast hämtad data (se nedan) |
| `fns.teams.v1` | Följda lag `{ favorite: id eller null, follow: [{ id, name, logo, color, leagueId }] }`, högst 8, i den ordning de lades till. Ersätter `fns.team.v2` och `fns.recent.v1` (läses en gång, tas sedan bort) |
| `fns.goals.v1` | Mål för spelade matcher hämtade via `summary`: `{ "<match-id>": { ts, events: [{ kind: "goal", min, name, teamId, pen, og }] } }`, högst 200 |
| `fns.league.v1` | Vald liga i ligaläge, ett id ur `CONFIG.leagues` |
| `fns.tab.v1` | Vald flik: `matches`, `table`, `fav`, `team` eller `settings` |
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
  "range": { "from": "2026-10", "to": "2026-12" }, "used": 1762500000000,
  "colors": { "359": "#ef0107" },
  "teams": { "359": { "matches": ["…"], "color": "#ef0107", "ts": 1762500000000 } },
  "updatedAt": { "table": 1762500000000, "league": 1762500000000, "359": 1762500000000 }
}
```
- Cachen (`fns.cache.v4`) har `table`, `league`, `range` (hämtade månader `YYYY-MM`), `used` (senast använd) och `updatedAt` per liga-id: `{ "leagues": { "esp.1": { … } }, "colors": …, "teams": … }`. `kind` är `goal`, `yellow` eller `red`. Gammal `.v3` ignoreras (en första hämtning per liga).
- All cachad data valideras fält för fält vid läsning (`store.js`), eftersom den kan vara gammal eller manipulerad.
- Sparad data behålls för de följda lagen (högst 8, `CONFIG.teamMax`).
- Ny struktur → ny nyckelversion (`.v4`); gammal data ignoreras.

## Datakälla och uppdatering
- **ESPN:s öppna JSON-API** (`site.api.espn.com`), inofficiellt, gratis, ingen nyckel.
  - Samma host för alla ligor och turneringar; bara `{liga}` i sökvägen skiljer (id enligt Ligor och turneringar).
  - Tabell: `/apis/v2/sports/soccer/{liga}/standings`
  - Ligans matcher (beslut 2026-11-11): `/apis/site/v2/sports/soccer/{liga}/scoreboard?dates=YYYYMM`, en hel månad per anrop. Först förra, denna och nästa månad parallellt (3 anrop); Visa fler hämtar en månad till åt gången (högst 3 bakåt och 3 framåt från denna månad). Dagintervall (`YYYYMMDD-YYYYMMDD`) ger HTTP 400 hos ESPN och används inte. Ingen reserv via varje lags schema.
  - Lagets matcher: `/apis/site/v2/sports/soccer/all/teams/{lag-id}/schedule` (+ `?fixture=true` för kommande) – alla tävlingar i 2 anrop; varje matchs `league.slug` mappas till ett id i `COMPS`, övriga (vänskapsmatcher, ligacuper) tas bort. Schemat saknar mål och kort; de fylls i från ligans månadscache (samma match-id).
  - Hemmaliga för ett lag som följs från en turneringstabell: `/apis/site/v2/sports/soccer/{turnering}/teams/{lag-id}` → `defaultLeague.slug` (1 anrop), godtas bara om det är en liga i `LEAGUES`. Finns laget redan i en cachad tabell används den.
  - Live: dagens scoreboard för pågående matchers turnering.
  - Mål för en spelad match utanför ligacachen (beslut 2026-11-13): `/apis/site/v2/sports/soccer/{turnering}/summary?event={match-id}` (`keyEvents` med `scoringPlay`), bara vid tryck, en gång per match (sparas i `fns.goals.v1`).
  - Lag-fliken: varje följt lags schema enligt reglerna ovan (högst 8 lag, högst en gång per dygn per lag eller när en av lagets matcher har börjat), hämtas parallellt.
- All åtkomst via adapterfunktioner (`fetchTable()`, `fetchTeamMatches()`, `fetchMonths()`, `fetchLive()`) i `app.js`, så att källan kan bytas.
- **När data hämtas:** bara det den öppna fliken visar – när appen öppnas, när den visas igen, när fliken byts, när nätet kommer tillbaka och vid byte av liga eller lag – och bara om cachen inte längre gäller (nedan). Inställningar hämtar inget. Inga anrop i bakgrunden.
  - Byte av liga (knapp eller svep) väntar 0,4 s innan något hämtas, så ligor man sveper förbi hämtas inte.
  - Samma URL hämtas högst en gång per minut (svaret återanvänds), utom live-uppdateringen och när en match borde ha börjat men fortfarande visas som ej startad.
  - Tabell och matcher hämtas parallellt.
- **Cache per liga till nästa avspark (beslut 2026-11-11):** ligans data hämtas inte igen så länge ingen match i ligan har börjat eller pågår sedan förra hämtningen (en `pre`-match med avsparkstid ≤ nu, eller en `in`-match). Då hämtas bara dagens scoreboard.
  - Passerade månader hämtas aldrig igen. Denna månad hämtas igen efter 6 timmar (flyttade matcher, nya tider); börjar en ny månad hämtas bara den som saknas.
  - Tabellen hämtas bara när en match i ligan har gått till `post` efter förra tabellhämtningen (eller saknas/är äldre än 6 timmar).
  - Lag: ligans matcher tas ur ligacachen (fliken Lag hämtar lagets liga som ovan); lagets schema för alla tävlingar högst en gång per dygn eller när en av lagets matcher har börjat.
  - Cachen behåller högst 6 ligor (de senast använda, plus vald liga och lagets liga), för att inte fylla `localStorage`.
- **Live:** under pågående match, med appen synlig, uppdateras ställningen var 20:e sekund. Matcher: alla pågående ligamatcher; Favorit och Lag: de följda lagens matcher. Uppdateringen skrivs till både ligans och lagens cache.
- ESPN:s `Cache-Control` är bara 3–18 s, så webbläsarens HTTP-cache hjälper inte: `cache:'no-store'`, appens egen cache i `localStorage` gäller.
- Cachad data visas direkt vid start och ersätts sedan av färsk data.

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
- Anrop per månad (2026-11-11): nya sökvägar på samma host – `scoreboard?dates=YYYYMM`, `all/teams/{id}/schedule` (fast `all`, lag-id validerat) och `{turnering}/teams/{id}`. Ligor från `all`-schemat godtas bara om `league.slug` finns i `COMPS`; `defaultLeague.slug` bara om den finns i `LEAGUES` (slug från API:t hamnar aldrig i en URL). Ny lagrad del `used` (tidsstämpel) och `range` som månader, validerade i `store.js`. Ingen ny host, ingen ändrad CSP, inget nytt undantag. Färre anrop: inga scheman per lag i ligan, 1 anrop i stället för 8 tabeller för hemmaliga.

#### Härdning (beslut 2026-11-07)
- **Infört – Trusted Types:** CSP har `require-trusted-types-for 'script'`. Appen använder inte `innerHTML`, så ingen policy behövs. Safari ignorerar direktivet.
- **Infört – presentationen utan `'unsafe-inline'`:** CSS och JS ligger i `docs/presentation.css` och `docs/presentation.js`, inga `style`-attribut. CSP `script-src 'self'; style-src 'self'`.
- **Avböjt – smalare `img-src`:** kräver verifiering mot ESPN och körtest; `logo()` kräver redan `https://`.
- **Infört vid ombygget (2026-11-11) – central tolkning av API-svar:** `store.js` tolkar ESPN-svaren och kör samma validering som för cachen (`cleanMatch`, `cleanRow`): id `^\d+$`, färg strikt `#rrggbb`, klubbmärken bara `https://a.espncdn.com/…`, text utan styr- och riktningstecken, max 60 tecken. Ersätter det tidigare avböjda beslutet.
- URL:er byggs bara av `espnUrl()` i `store.js` (turnering ur `LEAGUES`/`EUROPE`, lag-id `^\d{1,10}$`, månad `^\d{6}$`, fasta sökvägen `all` bara för lagschema; annars kastas fel). `fetch` alltid med `credentials:'omit'`, `cache:'no-store'`, `referrerPolicy:'no-referrer'` och timeout 10 s (`AbortSignal.timeout`); svar över 8 000 000 tecken avvisas före `JSON.parse` (`parseResponse` i `store.js`).
- Ny lagring: `fns.teams.v1`, `fns.goals.v1` (2026-11-13), `fns.league.v1`, `fns.cache.v4` (se Datamodell); **Radera all data** tar bort alla `fns.*` och inget annat. Backup-fil enligt U5 (krypterad), bara inställningar.
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
| `--primary` / `--on-primary` | `#3a6a1e` / `#ffffff` | `#c8f57e` / `#173800` |
| `--primary-container` / `--on-primary-container` | `#bbf296` / `#0a2100` | `#3b7a0c` / `#e4ffb0` (lagtema: lagets färg) |
| `--surface` (bakgrund) | `#f8fbf1` | `#0c1210` |
| `--surface-container` (kort, menyn nertill) | `#ecefe5` | `#1a2521` |
| `--surface-container-high` | `#e6e9df` | `#243029` |
| `--on-surface` / `--on-surface-variant` | `#191d16` / `#43483e` | `#e1e4d9` / `#c3c8bb` |
| `--outline` | `#73796d` | `#8d9286` |

  - Vald flik, segmenterad knapp och menyns aktiva ikon: `--primary-container` med `--on-primary-container`. Versionsetiketten likadant.
  - `theme-color` = `--surface-container` (ljust `#ecefe5`, mörkt `#1a2521`); manifest `theme_color #1a2521`, `background_color #0c1210` (se PWA-krav).
  - **Lagtema (beslut 2026-11-13):** favoritlagets färg från ESPN (strikt `#rrggbb`) ersätter `--primary-container`/`--on-primary-container` (vald flik, chips, menyn, lagraden, versionsetiketten). `teamTheme()` i store.js: ljust = lagets färg (för ljusa färger mörkad till luminans ≤ 0,7), mörkt = samma kulör mörkad till luminans ≤ 0,06; text vit/svart resp. ljus ton, alltid kontrast ≥ 4.5:1. Inget favoritlag → grönt. Hörnen behålls (nästan fyrkantiga).
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
