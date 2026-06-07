<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { cn } from "$lib/utils.js";

  import {
    buildQuestionnaireResult,
    type AskUserQuestion,
    type QuestionAnswerInput,
    type QuestionnaireResult,
  } from "./ask-user-question.js";

  type Props = {
    open: boolean;
    payload: unknown;
    onSubmit: (result: QuestionnaireResult) => void;
    onCancel: () => void;
  };

  let { open, payload, onSubmit, onCancel }: Props = $props();

  function parseQuestions(value: unknown): AskUserQuestion[] {
    if (!value || typeof value !== "object" || !("questions" in value)) {
      return [];
    }

    const record = value as { questions?: unknown };
    return Array.isArray(record.questions) ? (record.questions as AskUserQuestion[]) : [];
  }

  const questions = $derived(parseQuestions(payload));
  const totalQuestions = $derived(questions.length);

  let questionIndex = $state(0);
  let answers = $state<QuestionAnswerInput[]>([]);
  let selectedOption = $state<string | undefined>();
  let selectedOptions = $state<string[]>([]);
  let customInputOpen = $state(false);
  let customInputValue = $state("");

  const currentQuestion = $derived(questions[questionIndex]);
  const isFirstQuestion = $derived(questionIndex === 0);
  const isLastQuestion = $derived(questionIndex >= totalQuestions - 1);
  const isMultiSelect = $derived(Boolean(currentQuestion?.multiSelect));

  $effect(() => {
    if (!open) {
      questionIndex = 0;
      answers = [];
      selectedOption = undefined;
      selectedOptions = [];
      customInputOpen = false;
      customInputValue = "";
      return;
    }

    const saved = answers[questionIndex];
    selectedOption = undefined;
    selectedOptions = [];
    customInputOpen = false;
    customInputValue = "";

    if (!saved) {
      return;
    }

    if (saved.kind === "option") {
      selectedOption = saved.answer;
    } else if (saved.kind === "custom") {
      customInputOpen = true;
      customInputValue = saved.answer;
    } else if (saved.kind === "multi") {
      selectedOptions = [...saved.selected];
    }
  });

  function canAdvance(): boolean {
    if (!currentQuestion) {
      return false;
    }

    if (isMultiSelect) {
      return selectedOptions.length > 0;
    }

    if (customInputOpen) {
      return customInputValue.trim().length > 0;
    }

    return Boolean(selectedOption);
  }

  function currentAnswerInput(): QuestionAnswerInput | undefined {
    if (!currentQuestion) {
      return undefined;
    }

    if (isMultiSelect) {
      return selectedOptions.length > 0 ? { kind: "multi", selected: [...selectedOptions] } : undefined;
    }

    if (customInputOpen) {
      const value = customInputValue.trim();
      return value ? { kind: "custom", answer: value } : undefined;
    }

    return selectedOption ? { kind: "option", answer: selectedOption } : undefined;
  }

  function saveCurrentAnswer() {
    const input = currentAnswerInput();
    if (!input) {
      return;
    }

    const nextAnswers = [...answers];
    nextAnswers[questionIndex] = input;
    answers = nextAnswers;
  }

  function submitWithInput(input: QuestionAnswerInput) {
    const nextAnswers = [...answers];
    nextAnswers[questionIndex] = input;
    onSubmit(buildQuestionnaireResult(questions, nextAnswers));
  }

  function handleOptionClick(label: string) {
    if (isMultiSelect) {
      selectedOptions = selectedOptions.includes(label)
        ? selectedOptions.filter((item) => item !== label)
        : [...selectedOptions, label];
      return;
    }

    selectedOption = label;
    customInputOpen = false;
    customInputValue = "";
  }

  function handleChat() {
    submitWithInput({ kind: "chat" });
  }

  function handleBack() {
    if (isFirstQuestion) {
      return;
    }

    saveCurrentAnswer();
    questionIndex -= 1;
  }

  function handleNext() {
    const input = currentAnswerInput();
    if (!input) {
      return;
    }

    const nextAnswers = [...answers];
    nextAnswers[questionIndex] = input;
    answers = nextAnswers;

    if (isLastQuestion) {
      onSubmit(buildQuestionnaireResult(questions, nextAnswers));
      return;
    }

    questionIndex += 1;
  }

  function handleCancel() {
    onCancel();
  }
</script>

{#if totalQuestions > 0}
  <Dialog.Root {open} onOpenChange={(nextOpen) => !nextOpen && handleCancel()}>
    <Dialog.Content class="sm:max-w-lg">
      <Dialog.Header>
        <Dialog.Title>{currentQuestion?.header ?? "Question"}</Dialog.Title>
        <Dialog.Description class="whitespace-pre-wrap break-words">
          {currentQuestion?.question}
        </Dialog.Description>
        {#if totalQuestions > 1}
          <p class="text-muted-foreground text-[11px]">
            Question {questionIndex + 1} of {totalQuestions}
          </p>
        {/if}
      </Dialog.Header>

      <div class="flex max-h-72 flex-col gap-2 overflow-y-auto">
        {#each currentQuestion?.options ?? [] as option (option.label)}
          <Button
            type="button"
            variant="outline"
            class={cn(
              "h-auto min-h-9 flex-col items-start gap-0.5 whitespace-normal px-3 py-2 text-left",
              !isMultiSelect && selectedOption === option.label && "border-primary bg-primary/5",
              isMultiSelect && selectedOptions.includes(option.label) && "border-primary bg-primary/5",
            )}
            onclick={() => handleOptionClick(option.label)}
          >
            <span class="font-medium">{option.label}</span>
            <span class="text-muted-foreground text-[11px]">{option.description}</span>
          </Button>
        {/each}
      </div>

      {#if !isMultiSelect}
        <div class="space-y-2">
          {#if !customInputOpen}
            <Button type="button" variant="ghost" class="h-8 px-2 text-xs" onclick={() => (customInputOpen = true)}>
              Type your answer
            </Button>
          {:else}
            <div class="space-y-2">
              <label for="ask-user-custom-input" class="text-xs font-medium">Your answer</label>
              <Input
                id="ask-user-custom-input"
                bind:value={customInputValue}
                onkeydown={(event) => event.key === "Enter" && canAdvance() && handleNext()}
              />
            </div>
          {/if}

          <Button type="button" variant="ghost" class="h-8 px-2 text-xs" onclick={handleChat}>
            Chat about this
          </Button>
        </div>
      {/if}

      <Dialog.Footer>
        <Button type="button" variant="outline" onclick={handleCancel}>Cancel</Button>
        {#if !isFirstQuestion}
          <Button type="button" variant="outline" onclick={handleBack}>Back</Button>
        {/if}
        <Button type="button" onclick={handleNext} disabled={!canAdvance()}>
          {isLastQuestion ? "Submit" : "Next"}
        </Button>
      </Dialog.Footer>
    </Dialog.Content>
  </Dialog.Root>
{/if}
