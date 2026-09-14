# PF2E Creature Forge 1.1.1 – Affliction Delivery Host Hotfix Review

## Scope

This patch addresses a reported hosted-Affliction mismatch where a generated curse could be attached to an unrelated passive ability such as **Dense Bones / Dichte Knochen** and presented as being transmitted "on use".

## Root cause

The host resolver assigned positive baseline scores even when none of a delivery profile's preferred concept hints matched. Because abilities were searched before attacks for curses, an unrelated passive ability could still win. The resolver could then fall through to an equally unrelated attack.

## Fix

- Preferred delivery criteria are now eligibility criteria as well as ranking hints: when a profile declares preferred tags, attack names, traits, or damage types, at least one preferred value must actually match.
- A host type with no concept hints is skipped when the profile contains concept hints for another host type.
- Passive abilities are ineligible for `on-use` delivery even when their tags would otherwise match.
- If no compatible carrier remains, the existing manual delivery path is used.

## Regression coverage

New tests cover:

1. A curse with an unrelated passive `Dense Bones`-style ability plus a generic melee attack falls back to manual delivery.
2. A passive ability tagged `curse` still cannot host `on-use` delivery.
3. An attack profile with an explicit preferred attack name rejects an unrelated attack.
4. A genuinely matching active curse ability still wins over attacks.

## Compatibility

No public schema changes. Request v8, Blueprint v12, Content v11, Embedded Creature Editor v13, and runtime-status v2 remain unchanged. Existing persisted creatures are unaffected until regenerated or their Affliction delivery is resolved again.

## Verification

- Full automated suite: **195/195 passing tests**.
- `npm run check`: clean.
- Release metadata aligned to **1.1.1**.

## Result

Creature Forge now fails closed to manual Affliction application instead of inventing a semantically unrelated automatic carrier.
