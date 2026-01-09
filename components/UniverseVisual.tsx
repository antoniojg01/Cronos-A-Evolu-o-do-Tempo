
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
    
    const project = (x: number, y: number, z: number, width: number, height: number) => {
      const scale = Math.min(width, height) / 14;
      const isoX = (x - y) * Math.cos(Math.PI / 6);
      const isoY = (x + y) * Math.sin(Math.PI / 6) - z;
      return {
        x: width / 2 + isoX * scale,
        y: height / 2 + isoY * scale
      };
    };

    const getPalette = (lvl: number) => {
      if (lvl <= 3) return [ 
        { main: '#1e1b4b', sec: '#4f46e5', glow: '#818cf8' },
        { main: '#020617', sec: '#1e293b', glow: '#334155' }
      ];
      if (lvl <= 7) return [ 
        { main: '#4338ca', sec: '#6366f1', glow: '#a5b4fc' },
        { main: '#0891b2', sec: '#22d3ee', glow: '#67e8f9' },
        { main: '#d97706', sec: '#fbbf24', glow: '#fef3c7' }
      ];
      if (lvl <= 12) return [ 
        { main: '#059669', sec: '#10b981', glow: '#6ee7b7' },
        { main: '#b91c1c', sec: '#ef4444', glow: '#fca5a5' },
        { main: '#2563eb', sec: '#60a5fa', glow: '#93c5fd' }
      ];
      return [ 
        { main: '#7c3aed', sec: '#a78bfa', glow: '#ddd6fe' },
        { main: '#db2777', sec: '#f472b6', glow: '#fbcfe8' },
        { main: '#0284c7', sec: '#38bdf8', glow: '#bae6fd' }
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

        const radius = 1.2 + Math.random() * 6.5;
        this.orbitRadius = radius;
        this.orbitAngle = Math.random() * Math.PI * 2;
        this.orbitSpeed = (0.0004 + Math.random() * 0.001) / (Math.sqrt(radius) * 1.2);
        if (Math.random() > 0.5) this.orbitSpeed *= -1;

        this.x = Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = Math.sin(this.orbitAngle) * this.orbitRadius;
        this.z = -20 - Math.random() * 10; 
        this.targetZ = (Math.random() - 0.5) * 3;
        this.size = 0.25 + Math.random() * 0.6;
        this.floatOffset = Math.random() * Math.PI * 2;
        
        if (level < 4) this.type = 'STAR';
        else if (level < 9) this.type = Math.random() > 0.3 ? 'BLOCK' : 'STAR';
        else this.type = Math.random() > 0.7 ? 'PLANET' : (Math.random() > 0.4 ? 'BLOCK' : 'STAR');
      }

      update() {
        this.orbitAngle += this.orbitSpeed;
        this.x = Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = Math.sin(this.orbitAngle) * this.orbitRadius;
        this.z += (this.targetZ - this.z) * 0.02;
        this.floatOffset += 0.008;
      }

      draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const currentZ = this.z + Math.sin(this.floatOffset) * 0.3;
        const pos = project(this.x, this.y, currentZ, width, height);
        const s = this.size * (Math.min(width, height) / 20);

        ctx.save();
        ctx.translate(pos.x, pos.y);

        if (this.type === 'STAR') this.drawStar(ctx, s);
        else if (this.type === 'BLOCK') this.drawBlock(ctx, s);
        else this.drawPlanet(ctx, s);

        ctx.restore();
      }

      drawStar(ctx: CanvasRenderingContext2D, s: number) {
        const flicker = Math.sin(Date.now() * 0.015 + this.seed * 100) * 0.2 + 0.8;
        const ps = s * flicker;
        
        ctx.shadowBlur = 20 * flicker;
        ctx.shadowColor = this.glowColor;
        
        ctx.beginPath();
        ctx.moveTo(0, -ps * 1.5);
        ctx.lineTo(ps * 0.6, 0);
        ctx.lineTo(0, ps * 1.5);
        ctx.lineTo(-ps * 0.6, 0);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, ps * 0.3, 0, Math.PI * 2); ctx.fill();
      }

      drawBlock(ctx: CanvasRenderingContext2D, s: number) {
        const h = s * 0.577;
        
        // Top Face
        ctx.beginPath();
        ctx.moveTo(0, -h); ctx.lineTo(s, 0); ctx.lineTo(0, h); ctx.lineTo(-s, 0); ctx.closePath();
        const topGrad = ctx.createLinearGradient(0, -h, 0, h);
        topGrad.addColorStop(0, this.secondaryColor);
        topGrad.addColorStop(1, this.color);
        ctx.fillStyle = topGrad;
        ctx.fill();

        // Right Face (Darker)
        ctx.beginPath();
        ctx.moveTo(s, 0); ctx.lineTo(s, s); ctx.lineTo(0, h + s); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        ctx.fill();

        // Left Face (Darkest)
        ctx.beginPath();
        ctx.moveTo(-s, 0); ctx.lineTo(-s, s); ctx.lineTo(0, h + s); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.65)';
        ctx.fill();

        // Highlight Edges
        ctx.strokeStyle = this.glowColor + '44';
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      drawPlanet(ctx: CanvasRenderingContext2D, s: number) {
        // Corona/Atmosphere Glow
        const atmosphere = ctx.createRadialGradient(0, 0, s * 0.9, 0, 0, s * 1.5);
        atmosphere.addColorStop(0, this.glowColor + '66');
        atmosphere.addColorStop(1, 'transparent');
        ctx.fillStyle = atmosphere;
        ctx.beginPath(); ctx.arc(0, 0, s * 1.5, 0, Math.PI * 2); ctx.fill();

        // Sphere Body
        const bodyGrad = ctx.createRadialGradient(-s/3, -s/3, 0, 0, 0, s);
        bodyGrad.addColorStop(0, '#ffffff');
        bodyGrad.addColorStop(0.3, this.secondaryColor);
        bodyGrad.addColorStop(0.8, this.color);
        bodyGrad.addColorStop(1, '#020617');
        
        ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); ctx.fillStyle = bodyGrad; ctx.fill();
        
        // Clouds/Detail
        ctx.save();
        ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        for(let i=0; i<3; i++) {
          const tAngle = this.seed * 10 + i + (Date.now() * 0.0001);
          const tx = Math.sin(tAngle) * s * 0.5;
          const ty = Math.cos(tAngle * 1.5) * s * 0.5;
          ctx.beginPath();
          ctx.ellipse(tx, ty, s * 0.8, s * 0.2, this.seed * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();

        // Rings
        if (this.seed > 0.75) {
          ctx.beginPath();
          ctx.ellipse(0, 0, s * 2.5, s * 0.7, Math.PI / 6, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.2)';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }

    const init = () => {
      entities = [];
      const count = Math.min(200, 30 + level * 12);
      for (let i = 0; i < count; i++) {
        entities.push(new Entity(level));
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = Math.min(canvas.width, canvas.height) * 0.7;

      // Isometric Nebulae
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(1, 0.577);
      
      const nebula = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius);
      nebula.addColorStop(0, 'rgba(67, 56, 202, 0.12)');
      nebula.addColorStop(0.5, 'rgba(124, 58, 237, 0.04)');
      nebula.addColorStop(1, 'transparent');
      ctx.fillStyle = nebula;
      ctx.beginPath(); ctx.arc(0, 0, baseRadius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Core Star
      const corePos = project(0, 0, Math.sin(Date.now() * 0.0008) * 0.3, canvas.width, canvas.height);
      const coreSize = (2 + level * 0.12) * (Math.min(canvas.width, canvas.height) / 45);
      const coreGrad = ctx.createRadialGradient(corePos.x, corePos.y, 0, corePos.x, corePos.y, coreSize * 3);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, level > 12 ? '#f472b6' : '#6366f1');
      coreGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.beginPath(); ctx.arc(corePos.x, corePos.y, coreSize * 3, 0, Math.PI * 2); ctx.fill();

      // Render Entities
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
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute inset-0 pointer-events-none rounded-[4rem] shadow-[inset_0_0_120px_rgba(0,0,0,0.9)]"></div>
    </div>
  );
};

export default UniverseVisual;
