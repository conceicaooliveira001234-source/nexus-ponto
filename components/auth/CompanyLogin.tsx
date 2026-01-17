import React, { useState } from 'react';
import { Mail, Lock, ArrowLeft, LogIn, Eye, EyeOff, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import TechInput from '../ui/TechInput';
import TechBackground from '../TechBackground';
import { playSound } from '../../lib/sounds';

interface CompanyLoginProps {
  onLogin: (email: string, pass: string) => Promise<void>;
  onRegisterClick: () => void;
  onBack: () => void;
}

const CompanyLogin: React.FC<CompanyLoginProps> = ({ onLogin, onRegisterClick, onBack }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playSound.click();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      await onLogin(email, password);
      setSuccess('Acesso concedido! Redirecionando...');
      playSound.success();
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login.');
      playSound.error();
      setIsLoading(false);
    }
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

          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-500/50 rounded-lg flex items-center gap-3 text-red-200 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-900/30 border border-green-500/50 rounded-lg flex items-center gap-3 text-green-200 animate-in fade-in slide-in-from-top-2">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <p className="text-sm">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <TechInput 
              label="E-mail Corporativo" 
              type="email" 
              placeholder="empresa@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="w-4 h-4" />}
              required
              disabled={isLoading}
            />
            
            <TechInput 
              label="Senha de Acesso" 
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="w-4 h-4" />}
              rightIcon={showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              onRightIconClick={() => setShowPassword(!showPassword)}
              required
              disabled={isLoading}
            />

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:shadow-[0_0_30px_rgba(8,145,178,0.6)] transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <LogIn className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              )}
              {isLoading ? 'ACESSANDO...' : 'ACESSAR PAINEL'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center">
            <p className="text-slate-500 text-sm mb-3">Não possui cadastro?</p>
            <button 
              onClick={() => { playSound.click(); onRegisterClick(); }}
              className="text-cyan-400 hover:text-cyan-300 font-bold text-sm tracking-wide uppercase border-b border-transparent hover:border-cyan-400 transition-all"
              disabled={isLoading}
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
