
import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- CONFIGURAÇÕES E CONSTANTES ---
const XP_COMPLETED = 10;
const XP_STEP = 2;
const XP_GAVE_UP = -5;

const LEVELS = [
  { level: 1, name: "A Singularidade", xpRequired: 0, storyEra: "O Big Bang" },
  { level: 2, name: "Radiação Primordial", xpRequired: 50, storyEra: "A Inflação Cósmica" },
  { level: 3, name: "A Era das Trevas", xpRequired: 150, storyEra: "Formação dos Primeiros Átomos" },
  { level: 4, name: "Estrelas de Primeira Geração", xpRequired: 300, storyEra: "O Reacendimento do Universo" },
  { level: 5, name: "Cadinho de Elementos", xpRequired: 500, storyEra: "Supernovas e Metalicidade" },
  { level: 6, name: "Arquitetura Galáctica", xpRequired: 800, storyEra: "Formação da Via Láctea" },
  { level: 7, name: "Nascimento Solar", xpRequired: 1200, storyEra: "O Sistema Solar Primitivo" },
  { level: 8, name: "Mundo de Magma", xpRequired: 1700, storyEra: "Hadeano: A Terra Recém-Nascida" },
  { level: 9, name: "Sopa Orgânica", xpRequired: 2300, storyEra: "O Surgimento da Vida (ABIOGÊNESE)" },
  { level: 10, name: "Grande Oxidação", xpRequired: 3000, storyEra: "Cianobactérias e a Mudança Atmosférica" },
  { level: 11, name: "Complexidade Celular", xpRequired: 4000, storyEra: "A Ascensão dos Eucariontes" },
  { level: 12, name: "Explosão Cambriana", xpRequired: 5500, storyEra: "A Diversificação da Vida Marinha" },
  { level: 13, name: "Conquista da Terra", xpRequired: 7500, storyEra: "Plantas e Anfíbios nos Continentes" },
  { level: 14, name: "Era dos Gigantes", xpRequired: 10000, storyEra: "O Reinado dos Dinossauros" },
  { level: 15, name: "Aurora Humana", xpRequired: 13000, storyEra: "Hominídeos e o Domínio do Fogo" },
  { level: 16, name: "Civilização", xpRequired: 17000, storyEra: "Escrita, Agricultura e Impérios" },
  { level: 17, name: "O Presente", xpRequired: 22000, storyEra: "Era Digital e Exploração Espacial" }
];

// --- COMPONENTES AUXILIARES ---

// 1. Visual do Universo
const UniverseVisual: React.FC<{ level: number }> = ({ level }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let frame: number;
    const particles = Array.from({ length: 80 + level * 5 }, () => ({
      x: (Math.random() - 0.5) * 10,
      y: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 10,
      s: Math.random() * 2 + 1,
      angle: Math.random() * Math.PI * 2,
      speed: 0.001 + Math.random() * 0.002
    }));

    const project = (x: number, y: number, z: number, w: number, h: number) => {
      const scale = Math.min(w, h) / 12;
      return {
        x: w / 2 + (x - y) * Math.cos(Math.PI / 6) * scale,
        y: h / 2 + ((x + y) * Math.sin(Math.PI / 6) - z) * scale
      };
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width; const h = canvas.height;
      particles.forEach(p => {
        p.angle += p.speed;
        const x = Math.cos(p.angle) * p.x;
        const y = Math.sin(p.angle) * p.y;
        const pos = project(x, y, p.z, w, h);
        ctx.fillStyle = level > 10 ? '#818cf8' : '#4338ca';
        ctx.beginPath(); ctx.arc(pos.x, pos.y, p.s, 0, Math.PI * 2); ctx.fill();
      });
      frame = requestAnimationFrame(animate);
    };

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    window.addEventListener('resize', resize); resize(); animate();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', resize); };
  }, [level]);
  return <canvas ref={canvasRef} className="w-full h-full" />;
};

