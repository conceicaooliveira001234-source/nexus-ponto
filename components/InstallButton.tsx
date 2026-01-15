import React, { useState, useEffect } from 'react';
import { Download, X, Share } from 'lucide-react';
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
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    playSound.click();
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to the install prompt: ${outcome}`);
      setDeferredPrompt(null);
    } else {
      setShowInstructions(true);
    }
  };

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;

  if (isStandalone) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm rounded-full shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all transform hover:scale-105"
        title="Instalar o aplicativo NexusWork Ponto"
      >
        <span role="img" aria-label="phone">📲</span> Instalar App
      </button>
      
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-fuchsia-500/30 rounded-2xl p-8 max-w-lg w-full shadow-[0_0_50px_rgba(217,70,239,0.2)] relative">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-fuchsia-500/10 rounded-lg border border-fuchsia-500/20">
                <Download className="w-6 h-6 text-fuchsia-400"/>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Instalar Aplicativo</h2>
                <p className="text-slate-400 text-sm">Para a melhor experiência, adicione o NexusWork à sua tela inicial.</p>
              </div>
            </div>
            
            <div className="my-6 space-y-4 text-slate-300 text-sm">
              <div className="bg-slate-800/50 p-4 rounded-lg">
                <p className="font-bold text-fuchsia-400 mb-1">Passo a passo (iOS/Safari):</p>
                <ol className="list-decimal list-inside space-y-2">
                  <li>Toque no ícone de <strong className="text-white">Compartilhar</strong> (<Share className="w-4 h-4 inline-block -mt-1" />) na barra do navegador.</li>
                  <li>Role para baixo e selecione <strong className="text-white">"Adicionar à Tela de Início"</strong>.</li>
                  <li>Confirme tocando em "Adicionar".</li>
                </ol>
              </div>
              <p className="text-xs text-slate-500 text-center">Para outros navegadores, procure pela opção "Instalar aplicativo" ou "Adicionar à tela inicial" no menu do navegador.</p>
            </div>

            <div className="flex justify-end">
              <button 
                onClick={() => {
                  setShowInstructions(false);
                  playSound.click();
                }}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-lg"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default InstallButton;
