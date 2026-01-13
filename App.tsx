
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, UserStats, TimeLog, Period, TaskStep, PriorityLevel, CompletionMode, TaskCategory, LevelInfo, NebulaTheme } from './types.ts';
import { LEVELS, XP_COMPLETED, XP_CYCLE, XP_GAVE_UP, XP_IGNORED, XP_STEP, XP_TIME_BLOCK } from './constants.ts';
import { getLevelNarrative } from './services/geminiService.ts';
import TimerModal from './components/TimerModal.tsx';
import UniverseVisual from './components/UniverseVisual.tsx';

type MainView = 'DASHBOARD' | 'EVOLUTION' | 'STATISTICS';

const PERIODS: Period[] = [
  { id: 'p1', name: 'Manhã' }, 
  { id: 'p2', name: 'Tarde' }, 
  { id: 'p3', name: 'Noite' },
  { id: 'p4', name: '♾️ Constantes' }
];

const ENCOURAGEMENTS = [
  "O Universo vibra com sua nova frequência.",
  "As estrelas se alinham ao seu comando.",
  "Você transcendeu as limitações da matéria.",
  "Sua luz atravessa as nébulas do tempo.",
  "A sincronia perfeita foi estabelecida."
];

const NEBULA_PRESETS: NebulaTheme[] = [
  { name: 'Vácuo Índigo', primary: '#4338ca', secondary: '#1e1b4b' },
  { name: 'Supernova Rubi', primary: '#e11d48', secondary: '#4c0519' },
  { name: 'Aurora Esmeralda', primary: '#10b981', secondary: '#064e3b' },
  { name: 'Névoa Dourada', primary: '#f59e0b', secondary: '#78350f' },
  { name: 'Abismo Cinzento', primary: '#475569', secondary: '#0f172a' },
  { name: 'Plasma Violeta', primary: '#a855f7', secondary: '#3b0764' },
];

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('cronos_tasks');
      let loadedTasks: Task[] = saved ? JSON.parse(saved) : [];
      const today = new Date().toDateString();
      const validPeriodIds = PERIODS.map(p => p.id);
      
      return loadedTasks.map((t): Task => {
        if (!t.periodId || !validPeriodIds.includes(t.periodId)) {
          t.periodId = 'p1';
        }
        const lastDate = t.lastDone ? new Date(t.lastDone).toDateString() : null;

        if (t.type === 'ROUTINE' && t.status !== 'PENDING' && lastDate !== today) {
          return { 
            ...t, 
            status: 'PENDING', 
            currentInput: '', 
            lastDone: undefined,
            completedAt: undefined,
            steps: t.steps?.map(s => ({ ...s, completed: false })) || []
          };
        }
        return t;
      }).filter(t => {
        if (t.type === 'DAILY' && t.status !== 'PENDING' && t.lastDone) {
          return new Date(t.lastDone).toDateString() === today;
        }
        return true; 
      });
    } catch (e) { return []; }
  });
  
  const [stats, setStats] = useState<UserStats>(() => {
    const d: UserStats = { xp: 0, level: 1, completedCount: 0, gaveUpCount: 0, ignoredCount: 0, timeLogs: [], nebulaTheme: NEBULA_PRESETS[0] };
    try {
      const saved = localStorage.getItem('cronos_stats');
      return saved ? { ...d, ...JSON.parse(saved) } : d;
    } catch (e) { return d; }
  });

  const [mainView, setMainView] = useState<MainView>('DASHBOARD');
  const [narrative, setNarrative] = useState('');
  const [isLoadingNarrative, setIsLoadingNarrative] = useState(false);
  const [activeTaskIds, setActiveTaskIds] = useState<string[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'DAILY' | 'ROUTINE'>('DAILY');
  const [levelUpData, setLevelUpData] = useState<LevelInfo | null>(null);
  
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>(2);
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>('WORK');
  const [newTaskRequiresInput, setNewTaskRequiresInput] = useState(false);
  const [newTaskStepInput, setNewTaskStepInput] = useState('');
  const [newTaskSteps, setNewTaskSteps] = useState<string[]>([]);

  const [selectedPeriodForAdd, setSelectedPeriodForAdd] = useState('p1');
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const currentLevel = useMemo(() => LEVELS.find(l => l.level === stats.level) || LEVELS[0], [stats.level]);
  const nextLevel = useMemo(() => LEVELS.find(l => l.level === stats.level + 1), [stats.level]);

  useEffect(() => {
    const checkMidnight = () => {
      const today = new Date().toDateString();
      const lastCheck = localStorage.getItem('cronos_last_day_check');
      if (lastCheck && lastCheck !== today) {
        setTasks(prev => prev.map(t => {
          if (t.type === 'ROUTINE' && t.status !== 'PENDING') {
            return { 
              ...t, 
              status: 'PENDING', 
              lastDone: undefined, 
              completedAt: undefined, 
              currentInput: '',
              steps: t.steps?.map(s => ({ ...s, completed: false })) || []
            };
          }
          return t;
        }));
      }
      localStorage.setItem('cronos_last_day_check', today);
    };
    const interval = setInterval(checkMidnight, 60000);
    checkMidnight();
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Remove o loader após a aplicação estar completamente montada
    const removeLoader = () => {
      const loader = document.getElementById('app-loader');
      if (loader) {
        loader.style.opacity = '0';
        setTimeout(() => {
          if (loader.parentNode) {
            loader.parentNode.removeChild(loader);
          }
        }, 500);
      }
    };
    
    // Tenta remover imediatamente e também após um pequeno delay
    removeLoader();
    setTimeout(removeLoader, 100);
    
    // Fallback: usa a função global se existir
    if (typeof window !== 'undefined' && (window as any).hideAppLoader) {
      (window as any).hideAppLoader();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('cronos_tasks', JSON.stringify(tasks));
    localStorage.setItem('cronos_stats', JSON.stringify(stats));
  }, [tasks, stats]);

  useEffect(() => {
    if (mainView === 'EVOLUTION' && !narrative) loadNarrative();
  }, [mainView, stats.level]);

  const loadNarrative = async () => {
    setIsLoadingNarrative(true);
    const text = await getLevelNarrative(currentLevel);
    setNarrative(text);
    setIsLoadingNarrative(false);
  };

  const exportData = () => {
    const data = {
      tasks,
      stats,
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cronos_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported.tasks && imported.stats) {
          if (confirm("Isso substituirá todos os seus dados atuais. Continuar?")) {
            setTasks(imported.tasks);
            setStats(imported.stats);
            alert("Protocolo restaurado com sucesso!");
          }
        } else {
          alert("Arquivo de backup inválido.");
        }
      } catch (err) {
        alert("Erro ao ler o arquivo de backup.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const updateStats = (xpChange: number, status: string, secondsSpent: number = 0, specificTask?: Task) => {
    setStats(prev => {
      let newXp = Math.max(0, (prev.xp || 0) + xpChange);
      const levelFound = LEVELS.filter(l => l.xpRequired <= newXp).pop();
      let newLevel = levelFound ? levelFound.level : 1;
      
      if (newLevel > prev.level) {
        setLevelUpData(levelFound || null);
      }

      const newLog = secondsSpent > 0 ? {
        timestamp: Date.now(),
        seconds: secondsSpent,
        taskId: specificTask?.id || 'unknown',
        taskTitle: specificTask?.title || 'Sincronia'
      } : null;

      return {
        ...prev,
        xp: newXp,
        level: newLevel,
        completedCount: status === 'COMPLETED' ? (prev.completedCount || 0) + 1 : (prev.completedCount || 0),
        gaveUpCount: status === 'GAVE_UP' ? (prev.gaveUpCount || 0) + 1 : (prev.gaveUpCount || 0),
        ignoredCount: status === 'IGNORED' ? (prev.ignoredCount || 0) + 1 : (prev.ignoredCount || 0),
        timeLogs: newLog ? [newLog, ...(prev.timeLogs || [])].slice(0, 100) : (prev.timeLogs || [])
      };
    });
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    const newTask: Task = { 
      id: crypto.randomUUID(), 
      title: newTaskTitle, 
      type: activeSubTab, 
      category: newTaskCategory,
      priority: newTaskPriority,
      completionMode: 'TIMER',
      requiresInput: newTaskRequiresInput,
      currentInput: '',
      status: 'PENDING', 
      createdAt: Date.now(),
      periodId: selectedPeriodForAdd,
      steps: newTaskSteps.map(s => ({ id: crypto.randomUUID(), title: s, completed: false }))
    };
    
    setTasks(prev => [...prev, newTask]);
    setNewTaskTitle('');
    setNewTaskSteps([]);
  };

  const addStepToNewTask = () => {
    if (!newTaskStepInput.trim()) return;
    setNewTaskSteps(prev => [...prev, newTaskStepInput.trim()]);
    setNewTaskStepInput('');
  };

  const removeStepFromNewTask = (index: number) => {
    setNewTaskSteps(prev => prev.filter((_, i) => i !== index));
  };

  const resetAllRoutines = () => {
    if(!confirm("Reiniciar todas as rotinas para hoje?")) return;
    setTasks(prev => prev.map(t => 
      t.type === 'ROUTINE' 
        ? { 
            ...t, 
            status: 'PENDING', 
            currentInput: '', 
            lastDone: undefined, 
            completedAt: undefined,
            steps: t.steps?.map(s => ({ ...s, completed: false })) || []
          } 
        : t
    ));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const toggleStep = (taskId: string, stepId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        const newSteps = task.steps?.map(step => {
          if (step.id === stepId) {
            const newStatus = !step.completed;
            if (newStatus) updateStats(XP_STEP, 'STEP_COMPLETED', 0, task);
            else updateStats(-XP_STEP, 'STEP_UNCHECKED', 0, task);
            return { ...step, completed: newStatus };
          }
          return step;
        });
        return { ...task, steps: newSteps };
      }
      return task;
    }));
  };

  const addStepToExistingTask = (taskId: string, title: string) => {
    if (!title.trim()) return;
    setTasks(prev => prev.map(task => {
      if (task.id === taskId) {
        return { 
          ...task, 
          steps: [...(task.steps || []), { id: crypto.randomUUID(), title: title.trim(), completed: false }] 
        };
      }
      return task;
    }));
  };

  const handleTaskAction = (status: 'COMPLETED' | 'CYCLE_FINISHED' | 'GAVE_UP' | 'IGNORED', seconds: number, taskOverride: Task) => {
    let xp = 0;
    if (status === 'COMPLETED') xp = XP_COMPLETED;
    else if (status === 'CYCLE_FINISHED') xp = XP_CYCLE;
    else if (status === 'GAVE_UP') xp = XP_GAVE_UP;
    else if (status === 'IGNORED') xp = XP_IGNORED;
    
    updateStats(xp, status, seconds, taskOverride);
    
    setTasks(prev => prev.map(t => {
      if (t.id === taskOverride.id) {
        return { 
          ...t, 
          status: status === 'COMPLETED' ? 'COMPLETED' : t.status,
          lastDone: Date.now(), 
          completedAt: status === 'COMPLETED' ? Date.now() : t.completedAt 
        };
      }
      return t;
    }));

    setActiveTaskIds(prev => prev.filter(id => id !== taskOverride.id));
    
    if (status === 'COMPLETED') {
      setExpandedTasks(prev => {
        const newState = { ...prev };
        delete newState[taskOverride.id];
        return newState;
      });
    }
  };

  const toggleTaskTimer = (taskId: string) => {
    setActiveTaskIds(prev => prev.includes(taskId) ? prev : [...prev, taskId]);
  };

  const restoreTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    updateStats(-XP_COMPLETED, 'RESTORED', 0, task);
    setTasks(prev => prev.map(t => t.id === taskId ? { 
      ...t, 
      status: 'PENDING', 
      lastDone: undefined, 
      completedAt: undefined,
      steps: t.steps?.map(s => ({ ...s, completed: false })) || []
    } : t));
  };

  const formatSeconds = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  const changeNebulaTheme = (theme: Partial<NebulaTheme>) => {
    setStats(prev => ({
      ...prev,
      nebulaTheme: { ...prev.nebulaTheme!, ...theme }
    }));
  };

  const priorityLabels = { 1: "ALTA", 2: "MÉDIA", 3: "BAIXA" };
  const priorityColors = { 1: "bg-red-500", 2: "bg-indigo-500", 3: "bg-slate-700" };
  const priorityText = { 1: "text-red-400", 2: "text-indigo-400", 3: "text-slate-500" };

  return (
    <div className="h-[100dvh] w-full flex flex-col md:flex-row bg-[#020617] text-slate-200 overflow-hidden font-inter select-none">
      <style>{`
        .tab-glow { text-shadow: 0 0 15px rgba(129, 140, 248, 0.4); }
        .active-text-gradient {
          background: linear-gradient(135deg, #fff 0%, #818cf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .inactive-text-style { color: rgba(148, 163, 184, 0.3); }
        .console-blur { backdrop-filter: blur(24px) saturate(180%); }
        .hologram-card { 
          background: rgba(255, 255, 255, 0.015);
          border: 1px solid rgba(255, 255, 255, 0.05);
          box-shadow: inset 0 0 10px rgba(129, 140, 248, 0.02);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .floating-nav {
          box-shadow: 0 -10px 40px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.05);
        }
      `}</style>
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />

      {/* Ascension Modal */}
      {levelUpData && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-3xl animate-in fade-in zoom-in duration-500 overflow-hidden">
          <div className="max-w-xl w-full text-center space-y-8 relative z-10">
            <div className="space-y-2">
              <span className="text-[10px] font-black text-indigo-400 tracking-[0.8em] uppercase block animate-pulse">Evolução Detectada</span>
              <div className="text-8xl md:text-[180px] font-space font-bold text-white leading-none filter drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                {levelUpData.level}
              </div>
            </div>
            <div className="space-y-4">
              <h2 className="text-3xl md:text-5xl font-space font-bold text-white uppercase tracking-tight">{levelUpData.name}</h2>
              <p className="text-slate-400 text-sm md:text-lg font-light italic max-w-xs mx-auto">"{ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]}"</p>
            </div>
            <button onClick={() => { setLevelUpData(null); setMainView('EVOLUTION'); }} className="w-full max-w-xs mx-auto h-16 bg-white text-slate-950 rounded-2xl font-space font-bold uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all">Sincronizar</button>
          </div>
        </div>
      )}

      {/* Navigation - Floating Tablet/Console for Mobile, Sidebar for Desktop */}
      <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-sm h-16 md:h-screen md:w-20 lg:w-24 md:static md:translate-x-0 md:left-0 md:max-w-none bg-slate-900/60 console-blur border border-white/10 md:border-none rounded-3xl md:rounded-none flex md:flex-col items-center justify-around md:justify-start gap-0 md:gap-8 z-50 floating-nav md:py-8">
          <div className="hidden md:flex w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 items-center justify-center font-space font-bold text-white text-lg mb-8 shadow-lg">C</div>
          
          <button onClick={() => setMainView('DASHBOARD')} className={`flex flex-col items-center gap-1 p-3 transition-all ${mainView === 'DASHBOARD' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
            <span className="text-[6px] font-black uppercase tracking-[0.2em] md:hidden">Sincronia</span>
          </button>
          
          <button onClick={() => setMainView('EVOLUTION')} className={`flex flex-col items-center gap-1 p-3 transition-all ${mainView === 'EVOLUTION' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            <span className="text-[6px] font-black uppercase tracking-[0.2em] md:hidden">Cosmos</span>
          </button>
          
          <button onClick={() => setMainView('STATISTICS')} className={`flex flex-col items-center gap-1 p-3 transition-all ${mainView === 'STATISTICS' ? 'text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            <span className="text-[6px] font-black uppercase tracking-[0.2em] md:hidden">Arquivo</span>
          </button>
      </nav>

      <main className="flex-1 overflow-y-auto px-5 py-8 md:px-16 lg:px-24 custom-scrollbar pb-32 md:pb-8 pt-safe">
        
        {mainView === 'DASHBOARD' && (
          <div className="max-w-4xl mx-auto space-y-10 md:space-y-12 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-2 md:gap-4 border-b border-white/5 pb-6">
              <div className="space-y-1">
                <h1 className="text-3xl md:text-5xl font-space font-bold tracking-tighter text-white uppercase leading-none">Status Orbital</h1>
                <p className="text-[8px] md:text-[9px] tracking-[0.5em] text-slate-500 font-bold uppercase italic opacity-60">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              {activeSubTab === 'ROUTINE' && (
                <button onClick={resetAllRoutines} className="w-full md:w-auto text-[8px] font-black text-cyan-400 border border-cyan-400/20 px-6 py-3 rounded-2xl uppercase tracking-[0.3em] bg-cyan-400/5 active:scale-95 transition-all">Reiniciar Órbita</button>
              )}
            </header>

            {/* Segmented Control - Futuro Style */}
            <div className="bg-white/[0.03] p-1 rounded-2xl border border-white/5 flex gap-1">
              {['DAILY', 'ROUTINE'].map(t => (
                <button 
                  key={t} 
                  onClick={() => setActiveSubTab(t as any)} 
                  className={`flex-1 py-3 rounded-xl text-[10px] md:text-[12px] font-space font-bold tracking-[0.2em] uppercase transition-all duration-300 relative ${activeSubTab === t ? 'bg-indigo-500/20 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}`}
                >
                  {t === 'DAILY' ? 'Singularidades' : 'Ciclos Orbitais'}
                </button>
              ))}
            </div>

            {/* Input Terminal */}
            <form onSubmit={addTask} className="space-y-6 bg-indigo-500/[0.02] p-6 rounded-[2rem] border border-indigo-500/10 shadow-inner">
              <div className="relative">
                <input type="text" placeholder="Injetar novos dados no sistema..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="w-full h-12 md:h-16 bg-transparent border-b border-indigo-500/20 text-lg md:text-2xl text-white outline-none focus:border-indigo-400 transition-all placeholder:text-slate-700 font-space" />
                <button type="submit" className="absolute right-0 bottom-2 text-indigo-400 text-[10px] font-black tracking-widest uppercase">+ ADD</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-[0.4em]">Protocolos Secundários</span>
                  <div className="flex gap-2">
                      <input type="text" placeholder="Novo módulo..." value={newTaskStepInput} onChange={e => setNewTaskStepInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStepToNewTask())} className="flex-1 bg-white/5 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 ring-indigo-500 border border-white/5" />
                      <button type="button" onClick={addStepToNewTask} className="px-5 bg-indigo-500/20 text-indigo-400 rounded-xl text-lg">+</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      {newTaskSteps.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 bg-indigo-500/5 px-3 py-1.5 rounded-lg border border-indigo-500/10">
                          <span className="text-[8px] text-indigo-300/70 font-bold uppercase">{s}</span>
                          <button type="button" onClick={() => removeStepFromNewTask(i)} className="text-red-500/50 text-xs">&times;</button>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-[0.4em]">Tipo de Carga</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setNewTaskCategory('WORK')} className={`flex-1 py-4 rounded-xl text-[9px] font-bold uppercase border transition-all ${newTaskCategory === 'WORK' ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 shadow-md' : 'bg-white/5 border-white/5 text-slate-600'}`}>Executivo</button>
                    <button type="button" onClick={() => setNewTaskCategory('LEISURE')} className={`flex-1 py-4 rounded-xl text-[9px] font-bold uppercase border transition-all ${newTaskCategory === 'LEISURE' ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 shadow-md' : 'bg-white/5 border-white/5 text-slate-600'}`}>Lúdico</button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-[8px] md:text-[9px] font-black tracking-[0.3em] uppercase text-slate-600 pt-4 border-t border-white/5">
                <div className="flex gap-4">
                  {[1, 2, 3].map(p => (
                    <button key={p} type="button" onClick={() => setNewTaskPriority(p as any)} className={`transition-all ${newTaskPriority === p ? priorityText[p as PriorityLevel] : 'hover:text-slate-400'}`}>{priorityLabels[p as PriorityLevel]}</button>
                  ))}
                </div>
                <div className="flex-1" />
                <select value={selectedPeriodForAdd} onChange={e => setSelectedPeriodForAdd(e.target.value)} className="bg-transparent text-indigo-400 outline-none cursor-pointer border-b border-indigo-500/20 pb-1">
                  {PERIODS.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                </select>
              </div>
            </form>

            {/* List of Tasks - Hologram Style */}
            <div className="space-y-12 pb-20">
              {PERIODS.map(period => {
                const filteredTasks = tasks.filter(t => t.type === activeSubTab && t.periodId === period.id);
                const pending = filteredTasks.filter(t => t.status === 'PENDING').sort((a,b) => (a.priority || 2) - (b.priority || 2));
                const completed = filteredTasks.filter(t => t.status !== 'PENDING');
                if (filteredTasks.length === 0) return null;
                return (
                  <section key={period.id} className="space-y-4">
                    <h2 className="text-[9px] tracking-[0.6em] text-indigo-500/50 font-black uppercase flex items-center gap-4">
                      {period.name} <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/20 to-transparent" />
                    </h2>
                    <div className="space-y-3">
                      {pending.map(task => (
                        <div key={task.id} className="hologram-card rounded-2xl overflow-hidden transition-all duration-300 active:scale-[0.98]">
                          <div className="flex items-center gap-4 py-5 px-5">
                            <div className={`w-1 h-8 rounded-full ${priorityColors[task.priority || 2]} shadow-[0_0_10px_currentColor]`} />
                            <div className="flex-1 min-w-0" onClick={() => setExpandedTasks(p => ({...p, [task.id]: !p[task.id]}))}>
                                <h3 className="text-base font-space font-medium text-slate-200 truncate">{task.title}</h3>
                                <div className="flex gap-2 items-center mt-1">
                                  <span className={`text-[7px] font-black uppercase tracking-widest ${priorityText[task.priority || 2]}`}>{priorityLabels[task.priority || 2]}</span>
                                  <div className="w-1 h-1 rounded-full bg-slate-800" />
                                  <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">
                                    {task.steps?.filter(s => s.completed).length}/{task.steps?.length} Módulos
                                  </span>
                                </div>
                            </div>
                            <button onClick={() => toggleTaskTimer(task.id)} className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${task.category === 'LEISURE' ? 'bg-amber-500/10 text-amber-500' : 'bg-indigo-500/10 text-indigo-400'} border border-white/5`}>
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </button>
                          </div>
                          {expandedTasks[task.id] && (
                            <div className="px-5 pb-6 pt-4 space-y-6 animate-in slide-in-from-top-2 duration-300 border-t border-white/5">
                               <div className="space-y-3">
                                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-[0.4em] block">Status de Prioridade</span>
                                  <div className="flex gap-2">
                                    {[1, 2, 3].map(p => (
                                      <button 
                                        key={p} 
                                        onClick={(e) => { e.stopPropagation(); updateTask(task.id, { priority: p as PriorityLevel }); }}
                                        className={`flex-1 py-2 rounded-xl text-[8px] font-black uppercase border transition-all ${task.priority === p ? `${priorityColors[p as PriorityLevel]} border-transparent text-white shadow-lg` : 'bg-white/5 border-white/5 text-slate-500'}`}
                                      >
                                        {priorityLabels[p as PriorityLevel]}
                                      </button>
                                    ))}
                                  </div>
                               </div>

                               <div className="space-y-3">
                                  <span className="text-[7px] font-black text-slate-600 uppercase tracking-[0.4em] block">Protocolos Secundários</span>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                     {task.steps?.map(step => (
                                       <div key={step.id} onClick={(e) => { e.stopPropagation(); toggleStep(task.id, step.id); }} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${step.completed ? 'bg-indigo-500/10 border-indigo-500/20 opacity-60' : 'bg-white/[0.02] border-white/5'}`}>
                                          <div className={`w-4 h-4 rounded border flex items-center justify-center ${step.completed ? 'bg-indigo-500 border-indigo-400' : 'border-white/20'}`}>{step.completed && <span className="text-[10px]">✓</span>}</div>
                                          <span className={`text-xs flex-1 ${step.completed ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{step.title}</span>
                                       </div>
                                     ))}
                                  </div>
                               </div>

                               <div className="flex gap-2">
                                  <button onClick={(e) => { e.stopPropagation(); handleTaskAction('COMPLETED', 0, task); }} className="flex-1 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em]">Finalizar Protocolo</button>
                                  <button onClick={(e) => { e.stopPropagation(); updateTask(task.id, { category: task.category === 'WORK' ? 'LEISURE' : 'WORK' }) }} className="p-3 rounded-xl bg-white/5 border border-white/5 text-slate-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg></button>
                                  <button onClick={(e) => { e.stopPropagation(); if(confirm("Apagar permanentemente?")) setTasks(prev => prev.filter(t => t.id !== task.id)) }} className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                               </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {completed.map(task => (
                        <div key={task.id} className="flex flex-row items-center gap-4 py-3 px-5 rounded-xl border border-white/5 bg-slate-950/20 opacity-30">
                           <div className="w-1 h-3 rounded-full bg-emerald-500/50" />
                           <span className="text-xs font-space line-through text-slate-600 flex-1 truncate">{task.title}</span>
                           <button onClick={() => restoreTask(task.id)} className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Reativar</button>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {mainView === 'STATISTICS' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in slide-in-from-bottom-5 duration-700">
            <header className="border-b border-white/5 pb-6">
              <h1 className="text-3xl md:text-5xl font-space font-bold tracking-tighter text-white uppercase leading-none">Arquivo de Dados</h1>
              <div className="flex gap-2 mt-6">
                <button onClick={exportData} className="flex-1 py-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[9px] font-black uppercase tracking-[0.2em]">Exportar Backup</button>
                <button onClick={() => fileInputRef.current?.click()} className="flex-1 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em]">Importar</button>
              </div>
            </header>
            
            <div className="hologram-card rounded-[2.5rem] p-8 space-y-8">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-indigo-400 uppercase tracking-[0.4em]">Nível de Evolução</span>
                  <h2 className="text-3xl font-space font-bold text-white uppercase">{currentLevel.level} - {currentLevel.name}</h2>
                </div>
              </div>
              <div className="space-y-4">
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                  {nextLevel && (<div className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: `${Math.min(100, ((stats.xp - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100)}%` }} />)}
                </div>
                <div className="flex justify-between text-[8px] font-black text-slate-500 uppercase tracking-[0.3em]">
                  <span>{stats.xp} XP</span>
                  {nextLevel ? <span>Próximo nível em {nextLevel.xpRequired - stats.xp} XP</span> : <span>Nível Máximo</span>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="hologram-card p-6 rounded-3xl text-center space-y-1">
                  <span className="text-[7px] font-black text-indigo-400 uppercase tracking-[0.4em]">Sincronias</span>
                  <p className="text-3xl font-space font-bold text-white">{stats.completedCount || 0}</p>
               </div>
               <div className="hologram-card p-6 rounded-3xl text-center space-y-1">
                  <span className="text-[7px] font-black text-red-400 uppercase tracking-[0.4em]">Perdas</span>
                  <p className="text-3xl font-space font-bold text-white">{stats.gaveUpCount || 0}</p>
               </div>
            </div>

            <div className="space-y-4 pb-20">
               <h3 className="text-[9px] tracking-[0.6em] text-indigo-500/50 font-black uppercase flex items-center gap-4">Logs Recentes</h3>
               <div className="divide-y divide-white/5 bg-white/[0.01] rounded-2xl border border-white/5">
                  {stats.timeLogs?.slice(0, 8).map((log, idx) => (
                    <div key={idx} className="flex items-center justify-between p-5">
                      <div className="flex flex-col"><span className="text-xs font-bold text-slate-300 uppercase">{log.taskTitle}</span><span className="text-[7px] text-slate-600 font-bold uppercase">{new Date(log.timestamp).toLocaleString('pt-BR')}</span></div>
                      <span className="text-xs font-space font-bold text-indigo-400">+{formatSeconds(log.seconds)}</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {mainView === 'EVOLUTION' && (
          <div className="h-full flex flex-col items-center justify-center pb-24 space-y-8 pt-safe">
            <div className="w-full max-w-5xl aspect-square md:aspect-auto md:h-[500px] relative">
              <UniverseVisual level={stats.level} nebulaTheme={stats.nebulaTheme} />
              
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-slate-900/80 console-blur border border-white/10 p-3 rounded-2xl flex items-center gap-3 w-[80%] overflow-x-auto no-scrollbar">
                 {NEBULA_PRESETS.map(preset => (
                   <button key={preset.name} onClick={() => changeNebulaTheme(preset)} className={`w-8 h-8 rounded-full border-2 transition-all flex-shrink-0 ${stats.nebulaTheme?.name === preset.name ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-40'}`} style={{ background: `linear-gradient(45deg, ${preset.secondary}, ${preset.primary})` }} />
                 ))}
              </div>
            </div>
            <div className="max-w-md text-center space-y-4 px-6">
               <div className="space-y-1">
                 <span className="text-[8px] font-black text-indigo-400 tracking-[0.5em] uppercase">Era Atual</span>
                 <h2 className="text-2xl font-space font-bold text-white uppercase tracking-widest leading-tight">{currentLevel.storyEra}</h2>
               </div>
               <p className="text-[11px] md:text-sm text-slate-400 italic font-light leading-relaxed">{isLoadingNarrative ? 'Conectando ao núcleo de dados...' : narrative}</p>
            </div>
          </div>
        )}
      </main>

      {tasks.filter(t => activeTaskIds.includes(t.id)).map((task, index) => (
        <TimerModal key={task.id} task={task} stackIndex={index} onUpdateTask={(updates) => updateTask(task.id, updates)} onClose={() => setActiveTaskIds(prev => prev.filter(id => id !== task.id))} onComplete={(status, seconds) => handleTaskAction(status as any, seconds, task)} onToggleStep={(stepId) => toggleStep(task.id, stepId)} onReward={(xp) => updateStats(xp, 'TIME_REWARD', 0, task)} />
      ))}
    </div>
  );
};

export default App;
