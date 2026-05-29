import { app } from "electron";

import { configureMetadataStore } from "@h3code/agent-metadata";

configureMetadataStore({ dataDir: app.getPath("userData") });

export * from "@h3code/agent-metadata";
