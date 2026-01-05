
export type TaskType = 'DAILY' | 'ROUTINE';

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
  periodId?: string; // Para rotinas
  completedAt?: number;
  lastDone?: number; // Para rotinas acompanharem o reset diário
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
