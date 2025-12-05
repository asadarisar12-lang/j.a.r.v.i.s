import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Power, Globe } from 'lucide-react';
import { JarvisHUD } from './components/JarvisHUD';
import { LiveApiService } from './services/liveApiService';
import { ConnectionState, MessageLog, VirtualApp } from './types';

export default function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [volume, setVolume] = useState(0);
  const [activeApp, setActiveApp] = useState<VirtualApp | null>(null);
  const [language, setLanguage] = useState<'english' | 'urdu' | 'hindi'>('english');
  const serviceRef = useRef<LiveApiService | null>(null);

  const addLog = useCallback((log: MessageLog) => {
    setLogs(prev => [...prev.slice(-50), log]); // Keep last 50 logs for chat history
  }, []);

  const handleOpenApp = useCallback((appName: string, content?: string) => {
      setActiveApp({
          id: Date.now().toString(),
          name: 'notepad',
          title: 'HOLO_NOTEPAD.exe',
          content: content || '',
          isOpen: true
      });
  }, []);

  const connectToService = useCallback(async (lang: 'english' | 'urdu' | 'hindi') => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      addLog({
        id: Date.now().toString(),
        role: 'system',
        text: 'CRITICAL ERROR: API_KEY not found in environment.',
        timestamp: new Date()
      });
      return;
    }

    const service = new LiveApiService(
      apiKey,
      setConnectionState,
      addLog,
      setVolume,
      handleOpenApp
    );
    serviceRef.current = service;
    await service.connect(lang);
  }, [addLog, handleOpenApp]);

  const handleConnect = useCallback(async () => {
    if (connectionState === ConnectionState.CONNECTED || connectionState === ConnectionState.CONNECTING) {
        serviceRef.current?.disconnect();
        return;
    }
    await connectToService(language);
  }, [connectionState, language, connectToService]);

  const toggleLanguage = useCallback(async () => {
    let newLang: 'english' | 'urdu' | 'hindi' = 'english';
    if (language === 'english') newLang = 'urdu';
    else if (language === 'urdu') newLang = 'hindi';
    else newLang = 'english';

    setLanguage(newLang);
    addLog({
        id: Date.now().toString(),
        role: 'system',
        text: `Language protocol switching to ${newLang.toUpperCase()}...`,
        timestamp: new Date()
    });

    if (connectionState === ConnectionState.CONNECTED) {
        // Restart the service to apply new system instruction
        serviceRef.current?.disconnect();
        // Give a brief moment for cleanup before reconnecting
        setTimeout(() => connectToService(newLang), 500);
    }
  }, [language, connectionState, addLog, connectToService]);

  useEffect(() => {
    return () => {
      serviceRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="w-full h-screen bg-black text-cyan-400 overflow-hidden relative selection:bg-cyan-900 selection:text-white">
      {/* Background video or image placeholder if needed, using generic dark gradient for now */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 via-black to-black opacity-80 z-0"></div>

      <main className="relative z-10 w-full h-full flex flex-col">
        {/* Header */}
        <header className="p-6 flex justify-between items-center border-b border-cyan-900/30">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${connectionState === ConnectionState.CONNECTED ? 'bg-cyan-400 shadow-[0_0_10px_#22d3ee]' : 'bg-red-500'}`}></div>
            <h1 className="text-2xl font-mono font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-500">
              JARVIS <span className="text-xs text-cyan-700 align-top">V3.0</span>
            </h1>
          </div>
          <div className="flex gap-4 text-xs font-mono text-cyan-600 hidden sm:flex">
            <span>PROTOCOL: LIVE-API</span>
            <span>ENCRYPTION: ENABLED</span>
            <span className={language !== 'english' ? 'text-cyan-400 font-bold' : ''}>
                LANG: {language.toUpperCase()}
            </span>
            <span className={connectionState === ConnectionState.CONNECTED ? 'text-green-500 animate-pulse' : 'text-red-500'}>
                MIC: {connectionState === ConnectionState.CONNECTED ? 'ACTIVE' : 'OFFLINE'}
            </span>
          </div>
        </header>

        {/* Central HUD */}
        <div className="flex-1 relative">
          <JarvisHUD 
             connectionState={connectionState} 
             volume={volume} 
             logs={logs} 
             activeApp={activeApp}
             onCloseApp={() => setActiveApp(null)}
          />
        </div>

        {/* Control Bar */}
        <footer className="p-8 flex justify-center items-center gap-6 pb-12">
           <button 
             onClick={handleConnect}
             className={`
               relative group p-4 rounded-full border-2 transition-all duration-300
               ${connectionState === ConnectionState.CONNECTED 
                 ? 'border-red-500 hover:bg-red-900/20 text-red-400' 
                 : 'border-cyan-500 hover:bg-cyan-900/20 text-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.4)]'}
             `}
           >
             <Power size={32} className={connectionState === ConnectionState.CONNECTING ? 'animate-pulse' : ''} />
             <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
               {connectionState === ConnectionState.CONNECTED ? 'DISENGAGE' : 'INITIALIZE'}
             </span>
           </button>

           <div className="h-12 w-[1px] bg-cyan-900 mx-4 hidden sm:block"></div>

           {/* Language Toggle Button */}
           <button 
             onClick={toggleLanguage}
             className={`
               relative group p-3 rounded-full border border-cyan-800 transition-all duration-300
               ${language !== 'english' ? 'bg-cyan-900/50 text-cyan-200 border-cyan-500' : 'hover:bg-cyan-900/20 text-cyan-600'}
             `}
           >
             <Globe size={24} />
             <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-[10px] font-mono opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
               SWITCH TO {language === 'english' ? 'URDU' : language === 'urdu' ? 'HINDI' : 'ENGLISH'}
             </span>
             {/* Small indicator dot */}
             <div className={`absolute top-0 right-0 w-2 h-2 rounded-full ${language === 'english' ? 'bg-cyan-700' : 'bg-green-400'}`}></div>
           </button>

           <div className="h-12 w-[1px] bg-cyan-900 mx-4 hidden sm:block"></div>

           <div className="flex flex-col items-center hidden sm:flex">
             <div className="text-[10px] text-cyan-700 font-mono mb-1">VOICE MODULE</div>
             <div className="flex gap-2">
                <div className={`w-12 h-1 rounded-sm ${volume > 0.1 ? 'bg-cyan-400' : 'bg-cyan-900'}`}></div>
                <div className={`w-12 h-1 rounded-sm ${volume > 0.3 ? 'bg-cyan-400' : 'bg-cyan-900'}`}></div>
                <div className={`w-12 h-1 rounded-sm ${volume > 0.5 ? 'bg-cyan-400' : 'bg-cyan-900'}`}></div>
             </div>
           </div>
        </footer>
      </main>
    </div>
  );
}