import React, { useState } from 'react';
import { ArrowLeft, Search, Loader2, AlertCircle } from 'lucide-react';
import TechInput from '../ui/TechInput';
import TechBackground from '../TechBackground';
import { db, auth } from '../../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { CompanyData, EmployeeContext } from '../../types';
import { playSound } from '../../lib/sounds';

interface EmployeeLoginProps {
  onLogin: (context: EmployeeContext) => void;
  onBack: () => void;
}

const EmployeeLogin: React.FC<EmployeeLoginProps> = ({ onLogin, onBack }) => {
  const [tenantCode, setTenantCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSearchCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantCode.trim()) return;

    setIsLoading(true);
    setError('');
    playSound.click();

    try {
      // 1. Authenticate Anonymously if not already logged in
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      // 2. Find Company by Tenant Code
      const companiesRef = collection(db, "companies");
      const qCompany = query(companiesRef, where("tenantCode", "==", tenantCode.trim().toUpperCase()));
      const querySnapshot = await getDocs(qCompany);

      if (querySnapshot.empty) {
        setError('Código de empresa não encontrado. Verifique com seu gestor.');
        playSound.error();
        setIsLoading(false);
        return;
      }

      const companyDoc = querySnapshot.docs[0];
      const companyData = { ...companyDoc.data(), uid: companyDoc.id } as CompanyData;
      
      playSound.success();
      
      // Proceed directly to login with company context (no location yet)
      onLogin({
        companyId: companyData.uid!,
        companyName: companyData.companyName,
      });

    } catch (err: any) {
      console.error("Error searching company:", err);
      playSound.error();
      if (err.code === 'permission-denied') {
         setError('Erro de permissão: Regras de segurança bloqueando acesso. Tente novamente.');
      } else if (err.code === 'failed-precondition') {
         setError('Índice ausente: Verifique o console do navegador.');
      } else {
         setError('Erro ao buscar empresa. Verifique sua conexão e tente novamente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <TechBackground />
      
      <div className="relative z-30 w-full max-w-md animate-float" style={{ animationDuration: '8s' }}>
        <button 
          onClick={() => {
            playSound.click();
            onBack();
          }}
          className="absolute -top-12 left-0 text-slate-400 hover:text-fuchsia-400 transition-colors flex items-center gap-2 font-mono text-xs uppercase"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-[0_0_50px_-10px_rgba(217,70,239,0.2)]">
          
          <div className="text-center mb-8">
            <h2 className="font-tech text-3xl font-bold text-white mb-2">Acesso Funcionário</h2>
            <p className="text-slate-400 text-sm">Digite o código fornecido pela sua empresa.</p>
          </div>

          <form onSubmit={handleSearchCompany} className="space-y-6">
            <div className="space-y-2">
              <TechInput 
                label="Código da Empresa (Tenant ID)" 
                placeholder="EX: EMPRESA-01"
                value={tenantCode}
                onChange={(e) => setTenantCode(e.target.value.toUpperCase())}
                className="border-fuchsia-500/50 focus:border-fuchsia-500"
              />
              {error && (
                <div className="flex items-center gap-2 text-red-400 text-xs mt-2 bg-red-950/30 p-2 rounded border border-red-900/50">
                  <AlertCircle className="w-3 h-3" />
                  {error}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold py-3 px-4 rounded-lg shadow-[0_0_20px_rgba(217,70,239,0.4)] hover:shadow-[0_0_30px_rgba(217,70,239,0.6)] transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              LOCALIZAR EMPRESA
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default EmployeeLogin;
