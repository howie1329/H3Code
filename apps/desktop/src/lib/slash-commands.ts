export type SlashToken = {
  start: number;
  end: number;
  query: string;
};

const sourceRank: Record<PiSlashCommand["source"], number> = {
  extension: 0,
  prompt: 1,
  skill: 2,
};

export function getActiveSlashToken(value: string, cursor: number | null | undefined): SlashToken | null {
  if (cursor === null || cursor === undefined || cursor < 0 || cursor > value.length) {
    return null;
  }

  let start = cursor;
  while (start > 0 && !isWhitespace(value[start - 1])) {
    start -= 1;
  }

  if (value[start] !== "/") {
    return null;
  }

  if (start > 0 && !isWhitespace(value[start - 1])) {
    return null;
  }

  let end = cursor;
  while (end < value.length && !isWhitespace(value[end])) {
    end += 1;
  }

  if (cursor > end) {
    return null;
  }

  return {
    start,
    end,
    query: value.slice(start + 1, cursor),
  };
}

export function replaceSlashToken(value: string, token: SlashToken, command: PiSlashCommand) {
  const inserted = `/${command.name} `;
  const nextValue = `${value.slice(0, token.start)}${inserted}${value.slice(token.end)}`;
  const cursor = token.start + inserted.length;

  return { value: nextValue, cursor };
}

export function filterSlashCommands(commands: PiSlashCommand[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  return commands
    .map((command) => ({ command, rank: getMatchRank(command, normalizedQuery) }))
    .filter((item) => item.rank !== Number.POSITIVE_INFINITY)
    .sort((a, b) => {
      const sourceDelta = sourceRank[a.command.source] - sourceRank[b.command.source];
      if (sourceDelta !== 0) return sourceDelta;

      const rankDelta = a.rank - b.rank;
      if (rankDelta !== 0) return rankDelta;

      return a.command.name.localeCompare(b.command.name);
    })
    .map((item) => item.command);
}

export function getCommandLocation(command: PiSlashCommand) {
  return command.location ?? command.sourceInfo?.scope;
}

function getMatchRank(command: PiSlashCommand, query: string) {
  if (!query) {
    return 0;
  }

  const name = command.name.toLowerCase();
  const description = command.description?.toLowerCase() ?? "";

  if (name.startsWith(query)) {
    return 0;
  }

  if (name.includes(query)) {
    return 1;
  }

  if (description.includes(query)) {
    return 2;
  }

  return Number.POSITIVE_INFINITY;
}

function isWhitespace(value: string | undefined) {
  return value === undefined || /\s/.test(value);
}
