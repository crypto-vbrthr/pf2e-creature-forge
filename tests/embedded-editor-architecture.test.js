import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const editorUrl = new URL("../scripts/ui/creature-editor.js", import.meta.url);
const appUrl = new URL("../scripts/ui/creature-forge-app.js", import.meta.url);
const cssUrl = new URL("../styles/creature-forge.css", import.meta.url);

test("embedded editor v10 exposes Effect, Aura, and Affliction subeditors with dedicated source controls", async () => {
  const source = await readFile(editorUrl, "utf8");
  assert.match(source, /static CONTRACT_VERSION = 10/);
  assert.match(source, /this\.root = this\.container\.querySelector\("\[data-cf-editor\]"\)/);
  assert.match(source, /data-cf-editor-scroll/);
  assert.match(source, /data-cf-editor-footer/);
  assert.match(source, /this\.root\?\.addEventListener\("click"/);
  assert.match(source, /const root = this\.root \?\? this\.container/);
  assert.match(source, /modes: Object\.freeze\(\["create", "edit", "view"\]\)/);
  assert.match(source, /layouts: Object\.freeze\(\["full", "compact"\]\)/);
  assert.match(source, /tabs: Object\.freeze\(\["creature", "sources"\]\)/);
  assert.match(source, /data-cf-tab="creature"/);
  assert.match(source, /data-cf-tab="sources"/);
  assert.match(source, /data-cf-tab-panel="sources"/);
  assert.match(source, /setActiveTab\(tab\)/);
  assert.match(source, /name="categorySources"/);
  assert.match(source, /name="subtypeSources"/);
  assert.match(source, /name="abilitySources"/);
  assert.match(source, /name="auraSources"/);
  assert.match(source, /name="afflictionSources"/);
  assert.match(source, /persistSourceSelection/);
  assert.match(source, /effectEditing: true/);
  assert.match(source, /auraEditing: true/);
  assert.match(source, /afflictionEditing: true/);
  assert.match(source, /getEffectApi/);
  assert.match(source, /effectApi\?\.ui\?\.effectEditor\?\.create/);
  assert.match(source, /data-cf-effect-editor-host/);
  assert.match(source, /data-cf-action="edit-ability-effect"/);
  assert.match(source, /data-cf-action="edit-aura"/);
  assert.match(source, /data-cf-action="edit-affliction"/);
  assert.match(source, /auraApi\?\.ui\?\.auraEditor\?\.create/);
  assert.match(source, /afflictionApi\?\.ui\?\.afflictionEditor\?\.create/);
  assert.match(source, /layout: "compact"/);
  assert.match(source, /cf-effect-mode/);
  assert.match(source, /cf-effect-workspace-header/);
  assert.match(source, /cf-effect-workspace-body/);
  assert.match(source, /BackToCreature/);
});

test("standalone forge is a larger thin host of public embedded editor", async () => {
  const source = await readFile(appUrl, "utf8");
  assert.match(source, /position: \{ width: 1280, height: 860 \}/);
  assert.match(source, /api\.ui\.creatureEditor\.create/);
  assert.match(source, /this\.editor\.mount\(host\)/);
  assert.match(source, /sourceSelection: true/);
  assert.match(source, /persistSourceSelection: true/);
  assert.doesNotMatch(source, /new EmbeddedCreatureEditor/);
});

test("editor css keeps primary actions outside the scroll region", async () => {
  const source = await readFile(cssUrl, "utf8");
  assert.match(source, /\.cf-editor \.cf-editor-scroll \{[^}]*overflow: auto/s);
  assert.match(source, /\.cf-editor \.cf-editor-footer \{[^}]*flex: 0 0 auto/s);
  assert.match(source, /\.cf-editor-mount \{[^}]*overflow: hidden/s);
});

test("editor css hides inactive tab panels while keeping tabs outside the scroll footer", async () => {
  const source = await readFile(cssUrl, "utf8");
  assert.match(source, /\.cf-editor \.cf-editor-tabs \{[^}]*flex: 0 0 auto/s);
  assert.match(source, /\.cf-editor \.cf-tab-panel \{ display: none; \}/);
  assert.match(source, /\.cf-editor \.cf-tab-panel\.active \{ display: block; \}/);
});

test("compendium pickers are rendered in the dedicated sources panel", async () => {
  const source = await readFile(editorUrl, "utf8");
  assert.match(source, /data-cf-tab-panel="sources"[\s\S]*name="categorySources"[\s\S]*name="subtypeSources"/);
  const renderedSourcePanel = source.slice(source.indexOf('data-cf-tab-panel="sources"'));
  assert.match(renderedSourcePanel, /PF2E_CREATURE_FORGE\.Editor\.Sources/);
  assert.match(renderedSourcePanel, /data-cf-action="refresh-sources"/);
});


test("subeditor editing replaces the scrolling creature work area and delegates compact editor framing to Effect Forge", async () => {
  const source = await readFile(cssUrl, "utf8");
  assert.match(source, /\.cf-editor\.cf-effect-mode \.cf-editor-scroll \{[^}]*display: none/s);
  assert.match(source, /\.cf-editor \.cf-effect-workspace \{[^}]*flex: 1 1 auto/s);
  assert.match(source, /\.cf-editor \.cf-effect-workspace-body \{[^}]*overflow: auto/s);
  assert.match(source, /\.cf-editor \.cf-effect-editor-host \{[^}]*1240px/s);
  assert.match(source, /Effect Forge compact surface owns colors, borders and component accents/);
  assert.doesNotMatch(source, /\.cf-effect-editor-compact \.effect-forge-section \{[^}]*background: rgba\(0, 0, 0/s);
});


test("closing subeditor mode preserves the creature tab scroll position", async () => {
  const source = await readFile(editorUrl, "utf8");
  assert.match(source, /previousRenderWasSubeditorMode/);
  assert.match(source, /captureScroll && this\.scrollElement && !previousRenderWasSubeditorMode/);
  assert.match(source, /hidden element at scrollTop 0/);
});
