// Språkstöd (2026-11-15), delad fil – samma i alla appar (mall: template/i18n.js). Vanligt skript, laddas före allt annat.
// Källtexten i koden är svenska. Med engelska valt översätts all text i sidan när den ritas: en MutationObserver
// byter textnoder och attribut (placeholder, aria-label, title, alt) mot ordlistan (I18N.add i i18n-en.js).
// Bara textContent/setAttribute, aldrig HTML. Byte av språk laddar om sidan (källan är svensk, så sv behöver ingen översättning).
// Element med data-no-tr (och inmatningsfält) rörs inte. I18N.missing samlar svenska texter som saknas i ordlistan (för tester).
(function () {
  'use strict';
  let KEY = 'lang';   // appens nyckel sätts överst i i18n-en.js (I18N.setKey), t.ex. 'sn.lang'
  const LANGS = { sv: 'Svenska', en: 'English' };
  const read = () => { try { const v = localStorage.getItem(KEY); return v && v[0] === '"' ? JSON.parse(v) : v; } catch { return null; } };   // "sv" (JSON) går också, t.ex. från testernas seed
  const chosen = () => read() in LANGS;
  let def = null;   // fast standardspråk; annars svenska (2026-11-15: svenska är standard överallt)
  const guess = () => def || 'sv';
  const lang = () => (chosen() ? read() : guess());
  const map = new Map();
  const pats = [], late = [];
  const missing = new Set();
  const SV = /[åäöÅÄÖ]/;
  // Datumord: en sista utväg när en hel text saknas i ordlistan (t.ex. "Söndag 15 nov.").
  const WORDS = [
    ['måndag', 'Monday'], ['tisdag', 'Tuesday'], ['onsdag', 'Wednesday'], ['torsdag', 'Thursday'], ['fredag', 'Friday'], ['lördag', 'Saturday'], ['söndag', 'Sunday'],
    ['mån', 'Mon'], ['tis', 'Tue'], ['ons', 'Wed'], ['tors', 'Thu'], ['tor', 'Thu'], ['fre', 'Fri'], ['lör', 'Sat'], ['sön', 'Sun'],
    ['januari', 'January'], ['februari', 'February'], ['mars', 'March'], ['april', 'April'], ['maj', 'May'], ['juni', 'June'], ['juli', 'July'],
    ['augusti', 'August'], ['september', 'September'], ['oktober', 'October'], ['november', 'November'], ['december', 'December'],
    ['jan', 'Jan'], ['feb', 'Feb'], ['mar', 'Mar'], ['apr', 'Apr'], ['jun', 'Jun'], ['jul', 'Jul'], ['aug', 'Aug'], ['sep', 'Sep'], ['sept', 'Sep'], ['okt', 'Oct'], ['nov', 'Nov'], ['dec', 'Dec'], ['idag', 'today'], ['igår', 'yesterday'], ['imorgon', 'tomorrow'], ['vecka', 'week'], ['v.', 'wk']];
  const cap = (a, b) => (a[0] === a[0].toUpperCase() && a[0] !== a[0].toLowerCase() ? b[0].toUpperCase() + b.slice(1) : b);
  const wordRe = new RegExp('(^|[^\\p{L}])(' + WORDS.map((w) => w[0].replace('.', '\\.')).join('|') + ')(?=$|[^\\p{L}])', 'giu');
  const wordMap = new Map(WORDS.map(([s, e]) => [s, e]));
  function tr(s) {
    if (lang() !== 'en' || typeof s !== 'string' || !s.trim()) return s;
    const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
    const core = m[2];
    let out = map.get(core);
    if (out == null) {
      for (const [re, rep] of pats.concat(late)) {   // appens mönster först, de gemensamma (late) sist
        const g = re.exec(core);
        if (g) { const r = typeof rep === 'function' ? rep(g, tr) : rep.replace(/\$(\d)/g, (_, i) => tr(g[i] ?? '')); if (r != null) { out = r; break; } }
      }
    }
    if (out == null) {
      wordRe.lastIndex = 0;
      let rest = core;
      const w = core.replace(wordRe, (all, pre, word) => pre + cap(word, wordMap.get(word.toLowerCase()) || word));
      rest = core.replace(wordRe, '$1');
      if (w !== core && !/\p{L}{3,}/u.test(rest)) out = w;   // bara datumord kvar → ok; annars hellre hela texten på svenska
      else if (SV.test(core)) missing.add(core);
    }
    return out == null ? s : m[1] + out + m[3];
  }
  const ATTRS = ['placeholder', 'aria-label', 'title', 'alt'];
  const skip = (n) => {
    for (let e = n.nodeType === 1 ? n : n.parentElement; e; e = e.parentElement) {
      if (e.hasAttribute('data-no-tr') || e.tagName === 'TEXTAREA' || e.tagName === 'SCRIPT' || e.tagName === 'STYLE' || e.isContentEditable) return true;
    }
    return false;
  };
  function doText(t) { if (skip(t)) return; const v = tr(t.data); if (v !== t.data) t.data = v; }
  function doEl(e) {
    if (skip(e)) return;
    for (const a of ATTRS) { const v = e.getAttribute(a); if (v) { const x = tr(v); if (x !== v) e.setAttribute(a, x); } }
    if (e.tagName === 'INPUT' && (e.type === 'button' || e.type === 'submit') && e.value) { const x = tr(e.value); if (x !== e.value) e.value = x; }
    if (e.tagName === 'TEMPLATE' && !/^help/.test(e.id)) walk(e.content);   // Hjälp har en egen engelsk mall
  }
  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType === 1) doEl(root);
    const it = document.createTreeWalker(root, 5);   // SHOW_ELEMENT | SHOW_TEXT
    for (let n = it.nextNode(); n; n = it.nextNode()) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }
  let started = false;
  function start() {
    document.documentElement.lang = lang();
    if (started || lang() !== 'en') return;
    started = true;
    document.title = tr(document.title);
    walk(document.documentElement);
    new MutationObserver((list) => {
      for (const r of list) {
        if (r.type === 'characterData') doText(r.target);
        else if (r.type === 'attributes') doEl(r.target);
        else r.addedNodes.forEach(walk);
      }
    }).observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS.concat('value') });
  }
  function setLang(l, reload = true) {
    if (!(l in LANGS)) return;
    const was = lang();
    try { localStorage.setItem(KEY, l); } catch { /* blocked */ }
    if (reload && l !== was) location.reload(); else document.documentElement.lang = l;
  }
  // Liten fristående ruta för appar utan välkomstruta. onDone körs när ett språk är valt (direkt om det redan är valt).
  function ask(onDone) {
    if (chosen() || typeof HTMLDialogElement !== 'function') { if (onDone) onDone(); return; }
    const d = document.createElement('dialog');
    d.className = 'lang-dialog'; d.setAttribute('aria-label', 'Language / Språk');
    const h = document.createElement('h2'); h.textContent = 'Language / Språk'; h.setAttribute('data-no-tr', '');
    const row = document.createElement('div'); row.className = 'lang-row';
    for (const [k, name] of Object.entries(LANGS)) {
      const b = document.createElement('button'); b.type = 'button'; b.lang = k; b.textContent = name; b.setAttribute('data-no-tr', '');
      if (k === guess()) b.className = 'on';
      b.addEventListener('click', () => { const re = k !== lang(); try { localStorage.setItem(KEY, k); } catch { /* blocked */ } d.close(); d.remove(); if (re) location.reload(); else if (onDone) onDone(); });
      row.append(b);
    }
    d.addEventListener('cancel', (e) => e.preventDefault());
    d.append(h, row); document.body.append(d); d.showModal();
  }
  const enVals = new Set();
  const add = (dict, patterns, isLate) => {
    for (const [k, v] of Object.entries(dict || {})) { map.set(k, v); enVals.add(v); }
    for (const p of patterns || []) (isLate ? late : pats).push(p);
  };

  // Gemensamma texter: backup.js, lösenordsrutan och kortet Data (samma i alla appar).
  add({
    'Backup.encrypt: kryptering saknas': 'Backup.encrypt: encryption unavailable',
    'Den här webbläsaren kan inte öppna krypterade filer.': 'This browser cannot open encrypted files.',
    'Fel lösenord eller skadad fil.': 'Wrong password or damaged file.',
    'Filen krypteras med ett lösenord som du väljer.': 'The file is encrypted with a password you choose.',
    'Filen är för stor för en backup.': 'The file is too large for a backup.',
    'Filen är ingen textfil (fel teckenkodning).': 'The file is not a text file (wrong encoding).',
    'Filen är krypterad. Skriv lösenordet du valde när du sparade den.': 'The file is encrypted. Enter the password you chose when you saved it.',
    'Filen är tom.': 'The file is empty.',
    'Glömmer du lösenordet går backupen inte att öppna. Spara det t.ex. i en lösenordshanterare.': 'If you forget the password the backup cannot be opened. Keep it in a password manager, for example.',
    'Ingen fil vald.': 'No file selected.',
    'Kopierat. Lösenordet ligger kvar i urklipp – klistra in det i en lösenordshanterare och töm sedan urklipp.': 'Copied. The password stays on the clipboard – paste it into a password manager, then clear the clipboard.',
    'Krypterad backup': 'Encrypted backup',
    'Kunde inte kryptera filen.': 'Could not encrypt the file.',
    'Lösenorden är inte lika.': 'The passwords do not match.',
    'Lösenordet måste ha både stor och liten bokstav.': 'The password needs both upper and lower case letters.',
    'Lösenordet måste ha en siffra.': 'The password needs a digit.',
    'Lösenordet måste ha ett specialtecken, t.ex. ! ? # %.': 'The password needs a special character, e.g. ! ? # %.',
    'Lösenordet måste ha minst 16 tecken.': 'The password needs at least 16 characters.',
    'Markera och kopiera lösenordet': 'Select and copy the password',
    'Skriv lösenordet.': 'Enter the password.',
    'Skriv upp lösenordet. Utan det går backupen inte att läsa in.': 'Write the password down. Without it the backup cannot be restored.',
    'Spara backup-fil': 'Save backup file',
    'Spara krypterad': 'Save encrypted',
    'Öppna': 'Open',
    'Öppnar …': 'Opening …',
    'Lösenord': 'Password',
    'Upprepa lösenord': 'Repeat password',
    'Visa lösenord': 'Show password',
    'Skapa slumpmässigt lösenord': 'Create random password',
    'Minst 16 tecken med stor och liten bokstav, siffra och specialtecken. Välj inte ett vanligt ord + årtal.': 'At least 16 characters with upper and lower case, a digit and a special character. Do not pick a common word + year.',
    'Ersätta all data?': 'Replace all data?',
    'All nuvarande data i appen ersätts. Du kan ångra direkt efteråt.': 'All current data in the app is replaced. You can undo right afterwards.',
    'Ersätt': 'Replace',
    'Dags för backup?': 'Time for a backup?',
    'Spara backup': 'Save backup',
    'Avbryt': 'Cancel',
    'Radera': 'Delete',
    'Radera all data': 'Delete all data',
    'Radera all data?': 'Delete all data?',
    'Ångra': 'Undo',
    'Stäng': 'Close',
    'Spara': 'Save',
    'Senare': 'Later',
    'Inte nu': 'Not now',
    'Ta bort': 'Remove', 'Ta bort?': 'Remove?', 'Ta bort dem': 'Remove them', 'Kopiera': 'Copy', 'Appversion': 'App version', 'Vyer': 'Views',
    'Ändra': 'Edit',
    'Klar': 'Done',
    'OK': 'OK',
    'Ja': 'Yes',
    'Nej': 'No',
    'Visa': 'Show',
    'Dölj': 'Hide',
    'Byt': 'Change',
    'Hjälp': 'Help',
    'Hjälp och manual': 'Help and manual',
    'Inställningar': 'Settings',
    'Allmänt': 'General',
    'Data': 'Data',
    'Språk': 'Language',
    'Ny version finns': 'New version available',
    'Uppdatera': 'Update',
    'Läs in backup-fil': 'Restore backup file',
    'Påminn om backup': 'Backup reminder',
    'Varje vecka': 'Every week',
    'Varje månad': 'Every month',
    'Aldrig': 'Never',
    'Ingen backup sparad än': 'No backup saved yet',
    'Bra idé att göra en nu.': 'Good idea to make one now.',
    'Mer än en månad sedan – bra idé att göra en ny.': 'More than a month ago – good idea to make a new one.',
    'Ett sparfönster är redan öppet': 'A save window is already open',
    'Ingen fil sparades': 'No file was saved',
    'Kunde inte spara filen': 'Could not save the file',
    'Den här webbläsaren kan inte kryptera – ingen fil sparades': 'This browser cannot encrypt – no file was saved',
    'Kunde inte spara lösenordet': 'Could not save the password',
    'Lösenordet sparas på den här enheten. Ha det kvar i din lösenordshanterare också.': 'The password is stored on this device. Keep it in your password manager too.',
    'Backup sparad. Lösenordet är sparat på enheten – nästa gång räcker ett tryck.': 'Backup saved. The password is stored on the device – next time one tap is enough.',
    'Backup sparad': 'Backup saved',
    'Du har inte sparat någon backup än. Spara en så att du inte tappar din data.': 'You have not saved a backup yet. Save one so you do not lose your data.',
    'Kunde inte läsa filen.': 'Could not read the file.',
    'Välj lösenord': 'Choose password',
    'Lösenordet krypterar dina backup-filer och sparas på den här enheten.': 'The password encrypts your backup files and is stored on this device.',
    'Spara lösenord': 'Save password',
    'Lösenordet är sparat. Backup sparas med ett tryck.': 'The password is saved. Backups now take one tap.',
    'Backupen låstes upp med det sparade lösenordet.': 'The backup was unlocked with the saved password.',
    'Det sparade lösenordet passade inte till den här filen. Skriv lösenordet du valde när du sparade den.': 'The saved password did not fit this file. Enter the password you chose when you saved it.',
    'Använd ett nytt lösenord som du inte har någon annanstans – det sparas på den här enheten.': 'Use a new password you do not use anywhere else – it is stored on this device.',
    'Kunde inte spara – lagringen är full eller blockerad. Inget ändrades.': 'Could not save – storage is full or blocked. Nothing changed.',
    'All data är raderad': 'All data deleted',
    'Data importerad': 'Data imported',
    'Kom ihåg backup-lösenordet på den här enheten': 'Remember the backup password on this device',
    'Appen frågar efter lösenordet varje gång.': 'The app asks for the password every time.',
    'Lösenordet du skriver vid nästa backup sparas – sedan räcker ett tryck. Filen är lika skyddad som förut.': 'The password you enter at the next backup is saved – after that one tap is enough. The file is just as protected as before.',
    '🔑 Lösenordet är sparat': '🔑 The password is saved',
    'Backup sparas med ett tryck. Ha lösenordet kvar i din lösenordshanterare – utan det går backupen inte att öppna på en ny telefon.': 'Backups take one tap. Keep the password in your password manager – without it the backup cannot be opened on a new phone.',
    'Klistra in innehållet i en backup-fil': 'Paste the contents of a backup file',
    'Klistra in text': 'Paste text', 'Importera': 'Import', 'Backup, import, radera': 'Backup, import, delete', 'Utseende': 'Appearance', 'Installera appen': 'Install the app',
    'Offline – allt fungerar ändå, data finns på enheten.': 'Offline – everything still works, the data is on the device.',
    'Välkommen!': 'Welcome!',
    'Jag har en backup-fil': 'I have a backup file',
    'Jag har en backup-fil att importera': 'I have a backup file to import',
    'Vi samlar ingen data. Allt stannar på din enhet – lösenordet är bara en nyckel som skyddar dina backuper.': 'We collect no data. Everything stays on your device – the password is just a key that protects your backups.',
    'Välj ett lösenord som skyddar dina backup-filer. Spara det i din lösenordshanterare – utan det går en backup inte att läsa in.': 'Choose a password that protects your backup files. Keep it in your password manager – without it a backup cannot be restored.',
    'Allt stannar på din enhet. Använd ett nytt lösenord – det sparas här.': 'Everything stays on your device. Use a new password – it is stored here.',
  }, [
    [/^\+ (.+)$/, '+ $1'],
    [/^(.+?) · (.+)$/, (g, tr) => { const a = tr(g[1]), b = tr(g[2]); return a === g[1] && b === g[2] ? null : a + ' · ' + b; }],
    [/^([^\d]+?) (\d+)$/, (g, tr) => { const a = tr(g[1]); return a === g[1] ? null : a + ' ' + g[2]; }],
    [/^([↕↑↓←→] )?(.+?)( [↑↓])?$/, (g, tr) => { if (!g[1] && !g[3]) return null; const a = tr(g[2]); return a === g[2] ? null : (g[1] || '') + a + (g[3] || ''); }],
    [/^(\p{Extended_Pictographic}\uFE0F?\s+)(.+)$/u, (g, tr) => { const x = tr(g[2]); return x === g[2] ? null : g[1] + x; }],
    [/^(Ta bort|Dölj|Visa|Flytta upp|Flytta ner|Ändra|Byt namn på|Återställ) (.+)$/, (g, tr) => ({ 'Ta bort': 'Remove', 'Dölj': 'Hide', 'Visa': 'Show', 'Flytta upp': 'Move up', 'Flytta ner': 'Move down', 'Ändra': 'Edit', 'Byt namn på': 'Rename', 'Återställ': 'Reset' })[g[1]] + ' ' + tr(g[2])],
    [/^([^,]+(?:, [^,]+)+)$/, (g, tr) => { const p = g[1].split(', ').map((x) => tr(x)); return p.some((x) => /[åäöÅÄÖ]/.test(x)) ? null : p.join(', '); }],
    [/^Lösenordet får ha högst (\d+) tecken\.$/, 'The password may have at most $1 characters.'],
    [/^Senaste backup: (.+)\. Spara en ny så att du inte tappar din data\.$/, 'Last backup: $1. Save a new one so you do not lose your data.'],
    [/^Senaste backup: (.+)$/, 'Last backup: $1'],
  ], true);
  self.I18N = { LANGS, lang, chosen, guess, setLang, tr, add, start, ask, missing, setKey: (k, d) => { KEY = k; if (d in LANGS) def = d; document.documentElement.lang = lang(); }, known: (x) => map.has(x) || enVals.has(x), locale: () => (lang() === 'en' ? 'en-GB' : 'sv-SE') };
  document.documentElement.lang = lang();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
