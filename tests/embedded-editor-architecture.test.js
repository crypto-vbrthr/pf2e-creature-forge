import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const editorUrl = new URL("../scripts/ui/creature-editor.js", import.meta.url);
const appUrl = new URL("../scripts/ui/creature-forge-app.js", import.meta.url);
const cssUrl = new URL("../styles/creature-forge.css", import.meta.url);

test("embedded editor v4 keeps source controls in their own tab and primary actions persistent", async () => {
  const source = await readFile(editorUrl, "utf8");
  assert.match(source, /static CONTRACT_VERSION = 4/);
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
  assert.match(source, /persistSourceSelection/);
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
