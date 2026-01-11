import React from 'react';
import { Building2, UserCircle2, Zap } from 'lucide-react';
import TechBackground from './TechBackground';
import SelectionCard from './SelectionCard';
import { UserRole } from '../types';

interface LandingPageProps {
  onSelect: (role: UserRole) => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onSelect }) => {
  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-4 md:p-8">
      <TechBackground />

      <div className="relative z-30 w-full max-w-7xl flex flex-col items-center gap-12">
        
        {/* Header Section */}
        <div className="text-center space-y-6 animate-float">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-slate-700 bg-slate-900/80 backdrop-blur text-xs font-mono text-cyan-400 mb-4 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
            <Zap className="w-3 h-3 fill-current" />
            <span>SYSTEM_READY // V.4.0.2</span>
          </div>
          
          <h1 className="font-tech text-4xl md:text-6xl lg:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-200 to-slate-600 drop-shadow-2xl">
            NEXUS PORTAL
          </h1>
          
          <p className="text-slate-400 text-sm md:text-lg max-w-2xl mx-auto font-light tracking-wide">
            Selecione seu perfil de acesso para conectar-se à rede neural corporativa. 
            Identificação segura e criptografada.
          </p>
        </div>

        {/* Cards Container */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full place-items-center mt-8">
          
          <SelectionCard 
            role={UserRole.COMPANY}
            title="SOU EMPRESA"
            description="Gestão de recursos, monitoramento em tempo real e administração de equipe."
            icon={<Building2 className="w-16 h-16 md:w-20 md:h-20" strokeWidth={1} />}
            color="cyan"
            onClick={onSelect}
          />

          <SelectionCard 
            role={UserRole.EMPLOYEE}
            title="SOU FUNCIONÁRIO"
            description="Acesso a tarefas, dashboard de produtividade e comunicação interna."
            icon={<UserCircle2 className="w-16 h-16 md:w-20 md:h-20" strokeWidth={1} />}
            color="fuchsia"
            onClick={onSelect}
          />

        </div>

        {/* Footer info */}
        <div className="mt-12 text-slate-600 text-xs font-mono">
          SECURE CONNECTION ESTABLISHED • ID: 89X-22-ALPHA
        </div>
      </div>
    </div>
  );
};

export default LandingPage;