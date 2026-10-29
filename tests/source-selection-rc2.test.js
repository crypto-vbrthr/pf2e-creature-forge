import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentRegistry } from '../scripts/core/registry.js';
import { registerCoreContent } from '../scripts/core/core-content.js';
import { CreatureGenerator } from '../scripts/core/generator.js';
import { listAbilityCandidates } from '../scripts/core/ability-engine.js';
import { generateSpecialFeatures } from '../scripts/core/special-features.js';
import { SeededRandom } from '../scripts/core/rng.js';
import { SpellSourceManager } from '../scripts/core/spell-source-manager.js';
import { createGenerationRequest } from '../scripts/core/schemas.js';

function registry() { const registry = new ContentRegistry(); registerCoreContent(registry); return registry; }

function candidates(sourceSelection) {
  return listAbilityCandidates({
    request: { sources: sourceSelection, abilities: { mode: 'auto', count: 2, complexity: 'standard', focus: [] } },
    registry: registry(), level: 5, roleId: 'custom', category: 'humanoid', subtypes: []
  });
}

test('an explicit empty ability selection removes bundled abilities but legacy [] still enables defaults', () => {
  assert.ok(candidates({ abilities: [] }).length > 0);
  assert.equal(candidates({ abilities: [], explicitSelection: true }).length, 0);
  const core = registry().getDefaultAbilityLibraryIds();
  assert.ok(candidates({ abilities: core, explicitSelection: true }).length > 0);
});

test('explicit off prevents bundled auras and afflictions even when they are required', () => {
  const reg = registry();
  const request = createGenerationRequest({
    sources: { explicitSelection: true, auras: [], afflictions: [] },
    specialFeatures: { auras: { mode: 'required' }, afflictions: { mode: 'required' } }
  });
  const result = generateSpecialFeatures({ request, registry: reg, level: 7, roleId: 'spellcaster', category: 'undead', subtypes: ['ghost'], random: new SeededRandom('strict-libs'), budgetLimit: 15 });
  assert.deepEqual(result.auras, []);
  assert.deepEqual(result.afflictions, []);
  assert.ok(result.diagnostics.some(d => d.code === 'REQUIRED_AURA_UNAVAILABLE'));
});

test('explicit empty spell sources prevent default scans and yield no spells while legacy [] keeps defaults', async () => {
  const before = globalThis.game;
  const pack = { collection: 'pf2e.spells-srd', documentName: 'Item', metadata: {label: 'Spells', packageName: 'pf2e'}, async getIndex() { return []; } };
  const packs = [pack]; packs.get = id => id === pack.collection ? pack : null;
  globalThis.game = { packs };
  try {
    const manager = new SpellSourceManager();
    assert.deepEqual(manager.resolveSelection([]), ['pf2e.spells-srd']);
    assert.deepEqual(manager.resolveSelection([], { explicit: true }), []);
    assert.deepEqual((await manager.ensure({ spells: [], explicitSelection: true })).sources, []);
    assert.deepEqual(manager.listSpells([], { explicit: true }), []);
    assert.deepEqual((await manager.ensure({ spells: [] })).sources, ['pf2e.spells-srd']);
  } finally {globalThis.game = before;}
});

test('generator and request normalization retain explicitly deselected sources', () => {
  const reg = registry();
  const request = createGenerationRequest({
    identity: { name: 'No library', level: 6, role: 'brute', category: 'humanoid' },
    sources: { explicitSelection: true, abilities: [], auras: [], afflictions: [], spells: [] },
    abilities: { count: 2 },
    generation: { seed: 'none-selected' }
  });
  const blueprint = new CreatureGenerator({ registry: reg }).generate(request);
  assert.deepEqual(blueprint.abilities, []);
  assert.equal(blueprint.metadata.requestSnapshot.sources.explicitSelection, true);
  assert.deepEqual(blueprint.metadata.requestSnapshot.sources.abilities, []);
});