// 2. Cronômetro Modal
const TimerModal: React.FC<any> = ({ task, onClose, onComplete }) => {
  const [mode, setMode] = useState('POMODORO');
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [isActive, setIsActive] = useState(false);
  const [accumulated, setAccumulated] = useState(0);

  useEffect(() => {
    let int: any;
    if (isActive && (mode === 'STOPWATCH' || timeLeft > 0)) {
      int = setInterval(() => {
        if (mode === 'STOPWATCH') setTimeLeft(t => t + 1);
        else setTimeLeft(t => t - 1);
        setAccumulated(a => a + 1);
      }, 1000);
    }
    return () => clearInterval(int);
  }, [isActive, mode, timeLeft]);

  const format = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl flex items-center justify-center z-[100] p-4 animate-in fade-in">
      <div className="bg-[#0a0f1e] border-2 border-indigo-500/20 rounded-[4rem] w-full max-w-lg p-12 text-center shadow-2xl">
        <span className="text-indigo-400 text-[10px] uppercase tracking-widest font-bold mb-4 block">Sincronizador Universal</span>
        <h3 className="text-3xl font-space font-bold text-white mb-10">{task.title}</h3>
        
        <div className="flex justify-center gap-2 mb-10">
          {['POMODORO', 'TIMER', 'STOPWATCH'].map(m => (
            <button key={m} onClick={() => { setMode(m); setTimeLeft(m === 'STOPWATCH' ? 0 : 25 * 60); setIsActive(false); }} className={`px-4 py-2 rounded-xl text-[9px] font-bold tracking-widest uppercase border ${mode === m ? 'bg-indigo-600 border-indigo-500' : 'border-white/5 text-slate-600'}`}>{m}</button>
          ))}
        </div>

        <div className="text-[6rem] font-space font-bold text-white mb-10 tabular-nums leading-none tracking-tighter">
          {format(timeLeft)}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <button onClick={() => setIsActive(!isActive)} className="h-16 bg-white text-black rounded-3xl font-bold uppercase text-xs tracking-widest">{isActive ? 'Pausar' : 'Iniciar'}</button>
          <button onClick={() => setTimeLeft(mode === 'STOPWATCH' ? 0 : 25 * 60)} className="h-16 bg-slate-900 text-white rounded-3xl font-bold uppercase text-xs tracking-widest">Reset</button>
        </div>

        <button onClick={() => onComplete('COMPLETED', accumulated)} className="w-full h-20 bg-indigo-600 rounded-3xl font-bold uppercase text-xs tracking-widest mb-4 shadow-lg shadow-indigo-600/20">Finalizar e Registrar</button>
        <button onClick={onClose} className="text-slate-600 text-[10px] uppercase font-bold tracking-widest hover:text-white transition-colors">Abortar Protocolo</button>
      </div>
    </div>
  );
};

