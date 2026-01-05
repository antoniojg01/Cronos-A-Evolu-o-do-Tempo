
export type TaskType = 'DAILY' | 'ROUTINE';
export type PriorityLevel = 1 | 2 | 3; // 1: Alta, 2: Média, 3: Baixa

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
  priority: PriorityLevel;
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
