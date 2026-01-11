import React, { useState } from 'react';
import { ArrowLeft, Search, MapPin, Building2, ChevronRight, Loader2, AlertCircle } from 'lucide-react';
import TechInput from '../ui/TechInput';
import TechBackground from '../TechBackground';
import { db, auth } from '../../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { CompanyData, ServiceLocation, EmployeeContext } from '../../types';

interface EmployeeLoginProps {
  onLogin: (context: EmployeeContext) => void;
  onBack: () => void;
}

const EmployeeLogin: React.FC<EmployeeLoginProps> = ({ onLogin, onBack }) => {
  const [step, setStep] = useState<'CODE' | 'LOCATION'>('CODE');
  const [tenantCode, setTenantCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Found Data
  const [foundCompany, setFoundCompany] = useState<CompanyData | null>(null);
  const [companyLocations, setCompanyLocations] = useState<ServiceLocation[]>([]);

  const handleSearchCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantCode.trim()) return;

    setIsLoading(true);
    setError('');
    setFoundCompany(null);

    try {
      // 1. Authenticate Anonymously if not already logged in
      // This is crucial for Firebase Security Rules that require 'request.auth != null'
      if (!auth.currentUser) {
        await signInAnonymously(auth);
      }

      // 2. Find Company by Tenant Code
      const companiesRef = collection(db, "companies");
      const qCompany = query(companiesRef, where("tenantCode", "==", tenantCode.trim().toUpperCase()));
      const querySnapshot = await getDocs(qCompany);

      if (querySnapshot.empty) {
        setError('Código de empresa não encontrado. Verifique com seu gestor.');
        setIsLoading(false);
        return;
      }

      const companyDoc = querySnapshot.docs[0];
      const companyData = { ...companyDoc.data(), uid: companyDoc.id } as CompanyData;
      setFoundCompany(companyData);

      // 3. Fetch Locations for this Company
      const locationsRef = collection(db, "locations");
      const qLocations = query(locationsRef, where("companyId", "==", companyData.uid));
      const locSnapshot = await getDocs(qLocations);

      const locs = locSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as ServiceLocation));

      setCompanyLocations(locs);
      setStep('LOCATION');

    } catch (err: any) {
      console.error("Error searching company:", err);
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

  const handleSelectLocation = (loc: ServiceLocation) => {
    if (foundCompany && foundCompany.uid) {
      onLogin({
        companyId: foundCompany.uid,
        companyName: foundCompany.companyName,
        locationId: loc.id,
        locationName: loc.name
      });
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <TechBackground />
      
      <div className="relative z-30 w-full max-w-md animate-float" style={{ animationDuration: '8s' }}>
        <button 
          onClick={() => step === 'LOCATION' ? setStep('CODE') : onBack()}
          className="absolute -top-12 left-0 text-slate-400 hover:text-fuchsia-400 transition-colors flex items-center gap-2 font-mono text-xs uppercase"
        >
          <ArrowLeft className="w-4 h-4" /> {step === 'LOCATION' ? 'Trocar Código' : 'Voltar'}
        </button>

        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-[0_0_50px_-10px_rgba(217,70,239,0.2)]">
          
          {step === 'CODE' && (
            <>
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
            </>
          )}

          {step === 'LOCATION' && foundCompany && (
            <>
              <div className="text-center mb-6 border-b border-slate-800 pb-6">
                <div className="inline-flex p-3 rounded-full bg-cyan-500/10 border border-cyan-500/30 mb-4">
                  <Building2 className="w-8 h-8 text-cyan-400" />
                </div>
                <h2 className="font-tech text-xl font-bold text-white uppercase tracking-wider">
                  {foundCompany.companyName}
                </h2>
                <p className="text-xs text-slate-500 mt-1 font-mono">ID: {foundCompany.tenantCode}</p>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-mono text-fuchsia-400 uppercase tracking-widest mb-2 text-center">
                  Selecione seu local de trabalho
                </p>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
                  {companyLocations.length === 0 ? (
                    <div className="text-center py-4 text-slate-500 text-sm">
                      Nenhum local cadastrado por esta empresa.
                    </div>
                  ) : (
                    companyLocations.map(loc => (
                      <button
                        key={loc.id}
                        onClick={() => handleSelectLocation(loc)}
                        className="w-full bg-slate-950/50 border border-slate-700 hover:border-fuchsia-500 hover:bg-fuchsia-900/10 p-4 rounded-lg flex items-center justify-between group transition-all"
                      >
                        <div className="text-left">
                          <div className="flex items-center gap-2 text-white font-bold text-sm group-hover:text-fuchsia-300">
                            <MapPin className="w-4 h-4 text-slate-500 group-hover:text-fuchsia-500" />
                            {loc.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 truncate max-w-[200px]">{loc.address}</div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-fuchsia-400 group-hover:translate-x-1 transition-transform" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
};

export default EmployeeLogin;