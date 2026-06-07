import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildQuestionnaireResult,
  type AskUserQuestion,
  type QuestionAnswerInput,
} from "./ask-user-question.js";

const sampleQuestions: AskUserQuestion[] = [
  {
    question: "Which approach?",
    header: "Scope",
    options: [
      { label: "A", description: "Option A" },
      { label: "B", description: "Option B" },
    ],
  },
  {
    question: "Pick all that apply",
    header: "Features",
    multiSelect: true,
    options: [
      { label: "Auth", description: "Authentication" },
      { label: "API", description: "REST API" },
    ],
  },
];

describe("buildQuestionnaireResult", () => {
  it("maps a single option pick", () => {
    const inputs: QuestionAnswerInput[] = [{ kind: "option", answer: "A" }];

    const result = buildQuestionnaireResult([sampleQuestions[0]!], inputs);

    assert.deepEqual(result, {
      cancelled: false,
      answers: [
        {
          questionIndex: 0,
          question: "Which approach?",
          kind: "option",
          answer: "A",
        },
      ],
    });
  });

  it("maps custom text answers", () => {
    const inputs: QuestionAnswerInput[] = [{ kind: "custom", answer: "Something else" }];

    const result = buildQuestionnaireResult([sampleQuestions[0]!], inputs);

    assert.deepEqual(result.answers[0], {
      questionIndex: 0,
      question: "Which approach?",
      kind: "custom",
      answer: "Something else",
    });
  });

  it("maps chat escape answers", () => {
    const inputs: QuestionAnswerInput[] = [{ kind: "chat" }];

    const result = buildQuestionnaireResult([sampleQuestions[0]!], inputs);

    assert.deepEqual(result.answers[0], {
      questionIndex: 0,
      question: "Which approach?",
      kind: "chat",
      answer: "Chat about this",
    });
  });

  it("maps multi-select answers", () => {
    const inputs: QuestionAnswerInput[] = [{ kind: "multi", selected: ["Auth", "API"] }];

    const result = buildQuestionnaireResult([sampleQuestions[1]!], inputs);

    assert.deepEqual(result.answers[0], {
      questionIndex: 0,
      question: "Pick all that apply",
      kind: "multi",
      answer: null,
      selected: ["Auth", "API"],
    });
  });

  it("returns cancelled with no answers", () => {
    assert.deepEqual(buildQuestionnaireResult(sampleQuestions, null, true), {
      answers: [],
      cancelled: true,
    });
  });
});
