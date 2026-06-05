import {
  assistantMessage,
  textPart,
  thinking,
  toolCall,
  toolResult,
  userMessage,
} from '#/lib/mock/message-builders.ts'
import { sessionRecord } from '#/lib/mock/session-builders.ts'
import type { MockSessionRecord } from '#/lib/mock/types.ts'

const REPO_ID = 'design-system'
const REPO_PATH = '/workspace/design-system'

export const DESIGN_SYSTEM_SESSIONS: readonly MockSessionRecord[] = [
  sessionRecord({
    id: 'ds-token-rename',
    repositoryId: REPO_ID,
    title: 'Rename spacing tokens',
    preview: 'grep spacing- → space-',
    repoPath: REPO_PATH,
    status: 'idle',
    detail: {
      messages: [
        userMessage(
          'u1',
          'Rename spacing-* CSS variables to space-* across the design system package.',
        ),
        assistantMessage('a1', [
          thinking('Find all spacing token references before bulk replace.'),
          toolCall('tc-grep-spacing', 'grep', {
            pattern: 'spacing-',
            path: 'packages/design-system',
          }),
        ]),
        toolResult(
          'tr-grep-spacing',
          'tc-grep-spacing',
          'grep',
          '47 matches in tokens.css, Button.svelte, Card.svelte, README.md',
        ),
        assistantMessage('a2', [
          toolCall('tc-strreplace-tokens', 'StrReplace', {
            path: 'packages/design-system/src/tokens.css',
            old_string: '--spacing-',
            new_string: '--space-',
          }),
        ]),
        toolResult(
          'tr-strreplace-tokens',
          'tc-strreplace-tokens',
          'StrReplace',
          'tokens.css updated (12 replacements)',
        ),
        assistantMessage('a3', [
          toolCall('tc-strreplace-components', 'StrReplace', {
            path: 'packages/design-system/src/components',
            old_string: 'spacing-',
            new_string: 'space-',
            replace_all: true,
          }),
        ]),
        toolResult(
          'tr-strreplace-components',
          'tc-strreplace-components',
          'StrReplace',
          '35 replacements across 8 component files.',
        ),
        assistantMessage('a4', [
          textPart(
            'Token rename complete. Run visual regression on Storybook before merging.',
          ),
        ]),
      ],
      steering: [],
      followUp: [],
      isStreaming: false,
      isCompacting: false,
    },
  }),

  sessionRecord({
    id: 'ds-button-docs',
    repositoryId: REPO_ID,
    title: 'Document Button API',
    preview: 'Plan + read Button source',
    repoPath: REPO_PATH,
    status: 'idle',
    detail: {
      messages: [
        userMessage(
          'u1',
          'Write Button component docs: variants, sizes, loading state, and accessibility.',
        ),
        assistantMessage('a1', [
          thinking(
            'Review Button props and existing stories.\n\nPlan:\n1. Read Button.tsx and stories\n2. Draft MDX with prop table\n3. Add a11y notes for disabled vs loading',
          ),
          textPart(
            '## Documentation plan\n\n| Section | Content |\n| --- | --- |\n| Overview | When to use Button vs IconButton |\n| Variants | default, outline, ghost, destructive |\n| States | loading spinner, disabled, focus ring |\n| A11y | `aria-busy`, keyboard activation |',
          ),
          toolCall('tc-read-button', 'read', {
            path: 'packages/design-system/src/components/Button.tsx',
          }),
        ]),
        toolResult(
          'tr-read-button',
          'tc-read-button',
          'read',
          'export function Button({ variant, size, loading, ...props }: ButtonProps)',
        ),
        assistantMessage('a2', [
          toolCall('tc-read-stories', 'read', {
            path: 'packages/design-system/src/components/Button.stories.tsx',
          }),
        ]),
        toolResult(
          'tr-stories',
          'tc-read-stories',
          'read',
          'Stories: Default, Outline, Loading, Disabled, WithIcon',
        ),
        assistantMessage('a3', [
          toolCall('tc-write-mdx', 'write', {
            path: 'packages/design-system/docs/Button.mdx',
          }),
        ]),
        toolResult(
          'tr-write-mdx',
          'tc-write-mdx',
          'write',
          'Created Button.mdx with props table and usage examples.',
        ),
        assistantMessage('a4', [
          textPart(
            'Button docs drafted in `docs/Button.mdx`. Review the loading state section for accuracy.',
          ),
        ]),
      ],
      steering: [],
      followUp: [],
      isStreaming: false,
      isCompacting: false,
    },
  }),

  sessionRecord({
    id: 'ds-long-thread',
    repositoryId: REPO_ID,
    title: 'Audit component usage',
    preview: '2 turns · steering queue',
    repoPath: REPO_PATH,
    status: 'idle',
    detail: {
      messages: [
        userMessage(
          'u1',
          'Audit which apps still import Card from the old path `@/components/ui/card`.',
        ),
        assistantMessage('a1', [
          thinking('Monorepo-wide grep for legacy card imports.'),
          toolCall('tc-grep-card', 'grep', {
            pattern: '@/components/ui/card',
            path: '.',
          }),
        ]),
        toolResult(
          'tr-grep-card',
          'tc-grep-card',
          'grep',
          'apps/cloud: 12 files\napps/desktop: 4 files\npackages/design-system: 0 files',
        ),
        assistantMessage('a2', [
          toolCall('tc-read-cloud-card', 'read', {
            path: 'apps/cloud/src/components/ui/card.tsx',
          }),
        ]),
        toolResult(
          'tr-read-cloud-card',
          'tc-read-cloud-card',
          'read',
          'shadcn card — local to cloud app',
        ),
        assistantMessage('a3', [
          textPart(
            'Cloud uses a local shadcn card, not the design-system package. Desktop has 4 legacy imports to migrate.',
          ),
        ]),
        userMessage(
          'u2',
          'Also list components exported from design-system but unused anywhere.',
        ),
        assistantMessage('a4', [
          thinking('Compare package exports to import graph.'),
          toolCall('tc-bash-exports', 'bash', {
            command:
              'npm run analyze-exports --workspace @h3code/design-system',
          }),
        ]),
        toolResult(
          'tr-bash-exports',
          'tc-bash-exports',
          'bash',
          'Unused exports: Persona (0 imports), MicSelector (0 imports), VoiceSelector (1 import in dev only)',
        ),
        assistantMessage('a5', [
          toolCall('tc-grep-persona', 'grep', {
            pattern: 'Persona',
            path: '.',
          }),
        ]),
        toolResult(
          'tr-grep-persona',
          'tc-grep-persona',
          'grep',
          'Only defined in design-system/src/components/Persona.tsx',
        ),
        assistantMessage('a6', [
          textPart(
            'Audit complete. Recommend deprecating Persona and MicSelector, and migrating desktop Card imports in a follow-up PR.',
          ),
        ]),
      ],
      steering: ['migrate desktop card imports', 'deprecate unused exports'],
      followUp: ['open PR for cloud card alignment'],
      isStreaming: false,
      isCompacting: false,
    },
  }),
]
