import test from 'node:test';
import assert from 'node:assert/strict';
import { ContentRegistry } from '../scripts/core/registry.js';
import { registerCoreContent } from '../scripts/core/core-content.js';
import { CreatureGenerator } from '../scripts/core/generator.js';
import { createGenerationRequest } from '../scripts/core/schemas.js';
import { CreatureEditorSession } from '../scripts/ui/editor-session.js';

function testApi() {
  const registry = new ContentRegistry();
  registerCoreContent(registry);
  const generator = new CreatureGenerator({ registry });
  return {
    createRequest: createGenerationRequest,
    generate: (request) => generator.generate(request),
    generateAsync: async (request) => generator.generate(request),
    reroll: (blueprint, options) => generator.reroll(blueprint, options),
    rerollAsync: async (blueprint, options) => generator.reroll(blueprint, options)
  };
}

for (const asyncMode of [false, true]) {
  test(`draft focus tags survive ${asyncMode ? 'async' : 'sync'} section and single-ability rerolls, plus deselection`, async () => {
    const api = testApi();
    const session = new CreatureEditorSession({ api, request: {
      identity: { name: 'Tag retention', level: 7, category: 'humanoid', role: 'custom' },
      generation: { seed: `focus-retain-${asyncMode}` },
      abilities: { count: 4, powerBudget: 25, focus: [] }
    } });
    if (asyncMode) await session.generateAsync(); else session.generate();
    assert.deepEqual(session.blueprint.metadata.requestSnapshot.abilities.focus, []);

    session.patchRequest({ abilities: { focus: ['fire', 'reaction', 'lightning-extension'] } });
    assert.deepEqual(session.request.abilities.focus, ['fire', 'reaction', 'lightning-extension']);
    assert.deepEqual(session.blueprint.metadata.requestSnapshot.abilities.focus, [], 'simulate existing stale blueprint snapshot');
    const scopes = ['abilities', 'statistics.hp', 'combat.attacks', 'spellcasting'];
    if (session.blueprint.abilities.length) scopes.push(`ability:${session.blueprint.abilities[0].id}`);
    for (const scope of scopes) {
      if (asyncMode) await session.rerollAsync({ scope, seed: `focus-${scope}` });
      else session.reroll({ scope, seed: `focus-${scope}` });
      assert.deepEqual(session.request.abilities.focus, ['fire', 'reaction', 'lightning-extension'], `request focus lost on ${scope}`);
      assert.deepEqual(session.blueprint.metadata.requestSnapshot.abilities.focus, ['fire', 'reaction', 'lightning-extension'], `snapshot focus lost on ${scope}`);
    }

    session.patchRequest({ abilities: { focus: [] } });
    if (asyncMode) await session.rerollAsync({ scope: 'abilities', seed: 'focus-off' });
    else session.reroll({ scope: 'abilities', seed: 'focus-off' });
    assert.deepEqual(session.request.abilities.focus, []);
    assert.deepEqual(session.blueprint.metadata.requestSnapshot.abilities.focus, []);
  });
}

test('scoped generator reroll honors optional updated request and old callers retain legacy snapshot behavior', () => {
  const api = testApi();
  const blueprint = api.generate(createGenerationRequest({
    generation: { seed: 'scope-override' },
    identity: { level: 7 },
    abilities: { count: 2, focus: ['fire'] }
  }));
  const incoming = createGenerationRequest({ ...blueprint.metadata.requestSnapshot, abilities: { ...blueprint.metadata.requestSnapshot.abilities, focus: ['cold', 'poison'] } });
  const old = api.reroll(blueprint, { scope: 'abilities', seed: 'legacy-scope' });
  assert.deepEqual(old.metadata.requestSnapshot.abilities.focus, ['fire']);
  const next = api.reroll(blueprint, { scope: 'abilities', seed: 'new-scope', request: incoming });
  assert.deepEqual(next.metadata.requestSnapshot.abilities.focus, ['cold', 'poison']);
  assert.deepEqual(blueprint.metadata.requestSnapshot.abilities.focus, ['fire'], 'incoming blueprint is not mutated');
});
