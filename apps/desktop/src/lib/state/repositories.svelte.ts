type RepositoryState = {
  repos: Repo[];
  selectedRepo: Repo | null;
  sessions: Session[];
  selectedSession: Session | null;
  repoPathInput: string;
  sessionTitleInput: string;
  promptInput: string;
  renameTitleInput: string;
  transcriptEventsBySessionId: Record<string, TranscriptEvent[]>;
  pendingLocalEventIds: string[];
  lastMainTranscriptEventAt: number;
  loadingTranscriptSessionId: string;
  repoError: string;
  sessionError: string;
  promptError: string;
  isLoadingRepos: boolean;
  isLoadingSessions: boolean;
  isAddingRepo: boolean;
  isCreatingSession: boolean;
  isPickingRepoDirectory: boolean;
  isSelectingRepoId: string;
  isSelectingSessionId: string;
  isAddRepoOpen: boolean;
  isCreateSessionOpen: boolean;
  isSendingPrompt: boolean;
  isStoppingSession: boolean;
  isRenamingSession: boolean;
  editingSessionTitleId: string;
  unsubscribeTranscriptEvents: (() => void) | null;
  unsubscribeSessionUpdates: (() => void) | null;
};

export const repositoryState = $state<RepositoryState>({
  repos: [],
  selectedRepo: null,
  sessions: [],
  selectedSession: null,
  repoPathInput: '',
  sessionTitleInput: '',
  promptInput: '',
  renameTitleInput: '',
  transcriptEventsBySessionId: {},
  pendingLocalEventIds: [],
  lastMainTranscriptEventAt: 0,
  loadingTranscriptSessionId: '',
  repoError: '',
  sessionError: '',
  promptError: '',
  isLoadingRepos: true,
  isLoadingSessions: false,
  isAddingRepo: false,
  isCreatingSession: false,
  isPickingRepoDirectory: false,
  isSelectingRepoId: '',
  isSelectingSessionId: '',
  isAddRepoOpen: false,
  isCreateSessionOpen: false,
  isSendingPrompt: false,
  isStoppingSession: false,
  isRenamingSession: false,
  editingSessionTitleId: '',
  unsubscribeTranscriptEvents: null,
  unsubscribeSessionUpdates: null
});

export function canAddRepository() {
  return repositoryState.repoPathInput.trim().length > 0 && !repositoryState.isAddingRepo;
}

export function canCreateSession() {
  return !!repositoryState.selectedRepo && !repositoryState.isCreatingSession;
}

function createLocalTranscriptEvent(
  sessionId: string,
  event: Omit<TranscriptEvent, 'id' | 'sessionId' | 'createdAt'>
): TranscriptEvent {
  return {
    id: `local-${crypto.randomUUID()}`,
    sessionId,
    createdAt: new Date().toISOString(),
    ...event
  };
}

function setTranscriptEvents(sessionId: string, events: TranscriptEvent[]) {
  repositoryState.transcriptEventsBySessionId = {
    ...repositoryState.transcriptEventsBySessionId,
    [sessionId]: events
  };
}

