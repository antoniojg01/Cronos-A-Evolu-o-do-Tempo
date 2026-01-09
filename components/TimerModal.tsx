
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
      new Notification(title, {
        body: body,
        icon: "/favicon.ico"
      });
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
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch (e) {}
  };

  const playAlarmSound = () => {
    playSound(880, 0.3);
    setTimeout(() => playSound(440, 0.3), 400);
  };

  const playRewardSound = () => {
    playSound(1320, 0.15, 0.1);
    setTimeout(() => playSound(1760, 0.2, 0.1), 100);
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
      const statusPrefix = isBreak ? "⏸️ Pausa" : "🔥 Foco";
      document.title = `(${formatTime(displayTime)}) ${statusPrefix} - ${task.title}`;
    } else {
      document.title = originalTitle;
    }
    return () => {
      document.title = originalTitle;
    };
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
    }
  }, [mode, isBreak, workDuration, breakDuration, timerDuration]);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      startTimeRef.current = Date.now();
      interval = setInterval(() => {
        const now = Date.now();
        const deltaSeconds = Math.floor((now - (startTimeRef.current || now)) / 1000);
        const currentTotal = accumulatedAtStartRef.current + deltaSeconds;
        
        setTotalAccumulatedSeconds(currentTotal);

        if (!isBreak) {
          const currentMilestone = Math.floor(currentTotal / TIME_BLOCK_THRESHOLD);
          if (currentMilestone > lastAwardedMilestone) {
            setLastAwardedMilestone(currentMilestone);
            if (onReward) onReward(XP_TIME_BLOCK);
            playRewardSound();
            setShowXpPopup(true);
            setTimeout(() => setShowXpPopup(false), 3000);
          }
        }

        if (mode === 'STOPWATCH') {
          setDisplayTime(currentTotal);
        } else {
          const remaining = Math.max(0, initialDisplayTimeRef.current - currentTotal);
          setDisplayTime(remaining);
          if (remaining <= 0) {
            playAlarmSound();
            
            const notifyTitle = "Sincronia Concluída!";
            let notifyBody = "";
            if (mode === 'POMODORO') {
              notifyBody = isBreak ? `A pausa terminou. Hora de voltar para: ${task.title}` : `O ciclo de foco terminou para: ${task.title}`;
            } else {
              notifyBody = `O tempo esgotou para o protocolo: ${task.title}`;
            }
            sendNotification(notifyTitle, notifyBody);

            setIsActive(false);
            if (mode === 'POMODORO') setIsBreak(!isBreak);
            else setIsFinished(true);
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

  const accentColor = task.category === 'LEISURE' ? 'amber' : 'indigo';
  const colorMap = {
    amber: {
      text: 'text-amber-500',
      bg: 'bg-amber-500',
      border: 'border-amber-500',
      glow: 'shadow-amber-500/20'
    },
    indigo: {
      text: 'text-indigo-400',
      bg: 'bg-indigo-500',
      border: 'border-indigo-500',
      glow: 'shadow-indigo-500/20'
    }
  };

  const adjustTime = (type: 'work' | 'break' | 'timer', delta: number) => {
    if (isActive) return;
    if (type === 'work') setWorkDuration(prev => Math.max(1, prev + delta));
    if (type === 'break') setBreakDuration(prev => Math.max(1, prev + delta));
    if (type === 'timer') setTimerDuration(prev => Math.max(1, prev + delta));
  };

  const handleStartToggle = () => {
    if (!isActive) {
      requestNotificationPermission();
    }
    setIsActive(!isActive);
  };

  if (isMinimized) {
    return (
      <div onClick={() => setIsMinimized(false)} style={{ bottom: `calc(1.5rem + ${Math.min(stackIndex, 4) * 85}px)`, right: '1.5rem', zIndex: 110 + stackIndex }} className={`fixed cursor-pointer bg-[#0a0f1e]/90 border-2 ${colorMap[accentColor].border}/30 px-6 py-4 rounded-3xl shadow-2xl backdrop-blur-2xl flex items-center gap-4 transition-all hover:scale-105 active:scale-95 animate-in slide-in-from-right-10`}>
        <div className="relative w-10 h-10 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="transparent" />
                <circle cx="50" cy="50" r="45" stroke={isBreak ? "#10b981" : (task.category === 'LEISURE' ? "#f59e0b" : "#6366f1")} strokeWidth="8" fill="transparent" strokeDasharray="282.7" strokeDashoffset={282.7 - (282.7 * getProgress())} strokeLinecap="round" />
            </svg>
            <div className={`w-2 h-2 rounded-full ${isActive ? (task.category === 'LEISURE' ? 'bg-amber-500 animate-pulse' : 'bg-indigo-500 animate-pulse') : 'bg-slate-700'}`} />
        </div>
        <div className="flex flex-col">
            <span className={`text-[7px] font-bold ${colorMap[accentColor].text} uppercase tracking-widest truncate w-24`}>{task.title}</span>
            <span className="text-xl font-space font-bold text-white tabular-nums">{formatTime(displayTime)}</span>
        </div>
      </div>
    );
  }

  const circumference = 2 * Math.PI * 135;

  return (
    <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center z-[120] p-4 animate-in fade-in">
      <div className="bg-[#0a0f1e] border-2 border-white/10 rounded-[4rem] w-full max-w-[850px] overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        
        <div className="px-8 md:px-12 pt-8 md:pt-12 pb-4 flex justify-between items-start border-b border-white/5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-[10px] uppercase tracking-[0.6em] ${colorMap[accentColor].text} font-bold block opacity-70`}>Sincronia {task.category === 'LEISURE' ? 'de Lazer' : 'de Trabalho'}</span>
              <span className={`text-[8px] font-bold border ${colorMap[accentColor].border}/30 px-2 py-0.5 rounded-full ${colorMap[accentColor].text}`}>{task.category === 'LEISURE' ? '🎮 RECREAÇÃO' : '💼 PRODUTIVIDADE'}</span>
            </div>
            <h3 className="text-2xl md:text-3xl font-space font-bold text-white uppercase truncate max-w-[400px]">{task.title}</h3>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setIsMinimized(true)} className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M19 13l-7 7-7-7m14-8l-7 7-7-7" /></svg>
            </button>
            <button onClick={onClose} className="p-3 bg-red-500/10 rounded-2xl text-slate-600 hover:text-red-400 text-xl font-light transition-colors">&times;</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 md:px-10 py-10 custom-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-10">
          
          <div className="space-y-8 flex flex-col items-center">
            <div className="flex justify-center gap-2 w-full">
              {(['POMODORO', 'TIMER', 'STOPWATCH'] as TimerMode[]).map((m) => (
                <button key={m} onClick={() => !isActive && setMode(m)} className={`flex-1 py-2.5 rounded-xl text-[9px] font-bold uppercase border transition-all ${mode === m ? `${colorMap[accentColor].bg} border-transparent text-white ${colorMap[accentColor].glow}` : 'border-white/5 text-slate-600'}`}>{m}</button>
              ))}
            </div>

            {!isActive && mode !== 'STOPWATCH' && (
              <div className="flex gap-6 animate-in fade-in slide-in-from-top-2">
                {mode === 'POMODORO' ? (
                  <>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Foco (min)</span>
                      <div className="flex items-center gap-3 bg-white/5 rounded-xl px-2 py-1 border border-white/5">
                        <button onClick={() => adjustTime('work', -5)} className="text-slate-500 hover:text-white transition-colors w-6 h-6 flex items-center justify-center">-</button>
                        <span className="text-xs font-mono font-bold text-indigo-400 w-6 text-center">{workDuration}</span>
                        <button onClick={() => adjustTime('work', 5)} className="text-slate-500 hover:text-white transition-colors w-6 h-6 flex items-center justify-center">+</button>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2">
                      <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Pausa (min)</span>
                      <div className="flex items-center gap-3 bg-white/5 rounded-xl px-2 py-1 border border-white/5">
                        <button onClick={() => adjustTime('break', -1)} className="text-slate-500 hover:text-white transition-colors w-6 h-6 flex items-center justify-center">-</button>
                        <span className="text-xs font-mono font-bold text-emerald-400 w-6 text-center">{breakDuration}</span>
                        <button onClick={() => adjustTime('break', 1)} className="text-slate-500 hover:text-white transition-colors w-6 h-6 flex items-center justify-center">+</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">Duração (min)</span>
                    <div className="flex items-center gap-4 bg-white/5 rounded-xl px-3 py-1.5 border border-white/5">
                      <button onClick={() => adjustTime('timer', -5)} className="text-slate-500 hover:text-white transition-colors w-6 h-6 flex items-center justify-center">-</button>
                      <span className="text-xs font-mono font-bold text-white w-8 text-center">{timerDuration}</span>
                      <button onClick={() => adjustTime('timer', 5)} className="text-slate-500 hover:text-white transition-colors w-6 h-6 flex items-center justify-center">+</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="relative flex items-center justify-center w-[220px] h-[220px] md:w-[260px] md:h-[260px]">
              {showXpPopup && (
                <div className="absolute top-0 font-space font-bold text-emerald-400 text-xl animate-bounce z-10 pointer-events-none">
                  +3 XP FOCO
                </div>
              )}

              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 320 320">
                <circle cx="160" cy="160" r="135" stroke="rgba(255,255,255,0.03)" strokeWidth="12" fill="transparent" />
                <circle cx="160" cy="160" r="135" stroke={isBreak ? "#10b981" : (task.category === 'LEISURE' ? "#f59e0b" : "#6366f1")} strokeWidth="12" fill="transparent" strokeDasharray={circumference} strokeDashoffset={circumference - (circumference * getProgress())} strokeLinecap="round" className="transition-all duration-300 ease-linear" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {isBreak && <span className="text-[8px] font-bold text-emerald-400 uppercase mb-1 tracking-widest">Pausa Relaxante</span>}
                <span className="text-5xl font-space font-bold text-white tabular-nums">{formatTime(displayTime)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <button onClick={handleStartToggle} className={`h-16 rounded-[2rem] font-bold uppercase text-[10px] transition-all transform active:scale-95 ${isActive ? 'bg-slate-900 text-red-400 border border-red-500/20' : 'bg-white text-slate-950 shadow-xl'}`}>{isActive ? 'Congelar' : 'Sincronizar'}</button>
              <button onClick={() => { setIsActive(false); setTotalAccumulatedSeconds(0); setLastAwardedMilestone(0); setDisplayTime(mode === 'POMODORO' ? workDuration * 60 : mode === 'TIMER' ? timerDuration * 60 : 0); }} className="h-16 rounded-[2rem] bg-slate-900/40 border border-white/10 text-slate-500 font-bold uppercase text-[10px] active:scale-95">Reset</button>
            </div>
          </div>

          <div className="space-y-6 flex flex-col h-full bg-white/[0.01] border border-white/5 rounded-[3rem] p-8">
            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <span className={`text-[10px] font-bold ${colorMap[accentColor].text} uppercase tracking-widest`}>Módulos do Protocolo</span>
                <span className="text-[10px] font-mono text-slate-500">{completedSteps}/{stepCount}</span>
              </div>
              <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className={`h-full ${colorMap[accentColor].bg} transition-all duration-500`} style={{ width: `${stepProgress * 100}%` }} />
              </div>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar pr-2 min-h-[200px]">
              {task.steps && task.steps.length > 0 ? (
                task.steps.map(step => (
                  <div key={step.id} onClick={() => onToggleStep(step.id)} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer ${step.completed ? `${colorMap[accentColor].bg}/5 ${colorMap[accentColor].border}/20 opacity-60` : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${step.completed ? `${colorMap[accentColor].bg} ${colorMap[accentColor].border}` : 'border-white/20'}`}>
                      {step.completed && <span className="text-[10px] text-white">✓</span>}
                    </div>
                    <span className={`text-xs flex-1 ${step.completed ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{step.title}</span>
                  </div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30">
                  <p className="text-[10px] font-bold uppercase tracking-widest">Protocolo Linear Único</p>
                  <p className="text-[9px] mt-2">Nenhum sub-módulo detectado.</p>
                </div>
              )}
            </div>

            <div className="space-y-6 border-t border-white/5 pt-6">
              {task.requiresInput && (
                <textarea value={task.currentInput || ''} onChange={(e) => onUpdateTask({ currentInput: e.target.value })} placeholder="Relatório de progresso..." className="w-full h-24 bg-transparent border border-white/10 rounded-2xl p-4 text-xs text-slate-400 outline-none focus:border-indigo-500 transition-all resize-none" />
              )}
              
              <div className="flex flex-col gap-3">
                {/* Botão de Concluir Ciclo Parcialmente */}
                <button 
                  onClick={() => onComplete('CYCLE_FINISHED', totalAccumulatedSeconds)} 
                  className="group h-14 bg-indigo-500/5 border border-indigo-500/20 rounded-2xl flex items-center px-6 gap-4 hover:bg-indigo-500/10 hover:border-indigo-500/40 transition-all active:scale-[0.98]"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="font-space font-bold text-[10px] text-white uppercase tracking-wider">Concluir Ciclo Parcial</span>
                    <span className="text-[8px] text-indigo-400/80 font-bold uppercase tracking-tight">+3 XP • SALVAR E PAUSAR</span>
                  </div>
                </button>

                {/* Botão de Finalizar Totalmente (Destaque Principal) */}
                <button 
                  onClick={() => onComplete('COMPLETED', totalAccumulatedSeconds)} 
                  className="group h-16 bg-emerald-600 border border-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.3)] rounded-2xl flex items-center px-6 gap-4 hover:bg-emerald-500 hover:border-white transition-all active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7m-14 4l4 4L19 7" /></svg>
                  </div>
                  <div className="flex flex-col items-start text-left">
                    <span className="font-space font-bold text-xs text-white uppercase tracking-widest leading-none mb-0.5">Finalizar Protocolo Total</span>
                    <span className="text-[9px] text-emerald-100 font-bold uppercase tracking-tight">+5 XP • MISSÃO CUMPRIDA</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerModal;
