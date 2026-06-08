import type {
  PendingInteraction,
  SessionReadModel,
  SessionReadModelPatch,
  UiActivity,
  UiMessage,
  UiSessionEvent,
} from "@h3code/agent-protocol";

export function createEmptySessionReadModel(): SessionReadModel {
  return {
    id: "",
    providerId: "pi",
    repoPath: "",
    status: "idle",
    messages: [],
    activities: [],
    pendingInteractions: [],
    updatedAt: 0,
  };
}

export function applySessionEvent(model: SessionReadModel, event: UiSessionEvent): SessionReadModel {
  switch (event.type) {
    case "session.snapshot":
      return cloneSession(event.session);
    case "session.patch":
      return applyPatch(model, event.patch);
    case "thread.message.upserted":
      return {
        ...model,
        messages: upsertById(model.messages, event.message, (item) => item.id),
        updatedAt: event.message.updatedAt,
      };
    case "thread.activity.upserted":
      return {
        ...model,
        activities: upsertById(model.activities, event.activity, (item) => item.id),
        updatedAt: event.activity.updatedAt,
      };
    case "interaction.requested":
      return {
        ...model,
        pendingInteractions: upsertById(model.pendingInteractions, event.request, (item) => item.id),
        updatedAt: event.request.createdAt,
      };
    case "interaction.resolved":
      return {
        ...model,
        pendingInteractions: model.pendingInteractions.filter((item) => item.id !== event.requestId),
        updatedAt: Date.now(),
      };
  }
}

export function applyPatch(model: SessionReadModel, patch: SessionReadModelPatch): SessionReadModel {
  const next: SessionReadModel = {
    ...model,
    updatedAt: patch.updatedAt,
  };

  if (patch.status !== undefined) {
    next.status = patch.status;
  }

  if (patch.activeTurnId !== undefined) {
    next.activeTurnId = patch.activeTurnId ?? undefined;
  }

  if (patch.title !== undefined) {
    next.title = patch.title ?? undefined;
  }

  if (patch.messages !== undefined) {
    next.messages = patch.messages;
  }

  if (patch.activities !== undefined) {
    next.activities = patch.activities;
  }

  if (patch.pendingInteractions !== undefined) {
    next.pendingInteractions = patch.pendingInteractions;
  }

  if (patch.model !== undefined) {
    next.model = patch.model ?? undefined;
  }

  if (patch.tokenUsage !== undefined) {
    next.tokenUsage = patch.tokenUsage ?? undefined;
  }

  if (patch.diffSummary !== undefined) {
    next.diffSummary = patch.diffSummary ?? undefined;
  }

  return next;
}

function upsertById<T>(items: T[], nextItem: T, getId: (item: T) => string): T[] {
  const id = getId(nextItem);
  const index = items.findIndex((item) => getId(item) === id);

  if (index === -1) {
    return [...items, nextItem];
  }

  const copy = [...items];
  copy[index] = nextItem;
  return copy;
}

function cloneSession(session: SessionReadModel): SessionReadModel {
  return {
    ...session,
    messages: session.messages.map(cloneMessage),
    activities: session.activities.map(cloneActivity),
    pendingInteractions: session.pendingInteractions.map(clonePendingInteraction),
  };
}

function cloneMessage(message: UiMessage): UiMessage {
  return { ...message };
}

function cloneActivity(activity: UiActivity): UiActivity {
  return { ...activity };
}

function clonePendingInteraction(interaction: PendingInteraction): PendingInteraction {
  return { ...interaction };
}
