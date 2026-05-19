type RepositoryState = {
  repos: Repo[];
  selectedRepo: Repo | null;
  repoPathInput: string;
  repoError: string;
  isLoadingRepos: boolean;
  isAddingRepo: boolean;
  isPickingRepoDirectory: boolean;
  isSelectingRepoId: string;
  isAddRepoOpen: boolean;
};

export const repositoryState = $state<RepositoryState>({
  repos: [],
  selectedRepo: null,
  repoPathInput: '',
  repoError: '',
  isLoadingRepos: true,
  isAddingRepo: false,
  isPickingRepoDirectory: false,
  isSelectingRepoId: '',
  isAddRepoOpen: false
});

export function canAddRepository() {
  return repositoryState.repoPathInput.trim().length > 0 && !repositoryState.isAddingRepo;
}

export async function loadRepositories() {
  if (!window.h3code?.repos) {
    repositoryState.isLoadingRepos = false;
    repositoryState.repoError = 'Repositories are only available in the desktop app.';
    return;
  }

  repositoryState.isLoadingRepos = true;
  repositoryState.repoError = '';

  try {
    const result = await window.h3code.repos.list();

    if (!result.ok) {
      repositoryState.repoError = 'Could not load repositories.';
      return;
    }

    repositoryState.repos = result.data;
    repositoryState.selectedRepo = result.data[0] ?? null;
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
  } catch {
    repositoryState.repoError = 'Could not select repository. Try again.';
  } finally {
    repositoryState.isSelectingRepoId = '';
  }
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
