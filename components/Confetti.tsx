import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
  onDone: () => void;
}

interface Particle {
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  shape: 'rect' | 'circle';
  opacity: number;
}

const COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#a78bfa',
  '#f43f5e', '#38bdf8', '#fb923c', '#facc15',
  '#34d399', '#c084fc', '#ff6b9d', '#00d4ff',
];

const Confetti: React.FC<ConfettiProps> = ({ onDone }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Create particles
    const particles: Particle[] = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height * 0.5, // start above viewport
      r: Math.random() * 8 + 4,
      dx: (Math.random() - 0.5) * 3,
      dy: Math.random() * 4 + 2,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      opacity: 0.9,
    }));

    const startTime = performance.now();
    const duration = 3500; // ms

    const draw = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Fade out in final 20%
      const fade = progress > 0.8 ? 1 - (progress - 0.8) / 0.2 : 1;

      for (const p of particles) {
        p.x += p.dx;
        p.y += p.dy + progress * 1.5; // accelerate slightly over time
        p.rotation += p.rotationSpeed;
        p.opacity = fade * 0.9;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'rect') {
          ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();

        // Wrap horizontally
        if (p.x < -20) p.x = canvas.width + 20;
        if (p.x > canvas.width + 20) p.x = -20;
      }

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(draw);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onDone();
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', handleResize);
    };
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
      <style>{`
        @keyframes elegant-popup {
          0% { transform: scale(0.9) translateY(20px); opacity: 0; filter: blur(10px); }
          12% { transform: scale(1) translateY(0); opacity: 1; filter: blur(0px); }
          85% { transform: scale(1) translateY(0); opacity: 1; filter: blur(0px); }
          100% { transform: scale(0.95) translateY(-10px); opacity: 0; filter: blur(5px); }
        }
      `}</style>
      
      {/* The Confetti Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
      
      {/* The Pop-up UI */}
      <div 
        className="relative bg-slate-900/80 backdrop-blur-md border border-blue-500/30 shadow-[0_0_80px_rgba(59,130,246,0.25)] px-12 py-10 rounded-3xl flex flex-col items-center"
        style={{ animation: 'elegant-popup 2.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards' }}
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-sky-400 flex items-center justify-center mb-6 shadow-xl shadow-blue-500/30">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-sky-400 mb-2 font-['Inter'] tracking-wider text-center drop-shadow-md">
          New Record!
        </h2>
        <p className="text-xl text-slate-200 font-['Inter'] font-semibold text-center">
          You were on fire yesterday!
        </p>
      </div>
    </div>
  );
};

export default Confetti;
