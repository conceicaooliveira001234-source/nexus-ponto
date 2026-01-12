import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';
import { playSound } from '../lib/sounds';

interface PwaInstallPromptProps {
  installPrompt: Event;
  onInstall: () => void;
  onDismiss: () => void;
}

const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({ onInstall, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  // Mostra o prompt após um atraso para não ser intrusivo imediatamente
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(true);
      playSound.alert();
    }, 5000); // Atraso de 5 segundos

    return () => clearTimeout(timer);
  }, []);

  const handleInstallClick = () => {
    playSound.click();
    onInstall();
    setIsVisible(false);
  };
  
  const handleDismissClick = () => {
    playSound.click();
    onDismiss();
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-12 duration-500">
      <div className="max-w-4xl mx-auto bg-slate-900/80 backdrop-blur-xl border-2 border-fuchsia-500/50 rounded-2xl p-6 shadow-[0_0_50px_-10px_rgba(217,70,239,0.3)] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-fuchsia-500/10 rounded-lg border border-fuchsia-500/20 hidden md:block">
            <Download className="w-8 h-8 text-fuchsia-400 animate-pulse"/>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Instale nosso Aplicativo!</h2>
            <p className="text-slate-400 text-sm">Tenha acesso rápido e offline adicionando o NexusWork à sua tela inicial.</p>
          </div>
        </div>

        <div className="flex items-center gap-4 w-full md:w-auto">
          <button 
            onClick={handleDismissClick}
            className="flex-1 md:flex-none px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-lg transition-colors"
          >
            Agora não
          </button>
          <button 
            onClick={handleInstallClick}
            className="flex-1 md:flex-none px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,70,239,0.4)] transition-all"
          >
            <Download className="w-4 h-4"/>
            Instalar
          </button>
        </div>
      </div>
    </div>
  );
};

export default PwaInstallPrompt;
