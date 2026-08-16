const LEVELS = Array.from({ length: 26 }, (_, index) => index - 1);

function indexed(values) {
  if (values.length !== LEVELS.length) throw new Error(`Expected ${LEVELS.length} values, received ${values.length}`);
  return Object.fromEntries(LEVELS.map((level, index) => [level, values[index]]));
}

export const ATTRIBUTE_TABLE = Object.freeze({
  extreme: indexed([null,null,5,5,5,6,6,7,7,7,7,8,8,8,9,9,9,10,10,10,11,11,11,11,11,13]),
  high: indexed([3,3,4,4,4,5,5,5,6,6,6,7,7,7,8,8,8,9,9,9,10,10,10,10,10,12]),
  moderate: indexed([2,2,3,3,3,3,4,4,4,4,4,5,5,5,5,5,6,6,6,6,6,7,7,8,8,9]),
  low: indexed([0,0,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,6,6,6,6,7])
});

export const AC_TABLE = Object.freeze({
  extreme: indexed([18,19,19,21,22,24,25,27,28,30,31,33,34,36,37,39,40,42,43,45,46,48,49,51,52,54]),
  high: indexed([15,16,16,18,19,21,22,24,25,27,28,30,31,33,34,36,37,39,40,42,43,45,46,48,49,51]),
  moderate: indexed([14,15,15,17,18,20,21,23,24,26,27,29,30,32,33,35,36,38,39,41,42,44,45,47,48,50]),
  low: indexed([12,13,13,15,16,18,19,21,22,24,25,27,28,30,31,33,34,36,37,39,40,42,43,45,46,48])
});

const SAVE_EXTREME = [9,10,11,12,14,15,17,18,20,21,23,24,26,27,29,30,32,33,35,36,38,39,41,43,44,46];
const SAVE_HIGH = [8,9,10,11,12,14,15,17,18,19,21,22,24,25,26,28,29,30,32,33,35,36,38,39,40,42];
const SAVE_MODERATE = [5,6,7,8,9,11,12,14,15,16,18,19,21,22,23,25,26,28,29,30,32,33,35,36,37,38];
const SAVE_LOW = [2,3,4,5,6,8,9,11,12,13,15,16,18,19,20,22,23,25,26,27,29,30,32,33,34,36];
const SAVE_TERRIBLE = [0,1,2,3,4,6,7,8,10,11,12,14,15,16,18,19,20,22,23,24,26,27,28,30,31,32];

export const SAVE_TABLE = Object.freeze({
  extreme: indexed(SAVE_EXTREME),
  high: indexed(SAVE_HIGH),
  moderate: indexed(SAVE_MODERATE),
  low: indexed(SAVE_LOW),
  terrible: indexed(SAVE_TERRIBLE)
});

export const PERCEPTION_TABLE = SAVE_TABLE;

export const HP_TABLE = Object.freeze({
  high: indexed([[9,9],[17,20],[24,26],[36,40],[53,59],[72,78],[91,97],[115,123],[140,148],[165,173],[190,198],[215,223],[240,248],[265,273],[290,298],[315,323],[340,348],[365,373],[390,398],[415,423],[440,448],[465,473],[495,505],[532,544],[569,581],[617,633]]),
  moderate: indexed([[7,8],[14,16],[19,21],[28,32],[42,48],[57,63],[72,78],[91,99],[111,119],[131,139],[151,159],[171,179],[191,199],[211,219],[231,239],[251,259],[271,279],[291,299],[311,319],[331,339],[351,359],[371,379],[395,405],[424,436],[454,466],[492,508]]),
  low: indexed([[5,6],[11,13],[14,16],[21,25],[31,37],[42,48],[53,59],[67,75],[82,90],[97,105],[112,120],[127,135],[142,150],[157,165],[172,180],[187,195],[202,210],[217,225],[232,240],[247,255],[262,270],[277,285],[295,305],[317,329],[339,351],[367,383]])
});

export const ATTACK_TABLE = Object.freeze({
  extreme: indexed([10,10,11,13,14,16,17,19,20,22,23,25,27,28,29,31,32,34,35,37,38,40,41,43,44,46]),
  high: indexed([8,8,9,11,12,14,15,17,18,20,21,23,24,26,27,29,30,32,33,35,36,38,39,41,42,44]),
  moderate: indexed([6,6,7,9,10,12,13,15,16,18,19,21,22,24,25,27,28,30,31,33,34,36,37,39,40,42]),
  low: indexed([4,4,5,7,8,9,11,12,13,15,16,17,19,20,21,23,24,25,27,28,29,31,32,33,35,36])
});

