// Side panel: camera views, machine moves, material and light variants, language, hide/show.
import { CAMERA, GLOW, MATERIALS, DEFAULT_MATERIAL, STONE } from '../data/arena.js';
import { setMaterial, setGlowColor } from '../look/materials.js';
import { applyTexts, getLang, setLang, t } from '../i18n/index.js';
import { combatLog } from '../combat/log.js';
import { LOG } from '../data/combat.js';

const $ = id => document.getElementById(id);

function press(buttons, active) { buttons.forEach(b => b.setAttribute('aria-pressed', String(b === active))); }

// A row of toggle buttons; label keys are prefix + key; allowed(): may the player pick now (task 027, audit F3: the
// arena's look in PvP is the host's for both)
function choiceRow(container, keys, prefix, current, onPick, decorate, allowed = () => true) {
  const buttons = keys.map(k => {
    const b = document.createElement('button');
    b.dataset.key = k; b.setAttribute('aria-pressed', String(k === current));
    const label = document.createElement('span'); label.dataset.i18n = prefix + k;
    if (decorate) decorate(b, k);
    b.append(label);
    b.onclick = () => { if (!allowed()) return; onPick(k); press(buttons, b); };
    container.append(b);
    return b;
  });
  return buttons;
}

// onLight(key), onMaterial(key): the HUD follows the script light and the material (task 008)
// onFloor(key): task 020, the floor picked (STONE.choices)
export function createControls({ view, motion, texts, onLight = () => {}, onMaterial = () => {}, onFloor = () => {}, floor = null }) {
  choiceRow($('views'), view.views, 'view.', CAMERA.start, k => view.go(k));
  // task 027 (K5): the arena's look as it is now (the material, the script's light, the floor), and set at once
  const look = { material: DEFAULT_MATERIAL, light: GLOW.default, floor: floor ?? STONE.choice }, rows = {};
  let lookAllowed = () => true;   // (PvP: net/pvp.js says who may)
  const may = () => lookAllowed();
  const pickMaterial = k => { look.material = k; setMaterial(k); onMaterial(k); };
  const pickFloor = k => { look.floor = k; onFloor(k); };
  const pickLight = k => {
    look.light = k; setGlowColor(k); onLight(k);
    document.documentElement.style.setProperty('--accent', '#' + GLOW.colors[k].toString(16).padStart(6, '0'));
  };
  rows.material = choiceRow($('mats'), Object.keys(MATERIALS), 'mat.', DEFAULT_MATERIAL, pickMaterial, null, may);
  rows.floor = choiceRow($('floors'), STONE.choices, 'floor.', floor ?? STONE.choice, pickFloor, null, may);
  rows.light = choiceRow($('glows'), Object.keys(GLOW.colors), 'glow.', GLOW.default, pickLight, (b, k) => {
    const sw = document.createElement('span'); sw.className = 'sw'; sw.style.background = '#' + GLOW.colors[k].toString(16).padStart(6, '0'); b.append(sw);
  }, may);

  $('turnNow').onclick = () => motion.turnNow();
  $('lowerNow').onclick = () => motion.lowerPanel();
  const autoB = $('auto');
  autoB.onclick = () => { motion.setAuto(!motion.auto); autoB.setAttribute('aria-pressed', String(motion.auto)); };

  // side panel; in the Play view the "show" button is not shown either (Menu / Esc brings the panel back)
  const ui = $('ui'), tg = $('toggle');
  let quiet = false;
  const showPanel = on => { ui.hidden = !on; tg.hidden = on || quiet; };
  // task 014: the combat log's last lines, drawn only while the panel is open; the whole log to the clipboard
  const logEl = $('combatLog');
  setInterval(() => { if (!ui.hidden) logEl.textContent = combatLog.lines(LOG.panelLines).join('\n'); }, 500);
  $('copyLog').onclick = async () => {
    try { await navigator.clipboard.writeText(combatLog.text()); $('copyLog').textContent = t('log.copied'); } catch { /* no clipboard */ }
    setTimeout(() => { $('copyLog').textContent = t('log.copy'); }, 1500);
  };
  $('hide').onclick = () => { showPanel(false); if (!quiet) tg.focus(); };
  tg.onclick = () => showPanel(true);

  $('lang').onclick = () => { setLang(getLang() === 'pl' ? 'en' : 'pl'); applyTexts(document, texts); };
  applyTexts(document, texts);
  const picks = { material: [pickMaterial, MATERIALS], light: [pickLight, GLOW.colors], floor: [pickFloor, null] };
  return {
    showPanel,
    get look() { return { ...look }; },
    // fn(): may the player change the arena's look now (task 027, K5: in PvP only the host, before the match)
    lockLook(fn) { lookAllowed = fn; },
    // v: { material, light, floor } (a key off the lists is left as it is); onChange: the host's look goes to the server
    setLook(v) {
      for (const [k, [pick, list]] of Object.entries(picks)) {
        const key = v?.[k];
        if (!key || key === look[k] || (list ? !(key in list) : !STONE.choices.includes(key))) continue;
        pick(key); press(rows[k], rows[k].find(b => b.dataset.key === key));
      }
    },
    get panelVisible() { return !ui.hidden; },
    setQuiet(v) { quiet = v; tg.hidden = !ui.hidden || quiet; },
  };
}
