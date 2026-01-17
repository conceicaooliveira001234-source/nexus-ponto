import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { CompanyData, SystemSettings } from '../../types';
import { ArrowLeft, Building2, Cog, Users, X, Save, Edit, CheckCircle, XCircle, Trash2, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import TechBackground from '../TechBackground';
import TechInput from '../ui/TechInput';
import { playSound } from '../../lib/sounds';
import SuperAdminCompanies from './SuperAdminCompanies';

interface SuperAdminDashboardProps {
  onLogout: () => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'COMPANIES' | 'SETTINGS'>('COMPANIES');
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
    <div className="relative min-h-screen flex">
      <TechBackground />
      <aside className="relative z-10 w-64 hidden md:flex flex-col border-r border-slate-800 bg-slate-950/80 backdrop-blur-md">
        <div className="p-6 border-b border-slate-800">
          <h2 className="font-tech text-xl text-fuchsia-400 font-bold">SUPER ADMIN</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <button onClick={() => setActiveTab('COMPANIES')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-mono uppercase ${activeTab === 'COMPANIES' ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Building2 className="w-4 h-4" /> Empresas
          </button>
          <button onClick={() => setActiveTab('SETTINGS')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-mono uppercase ${activeTab === 'SETTINGS' ? 'bg-fuchsia-500/20 text-fuchsia-400' : 'text-slate-400 hover:bg-slate-800'}`}>
            <Cog className="w-4 h-4" /> Configurações MP
          </button>
        </nav>
        <div className="p-4 border-t border-slate-800">
          <button onClick={onLogout} className="w-full flex items-center justify-center gap-2 text-slate-400 hover:text-white text-sm font-mono">
            <ArrowLeft className="w-4 h-4" /> Sair
          </button>
        </div>
      </aside>

      <main className="relative z-10 flex-1 h-screen overflow-y-auto">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
          <h2 className="font-tech text-lg text-fuchsia-400">SUPER ADMIN</h2>
          <button onClick={onLogout} className="text-slate-400 hover:text-white">
            <ArrowLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden flex overflow-x-auto p-2 gap-2 bg-slate-900 border-b border-slate-800">
            <button onClick={() => setActiveTab('COMPANIES')} className={`px-4 py-2 rounded text-xs font-mono uppercase ${activeTab === 'COMPANIES' ? 'bg-fuchsia-600 text-white' : 'text-slate-400'}`}>
                Empresas
            </button>
            <button onClick={() => setActiveTab('SETTINGS')} className={`px-4 py-2 rounded text-xs font-mono uppercase ${activeTab === 'SETTINGS' ? 'bg-fuchsia-600 text-white' : 'text-slate-400'}`}>
                Configurações
            </button>
        </div>
        <div className="p-6 md:p-12 max-w-7xl mx-auto">
          {activeTab === 'COMPANIES' && (
            <SuperAdminCompanies />
          )}

          {activeTab === 'SETTINGS' && (
            <div>
              <h1 className="font-tech text-3xl text-white mb-6">Configurações de Pagamento</h1>
              {renderFeedback()}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-8 max-w-2xl">
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
                  <div className="mt-6 flex gap-4 items-center">
                    {isEditingSettings ? (
                      <>
                        <button type="submit" className="px-6 py-2 bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold rounded-lg flex items-center gap-2">
                          <Save className="w-4 h-4"/> Salvar
                        </button>
                        <button 
                          type="button" 
                          onClick={(e) => {
                            e.preventDefault();
                            setPaymentSettings(settingsBeforeEdit);
                            setIsEditingSettings(false);
                          }} 
                          className="px-4 py-2 text-slate-400 hover:bg-slate-700 rounded-lg flex items-center gap-2 text-sm"
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
                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg flex items-center gap-2"
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
    </div>
  );
};

export default SuperAdminDashboard;
