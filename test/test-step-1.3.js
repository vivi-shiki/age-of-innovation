'use strict';

const assert = require('assert');

// ── Test runner ─────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
    try {
        fn();
        passed++;
    } catch (err) {
        failed++;
        failures.push({ name, err });
    }
}

function group(label, fn) {
    console.log(`\n── ${label}`);
    fn();
}

// ── Modules under test ──────────────────────────────────────────────────────

const {
    BONUS_TILES, FAVOR_TILES, TOWN_TILES, SCORING_TILES,
    BONUS_TILE_NAMES, FAVOR_TILE_NAMES, TOWN_TILE_NAMES, SCORING_TILE_NAMES,
} = require('../data/tiles.js');

const {
    BUILDING_STRENGTH, BUILDING_ALIASES, RESOURCE_ALIASES,
    DEFAULT_EXCHANGE_RATES,
    CULT_TRACKS, CULT_TRACK_POWER_GAINS,
    COLOR_WHEEL,
    DEFAULT_TOWN_SIZE, DEFAULT_TOWN_COUNT, DEFAULT_BRIDGE_COUNT,
    POWER_ACTIONS, FACTION_ACTIONS, FINAL_SCORING,
} = require('../data/constants.js');

// ============================================================================
// GROUP 1: tiles.js — module shape
// ============================================================================
group('1: tiles.js module shape', () => {
    test('BONUS_TILES is an object', () => assert.strictEqual(typeof BONUS_TILES, 'object'));
    test('FAVOR_TILES is an object', () => assert.strictEqual(typeof FAVOR_TILES, 'object'));
    test('TOWN_TILES is an object',  () => assert.strictEqual(typeof TOWN_TILES,  'object'));
    test('SCORING_TILES is an object', () => assert.strictEqual(typeof SCORING_TILES, 'object'));
    test('BONUS_TILE_NAMES is an array',   () => assert.ok(Array.isArray(BONUS_TILE_NAMES)));
    test('FAVOR_TILE_NAMES is an array',   () => assert.ok(Array.isArray(FAVOR_TILE_NAMES)));
    test('TOWN_TILE_NAMES is an array',    () => assert.ok(Array.isArray(TOWN_TILE_NAMES)));
    test('SCORING_TILE_NAMES is an array', () => assert.ok(Array.isArray(SCORING_TILE_NAMES)));
});

// ============================================================================
// GROUP 2: BONUS_TILES counts and key presence
// ============================================================================
group('2: BONUS_TILES counts and key presence', () => {
    test('10 bonus tiles total', () => assert.strictEqual(BONUS_TILE_NAMES.length, 10));
    test('BONUS_TILE_NAMES matches BONUS_TILES keys', () =>
        assert.deepStrictEqual(BONUS_TILE_NAMES.sort(), Object.keys(BONUS_TILES).sort()));

    // Every tile must have an income field
    for (const name of BONUS_TILE_NAMES) {
        test(`${name} has income field`, () =>
            assert.ok(typeof BONUS_TILES[name].income === 'object'));
    }
});

