type RepositoryState = {
  repos: Repo[];
  selectedRepo: Repo | null;
  sessions: Session[];
  selectedSession: Session | null;
  repoPathInput: string;
  sessionTitleInput: string;
  repoError: string;
  sessionError: string;
  isLoadingRepos: boolean;
  isLoadingSessions: boolean;
  isAddingRepo: boolean;
  isCreatingSession: boolean;
  isPickingRepoDirectory: boolean;
  isSelectingRepoId: string;
  isSelectingSessionId: string;
  isAddRepoOpen: boolean;
  isCreateSessionOpen: boolean;
};

export const repositoryState = $state<RepositoryState>({
  repos: [],
  selectedRepo: null,
  sessions: [],
  selectedSession: null,
  repoPathInput: '',
  sessionTitleInput: '',
  repoError: '',
  sessionError: '',
  isLoadingRepos: true,
  isLoadingSessions: false,
  isAddingRepo: false,
  isCreatingSession: false,
  isPickingRepoDirectory: false,
  isSelectingRepoId: '',
  isSelectingSessionId: '',
  isAddRepoOpen: false,
  isCreateSessionOpen: false
});

export function canAddRepository() {
  return repositoryState.repoPathInput.trim().length > 0 && !repositoryState.isAddingRepo;
}

export function canCreateSession() {
  return (
    !!repositoryState.selectedRepo &&
    repositoryState.sessionTitleInput.trim().length > 0 &&
    !repositoryState.isCreatingSession
  );
}

export function openCreateSession() {
  repositoryState.sessionError = '';
  repositoryState.isCreateSessionOpen = true;
}

export async function loadRepositories() {
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
  if (!title) {
    repositoryState.sessionError = 'Enter a session title.';
    return;
  }

  repositoryState.isCreatingSession = true;
  repositoryState.sessionError = '';

  try {
    const result = await window.h3code.sessions.create({ repoId: repositoryState.selectedRepo.id, title });

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
  } catch {
    repositoryState.sessionError = 'Could not load sessions.';
    repositoryState.sessions = [];
    repositoryState.selectedSession = null;
  } finally {
    repositoryState.isLoadingSessions = false;
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
    default:
      return 'Could not update session. Try again.';
  }
}
