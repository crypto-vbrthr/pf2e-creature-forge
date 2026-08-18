# Changelog

## 0.7.1 - Inline Area Templates

- Added native PF2E `@Template[...]` inline template links to compiled creature abilities whenever explicit area geometry is available. Clicking the link places the matching measured template on the current scene.
- Dragon Breath now always presents its generated cone/line as a clickable template using the same seeded shape and distance already stored in `ability.mechanics.area`.
- Added explicit core area geometry for existing area abilities such as terrifying roar/moan, wing buffet, elemental burst, unstable discharge, spore bloom, psychic pulse, giant debris, and similar powers, so their descriptions can provide usable templates instead of area prose alone.
- Supports PF2E burst, cone, emanation, and line templates plus optional line width. German inline labels use the existing metric presentation while PF2E receives canonical feet internally.
- Added regression coverage that all static core abilities tagged `area` have template geometry and that compiled Dragon Breath descriptions contain a valid PF2E inline-template link.
- Promoted API/module version to 0.7.1. Request schema remains v7, Blueprint/content schemas remain v10, and Embedded Creature Editor contract remains v12.
- Expanded automated coverage to 159 passing tests.

## 0.7.0 - Expanded Creature Abilities & Signature Powers

- Added a first-class signature-power layer on top of the normal ability library. Signature definitions remain content-library entries but are resolved in a dedicated seeded phase before incidental Aura/Affliction spending.
- Added elemental Dragon Breath as the first dynamic signature power. Fire, cold, electricity, acid, and poison affinities map directly; generic air/water/earth/metal/wood dragon affinities use Creature Forge fallback breath profiles. Dragons without a recognized affinity do not receive an arbitrary breath weapon.
- Dragon Breath uses the GM Core limited-use area-damage progression from levels -1 through 24, a high creature-building DC, a basic Reflex save (Fortitude for poison), seeded cone/line shape where appropriate, and a descriptive 1d4-round recharge.
- Added generated Effect Forge direct-damage resources for Dragon Breath. The current runtime applies full damage to selected failed-save targets; basic-save half/double adjudication remains explicit rather than pretending to automate the PF2E save workflow.
- Added automatic signature budget allowance when the shared ability budget is set to Auto. Manual power budgets remain exact and receive no hidden bonus.
- Signature abilities are retained during whole-ability rerolls and can be rerolled individually without losing their signature semantics; generated effect resources are rebuilt with them.
- Expanded the core library with Dragon wing buffet, undead life drain/deathless recovery, construct emergency repair/unstable discharge, elemental surge/living hazard, plant/fungus tendrils and spore bloom, ooze adhesive/corrosive powers, planar/celestial/fiend reactions, aberrant psychic/spatial abilities, and giant sweeping/debris attacks.
- Added clumsy, sickened, stupefied, and slowed core Effect Forge definitions for expanded ability content.
- Added signature mechanics presentation to the Creature Editor and compiled PF2E action descriptions, plus public `api.abilities.signature` helpers.
- Promoted API/module version to 0.7.0 and Blueprint/content schemas to v10. Request schema remains v7 and Embedded Creature Editor contract remains v12.
- Expanded automated coverage to 156 passing tests.

## 0.6.5 - Deferred Loot Dialog & Sheet Layout Fix

- Stopped injecting deferred-loot markup into the PF2e NPC ActorSheet form; this injection could become a new grid child and collapse the normal PF2e sheet layout.
- Changed the GM-only **Loot / Beute** header control to open a dedicated non-modal Foundry `DialogV2`.
- Moved deferred salvage/hoard status plus create/recreate/open actions into that dialog.
- Removed all deferred-loot actor-sheet render hooks; Creature Forge now touches only the sheet header controls.
- Kept the PF2e 8.4 Treasure normalization and direct Foundry/PF2e materialization hardening from 0.6.4 unchanged.
- Added a regression test asserting that deferred-loot UI never registers actor-sheet render-DOM hooks.
- Promoted API/module version to 0.6.5; request schema remains v7, Blueprint/content schemas remain v9, and Embedded Creature Editor contract remains v12.

## 0.6.4 - Deferred Loot PF2e 8.4 Compatibility Fix

