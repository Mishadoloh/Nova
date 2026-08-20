export type Identifier = string;

export type TaskStatus = "todo" | "doing" | "done";
export type TimerMode = "focus" | "break";
export type RestoreMode = "preview" | "merge" | "replace";

export type ProjectRecord = {
  id: Identifier;
  name: string;
  color: string;
  deadline: number | null;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
};

export type TaskRecord = {
  id: Identifier;
  projectId: Identifier;
  text: string;
  done: boolean;
  status: TaskStatus;
  deadline: number | null;
  recurrence: string | null;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
};

export type FocusSessionRecord = {
  id: Identifier;
  projectId: Identifier;
  startedAt: number;
  durationSeconds: number;
};

export type CalendarEventRecord = {
  id: Identifier;
  projectId: Identifier | null;
  title: string;
  startsAt: number;
  durationMinutes: number;
  recurrence: string | null;
  completed: boolean;
  createdAt: number;
  updatedAt: number;
};

export type PreferenceRecord = {
  focusMinutes: number;
  breakMinutes: number;
  autoPomodoro: boolean;
  dailyGoalMinutes: number;
  activeProjectId: Identifier | null;
  timerMode: TimerMode;
};

export type WorkspaceSnapshot = {
  projects: ProjectRecord[];
  tasks: TaskRecord[];
  sessions: FocusSessionRecord[];
  events: CalendarEventRecord[];
  preferences: PreferenceRecord;
};

export type BackupEnvelope = {
  format: "nova-backup";
  version: 1;
  exportedAt: number;
  data: WorkspaceSnapshot;
};

export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T; issues: [] }
  | { ok: false; value: null; issues: ValidationIssue[] };

export type SearchEntity = "project" | "task" | "event";

export type SearchResult = {
  id: Identifier;
  type: SearchEntity;
  title: string;
  subtitle: string;
  href: string;
  color: string | null;
  timestamp: number | null;
  score: number;
};

export type InsightSummary = {
  periodDays: number;
  generatedAt: number;
  totalMinutes: number;
  previousMinutes: number;
  changePercent: number;
  sessions: number;
  averageMinutes: number;
  longestMinutes: number;
  completedTasks: number;
  openTasks: number;
  completionRate: number;
  activeDays: number;
  streakDays: number;
  bestHour: number | null;
  bestWeekday: number | null;
  focusScore: number;
};

export type DailyInsight = {
  date: string;
  sessions: number;
  minutes: number;
};

export type HourInsight = {
  hour: number;
  sessions: number;
  minutes: number;
};

export type WeekdayInsight = {
  weekday: number;
  sessions: number;
  minutes: number;
};

export type ProjectInsight = {
  projectId: Identifier;
  name: string;
  color: string;
  sessions: number;
  minutes: number;
  percent: number;
};

export type InsightPayload = {
  summary: InsightSummary;
  daily: DailyInsight[];
  hourly: HourInsight[];
  weekdays: WeekdayInsight[];
  projects: ProjectInsight[];
  recommendation: string;
};

export type CalendarQuery = {
  from: number;
  to: number;
  projectId: Identifier | null;
  completed: boolean | null;
  limit: number;
  cursor: number | null;
};

export type CalendarMutation = {
  id: Identifier;
  projectId: Identifier | null;
  title: string;
  startsAt: number;
  durationMinutes: number;
  recurrence: string | null;
  completed: boolean;
};

export type BackupPreview = {
  valid: boolean;
  counts: {
    projects: number;
    tasks: number;
    sessions: number;
    events: number;
    total: number;
  };
  dateRange: {
    first: number | null;
    last: number | null;
  };
  issues: ValidationIssue[];
};

export type RestoreResult = {
  mode: Exclude<RestoreMode, "preview">;
  revision: number;
  restoredAt: number;
  counts: BackupPreview["counts"];
};
