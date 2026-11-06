# Spec – Fotbollsföljaren (v0.2)

## Syfte
En personlig, lättviktig webbapp i en enda HTML-fil för att följa fotboll som intresserar mig.
Version 1 omfattar **endast Arsenal FC herrlag**.

## Användning
- En användare (jag), på mobilen.
- Körs via **GitHub Pages** (`https://flyinggooner.github.io/Football-not-soccer/`) och läggs till på hemskärmen.
  Lokal fil (`file://`) stöds i mån av möjlighet men är inte målet.
- Svarar snabbt på: *Var ligger Arsenal i tabellen? När är nästa match? Hur gick senaste?*

## Layout (uppifrån och ned)
En kolumn med tre kort. Varje kort har en alltid synlig sammanfattning och en utfällbar del (accordion).
Alla accordions är stängda vid start; öppet/stängt-läget sparas i `localStorage`.

### 1. Tabell
- **Synligt:** Arsenals rad i Premier League – placering, lag, M (matcher), V, O, F, MS (målskillnad), P (poäng)
  samt formen i de 5 senaste ligamatcherna (V/O/F-prickar).
- **Utfällt:** hela tabellen (20 lag) med samma kolumner, Arsenal markerad.
  Placeringszoner markeras med en färgad kant: Champions League, Europa League/Conference League, nedflyttning.
- På smal skärm döljs V/O/F i hela tabellen; M, MS, P visas alltid.

### 2. Nästa match
- **Synligt:** nästa match – motståndare (med klubbmärke om källan har det), hemma/borta, turnering,
  datum och avsparkstid i lokal tid, nedräkning ("om 2 d 4 h").
  Pågående match: ställning, matchminut och "LIVE"-markering i stället för nedräkning.
- **Utfällt:** de 5 därefter kommande matcherna (datum, tid, motståndare, H/B, turnering).

### 3. Senaste match
- **Synligt:** senaste spelade match – resultat, motståndare, H/B, turnering, datum, V/O/F-markering.
- **Utfällt:** de 5 matcherna innan dess i samma format.

Matcher i 2 och 3 omfattar alla turneringar (PL, FA-cupen, Ligacupen, Champions League m.fl.).

## Header
- Sticky header med appens namn och en "Uppdatera"-knapp.
- Under headern: "Senast uppdaterad hh:mm" (och "Offline – visar sparad data" vid behov).

## Tema – inspirerat av Premier Leagues webbplats
Inspiration, inte kopia: **inga PL-logotyper, lejonet eller PL-typsnitt**, bara färgkänsla och stil.
- Primär bakgrund i header och kortrubriker: djup lila `#37003C`.
- Accenter: grön `#00FF85` (t.ex. LIVE, CL-zon, vinst), rosa/magenta `#E90052` (förlust, nedflyttningszon),
  cyan `#04F5FF` (länkar/fokus, Europa-zon).
- Arsenals rad markeras med Arsenalröd `#EF0107` som vänsterkant.
- Ljust tema: vita kort på ljusgrå bakgrund (`#F2F2F2`), lila rubriker.
  Mörkt tema (`prefers-color-scheme: dark`): mörklila bakgrund (`#1A001D`), kort i `#2A002E`.
- Typsnitt: systemets sans-serif, fet och kompakt i rubriker och siffror (tabular-nums).
- Rundade kort (8–12 px), tydliga accordion-pilar som roterar vid öppning, mjuk animation (≤ 200 ms,
  avstängd vid `prefers-reduced-motion`).

## Datakälla
- **ESPN:s öppna JSON-API** (`site.api.espn.com`), inofficiellt, gratis, ingen nyckel.
  - Schema/resultat: `/apis/site/v2/sports/soccer/eng.1/teams/359/schedule` (+ övriga turneringar vid behov)
  - Tabell: `/apis/v2/sports/soccer/eng.1/standings`
  - Live: scoreboard-endpoint för pågående match.
- Måste verifieras att API:t tillåter anrop från webbläsaren (CORS) innan bygget.
- Reserv: football-data.org (gratisnyckel som användaren anger i appen).
- All åtkomst via adapterfunktioner (`fetchTable()`, `fetchFixtures()`, `fetchResults()`, `fetchLive()`).

## Uppdatering och live
- Hämtning när appen öppnas och vid tryck på "Uppdatera". Inga anrop i bakgrunden.
- Under pågående match (och appen öppen och synlig): uppdatera live-ställningen var 30:e sekund.
- Cachad data visas direkt vid start, därefter ersätts den av färsk data.

## Integritet och säkerhet
- Anropen görs direkt från mobilen till ESPN; ESPN ser IP-adress, webbläsare och vad som hämtas.
- Ingen inloggning, inga cookies, ingen spårning, inga analysverktyg.
- Data från API:t renderas alltid som text (`textContent`), aldrig som HTML.

## Utanför v1
- Fler lag, nyheter, trupp, detaljerad statistik, pushnotiser, backend.

## Tekniska krav
- Fil: `index.html`, självständig (inline CSS/JS), inga externa beroenden utöver data-API:t
  (klubbmärken laddas som bilder från källan).
- Fungerar i aktuell Safari (iOS) och Chrome (Android), 360–430 px bredd.
- Tillgänglighet: accordions är `<button>` med `aria-expanded`, tryckytor ≥ 44 px, text ≥ 16 px.

## Acceptanskriterier v1
- [ ] Arsenals tabellrad syns direkt; tryck fäller ut hela tabellen med Arsenal markerad.
- [ ] Nästa match visas med korrekt lokal tid och nedräkning; utfällt visas 5 kommande.
- [ ] Senaste match visas med resultat och V/O/F; utfällt visas 5 tidigare.
- [ ] Pågående match visar LIVE och uppdateras utan omladdning.
- [ ] Utan nät visas sparad data med tidsstämpel; vid API-fel ett tydligt felmeddelande.
- [ ] Ljust och mörkt tema i PL-inspirerad stil, utan PL:s varumärken.