- Fixed missing **Beute/Loot** header button on PF2e 8.4 NPC sheets by registering the legacy ApplicationV1 `getApplicationHeaderButtons` / `getActorSheetHeaderButtons` and render hook chain alongside Foundry v14 generic hooks.
- Confirmed PF2e 8.4 NPC sheets still extend Foundry ApplicationV1 ActorSheet; the unrelated built-in **Bogen/Sheet** control is no longer treated as the Creature Forge loot entry point.
- Added a PF2e 8.4 treasure-source normalizer: legacy `system.stackGroup`, `usage`, `apex`, `subitems`, and stale schema fields are removed before persistence; treasure category/default physical fields are normalized.
- Fixed decimal treasure prices such as `7.5 gp`: PF2e 8.4 PriceField requires integer coin denominations, so values are converted to canonical pp/gp/sp/cp integers.
- Deferred loot now uses the native Foundry/PF2e Actor + embedded Item writer in real Foundry worlds. Loot Forge remains the generator but its older persistence helper can no longer reintroduce pre-8.4 item fields.
- Added regression coverage for PF2e 8.4 legacy sheet hooks and strict treasure source normalization.
- Promoted API/module version to 0.6.4; request schema remains v7, Blueprint/content schemas remain v9, and Embedded Creature Editor contract remains v12.

## 0.6.3 - Deferred Loot Materialization & Sheet Entry Fix

- Added an explicit GM-only **Beute / Loot** ApplicationV2 header control for Creature Forge NPCs with deferred loot; it navigates to the Creature Forge loot panel instead of leaving discovery to PF2E's generic **Bogen / Sheet** control.
- Fixed body-salvage treasure sources to match the PF2E/Loot Forge treasure schema by removing invalid creature-only `level`, `size`, and `traits` fields and using treasure-compatible bulk/stack fields.
- Sanitized copied hoard item sources before embedding them in a deferred Loot Actor.
- Hardened Loot Forge integration by preferring `addLootToActor()` when available, allowing Creature Forge to clean up an incomplete Actor if item/currency materialization throws.
- Made provenance persistence, automatic Loot-Actor sheet opening, and source-sheet refresh non-fatal after successful creation so UI follow-up failures cannot masquerade as creation failures.
- Added more useful materialization error details to the GM notification and console.
- Promoted API/module version to 0.6.3; request schema remains v7, Blueprint/content schemas remain v9, and Embedded Creature Editor contract remains v12.
- Expanded automated coverage to 145 passing tests.

## 0.6.2 - Deferred Loot Label & UX Cleanup

- Clarified the combined deferred-loot action label from **Gesamtbeute erzeugen** to **Beute erzeugen** in German and from **Create combined loot** to **Create loot** in English.
- Kept the explicit **Creature Forge: Beute** panel title and the channel-specific **Überreste erzeugen** / **Hort erzeugen** actions unchanged so the NPC-sheet workflow is immediately distinguishable from Foundry's generic sheet controls.
- Updated the embedded fallback localization catalog together with the shipped DE/EN language files, preventing raw or stale labels when Foundry localization returns keys unchanged.
- Promoted API/module version to 0.6.2; request schema remains v7, Blueprint/content schemas remain v9, and Embedded Creature Editor contract remains v12.

## 0.6.1 - Deferred Loot UX

- Added a GM-only deferred-loot panel to generated PF2E NPC sheets when body salvage and/or hoard/environment loot exists.
- Added per-channel summaries with item counts and estimated GP value so deferred treasure is visible without materializing it immediately.
- Added one-click creation of body-salvage Loot Actors, hoard Loot Actors, or a combined Loot Actor when both channels are still untouched.
- Persisted materialization provenance on the source NPC so already-created deferred loot can be reopened instead of duplicated accidentally.
- Added missing-actor recovery: if a previously materialized Loot Actor was deleted, the NPC panel reports it and offers recreation.
- Preserved deferred-loot materialization records across carried-loot refreshes.
- Kept automatic Actor creation disabled for deferred loot; the GM still decides when salvage/hoard becomes a world Actor.
- Added ApplicationV2 runtime-sheet integration plus a legacy ApplicationV1 fallback without coupling to PF2E sheet DOM internals.
- Promoted API/module version to 0.6.1; request schema remains v7, Blueprint/content schemas remain v9, and Embedded Creature Editor contract remains v12.
- Expanded automated coverage to 142 passing tests.