// ============================================================================
// GROUP 3: BONUS_TILES specific values
// ============================================================================
group('3: BONUS_TILES specific values', () => {
    test('BON1 income.C === 2',  () => assert.strictEqual(BONUS_TILES.BON1.income.C, 2));
    test('BON1 has action field', () => assert.ok(typeof BONUS_TILES.BON1.action === 'object'));
    test('BON1 action gain.SPADE === 1', () => assert.strictEqual(BONUS_TILES.BON1.action.gain.SPADE, 1));
    test('BON1 action subaction.dig === 1', () => assert.strictEqual(BONUS_TILES.BON1.action.subaction.dig, 1));

    test('BON2 income.C === 4',  () => assert.strictEqual(BONUS_TILES.BON2.income.C, 4));
    test('BON2 action.gain.CULT === 1', () => assert.strictEqual(BONUS_TILES.BON2.action.gain.CULT, 1));

    test('BON3 income.C === 6',  () => assert.strictEqual(BONUS_TILES.BON3.income.C, 6));
    test('BON3 has no action',   () => assert.strictEqual(BONUS_TILES.BON3.action, undefined));

    test('BON4 income.PW === 3', () => assert.strictEqual(BONUS_TILES.BON4.income.PW, 3));
    test('BON4 special.ship === 1', () => assert.strictEqual(BONUS_TILES.BON4.special.ship, 1));

    test('BON5 income.PW === 3', () => assert.strictEqual(BONUS_TILES.BON5.income.PW, 3));
    test('BON5 income.W === 1',  () => assert.strictEqual(BONUS_TILES.BON5.income.W, 1));

    test('BON6 income.W === 2',  () => assert.strictEqual(BONUS_TILES.BON6.income.W, 2));
    test('BON6 pass_vp.SA is array length 2', () =>
        assert.deepStrictEqual(BONUS_TILES.BON6.pass_vp.SA, [0, 4]));
    test('BON6 pass_vp.SH is array length 2', () =>
        assert.deepStrictEqual(BONUS_TILES.BON6.pass_vp.SH, [0, 4]));

    test('BON7 income.W === 1',  () => assert.strictEqual(BONUS_TILES.BON7.income.W, 1));
    test('BON7 pass_vp.TP === [0,2,4,6,8]', () =>
        assert.deepStrictEqual(BONUS_TILES.BON7.pass_vp.TP, [0, 2, 4, 6, 8]));

    test('BON8 income.P === 1',  () => assert.strictEqual(BONUS_TILES.BON8.income.P, 1));

    test('BON9 income.C === 2',  () => assert.strictEqual(BONUS_TILES.BON9.income.C, 2));
    test('BON9 pass_vp.D length === 9', () => assert.strictEqual(BONUS_TILES.BON9.pass_vp.D.length, 9));
    test('BON9 pass_vp.D[8] === 8', () => assert.strictEqual(BONUS_TILES.BON9.pass_vp.D[8], 8));

    test('BON10 income.PW === 3', () => assert.strictEqual(BONUS_TILES.BON10.income.PW, 3));
    test('BON10 pass_vp.ship === [0,3,6,9,12,15]', () =>
        assert.deepStrictEqual(BONUS_TILES.BON10.pass_vp.ship, [0, 3, 6, 9, 12, 15]));
    test('BON10 option === shipping-bonus', () =>
        assert.strictEqual(BONUS_TILES.BON10.option, 'shipping-bonus'));

    // pass_vp arrays – first element is always 0 (0 buildings → 0 VP)
    for (const name of ['BON6', 'BON7', 'BON9', 'BON10']) {
        test(`${name} pass_vp first element is 0`, () => {
            const pv = BONUS_TILES[name].pass_vp;
            for (const arr of Object.values(pv)) {
                assert.strictEqual(arr[0], 0);
            }
        });
    }

    // pass_vp arrays are non-decreasing
    for (const name of ['BON7', 'BON9', 'BON10']) {
        test(`${name} pass_vp is non-decreasing`, () => {
            const pv = BONUS_TILES[name].pass_vp;
            for (const arr of Object.values(pv)) {
                for (let i = 1; i < arr.length; i++) {
                    assert.ok(arr[i] >= arr[i - 1], `${name} pass_vp not non-decreasing at index ${i}`);
                }
            }
        });
    }
});

// ============================================================================
// GROUP 4: FAVOR_TILES counts and shape
// ============================================================================
group('4: FAVOR_TILES counts and shape', () => {
    test('12 favor tiles total', () => assert.strictEqual(FAVOR_TILE_NAMES.length, 12));

    // Every tile must have gain and income
    for (const name of FAVOR_TILE_NAMES) {
        test(`${name} has gain field`, () =>
            assert.ok(typeof FAVOR_TILES[name].gain === 'object'));
        test(`${name} has income field`, () =>
            assert.ok(typeof FAVOR_TILES[name].income === 'object'));
    }

    // count:1 tiles
    for (const name of ['FAV1', 'FAV2', 'FAV3', 'FAV4']) {
        test(`${name} count === 1`, () => assert.strictEqual(FAVOR_TILES[name].count, 1));
    }

    // Others should not have count (default is 3 in pool logic)
    for (const name of ['FAV5', 'FAV6', 'FAV7', 'FAV8', 'FAV9', 'FAV10', 'FAV11', 'FAV12']) {
        test(`${name} count is undefined`, () =>
            assert.strictEqual(FAVOR_TILES[name].count, undefined));
    }
});

// ============================================================================
// GROUP 5: FAVOR_TILES specific values
// ============================================================================
group('5: FAVOR_TILES specific values', () => {
    // Cult gain tiles (FAV1-4 give 3 on respective cult)
    test('FAV1 gain.FIRE === 3',  () => assert.strictEqual(FAVOR_TILES.FAV1.gain.FIRE, 3));
    test('FAV2 gain.WATER === 3', () => assert.strictEqual(FAVOR_TILES.FAV2.gain.WATER, 3));
    test('FAV3 gain.EARTH === 3', () => assert.strictEqual(FAVOR_TILES.FAV3.gain.EARTH, 3));
    test('FAV4 gain.AIR === 3',   () => assert.strictEqual(FAVOR_TILES.FAV4.gain.AIR, 3));

    test('FAV5 gain.FIRE === 2', () => assert.strictEqual(FAVOR_TILES.FAV5.gain.FIRE, 2));
    test('FAV5 gain.TOWN_SIZE === -1', () => assert.strictEqual(FAVOR_TILES.FAV5.gain.TOWN_SIZE, -1));

    test('FAV6 gain.WATER === 2', () => assert.strictEqual(FAVOR_TILES.FAV6.gain.WATER, 2));
    test('FAV6 has action', () => assert.ok(typeof FAVOR_TILES.FAV6.action === 'object'));
    test('FAV6 action.gain.CULT === 1', () => assert.strictEqual(FAVOR_TILES.FAV6.action.gain.CULT, 1));

    test('FAV7 income.W === 1',  () => assert.strictEqual(FAVOR_TILES.FAV7.income.W, 1));
    test('FAV7 income.PW === 1', () => assert.strictEqual(FAVOR_TILES.FAV7.income.PW, 1));

    test('FAV8 income.PW === 4', () => assert.strictEqual(FAVOR_TILES.FAV8.income.PW, 4));

    test('FAV9 income.C === 3',  () => assert.strictEqual(FAVOR_TILES.FAV9.income.C, 3));

    test('FAV10 vp.TP === 3',    () => assert.strictEqual(FAVOR_TILES.FAV10.vp.TP, 3));
    test('FAV11 vp.D === 2',     () => assert.strictEqual(FAVOR_TILES.FAV11.vp.D, 2));

    test('FAV12 gain.AIR === 1', () => assert.strictEqual(FAVOR_TILES.FAV12.gain.AIR, 1));
    test('FAV12 pass_vp.TP deepEqual [0,2,3,3,4]', () =>
        assert.deepStrictEqual(FAVOR_TILES.FAV12.pass_vp.TP, [0, 2, 3, 3, 4]));
    test('FAV12 pass_vp.TP length === 5', () =>
        assert.strictEqual(FAVOR_TILES.FAV12.pass_vp.TP.length, 5));

    // Tiles without income entries should have empty income objects
    for (const name of ['FAV1', 'FAV2', 'FAV3', 'FAV4', 'FAV5', 'FAV6', 'FAV10', 'FAV11', 'FAV12']) {
        test(`${name} income is empty object`, () =>
            assert.deepStrictEqual(FAVOR_TILES[name].income, {}));
    }
});

