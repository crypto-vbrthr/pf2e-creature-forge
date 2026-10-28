# Creature Forge 1.2.0-rc.2: Independent Defense & Affinity Locks

## User-reported issue

In 1.2.0-rc.1, locking **Defenses** disabled the section reroll for **Immunities, Resistances & Weaknesses**. The issue existed in three layers, not just the rendered button: the editor click handler also rejected the action, and the generator would return without rerolling. In addition, the full-reroll section preservation copied the entire `defenses` object and subtype traits when only the numeric defense block was locked.

## Resolution

- The **Defenses** lock now protects numeric AC, HP, Perception and saves, without implicitly locking immunities, resistances or weaknesses.
- The **Defensive Affinities** lock independently protects those affinity lists, their HP adjustment, and associated resolved subtype traits.
- The affinity reroll button is active whenever affinities are unlocked, irrespective of the numeric defense lock. Both the regular section-button and legacy affinity reroll handler share the same eligibility helper.
- During a full reroll, locked numeric defenses keep their displayed HP even if unlocked affinities change; base HP and compensation are recalculated consistently. If affinities are locked and defenses are rerolled, the old affinity adjustment is retained. If both blocks are locked, both stay unchanged.
- The dedicated **HP** lock and manually modified HP totals remain protected. Other section locks and additive provider APIs were not modified.

## Automated verification

- Five permanent regression tests cover UI reroll eligibility, independent scoped affinity reroll with defenses locked, full reroll with numeric defense lock, affinity-only lock, and simultaneous defense/HP/affinity locks.
- Core test suite: **211/211 passing**, `npm run check` passing.
- Additional audit across 5 creature levels × 8 roles × 8 categories × 5 lock combinations: **1,600 full rerolls**, **0 validation errors**, **0 validator warnings**, and **1,600 successfully compiled NPC Actors**. Checked numerical coherence of HP totals and compensations, and all locked-section retention.
- Public data schema versions unchanged: Request v8, Blueprint v12, Content v11; Embedded Creature Editor v14.

## Foundry validation still needed

Lock **Defenses**, leave **Immunities, Resistances & Weaknesses** unlocked, then use the latter section's dice button. The result must update only affinities while AC, HP, Perception and saves remain fixed. Next, use **Reroll all** to confirm the same. Finally, lock the affinity section and confirm that its dice button becomes disabled. This rc.2 has not been smoke-tested in a live Foundry world yet.
