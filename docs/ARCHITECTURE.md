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

### CreatureGenerationRequest v5

The request captures user intent. Schema v5 includes statistics, affinities, movement/senses, ability generation, independent source selections, and optional special-feature controls for Aura/Affliction frequency and `auto | none | required` modes.

### CreatureBlueprint v5

The blueprint is a neutral generated result rather than a Foundry Actor document. Schema v5 stores generated ability instances, de-duplicated Effect Forge resources, optional Aura/Affliction resources, library provenance, locks, diagnostics, and shared special-feature power-budget accounting.

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


## Compendium source discovery

0.2.1 adds a source layer between Foundry compendiums and the semantic content registry. Actor compendiums are scanned through their index for NPC document type and `system.traits.value`. Traits recognized as creature types become discovered category candidates; other observed NPC traits become subtype candidates with observed category-association metadata.

```text
Selected Actor Compendiums
          |
      index scan
          |
  discovery cache
          |
pack-scoped category/subtype definitions
          |
 source-aware ContentRegistry.resolve/listResolved
          |
 CreatureGenerationRequest source filter
```

Scanned definitions remain pack-scoped in the registry. They are not globally activated by being scanned: `ContentRegistry.resolve()` and `listResolved()` filter compendium-discovered definitions against the current request's selected pack ids. Core and ordinary external module definitions are always available. This is what lets two embedded Creature Editors use different source sets at the same time without unregistering each other's content.

The standalone host persists category/subtype source defaults at world scope. Embedded hosts default to request-local source selection and can opt into their own persistence outside Creature Forge.

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


## Ability Engine & Effect Forge integration

0.3.0 adds an independent ability-selection layer after concept/stat generation. The registry first filters legal candidates by level/category/subtype/role, then the Ability Engine applies weighted preferences for concept tags, role, focus tags, and synergies with abilities already selected. Dedicated RNG forks keep selection deterministic for a seed while allowing whole-section and slot-level rerolls.

```text
category + resolved subtypes + role + level
                 |
        ContentRegistry.query(ability)
                 |
          weighted selection
                 |
      ability instances + locks
                 |
        referenced effect ids
                 |
       resources.effects snapshots
```

Effects remain neutral resources rather than being embedded on the source creature as self-effects. Ability `applications` describe target/timing intent and reference stable effect ids. The compiler stores those applications on generated action-item flags for later runtime trigger automation.

The Effect Forge adapter delegates validation, analysis, compilation, item-source creation, application, instant execution, and compatibility checks to Critical Forge when available. The canonical Creature Editor mounts Critical Forge's public Embedded Effect Editor into its own surface and owns only the enclosing ability/resource workflow.

External content uses the same registry contract as core content, so third-party bundles can contribute abilities and their effect definitions without engine branches.

## Aura & Affliction special-feature layer

0.4.0 extends the same content-first architecture to Auras and Afflictions. They are deliberately optional. The request can disable, automatically consider, or require each kind independently. Automatic selection uses seeded concept-sensitive probability, so identical creature parameters can produce different valid special-feature combinations when the seed changes.

```text
category + resolved subtypes + role
                 |
        concept probability
     (rare / normal / high)
                 |
      active Aura/Affliction
             libraries
                 |
       validity + power cost
                 |
        seeded weighted pick
                 |
        +--------+--------+
        |                 |
 resources.auras   resources.afflictions
```

`required` never bypasses concept/source/budget validity. If no candidate is legal, the Blueprint records a warning and leaves the resource list empty rather than attaching an unrelated Aura or Affliction.

Auras and Afflictions reserve from the same total special-feature budget before ordinary abilities are selected. `metadata.specialFeatureBudget` records total, ability, Aura, and Affliction spend so the balance decision remains inspectable.

The canonical editor delegates editing to the public Embedded Aura Forge and Affliction Forge editors. Creature Forge owns selection, provenance, rerolls, locking, and Blueprint storage, not their internal schemas or runtime engines. Core definitions are emitted against Aura Forge schema v1 and Affliction Forge schema v2. Affliction stage Effects use unlimited duration because Affliction Forge owns stage lifecycle.

At Actor creation time, actor-local Aura definitions are assigned through Aura Forge `instances.assignDefinition()`, keeping generated Auras out of the global Aura Library. Afflictions compile to PF2E Action items and manual runtime controls; application delegates to Affliction Forge `engine.applyDefinition()`, which owns controller state and progression.

External modules can register Aura/Affliction libraries with stable provenance. Source selection is request-local for embedded hosts and world-default-capable for the standalone Creature Forge, matching the existing ability-library model.

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

Current composition:

```text
Creature ability
  +-- EffectDefinition -> Critical Forge Effect Engine
  +-- AuraDefinition -> Aura Forge
  +-- AfflictionDefinition -> Affliction Forge
  +-- Loot request -> Loot Forge -> Item Forge
```

## Embedded editor

`api.ui.creatureEditor.create()` returns the canonical Embedded Creature Editor (contract v9), which mounts into an arbitrary HTMLElement. The editor owns its scoped form state, validation display, internal scroll region, persistent bottom action footer, and its own Creature/Sources sub-tabs. The host owns the surrounding window, higher-level navigation, persistence policy, and lifecycle. The standalone Creature Forge ApplicationV2 is only one host of this surface, exactly as Encounter Forge can be later. Field lookup and event listeners are scoped to the embedded root so neighboring host controls cannot collide with Creature Forge field names.
