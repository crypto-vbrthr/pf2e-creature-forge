import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { API_VERSION, MODULE_VERSION } from "../scripts/constants.js";

const moduleManifest = JSON.parse(readFileSync(new URL("../module.json", import.meta.url), "utf8"));
const packageManifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

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