// ============================================================================
// GROUP 6: TOWN_TILES counts and shape
// ============================================================================
group('6: TOWN_TILES counts and shape', () => {
    test('8 town tiles total', () => assert.strictEqual(TOWN_TILE_NAMES.length, 8));

    // Every tile must have a gain field
    for (const name of TOWN_TILE_NAMES) {
        test(`${name} has gain field`, () =>
            assert.ok(typeof TOWN_TILES[name].gain === 'object'));
    }

    // Every standard tile grants exactly 1 KEY; TW6 grants 2
    for (const name of ['TW1', 'TW2', 'TW3', 'TW4', 'TW5', 'TW7', 'TW8']) {
        test(`${name} gain.KEY === 1`, () => assert.strictEqual(TOWN_TILES[name].gain.KEY, 1));
    }
    test('TW6 gain.KEY === 2', () => assert.strictEqual(TOWN_TILES.TW6.gain.KEY, 2));

    // count:1 tiles
    for (const name of ['TW6', 'TW8']) {
        test(`${name} count === 1`, () => assert.strictEqual(TOWN_TILES[name].count, 1));
    }

    // mini-expansion-1 tiles
    for (const name of ['TW6', 'TW7', 'TW8']) {
        test(`${name} option === mini-expansion-1`, () =>
            assert.strictEqual(TOWN_TILES[name].option, 'mini-expansion-1'));
    }

    // Base tiles (TW1-TW5) have no option
    for (const name of ['TW1', 'TW2', 'TW3', 'TW4', 'TW5']) {
        test(`${name} has no option`, () => assert.strictEqual(TOWN_TILES[name].option, undefined));
    }
});

// ============================================================================
// GROUP 7: TOWN_TILES specific values
// ============================================================================
group('7: TOWN_TILES specific values', () => {
    test('TW1 gain.VP === 5',  () => assert.strictEqual(TOWN_TILES.TW1.gain.VP, 5));
    test('TW1 gain.C === 6',   () => assert.strictEqual(TOWN_TILES.TW1.gain.C, 6));
    test('TW2 gain.VP === 7',  () => assert.strictEqual(TOWN_TILES.TW2.gain.VP, 7));
    test('TW2 gain.W === 2',   () => assert.strictEqual(TOWN_TILES.TW2.gain.W, 2));
    test('TW3 gain.VP === 9',  () => assert.strictEqual(TOWN_TILES.TW3.gain.VP, 9));
    test('TW3 gain.P === 1',   () => assert.strictEqual(TOWN_TILES.TW3.gain.P, 1));
    test('TW4 gain.VP === 6',  () => assert.strictEqual(TOWN_TILES.TW4.gain.VP, 6));
    test('TW4 gain.PW === 8',  () => assert.strictEqual(TOWN_TILES.TW4.gain.PW, 8));
    test('TW5 gain.VP === 8',  () => assert.strictEqual(TOWN_TILES.TW5.gain.VP, 8));
    test('TW5 has FIRE/WATER/EARTH/AIR gains', () => {
        const g = TOWN_TILES.TW5.gain;
        assert.strictEqual(g.FIRE, 1);
        assert.strictEqual(g.WATER, 1);
        assert.strictEqual(g.EARTH, 1);
        assert.strictEqual(g.AIR, 1);
    });
    test('TW6 gain.VP === 2',   () => assert.strictEqual(TOWN_TILES.TW6.gain.VP, 2));
    test('TW6 has FIRE/WATER/EARTH/AIR === 2 each', () => {
        const g = TOWN_TILES.TW6.gain;
        assert.strictEqual(g.FIRE, 2);
        assert.strictEqual(g.WATER, 2);
        assert.strictEqual(g.EARTH, 2);
        assert.strictEqual(g.AIR, 2);
    });
    test('TW7 gain.VP === 4',         () => assert.strictEqual(TOWN_TILES.TW7.gain.VP, 4));
    test('TW7 gain.GAIN_SHIP === 1',  () => assert.strictEqual(TOWN_TILES.TW7.gain.GAIN_SHIP, 1));
    test('TW7 gain.carpet_range === 1', () => assert.strictEqual(TOWN_TILES.TW7.gain.carpet_range, 1));
    test('TW8 gain.VP === 11', () => assert.strictEqual(TOWN_TILES.TW8.gain.VP, 11));
    // TW8 only has KEY and VP
    test('TW8 gain has exactly KEY and VP', () =>
        assert.deepStrictEqual(Object.keys(TOWN_TILES.TW8.gain).sort(), ['KEY', 'VP'].sort()));
});

