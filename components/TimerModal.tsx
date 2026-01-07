
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
  const [localInput, setLocalInput] = useState(task.currentInput || '');

  const hasStartedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const playAlarmSound = () => {
    try {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioCtxRef.current;
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
    } catch (e) {}
  };

  useEffect(() => {
    if (!isActive && !hasStartedRef.current) {
      if (mode === 'POMODORO') setTimeLeft((isBreak ? breakDuration : workDuration) * 60);
      else if (mode === 'TIMER') setTimeLeft(timerDuration * 60);
    }
  }, [mode, isBreak, workDuration, breakDuration, timerDuration, isActive]);

  useEffect(() => {
    let interval: any = null;
    if (isActive) {
      hasStartedRef.current = true;
      interval = setInterval(() => {
        if (!isBreak) setTotalAccumulatedSeconds(p => p + 1);
        if (mode === 'STOPWATCH') setStopwatchTime(p => p + 1);
        else {
          setTimeLeft(p => {
            if (p <= 1) {
              playAlarmSound();
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
    } else clearInterval(interval);
    return () => clearInterval(interval);
  }, [isActive, mode, isBreak, workDuration, breakDuration]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const radius = 135;
  const circumference = 2 * Math.PI * radius;
  const getProgress = () => {
    if (mode === 'STOPWATCH') return 1;
    let total = (mode === 'POMODORO' ? (isBreak ? breakDuration : workDuration) : timerDuration) * 60;
    return total === 0 ? 0 : timeLeft / total;
  };

  if (isMinimized) {
    return (
      <div onClick={() => setIsMinimized(false)} className="fixed bottom-8 right-8 z-[110] cursor-pointer bg-[#0a0f1e]/90 border-2 border-indigo-500/30 px-8 py-5 rounded-[2.5rem] shadow-2xl backdrop-blur-2xl">
        <span className="text-[8px] font-bold text-indigo-400 uppercase block mb-1">{mode}</span>
        <span className="text-2xl font-space font-bold text-white tabular-nums">{mode === 'STOPWATCH' ? formatTime(stopwatchTime) : formatTime(timeLeft)}</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center z-[100] p-4 animate-in fade-in">
      <div className="bg-[#0a0f1e] border-2 border-white/10 rounded-[4rem] w-full max-w-[700px] overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        
        <div className="px-12 pt-12 pb-6 flex justify-between items-start">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.6em] text-indigo-400 font-bold block opacity-70">Sincronizador</span>
            <h3 className="text-3xl font-space font-bold text-white uppercase truncate max-w-[400px]">{task.title}</h3>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setIsMinimized(true)} className="p-3 bg-white/5 rounded-2xl text-slate-400">_</button>
            <button onClick={onClose} className="text-slate-600 hover:text-red-400 text-4xl font-light">&times;</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-10 pb-12 custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="space-y-8">
            <div className="flex justify-center gap-2">
              {(['POMODORO', 'TIMER', 'STOPWATCH'] as TimerMode[]).map((m) => (
                <button key={m} onClick={() => { setMode(m); setIsActive(false); hasStartedRef.current = false; }} className={`px-4 py-2 rounded-xl text-[9px] font-bold uppercase border ${mode === m ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/5 text-slate-600'}`}>{m}</button>
              ))}
            </div>

            <div className="relative flex items-center justify-center mx-auto w-[240px] h-[240px]">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 320 320">
                <circle cx="160" cy="160" r={radius} stroke="rgba(255,255,255,0.03)" strokeWidth="10" fill="transparent" />
                <circle cx="160" cy="160" r={radius} stroke={isBreak ? "#10b981" : "#6366f1"} strokeWidth="10" fill="transparent" strokeDasharray={circumference} strokeDashoffset={circumference - (circumference * getProgress())} strokeLinecap="round" className="transition-all duration-1000 ease-linear" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-space font-bold text-white tabular-nums">{mode === 'STOPWATCH' ? formatTime(stopwatchTime) : formatTime(timeLeft)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => { if (audioCtxRef.current?.state === 'suspended') audioCtxRef.current.resume(); setIsActive(!isActive); }} className={`h-16 rounded-3xl font-bold uppercase text-[10px] ${isActive ? 'bg-slate-900 text-red-400 border border-red-500/20' : 'bg-white text-slate-950'}`}>
                {isActive ? 'Pausar' : 'Iniciar'}
              </button>
              <button onClick={() => { setIsActive(false); setIsBreak(false); setStopwatchTime(0); }} className="h-16 rounded-3xl bg-slate-900/40 border border-white/10 text-slate-500 font-bold uppercase text-[10px]">Reset</button>
            </div>
          </div>

          <div className="space-y-6 flex flex-col">
            {task.requiresInput ? (
              <div className="flex-1 flex flex-col space-y-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Anotações do Ciclo</span>
                <textarea 
                  value={localInput}
                  onChange={(e) => {
                    setLocalInput(e.target.value);
                    // Passamos para a tarefa real no App via o salvamento de tarefas no useEffect do App
                    (task as any).currentInput = e.target.value; 
                  }}
                  placeholder="O que você está construindo agora?"
                  className="flex-1 bg-slate-900/50 border border-white/5 rounded-[2rem] p-6 text-sm text-slate-300 outline-none focus:border-indigo-500 transition-all resize-none font-light leading-relaxed"
                />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center border-2 border-dashed border-white/5 rounded-[2rem] text-center p-8">
                <p className="text-[10px] font-bold text-slate-700 uppercase leading-loose tracking-[0.2em]">Foco absoluto ativado.<br/>Sem registros necessários para este protocolo.</p>
              </div>
            )}

            <button onClick={() => onComplete('COMPLETED', totalAccumulatedSeconds)} className="w-full h-20 bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 rounded-3xl flex flex-col items-center justify-center hover:bg-indigo-600 hover:text-white transition-all">
              <span className="font-space font-bold text-xs uppercase">Confirmar Sincronia</span>
              <span className="text-[8px] opacity-60">Sincronizar Arquivo Universal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimerModal;
