'use strict';

// ---------------------------------------------------------------------------
// Building system
// ---------------------------------------------------------------------------

// Leech strength contributed by each building type during leeching
const BUILDING_STRENGTH = { D: 1, TP: 2, TE: 2, SH: 3, SA: 3 };

// Canonical building type names (for command parsing)
const BUILDING_ALIASES = {
    DWELLING:      'D',
    'TRADING POST': 'TP',
    TEMPLE:        'TE',
    STRONGHOLD:    'SH',
    SANCTUARY:     'SA',
};

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

// Canonical resource abbreviations (for command parsing)
const RESOURCE_ALIASES = {
    PRIEST:  'P',
    PRIESTS: 'P',
    POWER:   'PW',
    WORKER:  'W',
    WORKERS: 'W',
    COIN:    'C',
    COINS:   'C',
};

// Standard conversion rates applied to all factions unless overridden.
// Format: { from: { to: amount_of_from_needed_per_1_to } }
// e.g. PW.C = 1 means 1 PW buys 1 C (burn power by spending 2 PW to gain 1 PW in bowl 3)
// Alchemists override C.VP (1 C → 2 VP instead of 3 C → 1 VP)
const DEFAULT_EXCHANGE_RATES = {
    PW: { C: 1, W: 3, P: 5 },
    W:  { C: 1 },
    P:  { C: 1, W: 1 },
    C:  { VP: 3 },
};

// ---------------------------------------------------------------------------
// Cult system
// ---------------------------------------------------------------------------

const CULT_TRACKS = ['FIRE', 'WATER', 'EARTH', 'AIR'];

// Power bonus gained when advancing past a cult track threshold.
// threshold: the upper boundary (old <= threshold AND new > threshold triggers the bonus).
// PW: power gained; KEY: KEY cost (negative = spend).
const CULT_TRACK_POWER_GAINS = [
    { threshold: 2, PW: 1 },
    { threshold: 4, PW: 2 },
    { threshold: 6, PW: 2 },
    { threshold: 9, PW: 3, KEY: -1 },  // reaching 10 costs 1 KEY; only one player may reach 10
];

// ---------------------------------------------------------------------------
// Map / terrain
// ---------------------------------------------------------------------------

// The terraforming color wheel (circular).  Distance between two terrain
// colors = min clockwise, counterclockwise steps.
const COLOR_WHEEL = ['yellow', 'brown', 'black', 'blue', 'green', 'gray', 'red'];

// ---------------------------------------------------------------------------
// Town formation defaults
// ---------------------------------------------------------------------------

// Minimum combined building strength of a connected cluster to form a town.
const DEFAULT_TOWN_SIZE = 7;

// Minimum number of buildings required in the cluster.
const DEFAULT_TOWN_COUNT = 4;

// Number of bridges available per faction.
const DEFAULT_BRIDGE_COUNT = 3;

// ---------------------------------------------------------------------------
// Power actions (ACT1-ACT6 — shared pool, blocked after use each round)
// ---------------------------------------------------------------------------
const POWER_ACTIONS = {
    ACT1: { cost: { PW: 3 }, gain: { BRIDGE: 1 },  subaction: { bridge: 1 } },
    ACT2: { cost: { PW: 3 }, gain: { P: 1 } },
    ACT3: { cost: { PW: 4 }, gain: { W: 2 } },
    ACT4: { cost: { PW: 4 }, gain: { C: 7 } },
    ACT5: { cost: { PW: 4 }, gain: { SPADE: 1 },  subaction: { dig: 1, transform: 1, build: 1 } },
    ACT6: { cost: { PW: 6 }, gain: { SPADE: 2 },  subaction: { dig: 1, transform: 2, build: 1 } },
};

