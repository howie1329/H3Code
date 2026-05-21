type RepositoryState = {
  repos: Repo[];
  selectedRepo: Repo | null;
  sessions: Session[];
  selectedSession: Session | null;
  messagesByTranscriptKey: Record<string, TranscriptMessage[]>;
  liveEventsByTranscriptKey: Record<string, TranscriptEvent[]>;
  transcriptLoadToken: string;
  repoPathInput: string;
  promptInput: string;
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
  isSendingPrompt: boolean;
  isStoppingSession: boolean;
  unsubscribeTranscriptEvents: (() => void) | null;
  unsubscribeSessionUpdates: (() => void) | null;
  unsubscribeMessagesUpdated: (() => void) | null;
};

export const repositoryState = $state<RepositoryState>({
  repos: [],
  selectedRepo: null,
  sessions: [],
  selectedSession: null,
  messagesByTranscriptKey: {},
  liveEventsByTranscriptKey: {},
  transcriptLoadToken: '',
  repoPathInput: '',
  promptInput: '',
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
  isSendingPrompt: false,
  isStoppingSession: false,
  unsubscribeTranscriptEvents: null,
  unsubscribeSessionUpdates: null,
  unsubscribeMessagesUpdated: null
});

export function getTranscriptKey(session: Session | null) {
  if (!session) return '';
  return session.harnessSessionPath || session.id;
}

function setMessages(transcriptKey: string, messages: TranscriptMessage[]) {
  repositoryState.messagesByTranscriptKey = {
    ...repositoryState.messagesByTranscriptKey,
    [transcriptKey]: messages
  };
}

function setLiveEvents(transcriptKey: string, events: TranscriptEvent[]) {
  repositoryState.liveEventsByTranscriptKey = {
    ...repositoryState.liveEventsByTranscriptKey,
    [transcriptKey]: events
  };
}

