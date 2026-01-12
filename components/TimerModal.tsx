
import React, { useState, useEffect, useRef } from 'react';
import { Task, TimerMode, TaskStep } from '../types.ts';
import { XP_TIME_BLOCK, TIME_BLOCK_THRESHOLD } from '../constants.ts';

let globalAudioCtx: AudioContext | null = null;

interface TimerModalProps {
  task: Task;
  stackIndex: number;
  onClose: () => void;
  onUpdateTask: (updates: Partial<Task>) => void;
  onComplete: (status: 'COMPLETED' | 'CYCLE_FINISHED' | 'GAVE_UP' | 'IGNORED', totalSecondsSpent: number) => void;
  onToggleStep: (stepId: string) => void;
  onReward?: (xp: number) => void; 
}

const TimerModal: React.FC<TimerModalProps> = ({ task, stackIndex, onClose, onUpdateTask, onComplete, onToggleStep, onReward }) => {
  const [mode, setMode] = useState<TimerMode>('POMODORO');
  const [isBreak, setIsBreak] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [timerDuration, setTimerDuration] = useState(15);

  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [showXpPopup, setShowXpPopup] = useState(false);
  const [isBursting, setIsBursting] = useState(false);
  const [burstStatus, setBurstStatus] = useState<'COMPLETED' | 'CYCLE_FINISHED' | null>(null);

  const [displayTime, setDisplayTime] = useState(25 * 60);
  const [totalAccumulatedSeconds, setTotalAccumulatedSeconds] = useState(0);
  const [lastAwardedMilestone, setLastAwardedMilestone] = useState(0);

  const startTimeRef = useRef<number | null>(null);
  const accumulatedAtStartRef = useRef<number>(0);
  const initialDisplayTimeRef = useRef<number>(25 * 60);

  const requestNotificationPermission = () => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  };

  const sendNotification = (title: string, body: string) => {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body: body, icon: "/favicon.ico" });
    }
  };

  const playSound = (freq: number, duration: number, volume: number = 0.2) => {
    try {
      if (!globalAudioCtx) globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = globalAudioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  const playAlarmSound = () => { playSound(880, 0.3); setTimeout(() => playSound(440, 0.3), 400); };
  const playRewardSound = () => { playSound(1320, 0.15, 0.1); setTimeout(() => playSound(1760, 0.2, 0.1), 100); };
  const playFinishSound = () => {
    playSound(523.25, 0.2, 0.2); setTimeout(() => playSound(659.25, 0.2, 0.2), 100);
    setTimeout(() => playSound(783.99, 0.4, 0.3), 200); setTimeout(() => playSound(1046.50, 0.5, 0.2), 350);
  };

  const handleStartToggle = () => {
    if (!isActive) {
      if (globalAudioCtx && globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume();
      }
      requestNotificationPermission();
    }
    setIsActive(!isActive);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const originalTitle = "CRONOS | Arquivo Universal";
    if (isActive) {
      document.title = `(${formatTime(displayTime)}) ${isBreak ? "⏸️" : "🔥"} ${task.title}`;
    } else { document.title = originalTitle; }
    return () => { document.title = originalTitle; };
  }, [displayTime, isActive, isBreak, task.title]);

  useEffect(() => {
    if (!isActive) {
      let seconds = 0;
      if (mode === 'POMODORO') seconds = (isBreak ? breakDuration : workDuration) * 60;
      else if (mode === 'TIMER') seconds = timerDuration * 60;
      else if (mode === 'STOPWATCH') seconds = 0;
      setDisplayTime(seconds);
      initialDisplayTimeRef.current = seconds;
      accumulatedAtStartRef.current = 0;
      setTotalAccumulatedSeconds(0);
      setLastAwardedMilestone(0);
      setIsFinished(false);
    }
  }, [mode, isBreak, workDuration, breakDuration, timerDuration]);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      startTimeRef.current = Date.now();
      interval = setInterval(() => {
        const deltaSeconds = Math.floor((Date.now() - (startTimeRef.current || Date.now())) / 1000);
        const currentTotal = accumulatedAtStartRef.current + deltaSeconds;
        setTotalAccumulatedSeconds(currentTotal);
        if (!isBreak) {
          const currentMilestone = Math.floor(currentTotal / TIME_BLOCK_THRESHOLD);
          if (currentMilestone > lastAwardedMilestone) {
            setLastAwardedMilestone(currentMilestone);
            if (onReward) onReward(XP_TIME_BLOCK);
            playRewardSound(); setShowXpPopup(true); setTimeout(() => setShowXpPopup(false), 3000);
          }
        }
        if (mode === 'STOPWATCH') setDisplayTime(currentTotal);
        else {
          const remaining = Math.max(0, initialDisplayTimeRef.current - currentTotal);
          setDisplayTime(remaining);
          if (remaining <= 0) {
            playAlarmSound(); setIsFinished(true);
            sendNotification(isBreak ? "Pausa Concluída!" : "Sincronia Concluída!", isBreak ? "Hora de retornar à órbita." : `Protocolo finalizado: ${task.title}`);
            setIsActive(false);
            if (mode === 'POMODORO') setIsBreak(!isBreak);
          }
        }
      }, 500);
    } else {
      if (startTimeRef.current) {
        accumulatedAtStartRef.current += Math.floor((Date.now() - startTimeRef.current) / 1000);
        startTimeRef.current = null;
      }
    }
    return () => clearInterval(interval);
  }, [isActive, mode, isBreak, task.title, lastAwardedMilestone, onReward]);

  const getProgress = () => mode === 'STOPWATCH' ? 1 : initialDisplayTimeRef.current === 0 ? 0 : displayTime / initialDisplayTimeRef.current;
  const stepCount = task.steps?.length || 0;
  const completedSteps = task.steps?.filter(s => s.completed).length || 0;
  const stepProgress = stepCount === 0 ? 0 : completedSteps / stepCount;
  
  // Lógica de cores baseada no estado de Break ou Categoria
  const accentColor = isBreak ? 'emerald' : (task.category === 'LEISURE' ? 'amber' : 'indigo');
  const colorMap = {
    amber: { text: 'text-amber-500', bg: 'bg-amber-500', border: 'border-amber-500', glow: 'shadow-amber-500/20' },
    indigo: { text: 'text-indigo-400', bg: 'bg-indigo-500', border: 'border-indigo-500', glow: 'shadow-indigo-500/20' },
    emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500', glow: 'shadow-emerald-500/20' }
  };

  const triggerBurst = (status: 'COMPLETED' | 'CYCLE_FINISHED') => {
    setIsBursting(true); setBurstStatus(status); playFinishSound();
    setTimeout(() => { onComplete(status, totalAccumulatedSeconds); setIsBursting(false); }, 1100);
  };

  if (isMinimized) {
    return (
      <div onClick={() => setIsMinimized(false)} style={{ bottom: `calc(5rem + ${Math.min(stackIndex, 4) * 75}px)`, right: '1rem', zIndex: 110 + stackIndex }} className={`fixed cursor-pointer bg-[#0a0f1e]/95 border border-white/10 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-3xl flex items-center gap-4 transition-all animate-in slide-in-from-right-10`}>
        <div className="relative w-8 h-8 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.05)" strokeWidth="10" fill="transparent" />
                <circle cx="50" cy="50" r="45" stroke={isFinished ? "#ef4444" : (isBreak ? "#10b981" : (task.category === 'LEISURE' ? "#f59e0b" : "#6366f1"))} strokeWidth="10" fill="transparent" strokeDasharray="282.7" strokeDashoffset={282.7 - (282.7 * getProgress())} strokeLinecap="round" />
            </svg>
            <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white animate-pulse' : 'bg-slate-700'}`} />
        </div>
        <div className="flex flex-col">
            <span className={`text-[6px] font-bold ${colorMap[accentColor].text} uppercase tracking-widest truncate w-20`}>{isBreak ? 'PAUSA ATIVA' : task.title}</span>
            <span className="text-lg font-space font-bold text-white tabular-nums">{formatTime(displayTime)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`fixed inset-0 bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center z-[120] p-2 md:p-4 animate-in fade-in pt-safe pb-safe`}>
      <style>{`
        @keyframes rewardParticle { 0% { transform: rotate(var(--rot)) translateY(0) scale(1); opacity: 1; } 100% { transform: rotate(var(--rot)) translateY(calc(-1 * var(--dist))) scale(0); opacity: 0; } }
        .pulse-emerald { animation: pulse-emerald 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse-emerald { 0%, 100% { opacity: 1; text-shadow: 0 0 10px rgba(16, 185, 129, 0.5); } 50% { opacity: 0.7; text-shadow: 0 0 2px rgba(16, 185, 129, 0.2); } }
      `}</style>

      {isBursting && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden z-[200]">
          <div className="absolute font-space font-bold text-white text-2xl md:text-4xl uppercase tracking-[0.4em] animate-in zoom-in">{burstStatus === 'COMPLETED' ? 'SINCRONIA TOTAL' : 'CICLO CONCLUÍDO'}</div>
        </div>
      )}

      <div className={`bg-[#0a0f1e] border border-white/10 rounded-[2.5rem] md:rounded-[4rem] w-full max-w-[850px] overflow-hidden shadow-2xl flex flex-col max-h-[98vh] relative transition-all duration-500 ${isBursting ? 'scale-105 opacity-0' : ''}`}>
        
        <div className="px-6 md:px-12 py-6 md:py-10 flex justify-between items-center border-b border-white/5">
          <div className="space-y-0.5 min-w-0">
            <span className={`text-[8px] uppercase tracking-[0.3em] ${colorMap[accentColor].text} font-black block`}>
              {mode === 'POMODORO' ? (isBreak ? 'MÓDULO DE RECOMPOSIÇÃO' : 'MÓDULO DE CONCENTRAÇÃO') : 'PROTOCOLO ATIVO'}
            </span>
            <h3 className="text-lg md:text-2xl font-space font-bold uppercase truncate pr-4 text-white">
               {isBreak ? 'PAUSA ÓRBITAL' : task.title}
            </h3>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsMinimized(true)} className="p-3 bg-white/5 rounded-xl text-slate-400"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M19 13l-7 7-7-7" /></svg></button>
            <button onClick={onClose} className="p-3 bg-red-500/10 rounded-xl text-red-500 text-xl font-light">&times;</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-10 py-6 md:py-10 custom-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
          
          <div className="space-y-6 md:space-y-8 flex flex-col items-center">
            <div className="flex justify-center gap-1.5 w-full">
              {(['POMODORO', 'TIMER', 'STOPWATCH'] as TimerMode[]).map((m) => (
                <button key={m} onClick={() => !isActive && setMode(m)} className={`flex-1 py-2.5 rounded-xl text-[8px] font-bold uppercase border transition-all ${mode === m ? `${colorMap[accentColor].bg} border-transparent text-white shadow-lg ${colorMap[accentColor].glow}` : 'border-white/5 text-slate-600'}`}>{m}</button>
              ))}
            </div>

            {!isActive && mode !== 'STOPWATCH' && (
              <div className="flex gap-4">
                <div className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2 border border-white/5">
                  <button onClick={() => mode === 'POMODORO' ? (isBreak ? setBreakDuration(d => Math.max(1, d-1)) : setWorkDuration(d => Math.max(1, d-5))) : setTimerDuration(d => Math.max(1, d-5))} className="text-slate-500 text-lg">-</button>
                  <span className="text-xs font-mono font-bold text-white w-6 text-center">{mode === 'POMODORO' ? (isBreak ? breakDuration : workDuration) : timerDuration}</span>
                  <button onClick={() => mode === 'POMODORO' ? (isBreak ? setBreakDuration(d => d+1) : setWorkDuration(d => d+5)) : setTimerDuration(d => d+5)} className="text-slate-500 text-lg">+</button>
                </div>
                {mode === 'POMODORO' && (
                   <button onClick={() => setIsBreak(!isBreak)} className={`px-4 py-2 rounded-xl text-[7px] font-black uppercase border transition-all ${isBreak ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : 'bg-white/5 border-white/5 text-slate-500'}`}>
                     {isBreak ? 'Retornar ao Trabalho' : 'Ir para Pausa'}
                   </button>
                )}
              </div>
            )}

            <div className="relative flex items-center justify-center w-[200px] h-[200px] md:w-[280px] md:h-[280px]">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 320 320">
                <circle cx="160" cy="160" r="135" stroke="rgba(255,255,255,0.03)" strokeWidth="12" fill="transparent" />
                <circle cx="160" cy="160" r="135" stroke={isFinished ? "#ef4444" : (isBreak ? "#10b981" : (task.category === 'LEISURE' ? "#f59e0b" : "#6366f1"))} strokeWidth="12" fill="transparent" strokeDasharray="848.2" strokeDashoffset={848.2 - (848.2 * getProgress())} strokeLinecap="round" className="transition-all duration-300 ease-linear" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center space-y-2">
                <span className={`text-[10px] font-black tracking-[0.4em] uppercase ${isBreak ? 'text-emerald-400 pulse-emerald' : 'text-slate-600'}`}>
                   {isBreak ? 'EM PAUSA' : 'SINC. ATIVA'}
                </span>
                <span className={`text-5xl md:text-7xl font-space font-bold tabular-nums text-white ${isFinished ? 'animate-pulse text-red-400' : ''}`}>{formatTime(displayTime)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <button onClick={handleStartToggle} className={`h-14 md:h-16 rounded-2xl font-bold uppercase text-[9px] tracking-widest transition-all ${isActive ? 'bg-slate-900 text-red-400 border border-red-500/20' : 'bg-white text-slate-950'}`}>{isActive ? 'PAUSAR' : 'INICIAR'}</button>
              <button onClick={() => { setIsActive(false); setDisplayTime(mode === 'POMODORO' ? (isBreak ? breakDuration : workDuration) * 60 : mode === 'TIMER' ? timerDuration * 60 : 0); }} className="h-14 md:h-16 rounded-2xl bg-white/5 text-slate-500 font-bold uppercase text-[9px] tracking-widest">REINICIAR</button>
            </div>
          </div>

          <div className={`space-y-6 flex flex-col bg-white/[0.01] border ${isBreak ? 'border-emerald-500/10' : 'border-white/5'} rounded-[2rem] p-6 md:p-8 transition-colors`}>
            <div className="space-y-2">
              <div className="flex justify-between items-end"><span className={`text-[9px] font-bold ${colorMap[accentColor].text} uppercase tracking-widest`}>Progresso de Módulos</span><span className="text-[9px] font-mono text-slate-500">{completedSteps}/{stepCount}</span></div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden"><div className={`h-full ${colorMap[accentColor].bg} transition-all duration-700`} style={{ width: `${stepProgress * 100}%` }} /></div>
            </div>

            <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[250px] md:max-h-none custom-scrollbar pr-1">
              {task.steps?.map(step => (
                <div key={step.id} onClick={() => onToggleStep(step.id)} className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all ${step.completed ? 'bg-indigo-500/5 border-white/5 opacity-50' : 'bg-white/5 border-white/5'}`}>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${step.completed ? 'bg-indigo-500 border-indigo-400' : 'border-white/20'}`}>{step.completed && <span className="text-[8px]">✓</span>}</div>
                  <span className={`text-xs ${step.completed ? 'text-slate-600 line-through' : 'text-slate-200'}`}>{step.title}</span>
                </div>
              ))}
            </div>

            <div className="space-y-4 pt-4 border-t border-white/5">
              {!isBreak && (
                 <>
                  <button onClick={() => triggerBurst('CYCLE_FINISHED')} className="w-full h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-95"><span className="font-space font-bold text-[9px] text-white uppercase tracking-widest">Registrar Ciclo Parcial</span></button>
                  <button onClick={() => triggerBurst('COMPLETED')} className="w-full h-14 bg-emerald-600 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/20 active:scale-95 transition-all"><span className="font-space font-bold text-[9px] text-white uppercase tracking-widest">Sincronia Total</span></button>
                 </>
              )}
              {isBreak && (
                <div className="py-4 text-center">
                  <p className="text-[10px] font-space text-slate-500 uppercase tracking-widest italic animate-pulse">Aproveite este intervalo para reequilibrar seus sistemas.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerModal;
