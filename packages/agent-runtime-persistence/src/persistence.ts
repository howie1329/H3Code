import type { DatabaseSync } from "node:sqlite";

import type {
  RuntimeBinding,
  SessionId,
  SessionReadModel,
  UiActivity,
  UiMessage,
  PendingInteraction,
} from "@h3code/agent-protocol";

import { getDatabase } from "./database.js";

export type RuntimePersistence = {
  loadSessions(): Promise<SessionReadModel[]>;
  loadSession(sessionId: SessionId): Promise<SessionReadModel | undefined>;
  saveSession(session: SessionReadModel): Promise<void>;
  deleteSession(sessionId: SessionId): Promise<void>;
  loadBindings(): Promise<RuntimeBinding[]>;
  saveBinding(binding: RuntimeBinding): Promise<void>;
  deleteBinding(sessionId: SessionId): Promise<void>;
};

export function createRuntimePersistence(db: DatabaseSync = getDatabase()): RuntimePersistence {
  return {
    loadSessions: () => Promise.resolve(loadAllSessions(db)),
    loadSession: (sessionId) => Promise.resolve(loadSession(db, sessionId)),
    saveSession: (session) => Promise.resolve(saveSession(db, session)),
    deleteSession: (sessionId) => Promise.resolve(deleteSession(db, sessionId)),
    loadBindings: () => Promise.resolve(loadBindings(db)),
    saveBinding: (binding) => Promise.resolve(saveBinding(db, binding)),
    deleteBinding: (sessionId) => Promise.resolve(deleteBinding(db, sessionId)),
  };
}

function loadAllSessions(db: DatabaseSync): SessionReadModel[] {
  const rows = db.prepare("SELECT session_id AS sessionId FROM runtime_sessions ORDER BY updated_at DESC").all() as Array<{
    sessionId: string;
  }>;

  return rows
    .map((row) => loadSession(db, row.sessionId))
    .filter((session): session is SessionReadModel => session !== undefined);
}

function loadSession(db: DatabaseSync, sessionId: SessionId): SessionReadModel | undefined {
  const row = db.prepare(`
    SELECT
      session_id AS sessionId,
      provider_id AS providerId,
      repo_path AS repoPath,
      provider_session_ref AS providerSessionRef,
      status,
      active_turn_id AS activeTurnId,
      title,
      model_json AS modelJson,
      thinking_level AS thinkingLevel,
      queue_settings_json AS queueSettingsJson,
      auto_compaction_enabled AS autoCompactionEnabled,
      token_usage_json AS tokenUsageJson,
      diff_summary_json AS diffSummaryJson,
      updated_at AS updatedAt
    FROM runtime_sessions
    WHERE session_id = ?
  `).get(sessionId);

  if (!row) {
    return undefined;
  }

  const record = row as Record<string, unknown>;

  return {
    id: String(record.sessionId),
    providerId: String(record.providerId),
    repoPath: String(record.repoPath),
    providerSessionRef: toOptionalString(record.providerSessionRef),
    status: record.status as SessionReadModel["status"],
    activeTurnId: toOptionalString(record.activeTurnId),
    title: toOptionalString(record.title),
    messages: loadMessages(db, sessionId),
    activities: loadActivities(db, sessionId),
    pendingInteractions: loadPendingInteractions(db, sessionId),
    model: parseJson(record.modelJson),
    thinkingLevel: toOptionalString(record.thinkingLevel),
    queueSettings: parseJson(record.queueSettingsJson),
    autoCompactionEnabled: record.autoCompactionEnabled === null || record.autoCompactionEnabled === undefined
      ? undefined
      : Boolean(record.autoCompactionEnabled),
    tokenUsage: parseJson(record.tokenUsageJson),
    diffSummary: parseJson(record.diffSummaryJson),
    updatedAt: Number(record.updatedAt),
  };
}

function loadMessages(db: DatabaseSync, sessionId: SessionId): UiMessage[] {
  const rows = db.prepare(`
    SELECT
      message_id AS id,
      session_id AS sessionId,
      turn_id AS turnId,
      role,
      content,
      status,
      metadata_json AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM runtime_messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `).all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    sessionId: String(row.sessionId),
    turnId: toOptionalString(row.turnId),
    role: row.role as UiMessage["role"],
    content: String(row.content),
    status: row.status as UiMessage["status"] | undefined,
    metadata: parseJson(row.metadataJson),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  }));
}

