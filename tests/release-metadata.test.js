import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { API_VERSION, BLUEPRINT_SCHEMA_VERSION, CONTENT_SCHEMA_VERSION, MODULE_VERSION, REQUEST_SCHEMA_VERSION } from "../scripts/constants.js";

const moduleManifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
const packageManifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const apiDoc = readFileSync(new URL("../docs/API.md", import.meta.url), "utf8");

test("release metadata remains aligned across scripts, package, and Foundry manifest", () => {
  assert.equal(moduleManifest.version, MODULE_VERSION);
  assert.equal(packageManifest.version, MODULE_VERSION);
  assert.equal(API_VERSION, MODULE_VERSION);
  assert.match(moduleManifest.download, new RegExp(`/releases/download/v${MODULE_VERSION.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}/pf2e-creature-forge\\.zip$`));
  assert.equal(moduleManifest.compatibility.minimum, "14");
  assert.equal(moduleManifest.compatibility.verified, "14");
  assert.equal(Object.hasOwn(moduleManifest.compatibility, "maximum"), false);
  assert.equal(moduleManifest.relationships.systems[0].id, "pf2e");
  assert.equal(moduleManifest.relationships.systems[0].compatibility.minimum, "8.4.0");
});

test("release documentation advertises the shipped version and public schemas", () => {
  assert.ok(readme.includes(`Version **${MODULE_VERSION}**`));
  assert.ok(apiDoc.startsWith(`# Public API ${MODULE_VERSION}`));
  assert.ok(apiDoc.includes(`Request v${REQUEST_SCHEMA_VERSION}`));
  assert.ok(apiDoc.includes(`Blueprint v${BLUEPRINT_SCHEMA_VERSION}`));
  assert.ok(apiDoc.includes(`Content v${CONTENT_SCHEMA_VERSION}`));
  assert.ok(apiDoc.includes("Embedded Creature Editor v14"));
  assert.ok(apiDoc.includes("runtime-status v2"));
});
