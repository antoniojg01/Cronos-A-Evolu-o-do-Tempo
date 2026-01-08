
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, UserStats, TimeLog, Period, TaskStep, PriorityLevel, CompletionMode } from './types.ts';
import { LEVELS, XP_COMPLETED, XP_GAVE_UP, XP_IGNORED, XP_STEP } from './constants.ts';
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

const App: React.FC = () => {
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
            completedAt: undefined
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
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>(2);
  const [newTaskRequiresInput, setNewTaskRequiresInput] = useState(false);
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
            return { ...t, status: 'PENDING', lastDone: undefined, completedAt: undefined, currentInput: '' };
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
  }, [mainView]);

  const loadNarrative = async () => {
    setIsLoadingNarrative(true);
    const text = await getLevelNarrative(currentLevel);
    setNarrative(text);
    setIsLoadingNarrative(false);
  };

  const updateStats = (xpChange: number, status: string, secondsSpent: number = 0, specificTask?: Task) => {
    setStats(prev => {
      let newXp = Math.max(0, (prev.xp || 0) + xpChange);
      const levelFound = LEVELS.filter(l => l.xpRequired <= newXp).pop();
      let newLevel = levelFound ? levelFound.level : 1;
      
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
      priority: newTaskPriority,
      completionMode: 'TIMER',
      requiresInput: newTaskRequiresInput,
      currentInput: '',
      status: 'PENDING', 
      createdAt: Date.now(),
      periodId: selectedPeriodForAdd,
      steps: []
    };
    setTasks(prev => [...prev, newTask]);
    setNewTaskTitle('');
  };

  const resetAllRoutines = () => {
    if(!confirm("Reiniciar todas as rotinas para hoje? (As concluídas voltarão a ficar pendentes)")) return;
    setTasks(prev => prev.map(t => 
      t.type === 'ROUTINE' 
        ? { 
            ...t, 
            status: 'PENDING', 
            currentInput: '', 
            lastDone: undefined, 
            completedAt: undefined 
          } 
        : t
    ));
  };

  const resetAllStats = () => {
    if(!confirm("Deseja apagar TODO o seu progresso? Isso não pode ser desfeito.")) return;
    setStats({ xp: 0, level: 1, completedCount: 0, gaveUpCount: 0, ignoredCount: 0, timeLogs: [] });
    setTasks([]);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleTaskAction = (status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED', seconds: number, taskOverride: Task) => {
    const xp = status === 'COMPLETED' ? XP_COMPLETED : status === 'GAVE_UP' ? XP_GAVE_UP : XP_IGNORED;
    updateStats(xp, status, seconds, taskOverride);
    setTasks(prev => prev.map(t => t.id === taskOverride.id ? { ...t, status, lastDone: Date.now(), completedAt: Date.now() } : t));
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
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'PENDING', lastDone: undefined, completedAt: undefined } : t));
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
      {/* Navigation */}
      <nav className="w-full md:w-20 lg:w-24 bg-slate-900/40 border-b md:border-b-0 md:border-r border-white/5 flex md:flex-col items-center py-3 md:py-8 justify-around md:justify-start gap-4 md:gap-8 z-50 pt-safe">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center font-space font-bold text-white text-lg md:mb-8 shadow-lg">C</div>
          <button onClick={() => setMainView('DASHBOARD')} className={`p-3 rounded-2xl transition-all ${mainView === 'DASHBOARD' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`} title="Dashboard"><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg></button>
          <button onClick={() => setMainView('EVOLUTION')} className={`p-3 rounded-2xl transition-all ${mainView === 'EVOLUTION' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`} title="Evolução"><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></button>
          <button onClick={() => setMainView('STATISTICS')} className={`p-3 rounded-2xl transition-all ${mainView === 'STATISTICS' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600 hover:text-slate-400'}`} title="Estatísticas"><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-5 py-8 md:px-16 lg:px-24 custom-scrollbar px-safe pb-safe">
        
        {/* DASHBOARD VIEW */}
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

            <form onSubmit={addTask} className="space-y-4 bg-white/[0.01] p-6 rounded-3xl border border-white/5">
              <div className="relative group">
                <input type="text" placeholder={`Injetar novo ${activeSubTab === 'DAILY' ? 'objetivo' : 'protocolo de rotina'}...`} value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="w-full h-14 md:h-16 bg-transparent border-b border-white/10 text-lg md:text-2xl text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-800 font-space" />
                <button type="submit" className="absolute right-0 bottom-4 text-slate-700 hover:text-indigo-400 text-[10px] font-bold tracking-widest uppercase transition-colors">ADD +</button>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-[8px] md:text-[9px] font-bold tracking-widest uppercase text-slate-600">
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
                              <h3 className="text-base md:text-lg font-space font-medium text-slate-300 group-hover:text-white transition-colors truncate">{task.title}</h3>
                              <div className="flex items-center gap-3 mt-1">
                                <span className={`text-[7px] md:text-[8px] font-bold uppercase tracking-widest ${priorityText[task.priority || 2]}`}>{priorityLabels[task.priority || 2]}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => toggleTaskTimer(task.id)} className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center hover:bg-indigo-500 hover:text-white transition-all shadow-sm active:scale-95">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </button>
                              <button onClick={() => handleTaskAction('COMPLETED', 0, task)} className="w-7 h-7 rounded-full border border-white/5 flex items-center justify-center text-slate-600 hover:text-emerald-400 transition-colors">✓</button>
                            </div>
                          </div>

                          {expandedTasks[task.id] && (
                            <div className="px-6 md:px-16 pb-8 space-y-6 animate-in slide-in-from-top-1 duration-300">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/[0.01] p-6 rounded-2xl border border-white/5">
                                <div className="space-y-2">
                                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest block">Sincronia Temporal</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {PERIODS.map(p => (
                                      <button key={p.id} onClick={() => updateTask(task.id, { periodId: p.id })} className={`px-2.5 py-1.5 rounded-lg text-[8px] font-bold border transition-all ${task.periodId === p.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/5 text-slate-600 hover:border-white/20'}`}>{p.name}</button>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest block">Gerenciar Protocolo</span>
                                  <button onClick={() => { if(confirm("Apagar permanentemente?")) setTasks(prev => prev.filter(t => t.id !== task.id)) }} className="w-full py-1.5 rounded-lg text-[8px] font-bold border border-red-500/20 text-red-500/50 hover:text-red-500 transition-all uppercase tracking-widest">Excluir Registro</button>
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

        {/* EVOLUTION VIEW */}
        {mainView === 'EVOLUTION' && (
          <div className="h-full flex flex-col items-center justify-center pb-20 animate-in fade-in duration-1000">
            <div className="w-full max-w-5xl h-[300px] md:h-[500px]"><UniverseVisual level={stats.level} /></div>
            <div className="mt-10 max-w-xl text-center space-y-3 px-4">
               <h2 className="text-2xl md:text-3xl font-space font-bold text-white uppercase tracking-widest">{currentLevel.name}</h2>
               <p className="text-xs md:text-sm text-slate-400 italic font-light leading-relaxed">{isLoadingNarrative ? 'Conectando ao Oráculo...' : narrative}</p>
            </div>
          </div>
        )}

        {/* STATISTICS VIEW */}
        {mainView === 'STATISTICS' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in slide-in-from-bottom-5 duration-700">
            <header className="border-b border-white/5 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
              <div>
                <h1 className="text-3xl md:text-5xl font-space font-bold tracking-tighter text-white uppercase">Relatório Galáctico</h1>
                <p className="text-[9px] tracking-[0.4em] text-slate-500 font-bold uppercase mt-1 italic">Métricas de Sincronização do Guardião</p>
              </div>
              <button onClick={resetAllStats} className="text-[8px] font-bold text-red-500/50 hover:text-red-500 border border-red-500/20 px-4 py-2 rounded-xl uppercase tracking-[0.3em] transition-all bg-red-500/5">Resetar Todo Progresso</button>
            </header>

            {/* Progresso de Nível */}
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
                   {nextLevel ? (
                     <span>Faltam {nextLevel.xpRequired - stats.xp} XP para {nextLevel.name}</span>
                   ) : (
                     <span>Nível Máximo Alcançado</span>
                   )}
                   <span>{nextLevel?.xpRequired} XP</span>
                </div>
              </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/[0.01] border border-white/5 p-8 rounded-[2rem] space-y-2">
                 <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest block">Missões Concluídas</span>
                 <p className="text-4xl font-space font-bold text-white">{stats.completedCount || 0}</p>
                 <p className="text-[10px] text-slate-500 uppercase font-medium">Arquivos sincronizados com sucesso</p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 p-8 rounded-[2rem] space-y-2">
                 <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block">Tempo de Foco Total</span>
                 <p className="text-2xl font-space font-bold text-white truncate">
                   {formatSeconds(stats.timeLogs?.reduce((acc, log) => acc + log.seconds, 0) || 0)}
                 </p>
                 <p className="text-[10px] text-slate-500 uppercase font-medium">Investimento real de energia</p>
              </div>
              <div className="bg-white/[0.01] border border-white/5 p-8 rounded-[2rem] space-y-2">
                 <span className="text-[8px] font-bold text-red-400 uppercase tracking-widest block">Protocolos Perdidos</span>
                 <p className="text-4xl font-space font-bold text-white">{stats.gaveUpCount || 0}</p>
                 <p className="text-[10px] text-slate-500 uppercase font-medium">Missões abortadas no ciclo</p>
              </div>
            </div>

            {/* Logs de Tempo */}
            <div className="space-y-6">
               <h2 className="text-[9px] tracking-[0.6em] text-slate-700 font-bold uppercase border-l-2 border-indigo-500/20 pl-4">Registro de Atividades Recentes</h2>
               <div className="bg-white/[0.01] border border-white/5 rounded-[2rem] overflow-hidden">
                  {stats.timeLogs && stats.timeLogs.length > 0 ? (
                    <div className="divide-y divide-white/5">
                      {stats.timeLogs.slice(0, 15).map((log, idx) => (
                        <div key={idx} className="flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors">
                          <div className="flex flex-col">
                            <span className="text-xs font-space font-bold text-white uppercase">{log.taskTitle}</span>
                            <span className="text-[8px] text-slate-600 font-bold uppercase tracking-widest">{new Date(log.timestamp).toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="text-right">
                             <span className="text-[10px] font-mono font-bold text-indigo-400">+{formatSeconds(log.seconds)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-20 text-center">
                       <p className="text-[10px] font-bold text-slate-700 uppercase tracking-[0.3em]">Nenhum log de tempo registrado nesta era.</p>
                    </div>
                  )}
               </div>
            </div>
            
            <div className="pb-20 text-center">
               <p className="text-[8px] text-slate-800 font-bold uppercase tracking-[0.5em] italic">Fim da Transmissão de Dados</p>
            </div>
          </div>
        )}
      </main>

      {/* Render Active Timer Modals */}
      {tasks.filter(t => activeTaskIds.includes(t.id)).map((task, index) => (
        <TimerModal 
          key={task.id}
          task={task} 
          stackIndex={index}
          onUpdateTask={(updates) => updateTask(task.id, updates)}
          onClose={() => setActiveTaskIds(prev => prev.filter(id => id !== task.id))} 
          onComplete={(status, seconds) => handleTaskAction(status, seconds, task)} 
        />
      ))}
    </div>
  );
};

export default App;
