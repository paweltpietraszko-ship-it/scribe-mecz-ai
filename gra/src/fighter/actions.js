// The actions of a fighter (task 009): everything a character can do in one frame, the same for the player and the
// bot. No field depends on the camera, the mouse or the pad: the player's controller (fighter/player.js) turns the
// input and the camera into these, the bot (bot/) sends them itself. Gestures (B twice = dodge, B held = crouch) are
// already resolved: `dodge` and `crouch` are one-frame commands.
//
// move:        { x, y } the wished movement relative to the view's yaw: x to the right, y forward, length ≤ 1
// yaw, pitch:  where the fighter looks, angles in the world (yaw 0 faces −Z, pitch positive looks up)
// aimAt:       the world point the rifle is pointed at ({ x, y, z } | null); shots fly from the muzzle towards it
// aimZone:     for test logs only: the hit zone under the player's crosshair (null: the arena)
// coverTarget: { line (index in the fighter's cover lines), along (m from its end a) } | null: the cover A would go to
// aim, shoot, sprint:      held (LT, RT, the sprint on)
// blind:       held: fire blind from cover, from behind it (task 015; the player: RT without LT in cover)
// rise:        held: stand up over low cover to aim (task 015; the player: LT at low cover)
// sprintClick: the sprint was switched on this frame (it also leaves cover)
// crouch, dodge, cover, medkit, reload: this frame's commands (crouch toggles; cover is A: run to cover / vault)
// grenade, key: held (task 017: an item's preview while held, used when let go; data/items.js); cancel: this frame's
// command dropping the item held; itemAt: the world point the item is aimed at ({ x, y, z } | null)
export function idleAction(yaw = 0, pitch = 0) {
  return {
    move: { x: 0, y: 0 }, yaw, pitch, aimAt: null, aimZone: null, coverTarget: null,
    aim: false, shoot: false, blind: false, rise: false, sprint: false, sprintClick: false,
    crouch: false, dodge: false, cover: false, medkit: false, reload: false,
    grenade: false, key: false, cancel: false, itemAt: null,
  };
}
