// Task 033 (A0, B): which build this is and where its server is. ITCH: the build for itch.io's frame (vite --mode itch):
// a guest only (no sign-in, no token read, written or sent: every itch.io game shares that frame's address and its
// storage), the server at NET.server. Otherwise the game on Railway or the laptop, as before: the dev server passes /pvp
// on to the PvP server; built, the server is the game's own address.
import { NET } from '../data/net.js';

export const ITCH = import.meta.env.MODE === 'itch';
export const serverAddress = () => (ITCH ? NET.server : import.meta.env.DEV ? `${location.origin}/pvp` : location.origin);
// the full game (sign-in and ranking): the Railway page, opened in a new tab from the frame
export const fullGame = () => (ITCH ? NET.server : location.origin) + '/';
