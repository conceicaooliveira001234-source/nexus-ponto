import React, { useState } from 'react';
import { Mail, Lock, ArrowLeft, LogIn } from 'lucide-react';
import TechInput from '../ui/TechInput';
import TechBackground from '../TechBackground';
import { playSound } from '../../lib/sounds';

interface CompanyLoginProps {
  onLogin: (email: string, pass: string) => void;
  onRegisterClick: () => void;
  onBack: () => void;
}

const CompanyLogin: React.FC<CompanyLoginProps> = ({ onLogin, onRegisterClick, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    playSound.click();
    onLogin(email, password);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <TechBackground />
      
      <div className="relative z-30 w-full max-w-md animate-float" style={{ animationDuration: '8s' }}>
        <button 
          onClick={() => { playSound.click(); onBack(); }}
          className="absolute -top-12 left-0 text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-2 font-mono text-xs uppercase"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-[0_0_50px_-10px_rgba(8,145,178,0.2)]">
          <div className="text-center mb-8">
            <h2 className="font-tech text-3xl font-bold text-white mb-2">Login Corporativo</h2>
            <p className="text-slate-400 text-sm">Insira suas credenciais de acesso.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <TechInput 
              label="E-mail Corporativo" 
              type="email" 
              placeholder="empresa@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
              required
            />
            
            <TechInput 
              label="Senha de Acesso" 
              type="password" 
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
              required
            />

            <button
              type="submit"
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:shadow-[0_0_30px_rgba(8,145,178,0.6)] transition-all duration-300 flex items-center justify-center gap-2 group"
            >
              <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              ACESSAR PAINEL
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-slate-500 text-sm mb-3">Não possui cadastro?</p>
            <button 
              onClick={() => { playSound.click(); onRegisterClick(); }}
              className="text-cyan-400 hover:text-cyan-300 font-bold text-sm tracking-wide uppercase border-b border-transparent hover:border-cyan-400 transition-all"
            >
              Criar Nova Conta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyLogin;