function loadActivities(db: DatabaseSync, sessionId: SessionId): UiActivity[] {
  const rows = db.prepare(`
    SELECT
      activity_id AS id,
      session_id AS sessionId,
      turn_id AS turnId,
      item_id AS itemId,
      kind,
      title,
      content,
      status,
      input_json AS inputJson,
      output_json AS outputJson,
      error_text AS errorText,
      metadata_json AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM runtime_activities
    WHERE session_id = ?
    ORDER BY created_at ASC
  `).all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    sessionId: String(row.sessionId),
    turnId: toOptionalString(row.turnId),
    itemId: toOptionalString(row.itemId),
    kind: row.kind as UiActivity["kind"],
    title: toOptionalString(row.title),
    content: toOptionalString(row.content),
    status: row.status as UiActivity["status"],
    input: parseJson(row.inputJson),
    output: parseJson(row.outputJson),
    errorText: toOptionalString(row.errorText),
    metadata: parseJson(row.metadataJson),
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
  }));
}

function loadPendingInteractions(db: DatabaseSync, sessionId: SessionId): PendingInteraction[] {
  const rows = db.prepare(`
    SELECT
      request_id AS id,
      session_id AS sessionId,
      turn_id AS turnId,
      item_id AS itemId,
      kind,
      payload_json AS payloadJson,
      created_at AS createdAt
    FROM runtime_pending_interactions
    WHERE session_id = ?
    ORDER BY created_at ASC
  `).all(sessionId) as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    id: String(row.id),
    sessionId: String(row.sessionId),
    turnId: toOptionalString(row.turnId),
    itemId: toOptionalString(row.itemId),
    kind: row.kind as PendingInteraction["kind"],
    payload: parseJson(row.payloadJson) ?? {},
    createdAt: Number(row.createdAt),
  }));
}

