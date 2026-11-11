// Backup as a text file (U5, see ../.claude/agents/granskning.md). Classic script: sets self.Backup.
// Identical copy in every U5 project – the original is template/backup.js, spread with tools/sync-shared.ps1.
// Do not edit a project's copy; check.ps1 compares the hash. No network, no dependencies.
// The file holds exactly the app's export text, so it can always be opened, copied and pasted into the text import.
(() => {
  'use strict';
  const NAME_RE = /^[a-z0-9-]{1,40}$/;
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

  // File name only from a fixed app slug and the date – never from data or input.
  function fileName(slug, today) {
    if (!NAME_RE.test(slug) || !DAY_RE.test(today)) throw new Error('Backup.fileName: ogiltigt namn');
    return `${slug}-${today}.txt`;
  }

  // Inside a claude.ai artifact the host saves the file (the viewer confirms); elsewhere window.claude is missing.
  // window.claude is untrusted: only its presence and the save outcome are used.
  let hostDl = null;
  function host() {
    if (!hostDl) {
      hostDl = typeof self.claude?.use === 'function'
        ? Promise.resolve().then(() => self.claude.use('downloads')).then((d) => (d && typeof d.save === 'function' ? d : null), () => null)
        : Promise.resolve(null);
    }
    return hostDl;
  }
  host();   // resolve early: use() never prompts, the confirmation comes with save()

  function blobSave(name, text) {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;   // check:ok blob URL of the app's own export text (U5), never data or input
    a.download = name;
    a.hidden = true;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);   // at once can cancel the download in Safari
  }

  // → 'saved' (host saved it) | 'declined' (viewer said no) | 'busy' (a prompt is already open)
  //   | 'fallback' (browser download started) | 'error'
  async function save({ slug, today, text }) {
    if (typeof text !== 'string' || !text) return 'error';
    const name = fileName(slug, today);
    const dl = await host();
    if (dl) {
      try { await dl.save({ filename: name, data: text }); return 'saved'; } catch (e) {
        const code = e && e.code;
        if (code === 'declined') return 'declined';
        if (code === 'rate_limited') return 'busy';
        // unavailable, not_granted and the rest: try the ordinary download
      }
    }
    try { blobSave(name, text); return 'fallback'; } catch { return 'error'; }
  }

  // Reads one chosen file as strict UTF-8 text. → { text } | { error }. Name and MIME type are ignored.
  async function read(file, maxChars) {
    if (!file || typeof file.size !== 'number' || typeof file.arrayBuffer !== 'function') return { error: 'Ingen fil vald.' };
    if (file.size === 0) return { error: 'Filen är tom.' };
    if (file.size > maxChars * 4) return { error: 'Filen är för stor för en backup.' };   // before reading: 4 bytes per char at most
    let text;
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); } catch {
      return { error: 'Filen är ingen textfil (fel teckenkodning).' };
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    if (text.length > maxChars) return { error: 'Filen är för stor för en backup.' };
    if (!text.trim()) return { error: 'Filen är tom.' };
    return { text };
  }

  // ---------- Password encryption of the backup file (U5, extended 2026-11-11) ----------
  // Only built-in crypto.subtle: AES-GCM 256, PBKDF2-SHA256, new salt and IV per export, AAD app|format|iter.
  // The key is non-extractable. The password is never stored or logged; the dialog fields are cleared on close.
  const ITER = 600000, ITER_MIN = 100000, ITER_MAX = 2000000, KDF = 'PBKDF2-SHA256';
  const ENV_KEYS = ['app', 'data', 'encrypted', 'format', 'iter', 'iv', 'kdf', 'salt'];
  const B64_RE = /^[A-Za-z0-9+/]*={0,2}$/;
  const DATA_MAX = 11000000;   // base64 chars: above the 8 MB file limit, so never the limit that bites
  const PWD_MAX = 200;
  const BAD = 'Fel lösenord eller skadad fil.';

  // '' = ok, otherwise the reason. Export rule (the user's choice): 8+ chars, lower and upper case letter, digit, special char.
  function checkPassword(pwd) {
    if (typeof pwd !== 'string' || pwd.length < 8) return 'Lösenordet måste ha minst 8 tecken.';
    if (pwd.length > PWD_MAX) return `Lösenordet får ha högst ${PWD_MAX} tecken.`;
    if (!/\p{Ll}/u.test(pwd) || !/\p{Lu}/u.test(pwd)) return 'Lösenordet måste ha både stor och liten bokstav.';
    if (!/\p{N}/u.test(pwd)) return 'Lösenordet måste ha en siffra.';
    if (!/[^\p{L}\p{N}\s]/u.test(pwd)) return 'Lösenordet måste ha ett specialtecken, t.ex. ! ? # %.';
    return '';
  }
  const hasCrypto = () => !!(self.crypto && self.crypto.subtle && typeof self.crypto.getRandomValues === 'function');

  function toB64(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(s, max) {
    if (typeof s !== 'string' || s.length > max || s.length % 4 || !B64_RE.test(s)) return null;
    try {
      const bin = atob(s), out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    } catch { return null; }
  }
  async function deriveKey(pwd, salt, iter) {
    const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pwd), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  const aad = (app, iter) => new TextEncoder().encode(`${app}|1|${iter}`);

  // Is this text an encryption envelope? Cheap check before JSON.parse in the app's own import.
  function isEncrypted(text) {
    if (typeof text !== 'string' || !/^\s*\{/.test(text) || !/"encrypted"\s*:\s*true/.test(text)) return false;
    try { const o = JSON.parse(text); return !!o && typeof o === 'object' && o.encrypted === true; } catch { return false; }
  }

  // → envelope text. Throws if crypto is missing or the password breaks the rule.
  async function encrypt(text, pwd, slug) {
    if (!NAME_RE.test(slug) || typeof text !== 'string' || !text) throw new Error('Backup.encrypt: ogiltig indata');
    if (checkPassword(pwd)) throw new Error('Backup.encrypt: ogiltigt lösenord');
    if (!hasCrypto()) throw new Error('Backup.encrypt: kryptering saknas');
    const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(pwd, salt, ITER);
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: aad(slug, ITER) }, key, new TextEncoder().encode(text)));
    return JSON.stringify({ app: slug, format: 1, encrypted: true, kdf: KDF, iter: ITER, salt: toB64(salt), iv: toB64(iv), data: toB64(ct) });
  }

  // → { text } | { error }. One message for every failure: no oracle about what was wrong.
  async function decrypt(envText, pwd, slug, maxChars) {
    if (!hasCrypto()) return { error: 'Den här webbläsaren kan inte öppna krypterade filer.' };
    if (typeof pwd !== 'string' || !pwd.length || pwd.length > PWD_MAX || typeof envText !== 'string' || envText.length > DATA_MAX + 1000) return { error: BAD };
    let o;
    try { o = JSON.parse(envText); } catch { return { error: BAD }; }
    if (!o || typeof o !== 'object' || Array.isArray(o) || Object.keys(o).sort().join() !== ENV_KEYS.join()) return { error: BAD };
    if (o.app !== slug || o.format !== 1 || o.encrypted !== true || o.kdf !== KDF) return { error: BAD };
    if (!Number.isInteger(o.iter) || o.iter < ITER_MIN || o.iter > ITER_MAX) return { error: BAD };
    const salt = fromB64(o.salt, 24), iv = fromB64(o.iv, 16), ct = fromB64(o.data, DATA_MAX);
    if (!salt || salt.length !== 16 || !iv || iv.length !== 12 || !ct || ct.length < 17) return { error: BAD };
    let text;
    try {
      const key = await deriveKey(pwd, salt, o.iter);
      const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv, additionalData: aad(o.app, o.iter) }, key, ct);
      text = new TextDecoder('utf-8', { fatal: true }).decode(pt);
    } catch { return { error: BAD }; }
    if (!text.trim() || text.length > maxChars) return { error: BAD };
    return { text };
  }

  // Password dialog: #pw-dialog lives in each app's index.html (the app's own classes, fixed ids).
  // mode 'export' → { pwd } | null (cancelled); mode 'import' → { pwd } | null. Encryption is mandatory (2026-11-11).
  // #pw-show shows the password as text; on every close (button, Esc, cancel) the fields are cleared and hidden again.
  function askPassword(mode) {
    const $ = (id) => document.getElementById(id);
    const dlg = $('pw-dialog');
    if (!dlg || typeof dlg.showModal !== 'function') return Promise.resolve(null);
    const exp = mode === 'export';
    const show = $('pw-show'), p1 = $('pw-1'), p2 = $('pw-2'), err = $('pw-error'), ok = $('pw-ok'), cancel = $('pw-cancel');
    $('pw-title').textContent = exp ? 'Spara backup-fil' : 'Krypterad backup';
    $('pw-text').textContent = exp ? 'Filen krypteras med ett lösenord som du väljer.' : 'Filen är krypterad. Skriv lösenordet du valde när du sparade den.';
    $('pw-2-row').hidden = !exp;
    $('pw-hint').hidden = !exp;
    $('pw-warn').textContent = exp ? 'Glömmer du lösenordet går backupen inte att öppna. Spara det t.ex. i en lösenordshanterare.' : '';
    ok.textContent = exp ? 'Spara krypterad' : 'Öppna';
    err.textContent = '';
    p1.autocomplete = exp ? 'new-password' : 'current-password';
    const fields = [p1, p2];
    const hide = () => { show.checked = false; for (const f of fields) f.type = 'password'; };
    const onShow = () => { for (const f of fields) f.type = show.checked ? 'text' : 'password'; };
    hide();
    return new Promise((resolve) => {
      let result = null;
      const onOk = () => {
        const pwd = p1.value;
        const bad = exp ? checkPassword(pwd) || (pwd !== p2.value ? 'Lösenorden är inte lika.' : '')
          : !pwd ? 'Skriv lösenordet.' : pwd.length > PWD_MAX ? BAD : '';
        if (bad) { err.textContent = bad; return; }
        result = { pwd }; dlg.close();
      };
      const onCancel = () => { result = null; dlg.close(); };
      const onKey = (e) => { if (e.key === 'Enter' &&(e.target === p1 || e.target === p2)) { e.preventDefault(); onOk(); } };
      const onClose = () => {
        p1.value = ''; p2.value = ''; err.textContent = ''; hide();
        ok.removeEventListener('click', onOk); cancel.removeEventListener('click', onCancel);
        show.removeEventListener('change', onShow); dlg.removeEventListener('keydown', onKey);
        resolve(result);
      };
      ok.addEventListener('click', onOk);
      cancel.addEventListener('click', onCancel);
      show.addEventListener('change', onShow);
      dlg.addEventListener('keydown', onKey);
      dlg.addEventListener('close', onClose, { once: true });
      p1.value = ''; p2.value = '';
      dlg.showModal();
      p1.focus();
    });
  }

  // Whole flows for the apps. saveWithPassword → same codes as save(), plus 'cancelled' and 'nocrypto'.
  // Never an unencrypted file: without crypto.subtle nothing is saved.
  async function saveWithPassword({ slug, today, text }) {
    if (!hasCrypto()) return 'nocrypto';
    const a = await askPassword('export');
    if (!a) return 'cancelled';
    let env;
    try { env = await encrypt(text, a.pwd, slug); } catch { return 'error'; }
    return save({ slug, today, text: env });
  }
  // Plain text → { text } as is; envelope → asks for the password → { text } | { error } | { cancelled: true }.
  async function openText(text, slug, maxChars) {
    if (!isEncrypted(text)) return { text };
    if (!hasCrypto()) return { error: 'Den här webbläsaren kan inte öppna krypterade filer.' };
    const a = await askPassword('import');
    if (!a) return { cancelled: true };
    return decrypt(text, a.pwd, slug, maxChars);
  }

  self.Backup = Object.freeze({ fileName, save, read, checkPassword, isEncrypted, encrypt, decrypt, askPassword, saveWithPassword, openText });
})();
