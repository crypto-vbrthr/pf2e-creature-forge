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

The request captures user intent. It stores concept, role, category/subtypes, defense rank choices, random seed, source selections, and high-level options.

### CreatureBlueprint v1

The blueprint is the neutral generated result. It is not a Foundry Actor document. This allows Encounter Forge to keep draft creatures without creating world Actors.

Major sections:

- `metadata`
- `identity`
- `statistics`
- `combat`
- `abilities`
- `resources.effects`
- `resources.auras`
- `resources.afflictions`
- `loot`
- `locks`
- `provenance`
- `diagnostics`

### Content schema v1

All registrable content has a namespaced stable ID and source metadata. The registry owns duplicate detection and bundle rollback.

## Randomness

All generation randomness flows through `SeededRandom`. Components should use forked streams such as `random.fork("statistics.hp")` so adding a random choice in one subsystem does not unnecessarily scramble unrelated subsystems.

`Math.random()` must not be used by Creature Forge generation code or by bundled providers.

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

The module remains usable if optional integrations are missing. Individual generated content can declare harder integration requirements later.

## Embedded editor

`api.ui.creatureEditor.create()` returns an editor that mounts into an arbitrary HTMLElement. The host owns persistence and window lifecycle.

No editor instance is global. Multiple editor instances can exist simultaneously.
