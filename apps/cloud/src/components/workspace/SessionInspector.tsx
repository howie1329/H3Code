'use client'

import type { ReactNode } from 'react'
import type { SessionStatus } from '@h3code/agent-core'

import { Badge } from '#/components/ui/badge.tsx'
import type { SessionDetail } from '#/lib/session/types.ts'
import { cn } from '#/lib/utils.ts'

type SessionInspectorProps = {
  title: string
  status: SessionStatus
  repositoryFullName: string
  repositoryName?: string
  sandboxId?: string
  detail: SessionDetail
  className?: string
}

function InspectorSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  )
}

function InspectorList({ items }: { items: readonly string[] }) {
  if (items.length === 0) {
    return <p className="text-[11px] text-muted-foreground">None</p>
  }

  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="text-[11px] leading-snug text-foreground">
          {item}
        </li>
      ))}
    </ul>
  )
}

export function SessionInspector({
  title,
  status,
  repositoryFullName,
  repositoryName,
  sandboxId,
  detail,
  className,
}: SessionInspectorProps) {
  const messageCount = detail.messages.length

  return (
    <aside
      aria-label="Session inspector"
      className={cn(
        'flex min-h-0 w-64 shrink-0 flex-col gap-5 overflow-y-auto border-l border-border/60 bg-background p-4',
        className,
      )}
    >
      <InspectorSection title="Session">
        <div className="space-y-2">
          <p className="text-xs font-medium leading-snug text-foreground">
            {title}
          </p>
          <Badge variant="outline" className="text-[10px]">
            {status}
          </Badge>
        </div>
      </InspectorSection>

      {sandboxId ? (
        <InspectorSection title="Sandbox">
          <p className="break-all font-mono text-[11px] leading-snug text-muted-foreground">
            {sandboxId}
          </p>
        </InspectorSection>
      ) : null}

      <InspectorSection title="Repository">
        <dl className="space-y-2 text-[11px]">
          <div>
            <dt className="text-muted-foreground">Name</dt>
            <dd className="mt-0.5 font-mono leading-snug text-foreground">
              {repositoryName ?? repositoryFullName}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Full name</dt>
            <dd className="mt-0.5 break-all font-mono leading-snug text-foreground">
              {repositoryFullName}
            </dd>
          </div>
        </dl>
      </InspectorSection>

      <InspectorSection title="Transcript">
        <p className="text-[11px] text-muted-foreground">
          {messageCount} message{messageCount === 1 ? '' : 's'}
        </p>
      </InspectorSection>

      <InspectorSection title="Steering queue">
        <InspectorList items={detail.steering} />
      </InspectorSection>

      <InspectorSection title="Follow-up queue">
        <InspectorList items={detail.followUp} />
      </InspectorSection>
    </aside>
  )
}
