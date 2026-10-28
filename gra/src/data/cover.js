// Cover as in The Division (task 005). Values are provisional, to be tuned after Paweł plays.
// Distances in metres, times in seconds.

export const COVER = {
  minLength: 0.5,     // shorter sides of an element's footprint are not cover
  // obstacles this high or lower (the 0.9 m sills) are for vaulting only, not cover: they do not hide a crouching
  // character (Paweł, 27.09.2026: OWNER_CORRECTED in task 005; the low cover code went in task 007)
  lowMax: 1.2,
  // task 015: cover up to this high is low cover (the wedge, 1.3 m): the character is crouched behind it, LT rises over
  // its edge, blind fire goes over it
  lowCoverMax: 1.5,
  // task 015: the cover's target in a cone round the crosshair, degrees (one ray missed narrow faces: "loteryjne")
  targetCone: 12,
  reach: 12,          // the camera ray finds cover this far
  snap: 2.0,          // without a ray hit: nearest cover this close in front of the character
  snapAngle: 60,      // ... within this angle of the camera's direction, degrees
  dashSpeed: 5.5,     // run to cover
  wayCorner: 0.35,    // task 015: the run goes round obstacles along the navigation mesh; a corner of the way counts as reached this close
  stallTime: 0.6,     // the run stops when the character has not advanced for this long (task 015: 0.2 → 0.6, a brush does not stop it)
  gap: 0.05,          // between the capsule and the cover's face
  slideSpeed: 2.5,    // along the cover (task 015: 1.1 → 2.5; the sneak animations play faster, HERO.coverTempo)
  slideMin: 0.25,     // stick push that starts sliding
  // task 015: the stick slides as the cover is seen on the screen: left/right while the wall runs across the view
  // (|the view's right · the wall| at least this), else forward/back
  slideAcross: 0.35,
  // task 015: a corner is an end of a cover line that nothing continues (a face going on within cornerGap m past it)
  cornerGap: 0.3,
  // task 015: LT in cover walks to a corner this close (m, from where the character stands to the cover's end) and
  // leans out of it; blind fire goes round a corner only this close (else over the top)
  autoPeekReach: 1.6,
  cornerZone: 1.0,
  cornerSpeed: 3.0,   // the walk to the corner and back, m/s
  // round a corner of the same element (Paweł 29.09.2026, task 016): the stick still pushing at a corner this long goes
  // round it onto the element's next side at roundSpeed m/s; the sides' ends meet within roundGap m
  roundHold: 0.2, roundSpeed: 2.5, roundGap: 0.15,
  roundBack: 1.0,     // s after a way round that was held up before it tries again (the stick still pushing)
  // the lean out of a corner: the body's axis this far past the edge (m); leaning to the view's left the rifle (in the
  // right hands) is on the inner side: further (task 009, task 015 measured with probe peek15.mjs)
  peekOut: { right: 0.25, left: 0.45 },
  // blind fire (task 015; Paweł 29.09.2026: "Z tego, co jest": a small lean, the rifle as for hip fire): the axis stays
  // this far behind the edge (negative), the shots start `past` m past the corner's edge, `off` m out from the face,
  // `height` m up; over low or high cover `over` m above its top. Spread: half-angle, degrees
  blindOut: -0.1,
  blind: { past: 0.25, off: 0.3, height: 1.35, over: 0.15 },
  blindSpread: 6,
  blindAway: 0.1,     // over a cover blind fire flies at least this much away from it (share of the direction)
  leaveHold: 0.25,    // stick pulled away from the wall this long = leave cover
  stickAway: 0.5,     // stick component (away from the wall, towards it, back from the run) that counts
  vaultDepth: 0.7,    // thickest low cover that can be vaulted
  vaultReach: 1.0,    // A vaults a low obstacle when the character's axis is this close to it and the stick points at it
  vaultLand: 0.6,     // free room needed behind it; the landing point is this far beyond the far face
  vaultTime: 0.9,
  // slice of the vault clip (jumping) from the push-off to the end of the landing, measured from the hips and the
  // feet (task 007 report)
  vaultClip: [0.2, 1.0],
  // entering cover: fast as in The Division (Paweł, 27.09.2026: OWNER_ACCEPTED in task 005); slice of the entry clip
  // with the approach and the turn, measured from the hips
  enterTime: 0.4,
  enterClip: [0.4, 1.4],
  // target marker on the floor at the cover, in the arena's script light like the element outlines
  // task 015: dimmed (dim) on a cover SCRIBE has just announced: A does not take it (the lift's closing doors)
  marker: { length: 0.6, line: 0.05, height: 0.01, glow: 1.5, dim: 0.25, offset: 0.08 },
};