## 0.6.0 - Loot, Equipment & Signature Items Integration

- Added first-class loot planning with independent carried-equipment, signature-item, body-salvage, and hoard/environment channels.
- Added overall and per-channel `auto | none | required` policies with category/role/level/variation-sensitive automatic probabilities; automatic generation may intentionally select no loot.
- Added Loot Forge delegation for carried equipment and hoards, Item Forge delegation for signature items, and a Loot Forge signature fallback when Item Forge is unavailable, errors, or returns no item.
- Added host-local Item-compendium selection for loot generation without mutating Loot Forge or Item Forge world defaults.
- Added generated body-salvage definitions that remain deferred rather than being incorrectly carried by the living NPC.
- Added Actor runtime materialization for carried equipment/signature items with ownership flags and idempotent cleanup that preserves manual inventory.
- Added deferred-loot creation through Loot Forge (or a Foundry Loot Actor fallback), combining hoard treasure and salvage only when explicitly requested.
- Added whole-loot and per-channel rerolls plus per-channel locks; locked generated payloads are not regenerated by provider enrichment.
- Added public `api.loot` planning/generation/source/status/deferred-actor operations and corresponding `api.runtime` loot materialize/refresh/cleanup operations.
- Hardened `api.createActor()` so unresolved synchronous loot plans are asynchronously enriched before compilation/materialization.
- Fixed loot-integration diagnostics so provider error codes cannot overwrite Creature Forge diagnostic codes.
- Expanded the Creature Editor with loot policy/profile/environment controls, source selection, preview/status, reroll and lock controls.
- Promoted API/module version to 0.6.0, request schema to v7, Blueprint/content schemas to v9, and Embedded Creature Editor contract to v12.
- Expanded automated coverage to 140 passing tests.

## 0.5.2 - Core Review & Runtime Hardening

- Performed a broader generation/runtime review across boundary levels, all core roles, and all core creature categories; added a permanent boundary review matrix to the automated suite.
- Hardened `api.createActor()` so optional Effect, Aura/Affliction, and spell runtime failures are isolated after Actor creation. One failed integration no longer prevents the remaining runtime subsystems or caller `postCreate` hooks from running.
- Added consolidated Creature Forge runtime diagnostics/status, persisted on the generated Actor when possible, plus `{ strictRuntime: true }` for callers that deliberately want runtime-initialization failures to throw.
- Made spell materialization idempotent: Creature Forge-owned embedded spells are cleaned before refresh while manually added spells are preserved.
- Isolated missing/failing spell source UUIDs per spell, prevented ghost prepared-slot references, and added diagnostics for source-resolution/materialization/slot-update failures.
- Added `api.runtime.refreshSpellcasting(actor, blueprint)` as the explicit idempotent spell refresh operation.
- Fixed cleanup ownership for actor-local Auras originating from external Aura libraries by tagging the local snapshot with Creature Forge provenance.
- Hardened Affliction reference cleanup so one broken host Item cannot abort cleanup of the remaining references.
- Reworked generated Affliction host-description blocks with stable sentinel markers and migration cleanup for legacy 0.4.2-0.5.1 nested wrappers; repeated compile/refresh is now structurally idempotent.
- Expanded Blueprint validation for schema compatibility, level/size identity, duplicate runtime IDs, attack shape/range, resource IDs, spellcasting IDs, and hosted-Affliction carrier references. Missing carriers degrade to a warning because runtime retains the manual fallback.
- Added a localized partial-runtime warning in the Creature Editor when the Actor is created successfully but an optional integration could not fully initialize.
- Verified generation across 1,008 additional level/role/category combinations during the review with no invalid Blueprints.
- Expanded the permanent automated suite to 132 passing tests.
- Promoted API/module version to 0.5.2; request schema remains v6, Blueprint/content schemas remain v8, and Embedded Creature Editor contract remains v11.

## 0.5.1 - Required Special Feature Budget Fix

