
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, UserStats, TimeLog, Period, TaskStep, PriorityLevel, CompletionMode } from './types.ts';
import { LEVELS, XP_COMPLETED, XP_GAVE_UP, XP_IGNORED, XP_STEP } from './constants.ts';
import { getLevelNarrative } from './services/geminiService.ts';
import TimerModal from './components/TimerModal.tsx';
import UniverseVisual from './components/UniverseVisual.tsx';

type MainView = 'DASHBOARD' | 'EVOLUTION' | 'STATISTICS';

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('cronos_tasks');
      const loadedTasks: Task[] = saved ? JSON.parse(saved) : [];
      const today = new Date().toDateString();
      
      // Reset diário: Mantém rotinas mas limpa objetivos diários concluídos/ignorados do dia anterior
      return loadedTasks.map(t => {
        const lastDate = t.lastDone ? new Date(t.lastDone).toDateString() : null;
        
        if (t.type === 'ROUTINE' && t.status !== 'PENDING' && lastDate !== today) {
          return { ...t, status: 'PENDING', steps: t.steps?.map(s => ({ ...s, completed: false })) };
        }
        return t;
      }).filter(t => {
        // Remove objetivos diários que foram finalizados ontem ou antes
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

  const [periods, setPeriods] = useState<Period[]>(() => {
    const d = [
      { id: 'p1', name: 'Manhã' }, 
      { id: 'p2', name: 'Tarde' }, 
      { id: 'p3', name: 'Noite' },
      { id: 'p4', name: '♾️ Constantes' }
    ];
    try {
      const saved = localStorage.getItem('cronos_periods');
      return saved ? JSON.parse(saved) : d;
    } catch (e) { return d; }
  });

  const [mainView, setMainView] = useState<MainView>('DASHBOARD');
  const [narrative, setNarrative] = useState<string>('');
  const [isLoadingNarrative, setIsLoadingNarrative] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'DAILY' | 'ROUTINE'>('DAILY');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>(2);
  const [newTaskMode, setNewTaskMode] = useState<CompletionMode>('TIMER');
  const [selectedPeriodForAdd, setSelectedPeriodForAdd] = useState<string>('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [quickStepInputs, setQuickStepInputs] = useState<Record<string, string>>({});
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({});

  const currentLevel = useMemo(() => {
    return LEVELS.find(l => l.level === stats.level) || LEVELS[0];
  }, [stats.level]);

  useEffect(() => {
    if ((window as any).hideAppLoader) (window as any).hideAppLoader();
  }, []);

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
    setIsLoadingNarrative(true);
    const text = await getLevelNarrative(currentLevel);
    setNarrative(text);
    setIsLoadingNarrative(false);
  };

  const importExternalProtocol = () => {
    const genSteps = (n: number, label: string = "Nível") => Array.from({length: n}, (_, i) => ({ id: crypto.randomUUID(), title: `${label} ${i+1}`, completed: false }));

    const protocol: Partial<Task>[] = [
      { title: "2-g. 😒 Carregar Dispositivos", periodId: "p1", steps: [{id:"s1", title:"Celular", completed:false}, {id:"s2", title:"Tablet", completed:false}] },
      { title: "3-b. 😒 Exercício Físico", periodId: "p2", steps: genSteps(4) },
      { title: "5-a. 😒 Projeto Arquitetônico?", periodId: "p3", steps: genSteps(5) },
      { title: "5-d. 😒 Estudo: Matemática?", periodId: "p3", steps: genSteps(5) },
      { title: "5-g. 😒 Estudo: Programação?", periodId: "p3", steps: genSteps(5) },
      { title: "6-a. 👽 Carinhoso com a Joyce?", periodId: "p3", steps: genSteps(4) },
      { title: "7-a. 😒 Resuma seu dia", periodId: "p3", steps: [{id: "7a1", title: "Resumo feito", completed: false}] },
      { title: "8-a. ♾️ Bíblia: Ensinamento", periodId: "p4", steps: [{id: "8a1", title: "Seguiu?", completed: false}, {id: "8a2", title: "Qual?", completed: false}] },
      { title: "8-d. ♾️ Água (5 Garrafas)", periodId: "p4", steps: genSteps(5, "Garrafa") },
      { title: "8-k. ♾️ Higiene Bucal (M/T/N)", periodId: "p4", steps: genSteps(3, "Escovação") },
      { title: "8-o. ♾️ Bom dia/tarde/noite", periodId: "p4", steps: [{id: "8o1", title: "Bom dia ☀️", completed: false}, {id: "8o2", title: "Boa tarde 🕧", completed: false}, {id: "8o3", title: "Boa noite 🌕", completed: false}] },
    ];

    const newTasks = [...tasks];
    protocol.forEach(routine => {
      const exists = newTasks.some(t => t.title === routine.title && t.type === 'ROUTINE');
      if (!exists) {
        newTasks.push({
          id: crypto.randomUUID(),
          title: routine.title!,
          type: 'ROUTINE',
          priority: 2,
          completionMode: 'MANUAL',
          status: 'PENDING',
          createdAt: Date.now(),
          periodId: routine.periodId,
          steps: routine.steps || []
        });
      }
    });
    setTasks(newTasks);
    setActiveSubTab('ROUTINE');
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

  const updateTaskPriority = (taskId: string, priority: PriorityLevel) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, priority } : t));
  };

  const updateTaskMode = (taskId: string, completionMode: CompletionMode) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, completionMode } : t));
  };

  const restoreTask = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    
    // Estornar XP
    const xpToDeduct = task.status === 'COMPLETED' ? XP_COMPLETED : task.status === 'GAVE_UP' ? XP_GAVE_UP : XP_IGNORED;
    updateStats(-xpToDeduct, 'RESTORED', 0, task);
    
    setTasks(tasks.map(t => t.id === taskId ? { ...t, status: 'PENDING' } : t));
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
      status: 'PENDING', 
      createdAt: Date.now(),
      periodId: selectedPeriodForAdd || undefined,
      steps: []
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
  };

  const handleTaskAction = (status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED', seconds: number, taskOverride?: Task) => {
    const targetTask = taskOverride || activeTask;
    if (!targetTask) return;
    const xp = status === 'COMPLETED' ? XP_COMPLETED : status === 'GAVE_UP' ? XP_GAVE_UP : XP_IGNORED;
    updateStats(xp, status, seconds, targetTask);
    
    setTasks(tasks.map(t => t.id === targetTask.id ? { ...t, status, lastDone: Date.now(), completedAt: Date.now() } : t));
    if (!taskOverride) setActiveTask(null);
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

  const addQuickStep = (taskId: string) => {
    const input = quickStepInputs[taskId];
    if (!input?.trim()) return;
    setTasks(tasks.map(t => {
      if (t.id === taskId) {
        const newStep: TaskStep = { id: crypto.randomUUID(), title: input, completed: false };
        return { ...t, steps: [...(t.steps || []), newStep] };
      }
      return t;
    }));
    setQuickStepInputs(prev => ({ ...prev, [taskId]: '' }));
  };

  const toggleExpand = (id: string) => setExpandedTasks(prev => ({ ...prev, [id]: !prev[id] }));

  const priorityLabels = { 1: "ALTA", 2: "MÉDIA", 3: "BAIXA" };
  const priorityColors = { 1: "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]", 2: "bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]", 3: "bg-slate-700" };
  const priorityText = { 1: "text-red-400", 2: "text-indigo-400", 3: "text-slate-500" };

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-[#020617] text-slate-200 overflow-hidden font-inter">
      <nav className="w-full md:w-20 lg:w-24 bg-slate-900/40 border-b md:border-b-0 md:border-r border-white/5 flex md:flex-col items-center py-4 md:py-8 justify-around md:justify-start gap-8 z-50">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center font-space font-bold text-white text-xl md:mb-8 shadow-[0_0_20px_rgba(79,70,229,0.3)]">C</div>
          <button onClick={() => setMainView('DASHBOARD')} className={`p-3 rounded-2xl transition-all ${mainView === 'DASHBOARD' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg></button>
          <button onClick={() => setMainView('EVOLUTION')} className={`p-3 rounded-2xl transition-all ${mainView === 'EVOLUTION' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></button>
          <button onClick={() => setMainView('STATISTICS')} className={`p-3 rounded-2xl transition-all ${mainView === 'STATISTICS' ? 'bg-indigo-500/20 text-indigo-400' : 'text-slate-600 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
          <button onClick={() => setShowBackupModal(true)} className="p-3 text-slate-700 hover:text-indigo-400 mt-auto"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg></button>
      </nav>

      <main className="flex-1 overflow-y-auto px-6 py-10 md:px-16 lg:px-24 custom-scrollbar">
        {mainView === 'DASHBOARD' && (
          <div className="max-w-4xl mx-auto space-y-16">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-white/5 pb-10">
              <div>
                <h1 className="text-4xl md:text-5xl font-space font-bold tracking-tighter text-white uppercase">Sincronia Global</h1>
                <p className="text-[10px] tracking-[0.4em] text-slate-500 font-bold uppercase mt-2 italic">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <button onClick={importExternalProtocol} className="px-5 py-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[9px] font-bold text-indigo-400 uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)]">Sincronizar Protocolo Completo</button>
            </header>

            <div className="flex gap-8 border-b border-white/5 pb-2">
              {['DAILY', 'ROUTINE'].map(t => (
                <button key={t} onClick={() => setActiveSubTab(t as any)} className={`pb-4 text-[11px] font-bold tracking-[0.2em] uppercase transition-all relative ${activeSubTab === t ? 'text-white' : 'text-slate-600 hover:text-slate-400'}`}>
                  {t === 'DAILY' ? 'Objetivos' : 'Rotinas Diárias'}
                  {activeSubTab === t && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
                </button>
              ))}
            </div>

            <form onSubmit={addTask} className="space-y-4">
              <div className="relative group">
                <input type="text" placeholder="Injetar nova tarefa..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="w-full h-16 bg-transparent border-b border-white/10 text-xl md:text-2xl text-white outline-none focus:border-indigo-500 transition-all placeholder:text-slate-800 font-space" />
                <button type="submit" className="absolute right-0 bottom-4 text-slate-700 hover:text-indigo-400 text-xs font-bold tracking-widest uppercase">Adicionar +</button>
              </div>
              <div className="flex flex-wrap gap-4 text-[9px] font-bold tracking-widest uppercase text-slate-600">
                <div className="flex gap-3">
                  {[1, 2, 3].map(p => (
                    <button key={p} type="button" onClick={() => setNewTaskPriority(p as any)} className={`transition-colors ${newTaskPriority === p ? priorityText[p as PriorityLevel] : 'hover:text-slate-400'}`}>{priorityLabels[p as PriorityLevel]}</button>
                  ))}
                </div>
                <div className="w-[1px] h-4 bg-white/10 mx-2" />
                <select value={selectedPeriodForAdd} onChange={e => setSelectedPeriodForAdd(e.target.value)} className="bg-transparent text-indigo-400 outline-none cursor-pointer">
                  {periods.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                  <option value="" className="bg-slate-900">Fluxo Livre</option>
                </select>
              </div>
            </form>

            <div className="space-y-20 pb-20">
              {[...periods, { id: 'unassigned', name: 'Fluxo Livre' }].map(period => {
                const pId = period.id === 'unassigned' ? undefined : period.id;
                const filteredTasks = tasks.filter(t => t.type === activeSubTab && t.periodId === pId);
                const pending = filteredTasks.filter(t => t.status === 'PENDING').sort((a,b) => (a.priority || 2) - (b.priority || 2));
                const completed = filteredTasks.filter(t => t.status !== 'PENDING');
                
                if (filteredTasks.length === 0) return null;

                return (
                  <section key={period.id} className="space-y-6">
                    <h2 className="text-[10px] tracking-[0.6em] text-slate-700 font-bold uppercase border-l-2 border-indigo-500/20 pl-4 mb-8">{period.name} <span className="ml-4 opacity-40">{pending.length}</span></h2>
                    
                    <div className="space-y-[1px]">
                      {pending.map(task => (
                        <div key={task.id} className="group relative bg-white/[0.02] hover:bg-white/[0.04] transition-all border-l-2 border-transparent hover:border-indigo-500">
                          <div className="flex flex-col md:flex-row items-center gap-4 py-5 px-6">
                            <div className={`w-1 h-6 rounded-full ${priorityColors[task.priority || 2]} transition-all duration-500`} />
                            
                            <div className="flex-1 cursor-pointer" onClick={() => toggleExpand(task.id)}>
                              <h3 className="text-lg font-space font-medium text-slate-300 group-hover:text-white transition-colors">{task.title}</h3>
                              <div className="flex items-center gap-4 mt-1">
                                <span className={`text-[8px] font-bold uppercase tracking-widest ${priorityText[task.priority || 2]}`}>{priorityLabels[task.priority || 2]}</span>
                                {task.steps && task.steps.length > 0 && (
                                  <span className="text-[8px] font-bold uppercase tracking-widest text-slate-600">{task.steps.filter(s => s.completed).length}/{task.steps.length} ETAPAS</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <button onClick={() => setActiveTask(task)} title="Timer" className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 hover:bg-indigo-500 hover:text-white transition-all">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </button>
                              <button onClick={() => handleTaskAction('COMPLETED', 0, task)} className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center text-slate-600 hover:text-emerald-400 transition-all">✓</button>
                              <button onClick={() => handleTaskAction('IGNORED', 0, task)} className="w-8 h-8 rounded-full border border-white/5 flex items-center justify-center text-slate-600 hover:text-red-400 transition-all">✕</button>
                              <button onClick={() => toggleExpand(task.id)} className={`w-8 h-8 text-slate-700 hover:text-white transition-all transform ${expandedTasks[task.id] ? 'rotate-180' : ''}`}>▼</button>
                            </div>
                          </div>

                          {expandedTasks[task.id] && (
                            <div className="px-16 pb-8 space-y-8 animate-in slide-in-from-top-2">
                              <div className="flex flex-wrap items-center gap-10 py-4 border-y border-white/5 bg-white/[0.01] px-6 rounded-2xl">
                                <div className="space-y-3">
                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block">Prioridade</span>
                                  <div className="flex gap-2">
                                    {[1, 2, 3].map(p => (
                                      <button key={p} onClick={() => updateTaskPriority(task.id, p as PriorityLevel)} className={`px-4 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${task.priority === p ? `${priorityColors[p as PriorityLevel]} text-white border-transparent` : 'border-white/5 text-slate-600'}`}>{priorityLabels[p as PriorityLevel]}</button>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-3">
                                  <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest block">Método</span>
                                  <div className="flex gap-2">
                                    {(['TIMER', 'MANUAL'] as CompletionMode[]).map(m => (
                                      <button key={m} onClick={() => updateTaskMode(task.id, m)} className={`px-4 py-1.5 rounded-lg text-[9px] font-bold transition-all border ${task.completionMode === m ? 'bg-white text-slate-950 border-white' : 'border-white/5 text-slate-600'}`}>{m}</button>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {task.steps?.map(step => (
                                  <div key={step.id} className="flex items-center gap-3 py-1">
                                    <button onClick={() => toggleStep(task.id, step.id)} className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${step.completed ? 'bg-indigo-500 border-indigo-500' : 'border-white/10'}`}>
                                      {step.completed && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" /></svg>}
                                    </button>
                                    <span className={`text-xs font-medium ${step.completed ? 'text-slate-600 line-through' : 'text-slate-400'}`}>{step.title}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      {completed.map(task => (
                        <div key={task.id} className="flex items-center gap-4 py-4 px-6 border-b border-white/5 group/completed">
                           <div className={`w-1 h-4 rounded-full ${task.status === 'COMPLETED' ? 'bg-emerald-500' : task.status === 'IGNORED' ? 'bg-red-500' : 'bg-slate-500'} opacity-30`} />
                           <span className="flex-1 text-sm font-space text-slate-600 line-through decoration-slate-800">{task.title}</span>
                           <div className="flex gap-4 opacity-0 group-hover/completed:opacity-100 transition-opacity">
                              <button 
                                onClick={() => restoreTask(task.id)} 
                                title="Refazer / Restaurar"
                                className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 uppercase tracking-widest flex items-center gap-2"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                Refazer
                              </button>
                              <button onClick={() => setTasks(tasks.filter(t => t.id !== task.id))} className="text-[9px] font-bold text-red-500/50 hover:text-red-500 uppercase tracking-widest">Apagar</button>
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
          <div className="h-full flex flex-col items-center justify-center animate-in zoom-in duration-1000">
            <h1 className="text-6xl md:text-8xl font-space font-bold tracking-tighter text-white opacity-5 mb-10 absolute">EVOLUÇÃO</h1>
            <div className="w-full max-w-5xl h-[500px]"><UniverseVisual level={stats.level} /></div>
            <div className="mt-10 max-w-xl text-center space-y-4 px-6">
               <h2 className="text-3xl font-space font-bold text-white uppercase tracking-widest">{currentLevel.name}</h2>
               <p className="text-slate-400 italic font-light leading-relaxed">{isLoadingNarrative ? 'Consultando Arquivo Universal...' : narrative}</p>
            </div>
          </div>
        )}

        {mainView === 'STATISTICS' && (
           <div className="max-w-4xl mx-auto py-10 space-y-16 animate-in fade-in">
              <h1 className="text-4xl font-space font-bold text-white uppercase tracking-tighter">Bio-Métricas</h1>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-1 shadow-2xl bg-white/5 border border-white/5 overflow-hidden rounded-[2rem]">
                 <div className="p-12 text-center border-r border-white/5">
                    <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block mb-4">Minutos Ativos</span>
                    <span className="text-6xl font-space font-bold text-white">{(stats.timeLogs.reduce((a,c) => a+c.seconds, 0)/60).toFixed(0)}</span>
                 </div>
                 <div className="p-12 text-center border-r border-white/5">
                    <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest block mb-4">Conquistas</span>
                    <span className="text-6xl font-space font-bold text-white">{stats.completedCount}</span>
                 </div>
                 <div className="p-12 text-center">
                    <span className="text-[8px] font-bold text-pink-400 uppercase tracking-widest block mb-4">Pontos de Vida</span>
                    <span className="text-6xl font-space font-bold text-white">{stats.xp}</span>
                 </div>
              </div>
           </div>
        )}
      </main>

      {showBackupModal && (
        <div className="fixed inset-0 bg-[#020617]/95 backdrop-blur-2xl flex items-center justify-center z-[100] animate-in fade-in">
           <div className="w-full max-sm:px-6 max-w-sm p-10 space-y-8 text-center bg-slate-900 border border-white/10 rounded-[3rem] shadow-2xl">
              <h2 className="text-2xl font-space font-bold text-white uppercase tracking-widest">Arquivo Universal</h2>
              <div className="grid gap-4">
                 <button onClick={() => {
                   const blob = new Blob([JSON.stringify({ tasks, stats, periods })], { type: 'application/json' });
                   const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cronos_archive.json`; a.click();
                 }} className="py-4 border border-white/10 rounded-2xl text-[10px] font-bold text-indigo-400 hover:bg-white/5 transition-all">EXPORTAR BACKUP</button>
                 <button onClick={() => setShowBackupModal(false)} className="py-4 text-slate-700 text-[10px] font-bold hover:text-white transition-colors">FECHAR</button>
              </div>
           </div>
        </div>
      )}

      {activeTask && <TimerModal task={activeTask} onClose={() => setActiveTask(null)} onComplete={handleTaskAction} />}
    </div>
  );
};

export default App;
