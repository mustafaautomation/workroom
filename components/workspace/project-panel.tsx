"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  approveDeliverable,
  commentOnDeliverable,
  projectSummary,
  requestChanges,
  sendUpdatedVersion,
  updateTaskStatus,
  uploadFile,
} from "@/lib/actions/work";
import type { ActionResult, SummaryResult } from "@/lib/work/result";
import type { TaskStatus } from "@/lib/domain/types";
import { TASK_STATUS_LABEL } from "@/lib/domain/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const columns: TaskStatus[] = ["backlog", "in_progress", "review", "done"];

type TaskCard = {
  id: string;
  title: string;
  status: TaskStatus;
  clientVisible: boolean;
  assignee: string;
  milestone: string;
};

type DeliverableCard = {
  id: string;
  title: string;
  summary: string;
  status: "pending" | "approved" | "changes_requested";
  statusLabel: string;
  version: string;
  fileId: string | null;
  comments: { id: string; author: string; body: string; when: string }[];
};

export function ProjectPanel({
  projectId,
  readOnly,
  canEdit,
  canReview,
  progress,
  progressLabel,
  milestones,
  tasks,
  files,
  deliverables,
}: {
  projectId: string;
  readOnly: boolean;
  canEdit: boolean;
  canReview: boolean;
  progress: number;
  progressLabel: string;
  milestones: { id: string; name: string; dueLabel: string }[];
  tasks: TaskCard[];
  files: { id: string; name: string; version: string; sizeLabel: string; when: string; by: string }[];
  deliverables: DeliverableCard[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<SummaryResult | null>(null);
  const locked = readOnly || pending;

  function run(work: () => Promise<ActionResult>, success: string) {
    startTransition(async () => {
      try {
        const result = await work();
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(success);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "That change didn't save.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">{progressLabel}</p>
            <p className="mt-1 font-serif text-3xl">{progress}%</p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                const result = await projectSummary(projectId);
                setSummary(result);
                if (!result.ok) toast.error(result.error);
              });
            }}
          >
            Summarize status
          </Button>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-brand" style={{ width: `${progress}%` }} />
        </div>
        {summary?.ok ? (
          <div className="mt-4 rounded-xl bg-muted p-4 text-sm leading-6">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {summary.source === "local" ? "Local summary" : summary.source === "groq" ? "Groq" : "Gemini"}
            </p>
            <p className="mt-2">{summary.text}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted-foreground">No summary yet. Generate one from the project record.</p>
        )}
      </div>

      <Tabs defaultValue={canReview ? "approvals" : "board"}>
        <TabsList aria-label="Project views">
          <TabsTrigger value="board">Board</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
        </TabsList>

        <TabsContent value="board">
          <div className="grid gap-3 md:grid-cols-4">
            {columns.map((column) => (
              <section
                key={column}
                className="min-h-48 rounded-2xl bg-muted/70 p-3"
                onDragOver={(event) => {
                  if (canEdit && !readOnly) event.preventDefault();
                }}
                onDrop={(event) => {
                  if (!canEdit || readOnly) return;
                  const id = event.dataTransfer.getData("text/plain");
                  if (!id) return;
                  run(() => updateTaskStatus(id, column), "Task moved");
                }}
              >
                <h3 className="px-1 text-sm font-medium">{TASK_STATUS_LABEL[column]}</h3>
                <div className="mt-3 space-y-2">
                  {tasks.filter((task) => task.status === column).map((task) => (
                    <article
                      key={task.id}
                      draggable={canEdit && !readOnly}
                      onDragStart={(event) => event.dataTransfer.setData("text/plain", task.id)}
                      className="rounded-xl border border-border bg-card p-3 text-sm"
                    >
                      <p className="font-medium">{task.title}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {task.assignee}
                        {task.clientVisible ? "" : " · Internal"}
                      </p>
                    </article>
                  ))}
                  {tasks.every((task) => task.status !== column) ? (
                    <p className="px-1 text-xs text-muted-foreground">Nothing here</p>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="list">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks on this project yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 font-medium">Task</th>
                    <th className="px-4 py-3 font-medium">Milestone</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <tr key={task.id} className="border-t border-border">
                      <td className="px-4 py-3">
                        {task.title}
                        {task.clientVisible ? null : <span className="ml-2 text-xs text-muted-foreground">Internal</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{task.milestone}</td>
                      <td className="px-4 py-3">
                        {canEdit && !readOnly ? (
                          <select
                            aria-label={`Status for ${task.title}`}
                            className="h-9 rounded-lg border border-input bg-card px-2"
                            value={task.status}
                            disabled={locked}
                            onChange={(event) => run(() => updateTaskStatus(task.id, event.target.value), "Task updated")}
                          >
                            {columns.map((status) => (
                              <option key={status} value={status}>
                                {TASK_STATUS_LABEL[status]}
                              </option>
                            ))}
                          </select>
                        ) : (
                          TASK_STATUS_LABEL[task.status]
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="milestones">
          <div className="space-y-4">
            {milestones.map((milestone) => (
              <article key={milestone.id} className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-medium">{milestone.name}</h3>
                  <p className="text-sm text-muted-foreground">Due {milestone.dueLabel}</p>
                </div>
                <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {tasks.filter((task) => task.milestone === milestone.name).map((task) => (
                    <li key={task.id}>
                      {task.title} · {TASK_STATUS_LABEL[task.status]}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="files">
          <div className="space-y-3">
            {files.length === 0 ? <p className="text-sm text-muted-foreground">No files yet.</p> : null}
            {files.map((file) => (
              <article key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <div>
                  <p className="font-medium">
                    {file.name} <Badge>{file.version}</Badge>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {file.sizeLabel} · {file.by} · {file.when}
                  </p>
                </div>
                <a className="text-sm font-medium underline" href={`/api/files/${file.id}`}>
                  Download
                </a>
              </article>
            ))}
          </div>
          {canEdit ? (
            <UploadForm projectId={projectId} disabled={readOnly} />
          ) : null}
        </TabsContent>

        <TabsContent value="approvals">
          <div className="space-y-4">
            {deliverables.length === 0 ? <p className="text-sm text-muted-foreground">No deliverables yet.</p> : null}
            {deliverables.map((item) => (
              <article key={item.id} className="rounded-2xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-2xl">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>
                  </div>
                  <Badge tone={item.status === "approved" ? "ok" : item.status === "pending" ? "wait" : "warn"}>
                    {item.statusLabel} · {item.version}
                  </Badge>
                </div>
                {item.fileId ? (
                  <a className="mt-3 inline-block text-sm underline" href={`/api/files/${item.fileId}`}>
                    Download {item.version}
                  </a>
                ) : null}
                <div className="mt-4 space-y-3">
                  {item.comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : null}
                  {item.comments.map((comment) => (
                    <div key={comment.id} className="rounded-xl bg-muted px-3 py-2 text-sm">
                      <p className="text-xs text-muted-foreground">
                        {comment.author} · {comment.when}
                      </p>
                      <p className="mt-1">{comment.body}</p>
                    </div>
                  ))}
                </div>
                {(canReview || readOnly) && item.status !== "approved" ? (
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <Button
                      type="button"
                      variant="brand"
                      disabled={locked || !canReview}
                      onClick={() => run(() => approveDeliverable(item.id), "Approved")}
                    >
                      Approve
                    </Button>
                    <ChangeForm id={item.id} disabled={locked} onSubmit={(comment) => run(() => requestChanges(item.id, comment), "Changes requested")} />
                  </div>
                ) : null}
                {!readOnly && (canReview || canEdit) ? (
                  <CommentForm
                    id={item.id}
                    disabled={locked}
                    onSubmit={(body) => run(() => commentOnDeliverable(item.id, body), "Comment sent")}
                  />
                ) : null}
                {canEdit && item.status === "changes_requested" ? (
                  <VersionForm disabled={locked} onSubmit={(version) => run(() => sendUpdatedVersion(item.id, version), "Sent for review")} />
                ) : null}
              </article>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ChangeForm({
  id,
  disabled,
  onSubmit,
}: {
  id: string;
  disabled: boolean;
  onSubmit: (comment: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="flex flex-1 flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
        setValue("");
      }}
    >
      <Label className="sr-only" htmlFor={`changes-${id}`}>
        What should change
      </Label>
      <Input id={`changes-${id}`} value={value} disabled={disabled} placeholder="What should change?" onChange={(event) => setValue(event.target.value)} />
      <Button type="submit" variant="outline" disabled={disabled || value.trim().length < 2}>
        Request changes
      </Button>
    </form>
  );
}

function CommentForm({
  id,
  disabled,
  onSubmit,
}: {
  id: string;
  disabled: boolean;
  onSubmit: (body: string) => void;
}) {
  const [value, setValue] = useState("");
  return (
    <form
      className="mt-4 space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
        setValue("");
      }}
    >
      <Label htmlFor={`comment-${id}`}>Comment</Label>
      <Textarea id={`comment-${id}`} value={value} disabled={disabled} onChange={(event) => setValue(event.target.value)} />
      <Button type="submit" variant="secondary" disabled={disabled || value.trim().length < 2}>
        Post comment
      </Button>
    </form>
  );
}

function VersionForm({ disabled, onSubmit }: { disabled: boolean; onSubmit: (version: string) => void }) {
  const [version, setVersion] = useState("v3");
  return (
    <form
      className="mt-4 flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(version);
      }}
    >
      <Label className="sr-only" htmlFor="version-label">
        Version label
      </Label>
      <Input id="version-label" value={version} disabled={disabled} onChange={(event) => setVersion(event.target.value)} />
      <Button type="submit" disabled={disabled}>
        Send updated version
      </Button>
    </form>
  );
}

function UploadForm({ projectId, disabled }: { projectId: string; disabled: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="mt-6 grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        startTransition(async () => {
          const result = await uploadFile(null, formData);
          setState(result);
          if (result.ok) {
            toast.success("File uploaded");
            form.reset();
            router.refresh();
          } else toast.error(result.error);
        });
      }}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <div className="space-y-2">
        <Label htmlFor="file-name">File name</Label>
        <Input id="file-name" name="name" placeholder="Color ramps" disabled={disabled || pending} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="file-version">Version label</Label>
        <Input id="file-version" name="version" placeholder="v2" disabled={disabled || pending} required />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="file">File</Label>
        <Input id="file" name="file" type="file" disabled={disabled || pending} required />
      </div>
      <Button type="submit" disabled={disabled || pending}>
        {disabled ? "Uploads are off in the demo" : pending ? "Uploading…" : "Upload version"}
      </Button>
      {state && !state.ok ? <p className="text-sm text-destructive">{state.error}</p> : null}
    </form>
  );
}