function saveSession(db: DatabaseSync, session: SessionReadModel) {
  db.exec("BEGIN");

  try {
    db.prepare(`
      INSERT INTO runtime_sessions (
        session_id,
        provider_id,
        repo_path,
        provider_session_ref,
        status,
        active_turn_id,
        title,
        model_json,
        thinking_level,
        queue_settings_json,
        auto_compaction_enabled,
        token_usage_json,
        diff_summary_json,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(session_id) DO UPDATE SET
        provider_id = excluded.provider_id,
        repo_path = excluded.repo_path,
        provider_session_ref = excluded.provider_session_ref,
        status = excluded.status,
        active_turn_id = excluded.active_turn_id,
        title = excluded.title,
        model_json = excluded.model_json,
        thinking_level = excluded.thinking_level,
        queue_settings_json = excluded.queue_settings_json,
        auto_compaction_enabled = excluded.auto_compaction_enabled,
        token_usage_json = excluded.token_usage_json,
        diff_summary_json = excluded.diff_summary_json,
        updated_at = excluded.updated_at
    `).run(
      session.id,
      session.providerId,
      session.repoPath,
      session.providerSessionRef ?? null,
      session.status,
      session.activeTurnId ?? null,
      session.title ?? null,
      jsonOrNull(session.model),
      session.thinkingLevel ?? null,
      jsonOrNull(session.queueSettings),
      session.autoCompactionEnabled === undefined ? null : session.autoCompactionEnabled ? 1 : 0,
      jsonOrNull(session.tokenUsage),
      jsonOrNull(session.diffSummary),
      session.updatedAt,
    );

    db.prepare("DELETE FROM runtime_messages WHERE session_id = ?").run(session.id);
    const insertMessage = db.prepare(`
      INSERT INTO runtime_messages (
        message_id, session_id, turn_id, role, content, status, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const message of session.messages) {
      insertMessage.run(
        message.id,
        message.sessionId,
        message.turnId ?? null,
        message.role,
        message.content,
        message.status ?? null,
        jsonOrNull(message.metadata),
        message.createdAt,
        message.updatedAt,
      );
    }

    db.prepare("DELETE FROM runtime_activities WHERE session_id = ?").run(session.id);
    const insertActivity = db.prepare(`
      INSERT INTO runtime_activities (
        activity_id, session_id, turn_id, item_id, kind, title, content, status,
        input_json, output_json, error_text, metadata_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const activity of session.activities) {
      insertActivity.run(
        activity.id,
        activity.sessionId,
        activity.turnId ?? null,
        activity.itemId ?? null,
        activity.kind,
        activity.title ?? null,
        activity.content ?? null,
        activity.status,
        jsonOrNull(activity.input),
        jsonOrNull(activity.output),
        activity.errorText ?? null,
        jsonOrNull(activity.metadata),
        activity.createdAt,
        activity.updatedAt,
      );
    }

    db.prepare("DELETE FROM runtime_pending_interactions WHERE session_id = ?").run(session.id);
    const insertInteraction = db.prepare(`
      INSERT INTO runtime_pending_interactions (
        request_id, session_id, turn_id, item_id, kind, payload_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    for (const interaction of session.pendingInteractions) {
      insertInteraction.run(
        interaction.id,
        interaction.sessionId,
        interaction.turnId ?? null,
        interaction.itemId ?? null,
        interaction.kind,
        JSON.stringify(interaction.payload),
        interaction.createdAt,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function deleteSession(db: DatabaseSync, sessionId: SessionId) {
  db.prepare("DELETE FROM runtime_sessions WHERE session_id = ?").run(sessionId);
}

function loadBindings(db: DatabaseSync): RuntimeBinding[] {
  const rows = db.prepare(`
    SELECT
      session_id AS sessionId,
      provider_id AS providerId,
      repo_path AS repoPath,
      provider_session_ref AS providerSessionRef,
      resume_cursor_json AS resumeCursorJson,
      provider_options_json AS providerOptionsJson,
      status,
      active_turn_id AS activeTurnId,
      last_event AS lastEvent,
      last_event_at AS lastEventAt
    FROM runtime_bindings
  `).all() as Array<Record<string, unknown>>;

  return rows.map((row) => ({
    sessionId: String(row.sessionId),
    providerId: String(row.providerId),
    repoPath: String(row.repoPath),
    providerSessionRef: toOptionalString(row.providerSessionRef),
    resumeCursor: parseJson(row.resumeCursorJson),
    providerOptions: parseJson(row.providerOptionsJson),
    status: row.status as RuntimeBinding["status"],
    activeTurnId: toOptionalString(row.activeTurnId),
    lastEvent: toOptionalString(row.lastEvent),
    lastEventAt: row.lastEventAt === null || row.lastEventAt === undefined ? undefined : Number(row.lastEventAt),
  }));
}

function saveBinding(db: DatabaseSync, binding: RuntimeBinding) {
  db.prepare(`
    INSERT INTO runtime_bindings (
      session_id,
      provider_id,
      repo_path,
      provider_session_ref,
      resume_cursor_json,
      provider_options_json,
      status,
      active_turn_id,
      last_event,
      last_event_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      provider_id = excluded.provider_id,
      repo_path = excluded.repo_path,
      provider_session_ref = excluded.provider_session_ref,
      resume_cursor_json = excluded.resume_cursor_json,
      provider_options_json = excluded.provider_options_json,
      status = excluded.status,
      active_turn_id = excluded.active_turn_id,
      last_event = excluded.last_event,
      last_event_at = excluded.last_event_at
  `).run(
    binding.sessionId,
    binding.providerId,
    binding.repoPath,
    binding.providerSessionRef ?? null,
    jsonOrNull(binding.resumeCursor),
    jsonOrNull(binding.providerOptions),
    binding.status,
    binding.activeTurnId ?? null,
    binding.lastEvent ?? null,
    binding.lastEventAt ?? null,
  );
}

function deleteBinding(db: DatabaseSync, sessionId: SessionId) {
  db.prepare("DELETE FROM runtime_bindings WHERE session_id = ?").run(sessionId);
}

function jsonOrNull(value: unknown) {
  return value === undefined ? null : JSON.stringify(value);
}

function parseJson<T>(value: unknown): T | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return undefined;
  }
}

function toOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
