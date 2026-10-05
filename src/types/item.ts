export const ITEM_TYPES = ['assignment', 'exam'] as const;
export const TASK_STATUSES = ['To Do', 'In Progress', 'Done'] as const;
export const TASK_PRIORITIES = ['High', 'Medium', 'Low'] as const;

export type ItemType = (typeof ITEM_TYPES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const ITEM_TYPE_LABEL: Record<ItemType, string> = {
  assignment: 'Tugas',
  exam: 'Ujian',
};

/** A study chapter on an exam. Titles may repeat; ids may not. */
export interface Subtask {
  id: string;
  title: string;
  isCompleted: boolean;
}

export interface Item {
  id: string;
  type: ItemType;
  title: string;
  course: string;
  description: string;
  /** ISO-8601 with an explicit +07:00 offset, e.g. 2026-10-05T14:00:00+07:00 */
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
}

/** The only fields a form may set. System fields are absent by design. */
export interface ItemDraft {
  type: ItemType;
  title: string;
  course: string;
  description: string;
  /** Raw datetime-local value; converted to offset ISO by the service on save. */
  deadline: string;
  priority: TaskPriority;
  status: TaskStatus;
  subtasks: Subtask[];
}

function isMember<T extends string>(value: unknown, members: readonly T[]): value is T {
  return typeof value === 'string' && (members as readonly string[]).includes(value);
}

export function isItemType(value: unknown): value is ItemType {
  return isMember(value, ITEM_TYPES);
}

export function isTaskStatus(value: unknown): value is TaskStatus {
  return isMember(value, TASK_STATUSES);
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return isMember(value, TASK_PRIORITIES);
}

export function emptyDraft(): ItemDraft {
  return {
    type: 'assignment',
    title: '',
    course: '',
    description: '',
    deadline: '',
    priority: 'Medium',
    status: 'To Do',
    subtasks: [],
  };
}
