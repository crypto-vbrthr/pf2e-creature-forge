# Creature Forge 1.2.0 – Stable Release Review

## Release basis

Creature Forge 1.2.0 is a **metadata/documentation promotion only** of 1.2.0-rc.3 following a user-confirmed live Foundry test: creating a creature/NPC no longer raises the `affinities in false` error. There are no changes to gameplay mechanics, generator behavior, client UI, migrations, schema contracts or add-on API compared with the RC.

## Stable functionality

- Independent scroll regions for Concept and Generated Data.
- Per-section locks and rerolls; full rerolls preserve locked preview sections, while fresh generation discards old locks.
- +/- controls for attributes, defensive values, skills, strike bonuses and spell attack/DC, persisted in the Blueprint.
- Separate defensive numeric and affinity locks, including preserved HP totals and correct affinity-compensation reconciliation.
- Foundry-safe dot-free persisted lock storage and normalization of legacy RC lock names on load/compile, eliminating the previously reported Actor creation crash.
- Previous Predator Tactics 0.1.1 and Brutal Physiology 0.1.0 integration audit remains applicable; neither provider API nor selection logic changed in stable.

## Release verification

- The release was produced by extracting the actual reviewed 1.2.0-rc.3 archive and changing only module/package/API versions and release documentation.
- Release metadata consistency covered by the regression suite (manifest, package, API, README and GitHub release URL).
- Complete test suite and JavaScript syntax verification re-run from the finished 1.2.0 ZIP.
- User-confirmed Foundry smoke test is evidence for the RC baseline, not a claim that this archive was separately installed in Foundry.

## Unchanged public contracts

Request v8 · Blueprint v12 · Content v11 · Embedded Creature Editor v14 · runtime-status v2.
