import type { ProviderCommand } from "$lib/desktop-types.js";

export type SlashToken = {
  start: number;
  end: number;
  query: string;
};

export function filterSlashCommands(commands: ProviderCommand[], query: string): ProviderCommand[] {
  const normalized = query.trim().replace(/^\/+/, "").toLowerCase();
  if (!normalized) {
    return commands;
  }

  return commands.filter((command) => {
    const name = command.name.toLowerCase();
    const slashName = `/${name}`;

    return name.includes(normalized) || slashName.includes(normalized);
  });
}

export function getActiveSlashToken(value: string, cursor: number): SlashToken | null {
  if (cursor < 0 || cursor > value.length) {
    return null;
  }

  const beforeCursor = value.slice(0, cursor);
  const tokenStart = beforeCursor.search(/(?:^|\s)\/[^\s/]*$/);

  if (tokenStart < 0) {
    return null;
  }

  const prefix = beforeCursor[tokenStart];
  const start = prefix && /\s/.test(prefix) ? tokenStart + 1 : tokenStart;
  const token = value.slice(start, cursor);

  if (!token.startsWith("/") || token.length < 1) {
    return null;
  }

  const nextCharacter = value[cursor];

  if (nextCharacter && !/\s/.test(nextCharacter)) {
    return null;
  }

  return {
    start,
    end: cursor,
    query: token.slice(1),
  };
}

export function replaceSlashToken(value: string, token: SlashToken, command: ProviderCommand) {
  const replacement = `/${command.name} `;
  const nextValue = `${value.slice(0, token.start)}${replacement}${value.slice(token.end)}`;
  const cursor = token.start + replacement.length;

  return { value: nextValue, cursor };
}

export function removeSlashToken(value: string, token: SlashToken) {
  const before = value.slice(0, token.start).replace(/[ \t]+$/, "");
  const after = value.slice(token.end).replace(/^[ \t]+/, "");
  const separator = before && after && !after.startsWith("\n") ? " " : "";
  const nextValue = `${before}${separator}${after}`;

  return { value: nextValue, cursor: Math.min(before.length + separator.length, nextValue.length) };
}

export function findCompletedSkillToken(value: string, skills: ProviderCommand[]) {
  const match = /(?:^|\s)(\/skill:[^\s/]+)(?=\s|$)/i.exec(value);

  if (!match || match.index === undefined) {
    return null;
  }

  const slashName = match[1] ?? "";
  const command = skills.find((skill) => `/${skill.name}`.toLowerCase() === slashName.toLowerCase());

  if (!command) {
    return null;
  }

  const leadingWhitespace = match[0].startsWith("/") ? 0 : 1;
  const start = match.index + leadingWhitespace;
  const end = start + slashName.length;

  return {
    command,
    token: { start, end, query: slashName.slice(1) },
  };
}

export function getCommandLocation(command: ProviderCommand) {
  return command.location ?? command.path;
}
