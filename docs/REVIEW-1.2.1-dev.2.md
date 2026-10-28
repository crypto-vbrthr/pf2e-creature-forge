# Creature Forge 1.2.1-dev.2 review

## Scope
Core stabilization before Battlefield Control RC, using the supplied core and Battlefield Control packages.

- UI: curated, grouped focus-tag checkboxes; custom tags remain comma-separated.
- Generation: selection weights continue to account for focus tags (+20 per matching tag/category). No hard filter is introduced.
- Generation: ensure skill values required by generated ability checks (including Hooking Pull / Athletics in Battlefield Control).
- Generation: exclude abilities explicitly tagged melee/ranged if generated attack profile cannot execute them.

## Follow-up
The uploaded Battlefield Control manifest still specifies a minimum stable dependency of Creature Forge 1.2.1. A pre-release such as 1.2.1-dev.2 does not satisfy this constraint under strict semantic-version comparison. Align requirements only when doing the final 1.2.1 stable release / Battlefield Control release candidate.

Skill, attack and focus requirements inferred solely from natural-language ability descriptions are not yet automatically checked; add-on authors should provide structured tags, requirements and interactions. Live Foundry verification remains recommended.