// ============================================================================
// GROUP 8: SCORING_TILES counts and shape
// ============================================================================
group('8: SCORING_TILES counts and shape', () => {
    test('9 scoring tiles total', () => assert.strictEqual(SCORING_TILE_NAMES.length, 9));

    const requiredFields = ['vp', 'vp_display', 'vp_mode', 'cult', 'req', 'income'];
    for (const name of SCORING_TILE_NAMES) {
        for (const field of requiredFields) {
            test(`${name} has field ${field}`, () =>
                assert.ok(SCORING_TILES[name][field] !== undefined));
        }
    }

    // vp_mode must be 'gain' or 'build'
    for (const name of SCORING_TILE_NAMES) {
        test(`${name} vp_mode is gain or build`, () =>
            assert.ok(['gain', 'build'].includes(SCORING_TILES[name].vp_mode)));
    }

    // cult must be a cult track or the special CULT_P string
    const validCults = new Set(['FIRE', 'WATER', 'EARTH', 'AIR', 'CULT_P']);
    for (const name of SCORING_TILE_NAMES) {
        test(`${name} cult is valid`, () =>
            assert.ok(validCults.has(SCORING_TILES[name].cult)));
    }

    // req must be a positive integer
    for (const name of SCORING_TILE_NAMES) {
        test(`${name} req is positive integer`, () => {
            const req = SCORING_TILES[name].req;
            assert.ok(Number.isInteger(req) && req > 0);
        });
    }
});

// ============================================================================
// GROUP 9: SCORING_TILES specific values
// ============================================================================
group('9: SCORING_TILES specific values', () => {
    test('SCORE1 vp.SPADE === 2',   () => assert.strictEqual(SCORING_TILES.SCORE1.vp.SPADE, 2));
    test('SCORE1 cult === EARTH',   () => assert.strictEqual(SCORING_TILES.SCORE1.cult, 'EARTH'));
    test('SCORE1 req === 1',        () => assert.strictEqual(SCORING_TILES.SCORE1.req, 1));
    test('SCORE1 income.C === 1',   () => assert.strictEqual(SCORING_TILES.SCORE1.income.C, 1));
    test('SCORE1 vp_mode === gain', () => assert.strictEqual(SCORING_TILES.SCORE1.vp_mode, 'gain'));

    test('SCORE2 vp.TW === 5',      () => assert.strictEqual(SCORING_TILES.SCORE2.vp.TW, 5));
    test('SCORE2 income.SPADE === 1', () => assert.strictEqual(SCORING_TILES.SCORE2.income.SPADE, 1));

    test('SCORE3 vp.D === 2',       () => assert.strictEqual(SCORING_TILES.SCORE3.vp.D, 2));
    test('SCORE3 cult === WATER',   () => assert.strictEqual(SCORING_TILES.SCORE3.cult, 'WATER'));
    test('SCORE3 income.P === 1',   () => assert.strictEqual(SCORING_TILES.SCORE3.income.P, 1));

    test('SCORE4 vp.SA === 5',      () => assert.strictEqual(SCORING_TILES.SCORE4.vp.SA, 5));
    test('SCORE4 vp.SH === 5',      () => assert.strictEqual(SCORING_TILES.SCORE4.vp.SH, 5));
    test('SCORE4 cult === FIRE',    () => assert.strictEqual(SCORING_TILES.SCORE4.cult, 'FIRE'));
    test('SCORE4 req === 2',        () => assert.strictEqual(SCORING_TILES.SCORE4.req, 2));
    test('SCORE4 income.W === 1',   () => assert.strictEqual(SCORING_TILES.SCORE4.income.W, 1));

    test('SCORE5 vp.D === 2',       () => assert.strictEqual(SCORING_TILES.SCORE5.vp.D, 2));
    test('SCORE5 income.PW === 4',  () => assert.strictEqual(SCORING_TILES.SCORE5.income.PW, 4));

    test('SCORE6 vp.TP === 3',      () => assert.strictEqual(SCORING_TILES.SCORE6.vp.TP, 3));
    test('SCORE6 cult === WATER',   () => assert.strictEqual(SCORING_TILES.SCORE6.cult, 'WATER'));

    test('SCORE7 vp.SA === 5 and vp.SH === 5', () => {
        assert.strictEqual(SCORING_TILES.SCORE7.vp.SA, 5);
        assert.strictEqual(SCORING_TILES.SCORE7.vp.SH, 5);
    });
    test('SCORE7 cult === AIR',     () => assert.strictEqual(SCORING_TILES.SCORE7.cult, 'AIR'));

    test('SCORE8 vp.TP === 3',      () => assert.strictEqual(SCORING_TILES.SCORE8.vp.TP, 3));
    test('SCORE8 cult === AIR',     () => assert.strictEqual(SCORING_TILES.SCORE8.cult, 'AIR'));

    test('SCORE9 vp.TE === 4',      () => assert.strictEqual(SCORING_TILES.SCORE9.vp.TE, 4));
    test('SCORE9 cult === CULT_P',  () => assert.strictEqual(SCORING_TILES.SCORE9.cult, 'CULT_P'));
    test('SCORE9 option === temple-scoring-tile', () =>
        assert.strictEqual(SCORING_TILES.SCORE9.option, 'temple-scoring-tile'));
    test('SCORE9 income.C === 2',   () => assert.strictEqual(SCORING_TILES.SCORE9.income.C, 2));

    // 'gain' mode scoring tiles
    for (const name of ['SCORE1', 'SCORE2']) {
        test(`${name} vp_mode === gain`, () =>
            assert.strictEqual(SCORING_TILES[name].vp_mode, 'gain'));
    }
    // 'build' mode scoring tiles
    for (const name of ['SCORE3', 'SCORE4', 'SCORE5', 'SCORE6', 'SCORE7', 'SCORE8', 'SCORE9']) {
        test(`${name} vp_mode === build`, () =>
            assert.strictEqual(SCORING_TILES[name].vp_mode, 'build'));
    }
});