function mergeTranscriptEvents(existing: TranscriptEvent[], incoming: TranscriptEvent[]) {
  const eventsById = new Map<string, TranscriptEvent>();

  for (const event of existing) eventsById.set(event.id, event);
  for (const event of incoming) eventsById.set(event.id, event);

  return [...eventsById.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function appendTranscriptEvent(event: TranscriptEvent) {
  const existing = repositoryState.transcriptEventsBySessionId[event.sessionId] ?? [];
  setTranscriptEvents(event.sessionId, mergeTranscriptEvents(existing, [event]));
}

function replaceLocalUserEvent(event: TranscriptEvent) {
  const existing = repositoryState.transcriptEventsBySessionId[event.sessionId] ?? [];
  const pendingIndex = existing.findIndex(
    (item) =>
      item.id.startsWith('local-') &&
      item.kind === 'user' &&
      item.content === event.content
  );

  if (pendingIndex === -1) {
    appendTranscriptEvent(event);
    return;
  }

  const nextEvents = [...existing];
  nextEvents[pendingIndex] = event;
  setTranscriptEvents(event.sessionId, mergeTranscriptEvents([], nextEvents));
}

export function initializeSessionEventListeners() {
  if (!window.h3code?.sessions) {
    repositoryState.promptError = 'Transcript streaming is only available in the desktop app.';
    return;
  }
  if (!repositoryState.unsubscribeTranscriptEvents) {
    repositoryState.unsubscribeTranscriptEvents = window.h3code.sessions.onTranscriptEvent((event) => {
      repositoryState.lastMainTranscriptEventAt = Date.now();
      if (event.kind === 'user') {
        repositoryState.pendingLocalEventIds = repositoryState.pendingLocalEventIds.filter(
          (id) => !id.startsWith(`${event.sessionId}:`)
        );
        replaceLocalUserEvent(event);
        return;
      }

      appendTranscriptEvent(event);
    });
  }

  if (!repositoryState.unsubscribeSessionUpdates) {
    repositoryState.unsubscribeSessionUpdates = window.h3code.sessions.onSessionUpdated((session) => {
      repositoryState.sessions = repositoryState.sessions.map((item) => (item.id === session.id ? session : item));
      if (repositoryState.selectedSession?.id === session.id) repositoryState.selectedSession = session;
    });
  }
}

export function openCreateSession() {
  repositoryState.sessionError = '';
  repositoryState.isCreateSessionOpen = true;
}

export async function loadRepositories() {
  initializeSessionEventListeners();

  if (!window.h3code?.metadata || !window.h3code?.sessions) {
    repositoryState.isLoadingRepos = false;
    repositoryState.repoError = 'Repositories are only available in the desktop app.';
    return;
  }

  repositoryState.isLoadingRepos = true;
  repositoryState.repoError = '';

  try {
    const metadata = await window.h3code.metadata.get();
    const repos = sortRepos(metadata.repos);
    const selectedRepo =
      repos.find((repo) => repo.id === metadata.selectedRepoId) ?? repos[0] ?? null;

    repositoryState.repos = repos;
    repositoryState.selectedRepo = selectedRepo;

    if (selectedRepo) {
      await loadSessionsForRepo(selectedRepo);
    } else {
      repositoryState.sessions = [];
      repositoryState.selectedSession = null;
      repositoryState.loadingTranscriptSessionId = '';
    }
  } catch {
    repositoryState.repoError = 'Could not load repositories.';
  } finally {
    repositoryState.isLoadingRepos = false;
  }
}

export async function pickRepositoryDirectory() {
  if (!window.h3code?.dialog) {
    repositoryState.repoError = 'Folder picker is only available in the desktop app.';
    return;
  }

  repositoryState.isPickingRepoDirectory = true;

  try {
    const result = await window.h3code.dialog.pickRepositoryDirectory();

    if (!result.ok) {
      repositoryState.repoError = 'Could not open folder picker.';
      return;
    }

    if (result.data) {
      repositoryState.repoPathInput = result.data.path;
    }
  } catch {
    repositoryState.repoError = 'Could not open folder picker.';
  } finally {
    repositoryState.isPickingRepoDirectory = false;
  }
}

export async function addRepository() {
  if (!window.h3code?.repos) {
    repositoryState.repoError = 'Repositories are only available in the desktop app.';
    return;
  }

  if (!repositoryState.repoPathInput.trim()) {
    repositoryState.repoError = 'Enter a repository path.';
    return;
  }

  repositoryState.isAddingRepo = true;
  repositoryState.repoError = '';

  try {
    const result = await window.h3code.repos.add({ path: repositoryState.repoPathInput });

    if (!result.ok) {
      repositoryState.repoError = getRepoErrorMessage(result.error.code);
      return;
    }

    repositoryState.selectedRepo = result.data;
    repositoryState.repoPathInput = '';
    repositoryState.isAddRepoOpen = false;
    await loadRepositories();
    repositoryState.selectedRepo = repositoryState.repos.find((repo) => repo.id === result.data.id) ?? result.data;
    await loadSessionsForRepo(repositoryState.selectedRepo);
  } catch {
    repositoryState.repoError = 'Could not add repository. Try again.';
  } finally {
    repositoryState.isAddingRepo = false;
  }
}

export async function selectRepository(repo: Repo) {
  if (!window.h3code?.repos || repositoryState.selectedRepo?.id === repo.id) return;

  repositoryState.isSelectingRepoId = repo.id;
  repositoryState.repoError = '';

  try {
    const result = await window.h3code.repos.select({ repoId: repo.id });

    if (!result.ok) {
      repositoryState.repoError = 'Could not select repository. Try again.';
      return;
    }

    repositoryState.selectedRepo = result.data;
    await loadRepositories();
    repositoryState.selectedRepo = repositoryState.repos.find((item) => item.id === result.data.id) ?? result.data;
    await loadSessionsForRepo(repositoryState.selectedRepo);
  } catch {
    repositoryState.repoError = 'Could not select repository. Try again.';
  } finally {
    repositoryState.isSelectingRepoId = '';
  }
}

export async function createSession() {
  if (!window.h3code?.sessions || !repositoryState.selectedRepo) {
    repositoryState.sessionError = 'Select a repository before creating a session.';
    return;
  }

  const title = repositoryState.sessionTitleInput.trim();
  repositoryState.isCreatingSession = true;
  repositoryState.sessionError = '';

  try {
    const result = await window.h3code.sessions.create({ repoId: repositoryState.selectedRepo.id, title: title || undefined });

    if (!result.ok) {
      repositoryState.sessionError = getSessionErrorMessage(result.error.code);
      return;
    }

    repositoryState.sessionTitleInput = '';
    repositoryState.isCreateSessionOpen = false;
    await loadSessionsForRepo(repositoryState.selectedRepo, result.data.id);
  } catch {
    repositoryState.sessionError = 'Could not create session. Try again.';
  } finally {
    repositoryState.isCreatingSession = false;
  }
}

export async function selectSession(session: Session) {
  if (!window.h3code?.sessions || !repositoryState.selectedRepo || repositoryState.selectedSession?.id === session.id) {
    return;
  }

  repositoryState.isSelectingSessionId = session.id;
  repositoryState.sessionError = '';

  try {
    const result = await window.h3code.sessions.select({
      repoId: repositoryState.selectedRepo.id,
      sessionId: session.id
    });

    if (!result.ok) {
      repositoryState.sessionError = getSessionErrorMessage(result.error.code);
      return;
    }

    repositoryState.selectedSession = result.data;
    repositoryState.selectedRepo = {
      ...repositoryState.selectedRepo,
      selectedSessionId: result.data.id
    };
    repositoryState.sessions = repositoryState.sessions.map((item) =>
      item.id === result.data.id ? result.data : item
    );
    await loadTranscriptForSession(result.data.id);
  } catch {
    repositoryState.sessionError = 'Could not select session. Try again.';
  } finally {
    repositoryState.isSelectingSessionId = '';
  }
}

async function loadSessionsForRepo(repo: Repo, preferredSessionId?: string) {
  if (!window.h3code?.sessions) return;

  repositoryState.isLoadingSessions = true;
  repositoryState.sessionError = '';

  try {
    const result = await window.h3code.sessions.list({ repoId: repo.id });

    if (!result.ok) {
      repositoryState.sessionError = 'Could not load sessions.';
      repositoryState.sessions = [];
      repositoryState.selectedSession = null;
      repositoryState.loadingTranscriptSessionId = '';
      return;
    }

    const sessions = sortSessions(result.data);
    const selectedSession =
      sessions.find((session) => session.id === preferredSessionId) ??
      sessions.find((session) => session.id === repo.selectedSessionId) ??
      sessions[0] ??
      null;

    repositoryState.sessions = sessions;
    repositoryState.selectedSession = selectedSession;
    if (selectedSession) {
      await loadTranscriptForSession(selectedSession.id);
    } else {
      repositoryState.loadingTranscriptSessionId = '';
    }
  } catch {
    repositoryState.sessionError = 'Could not load sessions.';
    repositoryState.sessions = [];
    repositoryState.selectedSession = null;
    repositoryState.loadingTranscriptSessionId = '';
  } finally {
    repositoryState.isLoadingSessions = false;
  }
}

export async function loadTranscriptForSession(sessionId: string) {
  if (!window.h3code?.sessions) return;

  repositoryState.loadingTranscriptSessionId = sessionId;

  try {
    const result = await window.h3code.sessions.getMessages({ sessionId });
    if (result.ok) {
      const existing = repositoryState.transcriptEventsBySessionId[sessionId] ?? [];
      setTranscriptEvents(sessionId, mergeTranscriptEvents(existing, result.data));
    }
  } catch {
    repositoryState.promptError = 'Could not load transcript.';
  } finally {
    if (repositoryState.loadingTranscriptSessionId === sessionId) {
      repositoryState.loadingTranscriptSessionId = '';
    }
  }
}

export async function sendPrompt() {
  if (!window.h3code?.sessions || !repositoryState.selectedRepo || !repositoryState.selectedSession) {
    repositoryState.promptError = 'Select a repository and session before sending.';
    return;
  }

  const prompt = repositoryState.promptInput.trim();
  if (!prompt) return;

  repositoryState.isSendingPrompt = true;
  repositoryState.promptError = '';

  const sessionId = repositoryState.selectedSession.id;
  const localUserEvent = createLocalTranscriptEvent(sessionId, {
    kind: 'user',
    blockId: `user:${crypto.randomUUID()}`,
    mode: 'final',
    content: prompt
  });
  appendTranscriptEvent(localUserEvent);
  repositoryState.pendingLocalEventIds = [...repositoryState.pendingLocalEventIds, `${sessionId}:${prompt}`];
  const sentAt = Date.now();

  try {
    const result = await window.h3code.sessions.sendMessage({
      sessionId,
      prompt
    });

    if (!result.ok) {
      repositoryState.promptError = result.error.message;
      appendTranscriptEvent(
        createLocalTranscriptEvent(sessionId, {
          kind: 'error',
          blockId: `send-error:${crypto.randomUUID()}`,
          mode: 'final',
          title: 'Prompt failed',
          content: result.error.message
        })
      );
      return;
    }

    repositoryState.promptInput = '';
    setTimeout(() => {
      if (repositoryState.selectedSession?.id !== sessionId) return;
      if (repositoryState.lastMainTranscriptEventAt >= sentAt) return;
      appendTranscriptEvent(
        createLocalTranscriptEvent(sessionId, {
          kind: 'diagnostic',
          blockId: `diagnostic:${crypto.randomUUID()}`,
          mode: 'final',
          title: 'Waiting for Pi events',
          content: 'Prompt was accepted, but no transcript event has arrived from Pi yet.'
        })
      );
    }, 500);
  } catch {
    repositoryState.promptError = 'Could not send prompt to Pi.';
    appendTranscriptEvent(
      createLocalTranscriptEvent(sessionId, {
        kind: 'error',
        blockId: `send-error:${crypto.randomUUID()}`,
        mode: 'final',
        title: 'Prompt failed',
        content: 'Could not send prompt to Pi.'
      })
    );
  } finally {
    repositoryState.isSendingPrompt = false;
  }
}

export async function stopSelectedSession() {
  if (!window.h3code?.pi || !repositoryState.selectedSession) return;

  repositoryState.isStoppingSession = true;
  repositoryState.promptError = '';

  try {
    const result = await window.h3code.pi.stopSession({ sessionId: repositoryState.selectedSession.id });
    if (!result.ok) repositoryState.promptError = result.error.message;
  } catch {
    repositoryState.promptError = 'Could not stop Pi.';
  } finally {
    repositoryState.isStoppingSession = false;
  }
}

export function startRenamingSession(session: Session) {
  repositoryState.editingSessionTitleId = session.id;
  repositoryState.renameTitleInput = session.title;
  repositoryState.sessionError = '';
}

export async function renameSession(session: Session) {
  if (!window.h3code?.sessions) return;
  const title = repositoryState.renameTitleInput.trim();
  if (!title) {
    repositoryState.sessionError = 'Enter a session title.';
    return;
  }

  repositoryState.isRenamingSession = true;
  repositoryState.sessionError = '';

  try {
    const result = await window.h3code.sessions.updateTitle({ sessionId: session.id, title });
    if (!result.ok) {
      repositoryState.sessionError = getSessionErrorMessage(result.error.code);
      return;
    }

    repositoryState.sessions = repositoryState.sessions.map((item) => (item.id === result.data.id ? result.data : item));
    if (repositoryState.selectedSession?.id === result.data.id) repositoryState.selectedSession = result.data;
    repositoryState.editingSessionTitleId = '';
    repositoryState.renameTitleInput = '';
  } catch {
    repositoryState.sessionError = 'Could not rename session.';
  } finally {
    repositoryState.isRenamingSession = false;
  }
}

function sortRepos(repos: Repo[]) {
  return [...repos].sort((a, b) => {
    const aDate = a.lastOpenedAt ?? a.addedAt;
    const bDate = b.lastOpenedAt ?? b.addedAt;
    return bDate.localeCompare(aDate);
  });
}

function sortSessions(sessions: Session[]) {
  return [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function getRepoErrorMessage(code: string) {
  switch (code) {
    case 'invalid_input':
      return 'Enter a repository path.';
    case 'repo_path_not_found':
    case 'repo_path_not_directory':
      return 'Choose an existing folder.';
    default:
      return 'Could not add repository. Try again.';
  }
}

function getSessionErrorMessage(code: string) {
  switch (code) {
    case 'invalid_input':
      return 'Enter a session title.';
    case 'repo_not_found':
      return 'Select an existing repository.';
    case 'session_not_found':
      return 'Session could not be found.';
    case 'session_repo_mismatch':
      return 'Session does not belong to this repository.';
    case 'invalid_pi_path':
      return 'Set a valid Pi executable path.';
    default:
      return 'Could not update session. Try again.';
  }
}
