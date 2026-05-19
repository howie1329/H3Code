<script lang="ts">
  import { onMount } from 'svelte';

  let settingsState: SettingsState = {
    settings: {
      piExecutablePath: ''
    },
    validation: {
      status: 'missing',
      message: 'Set the Pi executable path before sending prompts.'
    }
  };
  let piExecutablePath = '';
  let prompt = '';
  let isLoadingSettings = true;
  let isSavingSettings = false;
  let isDetectingPi = false;
  let settingsError = '';
  let detectionMessage = '';
  let pendingDetectedPi: PiDetectionResult | null = null;

  $: canSendPrompt = settingsState.validation.status === 'valid';
  $: validationLabel = getValidationLabel(settingsState.validation.status);
  $: validationColor =
    settingsState.validation.status === 'valid'
      ? 'var(--primary)'
      : 'var(--destructive)';

  onMount(() => {
    void loadSettings();
  });

  async function loadSettings() {
    if (!window.h3code?.settings) {
      isLoadingSettings = false;
      settingsError = 'Settings are only available in the desktop app.';
      return;
    }

    isLoadingSettings = true;
    settingsError = '';

    try {
      settingsState = await window.h3code.settings.get();
      piExecutablePath = settingsState.settings.piExecutablePath;

      if (!settingsState.settings.piExecutablePath) {
        await detectPiExecutable({ silent: true });
      }
    } catch {
      settingsError = 'Could not load Pi executable settings.';
    } finally {
      isLoadingSettings = false;
    }
  }

  async function saveSettings() {
    if (!window.h3code?.settings) {
      settingsError = 'Settings are only available in the desktop app.';
      return;
    }

    isSavingSettings = true;
    settingsError = '';

    try {
      settingsState = await window.h3code.settings.update({ piExecutablePath });
      piExecutablePath = settingsState.settings.piExecutablePath;
      pendingDetectedPi = null;
      detectionMessage = '';
    } catch {
      settingsError = 'Could not save Pi executable settings.';
    } finally {
      isSavingSettings = false;
    }
  }

  async function detectPiExecutable({ silent = false } = {}) {
    if (!window.h3code?.settings) {
      if (!silent) settingsError = 'Settings are only available in the desktop app.';
      return;
    }

    isDetectingPi = true;
    if (!silent) {
      settingsError = '';
      detectionMessage = '';
      pendingDetectedPi = null;
    }

    try {
      const result = await window.h3code.settings.detectPiExecutable();

      if (!result.ok) {
        if (!silent) settingsError = result.error.message;
        return;
      }

      const detected = result.data;
      const sourceLabel = getDetectionSourceLabel(detected.source);
      const shouldUseDetectedPath =
        !piExecutablePath.trim() || settingsState.validation.status !== 'valid';

      if (shouldUseDetectedPath) {
        piExecutablePath = detected.path;
        detectionMessage = `Detected Pi via ${sourceLabel}. Click Save to use it.`;
        pendingDetectedPi = null;
        return;
      }

      if (piExecutablePath.trim() !== detected.path) {
        pendingDetectedPi = detected;
        detectionMessage = `Detected Pi via ${sourceLabel}.`;
      } else {
        detectionMessage = `Detected Pi via ${sourceLabel}.`;
      }
    } catch {
      if (!silent) settingsError = 'Could not auto-detect Pi.';
    } finally {
      isDetectingPi = false;
    }
  }

  function useDetectedPiPath() {
    if (!pendingDetectedPi) return;

    piExecutablePath = pendingDetectedPi.path;
    detectionMessage = `Using detected Pi path. Click Save to persist it.`;
    pendingDetectedPi = null;
  }

  function getDetectionSourceLabel(source: PiDetectionSource) {
    switch (source) {
      case 'path':
        return 'PATH';
      case 'nvm':
        return 'nvm';
      case 'local-bin':
        return '~/.local/bin';
      case 'pnpm':
        return 'pnpm';
      case 'homebrew':
        return 'Homebrew';
      case 'system':
        return 'system paths';
    }
  }

  function getValidationLabel(status: PiExecutableValidationStatus) {
    switch (status) {
      case 'valid':
        return 'Valid';
      case 'missing':
        return 'Missing';
      case 'nonexistent':
        return 'Not found';
      case 'non-file':
        return 'Not a file';
      case 'non-executable':
        return 'Not executable';
    }
  }
</script>

<svelte:head>
  <title>H3 Code</title>
</svelte:head>

