
import React, { useState, useEffect, useRef } from 'react';
import { Task, TimerMode } from '../types.ts';

// Singleton para AudioContext para evitar erro de limite de instâncias no navegador
let globalAudioCtx: AudioContext | null = null;

interface TimerModalProps {
  task: Task;
  stackIndex: number;
  onClose: () => void;
  onUpdateTask: (updates: Partial<Task>) => void;
  onComplete: (status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED', totalSecondsSpent: number) => void;
}

const TimerModal: React.FC<TimerModalProps> = ({ task, stackIndex, onClose, onUpdateTask, onComplete }) => {
  const [mode, setMode] = useState<TimerMode>('POMODORO');
  const [isBreak, setIsBreak] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [timerDuration, setTimerDuration] = useState(15);

  const [isActive, setIsActive] = useState(false);
  const [isFinished, setIsFinished] = useState(false);

  // Estados de tempo exibidos na UI
  const [displayTime, setDisplayTime] = useState(25 * 60);
  const [totalAccumulatedSeconds, setTotalAccumulatedSeconds] = useState(0);

  // Refs para cálculo preciso
  const startTimeRef = useRef<number | null>(null);
  const accumulatedAtStartRef = useRef<number>(0);
  const initialDisplayTimeRef = useRef<number>(25 * 60);

  const playAlarmSound = () => {
    try {
      if (!globalAudioCtx) {
        globalAudioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = globalAudioCtx;
      if (ctx.state === 'suspended') ctx.resume();

      const playBeep = (freq: number, startTime: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration);
      };

      const now = ctx.currentTime;
      playBeep(880, now, 0.3);
      playBeep(440, now + 0.4, 0.3);
    } catch (e) {
      console.warn("Falha ao emitir sinal sonoro:", e);
    }
  };

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

        if (mode === 'STOPWATCH') {
          setDisplayTime(currentTotal);
        } else {
          const remaining = Math.max(0, initialDisplayTimeRef.current - currentTotal);
          setDisplayTime(remaining);

          if (remaining <= 0) {
            playAlarmSound();
            setIsActive(false);
            if (mode === 'POMODORO') {
              setIsBreak(!isBreak);
            } else {
              setIsFinished(true);
            }
          }
        }
      }, 500); // Frequência reduzida para poupar bateria e evitar erros de concorrência
    } else {
      if (startTimeRef.current) {
        const now = Date.now();
        const deltaSeconds = Math.floor((now - startTimeRef.current) / 1000);
        accumulatedAtStartRef.current += deltaSeconds;
        startTimeRef.current = null;
      }
    }

    return () => clearInterval(interval);
  }, [isActive, mode, isBreak]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getProgress = () => {
    if (mode === 'STOPWATCH') return 1;
    let total = initialDisplayTimeRef.current;
    return total === 0 ? 0 : displayTime / total;
  };

  const adjustValue = (setter: React.Dispatch<React.SetStateAction<number>>, delta: number) => {
    if (isActive) return;
    setter(prev => Math.max(1, prev + delta));
  };

  // Melhoria no empilhamento de timers minimizados
  const minimizedStyle = {
    bottom: `calc(1.5rem + ${Math.min(stackIndex, 4) * 85}px)`,
    right: '1.5rem',
    opacity: stackIndex > 4 ? 0.3 : 1, // Desvanece timers se houver excesso
    zIndex: 110 + stackIndex,
  };

  if (isMinimized) {
    return (
      <div 
        onClick={() => setIsMinimized(false)} 
        style={minimizedStyle}
        className="fixed cursor-pointer bg-[#0a0f1e]/90 border-2 border-indigo-500/30 px-6 py-4 rounded-3xl shadow-2xl backdrop-blur-2xl flex items-center gap-4 group transition-all hover:scale-105 active:scale-95 animate-in slide-in-from-right-10"
      >
        <div className="relative w-10 h-10 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="45" stroke="rgba(255,255,255,0.05)" strokeWidth="8" fill="transparent" />
                <circle cx="50" cy="50" r="45" stroke={isBreak ? "#10b981" : "#6366f1"} strokeWidth="8" fill="transparent" strokeDasharray="282.7" strokeDashoffset={282.7 - (282.7 * getProgress())} strokeLinecap="round" className="transition-all duration-1000" />
            </svg>
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`} />
        </div>
        <div className="flex flex-col">
            <span className="text-[7px] font-bold text-indigo-400 uppercase tracking-widest truncate w-24">{task.title}</span>
            <span className="text-xl font-space font-bold text-white tabular-nums leading-none">{formatTime(displayTime)}</span>
        </div>
      </div>
    );
  }

  const radius = 135;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center z-[120] p-4 animate-in fade-in">
      <div className="bg-[#0a0f1e] border-2 border-white/10 rounded-[4rem] w-full max-w-[700px] overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        
        <div className="px-8 md:px-12 pt-8 md:pt-12 pb-4 flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[10px] md:text-[11px] uppercase tracking-[0.6em] text-indigo-400 font-bold block opacity-70">Sincronizador Universal</span>
            <h3 className="text-2xl md:text-3xl font-space font-bold text-white uppercase truncate max-w-[250px] md:max-w-[400px]">{task.title}</h3>
          </div>
          <div className="flex gap-2 md:gap-4">
            <button onClick={() => setIsMinimized(true)} className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M19 13l-7 7-7-7m14-8l-7 7-7-7" /></svg>
            </button>
            <button onClick={onClose} className="p-3 bg-red-500/10 rounded-2xl text-slate-600 hover:text-red-400 text-xl font-light transition-colors">&times;</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 md:px-10 pb-12 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-10">
          <div className="space-y-4 md:space-y-6 flex flex-col items-center">
            <div className="flex justify-center gap-1 md:gap-2 w-full">
              {(['POMODORO', 'TIMER', 'STOPWATCH'] as TimerMode[]).map((m) => (
                <button key={m} onClick={() => { if(!isActive) setMode(m); }} className={`flex-1 px-3 md:px-4 py-2 rounded-xl text-[8px] md:text-[9px] font-bold uppercase border transition-all ${mode === m ? 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.2)]' : isActive ? 'border-white/5 text-slate-800 cursor-not-allowed' : 'border-white/5 text-slate-600'}`}>{m}</button>
              ))}
            </div>

            {!isActive && mode !== 'STOPWATCH' && (
              <div className="flex items-center gap-4 bg-white/5 p-3 rounded-2xl w-full justify-between">
                {mode === 'POMODORO' ? (
                  <>
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-[7px] text-slate-500 uppercase font-bold mb-1 tracking-widest">Trabalho</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjustValue(setWorkDuration, -1)} className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs">-</button>
                        <span className="text-xs font-bold text-indigo-400">{workDuration}m</span>
                        <button onClick={() => adjustValue(setWorkDuration, 1)} className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs">+</button>
                      </div>
                    </div>
                    <div className="w-[1px] h-6 bg-white/10" />
                    <div className="flex flex-col items-center flex-1">
                      <span className="text-[7px] text-slate-500 uppercase font-bold mb-1 tracking-widest">Pausa</span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => adjustValue(setBreakDuration, -1)} className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs">-</button>
                        <span className="text-xs font-bold text-emerald-400">{breakDuration}m</span>
                        <button onClick={() => adjustValue(setBreakDuration, 1)} className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs">+</button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center w-full">
                    <span className="text-[7px] text-slate-500 uppercase font-bold mb-1 tracking-widest">Duração</span>
                    <div className="flex items-center gap-4">
                      <button onClick={() => adjustValue(setTimerDuration, -5)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs">-5</button>
                      <span className="text-lg font-space font-bold text-indigo-400">{timerDuration}m</span>
                      <button onClick={() => adjustValue(setTimerDuration, 5)} className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-xs">+5</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="relative flex items-center justify-center w-[200px] h-[200px] md:w-[240px] md:h-[240px]">
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 320 320">
                <circle cx="160" cy="160" r={radius} stroke="rgba(255,255,255,0.03)" strokeWidth="10" fill="transparent" />
                <circle cx="160" cy="160" r={radius} stroke={isBreak ? "#10b981" : "#6366f1"} strokeWidth="10" fill="transparent" strokeDasharray={circumference} strokeDashoffset={circumference - (circumference * getProgress())} strokeLinecap="round" className="transition-all duration-300 ease-linear" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {isBreak && <span className="text-[8px] font-bold text-emerald-400 uppercase mb-1 tracking-widest">Intervalo</span>}
                <span className="text-4xl md:text-5xl font-space font-bold text-white tabular-nums">{formatTime(displayTime)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
              <button 
                onClick={() => setIsActive(!isActive)} 
                className={`h-14 md:h-16 rounded-3xl font-bold uppercase text-[9px] md:text-[10px] transition-all transform active:scale-95 ${isActive ? 'bg-slate-900 text-red-400 border border-red-500/20 shadow-[0_0_20px_rgba(239,68,68,0.1)]' : 'bg-white text-slate-950 shadow-[0_0_30px_rgba(255,255,255,0.1)]'}`}
              >
                {isActive ? 'Congelar' : 'Sincronizar'}
              </button>
              <button 
                onClick={() => { 
                  setIsActive(false); 
                  setIsBreak(false); 
                  setTotalAccumulatedSeconds(0);
                  accumulatedAtStartRef.current = 0;
                  startTimeRef.current = null;
                  const resetVal = mode === 'POMODORO' ? (isBreak ? breakDuration : workDuration) * 60 : mode === 'TIMER' ? timerDuration * 60 : 0;
                  setDisplayTime(resetVal);
                  initialDisplayTimeRef.current = resetVal;
                }} 
                className="h-14 md:h-16 rounded-3xl bg-slate-900/40 border border-white/10 text-slate-500 font-bold uppercase text-[9px] md:text-[10px] active:scale-95 hover:text-white transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="space-y-6 flex flex-col h-full">
            {task.requiresInput ? (
              <div className="flex-1 flex flex-col space-y-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Anotações do Ciclo</span>
                <textarea 
                  value={task.currentInput || ''}
                  onChange={(e) => onUpdateTask({ currentInput: e.target.value })}
                  placeholder="O que você está construindo agora?"
                  className="flex-1 bg-slate-900/50 border border-white/5 rounded-[2rem] p-6 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-all resize-none font-light leading-relaxed min-h-[150px]"
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] text-center p-6 md:p-8">
                <p className="text-[10px] font-bold text-slate-700 uppercase leading-loose tracking-[0.2em]">Foco absoluto ativado.<br/>Sem registros necessários para este protocolo.</p>
              </div>
            )}

            <button onClick={() => onComplete('COMPLETED', totalAccumulatedSeconds)} className="w-full h-16 md:h-20 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-3xl flex flex-col items-center justify-center hover:bg-indigo-600 hover:text-white transition-all shadow-lg active:scale-95 group">
              <span className="font-space font-bold text-xs uppercase group-hover:tracking-widest transition-all">Finalizar Protocolo</span>
              <span className="text-[8px] opacity-60 mt-1 uppercase tracking-tighter">Tempo Real Investido: {formatTime(totalAccumulatedSeconds)}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerModal;