// ---------------------------------------------------------------------------
// Faction / stronghold / tile special actions
// (granted individually; not drawn from the shared ACT pool)
// dont_block: true → taking the action does NOT consume a regular "action" for the round
// show_if: resource that must be set on the faction for the action to be visible
// ---------------------------------------------------------------------------
const FACTION_ACTIONS = {
    // Auren stronghold — 2 cult steps on the SAME track
    ACTA: {
        cost: {},
        gain: { CULT: 2, CULTS_ON_SAME_TRACK: 1 },
    },
    // Engineers stronghold — build a bridge (W2, doesn't block turn)
    ACTE: {
        dont_block: true,
        cost: { W: 2 },
        gain: { BRIDGE: 1 },
        subaction: { bridge: 1 },
    },
    // Giants stronghold — 2 free spades
    ACTG: {
        cost: {},
        gain: { SPADE: 2 },
        subaction: { dig: 1, transform: 1, build: 1 },
    },
    // Swarmlings stronghold — free Trading Post upgrade
    ACTS: {
        cost: {},
        gain: { FREE_TP: 1 },
        subaction: { upgrade: 1 },
    },
    // Nomads stronghold — free transform + build (must be adjacent to own building)
    ACTN: {
        cost: {},
        gain: { FREE_TF: 1, TF_NEED_HEX_ADJACENCY: 1 },
        subaction: { dig: 1, transform: 1, build: 1 },
    },
    // Witches stronghold — free dwelling build anywhere on own terrain (no TF)
    ACTW: {
        cost: {},
        gain: { FREE_D: 1, TELEPORT_NO_TF: 1 },
        subaction: { build: 1 },
    },
    // Chaos Magicians stronghold — gain 2 full actions
    ACTC: {
        cost: {},
        gain: { GAIN_ACTION: 2 },
    },
    // Shapeshifter variable-color actions (ACTH1/H2 require ALLOW_SHAPESHIFT flag)
    ACTH1: { dont_block: true, show_if: 'ALLOW_SHAPESHIFT', cost: { PW: 3,       ALLOW_SHAPESHIFT: 1 }, gain: { PICK_COLOR: 1, VP: 2 } },
    ACTH2: { dont_block: true, show_if: 'ALLOW_SHAPESHIFT', cost: { PW_TOKEN: 3, ALLOW_SHAPESHIFT: 1 }, gain: { PICK_COLOR: 1, VP: 2 } },
    ACTH3: { dont_block: true,                               cost: { PW: 4 },       gain: { PICK_COLOR: 1 } },
    ACTH4: { dont_block: true,                               cost: { PW_TOKEN: 4 }, gain: { PICK_COLOR: 1 } },
    ACTH5: { dont_block: true,                               cost: { PW: 5 },       gain: { PICK_COLOR: 1 } },
    ACTH6: { dont_block: true,                               cost: { PW_TOKEN: 5 }, gain: { PICK_COLOR: 1 } },
};

// ---------------------------------------------------------------------------
// Final scoring
// ---------------------------------------------------------------------------

// Standard final scoring categories.  Fire & Ice adds alternative options.
// points: VP awarded for 1st / 2nd / 3rd place (ties share).
const FINAL_SCORING = {
    network: {
        description: 'Largest connected network of buildings',
        points: [18, 12, 6],
        label: 'network',
    },
    cults: {
        description: 'Position on each cult track',
        points: [8, 4, 2],
    },
    // Fire & Ice alternative final-scoring options (require option flag):
    'connected-distance': {
        description: 'Largest distance between two buildings in one connected network',
        option: 'fire-and-ice-final-scoring',
        points: [18, 12, 6],
        label: 'distance',
    },
    'connected-sa-sh-distance': {
        description: 'Largest distance between a stronghold and sanctuary in the same network',
        option: 'fire-and-ice-final-scoring',
        points: [18, 12, 6],
        label: 'sa-sh-distance',
    },
    'building-on-edge': {
        description: 'Largest number of buildings on the edge of the map in one connected network',
        option: 'fire-and-ice-final-scoring',
        points: [18, 12, 6],
        label: 'edge',
    },
    'connected-clusters': {
        description: 'Most separate clusters in one connected network',
        option: 'fire-and-ice-final-scoring',
        points: [18, 12, 6],
        label: 'clusters',
    },
};

module.exports = {
    BUILDING_STRENGTH,
    BUILDING_ALIASES,
    RESOURCE_ALIASES,
    DEFAULT_EXCHANGE_RATES,
    CULT_TRACKS,
    CULT_TRACK_POWER_GAINS,
    COLOR_WHEEL,
    DEFAULT_TOWN_SIZE,
    DEFAULT_TOWN_COUNT,
    DEFAULT_BRIDGE_COUNT,
    POWER_ACTIONS,
    FACTION_ACTIONS,
    FINAL_SCORING,
};
