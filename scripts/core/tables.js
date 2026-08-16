const LEVELS = Array.from({ length: 26 }, (_, index) => index - 1);

function indexed(values) {
  if (values.length !== LEVELS.length) throw new Error(`Expected ${LEVELS.length} values, received ${values.length}`);
  return Object.fromEntries(LEVELS.map((level, index) => [level, values[index]]));
}

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
  return row[normalizedLevel];
}

export function resolveHpRange(level, rank) {
  const range = resolveRankValue(HP_TABLE, level, rank);
  return { min: range[0], max: range[1] };
}
