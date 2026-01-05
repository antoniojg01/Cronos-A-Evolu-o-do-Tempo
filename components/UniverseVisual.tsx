
import React, { useEffect, useRef } from 'react';

interface UniverseVisualProps {
  level: number;
}

const UniverseVisual: React.FC<UniverseVisualProps> = ({ level }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let entities: Entity[] = [];
    
    // Projeção Isométrica Otimizada
    const project = (x: number, y: number, z: number, width: number, height: number) => {
      const scale = Math.min(width, height) / 14;
      const isoX = (x - y) * Math.cos(Math.PI / 6);
      const isoY = (x + y) * Math.sin(Math.PI / 6) - z;
      return {
        x: width / 2 + isoX * scale,
        y: height / 2 + isoY * scale
      };
    };

    // Paletas de Cores por Era Evolutiva
    const getPalette = (lvl: number) => {
      if (lvl <= 3) return [ // Primordial / Dark
        { main: '#1e1b4b', sec: '#312e81', glow: '#4338ca' },
        { main: '#0f172a', sec: '#1e293b', glow: '#334155' }
      ];
      if (lvl <= 7) return [ // Estelar / Galáctico
        { main: '#4338ca', sec: '#6366f1', glow: '#818cf8' },
        { main: '#0891b2', sec: '#06b6d4', glow: '#22d3ee' },
        { main: '#f59e0b', sec: '#fbbf24', glow: '#fcd34d' }
      ];
      if (lvl <= 12) return [ // Biológico / Terrestre
        { main: '#059669', sec: '#10b981', glow: '#34d399' },
        { main: '#b91c1c', sec: '#dc2626', glow: '#ef4444' },
        { main: '#2563eb', sec: '#3b82f6', glow: '#60a5fa' }
      ];
      return [ // Futurista / Transcendental
        { main: '#7c3aed', sec: '#8b5cf6', glow: '#a78bfa' },
        { main: '#db2777', sec: '#ec4899', glow: '#f472b6' },
        { main: '#0284c7', sec: '#0ea5e9', glow: '#38bdf8' }
      ];
    };

    class Entity {
      x: number; y: number; z: number;
      size: number;
      color: string;
      secondaryColor: string;
      glowColor: string;
      targetZ: number;
      floatOffset: number;
      type: 'STAR' | 'BLOCK' | 'PLANET';
      
      orbitRadius: number;
      orbitAngle: number;
      orbitSpeed: number;
      seed: number;

      constructor(level: number) {
        this.seed = Math.random();
        const palettes = getPalette(level);
        const p = palettes[Math.floor(Math.random() * palettes.length)];
        
        this.color = p.main;
        this.secondaryColor = p.sec;
        this.glowColor = p.glow;

        const radius = 1.2 + Math.random() * 5.5;
        this.orbitRadius = radius;
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.orbitSpeed = (0.0005 + Math.random() * 0.002) / (Math.sqrt(radius) * 0.8);
        if (Math.random() > 0.5) this.orbitSpeed *= -1;

        this.x = Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = Math.sin(this.orbitAngle) * this.orbitRadius;
        this.z = -15 - Math.random() * 10; 
        this.targetZ = (Math.random() - 0.5) * 2;
        this.size = 0.3 + Math.random() * 0.5;
        this.floatOffset = Math.random() * Math.PI * 2;
        
        // Distribuição de tipos baseada no nível
        if (level < 5) this.type = 'STAR';
        else if (level < 10) this.type = Math.random() > 0.4 ? 'BLOCK' : 'STAR';
        else this.type = Math.random() > 0.6 ? 'PLANET' : (Math.random() > 0.5 ? 'BLOCK' : 'STAR');
      }

      update() {
        this.orbitAngle += this.orbitSpeed;
        this.x = Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = Math.sin(this.orbitAngle) * this.orbitRadius;
        this.z += (this.targetZ - this.z) * 0.03;
        this.floatOffset += 0.012;
      }

      draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const currentZ = this.z + Math.sin(this.floatOffset) * 0.2;
        const pos = project(this.x, this.y, currentZ, width, height);
        const s = this.size * (Math.min(width, height) / 22);

        ctx.save();
        ctx.translate(pos.x, pos.y);

        if (this.type === 'STAR') this.drawStar(ctx, s);
        else if (this.type === 'BLOCK') this.drawBlock(ctx, s);
        else this.drawPlanet(ctx, s);

        ctx.restore();
      }

      drawStar(ctx: CanvasRenderingContext2D, s: number) {
        const flicker = Math.sin(Date.now() * 0.01 + this.seed * 50) * 0.15 + 0.85;
        const ps = s * flicker;
        
        ctx.shadowBlur = 15 * flicker;
        ctx.shadowColor = this.glowColor;
        
        ctx.beginPath();
        ctx.moveTo(0, -ps * 1.2);
        ctx.lineTo(ps * 0.8, 0);
        ctx.lineTo(0, ps * 1.2);
        ctx.lineTo(-ps * 0.8, 0);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

        // Core
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, ps * 0.25, 0, Math.PI * 2);
        ctx.fill();
      }

      drawBlock(ctx: CanvasRenderingContext2D, s: number) {
        const h = s * 0.55;
        
        // Top
        ctx.beginPath();
        ctx.moveTo(0, -h); ctx.lineTo(s, 0); ctx.lineTo(0, h); ctx.lineTo(-s, 0);
        ctx.closePath();
        const topGrad = ctx.createLinearGradient(0, -h, 0, h);
        topGrad.addColorStop(0, this.secondaryColor);
        topGrad.addColorStop(1, this.color);
        ctx.fillStyle = topGrad;
        ctx.fill();

        // Right
        ctx.beginPath();
        ctx.moveTo(s, 0); ctx.lineTo(s, s); ctx.lineTo(0, h + s); ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fill();

        // Left
        ctx.beginPath();
        ctx.moveTo(-s, 0); ctx.lineTo(-s, s); ctx.lineTo(0, h + s); ctx.lineTo(0, h);
        ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fill();

        // Bevel / Edges
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      drawPlanet(ctx: CanvasRenderingContext2D, s: number) {
        // Atmosfera Volumétrica
        const atmosphere = ctx.createRadialGradient(0, 0, s * 0.8, 0, 0, s * 1.4);
        atmosphere.addColorStop(0, `${this.glowColor}44`);
        atmosphere.addColorStop(1, 'transparent');
        ctx.fillStyle = atmosphere;
        ctx.beginPath(); ctx.arc(0, 0, s * 1.4, 0, Math.PI * 2); ctx.fill();

        // Corpo
        const bodyGrad = ctx.createRadialGradient(-s/2, -s/2, 0, 0, 0, s);
        bodyGrad.addColorStop(0, '#ffffff');
        bodyGrad.addColorStop(0.2, this.secondaryColor);
        bodyGrad.addColorStop(0.7, this.color);
        bodyGrad.addColorStop(1, '#020617');
        
        ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fillStyle = bodyGrad; ctx.fill();
        
        // Textura Procedural
        ctx.save();
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        for(let i=0; i<4; i++) {
          const tx = Math.sin(this.seed * 10 + i) * s;
          const ty = Math.cos(this.seed * 20 + i) * s;
          ctx.beginPath();
          ctx.ellipse(tx, ty, s * 0.7, s * 0.15, this.seed * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Rim Light
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(0, 0, s, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();

        // Anéis
        if (this.seed > 0.7) {
          ctx.beginPath();
          ctx.ellipse(0, 0, s * 2.4, s * 0.6, Math.PI / 4, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    const init = () => {
      entities = [];
      const count = Math.min(150, 25 + level * 8);
      for (let i = 0; i < count; i++) {
        entities.push(new Entity(level));
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = Math.min(canvas.width, canvas.height) * 0.6;

      // Nebulosa Isométrica Aprimorada (Layers)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(1, 0.577); // Perspectiva Isométrica Standard

      // Camada Profunda de Contraste
      const deepNebula = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius * 1.5);
      deepNebula.addColorStop(0, '#0f172a');
      deepNebula.addColorStop(0.6, '#020617');
      deepNebula.addColorStop(1, '#020617');
      ctx.fillStyle = deepNebula;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius * 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Camada de Brilho de Fundo (Glow)
      const glowNebula = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius);
      glowNebula.addColorStop(0, 'rgba(79, 70, 229, 0.15)');
      glowNebula.addColorStop(0.4, 'rgba(124, 58, 237, 0.05)');
      glowNebula.addColorStop(0.8, 'rgba(67, 56, 202, 0.01)');
      glowNebula.addColorStop(1, 'transparent');
      ctx.fillStyle = glowNebula;
      ctx.beginPath();
      ctx.arc(0, 0, baseRadius, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.restore();

      // Grid Isométrico de Referência
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.06)';
      ctx.lineWidth = 1;
      const gridSize = 8;
      for (let i = -gridSize; i <= gridSize; i++) {
        const p1 = project(i, -gridSize, -1.5, canvas.width, canvas.height);
        const p2 = project(i, gridSize, -1.5, canvas.width, canvas.height);
        ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
        
        const p3 = project(-gridSize, i, -1.5, canvas.width, canvas.height);
        const p4 = project(gridSize, i, -1.5, canvas.width, canvas.height);
        ctx.beginPath(); ctx.moveTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.stroke();
      }

      // Núcleo Evolutivo Central (O "Sol")
      const nucleusPos = project(0, 0, Math.sin(Date.now() * 0.001) * 0.2, canvas.width, canvas.height);
      const nucleusSize = (1.5 + level * 0.1) * (Math.min(canvas.width, canvas.height) / 40);
      const nGrad = ctx.createRadialGradient(nucleusPos.x, nucleusPos.y, 0, nucleusPos.x, nucleusPos.y, nucleusSize * 2.5);
      
      const isAdvanced = level > 10;
      nGrad.addColorStop(0, isAdvanced ? '#ffffff' : '#4f46e5');
      nGrad.addColorStop(0.2, isAdvanced ? '#fbbf24' : '#6366f1');
      nGrad.addColorStop(0.6, isAdvanced ? '#f59e0b' : '#4338ca');
      nGrad.addColorStop(1, 'transparent');
      
      ctx.fillStyle = nGrad;
      ctx.beginPath(); 
      ctx.arc(nucleusPos.x, nucleusPos.y, nucleusSize * 2.5, 0, Math.PI * 2); 
      ctx.fill();

      // Z-Sorting Isométrico
      entities.sort((a, b) => (a.x + a.y) - (b.x + b.y));

      entities.forEach(e => {
        e.update();
        e.draw(ctx, canvas.width, canvas.height);
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      const container = canvas.parentElement;
      if (container) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        init();
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [level]);

  return (
    <div className="w-full h-full relative group">
      <canvas 
        ref={canvasRef} 
        className="w-full h-full block"
        style={{ cursor: 'crosshair' }}
      />
      <div className="absolute inset-0 pointer-events-none border-[1px] border-white/5 rounded-[4rem] shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]"></div>
    </div>
  );
};

export default UniverseVisual;
