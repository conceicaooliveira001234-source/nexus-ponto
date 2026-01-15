import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { playSound } from '../lib/sounds';

// Define o tipo de evento para beforeinstallprompt para ter acesso às suas propriedades
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

const InstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);

  useEffect(() => {
    // Verifica se o app já está instalado (rodando em modo standalone)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    if (mediaQuery.matches || (window.navigator as any).standalone) {
      setIsAppInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      // Previne o mini-infobar de aparecer no mobile
      e.preventDefault();
      // Guarda o evento para que possa ser disparado depois.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      console.log('👍 Evento `beforeinstallprompt` foi disparado.');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      return;
    }
    playSound.click();
    // Mostra o prompt de instalação
    deferredPrompt.prompt();
    // Espera o usuário responder ao prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`👍 Resposta do usuário ao prompt de instalação: ${outcome}`);
    // O prompt foi usado e não pode ser usado de novo, então o limpamos
    setDeferredPrompt(null);
  };
  
  // Não mostra o botão se o app já estiver instalado ou se o prompt não estiver disponível
  if (isAppInstalled || !deferredPrompt) {
    return null;
  }

  return (
    <div className="mb-6 animate-in fade-in slide-in-from-bottom-5 duration-500">
      <div 
        className="group relative bg-slate-800/50 border-2 border-fuchsia-500/30 rounded-2xl p-6 shadow-[0_0_50px_-10px_rgba(217,70,239,0.2)] flex flex-col md:flex-row items-center justify-between gap-6 cursor-pointer hover:border-fuchsia-500/60 transition-all"
        onClick={handleInstallClick}
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-fuchsia-500/10 rounded-lg border border-fuchsia-500/20">
            <Download className="w-8 h-8 text-fuchsia-400 animate-pulse group-hover:animate-none"/>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">📲 Instalar App de Ponto</h2>
            <p className="text-slate-400 text-sm">Adicione à tela inicial para acesso rápido e offline, como um app nativo.</p>
          </div>
        </div>
        <button 
          className="flex-none px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-sm rounded-lg flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,70,239,0.4)] transition-all"
        >
          <Download className="w-4 h-4"/>
          Instalar
        </button>
      </div>
    </div>
  );
};

export default InstallButton;
