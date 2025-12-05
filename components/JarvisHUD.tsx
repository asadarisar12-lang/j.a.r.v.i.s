import React, { useEffect, useRef } from 'react';
import { ConnectionState, MessageLog, VirtualApp } from '../types';
import { X, Save, Terminal } from 'lucide-react';

interface JarvisHUDProps {
  connectionState: ConnectionState;
  volume: number;
  logs: MessageLog[];
  activeApp: VirtualApp | null;
  onCloseApp: () => void;
}

export const JarvisHUD: React.FC<JarvisHUDProps> = ({ connectionState, volume, logs, activeApp, onCloseApp }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const logsRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsRef.current) {
      logsRef.current.scrollTop = logsRef.current.scrollHeight;
    }
  }, [logs]);

  // Animation Loop for the "Arc Reactor" Core
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let rotation = 0;
    
    const render = () => {
      if (!canvas) return;
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isConnected = connectionState === ConnectionState.CONNECTED;
      const isError = connectionState === ConnectionState.ERROR;
      const isConnecting = connectionState === ConnectionState.CONNECTING;
      
      const primaryColor = isError ? '#ef4444' : isConnected ? '#06b6d4' : '#64748b';
      const glowColor = isError ? 'rgba(239, 68, 68, 0.4)' : isConnected ? 'rgba(34, 211, 238, 0.4)' : 'rgba(100, 116, 139, 0.2)';
      const secondaryColor = isError ? '#b91c1c' : '#155e75';

      // 1. Outer Ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, 150, 0, Math.PI * 2);
      ctx.strokeStyle = glowColor;
      ctx.lineWidth = 1;
      ctx.stroke();

      // 2. Spinning Segmented Ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation * 0.1);
      ctx.beginPath();
      ctx.arc(0, 0, 140, 0, Math.PI * 2);
      ctx.strokeStyle = secondaryColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 30]);
      ctx.stroke();
      ctx.restore();

      // 3. Middle Complex Ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-rotation * 0.2);
      ctx.beginPath();
      ctx.arc(0, 0, 110, 0, Math.PI * 2);
      ctx.strokeStyle = primaryColor;
      ctx.lineWidth = 4;
      ctx.setLineDash([60, 40]);
      ctx.stroke();
      ctx.restore();

      // 4. Inner Spinner
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation * 0.8);
      ctx.beginPath();
      ctx.arc(0, 0, 80, 0, Math.PI * 2);
      ctx.strokeStyle = isConnecting ? '#ffffff' : primaryColor;
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 20]);
      ctx.stroke();
      ctx.restore();

      // 5. Audio Reactive Core
      const baseRadius = 30;
      const pulse = Math.min(volume * 60, 60); 
      
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius + pulse + 20);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.3, primaryColor);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, baseRadius + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Core Solid
      ctx.beginPath();
      ctx.arc(centerX, centerY, 15 + (pulse * 0.2), 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Internal structures
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation * 2);
      ctx.beginPath();
      for(let i=0; i<3; i++) {
        ctx.rotate(Math.PI * 2 / 3);
        ctx.moveTo(0, -baseRadius);
        ctx.lineTo(5, -baseRadius + 15);
        ctx.lineTo(-5, -baseRadius + 15);
        ctx.closePath();
      }
      ctx.fillStyle = secondaryColor;
      ctx.fill();
      ctx.restore();

      rotation += isConnecting ? 0.05 : 0.01;
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [connectionState, volume]);

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      {/* Background Grid */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none" 
           style={{ backgroundImage: 'linear-gradient(rgba(6, 182, 212, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(6, 182, 212, 0.1) 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      {/* Main Visualizer */}
      <div className={`relative z-10 w-96 h-96 mb-8 flex items-center justify-center transition-all duration-500 ${activeApp ? 'scale-75 opacity-50 blur-sm' : 'scale-100'}`}>
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>

      {/* Virtual Application Window (Notepad) */}
      {activeApp && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4">
          <div className="bg-black/90 border-2 border-cyan-500 w-full max-w-2xl h-96 rounded-lg shadow-[0_0_50px_rgba(34,211,238,0.3)] backdrop-blur-xl flex flex-col transform transition-all animate-pulse-fast">
             {/* App Header */}
             <div className="flex justify-between items-center bg-cyan-900/40 p-3 border-b border-cyan-700">
                <div className="flex items-center gap-2">
                   <Terminal size={18} className="text-cyan-400" />
                   <span className="font-mono text-cyan-300 font-bold tracking-widest uppercase">{activeApp.title}</span>
                </div>
                <div className="flex items-center gap-2">
                   <button className="text-cyan-400 hover:text-white p-1"><Save size={18} /></button>
                   <button onClick={onCloseApp} className="text-red-400 hover:text-red-200 p-1"><X size={18} /></button>
                </div>
             </div>
             {/* App Content */}
             <div className="flex-1 p-4 font-mono text-cyan-300">
                <textarea 
                  className="w-full h-full bg-transparent border-none outline-none resize-none placeholder-cyan-800"
                  defaultValue={activeApp.content}
                  placeholder="Waiting for input..."
                />
             </div>
             {/* App Footer */}
             <div className="bg-cyan-900/20 p-1 px-4 text-[10px] font-mono text-cyan-600 flex justify-between">
                <span>Ln 1, Col 1</span>
                <span>UTF-8</span>
             </div>
          </div>
        </div>
      )}

      {/* Status Text (Hidden when app is open) */}
      <div className={`z-10 mb-8 text-center transition-opacity duration-300 ${activeApp ? 'opacity-0' : 'opacity-100'}`}>
        <h2 className="text-5xl font-mono font-bold tracking-[0.2em] text-cyan-400 drop-shadow-[0_0_15px_rgba(34,211,238,0.8)]">
          {connectionState === ConnectionState.CONNECTED ? 'J.A.R.V.I.S.' : 
           connectionState === ConnectionState.CONNECTING ? 'INITIALIZING' : 'OFFLINE'}
        </h2>
        <p className="text-cyan-600 text-sm mt-2 tracking-[0.4em] uppercase font-semibold">
          {connectionState === ConnectionState.CONNECTED ? 'System Online • Owner: Asad' : 'Restricted Access'}
        </p>
      </div>

      {/* Enhanced Chat System Panel */}
      <div className="absolute bottom-4 right-4 w-96 max-h-[50%] flex flex-col z-40">
        {/* Chat Header */}
        <div className="bg-cyan-950/90 border border-cyan-600 rounded-t-lg p-2 flex justify-between items-center shadow-[0_0_15px_rgba(34,211,238,0.2)]">
            <span className="text-xs font-mono text-cyan-400 font-bold">COMMUNICATION LOG</span>
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
        </div>
        {/* Chat Body */}
        <div ref={logsRef} className="flex-1 overflow-y-auto bg-black/80 border-x border-b border-cyan-800 p-3 space-y-4 font-mono text-sm scrollbar-thin scrollbar-thumb-cyan-700">
            {logs.length === 0 && (
                <div className="text-center text-cyan-800 mt-10 italic">System ready.<br/>Initiate voice command.</div>
            )}
            {logs.map((log) => (
                <div key={log.id} className={`flex flex-col ${log.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className="text-[10px] text-cyan-700 mb-1">
                        {log.role === 'user' ? 'ASAD' : log.role === 'system' ? 'SYSTEM' : 'JARVIS'}
                    </div>
                    <div className={`
                        max-w-[90%] p-2 rounded-lg border 
                        ${log.role === 'user' ? 'bg-cyan-900/30 border-cyan-500/50 text-cyan-100 rounded-tr-none' : 
                          log.role === 'system' ? 'bg-red-900/10 border-red-500/30 text-red-300' :
                          'bg-black border-cyan-700 text-cyan-400 rounded-tl-none'}
                    `}>
                        {log.text}
                    </div>
                </div>
            ))}
        </div>
      </div>
      
      {/* Decorative HUD Elements */}
      <div className="absolute top-12 left-12 border-l-2 border-t-2 border-cyan-800 w-48 h-48 p-4 opacity-70 hidden md:block">
        <div className="text-[10px] text-cyan-600 font-mono mb-1 flex justify-between">
          <span>CORE TEMP</span>
          <span>98.6°F</span>
        </div>
        <div className="w-full h-1 bg-cyan-900 mb-4 overflow-hidden relative">
          <div className="w-3/4 h-full bg-cyan-500 absolute top-0 left-0 animate-pulse"></div>
        </div>
        
        <div className="text-[10px] text-cyan-600 font-mono mb-1 flex justify-between">
          <span>URDU MODULE</span>
          <span>ACTIVE</span>
        </div>
        <div className="w-full h-1 bg-cyan-900 mb-4 overflow-hidden relative">
          <div className="w-full h-full bg-cyan-500 absolute top-0 left-0 opacity-50"></div>
        </div>
      </div>
    </div>
  );
};