// ============================================================================
// GROUP 10: constants.js — module shape
// ============================================================================
group('10: constants.js module shape', () => {
    test('BUILDING_STRENGTH is an object', () => assert.strictEqual(typeof BUILDING_STRENGTH, 'object'));
    test('BUILDING_ALIASES is an object',  () => assert.strictEqual(typeof BUILDING_ALIASES, 'object'));
    test('RESOURCE_ALIASES is an object',  () => assert.strictEqual(typeof RESOURCE_ALIASES, 'object'));
    test('DEFAULT_EXCHANGE_RATES is an object', () => assert.strictEqual(typeof DEFAULT_EXCHANGE_RATES, 'object'));
    test('CULT_TRACKS is an array', () => assert.ok(Array.isArray(CULT_TRACKS)));
    test('CULT_TRACK_POWER_GAINS is an array', () => assert.ok(Array.isArray(CULT_TRACK_POWER_GAINS)));
    test('COLOR_WHEEL is an array', () => assert.ok(Array.isArray(COLOR_WHEEL)));
    test('POWER_ACTIONS is an object', () => assert.strictEqual(typeof POWER_ACTIONS, 'object'));
    test('FACTION_ACTIONS is an object', () => assert.strictEqual(typeof FACTION_ACTIONS, 'object'));
    test('FINAL_SCORING is an object', () => assert.strictEqual(typeof FINAL_SCORING, 'object'));
});

// ============================================================================
// GROUP 11: BUILDING_STRENGTH
// ============================================================================
group('11: BUILDING_STRENGTH', () => {
    test('D strength === 1',  () => assert.strictEqual(BUILDING_STRENGTH.D, 1));
    test('TP strength === 2', () => assert.strictEqual(BUILDING_STRENGTH.TP, 2));
    test('TE strength === 2', () => assert.strictEqual(BUILDING_STRENGTH.TE, 2));
    test('SH strength === 3', () => assert.strictEqual(BUILDING_STRENGTH.SH, 3));
    test('SA strength === 3', () => assert.strictEqual(BUILDING_STRENGTH.SA, 3));
    test('exactly 5 building types', () =>
        assert.strictEqual(Object.keys(BUILDING_STRENGTH).length, 5));
});

// ============================================================================
// GROUP 12: BUILDING_ALIASES and RESOURCE_ALIASES
// ============================================================================
group('12: BUILDING_ALIASES and RESOURCE_ALIASES', () => {
    test('DWELLING → D',      () => assert.strictEqual(BUILDING_ALIASES['DWELLING'], 'D'));
    test('TRADING POST → TP', () => assert.strictEqual(BUILDING_ALIASES['TRADING POST'], 'TP'));
    test('TEMPLE → TE',       () => assert.strictEqual(BUILDING_ALIASES['TEMPLE'], 'TE'));
    test('STRONGHOLD → SH',   () => assert.strictEqual(BUILDING_ALIASES['STRONGHOLD'], 'SH'));
    test('SANCTUARY → SA',    () => assert.strictEqual(BUILDING_ALIASES['SANCTUARY'], 'SA'));

    test('PRIEST → P',        () => assert.strictEqual(RESOURCE_ALIASES['PRIEST'], 'P'));
    test('PRIESTS → P',       () => assert.strictEqual(RESOURCE_ALIASES['PRIESTS'], 'P'));
    test('POWER → PW',        () => assert.strictEqual(RESOURCE_ALIASES['POWER'], 'PW'));
    test('WORKER → W',        () => assert.strictEqual(RESOURCE_ALIASES['WORKER'], 'W'));
    test('WORKERS → W',       () => assert.strictEqual(RESOURCE_ALIASES['WORKERS'], 'W'));
    test('COIN → C',          () => assert.strictEqual(RESOURCE_ALIASES['COIN'], 'C'));
    test('COINS → C',         () => assert.strictEqual(RESOURCE_ALIASES['COINS'], 'C'));
});

