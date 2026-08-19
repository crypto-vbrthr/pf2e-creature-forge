# PF2E Creature Forge 0.8.0 – Mythic Creatures

## Scope

0.8.0 adds first-class mythic NPC generation using the mythic monster adjustments and role templates from *Pathfinder War of Immortals*, pp. 168–169 (*Krieg der Unsterblichen*, pp. 168–169).

## Request / Blueprint contract

Request schema v8 adds:

```js
mythic: {
  enabled: false,
  role: "auto" // auto | ambusher | brute | caster | striker
}
```

Blueprint schema v11 adds a derived `mythic` block containing the resolved role, 3-point resource, resilience saves, conditional resistance/immunity/defenses, mythic skills, and compiled mythic action/passive definitions.

The Embedded Creature Editor contract is v13 and exposes a **Mythic creature** checkbox plus a mythic-role selector.

## Implemented mythic progression

The general War of Immortals progression is applied at its listed thresholds:

- level 1: Mythic Resilience or Mythic Resistance
- level 4: Mythic Power with Mythic Skill or Remove a Condition
- level 7: second defensive mythic adjustment
- level 10: Recharge
- level 13: third defensive mythic adjustment
- level 17: Undying Myth
- level 20: Reroll or Mythic Defenses
- level 23+: Mythic Immunity against non-mythic Strikes or harmful spells

Role templates modify those choices and statistics according to their explicit restrictions.

## Mythic role templates

### Mythic Ambusher / Mythischer Laurer

- extreme Stealth
- Reflex Mythic Resilience at any level, then the remaining save upgrades at 7/13
- Hazard Immunity
- no Mythic Resistance and no Mythic Immunity against Strikes
- automatic mapping from skill paragon/sniper; skirmisher remains mapped to striker by default

### Mythic Brute / Mythischer Schläger

- extreme Athletics
- full-level Mythic Resistance
- Mythic Ferocity
- Titanic Might
- never Mythic Resilience in Will
- automatic mapping from brute/soldier

### Mythic Caster / Mythischer Zauberwirker

- forces spellcasting presence in the effective generation request
- high spell DC/attack, extreme from level 11
- extreme tradition skill
- Recharge Spell mythic power
- never Fortitude Mythic Resilience, Mythic Resistance, or Mythic Immunity against Strikes
- automatic mapping from spellcaster

### Mythic Striker / Mythischer Plänkler

- extreme Acrobatics
- Deadly Striker +1d6 precision after 10 feet of qualifying movement
- Unimpeded
- never Fortitude Mythic Resilience and never Remove a Condition
- automatic mapping from skirmisher/magical striker/custom

## Foundry/PF2E compilation

- adds the `mythic` creature trait
- writes the NPC `system.resources.mythicPoints` pool as 3/3
- materializes mythic powers and role-template abilities as PF2E Action items with mythic provenance and point-cost flags
- keeps conditional mechanics such as Mythic Resistance, Mythic Resilience, Mythic Defenses, Deadly Striker, and Mythic Immunity visible as explicit passive actions rather than pretending they are universally expressible by stable PF2E Rule Elements
- keeps the entire resolved mythic block in Creature Forge provenance flags and integration plan

## Compatibility / schema versions

- module/API: 0.8.0
- request schema: 8
- blueprint schema: 11
- content schema: 10
- Embedded Creature Editor contract: 13

## Verification

- `npm run check`: pass
- permanent automated suite: 177/177 pass
- dedicated 0.8.0 mythic regression coverage: ambusher, brute, caster, striker, automatic role mapping, compiler trait/resource/action output
- full mythic matrix audit: 1,872 generations (26 levels × 18 core categories × 4 mythic roles), zero invalid Blueprints and zero role-template restriction violations
