
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

  const hasStartedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Função para tocar o alarme sonoro via Web Audio API
  const playAlarmSound = () => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
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

      // Sequência de bips para o alarme
      const now = ctx.currentTime;
      playBeep(880, now, 0.3);
      playBeep(440, now + 0.4, 0.3);
      playBeep(880, now + 0.8, 0.5);
    } catch (e) {
      console.warn("Áudio não pôde ser reproduzido:", e);
    }
  };

  // Sincroniza o mostrador central com as configurações atuais
  useEffect(() => {
    if (!isActive && !hasStartedRef.current) {
      if (mode === 'POMODORO') {
        setTimeLeft((isBreak ? breakDuration : workDuration) * 60);
      } else if (mode === 'TIMER') {
        setTimeLeft(timerDuration * 60);
      }
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
              playAlarmSound(); // Dispara o som ao zerar
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
    // Resume o AudioContext caso esteja suspenso (política do navegador)
    if (audioCtxRef.current?.state === 'suspended') {
      audioCtxRef.current.resume();
    }
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
      <div onClick={() => setIsMinimized(false)} className="fixed bottom-8 right-8 z-[110] cursor-pointer animate-in slide-in-from-bottom-10">
        <div className="flex items-center gap-6 bg-[#0a0f1e]/90 border-2 border-indigo-500/30 px-8 py-5 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl hover:border-indigo-500/60 transition-all">
          <div className="flex flex-col">
            <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest mb-1">{mode}</span>
            <span className="text-2xl font-space font-bold text-white tabular-nums leading-none">
              {mode === 'STOPWATCH' ? formatTime(stopwatchTime) : formatTime(timeLeft)}
            </span>
          </div>
          <div className="flex gap-2">
             <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`} />
             <button onClick={(e) => { e.stopPropagation(); onClose(); }} className="text-slate-500 hover:text-red-400 transition-colors ml-2">&times;</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center z-[100] p-4 animate-in fade-in duration-500">
      <div className={`bg-[#0a0f1e] border-2 border-white/10 ${isBreak ? 'border-emerald-500/40' : 'border-purple-500/40'} rounded-[4rem] w-full max-w-[550px] overflow-hidden shadow-[0_0_120px_rgba(0,0,0,1)] flex flex-col max-h-[95vh]`}>
        
        <div className="px-12 pt-12 pb-6 flex justify-between items-start flex-shrink-0">
          <div className="space-y-1">
            <span className="text-[11px] uppercase tracking-[0.6em] text-indigo-400 font-bold block opacity-70">Sincronizador Universal</span>
            <h3 className="text-3xl md:text-4xl font-space font-bold text-white tracking-tighter uppercase leading-none truncate max-w-[300px]">{task.title}</h3>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMinimized(true)} 
              title="Minimizar Sincronia"
              className="p-3 bg-white/5 rounded-2xl text-slate-400 hover:text-white hover:bg-white/10 transition-all group"
            >
              <svg className="w-6 h-6 transform group-hover:scale-y-75 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M18 12H6" />
              </svg>
            </button>
            <button 
              onClick={onClose} 
              className="text-slate-600 hover:text-red-400 text-4xl font-light transition-colors"
            >
              &times;
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-10 pb-12 custom-scrollbar">
          <div className="flex justify-center gap-3 mb-10">
            {(['POMODORO', 'TIMER', 'STOPWATCH'] as TimerMode[]).map((m) => (
              <button 
                key={m} 
                onClick={() => { setMode(m); setIsActive(false); hasStartedRef.current = false; }} 
                className={`px-6 py-2.5 rounded-2xl text-[10px] font-bold tracking-widest uppercase border transition-all ${mode === m ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-transparent border-white/5 text-slate-700 hover:border-white/10'}`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="relative flex items-center justify-center mb-12 mx-auto w-[280px] h-[280px] md:w-[320px] md:h-[320px] bg-slate-900/30 border border-white/5 rounded-[4rem] shadow-[inset_0_0_40px_rgba(0,0,0,0.5)]">
            <svg className="w-full h-full -rotate-90 block" viewBox="0 0 320 320">
              <circle cx="160" cy="160" r={radius} stroke="currentColor" strokeWidth="2" fill="transparent" className="text-slate-900" />
              <circle 
                cx="160" cy="160" r={radius} 
                stroke="currentColor" strokeWidth="10" 
                fill="transparent" 
                className={`${isBreak ? 'text-emerald-500' : 'text-purple-500'} transition-all duration-1000 ease-linear ${isFinished ? 'animate-pulse' : ''}`} 
                strokeDasharray={circumference} 
                strokeDashoffset={circumference - (circumference * getProgress())} 
                strokeLinecap="round" 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-6xl md:text-[5.5rem] font-space font-bold text-white tracking-tighter tabular-nums leading-none ${isFinished ? 'animate-pulse text-indigo-400' : ''}`}>
                {mode === 'STOPWATCH' ? formatTime(stopwatchTime) : formatTime(timeLeft)}
              </span>
              {isBreak && mode === 'POMODORO' && <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mt-2">Pausa Ativa</span>}
            </div>
          </div>

          {!isActive && !isFinished && (
            <div className="grid grid-cols-1 gap-4 mb-10 animate-in fade-in slide-in-from-top-4">
              <div className="bg-slate-950/50 border border-white/5 rounded-3xl p-6 space-y-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] block text-center mb-2">Configuração de Ciclo (Minutos)</span>
                
                {mode === 'POMODORO' && (
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-2">
                      <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block text-center">Foco</label>
                      <div className="flex items-center justify-between bg-slate-900 rounded-2xl p-1">
                        <button onClick={() => setWorkDuration(p => Math.max(1, p - 5))} className="w-10 h-10 rounded-xl text-slate-500 hover:text-white hover:bg-white/5">-</button>
                        <span className="text-lg font-space font-bold text-white">{workDuration}</span>
                        <button onClick={() => setWorkDuration(p => Math.min(120, p + 5))} className="w-10 h-10 rounded-xl text-slate-500 hover:text-white hover:bg-white/5">+</button>
                      </div>
                    </div>
                    <div className="flex-1 space-y-2">
                      <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block text-center">Pausa</label>
                      <div className="flex items-center justify-between bg-slate-900 rounded-2xl p-1">
                        <button onClick={() => setBreakDuration(p => Math.max(1, p - 1))} className="w-10 h-10 rounded-xl text-slate-500 hover:text-white hover:bg-white/5">-</button>
                        <span className="text-lg font-space font-bold text-white">{breakDuration}</span>
                        <button onClick={() => setBreakDuration(p => Math.min(30, p + 1))} className="w-10 h-10 rounded-xl text-slate-500 hover:text-white hover:bg-white/5">+</button>
                      </div>
                    </div>
                  </div>
                )}

                {mode === 'TIMER' && (
                  <div className="space-y-2">
                    <label className="text-[9px] font-bold text-indigo-400 uppercase tracking-widest block text-center">Duração do Alerta</label>
                    <div className="flex items-center justify-center gap-10 bg-slate-900 rounded-2xl p-1">
                      <button onClick={() => setTimerDuration(p => Math.max(1, p - 1))} className="w-14 h-12 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 text-2xl">-</button>
                      <span className="text-2xl font-space font-bold text-white">{timerDuration}m</span>
                      <button onClick={() => setTimerDuration(p => Math.min(360, p + 1))} className="w-14 h-12 rounded-xl text-slate-500 hover:text-white hover:bg-white/5 text-2xl">+</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-5 mb-12">
            <button 
              onClick={toggleTimer} 
              className={`h-20 rounded-[2.5rem] font-space font-bold text-sm tracking-widest uppercase transition-all flex items-center justify-center gap-4 ${isActive ? 'bg-slate-900 text-red-500 border border-red-500/20' : 'bg-white text-slate-950 shadow-2xl hover:bg-indigo-300'}`}
            >
              {isActive ? 'Pausar' : (hasStartedRef.current ? 'Retomar' : 'Iniciar')}
            </button>
            <button 
              onClick={resetTimer} 
              className="h-20 rounded-[2.5rem] bg-slate-900/40 border border-white/10 text-slate-500 font-space font-bold text-sm tracking-widest uppercase hover:text-white hover:border-white/20 transition-all"
            >
              Reset
            </button>
          </div>

          <div className="pt-10 border-t border-white/5">
            <button 
              onClick={() => onComplete('COMPLETED', totalAccumulatedSeconds)} 
              className="w-full h-20 bg-slate-900/40 border-2 border-white/10 text-white rounded-[2.5rem] flex flex-col items-center justify-center gap-1 hover:bg-slate-800 hover:border-emerald-500/50 transition-all group"
            >
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