// ============================================================================
// GROUP 13: DEFAULT_EXCHANGE_RATES
// ============================================================================
group('13: DEFAULT_EXCHANGE_RATES', () => {
    test('PW → C at rate 1',  () => assert.strictEqual(DEFAULT_EXCHANGE_RATES.PW.C, 1));
    test('PW → W at rate 3',  () => assert.strictEqual(DEFAULT_EXCHANGE_RATES.PW.W, 3));
    test('PW → P at rate 5',  () => assert.strictEqual(DEFAULT_EXCHANGE_RATES.PW.P, 5));
    test('W  → C at rate 1',  () => assert.strictEqual(DEFAULT_EXCHANGE_RATES.W.C, 1));
    test('P  → C at rate 1',  () => assert.strictEqual(DEFAULT_EXCHANGE_RATES.P.C, 1));
    test('P  → W at rate 1',  () => assert.strictEqual(DEFAULT_EXCHANGE_RATES.P.W, 1));
    test('C  → VP at rate 3', () => assert.strictEqual(DEFAULT_EXCHANGE_RATES.C.VP, 3));
    test('has PW, W, P, C keys', () => {
        const keys = Object.keys(DEFAULT_EXCHANGE_RATES).sort();
        assert.deepStrictEqual(keys, ['C', 'P', 'PW', 'W']);
    });
});

// ============================================================================
// GROUP 14: CULT_TRACKS
// ============================================================================
group('14: CULT_TRACKS', () => {
    test('4 cult tracks', () => assert.strictEqual(CULT_TRACKS.length, 4));
    test('includes FIRE',  () => assert.ok(CULT_TRACKS.includes('FIRE')));
    test('includes WATER', () => assert.ok(CULT_TRACKS.includes('WATER')));
    test('includes EARTH', () => assert.ok(CULT_TRACKS.includes('EARTH')));
    test('includes AIR',   () => assert.ok(CULT_TRACKS.includes('AIR')));
});

// ============================================================================
// GROUP 15: CULT_TRACK_POWER_GAINS
// ============================================================================
group('15: CULT_TRACK_POWER_GAINS', () => {
    test('4 threshold entries', () =>
        assert.strictEqual(CULT_TRACK_POWER_GAINS.length, 4));

    test('thresholds are [2, 4, 6, 9]', () =>
        assert.deepStrictEqual(CULT_TRACK_POWER_GAINS.map(e => e.threshold), [2, 4, 6, 9]));

    test('threshold 2 → PW 1', () =>
        assert.strictEqual(CULT_TRACK_POWER_GAINS[0].PW, 1));
    test('threshold 4 → PW 2', () =>
        assert.strictEqual(CULT_TRACK_POWER_GAINS[1].PW, 2));
    test('threshold 6 → PW 2', () =>
        assert.strictEqual(CULT_TRACK_POWER_GAINS[2].PW, 2));
    test('threshold 9 → PW 3', () =>
        assert.strictEqual(CULT_TRACK_POWER_GAINS[3].PW, 3));
    test('threshold 9 → KEY -1 (KEY cost)', () =>
        assert.strictEqual(CULT_TRACK_POWER_GAINS[3].KEY, -1));

    // only the last entry requires a KEY
    test('only threshold 9 entry has KEY', () => {
        for (let i = 0; i < 3; i++) {
            assert.strictEqual(CULT_TRACK_POWER_GAINS[i].KEY, undefined);
        }
    });

    // thresholds must be strictly increasing
    test('thresholds are strictly increasing', () => {
        for (let i = 1; i < CULT_TRACK_POWER_GAINS.length; i++) {
            assert.ok(CULT_TRACK_POWER_GAINS[i].threshold > CULT_TRACK_POWER_GAINS[i - 1].threshold);
        }
    });
});

// ============================================================================
// GROUP 16: COLOR_WHEEL
// ============================================================================
group('16: COLOR_WHEEL', () => {
    test('7 colors', () => assert.strictEqual(COLOR_WHEEL.length, 7));
    test('starts with yellow', () => assert.strictEqual(COLOR_WHEEL[0], 'yellow'));
    test('ends with red',      () => assert.strictEqual(COLOR_WHEEL[6], 'red'));
    test('contains black',  () => assert.ok(COLOR_WHEEL.includes('black')));
    test('contains blue',   () => assert.ok(COLOR_WHEEL.includes('blue')));
    test('contains green',  () => assert.ok(COLOR_WHEEL.includes('green')));
    test('contains gray',   () => assert.ok(COLOR_WHEEL.includes('gray')));
    test('contains brown',  () => assert.ok(COLOR_WHEEL.includes('brown')));
    test('no duplicates', () =>
        assert.strictEqual(new Set(COLOR_WHEEL).size, COLOR_WHEEL.length));
    // spot-check order (yellow→brown→black→blue→green→gray→red)
    test('order: yellow[0] brown[1] black[2]', () => {
        assert.strictEqual(COLOR_WHEEL[0], 'yellow');
        assert.strictEqual(COLOR_WHEEL[1], 'brown');
        assert.strictEqual(COLOR_WHEEL[2], 'black');
    });
});