- Fixed explicitly required Auras and Afflictions being silently suppressed when spellcasting or another special feature had already consumed the shared power budget.
- `required` Aura/Affliction generation now mirrors required spellcasting: a valid matching feature is kept even when it exceeds the remaining budget, with an explicit over-budget diagnostic.
- Automatic Aura/Affliction generation remains budget-constrained and unchanged.
- Clarified `REQUIRED_*_UNAVAILABLE` diagnostics so they now mean that no concept/source-compatible candidate exists, not merely that the remaining budget is too small.
- Added regression coverage for required Aura over-budget behavior and the reported `Spellcaster + required standard spellcasting + required Affliction` case.
- Promoted API/module version to 0.5.1; request, Blueprint/content schemas, and Embedded Editor contract remain unchanged.

## 0.5.0 - Spellcasting & Thematic Spell Selection

- Added first-class spellcasting request/Blueprint contracts with `auto | none | required` generation modes.
- Added concept-sensitive spellcasting probability, tradition/style selection, thematic weighting, and explicit theme hints.
- Added GM Core spell DC and spell-attack tables for levels -1 through 24 and automatic highest spell rank by creature level.
- Added spell-compendium indexing and source selection for normal spells/cantrips; rituals and focus spells are intentionally excluded from this milestone.
- Added innate, prepared, and spontaneous spellcasting profiles with focused/standard/broad breadth.
- Added spellcasting power costs to the shared special-feature budget so magic competes with Auras, Afflictions, and ordinary abilities.
- Added whole-spellcasting and per-spell seeded rerolls/locks with previous-spell exclusion.
- Added PF2E NPC spellcasting-entry compilation and post-create spell materialization, including prepared slot references, spontaneous rank pools, innate daily uses, and at-will cantrips.
- Added core spell profiles for elemental, ghost, celestial, fiend, fey, undead, fire/cold/electricity/poison concepts and support for external `spellProfile` registration.
- Added a dedicated spell-compendium source selector to the canonical Embedded Creature Editor.
- Extended `api.spells`, `api.sources`, and `api.runtime` for spell discovery, preparation, inspection, power estimation, and Actor materialization/cleanup.
- Preserved the legacy `options.spellcasting` alias when no first-class `spellcasting.mode` is supplied.
- Promoted request schema to v6, Blueprint/content schemas to v8, Embedded Creature Editor contract to v11, and API/module version to 0.5.0.
- Expanded automated regression coverage for source filtering, thematic selection, spell power budgeting, rerolls, compiler shape, and PF2E runtime materialization.

## 0.4.3 - Affliction Runtime Localization Fix

- Fixed English Affliction delivery UI fragments on otherwise German generated NPC sheets (`Transmits affliction`, `Delivery`, raw trigger/application slugs).
- Regenerated the embedded Creature Forge DE/EN fallback catalog from the shipped language files so all 484 package-owned keys are covered in both languages.
- Localized hosted Affliction metadata to labels such as `Überträgt Leiden`, `Übertragung`, `Bei verursachtem Schaden`, and `Automatisch` when Foundry returns raw localization IDs.
- Added regression coverage for the new Affliction runtime labels and a full parity test that fails whenever a shipped language key is missing from the embedded fallback catalog.
- Kept Blueprint/content schemas at v7 and Embedded Creature Editor contract at v10; this release changes localization only.
- Promoted API/module version to 0.4.3.
- Expanded automated coverage to 107 passing tests.

## 0.4.2 - Affliction Library Bridge & Delivery Fix

- Added a real Affliction Forge library bridge so Creature Forge can use enabled provider/world Affliction libraries as generation sources instead of relying only on its own small Affliction registry.
- Exposed bridged Affliction Forge libraries in the Creature Forge Sources tab while keeping implicit catch-all Item compendium libraries opt-in to avoid scanning every Item pack by default.
- Preserved canonical Affliction Forge `templateUuid` provenance for unchanged library afflictions and use the source template directly at runtime instead of creating duplicate actor-local templates.
- Editing a bridged affliction in the Embedded Affliction Editor now detaches it from the canonical source template and safely materializes it as creature-local content.
- Added semantic bridge metadata for poison, disease, curse, known traits/categories/subtypes, level windows, and preferred delivery profiles.
- Preserved published/library Affliction level and save DC instead of silently rescaling bridged definitions to the generated creature level.
- Hardened delivery host resolution with Creature Forge flag lookup plus Blueprint-order fallback for PF2E-normalized melee/action Items.
- Added post-write round-trip verification for Affliction Forge references. A delivery is considered automatic only when the reference can actually be read back from the host Item.
- Failed or ineligible automatic bindings now degrade to a visible manual-application fallback with diagnostics instead of silently claiming to be linked.
- Verified hosted afflictions display their successful binding in the generated NPC description; failed bindings display an explicit warning.
- Manual application of unchanged library afflictions delegates to Affliction Forge `engine.applyTemplate()` using the canonical template UUID; detached/core afflictions continue through `engine.applyDefinition()`.
- Added `api.afflictions.libraries` and expanded `api.sources` preparation/status APIs to include the Affliction Forge bridge.
- Promoted API/module version to 0.4.2, Blueprint/content schemas to v7, and Embedded Creature Editor contract to v10.
- Expanded automated coverage to 105 tests.

