import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { configureMetadataStore, getPreferences, updateDesktopSettings } from "../src/index.js";

test("configureMetadataStore isolates preferences per data directory", async () => {
  const dataDir = await mkdtemp(path.join(tmpdir(), "h3code-metadata-"));

  configureMetadataStore({ dataDir });
  updateDesktopSettings({ sidebarOpen: false });

  const preferences = getPreferences();

  assert.equal(preferences.desktopSettings.sidebarOpen, false);
  assert.equal(preferences.databasePath, path.join(dataDir, "h3code.sqlite"));
});
