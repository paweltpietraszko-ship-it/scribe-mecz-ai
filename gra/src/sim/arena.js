// Task 027 (K2): the arena section put together the same way in the page and in Node (the server, the replays): the
// wall of panels, the turntable, the elements and the boundary, as meshes in `scene` (the physics and the navigation are
// made from them), and the arena's clock of moves. The engraved textures stay empty until drawing asks for them
// (look/textures.js), so nothing here needs a page. gallery: the preview of the elements (the page's Elements view):
// made between the turntable and the elements, as before (its elements take the first textures of the pool).
import { PLAYER } from '../data/arena.js';
import { buildPanelWall } from '../arena/panel.js';
import { buildTurntable } from '../arena/turntable.js';
import { buildSectionElements, buildBoundary } from '../arena/section.js';
import { buildGallery } from '../arena/gallery.js';
import { createMotion } from '../arena/motion.js';

export function buildArena(scene, { gallery: withGallery = false } = {}) {
  const wall = buildPanelWall(scene);
  const turntable = buildTurntable(scene);
  const gallery = withGallery ? buildGallery(scene) : null;   // a preview scene of its own (U3)
  const elements = buildSectionElements(scene), boundary = buildBoundary(scene).pieces;
  // "lift doors": the turntable waits while an arm would enter a character standing next to it (either fighter; task
  // 024: made before them, they join `standing` when they are made; the physics comes later: sim/engine.js)
  const arena = { wall, turntable, gallery, elements, boundary, standing: [], physics: null };
  const clear = PLAYER.radius + PLAYER.skin / 2;
  arena.motion = createMotion({
    canTurnTo: angle => arena.standing.every(f => !f.alive || f.character.riding || !arena.physics.turntableBlocks(angle, f.feet, clear)),
    canRaisePanel: () => arena.standing.every(f => !f.alive || !arena.physics.panelBlocks(f.feet, clear)),
  });
  return arena;
}
