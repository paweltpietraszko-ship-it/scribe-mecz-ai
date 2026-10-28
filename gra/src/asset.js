// Task 024 (K3): the address of a file of public/ with the hash of its content (vite.config.js), so a cached file is
// never one of another version of the game. path: as in public/, e.g. 'hero/stroj_kobalt.glb'
import versions from 'virtual:asset-versions';

export const asset = path => (versions[path] ? `${path}?v=${versions[path]}` : path);
