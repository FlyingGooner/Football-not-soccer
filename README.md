<div align="center">

<img src="icons/icon-192.png" width="88" alt="Football, not soccer-ikon">

# Football, not soccer ⚽

**Premier League i fickan – tabell, matcher och livestånd.**

Inga nyheter, ingen reklam, inget konto. Bara det du vill veta:
*hur ser tabellen ut, vad spelas härnäst och hur gick det för mitt lag?*

### [▶ Öppna appen](https://flyinggooner.github.io/Football-not-soccer/)

[📱 Presentation av appen](https://flyinggooner.github.io/Football-not-soccer/docs/presentation.html)

</div>

## Varför?

Fotbollsappar har blivit nyhetsflöden med resultat någonstans längre ner. Den här appen gör tvärtom: öppna den och tabellen, nästa match och senaste resultatet syns direkt – utan att skrolla, utan notiser och utan inloggning. Välj ett lag om du vill följa just det laget.

## Funktioner

| | |
|---|---|
| 🏆 **Ligaläge** | Pågående och kommande matcher per dag, senaste resultat och hela tabellen med zoner för CL, Europa och nedflyttning. |
| ⭐ **Lagläge** | Tryck på ett lag i tabellen: nästa match med nedräkning, senaste match med V/O/F, lagets tabellrad och form – i alla turneringar laget spelar i. |
| 🔴 **Live** | Ställning och matchminut uppdateras automatiskt under pågående matcher. |
| ⚽ **Matchdetaljer** | Tryck på en match för målskyttar, straffar, självmål och röda kort. |
| 📴 **Offline** | Senast hämtad data visas med tidsstämpel när nätet saknas. |
| 🌗 **Tema** | Ljust och mörkt, följer telefonens inställning. |

## Integritet 🔒

- **Bara en datakälla.** Appen hämtar matchdata direkt från ESPN:s öppna API – inget annat. Ingen analys, inga annonser, inga typsnitt eller skript utifrån. Det spärras även tekniskt med en Content Security Policy.
- **Inget konto, inga cookies.** Valt lag och senast hämtad data sparas bara i din webbläsare (`localStorage`).
- **Ingen spårning åt ESPN.** Sidans adress skickas inte med (`no-referrer`), men ESPN ser som alla webbplatser din IP-adress.

> Anrop görs bara när du öppnar appen och under pågående matcher – aldrig i bakgrunden.

## Installera på mobilen

**Android (Chrome)**
1. Öppna [appen](https://flyinggooner.github.io/Football-not-soccer/) i Chrome.
2. Tryck på menyn **⋮** → **Installera app** (eller *Lägg till på startskärmen*).

**iPhone (Safari)**
1. Öppna [appen](https://flyinggooner.github.io/Football-not-soccer/) i Safari.
2. Tryck på **Dela** → **Lägg till på hemskärmen**.

Versionsnumret syns uppe till höger i appen. Nya versioner hämtas automatiskt.

## För utvecklare

Ren HTML, CSS och JavaScript – inga ramverk, inga beroenden, inget byggsteg för appen.

**Köra lokalt:** servera mappen statiskt, t.ex. `python3 -m http.server 8080`, och öppna http://localhost:8080 (service workern kräver `localhost` eller HTTPS).

**Testfil:** `tools\build-single.ps1` bakar ihop appen till en enda fil, `dist/football-not-soccer.html`, som går att öppna direkt i webbläsaren eller skicka till någon (utan installation och offline).

| Fil | Innehåll |
|---|---|
| `index.html` | Appens markup |
| `styles.css`, `app.js` | Stil, datakälla och logik |
| `store.js` | Lagring i `localStorage` och validering av sparad data |
| `version.js` | Versionsnummer (enda källan) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Installation som app (PWA) och offline |
| `docs/SPEC.md` | Specifikation av funktioner och beteende |
| `docs/presentation.html` | Fristående mobilpresentation av appen |
| `tools/build-single.ps1` | Bygger testfilen |
| `CLAUDE.md` | Regler för utveckling |

Publiceras till GitHub Pages från `main`.

---
<sub>Inofficiellt hobbyprojekt, inte kopplat till Premier League eller ESPN. Det heter fotboll.</sub>
