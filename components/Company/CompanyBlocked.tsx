import React from 'react';
import { ShieldAlert, LogOut, MessageCircle } from 'lucide-react';
import TechBackground from '../TechBackground';

interface CompanyBlockedProps {
  onLogout: () => void;
}

const CompanyBlocked: React.FC<CompanyBlockedProps> = ({ onLogout }) => {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
      <TechBackground />
      
      <div className="relative z-30 w-full max-w-md text-center">
        <div className="bg-slate-900/80 backdrop-blur-xl border border-red-500/50 p-8 rounded-2xl shadow-[0_0_50px_-10px_rgba(239,68,68,0.3)]">
          <div className="w-20 h-20 bg-red-900/20 rounded-full mx-auto mb-6 flex items-center justify-center border border-red-500/30 animate-pulse">
            <ShieldAlert className="w-10 h-10 text-red-500" />
          </div>
          
          <h2 className="font-tech text-2xl font-bold text-white mb-4">Acesso Bloqueado</h2>
          
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            O acesso ao painel da sua empresa foi temporariamente suspenso. 
            Para regularizar sua situação ou obter mais informações, entre em contato com nosso suporte.
          </p>

          <a 
            href="https://wa.me/5562981178466" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 px-4 rounded-xl shadow-lg flex items-center justify-center gap-3 transition-all transform hover:scale-105 mb-4"
          >
            <MessageCircle className="w-6 h-6" />
            Falar com Suporte (WhatsApp)
          </a>

          <button 
            onClick={onLogout}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Sair do Sistema
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompanyBlocked;