const DAMAGE_EXTREME = [
  ["1d6+1",4],["1d6+3",6],["1d8+4",8],["1d12+4",11],["1d12+8",15],["2d10+7",18],["2d12+7",20],["2d12+10",23],["2d12+12",25],["2d12+15",28],["2d12+17",30],["2d12+20",33],["2d12+22",35],["3d12+19",38],["3d12+21",40],["3d12+24",43],["3d12+26",45],["3d12+29",48],["3d12+31",50],["3d12+34",53],["4d12+29",55],["4d12+32",58],["4d12+34",60],["4d12+37",63],["4d12+39",65],["4d12+42",68]
];
const DAMAGE_HIGH = [
  ["1d4+1",3],["1d6+2",5],["1d6+3",6],["1d10+4",9],["1d10+6",12],["2d8+5",14],["2d8+7",16],["2d8+9",18],["2d10+9",20],["2d10+11",22],["2d10+13",24],["2d12+13",26],["2d12+15",28],["3d10+14",30],["3d10+16",32],["3d10+18",34],["3d12+17",36],["3d12+18",37],["3d12+19",38],["3d12+20",40],["4d10+20",42],["4d10+22",44],["4d10+24",46],["4d10+26",48],["4d12+24",50],["4d12+26",52]
];
const DAMAGE_MODERATE = [
  ["1d4",3],["1d4+2",4],["1d6+2",5],["1d8+4",8],["1d8+6",10],["2d6+5",12],["2d6+6",13],["2d6+8",15],["2d8+8",17],["2d8+9",18],["2d8+11",20],["2d10+11",22],["2d10+12",23],["3d8+12",25],["3d8+14",27],["3d8+15",28],["3d10+14",30],["3d10+15",31],["3d10+16",32],["3d10+17",33],["4d8+17",35],["4d8+19",37],["4d8+20",38],["4d8+22",40],["4d10+20",42],["4d10+22",44]
];
const DAMAGE_LOW = [
  ["1d4",2],["1d4+1",3],["1d4+2",4],["1d6+3",6],["1d6+5",8],["2d4+4",9],["2d4+6",11],["2d4+7",12],["2d6+6",13],["2d6+8",15],["2d6+9",16],["2d6+10",17],["2d8+10",19],["3d6+10",20],["3d6+11",21],["3d6+13",23],["3d6+14",24],["3d6+15",25],["3d6+16",26],["3d6+17",27],["4d6+14",28],["4d6+15",29],["4d6+17",31],["4d6+18",32],["4d6+19",33],["4d6+21",35]
];

function indexedDamage(values) {
  return indexed(values.map(([formula, average]) => Object.freeze({ formula, average })));
}

export const ATTACK_DAMAGE_TABLE = Object.freeze({
  extreme: indexedDamage(DAMAGE_EXTREME),
  high: indexedDamage(DAMAGE_HIGH),
  moderate: indexedDamage(DAMAGE_MODERATE),
  low: indexedDamage(DAMAGE_LOW)
});

const SKILL_EXTREME = [8,9,10,11,13,15,16,18,20,21,23,25,26,28,30,31,33,35,36,38,40,41,43,45,46,48];
const SKILL_HIGH = [5,6,7,8,10,12,13,15,17,18,20,22,23,25,27,28,30,32,33,35,37,38,40,42,43,45];
const SKILL_MODERATE = [4,5,6,7,9,10,12,13,15,16,18,19,21,22,24,25,27,28,30,31,33,34,36,37,38,40];
const SKILL_LOW = [
  [1,2],[2,3],[3,4],[4,5],[5,7],[7,8],[8,10],[9,11],[11,13],[12,14],[13,16],[15,17],[16,19],
  [17,20],[19,22],[20,23],[21,25],[23,26],[24,28],[25,29],[27,31],[28,32],[29,34],[31,35],[32,36],[33,38]
];

export const SKILL_TABLE = Object.freeze({
  extreme: indexed(SKILL_EXTREME),
  high: indexed(SKILL_HIGH),
  moderate: indexed(SKILL_MODERATE),
  low: indexed(SKILL_LOW.map(([min, max]) => Object.freeze({ min, max })))
});

export function resolveSkillValue(level, rank, random = null) {
  const entry = resolveRankValue(SKILL_TABLE, level, rank);
  if (typeof entry === "number") return entry;
  const min = Number(entry.min);
  const max = Number(entry.max);
  if (random?.int) return random.int(min, max);
  return Math.round((min + max) / 2);
}

export function assertCreatureLevel(level) {
  const value = Number(level);
  if (!Number.isInteger(value) || value < -1 || value > 24) {
    throw new RangeError(`Creature level must be an integer from -1 to 24; received ${level}`);
  }
  return value;
}

export function resolveRankValue(table, level, rank) {
  const normalizedLevel = assertCreatureLevel(level);
  const row = table?.[rank];
  if (!row || !(normalizedLevel in row)) throw new RangeError(`Unsupported rank '${rank}' for level ${normalizedLevel}`);
  const value = row[normalizedLevel];
  if (value === null || value === undefined) throw new RangeError(`Rank '${rank}' is unavailable at level ${normalizedLevel}`);
  return value;
}

export function resolveAttributeValue(level, rank) {
  if (rank === "terrible") return -5;
  return resolveRankValue(ATTRIBUTE_TABLE, level, rank);
}

export function resolveHpRange(level, rank) {
  const range = resolveRankValue(HP_TABLE, level, rank);
  return { min: range[0], max: range[1] };
}

export function resolveAttackDamage(level, rank) {
  const entry = resolveRankValue(ATTACK_DAMAGE_TABLE, level, rank);
  return { formula: entry.formula, average: entry.average };
}
