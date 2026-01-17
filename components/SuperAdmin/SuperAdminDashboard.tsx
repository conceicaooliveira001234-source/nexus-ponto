import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { CompanyData, SystemSettings } from '../../types';
import { ArrowLeft, Building2, Cog, LayoutDashboard, Users, X, Save, Edit, CheckCircle, XCircle, Trash2, Loader2, RotateCcw, AlertTriangle, LogOut } from 'lucide-react';
import TechBackground from '../TechBackground';
import TechInput from '../ui/TechInput';
import { playSound } from '../../lib/sounds';
import SuperAdminCompanies from './SuperAdminCompanies';
import SuperAdminOverview from './SuperAdminOverview';

interface SuperAdminDashboardProps {
  onLogout: () => void;
  onImpersonate: (company: CompanyData) => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout, onImpersonate }) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'COMPANIES' | 'SETTINGS'>('OVERVIEW');
  const [paymentSettings, setPaymentSettings] = useState<SystemSettings>({
    mercadoPagoPublicKey: '',
    mercadoPagoAccessToken: '',
  });
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsBeforeEdit, setSettingsBeforeEdit] = useState<SystemSettings>({});
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  useEffect(() => {
    // Listener for payment settings
    const settingsDocRef = doc(db, 'system_settings', 'payment_config');
    const unsubSettings = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setPaymentSettings(docSnap.data() as SystemSettings);
      } else {
        // Pre-fill with production keys if no settings are saved yet
        setPaymentSettings({
          mercadoPagoPublicKey: 'APP_USR-769f05e6-54b4-4b70-a53f-c549bacc26c9',
          mercadoPagoAccessToken: 'APP_USR-644747811168820-120414-9564cb414f00db246d8422f0f18741d7-511791611'
        });
      }
    });

    return () => {
      unsubSettings();
    };
  }, []);

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedbackMessage(null);
    try {
      await setDoc(doc(db, 'system_settings', 'payment_config'), paymentSettings, { merge: true });
      setFeedbackMessage({ type: 'success', text: 'Configurações salvas!' });
      setIsEditingSettings(false);
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (error) {
      console.error("Error saving payment settings:", error);
      setFeedbackMessage({ type: 'error', text: 'Erro ao salvar configurações.' });
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };
  
  const renderFeedback = () => feedbackMessage && (
    <div className={`mb-4 flex items-center gap-2 text-sm ${
        feedbackMessage.type === 'success' ? 'text-green-400' : 'text-red-400'
      } animate-in fade-in`}
    >
      {feedbackMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      <span>{feedbackMessage.text}</span>
    </div>
  );

  return (
    <div className="relative min-h-screen flex flex-col md:flex-row bg-slate-950">
      <TechBackground />
      
      {/* Desktop Sidebar */}
      <aside className="relative z-10 w-64 hidden md:flex flex-col border-r border-slate-800 bg-slate-950/80 backdrop-blur-md h-screen sticky top-0">
        <div className="p-6 border-b border-slate-800">
          <h2 className="font-tech text-xl text-fuchsia-400 font-bold">SUPER ADMIN</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('OVERVIEW')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-mono uppercase ${activeTab === 'OVERVIEW' ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-slate-400 hover:bg-slate-800'}`}>
            <LayoutDashboard className="w-4 h-4" /> Visão Geral
          </button>
          <button onClick={() => setActiveTab('COMPANIES')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-mono uppercase ${activeTab === 'COMPANIES' ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Building2 className="w-4 h-4" /> Empresas
          </button>
          <button onClick={() => setActiveTab('SETTINGS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-mono uppercase ${activeTab === 'SETTINGS' ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Cog className="w-4 h-4" /> Configurações MP
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white text-sm font-mono">
            <LogOut className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/90 backdrop-blur sticky top-0 z-20">
        <h2 className="font-tech text-lg text-fuchsia-400">SUPER ADMIN</h2>
        <button onClick={onLogout} className="text-slate-400 hover:text-white p-2">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      <main className="relative z-10 flex-1 h-full overflow-y-auto pb-24 md:pb-0">
        <div className="p-4 md:p-12 max-w-7xl mx-auto">
          {activeTab === 'OVERVIEW' && (
            <SuperAdminOverview />
          )}
          {activeTab === 'COMPANIES' && (
            <SuperAdminCompanies onImpersonate={onImpersonate} />
          )}

          {activeTab === 'SETTINGS' && (
            <div className="animate-in fade-in slide-in-from-bottom-4">
              <h1 className="font-tech text-2xl md:text-3xl text-white mb-6">Configurações de Pagamento</h1>
              {renderFeedback()}
              <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 md:p-8 max-w-2xl">
                <form onSubmit={handleSavePaymentSettings}>
                  <div className="space-y-6">
                    <TechInput 
                      label="Mercado Pago - Access Token"
                      value={paymentSettings.mercadoPagoAccessToken || ''}
                      onChange={e => setPaymentSettings(p => ({...p, mercadoPagoAccessToken: e.target.value}))}
                      disabled={!isEditingSettings}
                    />
                    <TechInput 
                      label="Mercado Pago - Public Key"
                      value={paymentSettings.mercadoPagoPublicKey || ''}
                      onChange={e => setPaymentSettings(p => ({...p, mercadoPagoPublicKey: e.target.value}))}
                      disabled={!isEditingSettings}
                    />
                  </div>
                  <div className="mt-8 flex gap-4 items-center">
                    {isEditingSettings ? (
                      <>
                        <button type="submit" className="flex-1 px-6 py-3 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-fuchsia-500/20">
                          <Save className="w-4 h-4"/> Salvar
                        </button>
                        <button 
                          type="button" 
                          onClick={(e) => {
                            e.preventDefault();
                            setPaymentSettings(settingsBeforeEdit);
                            setIsEditingSettings(false);
                          }} 
                          className="flex-1 px-4 py-3 text-slate-400 hover:bg-slate-800 rounded-lg flex items-center justify-center gap-2 text-sm border border-slate-700"
                        >
                          <RotateCcw className="w-3 h-3"/> Cancelar
                        </button>
                      </>
                    ) : (
                      <button 
                        type="button" 
                        onClick={(e) => {
                          e.preventDefault();
                          setSettingsBeforeEdit(paymentSettings);
                          setIsEditingSettings(true);
                        }} 
                        className="w-full px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg flex items-center justify-center gap-2 border border-slate-700"
                      >
                        <Edit className="w-4 h-4"/> Editar
                      </button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-950/90 backdrop-blur-xl border-t border-slate-800 z-30 pb-safe">
        <div className="flex justify-around items-center p-2">
          <button 
            onClick={() => { setActiveTab('OVERVIEW'); playSound.click(); }}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${activeTab === 'OVERVIEW' ? 'text-fuchsia-400' : 'text-slate-500'}`}
          >
            <LayoutDashboard className={`w-6 h-6 ${activeTab === 'OVERVIEW' ? 'fill-fuchsia-400/20' : ''}`} />
            <span className="text-[10px] font-bold uppercase">Visão</span>
          </button>
          
          <button 
            onClick={() => { setActiveTab('COMPANIES'); playSound.click(); }}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${activeTab === 'COMPANIES' ? 'text-fuchsia-400' : 'text-slate-500'}`}
          >
            <Building2 className={`w-6 h-6 ${activeTab === 'COMPANIES' ? 'fill-fuchsia-400/20' : ''}`} />
            <span className="text-[10px] font-bold uppercase">Empresas</span>
          </button>

          <button 
            onClick={() => { setActiveTab('SETTINGS'); playSound.click(); }}
            className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${activeTab === 'SETTINGS' ? 'text-fuchsia-400' : 'text-slate-500'}`}
          >
            <Cog className={`w-6 h-6 ${activeTab === 'SETTINGS' ? 'fill-fuchsia-400/20' : ''}`} />
            <span className="text-[10px] font-bold uppercase">Config</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