// ============================================================================
// GROUP 17: Town / bridge defaults
// ============================================================================
group('17: Town and bridge defaults', () => {
    test('DEFAULT_TOWN_SIZE === 7',    () => assert.strictEqual(DEFAULT_TOWN_SIZE, 7));
    test('DEFAULT_TOWN_COUNT === 4',   () => assert.strictEqual(DEFAULT_TOWN_COUNT, 4));
    test('DEFAULT_BRIDGE_COUNT === 3', () => assert.strictEqual(DEFAULT_BRIDGE_COUNT, 3));
});

// ============================================================================
// GROUP 18: POWER_ACTIONS
// ============================================================================
group('18: POWER_ACTIONS', () => {
    test('6 power actions', () => assert.strictEqual(Object.keys(POWER_ACTIONS).length, 6));

    const names = ['ACT1', 'ACT2', 'ACT3', 'ACT4', 'ACT5', 'ACT6'];
    for (const name of names) {
        test(`${name} exists`, () => assert.ok(POWER_ACTIONS[name]));
        test(`${name} has cost`,  () => assert.ok(typeof POWER_ACTIONS[name].cost === 'object'));
        test(`${name} has gain`,  () => assert.ok(typeof POWER_ACTIONS[name].gain === 'object'));
    }

    test('ACT1 cost.PW === 3',    () => assert.strictEqual(POWER_ACTIONS.ACT1.cost.PW, 3));
    test('ACT1 gain.BRIDGE === 1', () => assert.strictEqual(POWER_ACTIONS.ACT1.gain.BRIDGE, 1));
    test('ACT1 subaction.bridge === 1', () => assert.strictEqual(POWER_ACTIONS.ACT1.subaction.bridge, 1));

    test('ACT2 cost.PW === 3',    () => assert.strictEqual(POWER_ACTIONS.ACT2.cost.PW, 3));
    test('ACT2 gain.P === 1',     () => assert.strictEqual(POWER_ACTIONS.ACT2.gain.P, 1));

    test('ACT3 cost.PW === 4',    () => assert.strictEqual(POWER_ACTIONS.ACT3.cost.PW, 4));
    test('ACT3 gain.W === 2',     () => assert.strictEqual(POWER_ACTIONS.ACT3.gain.W, 2));

    test('ACT4 cost.PW === 4',    () => assert.strictEqual(POWER_ACTIONS.ACT4.cost.PW, 4));
    test('ACT4 gain.C === 7',     () => assert.strictEqual(POWER_ACTIONS.ACT4.gain.C, 7));

    test('ACT5 cost.PW === 4',    () => assert.strictEqual(POWER_ACTIONS.ACT5.cost.PW, 4));
    test('ACT5 gain.SPADE === 1', () => assert.strictEqual(POWER_ACTIONS.ACT5.gain.SPADE, 1));
    test('ACT5 subaction.dig === 1', () => assert.strictEqual(POWER_ACTIONS.ACT5.subaction.dig, 1));

    test('ACT6 cost.PW === 6',    () => assert.strictEqual(POWER_ACTIONS.ACT6.cost.PW, 6));
    test('ACT6 gain.SPADE === 2', () => assert.strictEqual(POWER_ACTIONS.ACT6.gain.SPADE, 2));
    test('ACT6 subaction.transform === 2', () => assert.strictEqual(POWER_ACTIONS.ACT6.subaction.transform, 2));

    // ACT costs must be PW-only
    for (const name of names) {
        test(`${name} cost only uses PW`, () => {
            const costKeys = Object.keys(POWER_ACTIONS[name].cost);
            assert.ok(costKeys.every(k => k === 'PW'));
        });
    }
});

