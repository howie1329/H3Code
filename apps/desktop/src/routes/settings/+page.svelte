<script lang="ts">
  import { onMount } from 'svelte';
  import { Badge } from '$lib/components/ui/badge';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import { Label } from '$lib/components/ui/label';
  import { Separator } from '$lib/components/ui/separator';
  import * as Sidebar from '$lib/components/ui/sidebar';

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
  $: validationTone = getValidationTone(settingsState.validation.status);

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

  function getValidationTone(status: PiExecutableValidationStatus) {
    return status === 'valid' ? 'valid' : 'invalid';
  }
</script>

<svelte:head>
  <title>Settings · H3 Code</title>
</svelte:head>

<div class="flex min-h-svh min-w-0 flex-col bg-background text-foreground">
  <header class="flex h-12 items-center gap-2 px-4">
    <Sidebar.Trigger class="size-8" />
    <div>
      <h1 class="text-xl font-semibold leading-tight">Settings</h1>
      <p class="text-[11px] leading-tight text-muted-foreground">Configure Pi before starting a session.</p>
    </div>
  </header>
  <Separator />

  <div class="flex min-h-0 flex-1 flex-col">
    <section class="px-4 py-5">
      <div class="grid max-w-4xl gap-4 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div class="space-y-1">
          <h2 class="text-base font-semibold leading-tight">Pi executable</h2>
          <p class="text-[11px] leading-snug text-muted-foreground">
            Set the local Pi binary used to validate the desktop prompt workflow.
          </p>
        </div>

        <div class="min-w-0 space-y-3">
          <div class="space-y-1.5">
            <Label for="pi-executable-path">Executable path</Label>
            <div class="flex flex-col gap-2 sm:flex-row">
              <Input
                id="pi-executable-path"
                class="h-8 flex-1 bg-background text-xs"
                placeholder="/usr/local/bin/pi"
                bind:value={piExecutablePath}
                disabled={isLoadingSettings || isSavingSettings}
                aria-invalid={validationTone === 'invalid'}
              />

              <div class="flex gap-2">
                <Button
                  class="h-8"
                  variant="outline"
                  type="button"
                  onclick={() => detectPiExecutable()}
                  disabled={isLoadingSettings || isSavingSettings || isDetectingPi}
                >
                  {isDetectingPi ? 'Detecting...' : 'Auto-detect Pi'}
                </Button>

                <Button
                  class="h-8"
                  type="button"
                  onclick={saveSettings}
                  disabled={isLoadingSettings || isSavingSettings || isDetectingPi}
                >
                  {isSavingSettings ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2 text-xs">
            <span
              class="size-1.5 rounded-full"
              class:bg-primary={validationTone === 'valid'}
              class:bg-destructive={validationTone === 'invalid'}
              aria-hidden="true"
            ></span>
            <Badge variant={validationTone === 'valid' ? 'secondary' : 'destructive'}>{validationLabel}</Badge>
            <span class="text-muted-foreground">{settingsState.validation.message}</span>
          </div>

          {#if detectionMessage}
            <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{detectionMessage}</span>
              {#if pendingDetectedPi}
                <Button
                  class="h-auto px-0 py-0 text-xs"
                  variant="link"
                  type="button"
                  onclick={useDetectedPiPath}
                >
                  Use detected path
                </Button>
              {/if}
            </div>
          {/if}

          {#if settingsError}
            <p class="text-xs text-destructive">{settingsError}</p>
          {/if}
        </div>
      </div>
    </section>

    <Separator />

    <div class="flex min-h-0 flex-1 flex-col">
      <div class="flex flex-1 items-center justify-center p-6">
        <div class="max-w-md text-center">
          <p class="text-base font-semibold leading-tight">No session selected</p>
          <p class="mt-2 text-xs leading-5 text-muted-foreground">
            Prompt sending will unlock when the Pi executable path is valid.
          </p>
        </div>
      </div>

      <Separator />

      <form class="p-4" onsubmit={(event) => event.preventDefault()}>
        <div class="flex gap-2">
          <Input
            class="h-9 min-w-0 flex-1 bg-background text-xs"
            placeholder={canSendPrompt ? 'Send a prompt to Pi' : settingsState.validation.message}
            bind:value={prompt}
            disabled={!canSendPrompt}
          />

          <Button class="h-9" type="submit" disabled={!canSendPrompt || !prompt.trim()}>
            Send
          </Button>
        </div>
      </form>
    </div>
  </div>
</div>
