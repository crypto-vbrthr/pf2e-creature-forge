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

### CreatureGenerationRequest v2

The request captures user intent. 0.2.0 adds a `defensiveAffinities` policy/override section to identity, role, six ability rank choices, defense ranks, offense profile, skill preferences, movement/sense controls, seed/variation, source selections, and high-level feature options.

### CreatureBlueprint v2

The blueprint is a neutral generated result rather than a Foundry Actor document. `identity.resolvedSubtypes` and `defenses` now preserve resolved conceptual inheritance, IWR entries, affinity provenance, and HP adjustments alongside the existing generated statistics and attacks.

Major sections:

- `metadata`
- `identity`
- `statistics.abilities`
- `statistics.ac/hp/perception/saves`
- `defenses.immunities/resistances/weaknesses/hpAdjustment`
- `statistics.skills/speed/senses`
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

## Categories, Subtypes & Defensive Affinities

0.2.0 resolves categories and subtypes before the remaining concept-sensitive generation layers. Definitions can grant traits, imply additional subtypes, and contribute `defensiveAffinities` rules. The resolver gathers rules from the category, all recursively resolved subtypes, and explicit request overrides, then applies predicates, seeded chance, priority, de-duplication, and conflict resolution.

Affinity values can be fixed or resolve from the level-based `minimum` / `maximum` resistance-and-weakness bands. Broad resistances can reduce generated HP; weaknesses can compensate HP according to the selected HP profile. This balance layer is explicit in `defenses.hpAdjustment` and does not silently mutate the table result without provenance.

```text
category + requested subtypes
          |
          +-> implied subtypes
          |
          +-> granted traits
          |
          +-> affinity candidates
                    |
              rule resolution
                    |
        immunity / resistance / weakness
                    |
              HP tradeoff
```

External providers use the same content definitions as the core; the generator contains no module-specific branch for third-party subtypes. Manual request affinities are highest-priority locked entries.

## Skills, Movement & Senses

0.1.4 adds a separate exploration-stat layer. `skills.js` selects appropriate skills using role/category/subtype/ability affinities and resolves their modifiers from the level/rank skill table. `mobility.js` derives land and alternate movement plus low-light vision, darkvision, and scent from the creature concept, while explicit request values always override automatic suggestions.

These systems use dedicated RNG forks and scoped rerolls:

```text
statistics.skills
statistics.movement
statistics.senses
```

The compiler keeps the Blueprint neutral and maps these sections to PF2E NPC `system.skills`, `system.perception.senses`, and `system.attributes.speed` only at compile time.

## Randomness

All generation randomness flows through `SeededRandom`. Components use forked streams such as:

```text
statistics.hp
statistics.abilities
statistics.skills
statistics.movement
statistics.senses
defenses.affinities
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