## 0.4.1 - Affliction Delivery & Aura/Affliction Runtime Hardening

- Added concept-sensitive Affliction delivery assignment to compatible attacks and abilities.
- Added actor-local Affliction Forge template materialization plus native Affliction references for hosted delivery.
- Added Aura validation/reconciliation hardening and special-feature cleanup/refresh runtime operations.
- Kept natural creature venom separate from consumable injury-poison charge semantics.

## 0.4.0 - Auras & Afflictions Integration

- Added optional concept-sensitive Aura and Affliction generation with independent `auto`, `none`, and `required` modes.
- Added `rare`, `normal`, and `high` special-feature frequency; automatic generation may deliberately produce no Aura and/or no Affliction.
- Added seeded category/subtype-aware probability and weighted selection for Aura/Affliction candidates.
- Added a shared special-feature power budget: selected Auras and Afflictions reserve power before ordinary abilities are generated.
- Added scoped Aura/Affliction/special-feature rerolls plus lock preservation.
- Added core Aura and Affliction starter libraries and public external `registerAuraLibrary()` / `registerAfflictionLibrary()` APIs.
- Added Aura/Affliction library controls to the Sources tab with standalone world defaults and embedded-host-local source behavior.
- Added Embedded Aura Forge and Affliction Forge editors in the same full-width subeditor workspace used by Effect Forge.
- Added actor-local Aura materialization through Aura Forge `instances.assignDefinition()` so generated Auras do not populate the global Aura Library.
- Added generated PF2E Affliction Action items and a manual **Apply affliction** runtime control delegated to Affliction Forge `engine.applyDefinition()`.
- Added public Aura/Affliction validation/application bridges and special-feature runtime APIs.
- Aligned core Aura definitions with the supplied Aura Forge schema v1 contract, including valid `turnStart` events and trigger-based instant damage.
- Aligned core Affliction definitions with the supplied Affliction Forge schema v2 contract and unlimited stage-effect duration owned by the Affliction Engine.
- Promoted request, Blueprint, and content schemas to v5; Embedded Creature Editor contract to v9; API/module version to 0.4.0.
- Expanded automated coverage to 99 tests.

## 0.3.8 - Ability Sources, Power Budget & Dependency Hardening

- Added selectable external ability libraries and world/host-local source selection.
- Added per-ability power costs, automatic/manual ability budgets, dependency validation, and budget-aware rerolls.
- Excluded abilities with missing Effect/Aura/Affliction dependencies before weighted selection.
- Preserved library provenance and power metadata through generation and compilation.

## 0.3.7 - Localization & Ability Presentation Regression Fix

- Hardened Creature Forge localization with an embedded DE/EN fallback catalog for package-owned keys, while continuing to use Foundry i18n for external/system content.
- Fixed the regression where unresolved package translations caused most of the Creature Forge UI to fall back to English and the Open/window title controls to show raw localization IDs.
- Restored localized generated ability names and descriptions in the editor and compiled PF2E Action items.
- Localized built-in ability trait chips and Effect timing labels instead of showing raw slugs such as `fear`, `mental`, `trigger`, or `failed-save`.
- Replaced the raw `pf2e-creature-forge` source marker on core ability cards with a localized `Creature Forge Core/Kern` label.
- Applied Effect definitions now receive their localized name, mechanical explanation, and localized originating ability name even if Foundry did not resolve the module language dictionary.
- Added regression coverage for missing/stale Foundry package localization, German ability compilation, and applied Effect explanation/source text.
- Promoted API/module version to 0.3.7.

