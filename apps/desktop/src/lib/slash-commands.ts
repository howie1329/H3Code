import type { ProviderCommand } from "$lib/desktop-types.js";

export type SlashToken = {
  start: number;
  end: number;
  query: string;
};

export function filterSlashCommands(commands: ProviderCommand[], query: string): ProviderCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return commands;
  }

  return commands.filter((command) => command.name.toLowerCase().includes(normalized));
}

export function getActiveSlashToken(_value: string, _cursor: number): SlashToken | null {
  return null;
}

export function replaceSlashToken(value: string, _token: SlashToken, _command: ProviderCommand) {
  return { value, cursor: value.length };
}

export function getCommandLocation(command: ProviderCommand) {
  return command.location ?? command.path;
}
