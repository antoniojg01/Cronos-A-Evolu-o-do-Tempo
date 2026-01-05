
import React, { useState, useEffect, useRef } from 'react';
import { Task, TimerMode } from '../types.ts';

interface TimerModalProps {
  task: Task;
  onClose: () => void;
  onComplete: (status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED', totalSecondsSpent: number) => void;
}

const TimerModal: React.FC<TimerModalProps> = ({ task, onClose, onComplete }) => {
  const [mode, setMode] = useState<TimerMode>('POMODORO');
  const [isBreak, setIsBreak] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [timerDuration, setTimerDuration] = useState(15);

  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [stopwatchTime, setStopwatchTime] = useState(0);
  const [totalAccumulatedSeconds, setTotalAccumulatedSeconds] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  // Controle de estado para evitar resets acidentais
  const hasStartedRef = useRef(false);
  const lastSyncMode = useRef<string>('POMODORO-false');

  // Sincroniza o tempo APENAS se o cronômetro não estiver rodando E não houver progresso acumulado
  useEffect(() => {
    const currentSyncKey = `${mode}-${isBreak}`;
    if (!isActive && !hasStartedRef.current && lastSyncMode.current !== currentSyncKey) {
      if (mode === 'POMODORO') setTimeLeft((isBreak ? breakDuration : workDuration) * 60);
      else if (mode === 'TIMER') setTimeLeft(timerDuration * 60);
      lastSyncMode.current = currentSyncKey;
    }
  }, [mode, isBreak, workDuration, breakDuration, timerDuration, isActive]);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      hasStartedRef.current = true;
      interval = setInterval(() => {
        if (!isBreak) setTotalAccumulatedSeconds(p => p + 1);

        if (mode === 'STOPWATCH') {
          setStopwatchTime(p => p + 1);
        } else {
          setTimeLeft(p => {
            if (p <= 1) {
              if (mode === 'POMODORO') {
                const nextIsBreak = !isBreak;
                setIsBreak(nextIsBreak);
                setIsActive(false);
                hasStartedRef.current = false;
                return (nextIsBreak ? breakDuration : workDuration) * 60;
              } else {
                clearInterval(interval);
                setIsActive(false);
                setIsFinished(true);
                return 0;
              }
            }
            return p - 1;
          });
        }
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [isActive, mode, isBreak, workDuration, breakDuration]);

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
    hasStartedRef.current = false;
    lastSyncMode.current = ''; // Força sincronia no próximo ciclo
    if (mode === 'POMODORO') setTimeLeft(workDuration * 60);
    else if (mode === 'TIMER') setTimeLeft(timerDuration * 60);
    else setStopwatchTime(0);
  };

  const adjustTime = (amount: number) => {
    if (mode === 'POMODORO') {
      if (isBreak) setBreakDuration(p => Math.max(1, p + amount));
      else setWorkDuration(p => Math.max(1, p + amount));
    } else if (mode === 'TIMER') {
      setTimerDuration(p => Math.max(1, p + amount));
    }
    hasStartedRef.current = false; // Permite que a UI mostre o novo tempo
  };

  const getProgress = () => {
    if (mode === 'STOPWATCH') return 1;
    let total = timerDuration * 60;
    if (mode === 'POMODORO') total = (isBreak ? breakDuration : workDuration) * 60;
    return total === 0 ? 0 : timeLeft / total;
  };

  const radius = 135;
  const circumference = 2 * Math.PI * radius;

  if (isMinimized) {
    return (
      <div onClick={() => setIsMinimized(false)} className="fixed bottom-8 right-8 z-[110] cursor-pointer">
        <div className="flex items-center gap-4 bg-[#0a0f1e] border-2 border-white/10 px-6 py-4 rounded-full shadow-2xl backdrop-blur-xl">
          <span className="text-xl font-space font-bold text-white tabular-nums">
            {mode === 'STOPWATCH' ? formatTime(stopwatchTime) : formatTime(timeLeft)}
          </span>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-slate-500 hover:text-white">&times;</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center z-[100] p-4 animate-in fade-in duration-500">
      <div className={`bg-[#0a0f1e] border-2 border-white/10 ${isBreak ? 'border-emerald-500/40' : 'border-purple-500/40'} rounded-[4rem] w-full max-w-[500px] overflow-hidden shadow-[0_0_120px_rgba(0,0,0,1)]`}>
        <div className="px-12 pt-12 pb-8 flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.6em] text-indigo-400 font-bold block opacity-70">Sincronizador Universal</span>
            <h3 className="text-4xl font-space font-bold text-white tracking-tighter uppercase leading-none">{task.title}</h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsMinimized(true)} className="text-slate-600 hover:text-white transition-colors"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg></button>
            <button onClick={onClose} className="text-slate-600 hover:text-white text-3xl font-light transition-colors">&times;</button>
          </div>
        </div>

        <div className="px-10 pb-12">
          <div className="flex justify-center gap-3 mb-10">
            {(['POMODORO', 'TIMER', 'STOPWATCH'] as TimerMode[]).map((m) => (
              <button key={m} onClick={() => { setMode(m); setIsActive(false); hasStartedRef.current = false; }} className={`px-6 py-2.5 rounded-2xl text-[10px] font-bold tracking-widest uppercase border transition-all ${mode === m ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-transparent border-white/5 text-slate-700'}`}>{m}</button>
            ))}
          </div>

          <div className="relative flex items-center justify-center mb-12 mx-auto w-[320px] h-[320px] bg-slate-900/30 border border-white/5 rounded-[4rem] shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
            <svg className="w-full h-full -rotate-90 block" viewBox="0 0 320 320">
              <circle cx="160" cy="160" r={radius} stroke="currentColor" strokeWidth="2" fill="transparent" className="text-slate-900" />
              <circle cx="160" cy="160" r={radius} stroke="currentColor" strokeWidth="10" fill="transparent" className={`${isBreak ? 'text-emerald-500' : 'text-purple-500'} transition-all duration-1000 ease-linear`} strokeDasharray={circumference} strokeDashoffset={circumference - (circumference * getProgress())} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-[5.5rem] font-space font-bold text-white tracking-tighter tabular-nums leading-none ${isFinished ? 'animate-pulse text-indigo-400' : ''}`}>
                {mode === 'STOPWATCH' ? formatTime(stopwatchTime) : formatTime(timeLeft)}
              </span>
              {!isActive && mode !== 'STOPWATCH' && (
                <div className="mt-8 flex items-center gap-6">
                  <button onClick={() => adjustTime(-1)} className="w-10 h-10 rounded-full bg-slate-950 border border-white/10 text-slate-500 flex items-center justify-center hover:text-white text-2xl">-</button>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Ajustar</span>
                  <button onClick={() => adjustTime(1)} className="w-10 h-10 rounded-full bg-slate-950 border border-white/10 text-slate-500 flex items-center justify-center hover:text-white text-2xl">+</button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-12">
            <button onClick={toggleTimer} className={`h-20 rounded-[2.5rem] font-space font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-4 ${isActive ? 'bg-slate-900 text-red-500 border border-red-500/20' : 'bg-white text-slate-950 shadow-2xl'}`}>
              {isActive ? 'Pausar' : 'Iniciar'}
            </button>
            <button onClick={resetTimer} className="h-20 rounded-[2.5rem] bg-slate-900/40 border border-white/10 text-slate-500 font-space font-bold text-sm tracking-widest uppercase">Reset</button>
          </div>

          <div className="pt-10 border-t border-white/5">
            <button onClick={() => onComplete('COMPLETED', totalAccumulatedSeconds)} className="w-full h-20 bg-slate-900/40 border-2 border-white/10 text-white rounded-[2.5rem] flex flex-col items-center justify-center gap-1 hover:bg-slate-800 transition-all group">
              <span className="font-space font-bold text-base tracking-widest uppercase group-hover:text-emerald-400 transition-colors">Confirmar Protocolo</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-700 font-bold">+5 XP Sincronizado</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerModal;
