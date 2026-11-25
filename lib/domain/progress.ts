import type { Actor, Task, TaskStatus } from "./types";

const WEIGHT: Record<TaskStatus, number> = {
  backlog: 0,
  in_progress: 0.5,
  review: 0.75,
  done: 1,
};

export function progressFor(tasks: Task[], actor: Actor): number {
  const visible = tasks.filter((task) => (actor.role === "client" ? task.clientVisible : true));
  if (visible.length === 0) return 0;
  const sum = visible.reduce((total, task) => total + WEIGHT[task.status], 0);
  return Math.round((sum / visible.length) * 100);
}

export function progressCaption(actor: Actor): string {
  if (actor.role === "client") return "Progress on work shared with you";
  return "Progress across the full task list, including internal work";
}
