
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";
import { Task, UserStats, Period, LevelInfo, TimerMode } from './types.ts';
import { LEVELS, XP_COMPLETED, XP_GAVE_UP, XP_IGNORED, XP_STEP } from './constants.ts';
import { getLevelNarrative } from './services/geminiService.ts';
import TimerModal from './components/TimerModal.tsx';
import UniverseVisual from './components/UniverseVisual.tsx';

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Esconde o loader assim que o componente monta
  useEffect(() => {
    if ((window as any).hideAppLoader) (window as any).hideAppLoader();
  }, []);

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('cronos_tasks');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });
  
  const [stats, setStats] = useState<UserStats>(() => {
    const d = { xp: 0, level: 1, completedCount: 0, gaveUpCount: 0, ignoredCount: 0, timeLogs: [] };
    try {
      const saved = localStorage.getItem('cronos_stats');
      return saved ? { ...d, ...JSON.parse(saved) } : d;
    } catch (e) { return d; }
  });

  const [periods, setPeriods] = useState<Period[]>(() => {
    const d = [{ id: 'p1', name: 'Manhã' }, { id: 'p2', name: 'Tarde' }, { id: 'p3', name: 'Noite' }];
    try {
      const saved = localStorage.getItem('cronos_periods');
      return saved ? JSON.parse(saved) : d;
    } catch (e) { return d; }
  });

  const [mainView, setMainView] = useState<'DASHBOARD' | 'EVOLUTION' | 'STATISTICS'>('DASHBOARD');
  const [narrative, setNarrative] = useState<string>('');
  const [isLoadingNarrative, setIsLoadingNarrative] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'DAILY' | 'ROUTINE'>('DAILY');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [tempSteps, setTempSteps] = useState<string[]>([]);
  const [newStepInput, setNewStepInput] = useState('');
  const [selectedPeriodForAdd, setSelectedPeriodForAdd] = useState<string>('');
  const [filterPeriodId, setFilterPeriodId] = useState<string | 'all'>('all');
  const [newPeriodName, setNewPeriodName] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showPeriodManager, setShowPeriodManager] = useState(false);
  const [statPeriod, setStatPeriod] = useState<'DAY' | 'MONTH' | 'YEAR'>('DAY');

  useEffect(() => {
    localStorage.setItem('cronos_tasks', JSON.stringify(tasks));
    localStorage.setItem('cronos_stats', JSON.stringify(stats));
    localStorage.setItem('cronos_periods', JSON.stringify(periods));
  }, [tasks, stats, periods]);

  useEffect(() => {
    if (mainView === 'EVOLUTION' && !narrative) loadNarrative();
  }, [mainView, stats.level]);

  useEffect(() => {
    if (periods.length > 0 && !selectedPeriodForAdd) setSelectedPeriodForAdd(periods[0].id);
  }, [periods]);

  const loadNarrative = async () => {
    const currentLevelInfo = LEVELS.find(l => l.level === stats.level) || LEVELS[0];
    setIsLoadingNarrative(true);
    const text = await getLevelNarrative(currentLevelInfo);
    setNarrative(text);
    setIsLoadingNarrative(false);
  };

  const updateStats = (xpChange: number, status: string, secondsSpent: number = 0, specificTask?: Task) => {
    setStats(prev => {
      let newXp = Math.max(0, (prev.xp || 0) + xpChange);
      const nextLevel = LEVELS.find(l => l.xpRequired > newXp);
      let newLevel = nextLevel ? nextLevel.level - 1 : LEVELS[LEVELS.length - 1].level;
      newLevel = Math.max(1, newLevel);

      const logTask = specificTask || activeTask;
      const newLog = secondsSpent > 0 ? {
        timestamp: Date.now(),
        seconds: secondsSpent,
        taskId: logTask?.id || 'unknown',
        taskTitle: logTask?.title || 'Protocolo Síncrono'
      } : null;

      return {
        ...prev,
        xp: newXp,
        level: newLevel,
        completedCount: status === 'COMPLETED' ? (prev.completedCount || 0) + 1 : (prev.completedCount || 0),
        timeLogs: newLog ? [...(prev.timeLogs || []), newLog] : (prev.timeLogs || [])
      };
    });
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const newTask: Task = { 
      id: crypto.randomUUID(), title: newTaskTitle, type: activeSubTab, status: 'PENDING', createdAt: Date.now(),
      periodId: selectedPeriodForAdd || undefined,
      steps: tempSteps.map(s => ({ id: crypto.randomUUID(), title: s, completed: false }))
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
    setTempSteps([]);
  };

  const toggleStep = (taskId: string, stepId: string) => {
    setTasks(tasks.map(t => {
      if (t.id === taskId && t.steps) {
        const newSteps = t.steps.map(s => {
          if (s.id === stepId) {
            const nowCompleted = !s.completed;
            updateStats(nowCompleted ? XP_STEP : -XP_STEP, 'STEP_COMPLETED', 0, t);
            return { ...s, completed: nowCompleted };
          }
          return s;
        });
        return { ...t, steps: newSteps };
      }
      return t;
    }));
  };

  const handleTaskAction = (status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED', seconds: number) => {
    if (!activeTask) return;
    const xp = status === 'COMPLETED' ? XP_COMPLETED : status === 'GAVE_UP' ? XP_GAVE_UP : XP_IGNORED;
    updateStats(xp, status, seconds);
    if (activeTask.type === 'DAILY') setTasks(tasks.filter(t => t.id !== activeTask.id));
    else setTasks(tasks.map(t => t.id === activeTask.id ? { ...t, status, lastDone: Date.now() } : t));
    setActiveTask(null);
  };

  const aggregatedData = useMemo(() => {
    const logs = stats.timeLogs || [];
    const now = new Date();
    const filtered = logs.filter(l => {
      const d = new Date(l.timestamp);
      if (statPeriod === 'DAY') return d.toDateString() === now.toDateString();
      if (statPeriod === 'MONTH') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      return d.getFullYear() === now.getFullYear();
    });
    const totalSeconds = filtered.reduce((acc, curr) => acc + curr.seconds, 0);
    const byTask = filtered.reduce((acc: any, curr) => {
      acc[curr.taskTitle] = (acc[curr.taskTitle] || 0) + curr.seconds;
      return acc;
    }, {});
    return { totalSeconds, byTask: Object.entries(byTask).sort((a: any, b: any) => b[1] - a[1]) };
  }, [stats.timeLogs, statPeriod]);

  const currentLevel = LEVELS.find(l => l.level === stats.level) || LEVELS[0];

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-[#020617] text-slate-200 overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={(e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const r = new FileReader();
        r.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string);
            if (data.tasks && data.stats) {
              setTasks(data.tasks); setStats(data.stats); setPeriods(data.periods || periods);
              setShowBackupModal(false);
            }
          } catch (err) { alert("Backup inválido."); }
        };
        r.readAsText(file);
      }} accept=".json" className="hidden" />

      <nav className="w-full md:w-20 lg:w-24 bg-slate-900/40 border-b md:border-b-0 md:border-r border-white/5 backdrop-blur-2xl flex md:flex-col items-center justify-between p-3 md:p-4 z-50 flex-shrink-0">
        <div className="flex md:flex-col items-center gap-4 md:gap-8 w-full justify-around md:justify-start">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center font-space font-bold text-white text-xl md:text-2xl shadow-[0_0_25px_rgba(79,70,229,0.4)] md:mb-10">C</div>
          <button onClick={() => setMainView('DASHBOARD')} className={`p-3 rounded-2xl transition-all ${mainView === 'DASHBOARD' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg></button>
          <button onClick={() => setMainView('EVOLUTION')} className={`p-3 rounded-2xl transition-all ${mainView === 'EVOLUTION' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></button>
          <button onClick={() => setMainView('STATISTICS')} className={`p-3 rounded-2xl transition-all ${mainView === 'STATISTICS' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
          <button onClick={() => setShowBackupModal(true)} className="p-3 rounded-2xl text-slate-500 hover:text-indigo-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg></button>
        </div>
      </nav>

      <main className="flex-1 h-full overflow-y-auto scroll-smooth">
        <div className="w-full max-w-7xl mx-auto px-6 py-10 md:px-12 lg:px-20 md:py-16">
          {mainView === 'DASHBOARD' && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h1 className="text-4xl md:text-6xl font-space font-bold text-white uppercase mb-10">Protocolo Ativo</h1>
              
              <div className="flex gap-4 mb-12">
                <button onClick={() => setActiveSubTab('DAILY')} className={`px-8 py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] ${activeSubTab === 'DAILY' ? 'bg-indigo-600 text-white' : 'bg-slate-900/50 text-slate-500'}`}>Objetivos</button>
                <button onClick={() => setActiveSubTab('ROUTINE')} className={`px-8 py-3 rounded-2xl font-bold uppercase tracking-widest text-[10px] ${activeSubTab === 'ROUTINE' ? 'bg-indigo-600 text-white' : 'bg-slate-900/50 text-slate-500'}`}>Rotinas</button>
              </div>

              <form onSubmit={addTask} className="mb-16 flex flex-col md:flex-row gap-4">
                <input type="text" placeholder="Injetar novo objetivo..." value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} className="flex-1 h-16 bg-slate-900/40 border border-white/10 rounded-3xl px-8 text-xl text-white outline-none focus:border-indigo-500/50" />
                <button type="submit" className="h-16 px-10 bg-white text-slate-950 rounded-3xl font-space font-bold uppercase text-xs tracking-widest">Fixar</button>
              </form>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {tasks.filter(t => t.type === activeSubTab).map(task => (
                  <div key={task.id} onClick={() => setActiveTask(task)} className="p-8 bg-slate-900/30 border border-white/5 rounded-[2.5rem] hover:bg-slate-900/50 cursor-pointer transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-2xl font-space text-white">{task.title}</h3>
                      <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="text-slate-600 hover:text-red-500">&times;</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {mainView === 'EVOLUTION' && (
            <div className="animate-in fade-in zoom-in duration-700">
               <UniverseVisual level={stats.level || 1} />
               <div className="mt-10 p-10 bg-slate-900/30 border border-white/5 rounded-[3rem]">
                 <h2 className="text-4xl font-space font-bold text-white mb-4">{currentLevel.name}</h2>
                 <p className="text-xl text-slate-400 italic font-serif">{isLoadingNarrative ? "Sincronizando..." : narrative}</p>
               </div>
            </div>
          )}

          {mainView === 'STATISTICS' && (
            <div className="animate-in fade-in">
              <h1 className="text-4xl font-space font-bold text-white uppercase mb-10">Análise Temporal</h1>
              <div className="grid grid-cols-3 gap-8">
                 <div className="bg-slate-900/30 p-10 rounded-3xl text-center">
                   <span className="text-[10px] text-indigo-400 uppercase font-bold">Investimento</span>
                   <div className="text-5xl font-space font-bold text-white mt-4">{(aggregatedData.totalSeconds / 60).toFixed(0)}m</div>
                 </div>
                 <div className="bg-slate-900/30 p-10 rounded-3xl text-center">
                   <span className="text-[10px] text-emerald-400 uppercase font-bold">Sincronias</span>
                   <div className="text-5xl font-space font-bold text-white mt-4">{stats.timeLogs?.length || 0}</div>
                 </div>
                 <div className="bg-slate-900/30 p-10 rounded-3xl text-center">
                   <span className="text-[10px] text-pink-400 uppercase font-bold">XP Acumulado</span>
                   <div className="text-5xl font-space font-bold text-white mt-4">{stats.xp || 0}</div>
                 </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {activeTask && <TimerModal task={activeTask} onClose={() => setActiveTask(null)} onComplete={handleTaskAction} />}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
