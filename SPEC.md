# Spec – Fotbollsföljaren (v0.3)

## Syfte
En personlig, lättviktig webbapp i en enda HTML-fil för att följa fotboll som intresserar mig.
Version 1 omfattar **Premier League (herr)**. Appen visar ligan som helhet, och man kan välja ett lag i tabellen
för att följa just det laget. Inget lag är hårdkodat.

## Användning
- En användare (jag), på mobilen.
- Körs via **GitHub Pages** (`https://flyinggooner.github.io/Football-not-soccer/`) och läggs till på hemskärmen.
  Lokal fil (`file://`) stöds i mån av möjlighet men är inte målet.
- Svarar snabbt på: *Hur ser tabellen ut? Vilka matcher spelas härnäst? Hur gick det för mitt lag?*

## Lägen
Appen har två lägen. Valt läge sparas i `localStorage` och appen öppnas i samma läge nästa gång.
Första gången appen öppnas är den i **ligaläge**.

- **Ligaläge** – inget lag valt. Visar ligan som helhet.
- **Lagläge** – ett lag valt. Visar det lagets tabellrad, matcher och form.

### Välja och byta lag
- Tryck på ett lag i tabellen → dialog "Byt till {lag}?" med **Byt** / **Avbryt**.
  I ligaläge lyder texten "Följ {lag}?".
- I lagläge visas överst en rad med det valda lagets märke och namn samt **✕**.
  ✕ tar dig tillbaka till ligaläge (ingen bekräftelse).
- Det valda lagets rad i tabellen markeras med lagets egen färg (från datakällan) som vänsterkant
  och svag bakgrundston. Saknas färg används lila.

## Layout – ligaläge (uppifrån och ned)
Allt är hopfällt vid start så att vyn ryms på en mobilskärm utan att skrolla.

### 1. Tabell
- **Synligt:** topp 3 (placering, lag, M, V, O, F, MS, P). Raderna är tryckbara.
- **Utfällt:** resten av tabellen (plats 4–20) i samma tabell, plus förklaring av zonerna.
- Placeringszoner markeras med en färgad kant: Champions League, Europa League/Conference League, nedflyttning.
- På smal skärm döljs V/O/F; M, MS, P visas alltid.

### 2. Aktuella matcher
- **Synligt:** alla pågående matcher under "Pågår nu" (ställning, matchminut, LIVE), fyllt på med
  närmast kommande matcher till minst 3 rader. Grupperat per dag med "Idag", "I morgon" eller datum.
- **Utfällt:** fler kommande matcher, upp till två omgångar (20 matcher) totalt.

### 3. Senaste resultat
- **Synligt:** de 2 senast spelade matcherna, nyaste först, med slutresultat.
- **Utfällt:** fler resultat, upp till två omgångar (20 matcher) totalt.

## Layout – lagläge (uppifrån och ned)
Överst: raden med valt lag och ✕ (se ovan). Därefter tre kort, var och ett med en alltid synlig
sammanfattning och en utfällbar del (accordion).

### 1. Tabell
- **Synligt:** lagets rad – placering, lag, M, V, O, F, MS, P samt formen i de 5 senaste ligamatcherna
  (V/O/F-prickar).
- **Utfällt:** hela tabellen med laget markerat; raderna är tryckbara för att byta lag.

### 2. Nästa match
- **Synligt:** nästa match – motståndare (med klubbmärke), hemma/borta, turnering, datum och avsparkstid
  i lokal tid, nedräkning ("om 2 d 4 h"). Pågående match: ställning, matchminut och "LIVE".
- **Utfällt:** de 5 därefter kommande matcherna (datum, tid, motståndare, H/B, turnering).

### 3. Senaste match
- **Synligt:** senaste spelade match – resultat, motståndare, H/B, turnering, datum, V/O/F-markering.
- **Utfällt:** de 5 matcherna innan dess i samma format.

Matcher i lagläge omfattar alla turneringar laget spelar i (PL, FA-cupen, Ligacupen, Champions League m.fl.).

## Accordions
- Alla accordions är stängda vid första start; öppet/stängt-läget sparas i `localStorage` per läge.

## Statusrad
- Ingen header eller uppdatera-knapp. Överst finns bara en rad: "Senast uppdaterad …" (och "Offline – visar sparad data" vid behov).

## Tema – inspirerat av Premier Leagues webbplats
Inspiration, inte kopia: **inga PL-logotyper, lejonet eller PL-typsnitt**, bara färgkänsla och stil.
- Primär bakgrund i header och kortrubriker: djup lila `#37003C`.
- Accenter: grön `#00FF85` (t.ex. LIVE, CL-zon, vinst), rosa/magenta `#E90052` (förlust, nedflyttningszon),
  cyan `#04F5FF` (länkar/fokus, Europa-zon).
