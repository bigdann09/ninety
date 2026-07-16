export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:3001";

// Must match declare_id!() in ninety-contract/ninety/programs/ninety/src/lib.rs exactly —
// this used to be hardcoded to a stale/wrong program id in multiple files (7uRe9zZZw4Ua...),
// which meant every PDA derived here pointed at the wrong on-chain program and claims/stakes
// silently resolved accounts that didn't exist for this app's actual deployed program.
export const NINETY_PROGRAM_ID = "BmzkArt64NDhxRA8CMqmkETbhtM6HaGJdWpFbzkUwNkw";
