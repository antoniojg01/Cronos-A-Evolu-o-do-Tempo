
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, UserStats, TimeLog, Period, TaskStep, PriorityLevel, CompletionMode } from './types.ts';
import { LEVELS, XP_COMPLETED, XP_GAVE_UP, XP_IGNORED, XP_STEP } from './constants.ts';
import { getLevelNarrative } from './services/geminiService.ts';
import TimerModal from './components/TimerModal.tsx';
import UniverseVisual from './components/UniverseVisual.tsx';

type MainView = 'DASHBOARD' | 'EVOLUTION' | 'STATISTICS';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('cronos_tasks');
      const loadedTasks: Task[] = saved ? JSON.parse(saved) : [];
      const today = new Date().toDateString();
      
      return loadedTasks.map(t => {
        const lastDate = t.lastDone ? new Date(t.lastDone).toDateString() : null;
        
        if (t.type === 'ROUTINE' && t.status !== 'PENDING' && lastDate !== today) {
          return { ...t, status: 'PENDING', currentInput: '', steps: t.steps?.map(s => ({ ...s, completed: false })) };
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

  const [periods] = useState<Period[]>([
    { id: 'p1', name: 'Manhã' }, 
    { id: 'p2', name: 'Tarde' }, 
    { id: 'p3', name: 'Noite' },
    { id: 'p4', name: '♾️ Constantes' }
  ]);

  const [mainView, setMainView] = useState<MainView>('DASHBOARD');
  const [narrative, setNarrative] = useState<string>('');
  const [isLoadingNarrative, setIsLoadingNarrative] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'DAILY' | 'ROUTINE'>('DAILY');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>(2);
  const [newTaskMode, setNewTaskMode] = useState<CompletionMode>('TIMER');
  const [newTaskRequiresInput, setNewTaskRequiresInput] = useState(false);
  const [selectedPeriodForAdd, setSelectedPeriodForAdd] = useState<string>('p1');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [quickStepInputs, setQuickStepInputs] = useState<Record<string, string>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const currentLevel = useMemo(() => LEVELS.find(l => l.level === stats.level) || LEVELS[0], [stats.level]);

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
      const nextLevel = LEVELS.find(l => l.xpRequired > newXp);
      let newLevel = nextLevel ? nextLevel.level - 1 : LEVELS[LEVELS.length - 1].level;
      newLevel = Math.max(1, newLevel);
      const logTask = specificTask || activeTask;
      const newLog = secondsSpent > 0 ? {
        timestamp: Date.now(),
        seconds: secondsSpent,
        taskId: logTask?.id || 'unknown',
        taskTitle: logTask?.title || 'Sincronia'
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
      id: crypto.randomUUID(), 
      title: newTaskTitle, 
      type: activeSubTab, 
      priority: newTaskPriority,
      completionMode: newTaskMode,
      requiresInput: newTaskRequiresInput,
      currentInput: '',
      status: 'PENDING', 
      createdAt: Date.now(),
      periodId: selectedPeriodForAdd,
      steps: []
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
    setNewTaskRequiresInput(false);
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
  };

  const handleTaskAction = (status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED', seconds: number, taskOverride?: Task) => {
    const targetTask = taskOverride || activeTask;
    if (!targetTask) return;
    const xp = status === 'COMPLETED' ? XP_COMPLETED : status === 'GAVE_UP' ? XP_GAVE_UP : XP_IGNORED;
    updateStats(xp, status, seconds, targetTask);
    setTasks(tasks.map(t => t.id === targetTask.id ? { ...t, status, lastDone: Date.now(), completedAt: Date.now() } : t));
    if (!taskOverride) setActiveTask(null);
  };

  const restoreTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const xpToDeduct = task.status === 'COMPLETED' ? XP_COMPLETED : task.status === 'GAVE_UP' ? XP_GAVE_UP : XP_IGNORED;
    updateStats(-xpToDeduct, 'RESTORED', 0, task);
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: 'PENDING' } : t));
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

  const toggleExpand = (id: string) => setExpandedTasks(prev => ({ ...prev, [id]: !prev[id] }));

  const priorityLabels = { 1: "ALTA", 2: "MÉDIA", 3: "BAIXA" };
  const priorityColors = { 1: "bg-red-500", 2: "bg-indigo-500", 3: "bg-slate-700" };
  const priorityText = { 1: "text-red-400", 2: "text-indigo-400", 3: "text-slate-500" };

  return (
    <div className="h-[100dvh] w-full flex flex-col md:flex-row bg-[#020617] text-slate-200 overflow-hidden font-inter">
      {/* Nav otimizada para mobile com pt-safe */}
      <nav className="w-full md:w-20 lg:w-24 bg-slate-900/40 border-b md:border-b-0 md:border-r border-white/5 flex md:flex-col items-center py-3 md:py-8 justify-around md:justify-start gap-4 md:gap-8 z-50 pt-safe">
          <div className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center font-space font-bold text-white text-lg md:mb-8">C</div>
          <button onClick={() => setMainView('DASHBOARD')} className={`p-3 rounded-2xl ${mainView === 'DASHBOARD' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600'}`}><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg></button>
          <button onClick={() => setMainView('EVOLUTION')} className={`p-3 rounded-2xl ${mainView === 'EVOLUTION' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600'}`}><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></button>
          <button onClick={() => setMainView('STATISTICS')} className={`p-3 rounded-2xl ${mainView === 'STATISTICS' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600'}`}><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
          <button onClick={() => setShowBackupModal(true)} className="p-3 text-slate-700 hover:text-indigo-400 md:mt-auto"><svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg></button>
      </nav>

      {/* Main content flex-1 garante que o scroll ocorra apenas aqui */}
      <main className="flex-1 overflow-y-auto px-5 py-8 md:px-16 lg:px-24 custom-scrollbar px-safe pb-safe">
        {mainView === 'DASHBOARD' && (
          <div className="max-w-4xl mx-auto space-y-12 md:space-y-16">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 border-b border-white/5 pb-8">
              <div>
                <h1 className="text-3xl md:text-5xl font-space font-bold tracking-tighter text-white uppercase">Sincronia Global</h1>
                <p className="text-[9px] tracking-[0.4em] text-slate-500 font-bold uppercase mt-1 italic">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
            </header>

            <div className="flex gap-6 md:gap-8 border-b border-white/5 pb-2 overflow-x-auto no-scrollbar">
              {['DAILY', 'ROUTINE'].map(t => (
                <button key={t} onClick={() => setActiveSubTab(t as any)} className={`pb-4 text-[10px] md:text-[11px] font-bold tracking-[0.2em] uppercase transition-all relative whitespace-nowrap ${activeSubTab === t ? 'text-white' : 'text-slate-600'}`}>
                  {t === 'DAILY' ? 'Objetivos' : 'Rotinas Diárias'}
                  {activeSubTab === t && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
                </button>
              ))}
            </div>

            <form onSubmit={addTask} className="space-y-4">
              <div className="relative group">
                <input type="text" placeholder="Injetar nova tarefa..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="w-full h-14 md:h-16 bg-transparent border-b border-white/10 text-lg md:text-2xl text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-800 font-space" />
                <button type="submit" className="absolute right-0 bottom-4 text-slate-700 hover:text-indigo-400 text-[10px] font-bold tracking-widest uppercase">ADD +</button>
              </div>
              <div className="flex flex-wrap items-center gap-3 md:gap-4 text-[8px] md:text-[9px] font-bold tracking-widest uppercase text-slate-600">
                <div className="flex gap-2">
                  {[1, 2, 3].map(p => (
                    <button key={p} type="button" onClick={() => setNewTaskPriority(p as any)} className={`transition-colors ${newTaskPriority === p ? priorityText[p as PriorityLevel] : 'hover:text-slate-400'}`}>{priorityLabels[p as PriorityLevel]}</button>
                  ))}
                </div>
                <div className="w-[1px] h-3 bg-white/10" />
                <select value={selectedPeriodForAdd} onChange={e => setSelectedPeriodForAdd(e.target.value)} className="bg-transparent text-indigo-400 outline-none cursor-pointer">
                  {periods.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                </select>
                <div className="w-[1px] h-3 bg-white/10" />
                <button type="button" onClick={() => setNewTaskRequiresInput(!newTaskRequiresInput)} className={`transition-all ${newTaskRequiresInput ? 'text-indigo-400' : 'text-slate-600'}`}>
                  {newTaskRequiresInput ? '📝 Notas ON' : '📝 Notas OFF'}
                </button>
              </div>
            </form>

            <div className="space-y-12 md:space-y-20 pb-10">
              {periods.map(period => {
                const filteredTasks = tasks.filter(t => t.type === activeSubTab && t.periodId === period.id);
                const pending = filteredTasks.filter(t => t.status === 'PENDING').sort((a,b) => (a.priority || 2) - (b.priority || 2));
                const completed = filteredTasks.filter(t => t.status !== 'PENDING');
                
                if (filteredTasks.length === 0) return null;

                return (
                  <section key={period.id} className="space-y-4 md:space-y-6">
                    <h2 className="text-[9px] tracking-[0.6em] text-slate-700 font-bold uppercase border-l-2 border-indigo-500/20 pl-4 mb-6 md:mb-8">{period.name} <span className="ml-3 opacity-30">{pending.length}</span></h2>
                    
                    <div className="space-y-[1px]">
                      {pending.map(task => (
                        <div key={task.id} className="group relative bg-white/[0.02] hover:bg-white/[0.04] transition-all border-l-2 border-transparent hover:border-indigo-500">
                          <div className="flex flex-row items-center gap-3 md:gap-4 py-4 md:py-5 px-4 md:px-6">
                            <div className={`w-1 h-5 md:h-6 rounded-full flex-shrink-0 ${priorityColors[task.priority || 2]}`} />
                            
                            <div className="flex-1 cursor-pointer min-w-0" onClick={() => toggleExpand(task.id)}>
                              <h3 className="text-base md:text-lg font-space font-medium text-slate-300 group-hover:text-white transition-colors flex items-center gap-2 truncate">
                                {task.title}
                                {task.requiresInput && <span className="text-[7px] px-1 py-0.5 rounded bg-white/5 text-slate-500 border border-white/10 flex-shrink-0">IN</span>}
                              </h3>
                              <div className="flex items-center gap-3 mt-1">
                                <span className={`text-[7px] md:text-[8px] font-bold uppercase tracking-widest ${priorityText[task.priority || 2]}`}>{priorityLabels[task.priority || 2]}</span>
                                {task.steps && task.steps.length > 0 && <span className="text-[7px] md:text-[8px] font-bold uppercase tracking-widest text-slate-600">{task.steps.filter(s => s.completed).length}/{task.steps.length} STPS</span>}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                              <button onClick={() => setActiveTask(task)} className="w-9 h-9 md:w-10 md:h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </button>
                              <button onClick={() => handleTaskAction('COMPLETED', 0, task)} className="w-7 h-7 md:w-8 md:h-8 rounded-full border border-white/5 flex items-center justify-center text-slate-600 hover:text-emerald-400">✓</button>
                              <button onClick={() => toggleExpand(task.id)} className={`w-7 h-7 md:w-8 md:h-8 text-slate-700 hover:text-white transition-all transform ${expandedTasks[task.id] ? 'rotate-180' : ''}`}>▼</button>
                            </div>
                          </div>

                          {expandedTasks[task.id] && (
                            <div className="px-6 md:px-16 pb-6 md:pb-8 space-y-6 md:space-y-8 animate-in slide-in-from-top-2">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 py-4 border-y border-white/5 bg-white/[0.01] px-4 md:px-6 rounded-xl">
                                <div className="space-y-2">
                                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest block">Prioridade</span>
                                  <div className="flex gap-1.5">
                                    {[1, 2, 3].map(p => (
                                      <button key={p} onClick={() => updateTask(task.id, { priority: p as PriorityLevel })} className={`flex-1 md:flex-none px-3 py-1.5 rounded-lg text-[8px] font-bold border ${task.priority === p ? `${priorityColors[p as PriorityLevel]} text-white border-transparent` : 'border-white/5 text-slate-600'}`}>{priorityLabels[p as PriorityLevel]}</button>
                                    ))}
                                  </div>
                                </div>
                                
                                <div className="space-y-2">
                                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest block">Período</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {periods.map(p => (
                                      <button key={p.id} onClick={() => updateTask(task.id, { periodId: p.id })} className={`px-2.5 py-1.5 rounded-lg text-[8px] font-bold border ${task.periodId === p.id ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/5 text-slate-600'}`}>{p.name}</button>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest block">Registro</span>
                                  <button onClick={() => updateTask(task.id, { requiresInput: !task.requiresInput })} className={`w-full md:w-auto px-4 py-1.5 rounded-lg text-[8px] font-bold border ${task.requiresInput ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-white/5 text-slate-600'}`}>
                                    {task.requiresInput ? 'NOTAS ON' : 'NOTAS OFF'}
                                  </button>
                                </div>
                              </div>

                              {task.requiresInput && (
                                <textarea 
                                  value={task.currentInput || ''} 
                                  onChange={e => updateTask(task.id, { currentInput: e.target.value })}
                                  placeholder="O que foi realizado?"
                                  className="w-full h-24 md:h-32 bg-slate-900/50 border border-white/5 rounded-xl p-4 text-xs text-slate-300 outline-none focus:border-indigo-500 resize-none"
                                />
                              )}

                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {task.steps?.map(step => (
                                  <div key={step.id} className="flex items-center gap-3 py-1">
                                    <button onClick={() => toggleStep(task.id, step.id)} className={`w-4 h-4 rounded border flex items-center justify-center ${step.completed ? 'bg-indigo-500 border-indigo-500' : 'border-white/10'}`}>
                                      {step.completed && <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                                    </button>
                                    <span className={`text-[11px] font-medium truncate ${step.completed ? 'text-slate-600 line-through' : 'text-slate-400'}`}>{step.title}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {completed.map(task => (
                        <div key={task.id} className="flex flex-row items-center gap-4 py-4 px-4 border-b border-white/5 opacity-40 hover:opacity-100 transition-all">
                           <div className={`w-1 h-3 rounded-full flex-shrink-0 ${task.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                           <div className="flex-1 min-w-0">
                             <span className="text-xs md:text-sm font-space line-through text-slate-600 truncate block">{task.title}</span>
                           </div>
                           <div className="flex gap-4">
                              <button onClick={() => restoreTask(task.id)} className="text-[8px] md:text-[9px] font-bold text-indigo-400 uppercase tracking-widest whitespace-nowrap">REFAZER</button>
                              <button onClick={() => setTasks(tasks.filter(t => t.id !== task.id))} className="text-[8px] md:text-[9px] font-bold text-red-500 uppercase tracking-widest">DEL</button>
                           </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}

        {mainView === 'EVOLUTION' && (
          <div className="h-full flex flex-col items-center justify-center pb-20">
            <div className="w-full max-w-5xl h-[300px] md:h-[500px]"><UniverseVisual level={stats.level} /></div>
            <div className="mt-6 md:mt-10 max-w-xl text-center space-y-3 px-4">
               <h2 className="text-2xl md:text-3xl font-space font-bold text-white uppercase tracking-widest">{currentLevel.name}</h2>
               <p className="text-xs md:text-sm text-slate-400 italic font-light leading-relaxed">{isLoadingNarrative ? 'Consultando...' : narrative}</p>
            </div>
          </div>
        )}
      </main>

      {activeTask && <TimerModal task={activeTask} onClose={() => setActiveTask(null)} onComplete={handleTaskAction} />}
    </div>
  );
};

export default App;