<main class="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
  <aside class="flex w-60 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)] p-3">
    <div class="mb-6 text-sm font-semibold">H3 Code</div>

    <section class="space-y-2">
      <h2 class="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Repos</h2>
      <p class="rounded-md px-2 py-1.5 text-xs text-[var(--muted-foreground)]">No repos added</p>
    </section>

    <section class="mt-6 space-y-2">
      <h2 class="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Sessions</h2>
      <p class="rounded-md px-2 py-1.5 text-xs text-[var(--muted-foreground)]">No active session</p>
    </section>

    <section class="mt-6 space-y-2">
      <h2 class="text-[11px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">Settings</h2>
      <p class="rounded-md bg-[var(--sidebar-accent)] px-2 py-1.5 text-xs font-medium">Pi executable</p>
    </section>

    <div class="mt-auto text-[11px] text-[var(--muted-foreground)]">Pi Desk scaffold</div>
  </aside>

  <section class="flex min-w-0 flex-1 flex-col">
    <header class="flex h-12 items-center justify-between border-b border-[var(--border)] px-4">
      <div>
        <h1 class="text-sm font-semibold">Pi executable settings</h1>
        <p class="text-[11px] text-[var(--muted-foreground)]">Configure Pi before starting a session.</p>
      </div>
      <div class="flex items-center gap-2 text-[11px]">
        <span class="size-1.5 rounded-full bg-current" style:color={validationColor}></span>
        <span style:color={validationColor}>{validationLabel}</span>
      </div>
    </header>

    <div class="flex min-h-0 flex-1 flex-col">
      <div class="border-b border-[var(--border)] p-4">
        <div class="max-w-3xl space-y-3">
          <div class="flex items-end gap-2">
            <label class="min-w-0 flex-1 space-y-1">
              <span class="block text-xs font-medium">Pi executable path</span>
              <input
                class="h-8 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 text-xs text-[var(--foreground)] outline-none ring-[var(--ring)] placeholder:text-[var(--muted-foreground)] focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                placeholder="/usr/local/bin/pi"
                bind:value={piExecutablePath}
                disabled={isLoadingSettings || isSavingSettings}
              />
            </label>

            <button
              class="h-8 rounded-md border border-[var(--border)] px-3 text-xs font-medium text-[var(--foreground)] outline-none ring-[var(--ring)] hover:bg-[var(--accent)] focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              on:click={() => detectPiExecutable()}
              disabled={isLoadingSettings || isSavingSettings || isDetectingPi}
            >
              {isDetectingPi ? 'Detecting...' : 'Auto-detect Pi'}
            </button>

            <button
              class="h-8 rounded-md bg-[var(--primary)] px-3 text-xs font-medium text-[var(--background)] outline-none ring-[var(--ring)] hover:opacity-90 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              type="button"
              on:click={saveSettings}
              disabled={isLoadingSettings || isSavingSettings || isDetectingPi}
            >
              {isSavingSettings ? 'Saving...' : 'Save'}
            </button>
          </div>

          <div class="flex items-center gap-2 text-xs">
            <span class="font-medium" style:color={validationColor}>{validationLabel}</span>
            <span class="text-[var(--muted-foreground)]">{settingsState.validation.message}</span>
          </div>

          {#if detectionMessage}
            <div class="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
              <span>{detectionMessage}</span>
              {#if pendingDetectedPi}
                <button
                  class="font-medium text-[var(--primary)] underline-offset-2 hover:underline"
                  type="button"
                  on:click={useDetectedPiPath}
                >
                  Use detected path
                </button>
              {/if}
            </div>
          {/if}

          {#if settingsError}
            <p class="text-xs text-[var(--destructive)]">{settingsError}</p>
          {/if}
        </div>
      </div>

      <div class="flex min-h-0 flex-1 flex-col">
        <div class="flex flex-1 items-center justify-center p-6">
          <div class="max-w-md text-center">
            <p class="text-base font-semibold">No session selected</p>
            <p class="mt-2 text-xs leading-5 text-[var(--muted-foreground)]">
              Prompt sending will unlock when the Pi executable path is valid.
            </p>
          </div>
        </div>

        <form class="border-t border-[var(--border)] p-4" on:submit|preventDefault>
          <div class="flex gap-2">
            <input
              class="h-9 min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-xs text-[var(--foreground)] outline-none ring-[var(--ring)] placeholder:text-[var(--muted-foreground)] focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              placeholder={canSendPrompt ? 'Send a prompt to Pi' : settingsState.validation.message}
              bind:value={prompt}
              disabled={!canSendPrompt}
            />

            <button
              class="h-9 rounded-md bg-[var(--primary)] px-3 text-xs font-medium text-[var(--background)] outline-none ring-[var(--ring)] hover:opacity-90 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
              type="submit"
              disabled={!canSendPrompt || !prompt.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  </section>
</main>
