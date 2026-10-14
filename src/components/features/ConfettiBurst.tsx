'use client';

import { useEffect, useRef } from 'react';

type Props = {
  /** Punto de salida en coordenadas de la ventana (p. ej. centro del botón). */
  origin: { x: number; y: number };
  onDone: () => void;
};

const COLORS = ['#f59300', '#ffb43c', '#e8467c', '#fff8ec', '#4ade80', '#ffd88c'];
const COUNT = 140;
const DURATION_MS = 1800;

type Piece = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  round: boolean;
};

/**
 * Lluvia de confeti en un canvas a pantalla completa, sin dependencias. Sale
 * disparada desde `origin`, cae con gravedad y se desmonta sola. Con
 * `prefers-reduced-motion` no se pinta nada.
 */
export function ConfettiBurst({ origin, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // `onDone` puede cambiar en cada render del padre; la animación no.
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      doneRef.current();
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      doneRef.current();
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    ctx.scale(dpr, dpr);

    const pieces: Piece[] = Array.from({ length: COUNT }, () => {
      // Abanico hacia arriba, con algo de dispersión lateral.
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 7 + Math.random() * 9;
      return {
        x: origin.x,
        y: origin.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.3,
      };
    });

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      // Se desvanece en el último tercio.
      ctx.globalAlpha = Math.min(1, (DURATION_MS - elapsed) / (DURATION_MS / 3));
      for (const p of pieces) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.vy *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }
      if (elapsed < DURATION_MS) {
        frame = requestAnimationFrame(tick);
      } else {
        doneRef.current();
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [origin.x, origin.y]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 2100,
      }}
    />
  );
}
