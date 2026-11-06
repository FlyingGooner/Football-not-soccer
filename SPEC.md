# Spec – Fotbollsföljaren (v0.1)

## Syfte
En personlig, lättviktig webbapp i en enda HTML-fil för att följa fotboll som intresserar mig.
Version 1 omfattar **endast Arsenal FC herrlag**.

## Användare och användning
- En användare (jag), på mobilen.
- Öppnas snabbt för att svara på: *När spelar Arsenal härnäst? Hur gick senaste matchen? Var ligger vi i tabellen?*

## Funktioner – v1 (MVP)
1. **Nästa match** (överst, framträdande)
   - Motståndare, hemma/borta, turnering, datum och avsparkstid i lokal tid.
   - Nedräkning ("om 2 d 4 h").
   - Pågående match: visa ställning och "LIVE"-markering.
2. **Senaste resultat**
   - De 5 senaste matcherna med resultat och V/O/F-markering (grön/grå/röd).
3. **Kommande matcher**
   - De närmaste ~10 matcherna i alla turneringar (Premier League, FA-cupen, Ligacupen, Champions League m.fl.).
4. **Premier League-tabell**
   - Hela tabellen med Arsenal markerad; kolumner: placering, lag, M, MS, P.
5. **Uppdatering**
   - Data hämtas när appen öppnas och via en "Uppdatera"-knapp.
   - Cachad data visas direkt, med texten "Senast uppdaterad hh:mm".

## Utanför v1
- Fler lag (damlaget, landslag, andra klubbar) – men arkitekturen ska förbereda för det.
- Nyheter, spelartrupp, statistik, notiser.
- Inloggning eller backend.

## Datakälla
- Krav: gratis, fungerar direkt från webbläsaren (CORS), ingen server.
- Förstahandsval: ESPN:s öppna JSON-endpoints (`site.api.espn.com`) för lagschema och tabell (Arsenal = team-id `359`, PL = `eng.1`).
- Reserv: TheSportsDB (gratisnyckel) eller football-data.org (egen nyckel som användaren anger i appen).
- All åtkomst går via adapterfunktioner så att källan kan bytas utan att UI ändras.

## UI / layout
- En kolumn, kort (cards) i ordningen: Nästa match → Senaste resultat → Kommande → Tabell.
- Sticky header med titel och uppdatera-knapp.
- Stora tryckytor (minst 44 px), läsbar text (≥ 16 px).
- Ljust/mörkt tema efter systeminställning.

## Tekniska krav
- Fil: `index.html`, självständig (inline CSS/JS).
- Fungerar i aktuell Safari (iOS) och Chrome (Android).
- Laddtid < 1 s från cache; inga externa beroenden utöver data-API:t.
- Valfritt senare: PWA-manifest för "Lägg till på hemskärmen".

## Acceptanskriterier v1
- [ ] Öppnar `index.html` på mobilen och ser nästa Arsenal-match med korrekt lokal tid.
- [ ] Ser de 5 senaste resultaten och PL-tabellen med Arsenal markerad.
- [ ] Utan nät visas senast cachade data med tidsstämpel.
- [ ] Vid API-fel visas ett tydligt felmeddelande.
