
import React, { useState, useEffect } from 'react';
import { Task, TimerMode } from '../types.ts';

interface TimerModalProps {
  task: Task;
  onClose: () => void;
  onComplete: (status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED', totalSecondsSpent: number) => void;
}

const TimerModal: React.FC<TimerModalProps> = ({ task, onClose, onComplete }) => {
  const [mode, setMode] = useState<TimerMode>('POMODORO');
  const [isBreak, setIsBreak] = useState(false);
  
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [timerDuration, setTimerDuration] = useState(15);

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [totalAccumulatedSeconds, setTotalAccumulatedSeconds] = useState(0);
  
  const [isFinished, setIsFinished] = useState(false);
  const [flashType, setFlashType] = useState<'NONE' | 'SUCCESS' | 'WARNING' | 'DANGER'>('NONE');

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      interval = setInterval(() => {
        if (!isBreak) {
          setTotalAccumulatedSeconds(prev => prev + 1);
        }

        if (mode === 'STOPWATCH') {
          setStopwatchTime(prev => prev + 1);
        } else {
          setTimeLeft(prev => {
            if (prev <= 1) {
              if (mode === 'POMODORO') {
                const nextIsBreak = !isBreak;
                setIsBreak(nextIsBreak);
                triggerFlash(nextIsBreak ? 'SUCCESS' : 'WARNING');
                return (nextIsBreak ? breakDuration : workDuration) * 60;
              } else {
                clearInterval(interval);
                setIsActive(false);
                setIsFinished(true);
                triggerFlash('SUCCESS');
                return 0;
              }
            }
            return prev - 1;
          });
        }
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, mode, isBreak, workDuration, breakDuration]);

  const triggerFlash = (type: 'SUCCESS' | 'WARNING' | 'DANGER') => {
    setFlashType(type);
    setTimeout(() => setFlashType('NONE'), 600);
  };

  const toggleTimer = () => {
    setIsActive(!isActive);
    setIsFinished(false);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const resetTimer = () => {
    setIsActive(false);
    setIsBreak(false);
    setIsFinished(false);
    if (mode === 'POMODORO') setTimeLeft(workDuration * 60);
    else if (mode === 'TIMER') setTimeLeft(timerDuration * 60);
    else setStopwatchTime(0);
  };

  const handleModeChange = (newMode: TimerMode) => {
    setIsActive(false);
    setIsBreak(false);
    setIsFinished(false);
    setMode(newMode);
    if (newMode === 'POMODORO') setTimeLeft(workDuration * 60);
    else if (newMode === 'TIMER') setTimeLeft(timerDuration * 60);
    else setStopwatchTime(0);
  };

  const getProgress = () => {
    if (mode === 'STOPWATCH') return 1;
    let total = timerDuration * 60;
    if (mode === 'POMODORO') total = (isBreak ? breakDuration : workDuration) * 60;
    return timeLeft / total;
  };

  const handleFinalize = (status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED') => {
    const type = status === 'COMPLETED' ? 'SUCCESS' : status === 'GAVE_UP' ? 'WARNING' : 'DANGER';
    triggerFlash(type);
    setTimeout(() => {
      onComplete(status, totalAccumulatedSeconds);
    }, 400);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-xl flex items-center justify-center z-50 p-6 animate-in fade-in zoom-in duration-300">
      <div className={`fixed inset-0 pointer-events-none z-[60] transition-opacity duration-500 opacity-0 ${
        flashType === 'SUCCESS' ? 'bg-emerald-500/20 opacity-100' :
        flashType === 'WARNING' ? 'bg-amber-500/20 opacity-100' :
        flashType === 'DANGER' ? 'bg-red-500/20 opacity-100' : ''
      }`} />

      <div className={`bg-slate-900 border-t-2 ${isBreak ? 'border-emerald-500' : (isFinished ? 'border-indigo-400 animate-pulse' : 'border-purple-500')} rounded-[3rem] w-full max-w-lg overflow-hidden shadow-[0_25px_100px_rgba(0,0,0,0.8)] transition-all duration-500`}>
        <div className="p-8 pb-4 flex justify-between items-center border-b border-white/5">
          <div>
            <span className={`text-[10px] uppercase tracking-[0.3em] ${isBreak ? 'text-emerald-400' : (isFinished ? 'text-indigo-400' : 'text-purple-400')} font-bold mb-1 block transition-colors`}>
              {mode === 'POMODORO' ? (isBreak ? 'Recuperação de Energia' : 'Protocolo de Foco') : (isFinished ? 'Ciclo Completado' : 'Cronômetro Ativo')}
            </span>
            <h3 className="text-2xl font-space font-bold text-white tracking-tight">{task.title}</h3>
          </div>
          <button onClick={onClose} className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-slate-400 font-bold text-xl">&times;</button>
        </div>

        <div className="p-8">
          <div className="flex justify-center gap-3 mb-8">
            {(['POMODORO', 'TIMER', 'STOPWATCH'] as TimerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase border transition-all ${
                  mode === m 
                    ? (isBreak ? 'bg-emerald-600 border-emerald-400' : 'bg-purple-600 border-purple-400') + ' text-white shadow-lg' 
                    : 'bg-transparent border-white/10 text-slate-500 hover:border-white/30'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="relative flex items-center justify-center mb-10">
            <svg className="w-56 h-56 -rotate-90">
              <circle cx="112" cy="112" r="104" stroke="currentColor" strokeWidth="2" fill="transparent" className="text-slate-800" />
              <circle 
                cx="112" cy="112" r="104" stroke="currentColor" strokeWidth="4" fill="transparent" 
                className={`${isBreak ? 'text-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.4)]' : (isFinished ? 'text-indigo-400 animate-pulse' : 'text-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.4)]')} transition-all duration-1000`}
                strokeDasharray={653.4}
                strokeDashoffset={653.4 - (653.4 * getProgress())}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-5xl font-space font-bold text-white tracking-tighter tabular-nums ${isBreak ? 'text-emerald-400' : (isFinished ? 'text-indigo-300 animate-bounce' : '')}`}>
                {mode === 'STOPWATCH' ? formatTime(stopwatchTime) : formatTime(timeLeft)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <button
              onClick={toggleTimer}
              className={`h-14 rounded-3xl font-space font-bold text-xs tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${
                isActive 
                  ? 'bg-slate-800 text-red-400 border border-red-500/30 hover:bg-slate-750' 
                  : 'bg-white text-slate-950 hover:bg-indigo-400 hover:scale-105 active:scale-95'
              }`}
            >
              {isActive ? 'Suspender' : 'Ativar'}
            </button>
            <button
              onClick={resetTimer}
              className="h-14 rounded-3xl bg-slate-800/50 border border-white/5 text-slate-400 font-space font-bold text-xs tracking-widest uppercase hover:bg-slate-800 hover:text-white transition-all active:scale-95"
            >
              Reiniciar
            </button>
          </div>

          <div className="space-y-4 pt-6 border-t border-white/5">
            <div className="flex gap-4">
              <button
                onClick={() => handleFinalize('COMPLETED')}
                className="flex-1 group relative h-16 bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 rounded-3xl overflow-hidden transition-all hover:bg-emerald-500 hover:text-white active:scale-95"
              >
                <div className="relative z-10 flex flex-col items-center justify-center">
                  <span className="font-space font-bold text-sm tracking-tight leading-none mb-1">Concluir</span>
                  <span className="text-[9px] uppercase tracking-widest opacity-70 font-bold">+5 Pontos</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerModal;
