# Football, not soccer

Mobil-först PWA. Spec: `docs/SPEC.md` (läs bara berört avsnitt). Arbetsflöde, säkerhet och artifact: `../CLAUDE.md`. Standard: `../STANDARD.md`. Stil: `../STIL.md`.

## Projektets regler
- Publicering: GitHub Pages byggs från `main`. Ändringar gjorda härifrån (Claude Code) committas och pushas direkt till `main`, med höjd version, så att de syns i appen.
- Svar till användaren efter en ändring: skriv alltid den nya versionen sist (t.ex. "Version: 0.2.18").
- Nätverksundantag U6 (`../.claude/agents/granskning.md`): bara ESPN:s öppna API `https://site.api.espn.com` och klubbmärken från `https://a.espncdn.com`. URL:er bara via `espnUrl()` i `store.js`, liga-id bara ur `LEAGUES`/`EUROPE`. All API-data tolkas och valideras i `store.js` innan den används. Inga anrop i bakgrunden: bara vid start, när appen visas igen, vid byte av liga/lag och under pågående match.
- Data bara i `localStorage`, nycklar `fns.*`; cache-prefix `fns-`. Backup-fil enligt U5 (`backup.js`, delad – ändra bara `template/backup.js`), bara inställningar, aldrig matchdata.
- Inga beroenden, inget byggsteg; vanliga skript (inga moduler, delar globalt scope) i ordningen `version.js`, `backup.js`, `store.js`, `app.js` (kärna, hämtning, tillstånd), en fil per vy i `views/` (läs bara den vy som ändras), sist `main.js` (render, navigering, uppdatering, backup, start). Ny vyfil → `<script>` i `index.html` före `main.js` och i `ASSETS`. `CONFIG` överst i `app.js`. Rendering med `textContent`/`el()`, aldrig HTML. Aldrig blank skärm vid fel.
- UI på svenska, det heter fotboll, aldrig "soccer". Kod och variabelnamn på engelska. Nyckelfärg `#4c8c2b` gräsgrön (inte PL:s `#37003C`; inga varumärken, typsnitt eller logotyper från ligorna – klubbmärken från källan är ok).
- Ny fil som appen behöver → `ASSETS` i `sw.js`. Version bara i `version.js` (sätts av `release.ps1`). Relativa sökvägar.
- Tester: `tools/tests/` – `unit.test.js` (store.js), `ui.test.js` mot fejkad ESPN i `ui-before.js`. Testerna får aldrig använda nätet.
- Manualen: `docs/MANUAL.md` och Hjälp-kortet har samma text – ändra båda.
