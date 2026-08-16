import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const editorUrl = new URL("../scripts/ui/creature-editor.js", import.meta.url);
const appUrl = new URL("../scripts/ui/creature-forge-app.js", import.meta.url);
const cssUrl = new URL("../styles/creature-forge.css", import.meta.url);

test("embedded editor v2 owns scoped root, scroll region, and persistent footer", async () => {
  const source = await readFile(editorUrl, "utf8");
  assert.match(source, /static CONTRACT_VERSION = 2/);
  assert.match(source, /this\.root = this\.container\.querySelector\("\[data-cf-editor\]"\)/);
  assert.match(source, /data-cf-editor-scroll/);
  assert.match(source, /data-cf-editor-footer/);
  assert.match(source, /this\.root\?\.addEventListener\("click"/);
  assert.match(source, /const root = this\.root \?\? this\.container/);
  assert.match(source, /modes: Object\.freeze\(\["create", "edit", "view"\]\)/);
  assert.match(source, /layouts: Object\.freeze\(\["full", "compact"\]\)/);
});

test("standalone forge is a larger thin host of public embedded editor", async () => {
  const source = await readFile(appUrl, "utf8");
  assert.match(source, /position: \{ width: 1280, height: 860 \}/);
  assert.match(source, /api\.ui\.creatureEditor\.create/);
  assert.match(source, /this\.editor\.mount\(host\)/);
  assert.doesNotMatch(source, /new EmbeddedCreatureEditor/);
});

test("editor css keeps primary actions outside the scroll region", async () => {
  const source = await readFile(cssUrl, "utf8");
  assert.match(source, /\.cf-editor \.cf-editor-scroll \{[^}]*overflow: auto/s);
  assert.match(source, /\.cf-editor \.cf-editor-footer \{[^}]*flex: 0 0 auto/s);
  assert.match(source, /\.cf-editor-mount \{[^}]*overflow: hidden/s);
});