// ============================================================================
// GROUP 19: FACTION_ACTIONS
// ============================================================================
group('19: FACTION_ACTIONS', () => {
    const expected = ['ACTA', 'ACTE', 'ACTG', 'ACTS', 'ACTN', 'ACTW', 'ACTC',
                      'ACTH1', 'ACTH2', 'ACTH3', 'ACTH4', 'ACTH5', 'ACTH6'];
    test('13 faction actions', () =>
        assert.strictEqual(Object.keys(FACTION_ACTIONS).length, 13));

    for (const name of expected) {
        test(`${name} exists`, () => assert.ok(FACTION_ACTIONS[name]));
    }

    test('ACTA gain.CULT === 2', () => assert.strictEqual(FACTION_ACTIONS.ACTA.gain.CULT, 2));
    test('ACTA gain.CULTS_ON_SAME_TRACK === 1', () =>
        assert.strictEqual(FACTION_ACTIONS.ACTA.gain.CULTS_ON_SAME_TRACK, 1));

    test('ACTE dont_block === true', () => assert.strictEqual(FACTION_ACTIONS.ACTE.dont_block, true));
    test('ACTE cost.W === 2',        () => assert.strictEqual(FACTION_ACTIONS.ACTE.cost.W, 2));
    test('ACTE gain.BRIDGE === 1',   () => assert.strictEqual(FACTION_ACTIONS.ACTE.gain.BRIDGE, 1));

    test('ACTG gain.SPADE === 2',    () => assert.strictEqual(FACTION_ACTIONS.ACTG.gain.SPADE, 2));

    test('ACTS gain.FREE_TP === 1',  () => assert.strictEqual(FACTION_ACTIONS.ACTS.gain.FREE_TP, 1));

    test('ACTN gain.FREE_TF === 1',  () => assert.strictEqual(FACTION_ACTIONS.ACTN.gain.FREE_TF, 1));
    test('ACTN gain.TF_NEED_HEX_ADJACENCY === 1', () =>
        assert.strictEqual(FACTION_ACTIONS.ACTN.gain.TF_NEED_HEX_ADJACENCY, 1));

    test('ACTW gain.FREE_D === 1',   () => assert.strictEqual(FACTION_ACTIONS.ACTW.gain.FREE_D, 1));
    test('ACTW gain.TELEPORT_NO_TF === 1', () =>
        assert.strictEqual(FACTION_ACTIONS.ACTW.gain.TELEPORT_NO_TF, 1));

    test('ACTC gain.GAIN_ACTION === 2', () =>
        assert.strictEqual(FACTION_ACTIONS.ACTC.gain.GAIN_ACTION, 2));

    // Shapeshifter actions
    test('ACTH1 show_if === ALLOW_SHAPESHIFT', () =>
        assert.strictEqual(FACTION_ACTIONS.ACTH1.show_if, 'ALLOW_SHAPESHIFT'));
    test('ACTH1 gain.VP === 2', () => assert.strictEqual(FACTION_ACTIONS.ACTH1.gain.VP, 2));
    test('ACTH2 gain.VP === 2', () => assert.strictEqual(FACTION_ACTIONS.ACTH2.gain.VP, 2));
    test('ACTH3 gain.PICK_COLOR === 1', () => assert.strictEqual(FACTION_ACTIONS.ACTH3.gain.PICK_COLOR, 1));
    test('ACTH5 cost.PW === 5',  () => assert.strictEqual(FACTION_ACTIONS.ACTH5.cost.PW, 5));
    test('ACTH6 cost.PW_TOKEN === 5', () => assert.strictEqual(FACTION_ACTIONS.ACTH6.cost.PW_TOKEN, 5));

    // dont_block flags
    for (const name of ['ACTE', 'ACTH1', 'ACTH2', 'ACTH3', 'ACTH4', 'ACTH5', 'ACTH6']) {
        test(`${name} dont_block === true`, () =>
            assert.strictEqual(FACTION_ACTIONS[name].dont_block, true));
    }
    for (const name of ['ACTA', 'ACTG', 'ACTS', 'ACTN', 'ACTW', 'ACTC']) {
        test(`${name} dont_block is not set`, () =>
            assert.notStrictEqual(FACTION_ACTIONS[name].dont_block, true));
    }
});

// ============================================================================
// GROUP 20: FINAL_SCORING
// ============================================================================
group('20: FINAL_SCORING', () => {
    test('network entry exists',     () => assert.ok(FINAL_SCORING.network));
    test('cults entry exists',       () => assert.ok(FINAL_SCORING.cults));

    test('network points deepEqual [18, 12, 6]', () =>
        assert.deepStrictEqual(FINAL_SCORING.network.points, [18, 12, 6]));
    test('network label === network', () =>
        assert.strictEqual(FINAL_SCORING.network.label, 'network'));

    test('cults points deepEqual [8, 4, 2]', () =>
        assert.deepStrictEqual(FINAL_SCORING.cults.points, [8, 4, 2]));

    // Fire & Ice options exist
    const fiOptions = ['connected-distance', 'connected-sa-sh-distance', 'building-on-edge', 'connected-clusters'];
    for (const name of fiOptions) {
        test(`F&I option ${name} exists`, () => assert.ok(FINAL_SCORING[name]));
        test(`F&I option ${name} has fire-and-ice-final-scoring`, () =>
            assert.strictEqual(FINAL_SCORING[name].option, 'fire-and-ice-final-scoring'));
        test(`F&I option ${name} points[0] === 18`, () =>
            assert.strictEqual(FINAL_SCORING[name].points[0], 18));
    }
});

// ============================================================================
// Summary
// ============================================================================
console.log('\n' + '─'.repeat(60));
if (failures.length > 0) {
    console.log('\nFailed tests:');
    for (const { name, err } of failures) {
        console.log(`  FAIL: ${name}`);
        console.log(`        ${err.message}`);
    }
    console.log();
}
console.log(`── Results: ${passed} passed, ${failed} failed ──`);
if (failed > 0) process.exit(1);
