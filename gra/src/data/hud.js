// The HUD of task 008, recreated from reference/hud_gracza.html (accepted by Paweł). Sizes are in cqw of the game
// window as in the reference (1 cqw = 1 % of the window's width, 19.2 px on a 1920 px screen) and live in style.css
// with the rest of the reference's look; here are the colours, times and the numbers the code needs.
// Values are provisional, to be tuned after Paweł plays.

export const HUD = {
  // the player's colour follows the script light chosen in the game; the foe's colour is its pair (DECISIONS.md
  // 28.09.2026). Tones as in the reference (Paweł, 28.09.2026: OWNER_ACCEPTED in task 008), keys as GLOW.colors
  colors: {
    ice: { me: [159, 230, 255], foe: [230, 214, 184] },
    amber: { me: [255, 198, 128], foe: [200, 232, 246] },
    blood: { me: [255, 122, 107], foe: [159, 230, 255] },
  },
  // with the bone material the texts get a stronger shadow (DECISIONS.md 28.09.2026)
  boneShadow: 1.8,

  calmAfter: 4,          // s without a shot, a hit (either way), aiming or healing: the HUD dims (reference: 38 %)
  lowHp: 25,             // below this the HP bar takes the pair's colour and pulses, the picture loses colour
  hpSegments: 4,         // HP in four parts of 25
  glyphs: { count: 14, seed: 101, step: 37 },   // the row of the machine's script over the HP bar (as in the reference)

  // cqw: the gap never closes further than the reference's aimed one. hitColor: the crosshair turns this colour for
  // the hit marker's time after a hit (Paweł 29.09.2026, task 016: "celne strzały barwiły celownik na czerwony jak w
  // The Division")
  // blockedColor: the X of a blocked shot (task 014, U33); Paweł 01.10.2026 (task 022): red "myli, skoro domyślnie
  // czerwony celownik to trafienie", so it is grey
  crosshair: { minGap: 0.55, hitColor: '#ff3b30', blockedColor: '#8e97a2' },
  hitMarker: { time: 0.35, headTime: 0.5 },       // s the marker shows after a hit (the reference's flash, once)
  foe: { time: 3, above: 0.3, chipHold: 0.6, chipFade: 0.4 },   // bar: s after a hit, m over the head; white chip of
                                                  // the last damage stays chipHold s, then shrinks in chipFade s
  hurt: { time: 1.6 },   // s the arc of incoming fire shows
  // arena move warning: an arrow at the screen's edge while a moving element is out of the picture
  arena: { margin: 0.05 },   // share of the screen at each edge still counted as "out of the picture"
};
