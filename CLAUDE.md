# Regler för projektet "It's football, not soccer"

Dessa regler gäller för all utveckling i repot (för människor och AI-assistenter).

## Grundprinciper
1. **En enda HTML-fil.** Appen ligger i `index.html` med inbäddad CSS och JS. Inga byggsteg, inga ramverk, ingen `npm`.
2. **Mobil först.** Designa för smal skärm (360–430 px) och touch. Ska fungera att öppna direkt från filsystemet på mobilen (`file://`) eller via GitHub Pages.
3. **Inga hemligheter i koden.** API-nycklar committas aldrig. Behövs en nyckel matar användaren in den i appen och den sparas i `localStorage`.
4. **Fungera offline så gott det går.** Senast hämtad data cachas i `localStorage` och visas med tidsstämpel om nätet saknas.
5. **Specen styr.** Funktioner beskrivs i `SPEC.md` innan de byggs. Ändras beteendet ska specen uppdateras i samma commit.

## Kod
- Vanilla JavaScript (ES2020+), inga externa skript om det inte är absolut nödvändigt.
- Håll datakällan bakom ett litet adapterlager (`fetchFixtures()`, `fetchTable()` osv.) så att källan kan bytas eller fler lag läggas till.
- Lag-ID och liknande konfiguration samlas i ett `CONFIG`-objekt överst i skriptet – inget hårdkodat Arsenal-specifikt ute i koden.
- Tider visas i användarens lokala tidszon (Europe/Stockholm som standard).
- Tydlig felhantering: visa ett begripligt meddelande, aldrig en blank skärm.

## Språk och stil
- UI-text på svenska. Kod, variabelnamn och commit-meddelanden på engelska.
- Det heter **fotboll**/**football**, aldrig "soccer" i UI-texten.
- Tema inspirerat av Premier Leagues webbplats (lila `#37003C` + grön/rosa/cyan accenter), se `SPEC.md`. Använd aldrig PL:s logotyper eller typsnitt (klubbmärken som kommer från datakällan är ok). Ljust och mörkt tema via `prefers-color-scheme`.
- Data från API:er renderas alltid som text (`textContent`), aldrig som HTML.
- Inga anrop i bakgrunden; bara vid start, manuell uppdatering och under pågående match.

## Arbetsflöde
- `main` är enda grenen och standardgren. Committa och pusha direkt till `main` (inga feature-grenar eller PR:er om inget annat sägs).
- Små, fokuserade commits med beskrivande meddelanden.
- Kör subagenten `security-reviewer` (`.claude/agents/security-reviewer.md`) före push när `index.html` eller datakällor ändras. Allt nätverk ska gå över `https://` och CSP:n i `index.html` ska hållas så snäv som möjligt.
- Testa i en mobil viewport (t.ex. Chrome DevTools eller Playwright) innan push.
