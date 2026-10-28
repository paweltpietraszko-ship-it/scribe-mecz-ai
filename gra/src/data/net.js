// Task 033 (B2, C1): where the game's server is and which other pages may use it. The game on Railway finds its server
// at its own address; the itch.io build (npm run build:itch: a page on another address) connects to `server`. Moving the
// server (BOARD U53) = this address. `origins`: the other pages the server answers (their HTTP requests and WebSocket
// connections); its own address always counts, and on the laptop (no Railway) every localhost port does.
export const NET = {
  server: 'https://game-production-5354.up.railway.app',
  origins: ['https://html-classic.itch.zone'],
};
