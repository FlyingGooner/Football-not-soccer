<p align="center"><img src="icons/icon-192.png" width="96" alt="App-ikon"></p>

# It's football, not soccer ⚽

En lättviktig, mobilanpassad webbapp för att följa **Premier League** – tabell, matcher och livestånd – i en enda HTML-fil.

**▶ Öppna appen:** https://flyinggooner.github.io/Football-not-soccer/
**📱 Presentation:** [presentation.html](https://flyinggooner.github.io/Football-not-soccer/presentation.html)

## Vad kan appen?
- **Ligaläge** – pågående och kommande matcher, senaste resultat och hela tabellen.
- **Lagläge** – tryck på ett lag i tabellen för att följa det: nästa match, senaste match (V/O/F), lagets tabellrad och form.
- **Live** – ställning och matchminut uppdateras under pågående matcher.
- **Matchdetaljer** – tryck på en match för att se målskyttar, straffar, självmål och röda kort.
- **Offline** – senast hämtad data sparas och visas med tidsstämpel när nätet saknas.
- **Ljust och mörkt tema** som följer telefonens inställning.
- **Installera som app** – i Chrome: ⋮ → *Installera app* / *Lägg till på startskärmen*.

## Så funkar det
- All kod ligger i `index.html` (vanilla JS + CSS). Inga ramverk, inget byggsteg, inga beroenden.
- Data hämtas från ESPN:s öppna JSON-API – ingen nyckel eller inloggning behövs.
- Inga cookies, ingen spårning. Strikt Content Security Policy; all trafik går över `https://`.
- Tider visas i din lokala tidszon.

## Köra själv
Klona repot och öppna `index.html` i webbläsaren, eller aktivera GitHub Pages på din fork.

## Filer
| Fil | Innehåll |
|---|---|
| `index.html` | Hela appen |
| `SPEC.md` | Specifikation av funktioner och beteende |
| `presentation.html` | Fristående mobilpresentation av appen |
| `manifest.webmanifest`, `icons/` | För installation som app (PWA) |
| `CLAUDE.md` | Utvecklingsregler för projektet |

---
*Inofficiellt hobbyprojekt, inte kopplat till Premier League eller ESPN. Det heter fotboll.*