// --- APLICATIVO PRINCIPAL ---
const App: React.FC = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<'DASHBOARD' | 'EVOLUTION' | 'STATS'>('DASHBOARD');
  const [subView, setSubView] = useState<'DAILY' | 'ROUTINE'>('DAILY');
  const [activeTask, setActiveTask] = useState<any>(null);
  
  // States do Sistema
  const [tasks, setTasks] = useState<any[]>(() => JSON.parse(localStorage.getItem('cronos_tasks_v2') || '[]'));
  const [stats, setStats] = useState<any>(() => JSON.parse(localStorage.getItem('cronos_stats_v2') || '{"xp":0,"level":1,"logs":[]}'));
  const [periods, setPeriods] = useState<any[]>(() => JSON.parse(localStorage.getItem('cronos_periods_v2') || '[{"id":"p1","name":"Manhã"},{"id":"p2","name":"Tarde"},{"id":"p3","name":"Noite"}]'));
  
  // UI States
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState(periods[0]?.id || '');
  const [narrative, setNarrative] = useState('');
  const [isLoadingNarrative, setIsLoadingNarrative] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showPeriodManager, setShowPeriodManager] = useState(false);
  const [newPeriodName, setNewPeriodName] = useState('');

  useEffect(() => {
    localStorage.setItem('cronos_tasks_v2', JSON.stringify(tasks));
    localStorage.setItem('cronos_stats_v2', JSON.stringify(stats));
    localStorage.setItem('cronos_periods_v2', JSON.stringify(periods));
    if ((window as any).hideAppLoader) (window as any).hideAppLoader();
  }, [tasks, stats, periods]);

  // Lógica de XP e Narrativa
  const updateXP = (amount: number, status: string, seconds: number = 0, task?: any) => {
    setStats((prev: any) => {
      const newXP = Math.max(0, prev.xp + amount);
      const nextLevel = LEVELS.find(l => l.xpRequired > newXP);
      const newLvl = nextLevel ? nextLevel.level - 1 : LEVELS[LEVELS.length - 1].level;
      const newLog = seconds > 0 ? { t: Date.now(), s: seconds, task: task?.title || 'Protocolo' } : null;
      return { 
        ...prev, 
        xp: newXP, 
        level: Math.max(1, newLvl), 
        logs: newLog ? [...prev.logs, newLog] : prev.logs 
      };
    });
  };

  const loadNarrative = async () => {
    const curLvl = LEVELS.find(l => l.level === stats.level) || LEVELS[0];
    setIsLoadingNarrative(true);
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("No Key");
      const ai = new GoogleGenAI({ apiKey });
      const res = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Descreva em um parágrafo curto e épico a era: ${curLvl.storyEra} (Nível ${curLvl.level} da evolução do universo). Fale sobre o progresso do guardião.`
      });
      setNarrative(res.text || "O cosmos aguarda...");
    } catch {
      setNarrative(`Você está na era ${curLvl.storyEra}. Cada tarefa concluída expande as fronteiras deste novo mundo.`);
    }
    setIsLoadingNarrative(false);
  };

  useEffect(() => { if (view === 'EVOLUTION' && !narrative) loadNarrative(); }, [view, stats.level]);

  // CRUD Tarefas
  const addTask = (e: React.FormEvent) => {
    e.preventDefault(); if (!newTaskTitle.trim()) return;
    const task = {
      id: crypto.randomUUID(),
      title: newTaskTitle,
      type: subView,
      periodId: subView === 'ROUTINE' ? selectedPeriod : undefined,
      status: 'PENDING',
      steps: []
    };
    setTasks([...tasks, task]);
    setNewTaskTitle('');
  };

  const toggleStep = (taskId: string, stepTitle: string) => {
    setTasks(tasks.map(t => {
      if (t.id === taskId) {
        const steps = t.steps || [];
        const exists = steps.find((s: any) => s.title === stepTitle);
        if (exists) {
          updateXP(-XP_STEP, 'STEP_REMOVED');
          return { ...t, steps: steps.filter((s: any) => s.title !== stepTitle) };
        } else {
          updateXP(XP_STEP, 'STEP_ADDED');
          return { ...t, steps: [...steps, { title: stepTitle, completed: true }] };
        }
      }
      return t;
    }));
  };

  const handleTaskAction = (status: string, seconds: number) => {
    if (status === 'COMPLETED') updateXP(XP_COMPLETED, status, seconds, activeTask);
    if (activeTask.type === 'DAILY') setTasks(tasks.filter(t => t.id !== activeTask.id));
    else setTasks(tasks.map(t => t.id === activeTask.id ? { ...t, lastDone: Date.now() } : t));
    setActiveTask(null);
  };

  const addPeriod = () => {
    if (!newPeriodName.trim()) return;
    const p = { id: crypto.randomUUID(), name: newPeriodName };
    setPeriods([...periods, p]);
    setNewPeriodName('');
  };

  const removePeriod = (id: string) => {
    setPeriods(periods.filter(p => p.id !== id));
    setTasks(tasks.map(t => t.periodId === id ? { ...t, periodId: undefined } : t));
  };

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-[#020617] text-slate-200 overflow-hidden">
      {/* Sidebar */}
      <nav className="w-full md:w-24 bg-slate-900/40 border-r border-white/5 flex md:flex-col items-center p-4 gap-6 z-50">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-2xl shadow-lg shadow-indigo-600/30">C</div>
        
        <button onClick={() => setView('DASHBOARD')} className={`p-3 rounded-xl transition-all ${view === 'DASHBOARD' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 6h16M4 12h16m-7 6h7"/></svg>
        </button>

        <button onClick={() => setView('EVOLUTION')} className={`p-3 rounded-xl transition-all ${view === 'EVOLUTION' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        </button>

        {/* ÍCONE DE MÉTRICAS CORRIGIDO E GARANTIDO */}
        <button onClick={() => setView('STATS')} className={`p-3 rounded-xl transition-all ${view === 'STATS' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </button>

        <div className="mt-auto hidden md:flex flex-col items-center gap-4">
          <button onClick={() => setShowBackup(true)} className="p-3 text-slate-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
          </button>
          <div className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-[10px] font-bold text-indigo-400">{stats.level}</div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-12 lg:p-20 scroll-smooth">
        {view === 'DASHBOARD' && (
          <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4">
            <header className="mb-12 flex justify-between items-end">
              <div>
                <h1 className="text-4xl md:text-6xl font-space font-bold text-white uppercase tracking-tighter mb-2">Protocolo Ativo</h1>
                <p className="text-slate-600 font-bold uppercase tracking-widest text-[10px]">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              </div>
              <button onClick={() => setShowPeriodManager(!showPeriodManager)} className={`px-5 py-2 rounded-xl text-[9px] font-bold uppercase tracking-[0.3em] border transition-all ${showPeriodManager ? 'bg-indigo-600/20 border-indigo-500 text-indigo-400' : 'border-white/10 text-slate-600 hover:text-white'}`}>
                Personalizar Ciclos
              </button>
            </header>

            {showPeriodManager && (
              <div className="mb-12 p-8 bg-slate-900/40 border border-indigo-500/20 rounded-[3rem] animate-in slide-in-from-top-4">
                <h3 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-6">Gerenciador de Ciclos Temporais</h3>
                <div className="flex flex-wrap gap-4 mb-8">
                  {periods.map(p => (
                    <div key={p.id} className="group flex items-center gap-3 px-5 py-3 bg-slate-950/80 border border-white/5 rounded-2xl">
                      <span className="text-xs font-bold text-slate-300">{p.name}</span>
                      <button onClick={() => removePeriod(p.id)} className="text-slate-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">&times;</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <input type="text" value={newPeriodName} onChange={e => setNewPeriodName(e.target.value)} placeholder="Novo ciclo (ex: Madrugada)..." className="flex-1 h-12 bg-slate-950/50 border border-white/10 rounded-2xl px-6 text-sm outline-none focus:border-indigo-500" />
                  <button onClick={addPeriod} className="h-12 px-8 bg-indigo-600 text-white rounded-2xl font-bold uppercase text-[10px] tracking-widest">Adicionar</button>
                </div>
              </div>
            )}

            <div className="flex gap-4 mb-12 bg-slate-900/40 p-1.5 rounded-3xl border border-white/5 w-fit">
              <button onClick={() => setSubView('DAILY')} className={`px-10 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${subView === 'DAILY' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-400'}`}>Objetivos</button>
              <button onClick={() => setSubView('ROUTINE')} className={`px-10 py-3 rounded-2xl text-[10px] font-bold uppercase tracking-widest transition-all ${subView === 'ROUTINE' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-400'}`}>Rotinas</button>
            </div>

            <form onSubmit={addTask} className="mb-16 space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <input type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder={subView === 'DAILY' ? "Novo objetivo..." : "Estabelecer rotina..."} className="flex-1 h-16 bg-slate-900/50 border border-white/10 rounded-3xl px-8 text-xl text-white outline-none focus:border-indigo-500 shadow-2xl" />
                <button type="submit" className="h-16 px-12 bg-white text-black rounded-3xl font-space font-bold uppercase text-xs tracking-widest shadow-xl hover:bg-indigo-400 transition-all">Fixar</button>
              </div>
              {subView === 'ROUTINE' && (
                <div className="flex items-center gap-4 pl-4">
                   <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Vincular ao Ciclo:</span>
                   <select value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)} className="bg-transparent text-indigo-400 font-bold text-xs uppercase outline-none cursor-pointer">
                     {periods.map(p => <option key={p.id} value={p.id} className="bg-slate-900 text-white">{p.name}</option>)}
                   </select>
                </div>
              )}
            </form>

            <div className="space-y-12">
              {periods.map(period => {
                const pTasks = tasks.filter(t => t.type === subView && (subView === 'DAILY' || t.periodId === period.id));
                if (pTasks.length === 0 && subView === 'ROUTINE') return null;
                return (
                  <section key={period.id}>
                    {subView === 'ROUTINE' && <h2 className="text-[11px] font-bold text-indigo-400 uppercase tracking-[0.4em] mb-6 flex items-center gap-4"><span className="w-1.5 h-1.5 rounded-full bg-indigo-600"/>{period.name}</h2>}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {pTasks.map(task => (
                        <div key={task.id} onClick={() => setActiveTask(task)} className="p-8 bg-slate-900/30 border border-white/5 rounded-[2.5rem] hover:bg-slate-900/50 cursor-pointer transition-all group relative overflow-hidden">
                          <div className="flex justify-between items-start mb-6">
                            <h3 className="text-2xl font-space font-medium text-white group-hover:text-indigo-300 transition-colors">{task.title}</h3>
                            <button onClick={(e) => { e.stopPropagation(); setTasks(tasks.filter(t => t.id !== task.id)); }} className="text-slate-800 hover:text-red-500 transition-colors">&times;</button>
                          </div>
                          
                          {/* Mini Steps */}
                          <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                            {(task.steps || []).map((s: any, i: number) => <span key={i} className="px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-[9px] font-bold text-indigo-300 uppercase">{s.title}</span>)}
                            <button onClick={() => { const s = prompt('Sub-tarefa:'); if(s) toggleStep(task.id, s); }} className="px-3 py-1 bg-white/5 border border-white/5 rounded-lg text-[9px] font-bold text-slate-600 uppercase hover:text-white">+</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
              {subView === 'DAILY' && tasks.filter(t => t.type === 'DAILY').length === 0 && (
                <p className="text-center text-slate-700 py-10 uppercase font-bold text-[10px] tracking-widest">Nenhum protocolo pendente no arquivo.</p>
              )}
            </div>
          </div>
        )}

        {view === 'EVOLUTION' && (
          <div className="h-full flex flex-col animate-in zoom-in duration-700">
            <header className="mb-10 text-center">
              <span className="text-indigo-400 text-[10px] font-bold uppercase tracking-[0.5em] mb-4 block">Registro Akáshico</span>
              <h1 className="text-5xl md:text-7xl font-space font-bold text-white tracking-tighter italic">A GRANDE EVOLUÇÃO</h1>
            </header>
            <div className="flex-1 grid lg:grid-cols-2 gap-8 items-center">
              <div className="aspect-square relative"><UniverseVisual level={stats.level} /></div>
              <div className="space-y-8 bg-slate-900/20 border border-white/5 p-12 rounded-[4rem] backdrop-blur-xl">
                 <div>
                    <div className="w-20 h-20 rounded-full bg-indigo-600 flex items-center justify-center text-3xl font-bold mb-6">{stats.level}</div>
                    <h2 className="text-4xl font-space font-bold text-white">{LEVELS[stats.level - 1]?.name || "Fronteira Final"}</h2>
                    <p className="text-indigo-400 text-xs font-bold uppercase tracking-widest mt-2">{LEVELS[stats.level - 1]?.storyEra || "Infinito"}</p>
                 </div>
                 <p className="text-2xl text-slate-400 italic font-serif leading-relaxed">
                   {isLoadingNarrative ? "Sincronizando com a rede neural..." : narrative}
                 </p>
                 <button onClick={loadNarrative} className="px-8 py-3 border border-white/10 rounded-2xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-all">Recalibrar Arquivo</button>
              </div>
            </div>
          </div>
        )}

        {view === 'STATS' && (
          <div className="max-w-4xl mx-auto animate-in fade-in slide-in-from-right-4 duration-700">
             <h1 className="text-4xl font-space font-bold text-white uppercase mb-12 tracking-tighter">Métricas de Foco</h1>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
                <div className="p-10 bg-slate-900/30 border border-white/5 rounded-[3rem] text-center">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest block mb-4">XP Total</span>
                  <div className="text-6xl font-space font-bold text-white">{stats.xp}</div>
                </div>
                <div className="p-10 bg-slate-900/30 border border-white/5 rounded-[3rem] text-center">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-4">Investimento</span>
                  <div className="text-6xl font-space font-bold text-white">{Math.floor((stats.logs || []).reduce((acc:any, l:any) => acc + (l.s || 0), 0) / 60)}m</div>
                </div>
                <div className="p-10 bg-slate-900/30 border border-white/5 rounded-[3rem] text-center">
                  <span className="text-[10px] font-bold text-purple-400 uppercase tracking-widest block mb-4">Era Atual</span>
                  <div className="text-6xl font-space font-bold text-white">{stats.level}</div>
                </div>
             </div>
             <div className="space-y-4">
               <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">Logs Recentes</h3>
               {(stats.logs || []).slice(-5).reverse().map((l:any, i:number) => (
                 <div key={i} className="p-6 bg-slate-900/20 border border-white/5 rounded-2xl flex justify-between items-center">
                   <span className="font-medium">{l.task}</span>
                   <span className="text-indigo-400 font-space font-bold">+{Math.floor(l.s / 60)}m</span>
                 </div>
               ))}
               {(stats.logs || []).length === 0 && <p className="text-center text-slate-700 uppercase font-bold text-[9px] tracking-widest py-10">Nenhum registro encontrado.</p>}
             </div>
          </div>
        )}
      </main>

      {/* Backup Modal */}
      {showBackup && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-3xl flex items-center justify-center z-[200] p-6 animate-in fade-in">
           <div className="bg-[#0a0f1e] border border-white/10 rounded-[4rem] p-12 w-full max-w-md text-center">
             <h2 className="text-3xl font-space font-bold text-white uppercase mb-10">Backup Universal</h2>
             <div className="grid gap-4">
               <button onClick={() => {
                 const blob = new Blob([JSON.stringify({ tasks, stats, periods })], { type: 'application/json' });
                 const url = URL.createObjectURL(blob);
                 const a = document.createElement('a'); a.href = url; a.download = `cronos_backup.json`; a.click();
               }} className="h-16 bg-white text-black rounded-3xl font-bold uppercase text-[10px]">Exportar Dados (.json)</button>
               <button onClick={() => fileInputRef.current?.click()} className="h-16 bg-slate-900 text-white border border-white/10 rounded-3xl font-bold uppercase text-[10px]">Importar Dados</button>
               <button onClick={() => setShowBackup(false)} className="mt-4 text-slate-600 text-[9px] font-bold uppercase tracking-widest">Fechar</button>
             </div>
           </div>
        </div>
      )}

      <input type="file" ref={fileInputRef} className="hidden" accept=".json" onChange={e => {
        const file = e.target.files?.[0]; if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev: any) => {
          try {
            const data = JSON.parse(ev.target.result);
            if(data.tasks) setTasks(data.tasks);
            if(data.stats) setStats(data.stats);
            if(data.periods) setPeriods(data.periods);
            setShowBackup(false);
          } catch { alert("Arquivo inválido"); }
        };
        reader.readAsText(file);
      }} />

      {/* Timer Modal */}
      {activeTask && <TimerModal task={activeTask} onClose={() => setActiveTask(null)} onComplete={handleTaskAction} />}
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
