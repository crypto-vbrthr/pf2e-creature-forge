# Creature Forge 1.2.0-dev.1: Generated Preview Controls

## Scope

Built on the user-supplied Creature Forge 1.1.1 archive. This is a development build, not a Foundry-tested stable release.

### 1. Independent scroll areas

The full layout now has separate, height-bound scroll containers for the concept form and generated creature preview. Both positions survive rendering after edits, rerolls and lock changes. Compact and narrow layouts stack two independent scroll panels. Source selection retains its own scrollable tab, and embedded Effect/Aura/Affliction workspaces retain their existing takeover layout.

### 2. Section-level locking

The following generated parts can be locked independently: attributes; defenses (AC, HP, perception, saves and affinities); HP alone; defensive affinities alone; skills; movement; senses; strikes; spellcasting; abilities; auras; afflictions; loot.

Lock flags are stored in the blueprint's existing `locks` object. Locks preserve data through **Reroll all**, which can still adopt changes to the generation concept. Clicking **Generate** creates a fresh blueprint and starts without prior locks. Existing locks for individual abilities, spells and loot channels continue to work. When a lock retains a high-cost ability or spellcasting package across a concept change, the blueprint may issue a power budget warning; preserving the locked data takes priority over silently discarding it.

### 3. Independent rerolls

Each generated section has a die button to reroll only that section. Locks disable rerolls. Existing granular rerolls for individual abilities, spells, loot channels and HP remain. AC, saves and perception are table/rank-based, and may therefore resolve to the same numeric values when rerolled with unchanged concept settings.

### 4. Numeric adjustments

+ and − buttons change by one the numeric values of attributes, AC, HP, perception, Fortitude/Reflex/Will, skills, strike attack bonuses and generated spellcasting attack/DC values. Numeric modifications change the blueprint directly and are passed to actor compilation. HP updates `baseValue` as well to remain consistent with affinity compensation. Other derived values are **not** silently recalculated when one value is changed (for instance, changing STR does not independently adjust Athletics).

Value bounds and safe paths are whitelisted. Blueprint validation remains active. If an adjusted value must survive **Reroll all**, the relevant section must be locked.

## Automated verification

- `npm run check`: passed.
- `npm test`: **203/203 passed**.
- Dedicated tests: lock whitelist, lock toggles, field adjustments, HP consistency, generated strike adjustment, blueprint validation, compiled Actor source values, scoped reroll, whole-creature reroll respecting locks and concept changes, scroll controls and accessible action markup.
- 168 cross-role/category/level full-reroll audit examples with one preserved ability, one preserved attack and skills: no invalid blueprints, no lost ability locks. Five samples produced expected power-budget warnings where a locked ability cost exceeded the *new* budget after other special-feature generation. No duplicate ability-family warnings after the selector now reserves locked slots before filling the remaining budget.

## Foundry smoke tests recommended

Check layout in the full stand-alone editor and embedded editor, independent scrolling after regeneration, individual lock/re-roll actions, **Reroll all** with an edited concept, inherited/legacy locks, plus/minus values in the compiled NPC sheet, all UI locales, and loot integrations.