## 0.3.6 - Applied Effect Explanations

- Added localized explanatory descriptions to all built-in Creature Forge EffectDefinitions.
- Applied effects now carry their explanation into the PF2E Effect item created by Effect Forge instead of showing an empty description.
- Manual runtime application appends a small localized source note naming the creature ability that applied the effect.
- Materialized runtime Effect resources also receive the localized explanation, while remaining ability-agnostic for safe reuse.
- Explicit descriptions edited through the Embedded Effect Editor continue to take precedence over the built-in description key.
- External effect content can opt into the same behavior through a `descriptionKey` on the registered effect resource.
- Embedded Effect Editor opening now resolves a description key into the current Foundry language when the stored definition has no explicit description.
- Promoted API/module version to 0.3.6.

## 0.3.5 - Effect Runtime Control UX

- Reworked generated ability runtime rows so the linked Effect, timing metadata, and executable apply action are visually separated.
- Promoted **Apply effect** to a high-contrast red/gold action button with stronger hover, focus, and disabled states.
- Added a framed linked-effect reference chip and a compact timing badge for faster scanning on PF2E NPC sheets.
- Localized built-in runtime timing values (`after-use`, `trigger`, `failed-save`, `on-hit`, and `on-success`) instead of exposing raw English slugs.
- Kept the runtime layout responsive: on narrow sheets the apply action expands to a full-width control instead of crowding the linked-effect row.
- Kept runtime behavior and Effect Forge application semantics unchanged.
- Promoted API/module version to 0.3.5.

## 0.3.4 - Runtime Localization & Navigation Fix

- Localized EffectDefinitions immediately before manual application so applied effects use the active Foundry language.
- Replaced the former navigation-like apply control with a real `button[type=button]`.
- Captured runtime apply clicks before PF2E/Foundry sheet navigation handlers can interpret them.
- Added regression coverage for localized application and navigation-free runtime controls.
- Promoted API/module version to 0.3.4.

## 0.3.3 - Effect Materialization & Manual Runtime

- Added post-creation materialization of ability-linked EffectDefinitions through Critical/Effect Forge.
- Persistent linked effects now receive real world PF2E Effect Items in a dedicated `PF2E Creature Forge – Runtime Effects` folder instead of remaining Blueprint-only references.
- Rewrote generated NPC ability descriptions after materialization with actual Foundry `@UUID` links to the linked Effect items.
- Added a manual **Apply effect** control directly beside each linked effect in generated ability descriptions.
- Added target resolution for `self`, singular selected-target, and plural selected-target application modes.
- Routed manual application through Effect Forge `effects.apply()` so persistent and instant components continue to use the canonical Effect Engine.
- Added runtime source provenance on materialized world effect Items and automatic cleanup when the originating Actor is deleted.
- Exposed `api.runtime` operations for resolve/apply/materialize/refresh/cleanup plus Effect Forge `toItemSources`, `createItem`, and `createItems` bridge methods.
- Kept actor creation resilient when Effect Forge materialization is unavailable: ability references remain readable, while runtime apply controls are only emitted when the Effect API is available.
- Added automated runtime/materialization coverage and expanded the suite to 73 tests.
- Promoted API/module version to 0.3.3.

## 0.3.2 - Effect Editor Layout & Scroll Hardening

- Fixed the Creature Editor jumping to the top after closing an embedded ability Effect Editor.
- Prevented the hidden creature scroll element used during effect mode from overwriting the previously captured tab scroll position with a synthetic `0`.
- Kept return-to-creature behavior stable for Effect Editor close and other re-renders originating from effect mode.
- Refined the wide Effect Editor host workspace and let Critical Forge 1.0.1-rc.4 own its embedded palette, panel framing, field borders, button styling, and component-type colors.
- Increased the nested Effect Editor content width and kept component controls visually grouped instead of stretching small component fields across the entire workspace.
- Promoted the Embedded Creature Editor contract to v7 and API/module version to 0.3.2.

## 0.3.1 - Embedded Effect Editor UX