- Valt lag markeras med lagets egen färg (från datakällan) som vänsterkant.
- Ljust tema: vita kort på ljusgrå bakgrund (`#F2F2F2`), lila rubriker.
  Mörkt tema (`prefers-color-scheme: dark`): mörklila bakgrund (`#1A001D`), kort i `#2A002E`.
- Typsnitt: systemets sans-serif, fet och kompakt i rubriker och siffror (tabular-nums).
- Rundade kort (8–12 px), tydliga accordion-pilar som roterar vid öppning, mjuk animation (≤ 200 ms,
  avstängd vid `prefers-reduced-motion`).

## Datakälla
- **ESPN:s öppna JSON-API** (`site.api.espn.com`), inofficiellt, gratis, ingen nyckel.
  - Lagets schema/resultat: `/apis/site/v2/sports/soccer/{liga}/teams/{lag-id}/schedule` (+ `?fixture=true` för kommande),
    för varje turnering i konfigurationen.
  - Ligans matcher: `/apis/site/v2/sports/soccer/eng.1/scoreboard?dates=YYYYMMDD-YYYYMMDD`
    i intervall om en vecka (3 veckor bakåt, 5 framåt) plus dagens scoreboard.
  - Reserv om scoreboard inte ger några matcher: ligans matcher byggs av varje lags schema i ligan
    (samma endpoint som lagläget). Live-uppdatering faller på samma sätt tillbaka till hemmalagets schema.
  - Tabell: `/apis/v2/sports/soccer/eng.1/standings`
  - Live: scoreboard-endpoint för pågående match.
- Verifierat: API:t fungerar från webbläsaren i mobilen via GitHub Pages.
- Reserv: football-data.org (gratisnyckel som användaren anger i appen).
- All åtkomst via adapterfunktioner (`fetchTable()`, `fetchTeamMatches(teamId)`, `fetchLeagueMatches()`, `fetchLive()`).

## Uppdatering och live
- Hämtning när appen öppnas, när den visas igen efter att ha legat i bakgrunden (om datan är äldre än 1 minut) och när nätet kommer tillbaka (om appen är synlig). Inga anrop i bakgrunden.
- Under pågående match (och appen öppen och synlig): uppdatera live-ställningen var 30:e sekund.
  I ligaläge gäller det alla pågående ligamatcher, i lagläge lagets match.
- Byte av lag eller läge hämtar data för det nya läget direkt; tidigare hämtad data per lag cachas.
- Cachad data visas direkt vid start, därefter ersätts den av färsk data.

## Integritet och säkerhet
- Anropen görs direkt från mobilen till ESPN; ESPN ser IP-adress, webbläsare och vad som hämtas.
- Ingen inloggning, inga cookies, ingen spårning, inga analysverktyg.
- Data från API:t renderas alltid som text (`textContent`), aldrig som HTML.
- Alla anrop och bilder går över `https://`.
- Content-Security-Policy i `index.html`: anrop tillåts bara till `site.api.espn.com`, bilder bara över https, inga externa skript.
- `no-referrer`: API:t får inte veta sidans adress.
- Subagenten `security-reviewer` granskar säkerhet och integritet före push.

## Utanför v1
- Andra ligor än Premier League och en ligaväljare (nästa naturliga steg; konfigurationen ska förbereda för det).
- Nyheter, trupp, detaljerad statistik, pushnotiser, backend.
- Service worker för fullt offlinestöd (index.html och klubbmärken). Avvaktar tills behovet uppstår.
- Automatisk hämtning vid avspark; användaren öppnar appen igen.

## Tekniska krav
- Fil: `index.html`, självständig (inline CSS/JS), inga externa beroenden utöver data-API:t
  (klubbmärken laddas som bilder från källan).
- Fungerar i aktuell Safari (iOS) och Chrome (Android), 360–430 px bredd.
- Tillgänglighet: accordions är `<button>` med `aria-expanded`, tryckytor ≥ 44 px, text ≥ 16 px.

## Acceptanskriterier v1
- [ ] Första start visar ligaläge: hela tabellen, nästa omgång och senaste omgång grupperade per dag.
- [ ] Tryck på ett lag i tabellen → bekräftelse → lagläge för det laget.
- [ ] I lagläge: lagets rad med form syns direkt, hela tabellen fälls ut, laget markerat med sin färg.
- [ ] Nästa match visas med korrekt lokal tid och nedräkning; utfällt visas 5 kommande.
- [ ] Senaste match visas med resultat och V/O/F; utfällt visas 5 tidigare.
- [ ] ✕ tar tillbaka till ligaläge; valt läge och lag finns kvar efter omstart.
- [ ] Pågående match visar LIVE och uppdateras utan omladdning, i båda lägena.
- [ ] Utan nät visas sparad data med tidsstämpel; vid API-fel ett tydligt felmeddelande.
- [ ] Ljust och mörkt tema i PL-inspirerad stil, utan PL:s varumärken.
