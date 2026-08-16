function xmur3(text) {
  let h = 1779033703 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    h = Math.imul(h ^ text.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(seed) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let fallbackCounter = 0;

export function createRandomSeed(prefix = "cf") {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef?.randomUUID) return `${prefix}:${cryptoRef.randomUUID()}`;
  if (cryptoRef?.getRandomValues) {
    const data = new Uint32Array(4);
    cryptoRef.getRandomValues(data);
    return `${prefix}:${[...data].map((n) => n.toString(16).padStart(8, "0")).join("")}`;
  }
  fallbackCounter += 1;
  return `${prefix}:${Date.now().toString(36)}:${fallbackCounter.toString(36)}`;
}

export class SeededRandom {
  constructor(seed = createRandomSeed()) {
    this.seed = String(seed);
    const hash = xmur3(this.seed);
    this.#next = mulberry32(hash());
  }

  #next;

  next() {
    return this.#next();
  }

  int(min, max) {
    const lo = Math.ceil(Number(min));
    const hi = Math.floor(Number(max));
    if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) throw new RangeError("Invalid integer range");
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  chance(probability) {
    const p = Math.max(0, Math.min(1, Number(probability)));
    return this.next() < p;
  }

  pick(values) {
    if (!Array.isArray(values) || values.length === 0) return undefined;
    return values[this.int(0, values.length - 1)];
  }

  weightedPick(values, { weightKey = "weight" } = {}) {
    if (!Array.isArray(values) || values.length === 0) return undefined;
    const normalized = values.map((entry) => {
      if (entry && typeof entry === "object" && !Array.isArray(entry) && "value" in entry) {
        return { value: entry.value, weight: Math.max(0, Number(entry[weightKey] ?? 1)) };
      }
      return { value: entry, weight: 1 };
    });
    const total = normalized.reduce((sum, entry) => sum + entry.weight, 0);
    if (total <= 0) return normalized[0]?.value;
    let cursor = this.next() * total;
    for (const entry of normalized) {
      cursor -= entry.weight;
      if (cursor < 0) return entry.value;
    }
    return normalized.at(-1)?.value;
  }

  shuffle(values) {
    const result = [...(values ?? [])];
    for (let i = result.length - 1; i > 0; i -= 1) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  fork(label) {
    return new SeededRandom(`${this.seed}::${String(label)}`);
  }
}

export function createRandom(seed) {
  return new SeededRandom(seed);
}