- Reworked ability-effect editing into a dedicated Creature Editor workspace instead of rendering the full Effect Editor inline beneath the ability list.
- Kept the Creature Forge tabs and persistent bottom action footer visible while an effect is being edited.
- Switched the public Embedded Effect Editor request to compact layout mode.
- Presented Effect Forge Basic Data and Duration side by side at wider host sizes, with Components spanning the full width below them.
- Added a fixed effect-workspace header with a clear "Back to creature" action and live-update hint.
- Preserved the previous creature-tab scroll position when opening and closing effect editing.
- Closing or switching Creature Forge tabs now cleanly unmounts the nested Effect Editor.
- Promoted the Embedded Creature Editor contract to v6 and API/module version to 0.3.1.

## 0.3.0 - Ability Engine & Effect Forge Integration

- Added schema-v3 ability-generation controls (`mode`, `count`, `complexity`, and focus tags).
- Added a seeded weighted Ability Engine using category, subtype, role, level, focus, and synergy metadata.
- Added whole-ability and single-slot rerolls, reroll-history integration, and per-ability locks.
- Added an initial localized core ability library plus reusable Effect Forge schema-v2 effect definitions.
- Added effect resource de-duplication: abilities reference neutral `resources.effects` definitions by stable content id.
- Added external ability/effect bundle support through the existing public Content Registry with source provenance.
- Added public Effect Forge bridge calls for validate, analyze, compile, item-source conversion, apply, instant execute, and compatibility checks.
- Embedded Critical Forge's public Effect Editor directly inside the Creature Editor for referenced ability effects.
- Promoted the Embedded Creature Editor contract to v5 with host-controllable `effectEditing` capability.
- Compiled generated abilities to PF2E action items and preserved application metadata in Creature Forge flags for later runtime trigger work.
- Promoted request, blueprint, and content schemas to v3 and the public API/module version to 0.3.0.
- Expanded automated coverage to 68 tests.

## 0.2.2 - Source Tab & Editor UX

- Moved category/subtype compendium selection out of the main creature form into a dedicated **Sources** tab.
- Promoted the Embedded Creature Editor contract to v4 and exposed `creature` / `sources` tabs plus `currentTab` and `setActiveTab()`.
- Kept the source tab inside the canonical embedded surface so Encounter Forge and other hosts receive the same source UI automatically.
- Preserved world-default source persistence for the standalone host and request-local source selections for embedded hosts.
- Preserved independent scroll positions when switching tabs and kept the persistent bottom action footer visible across tabs.
- Added responsive tab/source-panel styling and updated DE/EN localization/documentation.

## 0.2.1 - Compendium Sources & Category/Subtype Discovery

- Added asynchronous scanning of selected Actor/NPC compendiums using lightweight index fields for document type and creature traits.
- Added separate category-source and subtype-source selections to the Embedded Creature Editor.
- Added world-default source persistence for the standalone Creature Forge while keeping embedded-host source selections request-local by default.
- Added source-aware registry resolution so scanned compendium entries are visible only to requests that selected their source; core and external registered content remain available.
- Added category discovery from recognized creature-type traits and subtype discovery from other observed NPC traits.
- Added observed category compatibility metadata and occurrence counts to discovered subtype definitions.
- Added compendium discovery provenance and cached source scanning.
- Added `api.generateAsync()`, `api.sources.discover()`, `ensure()`, `listContent()`, source defaults, status, cache controls, and source-preparation diagnostics.
- Preserved the existing generic `api.sources.listCompendiums({ documentName })` API.
- Promoted the Embedded Creature Editor contract to v3 for host-aware source controls.
- Expanded automated coverage to 57 tests.

## 0.2.0 - Categories, Subtypes & Defensive Affinities

- Added category/subtype compatibility metadata, implied subtypes, and granted traits.
- Added level-scaled immunities, resistances, and weaknesses with seeded selection, manual overrides, provenance, conflicts, and scoped rerolls.
- Added defensive HP compensation/tradeoffs and PF2E NPC IWR compilation.
- Added external category/subtype affinity providers through the public content registry.

## 0.1.4 - Skills, Movement & Senses

