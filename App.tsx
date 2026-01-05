
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, UserStats, TimeLog, Period, TaskStep, PriorityLevel, CompletionMode } from './types.ts';
import { LEVELS, XP_COMPLETED, XP_GAVE_UP, XP_IGNORED, XP_STEP } from './constants.ts';
import { getLevelNarrative } from './services/geminiService.ts';
import TimerModal from './components/TimerModal.tsx';
import UniverseVisual from './components/UniverseVisual.tsx';

type MainView = 'DASHBOARD' | 'EVOLUTION' | 'STATISTICS';
type StatPeriod = 'DAY' | 'MONTH' | 'YEAR';

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem('cronos_tasks');
      return saved ? JSON.parse(saved).map((t: any) => ({ ...t, completionMode: t.completionMode || 'TIMER' })) : [];
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

  const [mainView, setMainView] = useState<MainView>('DASHBOARD');
  const [narrative, setNarrative] = useState<string>('');
  const [isLoadingNarrative, setIsLoadingNarrative] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'DAILY' | 'ROUTINE'>('DAILY');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<PriorityLevel>(2);
  const [newTaskMode, setNewTaskMode] = useState<CompletionMode>('TIMER');
  const [tempSteps, setTempSteps] = useState<string[]>([]);
  const [newStepInput, setNewStepInput] = useState('');
  const [selectedPeriodForAdd, setSelectedPeriodForAdd] = useState<string>('');
  const [filterPeriodId, setFilterPeriodId] = useState<string | 'all'>('all');
  const [newPeriodName, setNewPeriodName] = useState('');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showPeriodManager, setShowPeriodManager] = useState(false);
  const [statPeriod, setStatPeriod] = useState<StatPeriod>('DAY');
  const [editingPeriodTaskId, setEditingPeriodTaskId] = useState<string | null>(null);

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
        gaveUpCount: status === 'GAVE_UP' ? (prev.gaveUpCount || 0) + 1 : (prev.gaveUpCount || 0),
        ignoredCount: status === 'IGNORED' ? (prev.ignoredCount || 0) + 1 : (prev.ignoredCount || 0),
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
      status: 'PENDING', 
      createdAt: Date.now(),
      periodId: selectedPeriodForAdd || undefined,
      steps: tempSteps.map(s => ({ id: crypto.randomUUID(), title: s, completed: false }))
    };
    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
    setNewTaskPriority(2);
    setTempSteps([]);
  };

  const handleTaskAction = (status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED', seconds: number, taskOverride?: Task) => {
    const targetTask = taskOverride || activeTask;
    if (!targetTask) return;
    const xp = status === 'COMPLETED' ? XP_COMPLETED : status === 'GAVE_UP' ? XP_GAVE_UP : XP_IGNORED;
    updateStats(xp, status, seconds, targetTask);
    if (targetTask.type === 'DAILY') setTasks(tasks.filter(t => t.id !== targetTask.id));
    else setTasks(tasks.map(t => t.id === targetTask.id ? { ...t, status, lastDone: Date.now() } : t));
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

  const updateTaskPeriod = (taskId: string, newPeriodId: string) => {
    setTasks(tasks.map(t => t.id === taskId ? { ...t, periodId: newPeriodId || undefined } : t));
    setEditingPeriodTaskId(null);
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
    return { totalSeconds: filtered.reduce((acc, curr) => acc + curr.seconds, 0) };
  }, [stats.timeLogs, statPeriod]);

  const currentLevel = LEVELS.find(l => l.level === stats.level) || LEVELS[0];
  const priorityStyles = { 1: "border-red-500/40 text-red-400", 2: "border-indigo-500/40 text-indigo-400", 3: "border-slate-500/40 text-slate-500" };
  const priorityLabels = { 1: "Prioridade Crítica", 2: "Protocolo Padrão", 3: "Fluxo Opcional" };

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-[#020617] text-slate-200 overflow-hidden">
      <nav className="w-full md:w-20 lg:w-24 bg-slate-900/40 border-b md:border-b-0 md:border-r border-white/5 backdrop-blur-2xl flex md:flex-col items-center justify-between p-3 md:p-4 z-50 flex-shrink-0">
        <div className="flex md:flex-col items-center gap-4 md:gap-8 w-full justify-around md:justify-start">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center font-space font-bold text-white text-xl md:text-2xl shadow-[0_0_25px_rgba(79,70,229,0.4)] md:mb-10">C</div>
          <button onClick={() => setMainView('DASHBOARD')} className={`p-3 rounded-2xl transition-all ${mainView === 'DASHBOARD' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg></button>
          <button onClick={() => setMainView('EVOLUTION')} className={`p-3 rounded-2xl transition-all ${mainView === 'EVOLUTION' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg></button>
          <button onClick={() => setMainView('STATISTICS')} className={`p-3 rounded-2xl transition-all ${mainView === 'STATISTICS' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`}><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg></button>
          <button onClick={() => setShowBackupModal(true)} className="p-3 rounded-2xl text-slate-500 hover:text-indigo-400"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg></button>
        </div>
        <div className="hidden md:flex flex-col items-center gap-6 mb-4">
           <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-[10px] font-space font-bold text-slate-400">{stats.level || 1}</div>
        </div>
      </nav>

      <main className="flex-1 h-full overflow-y-auto scroll-smooth">
        <div className="w-full max-w-7xl mx-auto px-6 py-10 md:px-12 lg:px-20 md:py-16">
          {mainView === 'DASHBOARD' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <header className="mb-14 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-space font-bold text-white tracking-tighter uppercase leading-none">Protocolo Ativo</h1>
                  <p className="text-slate-500 text-sm tracking-widest font-bold uppercase italic mt-3">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
              </header>

              <div className="flex flex-wrap items-center gap-4 mb-10">
                <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-[1.5rem] border border-white/5 w-fit">
                  {['DAILY', 'ROUTINE'].map(t => (
                    <button key={t} onClick={() => { setActiveSubTab(t as any); setFilterPeriodId('all'); }} className={`px-6 md:px-10 py-3 rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-widest transition-all ${activeSubTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                      {t === 'DAILY' ? 'Objetivos' : 'Rotinas'}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShowPeriodManager(!showPeriodManager)} className="h-12 px-6 rounded-2xl bg-slate-900/40 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-all">Ciclos Temporais</button>
              </div>

              <div className="flex items-center gap-3 mb-10 overflow-x-auto pb-4 scrollbar-hide">
                <button onClick={() => setFilterPeriodId('all')} className={`whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${filterPeriodId === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-900/40 border-white/5 text-slate-500'}`}>Todos os Fluxos</button>
                {periods.map(p => <button key={p.id} onClick={() => setFilterPeriodId(p.id)} className={`whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${filterPeriodId === p.id ? 'bg-indigo-600 text-white' : 'bg-slate-900/40 border-white/5 text-slate-500'}`}>{p.name}</button>)}
              </div>

              {/* FORMULÁRIO DE INJEÇÃO */}
              <form onSubmit={addTask} className="mb-16 p-8 md:p-12 bg-slate-900/20 border border-white/5 rounded-[3rem] shadow-inner space-y-8 animate-in slide-in-from-top-4">
                <div className="flex flex-col sm:flex-row gap-4">
                  <input type="text" placeholder={activeSubTab === 'DAILY' ? "Injetar objetivo..." : "Estabelecer rotina..."} value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="flex-1 h-16 md:h-20 bg-slate-950/50 border border-white/10 rounded-[2rem] px-8 md:px-10 text-xl md:text-2xl text-white focus:outline-none focus:border-indigo-500/50 shadow-2xl" />
                  <button type="submit" className="h-16 md:h-20 px-10 md:px-14 bg-white text-slate-950 rounded-[2rem] font-space font-bold uppercase text-xs md:text-sm tracking-widest hover:bg-indigo-300 transition-all shadow-xl">Fixar Protocolo</button>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                   <div className="space-y-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block ml-2">Importância:</span>
                      <div className="flex gap-2">
                         {[1, 2, 3].map((p) => (
                           <button key={p} type="button" onClick={() => setNewTaskPriority(p as PriorityLevel)} className={`flex-1 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest border transition-all ${newTaskPriority === p ? (p === 1 ? 'bg-red-500/20 border-red-500 text-red-400' : p === 2 ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-slate-700/40 border-slate-500 text-slate-400') : 'border-white/5 text-slate-600 hover:border-white/10'}`}>
                             {p === 1 ? 'Alta' : p === 2 ? 'Média' : 'Baixa'}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="space-y-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block ml-2">Modo de Ação:</span>
                      <div className="flex gap-2">
                         {(['TIMER', 'MANUAL'] as CompletionMode[]).map((m) => (
                           <button key={m} type="button" onClick={() => setNewTaskMode(m)} className={`flex-1 py-3 rounded-2xl text-[9px] font-bold uppercase tracking-widest border transition-all ${newTaskMode === m ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'border-white/5 text-slate-600 hover:border-white/10'}`}>
                             {m === 'TIMER' ? '⏱ Tempo' : '✅ Check-in'}
                           </button>
                         ))}
                      </div>
                   </div>

                   <div className="space-y-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block ml-2">Alocar em:</span>
                      <select value={selectedPeriodForAdd} onChange={e => setSelectedPeriodForAdd(e.target.value)} className="w-full h-[52px] bg-slate-950/60 border border-white/10 rounded-2xl px-5 text-xs font-bold text-indigo-300 outline-none focus:border-indigo-500/50">
                        {periods.map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>)}
                        <option value="" className="bg-slate-900">Sem alocação</option>
                      </select>
                   </div>

                   <div className="space-y-3">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block ml-2">Sub-etapas:</span>
                      <input type="text" placeholder="Add passo..." value={newStepInput} onChange={e => setNewStepInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), setTempSteps([...tempSteps, newStepInput]), setNewStepInput(''))} className="w-full h-[52px] bg-slate-950/60 border border-white/10 rounded-2xl px-5 text-xs text-white outline-none focus:border-indigo-500/50" />
                   </div>
                </div>
              </form>

              {/* LISTA DE TAREFAS */}
              <div className="space-y-20">
                {[...periods, { id: 'unassigned', name: 'Fluxo Livre' }].filter(p => filterPeriodId === 'all' || filterPeriodId === p.id).map(period => {
                    const pTasks = tasks
                      .filter(t => t.type === activeSubTab && (t.periodId === period.id || (period.id === 'unassigned' && !t.periodId)))
                      .sort((a, b) => (a.priority || 2) - (b.priority || 2));
                    
                    if (pTasks.length === 0) return null;
                    return (
                      <div key={period.id} className="animate-in fade-in slide-in-from-bottom-6">
                        <h4 className="text-[11px] font-bold text-indigo-400/60 uppercase tracking-[0.5em] mb-8 ml-8 flex items-center gap-5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" />
                          {period.name}
                        </h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                          {pTasks.map(task => (
                            <div 
                              key={task.id} 
                              onClick={() => task.completionMode === 'TIMER' && task.status === 'PENDING' ? setActiveTask(task) : null} 
                              className={`group relative p-8 md:p-10 bg-slate-900/30 border-2 rounded-[3.5rem] hover:bg-slate-900/50 transition-all cursor-pointer overflow-hidden ${task.status !== 'PENDING' ? 'opacity-40 grayscale border-white/5' : `shadow-2xl ${priorityStyles[task.priority || 2]}`}`}
                            >
                              <div className={`absolute top-0 right-10 h-1 w-20 rounded-b-full ${task.priority === 1 ? 'bg-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : task.priority === 2 ? 'bg-indigo-500/60' : 'bg-slate-700/60'}`} />
                              
                              <div className="flex items-start justify-between mb-6">
                                <div className="max-w-[70%]">
                                  <div className="flex items-center gap-3 mb-2">
                                    <span className={`text-[8px] font-bold uppercase tracking-widest opacity-60 ${task.priority === 1 ? 'text-red-400' : 'text-indigo-400'}`}>
                                      {priorityLabels[task.priority || 2]}
                                    </span>
                                    
                                    {/* SELETOR DE PERÍODO (EDIÇÃO) */}
                                    <div className="relative" onClick={e => e.stopPropagation()}>
                                      {editingPeriodTaskId === task.id ? (
                                        <select 
                                          autoFocus
                                          className="bg-slate-950 border border-indigo-500/50 rounded-lg text-[8px] font-bold text-white uppercase px-2 py-0.5 outline-none animate-in zoom-in"
                                          onBlur={() => setEditingPeriodTaskId(null)}
                                          onChange={(e) => updateTaskPeriod(task.id, e.target.value)}
                                          value={task.periodId || 'unassigned'}
                                        >
                                          {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                          <option value="unassigned">Fluxo Livre</option>
                                        </select>
                                      ) : (
                                        <button 
                                          onClick={() => setEditingPeriodTaskId(task.id)}
                                          className="px-2 py-0.5 rounded-lg border border-white/10 hover:border-indigo-500/40 text-[8px] font-bold text-slate-500 hover:text-indigo-300 uppercase tracking-widest transition-all"
                                        >
                                          {periods.find(p => p.id === task.periodId)?.name || 'Fluxo Livre'}
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                  
                                  <h3 className={`text-2xl md:text-3xl font-space font-bold tracking-tight leading-tight ${task.status !== 'PENDING' ? 'line-through text-slate-500' : 'text-white'}`}>
                                    {task.title}
                                  </h3>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="text-slate-800 hover:text-red-500 transition-colors p-2 text-xl">&times;</button>
                                </div>
                              </div>

                              {/* Ações Rápidas para Modo Manual */}
                              {task.completionMode === 'MANUAL' && task.status === 'PENDING' && (
                                <div className="flex gap-3 mb-6" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => handleTaskAction('COMPLETED', 0, task)} className="flex-1 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-[10px] font-bold text-emerald-400 uppercase tracking-widest hover:bg-emerald-500 hover:text-white transition-all">Sim</button>
                                  <button onClick={() => handleTaskAction('IGNORED', 0, task)} className="flex-1 py-3 bg-red-500/10 border border-red-500/30 rounded-2xl text-[10px] font-bold text-red-400 uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">Não</button>
                                </div>
                              )}

                              {task.steps && task.steps.length > 0 && (
                                <div className="grid grid-cols-2 gap-3 mt-4" onClick={e => e.stopPropagation()}>
                                  {task.steps.map(s => (
                                    <div key={s.id} onClick={() => toggleStep(task.id, s.id)} className={`px-4 py-2.5 rounded-2xl border transition-all flex items-center gap-3 ${s.completed ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200' : 'bg-slate-950/40 border-white/5 text-slate-600'}`}>
                                      <div className={`w-2.5 h-2.5 rounded-full ${s.completed ? 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.6)]' : 'bg-slate-800'}`} />
                                      <span className="text-[9px] font-bold truncate uppercase">{s.title}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                })}
              </div>
            </div>
          )}

          {mainView === 'EVOLUTION' && (
            <div className="animate-in fade-in zoom-in h-[80vh] flex flex-col items-center justify-center text-center">
              <header className="mb-10">
                <span className="text-indigo-400 text-[10px] uppercase tracking-[0.6em] font-bold mb-6 block">Arquivos Akáshicos</span>
                <h1 className="text-6xl md:text-8xl font-space font-bold text-white tracking-tighter italic leading-none">A GRANDE EVOLUÇÃO</h1>
              </header>
              <div className="w-full max-w-4xl h-[400px] relative mb-10"><UniverseVisual level={stats.level || 1} /></div>
              <div className="bg-slate-900/40 border border-white/5 rounded-[4rem] p-10 max-w-2xl">
                <h2 className="text-3xl font-space font-bold text-white mb-2">{currentLevel.name}</h2>
                <p className="text-indigo-400 text-[10px] font-bold tracking-[0.4em] uppercase mb-6">{currentLevel.storyEra}</p>
                <p className="text-xl font-light text-slate-200 italic leading-relaxed">{isLoadingNarrative ? "Sincronizando..." : narrative}</p>
                <button onClick={loadNarrative} className="mt-8 px-6 py-2.5 border border-white/10 text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-white transition-all">Recalibrar Frequência</button>
              </div>
            </div>
          )}

          {mainView === 'STATISTICS' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-700">
              <header className="mb-16 flex justify-between items-center">
                <h1 className="text-4xl font-space font-bold text-white uppercase tracking-tighter">Análise Temporal</h1>
                <div className="flex gap-2 bg-slate-900/50 p-2 rounded-2xl border border-white/10">
                  {['DAY', 'MONTH', 'YEAR'].map(p => <button key={p} onClick={() => setStatPeriod(p as any)} className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase ${statPeriod === p ? 'bg-indigo-600 text-white' : 'text-slate-500'}`}>{p === 'DAY' ? 'Dia' : p === 'MONTH' ? 'Mês' : 'Ano'}</button>)}
                </div>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-slate-900/30 border border-white/5 p-10 rounded-[3rem] text-center shadow-2xl">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase mb-4 block">Foco Total</span>
                  <span className="text-5xl font-space font-bold text-white">{(aggregatedData.totalSeconds / 60).toFixed(0)}m</span>
                </div>
                <div className="bg-slate-900/30 border border-white/5 p-10 rounded-[3rem] text-center shadow-2xl">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase mb-4 block">Eventos Concluídos</span>
                  <span className="text-5xl font-space font-bold text-white">{stats.completedCount || 0}</span>
                </div>
                <div className="bg-slate-900/30 border border-white/5 p-10 rounded-[3rem] text-center shadow-2xl">
                  <span className="text-[10px] font-bold text-pink-400 uppercase mb-4 block">Energia Vital (XP)</span>
                  <span className="text-5xl font-space font-bold text-white">{stats.xp || 0}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {showBackupModal && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center z-[100] p-6 animate-in fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-[3.5rem] p-10 text-center">
            <h2 className="text-3xl font-space font-bold text-white uppercase mb-10">Memória Universal</h2>
            <div className="space-y-4">
              <button onClick={() => {
                const data = { tasks, stats, periods, exportedAt: new Date().toISOString() };
                const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `cronos_archive.json`; a.click();
              }} className="w-full py-6 bg-slate-950 border border-white/5 rounded-3xl text-indigo-400 font-bold uppercase text-xs">Exportar Arquivo</button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-6 bg-slate-950 border border-white/5 rounded-3xl text-emerald-400 font-bold uppercase text-xs">Sincronizar Arquivo</button>
              <button onClick={() => setShowBackupModal(false)} className="w-full py-4 text-slate-600 font-bold uppercase text-[10px]">Fechar Terminal</button>
            </div>
          </div>
        </div>
      )}
      {activeTask && <TimerModal task={activeTask} onClose={() => setActiveTask(null)} onComplete={handleTaskAction} />}
    </div>
  );
};

export default App;
