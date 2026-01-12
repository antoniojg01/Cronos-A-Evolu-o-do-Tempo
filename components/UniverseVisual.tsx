import React, { useEffect, useRef } from 'react';
import { NebulaTheme } from '../types.ts';

interface UniverseVisualProps {
  level: number;
  nebulaTheme?: NebulaTheme;
}

const UniverseVisual: React.FC<UniverseVisualProps> = ({ level, nebulaTheme }) => {
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

    // Paletas recalibradas para vibração máxima e contraste estelar
    const getPalette = (lvl: number) => {
      if (lvl <= 4) return [ 
        { main: '#081421', sec: '#00f2ff', glow: '#a5f3fc' }, // Cyan Elétrico
        { main: '#110c3b', sec: '#7d5fff', glow: '#dcd3ff' }, // Violeta Neon
        { main: '#0a1a12', sec: '#00ff9d', glow: '#ccffeb' }  // Esmeralda Digital
      ];
      
      if (lvl <= 8) return [ 
        { main: '#330000', sec: '#ff3e3e', glow: '#ffe4e4' }, // Plasma Vermelho
        { main: '#2b1a00', sec: '#ffaa00', glow: '#fff4cc' }, // Ouro Solar
        { main: '#0a0033', sec: '#4444ff', glow: '#ccccff' }, // Estrela de Neutrons
        { main: '#2b002b', sec: '#ff00ff', glow: '#ffccff' }  // Magenta Atômico
      ];
      
      if (lvl <= 12) return [ 
        { main: '#002b1a', sec: '#00ffcc', glow: '#e6fff9' }, // Turquesa Vital
        { main: '#001a33', sec: '#33ccff', glow: '#e6f7ff' }, // Azul Biosfera
        { main: '#33001a', sec: '#ff3399', glow: '#ffe6f2' }, // Flora Galáctica
        { main: '#1a0033', sec: '#9933ff', glow: '#f2e6ff' }  // Nebulosa Púrpura
      ];
      
      if (lvl <= 15) return [ 
        { main: '#000000', sec: '#ff0066', glow: '#ffffff' }, // Cyber Rose
        { main: '#000000', sec: '#00ffff', glow: '#ffffff' }, // Electric Cyan
        { main: '#000000', sec: '#ffff00', glow: '#ffffff' }, // Pure Gold
        { main: '#000000', sec: '#00ff00', glow: '#ffffff' }  // Acid Green
      ];
      
      return [ 
        { main: '#000000', sec: '#ffffff', glow: '#ffffff' }, // Singularidade Branca
        { main: '#000000', sec: '#ff3300', glow: '#ffffff' }, // Radiação Gamma
        { main: '#000000', sec: '#0066ff', glow: '#ffffff' }, // Deep Space Blue
        { main: '#000000', sec: '#cc00ff', glow: '#ffffff' }  // Void Purple
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
      energyLevel: number;

      constructor(level: number) {
        this.seed = Math.random();
        this.energyLevel = 1 + (level * 0.15); 
        const palettes = getPalette(level);
        const p = palettes[Math.floor(Math.random() * palettes.length)];
        
        this.color = p.main;
        this.secondaryColor = p.sec;
        this.glowColor = p.glow;

        const radius = 1.0 + Math.random() * 8.0;
        this.orbitRadius = radius;
        this.orbitAngle = Math.random() * Math.PI * 2;
        
        const baseSpeed = (0.0006 + Math.random() * 0.003) * (0.5 + this.energyLevel * 0.5);
        this.orbitSpeed = baseSpeed / (Math.sqrt(radius) * 1.2);
        if (Math.random() > 0.5) this.orbitSpeed *= -1;

        this.x = Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = Math.sin(this.orbitAngle) * this.orbitRadius;
        this.z = -40 - Math.random() * 20; 
        this.targetZ = (Math.random() - 0.5) * (4 + level * 0.4);
        this.size = (0.3 + Math.random() * 0.9) * (1 + level * 0.012);
        this.floatOffset = Math.random() * Math.PI * 2;
        
        if (level < 5) {
          this.type = Math.random() > 0.1 ? 'STAR' : 'BLOCK';
        } else if (level < 10) {
          this.type = Math.random() > 0.4 ? 'STAR' : (Math.random() > 0.5 ? 'PLANET' : 'BLOCK');
        } else {
          this.type = Math.random() > 0.6 ? 'PLANET' : (Math.random() > 0.3 ? 'BLOCK' : 'STAR');
        }
      }

      update() {
        this.orbitAngle += this.orbitSpeed;
        this.x = Math.cos(this.orbitAngle) * this.orbitRadius;
        this.y = Math.sin(this.orbitAngle) * this.orbitRadius;
        this.z += (this.targetZ - this.z) * 0.05;
        this.floatOffset += 0.02 * (this.energyLevel * 0.6);
      }

      draw(ctx: CanvasRenderingContext2D, width: number, height: number) {
        const currentZ = this.z + Math.sin(this.floatOffset) * (0.5 * this.energyLevel);
        const pos = project(this.x, this.y, currentZ, width, height);
        const s = this.size * (Math.min(width, height) / 24);
        ctx.save();
        ctx.translate(pos.x, pos.y);
        
        if (level > 12) {
           const pulse = Math.sin(Date.now() * 0.005 + this.seed * 10) * 0.2 + 0.8;
           ctx.scale(pulse, pulse);
        }

        if (this.type === 'STAR') this.drawStar(ctx, s);
        else if (this.type === 'BLOCK') this.drawBlock(ctx, s);
        else this.drawPlanet(ctx, s);
        ctx.restore();
      }

      drawStar(ctx: CanvasRenderingContext2D, s: number) {
        const flicker = Math.sin(Date.now() * 0.04 * this.energyLevel + this.seed * 3000) * 0.4 + 0.6;
        const ps = s * flicker;
        ctx.shadowBlur = (30 + this.energyLevel * 10) * flicker;
        ctx.shadowColor = this.glowColor;
        ctx.beginPath();
        ctx.moveTo(0, -ps * 3); ctx.lineTo(ps * 1.2, 0); ctx.lineTo(0, ps * 3); ctx.lineTo(-ps * 1.2, 0);
        ctx.closePath();
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(0, 0, ps * 0.7, 0, Math.PI * 2); ctx.fill();
      }

      drawBlock(ctx: CanvasRenderingContext2D, s: number) {
        const h = s * 0.577;
        ctx.beginPath();
        ctx.moveTo(0, -h); ctx.lineTo(s, 0); ctx.lineTo(0, h); ctx.lineTo(-s, 0); ctx.closePath();
        const topGrad = ctx.createLinearGradient(0, -h, 0, h);
        topGrad.addColorStop(0, this.glowColor); topGrad.addColorStop(1, this.secondaryColor);
        ctx.fillStyle = topGrad; ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(s, 0); ctx.lineTo(s, s); ctx.lineTo(0, h + s); ctx.lineTo(0, h); ctx.closePath();
        const rightGrad = ctx.createLinearGradient(s, 0, 0, h + s);
        rightGrad.addColorStop(0, this.color); rightGrad.addColorStop(1, '#000000');
        ctx.fillStyle = rightGrad; ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(-s, 0); ctx.lineTo(-s, s); ctx.lineTo(0, h + s); ctx.lineTo(0, h); ctx.closePath();
        ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fill();
        
        ctx.strokeStyle = this.glowColor + 'CC';
        ctx.lineWidth = 1.0 + (this.energyLevel * 0.1); ctx.stroke();
      }

      drawPlanet(ctx: CanvasRenderingContext2D, s: number) {
        const pulse = Math.sin(Date.now() * 0.003 + this.seed * 100) * 0.12 + 0.88;
        const energyModifier = this.energyLevel * 0.1;

        // Corona Atmosférica Vibrante
        const glowRadius = s * (2.4 + energyModifier) * pulse;
        const atmosphere = ctx.createRadialGradient(0, 0, s * 0.6, 0, 0, glowRadius);
        atmosphere.addColorStop(0, this.glowColor + '99'); // Mais opaco no centro para contraste
        atmosphere.addColorStop(0.4, this.secondaryColor + '44');
        atmosphere.addColorStop(1, 'transparent');
        ctx.fillStyle = atmosphere;
        ctx.beginPath(); ctx.arc(0, 0, glowRadius, 0, Math.PI * 2); ctx.fill();

        // Corpo do Planeta com Destaque Especular Vibrante
        const bodyGrad = ctx.createRadialGradient(-s/2.2, -s/2.2, s * 0.05, 0, 0, s);
        bodyGrad.addColorStop(0, '#ffffff'); // Brilho especular puro
        bodyGrad.addColorStop(0.15, this.glowColor);
        bodyGrad.addColorStop(0.45, this.secondaryColor);
        bodyGrad.addColorStop(0.85, this.color);
        bodyGrad.addColorStop(1, '#000000');
        
        ctx.beginPath(); ctx.arc(0, 0, s, 0, Math.PI * 2); 
        ctx.fillStyle = bodyGrad; 
        ctx.fill();

        // Rim-Light de Alta Definição
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, s, 0, Math.PI * 2);
        const rimOpacity = Math.floor(0xBB * pulse).toString(16).padStart(2, '0');
        ctx.strokeStyle = this.glowColor + rimOpacity;
        ctx.lineWidth = 2.5 * (1 + energyModifier * 0.6);
        ctx.stroke();
        ctx.restore();
        
        // Detalhes da Superfície (Nuvens/Terreno)
        ctx.save();
        ctx.clip();
        const detailCount = 3 + Math.floor(this.energyLevel * 0.5);
        for(let i=0; i < detailCount; i++) {
          const tAngle = this.seed * 500 + i * 15 + (Date.now() * 0.0003);
          const tx = Math.sin(tAngle) * s * 0.8; 
          const ty = Math.cos(tAngle * 1.3) * s * 0.6;
          ctx.beginPath(); 
          ctx.ellipse(tx, ty, s * 1.4, s * 0.4, this.seed * Math.PI + i, 0, Math.PI * 2); 
          ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.45)' : this.glowColor + '33';
          ctx.fill();
        }
        ctx.restore();

        // Anéis Orbitais Reativos
        if (this.seed > (0.50 - level * 0.01)) {
          const ringPulse = Math.cos(Date.now() * 0.002 + this.seed * 70) * 0.06 + 1;
          ctx.beginPath();
          ctx.ellipse(0, 0, s * 3.6 * ringPulse, s * 1.4 * ringPulse, Math.PI / 6, 0, Math.PI * 2);
          ctx.strokeStyle = this.glowColor + 'CC';
          ctx.lineWidth = 1.5 * this.energyLevel;
          ctx.stroke();
          
          ctx.beginPath();
          ctx.ellipse(0, 0, s * 3.2 * ringPulse, s * 1.2 * ringPulse, Math.PI / 6, 0, Math.PI * 2);
          ctx.strokeStyle = this.secondaryColor + '66';
          ctx.lineWidth = 1.0 * this.energyLevel;
          ctx.stroke();
        }
      }
    }

    const init = () => {
      entities = [];
      const count = Math.min(350, 60 + level * 20);
      for (let i = 0; i < count; i++) {
        entities.push(new Entity(level));
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const baseRadius = Math.min(canvas.width, canvas.height) * 0.9;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(1, 0.577);
      
      const pColor = nebulaTheme?.primary || '#4338ca';
      const sColor = nebulaTheme?.secondary || '#1e1b4b';
      
      const nebula = ctx.createRadialGradient(0, 0, 0, 0, 0, baseRadius);
      nebula.addColorStop(0, pColor + '88');
      nebula.addColorStop(0.4, pColor + '55');
      nebula.addColorStop(0.8, sColor + '22');
      nebula.addColorStop(1, 'transparent');
      
      ctx.fillStyle = nebula;
      ctx.beginPath(); ctx.arc(0, 0, baseRadius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      const coreZ = Math.sin(Date.now() * 0.0015) * 0.7;
      const corePos = project(0, 0, coreZ, canvas.width, canvas.height);
      const coreSize = (3.5 + level * 0.3) * (Math.min(canvas.width, canvas.height) / 45);
      const coreGrad = ctx.createRadialGradient(corePos.x, corePos.y, 0, corePos.x, corePos.y, coreSize * 7);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.2, pColor);
      coreGrad.addColorStop(0.7, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.beginPath(); ctx.arc(corePos.x, corePos.y, coreSize * 7, 0, Math.PI * 2); ctx.fill();

      // Ordenação isométrica para correta sobreposição
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
  }, [level, nebulaTheme]);

  return (
    <div className="w-full h-full relative group overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />
      <div className="absolute inset-0 pointer-events-none rounded-[4rem] shadow-[inset_0_0_250px_rgba(0,0,0,1)]"></div>
    </div>
  );
};

export default UniverseVisual;