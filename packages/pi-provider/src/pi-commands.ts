import type { ProviderCommand, ProviderCommandSource } from "@h3code/agent-core";

import type { PiSessionLike } from "./types.js";

type ExtensionRunnerLike = {
  getRegisteredCommands(): Array<{
    invocationName: string;
    description?: string;
    sourceInfo?: unknown;
  }>;
};

type PromptTemplateLike = {
  name: string;
  description?: string;
  sourceInfo?: unknown;
};

type ResourceLoaderLike = {
  getSkills(): {
    skills: Array<{
      name: string;
      description?: string;
      sourceInfo?: unknown;
    }>;
  };
};

type AgentSessionLike = PiSessionLike & {
  extensionRunner?: ExtensionRunnerLike;
  resourceLoader?: ResourceLoaderLike;
  promptTemplates?: readonly PromptTemplateLike[];
};

export function listPiCommands(
  session: PiSessionLike,
  resourceLoader?: ResourceLoaderLike,
): ProviderCommand[] {
  const agentSession = session as AgentSessionLike;
  const commands: ProviderCommand[] = [];

  const extensionRunner = agentSession.extensionRunner;

  if (extensionRunner) {
    for (const command of extensionRunner.getRegisteredCommands()) {
      commands.push(normalizeProviderCommand({
        name: command.invocationName,
        description: command.description,
        source: "extension",
        sourceInfo: command.sourceInfo,
      }));
    }
  }

  for (const template of agentSession.promptTemplates ?? []) {
    commands.push(
      normalizeProviderCommand({
        name: template.name,
        description: template.description,
        source: "prompt",
        sourceInfo: template.sourceInfo,
      }),
    );
  }

  const loader = agentSession.resourceLoader ?? resourceLoader;
  const skills = loader?.getSkills().skills ?? [];

  for (const skill of skills) {
    commands.push(
      normalizeProviderCommand({
        name: `skill:${skill.name}`,
        description: skill.description,
        source: "skill",
        sourceInfo: skill.sourceInfo,
      }),
    );
  }

  return commands;
}

function normalizeProviderCommand(input: {
  name: string;
  description?: string;
  source: ProviderCommandSource;
  sourceInfo?: unknown;
}): ProviderCommand {
  const sourceInfo = toRecord(input.sourceInfo);

  return {
    name: input.name,
    description: input.description,
    source: input.source,
    location:
      typeof sourceInfo.scope === "string"
        ? sourceInfo.scope
        : typeof sourceInfo.location === "string"
          ? sourceInfo.location
          : undefined,
    path: typeof sourceInfo.path === "string" ? sourceInfo.path : undefined,
    sourceInfo: {
      path: typeof sourceInfo.path === "string" ? sourceInfo.path : undefined,
      source: typeof sourceInfo.source === "string" ? sourceInfo.source : undefined,
      scope: typeof sourceInfo.scope === "string" ? sourceInfo.scope : undefined,
      origin: typeof sourceInfo.origin === "string" ? sourceInfo.origin : undefined,
      baseDir: typeof sourceInfo.baseDir === "string" ? sourceInfo.baseDir : undefined,
    },
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
