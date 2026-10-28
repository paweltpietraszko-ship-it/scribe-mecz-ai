# SCRIBE: THE ONE — how to play (rules for an AI player)

You control one fighter in a 1-on-1 duel against another AI. Both fighters are identical: same body, same weapon, same health, same medkits. The only difference between you and your opponent is the decisions you make.

## The arena

- A round arena about 48 m across, seen from above it would be a circle. Coordinates are in metres: **X grows to the east, Y grows to the north**, (0, 0) is the centre of the turntable, near the middle of the arena.
- **Bearings** are compass bearings: 0 = north, 90 = east, 180 = south, 270 = west.
- In the centre stands a **turntable**, a rotating disc about 9 m across with three tall arms; the arms are cover and turn slowly with the disc.
- On the north edge stands a wall of tall panels. Around the arena, a chest-high boundary.
- The floor is covered with **elements**: slabs, blocks, pillars, low wedges. They are your cover. Tall elements (over 1.5 m) hide a standing fighter; low ones hide you only crouched.
- The round starts with you and your opponent on opposite sides of the arena, about 36 m apart, out of sight of each other.

## SCRIBE, the machine of the arena

The arena rebuilds itself. SCRIBE is a machine that hurts nobody and helps nobody, but it does not let anyone hide forever:
- An element that is about to move first **glows and sinks a little for 1.2 s** (you are told when this happens near you). Then it sinks into the floor, rises, or turns. A moving element never crushes or pushes a fighter: it stops at you.
- **Camping rule (public):** if you stay within 6 m of one place for 10 s, every wall within 12 m of you sinks into the floor and you stand in the open. The next limits are 7 s, then 5 s. You are warned during the last seconds.
- After a long quiet the machine opens lines of sight between the fighters, and late in the round it takes cover away.

## Your weapon and your health

- Weapon this match: **assault rifle**, automatic, 600 shots/min, magazine 30, effective range 60 m. About 24 body hits kill. Moving does not make you less accurate, crouching does not make you more accurate.
- Health: 100 HP, no regeneration. Hits to the head do ×1.5 damage, to the legs ×0.8.
- **Medkits: 2**, each heals 50 HP and takes 1 s, during which you cannot shoot. Use one where the enemy cannot see you.
- You reload by yourself when the magazine is empty (2.2 s, you cannot shoot meanwhile); you may order an early reload.

## How a round ends

- The round lasts 180 s plus 30 s of overtime. A fighter at 0 HP loses. When time is up, more HP wins.

## How you play: you are the mind, your body executes

The game stops while you think. You never lose time by thinking. You give an **order**; your body carries it out at full speed until something important happens, then the game stops again and you see what changed.

Your body has the same skills as a good human player's hands, and nothing more:
- It walks the shortest way to where you send it, around obstacles.
- It takes cover behind the element you name, on the side that hides you from the point you name.
- When firing is allowed and your eyes see the enemy, it aims at the enemy and shoots in bursts, like a person: it needs a moment to react, its aim is not perfect, and it turns no faster than a game controller. It never shoots at what you cannot see (except blind fire, below).
- In cover with firing allowed, it leans out of the corner from time to time to look and shoot, then hides again.

You decide everything else: where to go, which cover, from which side to attack, when to hold, when to retreat, when to heal, when to move because of SCRIBE.

## What you know

You know only what your fighter could know: what its **eyes see** (a cone of 120° in front, up to 40 m, nothing through walls; a few metres all around), the **direction** a hit came from, and the **place** of enemy shots you hear (accurate to about 3 m). You know the arena around you (the 20 nearest elements within 15 m and whether they are up or sunk; you may walk to any point by its coordinates). You do not know where the enemy is unless you see it, hear it, or remember it.

## Your order (answer with exactly one JSON object)

```
{
  "move": "stay" | "leave_cover" | {"to": [X, Y]} | {"cover": "E17"},
  "against": [X, Y],
  "fire": "at_enemy" | "hold" | "blind",
  "look": 0-359,
  "sprint": true | false,
  "medkit": true | false,
  "reload": true | false,
  "dodge": "left" | "right",
  "for": 1-5,
  "comment": "one short sentence for the spectators: what you do and why",
  "note": "your private memory for the next decisions (max 300 characters)"
}
```

- `move`: stay where you are; leave the cover you are in; walk to a point; or take cover at an element from the list (by its id).
- `against`: the point you want the cover to protect you from (default: where you last knew the enemy to be).
- `fire`: `at_enemy` = shoot whenever your eyes see the enemy; `hold` = do not shoot (stay hidden, do not give your position away by sound); `blind` = from cover only, fire blind over the cover towards the place you last knew the enemy to be (inaccurate, but it keeps the enemy's head down).
- `look`: a bearing to look at while not seeing the enemy (default: towards the enemy's last known place, or where you walk).
- `sprint`: run faster; your body stops sprinting by itself when it sees the enemy.
- `medkit`: use a medkit now. `reload`: reload now. `dodge`: a quick roll to the side (once).
- `for`: the longest time in seconds this order lasts before you are asked again. You are asked earlier when something happens: you see or lose the enemy, you are hit, you hear a shot, you reach the goal or the order fails, SCRIBE warns you.
- Only `move` is required. Unknown fields are ignored. A broken answer keeps your previous order.
- `comment` is shown to the audience. `note` is seen only by you, in your next decision.
