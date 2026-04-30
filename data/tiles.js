'use strict';

// ---------------------------------------------------------------------------
// Bonus Tiles (BON1-BON10)
//   income     — received every round while holding the tile (after passing)
//   action     — once-per-round action unlocked by this tile
//   pass_vp    — VP earned when passing: { building: [vp_at_count_0, vp_at_count_1, ...] }
//   special    — { ship: 1 } means the tile also tracks ship advancement bonus
//   option     — game option required for this tile to be in the pool
// ---------------------------------------------------------------------------
const BONUS_TILES = {
    BON1:  {
        income: { C: 2 },
        action: { cost: {}, gain: { SPADE: 1 }, subaction: { dig: 1, transform: 1, build: 1 } },
    },
    BON2:  {
        income: { C: 4 },
        action: { cost: {}, gain: { CULT: 1 } },
    },
    BON3:  { income: { C: 6 } },
    BON4:  { income: { PW: 3 }, special: { ship: 1 } },
    BON5:  { income: { PW: 3, W: 1 } },
    BON6:  {
        income: { W: 2 },
        pass_vp: { SA: [0, 4], SH: [0, 4] },
    },
    BON7:  {
        income: { W: 1 },
        // map { $_ * 2 } 0..4  →  [0, 2, 4, 6, 8]
        pass_vp: { TP: [0, 2, 4, 6, 8] },
    },
    BON8:  { income: { P: 1 } },
    BON9:  {
        income: { C: 2 },
        // map { $_ } 0..8  →  [0, 1, 2, 3, 4, 5, 6, 7, 8]
        pass_vp: { D: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
    },
    BON10: {
        income: { PW: 3 },
        // map { $_ * 3 } 0..5  →  [0, 3, 6, 9, 12, 15]
        pass_vp: { ship: [0, 3, 6, 9, 12, 15] },
        option: 'shipping-bonus',
    },
};

// ---------------------------------------------------------------------------
// Favor Tiles (FAV1-FAV12)
//   gain       — immediate gain when taking the tile
//   income     — added to round income while tile is held
//   count      — copies in pool (default 3, 1 if specified)
//   action     — once-per-round action unlocked by this tile
//   vp         — VP per building type built: { building: vp_per_building }
//   pass_vp    — VP earned when passing (indexed by count)
// ---------------------------------------------------------------------------
const FAVOR_TILES = {
    FAV1:  { gain: { FIRE: 3 },               income: {},             count: 1 },
    FAV2:  { gain: { WATER: 3 },              income: {},             count: 1 },
    FAV3:  { gain: { EARTH: 3 },              income: {},             count: 1 },
    FAV4:  { gain: { AIR: 3 },               income: {},             count: 1 },
    FAV5:  { gain: { FIRE: 2, TOWN_SIZE: -1 }, income: {} },
    FAV6:  {
        gain: { WATER: 2 },
        income: {},
        action: { cost: {}, gain: { CULT: 1 } },
    },
    FAV7:  { gain: { EARTH: 2 },              income: { W: 1, PW: 1 } },
    FAV8:  { gain: { AIR: 2 },               income: { PW: 4 } },
    FAV9:  { gain: { FIRE: 1 },               income: { C: 3 } },
    FAV10: { gain: { WATER: 1 },              income: {},             vp: { TP: 3 } },
    FAV11: { gain: { EARTH: 1 },              income: {},             vp: { D: 2 } },
    FAV12: {
        gain: { AIR: 1 },
        income: {},
        pass_vp: { TP: [0, 2, 3, 3, 4] },
    },
};

// ---------------------------------------------------------------------------
// Town Tiles (TW1-TW8)
//   gain       — immediate gain when the town is formed
//   count      — copies in pool (default 2, 1 if specified)
//   option     — game option required for this tile to be in the pool
// ---------------------------------------------------------------------------
const TOWN_TILES = {
    TW1: { gain: { KEY: 1, VP: 5,  C: 6 } },
    TW2: { gain: { KEY: 1, VP: 7,  W: 2 } },
    TW3: { gain: { KEY: 1, VP: 9,  P: 1 } },
    TW4: { gain: { KEY: 1, VP: 6,  PW: 8 } },
    TW5: { gain: { KEY: 1, VP: 8,  FIRE: 1, WATER: 1, EARTH: 1, AIR: 1 } },
    TW6: { gain: { KEY: 2, VP: 2,  FIRE: 2, WATER: 2, EARTH: 2, AIR: 2 }, count: 1, option: 'mini-expansion-1' },
    TW7: { gain: { KEY: 1, VP: 4,  GAIN_SHIP: 1, carpet_range: 1 }, option: 'mini-expansion-1' },
    TW8: { gain: { KEY: 1, VP: 11 }, count: 1, option: 'mini-expansion-1' },
};

// ---------------------------------------------------------------------------
// Scoring Tiles (SCORE1-SCORE9)
//   vp         — VP trigger: { event_type: vp_amount }
//                 "TW" is used as a prefix pattern matching any town tile.
//   vp_display — human-readable description of the vp trigger
//   vp_mode    — "gain" = triggered when gaining the resource/event
//                "build" = triggered when building the structure
//   cult       — cult track needed for income calculation
//                "CULT_P" = number of priests sent to cult tracks this round
//   req        — minimum cult level (or count) to receive income
//                income = floor(cult_value / req) × income_resource
//   income     — resource type and amount per qualifying unit
//   option     — game option required for this tile to be in the pool
// ---------------------------------------------------------------------------
const SCORING_TILES = {
    SCORE1: { vp: { SPADE: 2 },      vp_display: 'SPADE >> 2',  vp_mode: 'gain',  cult: 'EARTH',  req: 1, income: { C: 1 } },
    SCORE2: { vp: { TW: 5 },         vp_display: 'TOWN >> 5',   vp_mode: 'gain',  cult: 'EARTH',  req: 4, income: { SPADE: 1 } },
    SCORE3: { vp: { D: 2 },          vp_display: 'D >> 2',      vp_mode: 'build', cult: 'WATER',  req: 4, income: { P: 1 } },
    SCORE4: { vp: { SA: 5, SH: 5 },  vp_display: 'SA/SH >> 5', vp_mode: 'build', cult: 'FIRE',   req: 2, income: { W: 1 } },
    SCORE5: { vp: { D: 2 },          vp_display: 'D >> 2',      vp_mode: 'build', cult: 'FIRE',   req: 4, income: { PW: 4 } },
    SCORE6: { vp: { TP: 3 },         vp_display: 'TP >> 3',     vp_mode: 'build', cult: 'WATER',  req: 4, income: { SPADE: 1 } },
    SCORE7: { vp: { SA: 5, SH: 5 },  vp_display: 'SA/SH >> 5', vp_mode: 'build', cult: 'AIR',    req: 2, income: { W: 1 } },
    SCORE8: { vp: { TP: 3 },         vp_display: 'TP >> 3',     vp_mode: 'build', cult: 'AIR',    req: 4, income: { SPADE: 1 } },
    SCORE9: { vp: { TE: 4 },         vp_display: 'TE >> 4',     vp_mode: 'build', cult: 'CULT_P', req: 1, income: { C: 2 }, option: 'temple-scoring-tile' },
};

// ---------------------------------------------------------------------------
// Convenience name arrays
// ---------------------------------------------------------------------------
const BONUS_TILE_NAMES   = Object.keys(BONUS_TILES);
const FAVOR_TILE_NAMES   = Object.keys(FAVOR_TILES);
const TOWN_TILE_NAMES    = Object.keys(TOWN_TILES);
const SCORING_TILE_NAMES = Object.keys(SCORING_TILES);

module.exports = {
    BONUS_TILES,
    FAVOR_TILES,
    TOWN_TILES,
    SCORING_TILES,
    BONUS_TILE_NAMES,
    FAVOR_TILE_NAMES,
    TOWN_TILE_NAMES,
    SCORING_TILE_NAMES,
};
