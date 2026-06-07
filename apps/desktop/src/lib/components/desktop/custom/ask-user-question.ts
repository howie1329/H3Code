export type AskUserOption = { label: string; description: string; preview?: string };

export type AskUserQuestion = {
  question: string;
  header: string;
  multiSelect?: boolean;
  options: AskUserOption[];
};

export type QuestionAnswer = {
  questionIndex: number;
  question: string;
  kind: "option" | "custom" | "chat" | "multi";
  answer: string | null;
  selected?: string[];
};

export type QuestionnaireResult = { answers: QuestionAnswer[]; cancelled: boolean };

export type QuestionAnswerInput =
  | { kind: "option"; answer: string }
  | { kind: "custom"; answer: string }
  | { kind: "chat" }
  | { kind: "multi"; selected: string[] };

export function buildQuestionnaireResult(
  questions: AskUserQuestion[],
  inputs: QuestionAnswerInput[] | null,
  cancelled = false,
): QuestionnaireResult {
  if (cancelled || inputs === null) {
    return { answers: [], cancelled: true };
  }

  const answers: QuestionAnswer[] = inputs.map((input, questionIndex) => {
    const question = questions[questionIndex];
    const questionText = question?.question ?? "";

    switch (input.kind) {
      case "option":
        return {
          questionIndex,
          question: questionText,
          kind: "option",
          answer: input.answer,
        };
      case "custom":
        return {
          questionIndex,
          question: questionText,
          kind: "custom",
          answer: input.answer,
        };
      case "chat":
        return {
          questionIndex,
          question: questionText,
          kind: "chat",
          answer: "Chat about this",
        };
      case "multi":
        return {
          questionIndex,
          question: questionText,
          kind: "multi",
          answer: null,
          selected: input.selected,
        };
    }
  });

  return { answers, cancelled: false };
}
