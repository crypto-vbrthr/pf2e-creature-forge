# Architecture

## Design rule

Creature Forge has one generation engine and one editor surface. Standalone windows and future host modules are clients of those same public contracts.

```text
External Modules / Encounter Forge / Standalone UI
                    |
                 Public API
                    |
        +-----------+-----------+
        |                       |
 Content Registry          Creature Engine
        |                       |
        +-----------+-----------+
                    |
             CreatureBlueprint
                    |
          Validation / Compiler
                    |
              PF2E NPC Actor
```

## Contracts

### CreatureGenerationRequest v1

The request captures user intent. 0.1.1 includes identity, role, six ability rank choices, defense ranks, offense profile, seed/variation, source selections, and high-level feature options.

### CreatureBlueprint v1

The blueprint is a neutral generated result rather than a Foundry Actor document. `statistics.abilities` and `combat.attacks` now hold real generated data, while later resources remain neutral extension points.

Major sections:

- `metadata`
- `identity`
- `statistics.abilities`
- `statistics.ac/hp/perception/saves/speed`
- `combat.attacks`
- `combat.spellcasting`
- `abilities`
- `resources.effects`
- `resources.auras`
- `resources.afflictions`
- `loot`
- `locks`
- `provenance`
- `diagnostics`

## Core Statistics & Attack Engine

0.1.1 resolves role road maps into level-scaled values. Explicit request ranks override role defaults.

Two-strike generation intentionally creates an internal tradeoff:

```text
accurate: attack rank up, damage rank down
heavy:    attack rank down, damage rank up
```

The engine keeps attack generation separate from Actor compilation. The Blueprint stores semantic attack data, while the compiler maps each generated strike to an embedded PF2E NPC `melee` item.

## Randomness

All generation randomness flows through `SeededRandom`. Components use forked streams such as:

```text
statistics.hp
statistics.abilities
combat.attacks
```

This limits accidental cross-system changes when a new random choice is introduced. `Math.random()` is not used by Creature Forge generation code.

## Rerolls and locks

Scoped rerolls create a new seed, regenerate the relevant subsystem, and preserve unrelated Blueprint sections. Attack entries can be individually retained by setting `locked: true` before an attack-scope reroll.

## Integrations

Creature Forge does not reimplement the other Forge engines. It discovers their public APIs through thin adapters.

Future composition:

```text
Creature ability
  +-- EffectDefinition -> Critical Forge Effect Engine
  +-- AuraDefinition -> Aura Forge
  +-- AfflictionDefinition -> Affliction Forge
  +-- Loot request -> Loot Forge -> Item Forge
```

## Embedded editor

`api.ui.creatureEditor.create()` returns the canonical Embedded Creature Editor (contract v2), which mounts into an arbitrary HTMLElement. The editor owns its scoped form state, validation display, internal scroll region, and persistent bottom action footer. The host owns the surrounding window, tabs, persistence, and lifecycle. The standalone Creature Forge ApplicationV2 is only one host of this surface, exactly as Encounter Forge can be later. Field lookup and event listeners are scoped to the embedded root so neighboring host controls cannot collide with Creature Forge field names.
