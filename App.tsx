
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Task, UserStats, TimeLog, Period, TaskStep } from './types.ts';
import { LEVELS, XP_COMPLETED, XP_GAVE_UP, XP_IGNORED, XP_STEP } from './constants.ts';
import { getLevelNarrative } from './services/geminiService.ts';
import TimerModal from './components/TimerModal.tsx';
import UniverseVisual from './components/UniverseVisual.tsx';

type MainView = 'DASHBOARD' | 'EVOLUTION' | 'STATISTICS';
type StatPeriod = 'DAY' | 'MONTH' | 'YEAR';

const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('cronos_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [stats, setStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('cronos_stats');
    const defaultStats = { xp: 0, level: 1, completedCount: 0, gaveUpCount: 0, ignoredCount: 0, timeLogs: [] };
    if (!saved) return defaultStats;
    const parsed = JSON.parse(saved);
    return { ...defaultStats, ...parsed };
  });

  const [periods, setPeriods] = useState<Period[]>(() => {
    const saved = localStorage.getItem('cronos_periods');
    return saved ? JSON.parse(saved) : [
      { id: 'p1', name: 'Manhã' },
      { id: 'p2', name: 'Tarde' },
      { id: 'p3', name: 'Noite' }
    ];
  });

  const [mainView, setMainView] = useState<MainView>('DASHBOARD');
  const [narrative, setNarrative] = useState<string>('');
  const [isLoadingNarrative, setIsLoadingNarrative] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'DAILY' | 'ROUTINE'>('DAILY');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  
  // States para novos steps
  const [tempSteps, setTempSteps] = useState<string[]>([]);
  const [newStepInput, setNewStepInput] = useState('');

  const [selectedPeriodForAdd, setSelectedPeriodForAdd] = useState<string>('');
  const [filterPeriodId, setFilterPeriodId] = useState<string | 'all'>('all');
  const [newPeriodName, setNewPeriodName] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showPeriodManager, setShowPeriodManager] = useState(false);
  const [statPeriod, setStatPeriod] = useState<StatPeriod>('DAY');

  useEffect(() => {
    localStorage.setItem('cronos_tasks', JSON.stringify(tasks));
    localStorage.setItem('cronos_stats', JSON.stringify(stats));
    localStorage.setItem('cronos_periods', JSON.stringify(periods));
    
    setIsSyncing(true);
    const timeout = setTimeout(() => setIsSyncing(false), 800);
    return () => clearTimeout(timeout);
  }, [tasks, stats, periods]);

  useEffect(() => {
    if (mainView === 'EVOLUTION' && !narrative) {
      loadNarrative();
    }
  }, [mainView, stats.level]);

  useEffect(() => {
    if (periods.length > 0 && !selectedPeriodForAdd) {
      setSelectedPeriodForAdd(periods[0].id);
    }
  }, [periods]);

  const loadNarrative = async () => {
    const currentLevelInfo = LEVELS.find(l => l.level === stats.level) || LEVELS[0];
    setIsLoadingNarrative(true);
    const text = await getLevelNarrative(currentLevelInfo);
    setNarrative(text);
    setIsLoadingNarrative(false);
  };

  const handleExport = () => {
    const data = { tasks, stats, periods, exportedAt: new Date().toISOString(), version: "1.3.1" };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cronos_backup_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setShowBackupModal(false);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        if (data.tasks && data.stats) {
          if (window.confirm("Sobrescrever progresso atual?")) {
            setTasks(data.tasks);
            setStats(data.stats);
            if (data.periods) setPeriods(data.periods);
            setNarrative('');
            setShowBackupModal(false);
          }
        }
      } catch (err) { alert("Erro ao importar backup."); }
    };
    reader.readAsText(file);
  };

  const updateStats = (xpChange: number, status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED' | 'STEP_COMPLETED', secondsSpent: number = 0, specificTask?: Task) => {
    setStats(prev => {
      let newXp = Math.max(0, prev.xp + xpChange);
      const nextLevel = LEVELS.find(l => l.xpRequired > newXp);
      let newLevel = nextLevel ? nextLevel.level - 1 : LEVELS[LEVELS.length - 1].level;
      newLevel = Math.max(1, newLevel);

      const logTask = specificTask || activeTask;
      const newLog: TimeLog | null = secondsSpent > 0 ? {
        timestamp: Date.now(),
        seconds: secondsSpent,
        taskId: logTask?.id || 'unknown',
        taskTitle: logTask?.title || 'Tarefa síncrona'
      } : null;

      return {
        ...prev,
        xp: newXp,
        level: newLevel,
        completedCount: status === 'COMPLETED' ? prev.completedCount + 1 : prev.completedCount,
        gaveUpCount: status === 'GAVE_UP' ? prev.gaveUpCount + 1 : prev.gaveUpCount,
        ignoredCount: status === 'IGNORED' ? prev.ignoredCount + 1 : prev.ignoredCount,
        timeLogs: newLog ? [...(prev.timeLogs || []), newLog] : (prev.timeLogs || [])
      };
    });
  };

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const formattedSteps: TaskStep[] = tempSteps.map(s => ({
      id: crypto.randomUUID(),
      title: s,
      completed: false
    }));

    const newTask: Task = { 
      id: crypto.randomUUID(), 
      title: newTaskTitle, 
      type: activeSubTab, 
      status: 'PENDING', 
      createdAt: Date.now(),
      periodId: selectedPeriodForAdd || undefined,
      steps: formattedSteps.length > 0 ? formattedSteps : undefined
    };

    setTasks([...tasks, newTask]);
    setNewTaskTitle('');
    setTempSteps([]);
  };

  const addTempStep = () => {
    if (!newStepInput.trim()) return;
    setTempSteps([...tempSteps, newStepInput]);
    setNewStepInput('');
  };

  const removeTempStep = (index: number) => {
    setTempSteps(tempSteps.filter((_, i) => i !== index));
  };

  const toggleStep = (taskId: string, stepId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task || !task.steps) return;

    const newTasks = tasks.map(t => {
      if (t.id === taskId && t.steps) {
        const newSteps = t.steps.map(s => {
          if (s.id === stepId) {
            const nowCompleted = !s.completed;
            if (nowCompleted) updateStats(XP_STEP, 'STEP_COMPLETED', 0, t);
            else updateStats(-XP_STEP, 'STEP_COMPLETED', 0, t);
            return { ...s, completed: nowCompleted };
          }
          return s;
        });
        return { ...t, steps: newSteps };
      }
      return t;
    });
    setTasks(newTasks);
  };

  const addPeriod = () => {
    if (!newPeriodName.trim()) return;
    const newP: Period = { id: crypto.randomUUID(), name: newPeriodName };
    setPeriods([...periods, newP]);
    setNewPeriodName('');
  };

  const removePeriod = (id: string) => {
    if (window.confirm("Isso removerá a categorização das tarefas vinculadas a este período. Continuar?")) {
      setPeriods(periods.filter(p => p.id !== id));
      setTasks(tasks.map(t => t.periodId === id ? { ...t, periodId: undefined } : t));
    }
  };

  const handleTaskAction = (status: 'COMPLETED' | 'GAVE_UP' | 'IGNORED', seconds: number) => {
    if (!activeTask) return;
    updateStats(status === 'COMPLETED' ? XP_COMPLETED : status === 'GAVE_UP' ? XP_GAVE_UP : XP_IGNORED, status, seconds);
    
    if (activeTask.type === 'DAILY') {
      setTasks(tasks.filter(t => t.id !== activeTask.id));
    } else {
      setTasks(tasks.map(t => t.id === activeTask.id ? { ...t, status, lastDone: Date.now() } : t));
    }
    setActiveTask(null);
  };

  const aggregatedData = useMemo(() => {
    const logs = stats.timeLogs || [];
    const now = new Date();
    const isSameDay = (d1: Date, d2: Date) => d1.toDateString() === d2.toDateString();
    const isSameMonth = (d1: Date, d2: Date) => d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
    const isSameYear = (d1: Date, d2: Date) => d1.getFullYear() === d2.getFullYear();

    let filtered = logs;
    if (statPeriod === 'DAY') filtered = logs.filter(l => isSameDay(new Date(l.timestamp), now));
    else if (statPeriod === 'MONTH') filtered = logs.filter(l => isSameMonth(new Date(l.timestamp), now));
    else if (statPeriod === 'YEAR') filtered = logs.filter(l => isSameYear(new Date(l.timestamp), now));

    const totalSeconds = filtered.reduce((acc, curr) => acc + curr.seconds, 0);
    const byTask = filtered.reduce((acc: any, curr) => {
      acc[curr.taskTitle] = (acc[curr.taskTitle] || 0) + curr.seconds;
      return acc;
    }, {});

    return { totalSeconds, byTask: Object.entries(byTask).sort((a: any, b: any) => b[1] - a[1]) };
  }, [stats.timeLogs, statPeriod]);

  const formatDuration = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${sec % 60}s`;
  };

  const currentLevel = LEVELS.find(l => l.level === stats.level) || LEVELS[0];
  const nextLevel = LEVELS.find(l => l.level === stats.level + 1);
  const progressPercent = nextLevel ? ((stats.xp - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100 : 100;

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-[#020617] text-slate-200 overflow-hidden">
      <input type="file" ref={fileInputRef} onChange={handleImport} accept=".json" className="hidden" />

      {/* Sidebar Navigation */}
      <nav className="w-full md:w-20 lg:w-24 bg-slate-900/40 border-b md:border-b-0 md:border-r border-white/5 backdrop-blur-2xl flex md:flex-col items-center justify-between p-3 md:p-4 z-50 flex-shrink-0">
        <div className="flex md:flex-col items-center gap-4 md:gap-8 w-full justify-around md:justify-start">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center font-space font-bold text-white text-xl md:text-2xl shadow-[0_0_25px_rgba(79,70,229,0.4)] md:mb-10">C</div>
          
          <button onClick={() => setMainView('DASHBOARD')} className={`p-3 rounded-2xl transition-all ${mainView === 'DASHBOARD' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`} title="Dashboard">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7" /></svg>
          </button>

          <button onClick={() => setMainView('EVOLUTION')} className={`p-3 rounded-2xl transition-all ${mainView === 'EVOLUTION' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`} title="Evolução">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </button>

          <button onClick={() => setMainView('STATISTICS')} className={`p-3 rounded-2xl transition-all ${mainView === 'STATISTICS' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-white'}`} title="Estatísticas">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </button>

          <button onClick={() => setShowBackupModal(true)} className="p-3 rounded-2xl text-slate-500 hover:text-indigo-400" title="Backup">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" /></svg>
          </button>
        </div>
        <div className="hidden md:flex flex-col items-center gap-6 mb-4">
           <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-[10px] font-space font-bold text-slate-400" title={`Nível ${stats.level}`}>
            {stats.level}
           </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 h-full overflow-y-auto scroll-smooth">
        <div className="w-full max-w-7xl mx-auto px-6 py-10 md:px-12 lg:px-20 md:py-16">
          {mainView === 'DASHBOARD' && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
              <header className="mb-14 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-space font-bold text-white tracking-tighter uppercase leading-none">Protocolo Ativo</h1>
                  <p className="text-slate-500 text-sm tracking-widest font-bold uppercase italic mt-3">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                </div>
                <div className="bg-slate-900/80 px-5 py-2 rounded-full border border-white/10 text-[10px] font-bold text-indigo-400 uppercase tracking-widest shadow-xl">Sincronização Ativa</div>
              </header>

              <div className="flex flex-wrap items-center gap-4 mb-10">
                <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-[1.5rem] border border-white/5 w-fit">
                  {['DAILY', 'ROUTINE'].map(t => (
                    <button key={t} onClick={() => { setActiveSubTab(t as any); setFilterPeriodId('all'); }} className={`px-6 md:px-10 py-3 rounded-xl font-bold text-[10px] md:text-xs uppercase tracking-widest transition-all ${activeSubTab === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>
                      {t === 'DAILY' ? 'Objetivos' : 'Rotinas'}
                    </button>
                  ))}
                </div>
                
                <button onClick={() => setShowPeriodManager(!showPeriodManager)} className="h-12 px-6 rounded-2xl bg-slate-900/40 border border-white/5 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white hover:border-indigo-500/50 transition-all">
                  Gestão Cronológica
                </button>
              </div>

              {/* Filtros de Período */}
              <div className="flex items-center gap-3 mb-10 overflow-x-auto pb-4 scrollbar-hide">
                <button 
                  onClick={() => setFilterPeriodId('all')}
                  className={`whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${filterPeriodId === 'all' ? (activeSubTab === 'DAILY' ? 'bg-pink-600 border-pink-400' : 'bg-cyan-600 border-cyan-400') + ' text-white shadow-lg' : 'bg-slate-900/40 border-white/5 text-slate-500 hover:border-white/20'}`}
                >
                  Todos os Fluxos
                </button>
                {periods.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => setFilterPeriodId(p.id)}
                    className={`whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${filterPeriodId === p.id ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg' : 'bg-slate-900/40 border-white/5 text-slate-500 hover:border-white/20'}`}
                  >
                    {p.name}
                  </button>
                ))}
                <button 
                  onClick={() => setFilterPeriodId('unassigned')}
                  className={`whitespace-nowrap px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all border ${filterPeriodId === 'unassigned' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-900/40 border-white/5 text-slate-500 hover:border-white/20'}`}
                >
                  Não Alocados
                </button>
              </div>

              {showPeriodManager && (
                <div className="mb-12 p-8 md:p-12 bg-slate-900/40 border border-indigo-500/20 rounded-[3rem] animate-in fade-in slide-in-from-top-4 shadow-2xl">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-8">Arquitetura de Ciclos</h3>
                  <div className="flex flex-wrap gap-4 mb-10">
                    {periods.map(p => (
                      <div key={p.id} className="flex items-center gap-4 px-5 py-3 bg-slate-950 border border-white/5 rounded-2xl shadow-inner group">
                        <span className="text-xs font-bold text-slate-300">{p.name}</span>
                        <button onClick={() => removePeriod(p.id)} className="text-slate-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">&times;</button>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col sm:flex-row gap-4">
                    <input type="text" placeholder="Nome do novo ciclo temporal..." value={newPeriodName} onChange={e => setNewPeriodName(e.target.value)} className="flex-1 h-14 bg-slate-950/50 border border-white/10 rounded-2xl px-8 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                    <button onClick={addPeriod} className="h-14 px-10 bg-indigo-600 text-white rounded-2xl font-bold text-[10px] uppercase tracking-widest hover:bg-indigo-500 shadow-lg shadow-indigo-600/20">Criar Ciclo</button>
                  </div>
                </div>
              )}

              <form onSubmit={addTask} className="mb-16 space-y-6">
                <div className="flex flex-col sm:flex-row gap-4">
                  <input type="text" placeholder={activeSubTab === 'DAILY' ? "Injetar novo objetivo diário..." : "Estabelecer nova rotina cíclica..."} value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="flex-1 h-16 md:h-20 bg-slate-900/40 border border-white/10 rounded-[2rem] px-8 md:px-10 text-xl md:text-2xl text-white placeholder:text-slate-700 focus:outline-none focus:border-indigo-500/50 transition-all shadow-2xl" />
                  <button type="submit" className="h-16 md:h-20 px-10 md:px-14 bg-white text-slate-950 rounded-[2rem] font-space font-bold uppercase text-xs md:text-sm tracking-widest hover:bg-indigo-300 hover:scale-[1.02] active:scale-95 transition-all shadow-xl">Fixar Protocolo</button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pl-4">
                   <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Alocar em:</span>
                        <select value={selectedPeriodForAdd} onChange={e => setSelectedPeriodForAdd(e.target.value)} className="bg-slate-900/60 border border-white/10 rounded-xl px-5 py-2.5 text-[10px] md:text-xs font-bold text-indigo-300 focus:outline-none focus:border-indigo-500 transition-all cursor-pointer">
                          {periods.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                          <option value="">Sem alocação específica</option>
                        </select>
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Adicionar Steps:</span>
                      </div>
                      <div className="flex gap-2">
                        <input type="text" placeholder="Adicionar sub-processo..." value={newStepInput} onChange={e => setNewStepInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTempStep())} className="flex-1 h-10 bg-slate-900/30 border border-white/5 rounded-xl px-4 text-xs text-white focus:outline-none focus:border-indigo-500/50" />
                        <button type="button" onClick={addTempStep} className="px-4 bg-slate-800 text-white rounded-xl text-xs font-bold">+</button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {tempSteps.map((s, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg animate-in zoom-in-50 duration-300">
                            <span className="text-[10px] text-indigo-300 font-medium">{s}</span>
                            <button type="button" onClick={() => removeTempStep(i)} className="text-red-400 text-xs font-bold">&times;</button>
                          </div>
                        ))}
                      </div>
                   </div>
                </div>
              </form>

              {/* Grid de Tarefas */}
              <div className="space-y-16">
                {[...periods, { id: 'unassigned', name: 'Alocações Indefinidas' }]
                  .filter(p => filterPeriodId === 'all' || filterPeriodId === p.id)
                  .map(period => {
                    const periodTasks = tasks.filter(t => t.type === activeSubTab && (t.periodId === period.id || (period.id === 'unassigned' && !t.periodId)));
                    if (periodTasks.length === 0) return null;
                    
                    return (
                      <div key={period.id} className="animate-in fade-in slide-in-from-bottom-2">
                        <h4 className="text-[11px] font-bold text-indigo-400/60 uppercase tracking-[0.5em] mb-6 ml-6 flex items-center gap-4">
                          <span className={`w-2.5 h-2.5 rounded-full ${activeSubTab === 'DAILY' ? 'bg-pink-500/40' : 'bg-cyan-500/40'}`} />
                          {period.name}
                        </h4>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {periodTasks.map(task => {
                            const completedSteps = task.steps?.filter(s => s.completed).length || 0;
                            const totalSteps = task.steps?.length || 0;
                            const stepProgress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

                            return (
                              <div key={task.id} onClick={() => (task.type === 'ROUTINE' || task.status === 'PENDING') && setActiveTask(task)} className={`group relative p-6 md:p-8 bg-slate-900/30 border border-white/5 rounded-[2.5rem] hover:bg-slate-900/50 hover:border-indigo-500/30 transition-all cursor-pointer overflow-hidden ${task.status === 'COMPLETED' ? 'opacity-50 grayscale' : 'shadow-2xl hover:shadow-indigo-500/10'}`}>
                                <div className="flex items-start justify-between mb-6">
                                  <div className="flex items-center gap-6">
                                    <div className={`w-1.5 h-12 rounded-full transition-all duration-500 ${task.status === 'COMPLETED' ? 'bg-emerald-500' : (task.type === 'DAILY' ? 'bg-pink-500' : 'bg-cyan-500')} group-hover:h-14`} />
                                    <div>
                                      <h3 className={`text-xl md:text-2xl font-space font-medium transition-colors ${task.status === 'COMPLETED' ? 'text-slate-500 line-through' : 'text-white group-hover:text-indigo-200'}`}>{task.title}</h3>
                                      {task.lastDone && <p className="text-[9px] uppercase tracking-widest text-slate-600 font-bold mt-2">Sincronizado: {new Date(task.lastDone).toLocaleTimeString()}</p>}
                                    </div>
                                  </div>
                                  <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="p-3 text-slate-700 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  </button>
                                </div>

                                {totalSteps > 0 && (
                                  <div className="mt-4 space-y-4" onClick={e => e.stopPropagation()}>
                                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-indigo-400/60 mb-2">
                                      <span>Nódulos de Memória</span>
                                      <span>{completedSteps}/{totalSteps}</span>
                                    </div>
                                    <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden mb-4">
                                      <div className="h-full bg-indigo-500 transition-all duration-700" style={{ width: `${stepProgress}%` }} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {task.steps?.map(step => (
                                        <div key={step.id} onClick={() => toggleStep(task.id, step.id)} className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition-all ${step.completed ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-200' : 'bg-slate-950/40 border-white/5 text-slate-500 hover:border-white/10'}`}>
                                          <div className={`w-3 h-3 rounded-full border-2 transition-all ${step.completed ? 'bg-indigo-400 border-indigo-300 shadow-[0_0_8px_rgba(129,140,248,0.5)]' : 'border-slate-800'}`} />
                                          <span className="text-[10px] font-bold truncate tracking-tight">{step.title}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                })}
              </div>
            </div>
          )}

          {mainView === 'EVOLUTION' && (
            <div className="animate-in fade-in zoom-in duration-700 min-h-full flex flex-col justify-center">
               <header className="mb-10 md:mb-16 flex flex-col items-center text-center">
                <span className="text-indigo-400 text-[10px] md:text-xs uppercase tracking-[0.6em] font-bold mb-6">Registro de Arquivos Akáshicos</span>
                <h1 className="text-6xl md:text-7xl lg:text-8xl font-space font-bold text-white tracking-tighter italic leading-none">A GRANDE<br/>EVOLUÇÃO</h1>
              </header>

              <div className="grid lg:grid-cols-12 gap-8 md:gap-12 items-stretch">
                <div className="lg:col-span-12 h-[350px] md:h-[500px] relative">
                    <div className="absolute inset-0 bg-slate-950/80 rounded-[4rem] border border-white/10 overflow-hidden shadow-2xl backdrop-blur-sm">
                        <UniverseVisual level={stats.level} />
                        <div className="absolute top-8 left-8 bg-slate-900/90 backdrop-blur-md border border-white/10 px-6 py-3 rounded-2xl shadow-xl">
                            <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.3em] flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
                                Visualizador Cronológico v4.1
                            </span>
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-5 flex">
                  <div className="glass rounded-[4rem] p-10 md:p-14 text-center relative overflow-hidden flex flex-col justify-center items-center w-full shadow-2xl">
                    <div className="w-40 h-40 md:w-52 md:h-52 rounded-full border-[10px] border-slate-900 flex items-center justify-center bg-slate-950 shadow-[0_0_80px_rgba(79,70,229,0.3)] mb-8 relative">
                       <div className="absolute inset-0 rounded-full border-2 border-white/5 animate-pulse" />
                      <span className="text-7xl md:text-8xl font-space font-bold text-white leading-none">{stats.level}</span>
                    </div>
                    <h2 className="text-2xl md:text-3xl font-space font-bold text-white mb-3">{currentLevel.name}</h2>
                    <p className="text-indigo-400 text-[10px] md:text-[11px] font-bold tracking-[0.4em] uppercase mb-10">{currentLevel.storyEra}</p>
                    <div className="w-full h-3 bg-slate-950 rounded-full border border-white/10 overflow-hidden relative shadow-inner">
                        <div className="h-full bg-gradient-to-r from-indigo-600 via-purple-500 to-cyan-400 transition-all duration-1000 shadow-[0_0_15px_rgba(99,102,241,0.5)]" style={{ width: `${progressPercent}%` }} />
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-7 flex">
                  <div className="bg-slate-900/30 border border-white/5 rounded-[4rem] p-10 md:p-16 flex flex-col justify-between items-start shadow-2xl w-full">
                    <div className="space-y-6">
                        <p className="text-2xl md:text-3xl lg:text-4xl font-light text-slate-200 italic leading-tight font-serif tracking-tight">
                            {isLoadingNarrative ? (
                                <span className="animate-pulse">Descriptografando frequências temporais...</span>
                            ) : (
                                `"${narrative}"` || "Estabeleça protocolos para gerar novos registros históricos."
                            )}
                        </p>
                    </div>
                    <button onClick={loadNarrative} className="mt-10 px-8 py-4 rounded-full border border-white/10 text-[10px] font-bold text-slate-400 uppercase tracking-widest hover:text-white hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all">Recalibrar Transmissão</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {mainView === 'STATISTICS' && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-700">
              <header className="mb-16 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
                <div>
                  <h1 className="text-4xl md:text-6xl font-space font-bold text-white tracking-tighter uppercase leading-none">Análise Temporal</h1>
                  <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.4em] mt-4">Mapeamento de Intensidade Universal</p>
                </div>
                <div className="flex gap-2 bg-slate-900/50 p-2 rounded-2xl border border-white/10 shadow-xl">
                  {(['DAY', 'MONTH', 'YEAR'] as StatPeriod[]).map(p => (
                    <button key={p} onClick={() => setStatPeriod(p)} className={`px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${statPeriod === p ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}>
                      {p === 'DAY' ? 'Dia' : p === 'MONTH' ? 'Mês' : 'Ano'}
                    </button>
                  ))}
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                <div className="bg-slate-900/30 border border-white/5 p-10 rounded-[3rem] flex flex-col items-center shadow-xl hover:border-indigo-500/20 transition-all">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-6">Investimento Temporal</span>
                  <span className="text-5xl font-space font-bold text-white tracking-tighter">{formatDuration(aggregatedData.totalSeconds)}</span>
                </div>
                <div className="bg-slate-900/30 border border-white/5 p-10 rounded-[3rem] flex flex-col items-center shadow-xl hover:border-emerald-500/20 transition-all">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-6">Sincronizações Ativas</span>
                  <span className="text-5xl font-space font-bold text-white tracking-tighter">
                    {(stats.timeLogs || []).filter(l => {
                        const d = new Date(l.timestamp);
                        const now = new Date();
                        if (statPeriod === 'DAY') return d.toDateString() === now.toDateString();
                        if (statPeriod === 'MONTH') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
                        return d.getFullYear() === now.getFullYear();
                    }).length}
                  </span>
                </div>
                <div className="bg-slate-900/30 border border-white/5 p-10 rounded-[3rem] flex flex-col items-center text-center shadow-xl hover:border-pink-500/20 transition-all">
                  <span className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-6">Vértice de Foco</span>
                  <span className="text-2xl md:text-3xl font-space font-bold text-white truncate w-full px-2">
                    {aggregatedData.byTask[0] ? aggregatedData.byTask[0][0] : 'Inativo'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Backup Modal */}
      {showBackupModal && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-[3.5rem] p-10 md:p-16 shadow-[0_30px_100px_rgba(0,0,0,0.9)]">
            <h2 className="text-3xl font-space font-bold text-white uppercase text-center mb-10 tracking-tighter">Nuvem Local</h2>
            <div className="space-y-5">
              <button onClick={handleExport} className="w-full py-7 bg-slate-950 border border-white/5 rounded-3xl text-indigo-400 font-bold uppercase text-xs tracking-widest hover:border-indigo-500 hover:bg-indigo-500/5 hover:scale-[1.02] active:scale-95 transition-all shadow-xl">Exportar Dados (.json)</button>
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-7 bg-slate-950 border border-white/5 rounded-3xl text-emerald-400 font-bold uppercase text-xs tracking-widest hover:border-emerald-500 hover:bg-emerald-500/5 hover:scale-[1.02] active:scale-95 transition-all shadow-xl">Importar Dados (.json)</button>
            </div>
            <button onClick={() => setShowBackupModal(false)} className="mt-10 w-full text-slate-600 hover:text-white uppercase text-[10px] font-bold tracking-[0.4em] transition-all">Desativar Interface</button>
          </div>
        </div>
      )}

      {activeTask && (
        <TimerModal task={activeTask} onClose={() => setActiveTask(null)} onComplete={handleTaskAction} />
      )}
    </div>
  );
};

export default App;
