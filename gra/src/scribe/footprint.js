// An element's footprint on the floor as a turned rectangle (task 012): from ELEMENTS' outline (and outlineX/outlineZ),
// the element's place and turn, a blade's turn about its axis and a foot's slide into the wall. Used by SCRIBE for the
// lines of fire, the "lift doors" and the navigation's obstacles.

// spec: the element's entry in ARENA_SECTION; E: its ELEMENTS entry; rot: a blade's turn (degrees); slide: m back
// into the wall. Returns { x, z (centre), hx, hz (half sizes), angle (as rotation.y) }
export function footprint(spec, E, rot = 0, slide = 0) {
  const [w, d] = E.outline, ox = E.outlineX || 0, oz = (E.outlineZ || 0) - slide;
  const angle = spec.rotY + rot * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
  return { x: spec.x + c * ox + s * oz, z: spec.z - s * ox + c * oz, hx: w / 2, hz: d / 2, angle };
}

// the same from a box in the element's own frame (its solid parts: { ox, oz, hx, hz }), for the navigation: a leaning
// slab's top reaches beyond its footprint on the floor
export function boxFootprint(spec, box, rot = 0, slide = 0) {
  const angle = spec.rotY + rot * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle), oz = box.oz - slide;
  return { x: spec.x + c * box.ox + s * oz, z: spec.z - s * box.ox + c * oz, hx: box.hx, hz: box.hz, angle };
}

// distance from the point (x, z) to the rectangle (0 inside)
export function distance(f, x, z) {
  const c = Math.cos(f.angle), s = Math.sin(f.angle), rx = x - f.x, rz = z - f.z;
  const lx = c * rx - s * rz, lz = s * rx + c * rz;
  return Math.hypot(Math.max(Math.abs(lx) - f.hx, 0), Math.max(Math.abs(lz) - f.hz, 0));
}

// does the rectangle come within `width` of the segment a–b ({x, z})? Sampled every `step` m
export function nearSegment(f, a, b, width, step = 0.15) {
  const len = Math.hypot(b.x - a.x, b.z - a.z), reach = Math.hypot(f.hx, f.hz) + width;
  // quick rejection: the segment's distance to the rectangle's centre
  const t0 = Math.max(0, Math.min(1, ((f.x - a.x) * (b.x - a.x) + (f.z - a.z) * (b.z - a.z)) / (len * len || 1)));
  if (Math.hypot(a.x + (b.x - a.x) * t0 - f.x, a.z + (b.z - a.z) * t0 - f.z) > reach) return false;
  const n = Math.max(2, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (distance(f, a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t) <= width) return true;
  }
  return false;
}
