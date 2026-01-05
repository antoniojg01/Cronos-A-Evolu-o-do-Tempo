
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
  const [flashType, setFlashType] = useState<'NONE' | 'SUCCESS' | 'WARNING' | 'DANGER'>('NONE');

  // Ref para rastrear se o timer já foi iniciado alguma vez nesta sessão
  const hasStartedRef = useRef(false);

  // Sincroniza o timeLeft APENAS quando o modo muda ou a duração é alterada, 
  // mas SOMENTE se o cronômetro ainda não tiver começado a rodar (estado virgem)
  useEffect(() => {
    if (!hasStartedRef.current && !isActive) {
      if (mode === 'POMODORO') setTimeLeft((isBreak ? breakDuration : workDuration) * 60);
      else if (mode === 'TIMER') setTimeLeft(timerDuration * 60);
    }
  }, [workDuration, breakDuration, timerDuration, mode, isBreak]);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      hasStartedRef.current = true;
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
                setIsActive(false);
                hasStartedRef.current = false; // Permite resetar para o novo tempo de repouso/foco
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
    hasStartedRef.current = false;
    if (mode === 'POMODORO') setTimeLeft(workDuration * 60);
    else if (mode === 'TIMER') setTimeLeft(timerDuration * 60);
    else setStopwatchTime(0);
  };

  const handleModeChange = (newMode: TimerMode) => {
    setIsActive(false);
    setIsBreak(false);
    setIsFinished(false);
    hasStartedRef.current = false;
    setMode(newMode);
  };

  const handleFinalize = (status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED') => {
    onComplete(status, totalAccumulatedSeconds);
  };

  const adjustTime = (amount: number) => {
    // Ao ajustar manualmente, marcamos como "não iniciado" para o novo valor refletir no visor
    hasStartedRef.current = false;
    if (mode === 'POMODORO') {
      if (isBreak) setBreakDuration(prev => Math.max(1, prev + amount));
      else setWorkDuration(prev => Math.max(1, prev + amount));
    } else if (mode === 'TIMER') {
      setTimerDuration(prev => Math.max(1, prev + amount));
    }
  };

  const getProgress = () => {
    if (mode === 'STOPWATCH') return 1;
    let total = timerDuration * 60;
    if (mode === 'POMODORO') total = (isBreak ? breakDuration : workDuration) * 60;
    return total === 0 ? 0 : timeLeft / total;
  };

  const radius = 135;
  const circumference = 2 * Math.PI * radius;
  const center = 160;

  if (isMinimized) {
    return (
      <div 
        onClick={() => setIsMinimized(false)}
        className={`fixed bottom-8 right-8 z-[110] cursor-pointer group animate-in slide-in-from-right-10 duration-500`}
      >
        <div className={`flex items-center gap-4 bg-[#0a0f1e] border-2 ${isBreak ? 'border-emerald-500/50' : 'border-purple-500/50'} px-6 py-4 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] hover:scale-105 hover:border-white/20 transition-all backdrop-blur-xl`}>
          <div className="relative w-10 h-10 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90">
               <circle cx="20" cy="20" r="18" stroke="rgba(255,255,255,0.05)" strokeWidth="3" fill="transparent" />
               <circle 
                  cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="3" fill="transparent" 
                  className={isBreak ? 'text-emerald-500' : 'text-purple-500'}
                  strokeDasharray={2 * Math.PI * 18}
                  strokeDashoffset={(2 * Math.PI * 18) - (2 * Math.PI * 18 * getProgress())}
                  strokeLinecap="round"
               />
            </svg>
            <div className={`absolute w-2 h-2 rounded-full ${isActive ? 'bg-indigo-400 animate-pulse' : 'bg-slate-700'}`} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest leading-none mb-1">{isBreak ? 'Repouso' : 'Foco'}</span>
            <span className="text-xl font-space font-bold text-white tracking-tighter leading-none tabular-nums">
              {mode === 'STOPWATCH' ? formatTime(stopwatchTime) : formatTime(timeLeft)}
            </span>
          </div>
          <div className="w-px h-8 bg-white/10 mx-1" />
          <button 
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
          >
            &times;
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center z-[100] p-4 sm:p-6 animate-in fade-in duration-500">
      <div className={`fixed inset-0 pointer-events-none z-[60] transition-opacity duration-500 opacity-0 ${
        flashType === 'SUCCESS' ? 'bg-emerald-500/20 opacity-100' :
        flashType === 'WARNING' ? 'bg-amber-500/20 opacity-100' :
        flashType === 'DANGER' ? 'bg-red-500/20 opacity-100' : ''
      }`} />

      <div className={`bg-[#0a0f1e] border-2 border-white/10 ${isBreak ? 'border-emerald-500/40' : (isFinished ? 'border-indigo-400 animate-pulse' : 'border-purple-500/40')} rounded-[4rem] w-full max-w-[500px] overflow-hidden shadow-[0_0_120px_rgba(0,0,0,1)] transition-all duration-500`}>
        <div className="px-12 pt-12 pb-8 flex justify-between items-start">
          <div className="space-y-1">
            <span className={`text-[11px] uppercase tracking-[0.6em] ${isBreak ? 'text-emerald-400' : (isFinished ? 'text-indigo-400' : 'text-purple-400')} font-bold block opacity-70`}>
              {mode === 'POMODORO' ? (isBreak ? 'Protocolo: Repouso' : 'Protocolo: Foco') : 'Sincronizador Universal'}
            </span>
            <h3 className="text-4xl font-space font-bold text-white tracking-tighter uppercase leading-none">{task.title}</h3>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setIsMinimized(true)} 
              className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-slate-600 hover:text-white"
              title="Minimizar"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button onClick={onClose} className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors text-slate-600 hover:text-white text-4xl font-extralight">&times;</button>
          </div>
        </div>

        <div className="px-10 pb-12">
          <div className="flex justify-center gap-3 mb-10">
            {(['POMODORO', 'TIMER', 'STOPWATCH'] as TimerMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleModeChange(m)}
                className={`px-6 py-2.5 rounded-2xl text-[10px] font-bold tracking-[0.2em] uppercase border transition-all ${
                  mode === m 
                    ? (isBreak ? 'bg-emerald-600/10 border-emerald-500/60 text-emerald-400 shadow-[0_0_30px_rgba(16,185,129,0.15)]' : 'bg-purple-600/10 border-purple-500/60 text-purple-400 shadow-[0_0_30px_rgba(168,85,247,0.15)]') 
                    : 'bg-transparent border-white/5 text-slate-700 hover:border-white/10 hover:text-slate-400'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="relative flex items-center justify-center mb-12 mx-auto w-[320px] h-[320px] bg-slate-900/30 border border-white/5 rounded-[4rem] shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
            <svg 
              className="w-full h-full -rotate-90 block"
              viewBox="0 0 320 320"
            >
              <circle 
                cx={center} 
                cy={center} 
                r={radius} 
                stroke="currentColor" 
                strokeWidth="2" 
                fill="transparent" 
                className="text-slate-900" 
              />
              <circle 
                cx={center} 
                cy={center} 
                r={radius} 
                stroke="currentColor" 
                strokeWidth="10" 
                fill="transparent" 
                className={`${isBreak ? 'text-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]' : (isFinished ? 'text-indigo-400' : 'text-purple-500 shadow-[0_0_30px_rgba(168,85,247,0.4)]')} transition-all duration-1000 ease-linear`}
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (circumference * getProgress())}
                strokeLinecap="round"
              />
            </svg>
            
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-[5.5rem] font-space font-bold text-white tracking-tighter tabular-nums leading-none ${isBreak ? 'text-emerald-400' : (isFinished ? 'text-indigo-300 animate-pulse' : '')}`}>
                {mode === 'STOPWATCH' ? formatTime(stopwatchTime) : formatTime(timeLeft)}
              </span>
              
              {!isActive && mode !== 'STOPWATCH' && (
                <div className="mt-8 flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4">
                  <button onClick={() => adjustTime(-1)} className="w-10 h-10 rounded-full bg-slate-950 border border-white/10 text-slate-500 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all text-2xl shadow-lg">-</button>
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.4em]">Ajustar</span>
                  <button onClick={() => adjustTime(1)} className="w-10 h-10 rounded-full bg-slate-950 border border-white/10 text-slate-500 flex items-center justify-center hover:bg-slate-900 hover:text-white transition-all text-2xl shadow-lg">+</button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-5 mb-12">
            <button
              onClick={toggleTimer}
              className={`h-20 rounded-[2.5rem] font-space font-bold text-sm tracking-[0.3em] uppercase transition-all flex items-center justify-center gap-4 ${
                isActive 
                  ? 'bg-slate-900/60 text-red-500 border-2 border-red-500/20' 
                  : 'bg-white text-slate-950 hover:bg-slate-50 hover:scale-[1.02] active:scale-95 shadow-[0_20px_60px_rgba(255,255,255,0.1)]'
              }`}
            >
              {isActive ? (
                <><span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" /> Pausar</>
              ) : (
                <><span className="w-2.5 h-2.5 rounded-full bg-indigo-600" /> Iniciar</>
              )}
            </button>
            <button
              onClick={resetTimer}
              className="h-20 rounded-[2.5rem] bg-slate-900/40 border border-white/10 text-slate-500 font-space font-bold text-sm tracking-[0.3em] uppercase hover:bg-slate-900 hover:text-white transition-all active:scale-95"
            >
              Reset
            </button>
          </div>

          <div className="pt-10 border-t border-white/5">
            <button
              onClick={() => handleFinalize('COMPLETED')}
              className="w-full h-20 bg-slate-900/40 border-2 border-white/10 text-white rounded-[2.5rem] flex flex-col items-center justify-center gap-1 hover:bg-slate-800/80 hover:border-emerald-500/50 transition-all active:scale-95 group shadow-xl"
            >
              <span className="font-space font-bold text-base tracking-[0.2em] uppercase group-hover:text-emerald-300 transition-colors">Confirmar Protocolo</span>
              <span className="text-[10px] uppercase tracking-[0.4em] text-slate-700 font-bold group-hover:text-slate-500">+5 XP Sincronizado</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerModal;
