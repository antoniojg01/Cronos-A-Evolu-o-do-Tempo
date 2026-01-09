
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, UserStats, TimeLog, Period, TaskStep, PriorityLevel, CompletionMode, TaskCategory, LevelInfo } from './types.ts';
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
    const d = { xp: 0, level: 1, completedCount: 0, gaveUpCount: 0, ignoredCount: 0, timeLogs: [] };
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
    if ((window as any).hideAppLoader) (window as any).hideAppLoader();
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
    // Clear the input so the same file can be uploaded again
    e.target.value = '';
  };

  const playAscensionSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const playTone = (freq: number, time: number, dur: number, vol = 0.3) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);
        g.gain.setValueAtTime(0, time);
        g.gain.linearRampToValueAtTime(vol, time + 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, time + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(time);
        osc.stop(time + dur);
      };
      const now = ctx.currentTime;
      playTone(261.63, now, 0.8, 0.2); 
      playTone(329.63, now + 0.15, 0.8, 0.2); 
      playTone(392.00, now + 0.3, 0.8, 0.2); 
      playTone(523.25, now + 0.45, 1.5, 0.4); 
      playTone(659.25, now + 0.6, 2.0, 0.2); 
    } catch(e) {}
  };

  const updateStats = (xpChange: number, status: string, secondsSpent: number = 0, specificTask?: Task) => {
    setStats(prev => {
      let newXp = Math.max(0, (prev.xp || 0) + xpChange);
      const levelFound = LEVELS.filter(l => l.xpRequired <= newXp).pop();
      let newLevel = levelFound ? levelFound.level : 1;
      
      if (newLevel > prev.level) {
        setLevelUpData(levelFound || null);
        playAscensionSound();
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

  const priorityLabels = { 1: "ALTA", 2: "MÉDIA", 3: "BAIXA" };
  const priorityColors = { 1: "bg-red-500", 2: "bg-indigo-500", 3: "bg-slate-700" };
  const priorityText = { 1: "text-red-400", 2: "text-indigo-400", 3: "text-slate-500" };

  return (
    <div className="h-[100dvh] w-full flex flex-col md:flex-row bg-[#020617] text-slate-200 overflow-hidden font-inter">
      {/* Hidden File Input for Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImport} 
        accept=".json" 
        className="hidden" 
      />

      {/* Enhanced Level Up Ascension Modal */}
      {levelUpData && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-6 bg-slate-950/95 backdrop-blur-3xl animate-in fade-in zoom-in duration-500 overflow-hidden">
          {/* Cosmic Background FX */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/20 blur-[120px] rounded-full animate-pulse"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-purple-500/20 blur-[100px] rounded-full animate-ping duration-[3000ms]"></div>
          </div>

          <div className="max-w-xl w-full text-center space-y-10 relative z-10 animate-in slide-in-from-bottom-20 duration-1000">
            <div className="space-y-4">
              <span className="text-[12px] font-black text-indigo-400 tracking-[1em] uppercase block animate-bounce">Ascensão de Nível</span>
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-white/20 blur-2xl animate-pulse"></div>
                <div className="text-[180px] md:text-[220px] font-space font-bold text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-indigo-800 leading-none filter drop-shadow-[0_0_30px_rgba(255,255,255,0.4)]">
                  {levelUpData.level}
                </div>
              </div>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-4xl md:text-5xl font-space font-bold text-white uppercase tracking-tight leading-none">
                  {levelUpData.name}
                </h2>
                <div className="h-0.5 w-32 bg-gradient-to-r from-transparent via-indigo-500 to-transparent mx-auto"></div>
              </div>
              
              <div className="space-y-4 px-4">
                <p className="text-slate-200 text-lg md:text-xl font-light italic leading-relaxed font-space max-w-md mx-auto">
                  "{ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)]}"
                </p>
                <div className="flex items-center justify-center gap-4">
                  <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-3 rounded-full shadow-2xl">
                    <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest block mb-1">Era Desbloqueada</span>
                    <span className="text-sm text-white font-space font-bold uppercase">{levelUpData.storyEra}</span>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => { setLevelUpData(null); setMainView('EVOLUTION'); }}
              className="group relative w-full max-w-sm mx-auto h-20 bg-white hover:bg-indigo-50 text-slate-950 rounded-[2.5rem] font-space font-bold uppercase tracking-[0.2em] transition-all transform hover:scale-[1.03] active:scale-[0.97] shadow-[0_20px_50px_rgba(255,255,255,0.15)] overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 via-indigo-500/20 to-indigo-500/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              Continuar a Evolução
            </button>
            
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest opacity-50">Sua jornada pelo tempo está apenas começando.</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="w-full md:w-20 lg:w-24 bg-slate-900/40 border-b md:border-b-0 md:border-r border-white/5 flex md:flex-col items-center py-3 md:py-8 justify-around md:justify-start gap-4 md:gap-8 z-50 pt-safe">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center font-space font-bold text-white text-lg md:mb-8 shadow-lg">C</div>
          <button onClick={() => setMainView('DASHBOARD')} className={`p-3 rounded-2xl transition-all ${mainView === 'DASHBOARD' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`} title="Dashboard"><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg></button>
          <button onClick={() => setMainView('EVOLUTION')} className={`p-3 rounded-2xl transition-all ${mainView === 'EVOLUTION' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`} title="Evolução"><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></button>
          <button onClick={() => setMainView('STATISTICS')} className={`p-3 rounded-2xl transition-all ${mainView === 'STATISTICS' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`} title="Estatísticas"><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
      </nav>

      <main className="flex-1 overflow-y-auto px-5 py-8 md:px-16 lg:px-24 custom-scrollbar px-safe pb-safe">
        
        {mainView === 'DASHBOARD' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-8">
              <div>
                <h1 className="text-3xl md:text-5xl font-space font-bold tracking-tighter text-white uppercase">Sincronia Global</h1>
                <p className="text-[9px] tracking-[0.4em] text-slate-500 font-bold uppercase mt-1 italic">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              {activeSubTab === 'ROUTINE' && (
                <button onClick={resetAllRoutines} className="text-[8px] font-bold text-cyan-400 hover:text-cyan-300 border border-cyan-400/30 px-4 py-2 rounded-xl uppercase tracking-[0.3em] bg-cyan-400/5 shadow-sm active:scale-95 transition-all">Reiniciar Ciclo</button>
              )}
            </header>

            <div className="flex gap-6 border-b border-white/5 pb-2">
              {['DAILY', 'ROUTINE'].map(t => (
                <button key={t} onClick={() => setActiveSubTab(t as any)} className={`pb-4 text-[10px] md:text-[11px] font-bold tracking-[0.2em] uppercase transition-all relative ${activeSubTab === t ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}>
                  {t === 'DAILY' ? 'Objetivos' : 'Rotinas Diárias'}
                  {activeSubTab === t && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
                </button>
              ))}
            </div>

            <form onSubmit={addTask} className="space-y-6 bg-white/[0.01] p-6 rounded-3xl border border-white/5">
              <div className="relative group">
                <input type="text" placeholder={`Injetar novo ${activeSubTab === 'DAILY' ? 'objetivo' : 'protocolo'}...`} value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="w-full h-14 md:h-16 bg-transparent border-b border-white/10 text-lg md:text-2xl text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-800 font-space" />
                <button type="submit" className="absolute right-0 bottom-4 text-slate-700 hover:text-indigo-400 text-[10px] font-bold tracking-widest uppercase transition-colors">ADD +</button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Passos do Protocolo</span>
                  <div className="flex gap-2">
                      <input type="text" placeholder="Adicionar passo..." value={newTaskStepInput} onChange={e => setNewTaskStepInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addStepToNewTask())} className="flex-1 bg-white/5 rounded-xl px-4 py-2 text-xs outline-none focus:ring-1 ring-indigo-500 border border-white/5" />
                      <button type="button" onClick={addStepToNewTask} className="px-4 bg-indigo-500/10 text-indigo-400 rounded-xl text-[10px] font-bold uppercase">+</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      {newTaskSteps.map((s, i) => (
                        <div key={i} className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/10">
                          <span className="text-[9px] text-slate-300">{s}</span>
                          <button type="button" onClick={() => removeStepFromNewTask(i)} className="text-red-500/50 hover:text-red-500 text-xs">&times;</button>
                        </div>
                      ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Categoria de Foco</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setNewTaskCategory('WORK')} className={`flex-1 py-3 rounded-2xl text-[9px] font-bold uppercase border transition-all ${newTaskCategory === 'WORK' ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-lg shadow-indigo-500/10' : 'bg-white/5 border-white/5 text-slate-600 hover:text-slate-400'}`}>💼 Trabalho</button>
                    <button type="button" onClick={() => setNewTaskCategory('LEISURE')} className={`flex-1 py-3 rounded-2xl text-[9px] font-bold uppercase border transition-all ${newTaskCategory === 'LEISURE' ? 'bg-amber-500/10 border-amber-500 text-amber-500 shadow-lg shadow-amber-500/10' : 'bg-white/5 border-white/5 text-slate-600 hover:text-slate-400'}`}>🎮 Lazer</button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[8px] md:text-[9px] font-bold tracking-widest uppercase text-slate-600 border-t border-white/5 pt-4">
                <div className="flex gap-2">
                  {[1, 2, 3].map(p => (
                    <button key={p} type="button" onClick={() => setNewTaskPriority(p as any)} className={`transition-colors ${newTaskPriority === p ? priorityText[p as PriorityLevel] : 'hover:text-slate-400'}`}>{priorityLabels[p as PriorityLevel]}</button>
                  ))}
                </div>
                <div className="w-[1px] h-3 bg-white/10" />
                <select value={selectedPeriodForAdd} onChange={e => setSelectedPeriodForAdd(e.target.value)} className="bg-transparent text-indigo-400 outline-none cursor-pointer">
                  {PERIODS.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                </select>
                <div className="w-[1px] h-3 bg-white/10" />
                <button type="button" onClick={() => setNewTaskRequiresInput(!newTaskRequiresInput)} className={`transition-all ${newTaskRequiresInput ? 'text-indigo-400' : 'hover:text-slate-400'}`}>
                  {newTaskRequiresInput ? '📝 Notas ON' : '📝 Notas OFF'}
                </button>
              </div>
            </form>

            <div className="space-y-16 pb-20">
              {PERIODS.map(period => {
                const filteredTasks = tasks.filter(t => t.type === activeSubTab && t.periodId === period.id);
                const pending = filteredTasks.filter(t => t.status === 'PENDING').sort((a,b) => (a.priority || 2) - (b.priority || 2));
                const completed = filteredTasks.filter(t => t.status !== 'PENDING');
                
                if (filteredTasks.length === 0) return null;

                return (
                  <section key={period.id} className="space-y-6">
                    <h2 className="text-[9px] tracking-[0.6em] text-slate-700 font-bold uppercase border-l-2 border-indigo-500/20 pl-4 mb-8">{period.name} <span className="opacity-30 ml-2">/ {pending.length} pendentes</span></h2>
                    
                    <div className="space-y-[1px] rounded-3xl overflow-hidden border border-white/5">
                      {pending.map(task => (
                        <div key={task.id} className="group bg-white/[0.02] hover:bg-white/[0.04] transition-all border-l-2 border-transparent hover:border-indigo-500">
                          <div className="flex flex-row items-center gap-4 py-4 px-4 md:px-6">
                            <div className={`w-1 h-6 rounded-full flex-shrink-0 ${priorityColors[task.priority || 2]}`} />
                            <div className="flex-1 cursor-pointer min-w-0" onClick={() => setExpandedTasks(p => ({...p, [task.id]: !p[task.id]}))}>
                              <div className="flex items-center gap-2 mb-0.5">
                                <h3 className="text-base md:text-lg font-space font-medium text-slate-300 group-hover:text-white transition-colors truncate">{task.title}</h3>
                                {task.category === 'LEISURE' ? (
                                  <span className="text-[7px] font-bold text-amber-500/70 border border-amber-500/20 px-1.5 rounded-sm uppercase tracking-tighter">Lazer</span>
                                ) : (
                                  <span className="text-[7px] font-bold text-indigo-400/70 border border-indigo-400/20 px-1.5 rounded-sm uppercase tracking-tighter">Trabalho</span>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-[7px] md:text-[8px] font-bold uppercase tracking-widest ${priorityText[task.priority || 2]}`}>{priorityLabels[task.priority || 2]}</span>
                                {task.steps && task.steps.length > 0 && (
                                  <span className="text-[7px] text-slate-500 uppercase tracking-widest border border-white/5 px-1.5 rounded-sm">
                                    {task.steps.filter(s => s.completed).length}/{task.steps.length} Etapas
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => toggleTaskTimer(task.id)} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all shadow-sm active:scale-95 ${task.category === 'LEISURE' ? 'bg-amber-500/10 border border-amber-500/20 text-amber-500 hover:bg-amber-500 hover:text-white' : 'bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white'}`}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </button>
                              <div className="flex flex-col gap-1">
                                <button onClick={() => handleTaskAction('CYCLE_FINISHED', 0, task)} title="Concluir Ciclo" className="w-7 h-7 rounded-lg border border-white/5 flex items-center justify-center text-slate-600 hover:text-indigo-400 transition-colors">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                </button>
                                <button onClick={() => handleTaskAction('COMPLETED', 0, task)} title="Finalizar Totalmente" className="w-7 h-7 rounded-lg border border-white/5 flex items-center justify-center text-slate-600 hover:text-emerald-400 transition-colors">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7m-14 4l4 4L19 7" /></svg>
                                </button>
                              </div>
                            </div>
                          </div>

                          {expandedTasks[task.id] && (
                            <div className="px-6 md:px-16 pb-8 space-y-8 animate-in slide-in-from-top-1 duration-300">
                              <div className="space-y-4">
                                 <span className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.3em] block">Protocolo Detalhado</span>
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {task.steps?.map(step => (
                                      <div key={step.id} className="flex items-center gap-3 bg-white/[0.01] border border-white/5 p-3 rounded-xl hover:border-indigo-500/30 transition-all">
                                         <button onClick={() => toggleStep(task.id, step.id)} className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${step.completed ? 'bg-indigo-500 border-indigo-400' : 'border-white/10 hover:border-indigo-400'}`}>
                                            {step.completed && <span className="text-[10px]">✓</span>}
                                         </button>
                                         <span className={`text-xs flex-1 ${step.completed ? 'text-slate-600 line-through' : 'text-slate-300'}`}>{step.title}</span>
                                         <button onClick={() => updateTask(task.id, { steps: task.steps?.filter(s => s.id !== step.id) })} className="text-red-500/30 hover:text-red-500 transition-colors">&times;</button>
                                      </div>
                                    ))}
                                    <div className="flex items-center gap-2 p-1 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
                                       <input type="text" placeholder="Novo passo..." onKeyDown={e => e.key === 'Enter' && (addStepToExistingTask(task.id, e.currentTarget.value), e.currentTarget.value = '')} className="flex-1 bg-transparent px-3 py-1 text-xs outline-none" />
                                    </div>
                                 </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/[0.01] p-6 rounded-2xl border border-white/5">
                                <div className="space-y-4">
                                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest block">Sincronia Temporal</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {PERIODS.map(p => (
                                      <button key={p.id} onClick={() => updateTask(task.id, { periodId: p.id })} className={`px-2.5 py-1.5 rounded-lg text-[8px] font-bold border transition-all ${task.periodId === p.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/5 text-slate-600 hover:border-white/20'}`}>{p.name}</button>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-4">
                                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest block">Ações do Sistema</span>
                                  <div className="flex gap-2">
                                    <button onClick={() => updateTask(task.id, { category: task.category === 'WORK' ? 'LEISURE' : 'WORK' })} className="flex-1 py-1.5 rounded-lg text-[8px] font-bold border border-white/5 text-slate-400 hover:text-white transition-all uppercase tracking-widest">Alternar Tipo</button>
                                    <button onClick={() => { if(confirm("Apagar permanentemente?")) setTasks(prev => prev.filter(t => t.id !== task.id)) }} className="flex-1 py-1.5 rounded-lg text-[8px] font-bold border border-red-500/20 text-red-500/50 hover:text-red-500 transition-all uppercase tracking-widest">Excluir</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {completed.map(task => (
                        <div key={task.id} className="flex flex-row items-center gap-4 py-4 px-4 border-b border-white/5 bg-slate-950/20 opacity-40 hover:opacity-100 transition-all">
                           <div className={`w-1 h-3 rounded-full flex-shrink-0 ${task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                           <div className="flex-1 min-w-0">
                             <span className="text-xs font-space line-through text-slate-600 truncate block">{task.title}</span>
                           </div>
                           <button onClick={() => restoreTask(task.id)} className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest hover:text-white transition-colors">Refazer</button>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {/* STATISTICS and EVOLUTION sections */}
        {mainView === 'STATISTICS' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-bottom-5 duration-700">
            <header className="border-b border-white/5 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div className="flex-1">
                <h1 className="text-3xl md:text-5xl font-space font-bold tracking-tighter text-white uppercase">Relatório Galáctico</h1>
                <p className="text-[9px] tracking-[0.4em] text-slate-500 font-bold uppercase mt-1 italic">Métricas de Sincronização do Guardião</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={exportData} 
                  className="flex items-center gap-2 text-[8px] font-bold text-indigo-400 hover:text-white border border-indigo-400/20 px-4 py-2 rounded-xl uppercase tracking-[0.2em] transition-all bg-indigo-400/5 hover:bg-indigo-400/20"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Exportar
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  className="flex items-center gap-2 text-[8px] font-bold text-emerald-400 hover:text-white border border-emerald-400/20 px-4 py-2 rounded-xl uppercase tracking-[0.2em] transition-all bg-emerald-400/5 hover:bg-emerald-400/20"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                  Importar
                </button>
                <button 
                  onClick={() => { if(confirm("Deseja apagar TODO o seu progresso?")) { setStats({ xp: 0, level: 1, completedCount: 0, gaveUpCount: 0, ignoredCount: 0, timeLogs: [] }); setTasks([]); } }} 
                  className="text-[8px] font-bold text-red-500/50 hover:text-red-500 border border-red-500/20 px-4 py-2 rounded-xl uppercase tracking-[0.3em] transition-all bg-red-500/5 hover:bg-red-500/10"
                >
                  Resetar Tudo
                </button>
              </div>
            </header>

            <div className="bg-white/[0.02] border border-white/5 rounded-[2.5rem] p-8 md:p-10 space-y-6">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-[0.3em]">Nível Atual</span>
                  <h2 className="text-4xl font-space font-bold text-white uppercase">{currentLevel.level} - {currentLevel.name}</h2>
                </div>
                <div className="text-right">
                   <span className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em]">Total de Experiência</span>
                   <p className="text-xl font-space font-bold text-white">{stats.xp} XP</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden">
                   {nextLevel && (
                     <div 
                       className="h-full bg-gradient-to-r from-indigo-600 to-purple-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-1000 ease-out"
                       style={{ width: `${Math.min(100, ((stats.xp - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100)}%` }}
                     />
                   )}
                </div>
                <div className="flex justify-between text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                   <span>{currentLevel.xpRequired} XP</span>
                   {nextLevel ? <span>Faltam {nextLevel.xpRequired - stats.xp} XP para {nextLevel.name}</span> : <span>Nível Máximo</span>}
                   <span>{nextLevel?.xpRequired} XP</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/[0.01] border border-white/5 p-8 rounded-[2rem] space-y-2">
                 <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest block">Missões Concluídas</span>
                 <p className="text-4xl font-space font-bold text-white">{stats.completedCount || 0}</p>
                 <p className="text-[10px] text-slate-500 uppercase font-medium">Arquivos sincronizados</p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 p-8 rounded-[2rem] space-y-2">
                 <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block">Tempo de Foco Total</span>
                 <p className="text-2xl font-space font-bold text-white truncate">
                   {formatSeconds(stats.timeLogs?.reduce((acc, log) => acc + log.seconds, 0) || 0)}
                 </p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 p-8 rounded-[2rem] space-y-2">
                 <span className="text-[8px] font-bold text-red-400 uppercase tracking-widest block">Protocolos Perdidos</span>
                 <p className="text-4xl font-space font-bold text-white">{stats.gaveUpCount || 0}</p>
              </div>
            </div>

            <div className="space-y-6 pb-20">
               <h2 className="text-[9px] tracking-[0.6em] text-slate-700 font-bold uppercase border-l-2 border-indigo-500/20 pl-4">Logs Recentes</h2>
               <div className="bg-white/[0.01] border border-white/5 rounded-[2rem] overflow-hidden divide-y divide-white/5">
                  {stats.timeLogs?.slice(0, 15).map((log, idx) => (
                    <div key={idx} className="flex items-center justify-between p-6 hover:bg-white/[0.02]">
                      <div className="flex flex-col">
                        <span className="text-xs font-space font-bold text-white uppercase">{log.taskTitle}</span>
                        <span className="text-[8px] text-slate-600 font-bold uppercase">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-indigo-400">+{formatSeconds(log.seconds)}</span>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        )}

        {mainView === 'EVOLUTION' && (
          <div className="h-full flex flex-col items-center justify-center pb-20">
            <div className="w-full max-w-5xl h-[300px] md:h-[500px]"><UniverseVisual level={stats.level} /></div>
            <div className="mt-10 max-w-xl text-center space-y-3 px-4">
               <h2 className="text-2xl font-space font-bold text-white uppercase tracking-widest">{currentLevel.name}</h2>
               <p className="text-xs md:text-sm text-slate-400 italic font-light leading-relaxed">{isLoadingNarrative ? 'Conectando ao Oráculo...' : narrative}</p>
            </div>
          </div>
        )}
      </main>

      {tasks.filter(t => activeTaskIds.includes(t.id)).map((task, index) => (
        <TimerModal 
          key={task.id}
          task={task} 
          stackIndex={index}
          onUpdateTask={(updates) => updateTask(task.id, updates)}
          onClose={() => setActiveTaskIds(prev => prev.filter(id => id !== task.id))} 
          onComplete={(status, seconds) => handleTaskAction(status as any, seconds, task)} 
          onToggleStep={(stepId) => toggleStep(task.id, stepId)}
          onReward={(xp) => updateStats(xp, 'TIME_REWARD', 0, task)}
        />
      ))}
    </div>
  );
};

export default App;