- Added the GM Core creature skill table for levels -1 through 24, including seeded values inside low-skill ranges.
- Added role-, category-, subtype-, and ability-aware skill selection with concept filters for animals, oozes, and mindless creatures.
- Added configurable skill count, primary skill rank, and preferred skill hints to the generation request and Embedded Creature Editor.
- Added land, climb, swim, fly, and burrow movement generation with explicit overrides and concept-sensitive automatic choices.
- Added low-light vision, darkvision, and scent generation with explicit auto/on/off controls and configurable scent range.
- Added scoped rerolls for skills, movement, and senses while preserving unrelated Blueprint sections and individually locked entries where applicable.
- Added Blueprint/request validation for skills, alternate movement, senses, redundant vision, excessive high/extreme skill bands, and malformed values.
- Added PF2E NPC compilation for generated skills, Perception senses, land Speed, and alternate Speeds.
- Added localized skill, movement, sense, and acuity presentation in the Embedded Creature Editor.
- Expanded automated coverage to 43 tests.

## 0.1.3 - Attack Localization

- Added stable localization keys to all generated core attack names.
- Localized generated attack names in the Embedded Creature Editor.
- Localized generated attack names when compiling PF2E NPC strike items.
- Localized damage-type labels in the attack preview while retaining PF2E damage slugs internally.
- Localized the attack reroll tooltip.
- Kept attack names locale-neutral in CreatureBlueprints through `nameKey` plus an English fallback name.

## 0.1.2 - Embedded Editor & Layout Hardening

- Increased the standalone Creature Forge default window size from 1040×760 to 1280×860.
- Added migration for the legacy default-sized saved window state so upgrades actually open at the larger size.
- Promoted the Creature Editor embedded contract to v2.
- Kept the standalone ApplicationV2 as a thin host of the same public Embedded Creature Editor used by external modules.
- Scoped field lookup and event listeners to the embedded editor root for safer composition inside larger host windows.
- Added an editor-owned internal scroll region instead of scrolling the outer standalone shell.
- Moved Generate, Reroll, and optional Create Actor into a persistent bottom editor footer so primary actions remain visible while content scrolls.
- Preserved editor scroll position across rerolls and regeneration.
- Added public editor `element`, `modes`, `layouts`, and optional `mount(..., { minHeight })` host controls.
- Added responsive footer behavior for narrow embedded hosts.

## 0.1.1 - Core Statistics & Attack Engine

- Added GM Core ability-modifier tables for levels -1 through 24.
- Added all six generated ability modifiers and role-based ability profiles.
- Added concept defaults for mindless Intelligence and animal Intelligence.
- Added GM Core attack-bonus and attack-damage tables for levels -1 through 24.
- Added role-driven offense profiles for all core road-map roles.
- Added one-strike and two-strike generation.
- Added complementary two-strike logic: accurate/lower-damage vs. heavy/lower-accuracy.
- Added melee/ranged attack mode, attack-rank, damage-rank, and damage-type request controls.
- Added deterministic attack-form variation by category and seed.
- Added scoped attack and ability rerolls while preserving unrelated statistics.
- Added Blueprint validation for malformed strikes, coupled extreme attack/damage, and non-complementary attack pairs.
- Added PF2E NPC strike compilation as embedded `melee` items.
- Added ability and strike previews to the Embedded Creature Editor.
- Updated public API/module version to 0.1.1.
- Expanded test coverage to 30 tests.

## 0.1.0 - Architecture Foundation

- Started PF2E Creature Forge as a new module rather than a refactor of Monster Forge.
- Added public API version 0.1.0.
- Added request, blueprint, and content schema version 1.
- Added seeded deterministic RNG service with weighted choice, shuffle, chance, and forked streams.
- Added official creature-building AC, HP, save, and Perception rank tables for levels -1 through 24.
- Added GM Core road-map role presets for Brute, Magical Striker, Skill Paragon, Skirmisher, Sniper, Soldier, and Spellcaster.
- Added the extensible content registry and content-bundle contract.
- Added core creature categories and a small core subtype/trait set.
- Added Embedded Creature Editor contract v1.
- Added standalone Creature Forge ApplicationV2 shell and Actor Directory launch button.
- Added Effect/Aura/Affliction/Item/Loot Forge capability discovery.
- Added compendium source discovery.
- Added preliminary PF2E NPC compilation and actor creation.
- Added DE/EN localization.
- Added architecture/API/roadmap documentation and foundation tests.
