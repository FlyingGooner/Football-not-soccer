// Node version of tools/build-single.ps1 (2026-11-15): builds one self-contained HTML file of the app.
// Same rules as the PowerShell script: inlines stylesheets, scripts (ES modules bundled), icons and local images,
// drops the manifest, loosens the CSP only in the generated file. The PWA in the project root is never modified.
// Same file in every project (keep the copies identical).
//   node tools/build-single.mjs            -> dist/<project>.html
//   node tools/build-single.mjs --out X    -> X (e.g. the downloadable copy next to the app)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve, relative, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const attr = (tag, name) => { const m = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag); return m ? m[1] : null; };
const isLocal = (u) => !!u && !/^([a-z]+:|\/\/)/i.test(u);
const clean = (u) => u.split(/[?#]/)[0].replace(/^\.\//, '');
const protect = (code, tag) => code.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');
const MIME = { '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
function dataUri(rel) {
  const p = clean(rel), mime = MIME[extname(p).toLowerCase()];
  if (!mime) throw new Error('Unknown image type: ' + rel);
  return `data:${mime};base64,` + readFileSync(join(ROOT, p)).toString('base64');
}

// ---------- ES module bundling ----------
const importRe = /^[ \t]*import\s+(?:(\{[^}]*\})|\*\s+as\s+([\w$]+))\s+from\s+['"]([^'"]+)['"][ \t]*;?/gms;
const sideRe = /^[ \t]*import\s+['"]([^'"]+)['"][ \t]*;?/gm;
let modules, moduleOut;
function resolveSpec(fromRel, spec) {
  if (!/^\.{1,2}\//.test(spec)) throw new Error(`Only relative imports are supported: '${spec}' in ${fromRel}`);
  return relative(ROOT, resolve(dirname(join(ROOT, fromRel)), spec)).replace(/\\/g, '/');
}
function convertImports(rel, code) {
  code = code.replace(importRe, (_, names, star, spec) => {
    const dep = addModule(resolveSpec(rel, spec));
    return names ? `const ${names.replace(/([\w$]+)\s+as\s+([\w$]+)/g, '$1: $2')} = ${dep};` : `const ${star} = ${dep};`;
  });
  return code.replace(sideRe, (_, spec) => { addModule(resolveSpec(rel, spec)); return ''; });
}
function addModule(rel) {
  if (modules.has(rel)) return modules.get(rel);
  const name = '__mod_' + rel.replace(/[^A-Za-z0-9]/g, '_');
  modules.set(rel, name);
  let code = convertImports(rel, read(rel));
  if (/^\s*export\s+default\b/m.test(code)) throw new Error(`export default is not supported (${rel})`);
  const exps = [];
  for (const m of code.matchAll(/^export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([\w$]+)/gm)) exps.push(m[1]);
  for (const m of code.matchAll(/^export\s*\{([^}]*)\}/gm)) for (const part of m[1].split(',')) {
    const p = part.trim(); if (!p) continue;
    const a = /^([\w$]+)\s+as\s+([\w$]+)$/.exec(p); exps.push(a ? `${a[2]}: ${a[1]}` : p);
  }
  code = code.replace(/^export\s*\{[^}]*\}\s*;?/gm, '').replace(/^export\s+/gm, '');
  moduleOut.push(`// ---- ${rel} ----\nconst ${name} = (() => {\n'use strict';\n${code}\nreturn { ${exps.join(', ')} };\n})();`);
  return name;
}
function bundleEntry(rel) {
  modules = new Map([[rel, '__entry']]); moduleOut = [];
  const code = convertImports(rel, read(rel));
  return [...moduleOut, `// ---- ${rel} ----\n(() => {\n'use strict';\n${code}\n})();`].join('\n\n');
}

// ---------- CSP ----------
function patchCsp(csp) {
  const d = new Map();
  for (const part of csp.split(';')) { const t = part.trim(); if (!t) continue; const [n, ...v] = t.split(/\s+/); d.set(n.toLowerCase(), v.join(' ').trim()); }
  const def = d.get('default-src') || '';
  for (const [k, add] of [['script-src', "'unsafe-inline'"], ['style-src', "'unsafe-inline'"], ['img-src', 'data:']]) {
    let v = d.has(k) ? d.get(k) : def;
    if (v === "'none'") v = '';
    if (!v.includes(add)) v = `${v} ${add}`.trim();
    d.set(k, v);
  }
  d.delete('manifest-src'); d.delete('worker-src');
  return [...d].map(([k, v]) => `${k} ${v}`.trim()).join('; ');
}

// ---------- Build ----------
const project = basename(ROOT);
let version = '?';
try { const m = /APP_VERSION\s*=\s*['"]([^'"]+)/.exec(read('version.js')); if (m) version = m[1]; } catch { /* no version.js */ }
let html = read('index.html');
html = html.replace(/(<meta\s+http-equiv=["']Content-Security-Policy["']\s+content=")([^"]*)(")/i, (_, a, c, b) => a + patchCsp(c) + b);
html = html.replace(/[ \t]*<link\b[^>]*>\r?\n?/gi, (tag) => {
  const rel = (attr(tag, 'rel') || '').toLowerCase(), href = attr(tag, 'href'), indent = /^[ \t]*/.exec(tag)[0];
  if (rel === 'manifest') return '';
  if (!isLocal(href)) return tag;
  if (rel === 'stylesheet') return `${indent}<style>\n${protect(read(clean(href)), 'style')}\n${indent}</style>\n`;
  if (/\bicon\b/.test(rel)) return tag.replace(href, dataUri(href));
  return tag;
});
html = html.replace(/<img\b[^>]*>/gi, (tag) => { const src = attr(tag, 'src'); return isLocal(src) ? tag.replace(src, dataUri(src)) : tag; });
html = html.replace(/<script\b([^>]*)>\s*<\/script>/gis, (tag) => {
  const src = attr(tag, 'src');
  if (!isLocal(src)) return tag;
  const file = clean(src);
  const code = attr(tag, 'type') === 'module' ? bundleEntry(file) : read(file);
  return `<script>\n// ---- ${file} ----\n${protect(code, 'script')}\n</script>`;
});
html = html.replace(/^(<!doctype html>)/i, `$1\n<!-- ${project} v${version} as one file. Generated by tools/build-single.mjs - do not edit; change the source files and rebuild. -->`);

const oi = process.argv.indexOf('--out');
const out = oi > 0 ? resolve(process.argv[oi + 1]) : join(ROOT, 'dist', project + '.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html, 'utf8');
console.log(`Built ${out} (${Math.round(Buffer.byteLength(html) / 1024)} KB, v${version})`);
