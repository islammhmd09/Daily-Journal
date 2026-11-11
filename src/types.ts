export type Lang = 'en' | 'ar';
export type Rating = 1 | 2 | 3 | 4 | 5 | null;

export interface JournalEntry {
  id: string;
  date: string; // YYYY-MM-DD, one journal per day
  rating: Rating;
  dayText: string;
  feelings: string;
  story: string;
  forgiveness: string;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'todo' | 'partial' | 'done';

export interface Task {
  id: string;
  title: string;
  notes: string;
  date: string;     // YYYY-MM-DD. Normal task: its day. Long-term task: the day it starts.
  time: string;     // 'HH:MM' start, or ''
  endTime: string;  // 'HH:MM' end, or ''
  group: string;    // project label, or '' for a single task
  pinned: boolean;  // long-term: shows every day from `date` until deleted
  status: TaskStatus;                 // used by normal tasks
  log: Record<string, TaskStatus>;    // used by long-term tasks: status per day
  createdAt: string;
  updatedAt: string;
}
