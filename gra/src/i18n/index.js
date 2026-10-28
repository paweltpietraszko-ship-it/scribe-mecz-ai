// Text lookup. Language: ?lang=pl|en in the address, else the one chosen last time, else English
// (task 032: English on first start whatever the browser's language, DECISIONS 07.10).
import { STRINGS } from './strings.js';

const FALLBACK = 'en';
const KEY = 'theone.lang';

// (task 027: the fight's log also runs without a page, on the server: no address, no storage)
function initialLang() {
  if (typeof location === 'undefined') return FALLBACK;
  const q = new URLSearchParams(location.search).get('lang');
  if (q && STRINGS[q]) return q;
  try { const s = localStorage.getItem(KEY); if (s && STRINGS[s]) return s; } catch { /* storage blocked */ }
  return FALLBACK;
}

let lang = initialLang();

export const getLang = () => lang;

export function setLang(l) {
  lang = STRINGS[l] ? l : FALLBACK;
  try { localStorage.setItem(KEY, lang); } catch { /* storage blocked */ }
  document.documentElement.lang = lang;
}

// task 032 (E2): a number with `digits` decimals as the language writes it (Polish: a decimal comma, 40,0)
export const num = (v, digits = 1) => v.toLocaleString(lang, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export function t(key, vars) {
  let s = STRINGS[lang][key] ?? STRINGS[FALLBACK][key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? (typeof vars[k] === 'number' ? vars[k].toLocaleString(lang) : vars[k]) : m));
  return s;
}

// Fill every element marked data-i18n (text) or data-i18n-aria (aria-label)
export function applyTexts(root = document, vars) {
  root.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n, vars); });
  root.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria, vars)); });
  document.title = t('title');
}

if (typeof document !== 'undefined') document.documentElement.lang = lang;
