
export type TaskType = 'DAILY' | 'ROUTINE';
export type PriorityLevel = 1 | 2 | 3; // 1: Alta, 2: Média, 3: Baixa
export type CompletionMode = 'TIMER' | 'MANUAL';
export type TaskCategory = 'WORK' | 'LEISURE';

export interface Period {
  id: string;
  name: string;
}

export interface TaskStep {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  type: TaskType;
  category?: TaskCategory;
  priority: PriorityLevel;
  completionMode: CompletionMode;
  requiresInput: boolean;
  currentInput?: string;
  periodId?: string;
  completedAt?: number;
  lastDone?: number;
  status: 'PENDING' | 'COMPLETED' | 'GAVE_UP' | 'IGNORED';
  createdAt: number;
  steps?: TaskStep[];
}

export interface TimeLog {
  timestamp: number;
  seconds: number;
  taskId: string;
  taskTitle: string;
}

export interface UserStats {
  xp: number;
  level: number;
  completedCount: number;
  gaveUpCount: number;
  ignoredCount: number;
  timeLogs: TimeLog[];
}

export interface LevelInfo {
  level: number;
  name: string;
  xpRequired: number;
  storyEra: string;
}

export type TimerMode = 'STOPWATCH' | 'TIMER' | 'POMODORO';