function mergeTranscriptEvents(existing: TranscriptEvent[], incoming: TranscriptEvent[]) {
  const eventsById = new Map<string, TranscriptEvent>();
  for (const event of existing) eventsById.set(event.id, event);
  for (const event of incoming) eventsById.set(event.id, event);
  return [...eventsById.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function appendLiveEvent(event: TranscriptEvent) {
  const matchingSession =
    repositoryState.selectedSession?.id === event.sessionId
      ? repositoryState.selectedSession
      : (repositoryState.sessions.find((session) => session.id === event.sessionId) ?? null);
  const transcriptKey = getTranscriptKey(matchingSession) || event.sessionId;
  setLiveEvents(transcriptKey, mergeTranscriptEvents(repositoryState.liveEventsByTranscriptKey[transcriptKey] ?? [], [event]));
}

export function initializeSessionEventListeners() {
  if (!window.h3code?.sessions) {
    repositoryState.promptError = 'Pi sessions are only available in the desktop app.';
    return;
  }

  if (!repositoryState.unsubscribeTranscriptEvents) {
    repositoryState.unsubscribeTranscriptEvents = window.h3code.sessions.onTranscriptEvent((event) => {
      appendLiveEvent(event);
    });
  }

  if (!repositoryState.unsubscribeSessionUpdates) {
    repositoryState.unsubscribeSessionUpdates = window.h3code.sessions.onSessionUpdated((session) => {
      repositoryState.sessions = repositoryState.sessions.map((item) =>
        item.id === session.id || item.harnessSessionPath === session.harnessSessionPath ? { ...item, status: session.status } : item
      );
      if (
        repositoryState.selectedSession?.id === session.id ||
        repositoryState.selectedSession?.harnessSessionPath === session.harnessSessionPath
      ) {
        repositoryState.selectedSession = { ...repositoryState.selectedSession, status: session.status };
      }
    });
  }

  if (!repositoryState.unsubscribeMessagesUpdated) {
    repositoryState.unsubscribeMessagesUpdated = window.h3code.sessions.onMessagesUpdated((payload) => {
      const transcriptKey = payload.meta.sessionPath || payload.meta.sessionId;
      setMessages(transcriptKey, payload.messages);
      setLiveEvents(transcriptKey, []);
    });
  }
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
    const selectedRepo = repos.find((repo) => repo.id === metadata.selectedRepoId) ?? repos[0] ?? null;

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
    if (result.data) repositoryState.repoPathInput = result.data.path;
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
    await loadSessionsForRepo(result.data);
  } catch {
    repositoryState.repoError = 'Could not select repository. Try again.';
  } finally {
    repositoryState.isSelectingRepoId = '';
  }
}

export async function createSession() {
  if (!window.h3code?.sessions || !repositoryState.selectedRepo) {
    repositoryState.sessionError = 'Select a repository before starting a chat.';
    return;
  }

  repositoryState.isCreatingSession = true;
  repositoryState.sessionError = '';

  try {
    const result = await window.h3code.sessions.createDraft({ repoId: repositoryState.selectedRepo.id });
    if (!result.ok) {
      repositoryState.sessionError = getSessionErrorMessage(result.error.code);
      return;
    }

    repositoryState.selectedSession = result.data;
    repositoryState.sessions = [result.data, ...repositoryState.sessions.filter((session) => !session.isDraft)];
    setMessages(getTranscriptKey(result.data), []);
    setLiveEvents(getTranscriptKey(result.data), []);
  } catch {
    repositoryState.sessionError = 'Could not start a new chat.';
  } finally {
    repositoryState.isCreatingSession = false;
  }
}

export async function selectSession(session: Session) {
  if (!window.h3code?.sessions || !repositoryState.selectedRepo || repositoryState.selectedSession?.id === session.id) return;

  const repo = repositoryState.selectedRepo;
  repositoryState.isSelectingSessionId = session.id;
  repositoryState.sessionError = '';
  repositoryState.selectedSession = session;
  void loadTranscriptForSession(session);

  try {
    const result = await window.h3code.sessions.select({
      repoId: repo.id,
      sessionId: session.id,
      sessionPath: session.harnessSessionPath
    });
    if (!result.ok) {
      repositoryState.sessionError = getSessionErrorMessage(result.error.code);
      return;
    }

    if (repositoryState.selectedSession?.id === session.id) {
      repositoryState.selectedSession = result.data;
    }
  } catch {
    repositoryState.sessionError = 'Could not select session. Try again.';
  } finally {
    repositoryState.isSelectingSessionId = '';
  }
}

async function loadSessionsForRepo(repo: Repo) {
  if (!window.h3code?.sessions) return;

  repositoryState.isLoadingSessions = true;
  repositoryState.sessionError = '';

  try {
    const result = await window.h3code.sessions.list({ repoId: repo.id });
    if (!result.ok) {
      repositoryState.sessionError = 'Could not load sessions.';
      repositoryState.sessions = [];
      repositoryState.selectedSession = null;
      return;
    }

    const sessions = sortSessions(result.data);
    const selectedSession =
      sessions.find((session) => session.harnessSessionPath === repo.selectedSessionPath) ??
      sessions[0] ??
      null;

    repositoryState.sessions = sessions;
    repositoryState.selectedSession = selectedSession;

    if (selectedSession) await loadTranscriptForSession(selectedSession);
    else repositoryState.loadingTranscriptSessionId = '';
  } catch {
    repositoryState.sessionError = 'Could not load sessions.';
    repositoryState.sessions = [];
    repositoryState.selectedSession = null;
  } finally {
    repositoryState.isLoadingSessions = false;
  }
}

export async function loadTranscriptForSession(session: Session) {
  if (!window.h3code?.sessions || !repositoryState.selectedRepo) return;
  const transcriptKey = getTranscriptKey(session);
  const hasCachedMessages = Object.prototype.hasOwnProperty.call(repositoryState.messagesByTranscriptKey, transcriptKey);
  const loadToken = `${session.id}:${crypto.randomUUID()}`;
  repositoryState.transcriptLoadToken = loadToken;
  if (repositoryState.loadingTranscriptSessionId && repositoryState.loadingTranscriptSessionId !== session.id) {
    repositoryState.loadingTranscriptSessionId = '';
  }

  if (session.isDraft) {
    setMessages(transcriptKey, []);
    setLiveEvents(transcriptKey, []);
    repositoryState.loadingTranscriptSessionId = '';
    return;
  }

  repositoryState.loadingTranscriptSessionId = hasCachedMessages ? '' : session.id;
  repositoryState.promptError = '';

  try {
    if (!hasCachedMessages && session.harnessSessionPath) {
      const localResult = await window.h3code.sessions.getLocalMessages({
        repoId: repositoryState.selectedRepo.id,
        sessionId: session.id,
        sessionPath: session.harnessSessionPath
      });

      if (repositoryState.transcriptLoadToken !== loadToken || repositoryState.selectedSession?.id !== session.id) return;

      if (localResult.ok && localResult.data.messages.length > 0 && localResult.data.meta.normalizedMessageCount > 0) {
        setMessages(localResult.data.meta.sessionPath || transcriptKey, localResult.data.messages);
        setLiveEvents(localResult.data.meta.sessionPath || transcriptKey, []);
        if (repositoryState.loadingTranscriptSessionId === session.id) {
          repositoryState.loadingTranscriptSessionId = '';
        }
      }
    }

    const result = await window.h3code.sessions.getMessages({
      repoId: repositoryState.selectedRepo.id,
      sessionId: session.id,
      sessionPath: session.harnessSessionPath
    });

    if (repositoryState.transcriptLoadToken !== loadToken || repositoryState.selectedSession?.id !== session.id) return;

    if (!result.ok) {
      if (result.error.code === 'pi_process_stopped') return;
      setMessages(transcriptKey, [{
        id: `diagnostic:${Date.now()}`,
        kind: 'diagnostic',
        title: 'Pi message load failed',
        content: result.error.message,
        createdAt: new Date().toISOString()
      }]);
      setLiveEvents(transcriptKey, []);
      repositoryState.promptError = result.error.message;
      return;
    }

    setMessages(result.data.meta.sessionPath || transcriptKey, result.data.messages);
    setLiveEvents(result.data.meta.sessionPath || transcriptKey, []);
  } catch {
    if (repositoryState.transcriptLoadToken !== loadToken || repositoryState.selectedSession?.id !== session.id) return;
    setMessages(transcriptKey, [{
      id: `diagnostic:${Date.now()}`,
      kind: 'diagnostic',
      title: 'Pi message load failed',
      content: 'Could not load Pi messages.',
      createdAt: new Date().toISOString()
    }]);
    setLiveEvents(transcriptKey, []);
    repositoryState.promptError = 'Could not load Pi messages.';
  } finally {
    if (repositoryState.transcriptLoadToken === loadToken && repositoryState.loadingTranscriptSessionId === session.id) {
      repositoryState.loadingTranscriptSessionId = '';
    }
  }
}

export async function sendPrompt() {
  if (!window.h3code?.sessions || !repositoryState.selectedRepo || !repositoryState.selectedSession) {
    repositoryState.promptError = 'Select a repository and chat before sending.';
    return;
  }

  const prompt = repositoryState.promptInput.trim();
  if (!prompt) return;

  const repo = repositoryState.selectedRepo;
  const session = repositoryState.selectedSession;
  repositoryState.isSendingPrompt = true;
  repositoryState.promptError = '';

  try {
    const result = await window.h3code.sessions.sendMessage({
      repoId: repo.id,
      sessionId: session.id,
      sessionPath: session.harnessSessionPath,
      prompt
    });

    if (!result.ok) {
      repositoryState.promptError = result.error.message;
      return;
    }

    repositoryState.promptInput = '';

    if (session.isDraft) {
      await loadSessionsForRepo(repo);
    const created = repositoryState.sessions.find((item) => item.harnessSessionPath === result.data.sessionPath);
      if (created) {
        repositoryState.selectedSession = created;
        setLiveEvents(getTranscriptKey(created), repositoryState.liveEventsByTranscriptKey[getTranscriptKey(session)] ?? []);
      }
    }
  } catch {
    repositoryState.promptError = 'Could not send prompt to Pi.';
  } finally {
    repositoryState.isSendingPrompt = false;
  }
}

export async function stopSelectedSession() {
  if (!window.h3code?.pi || !repositoryState.selectedSession) return;

  repositoryState.isStoppingSession = true;
  repositoryState.promptError = '';

  try {
    const result = await window.h3code.pi.stop();
    if (!result.ok) repositoryState.promptError = result.error.message;
  } catch {
    repositoryState.promptError = 'Could not stop Pi.';
  } finally {
    repositoryState.isStoppingSession = false;
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
  return [...sessions].sort((a, b) => {
    if (a.isDraft && !b.isDraft) return -1;
    if (!a.isDraft && b.isDraft) return 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
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
      return 'Enter a valid chat.';
    case 'repo_not_found':
      return 'Select an existing repository.';
    case 'session_not_found':
      return 'Pi session could not be found.';
    case 'invalid_pi_path':
      return 'Set a valid Pi executable path.';
    default:
      return 'Could not update session. Try again.';
  }
}
