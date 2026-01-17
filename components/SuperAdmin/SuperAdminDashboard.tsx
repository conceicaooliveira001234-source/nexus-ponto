import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, setDoc, getDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { CompanyData, SystemSettings } from '../../types';
import { ArrowLeft, Building2, Cog, Users, X, Save, Edit, CheckCircle, XCircle, Trash2, Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import TechBackground from '../TechBackground';
import TechInput from '../ui/TechInput';
import { playSound } from '../../lib/sounds';

interface SuperAdminDashboardProps {
  onLogout: () => void;
}

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<'COMPANIES' | 'SETTINGS'>('COMPANIES');
  const [companies, setCompanies] = useState<CompanyData[]>([]);
  const [paymentSettings, setPaymentSettings] = useState<SystemSettings>({
    mercadoPagoPublicKey: '',
    mercadoPagoAccessToken: '',
  });
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsBeforeEdit, setSettingsBeforeEdit] = useState<SystemSettings>({});
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null); // Track companyId being deleted
  const [companyToDelete, setCompanyToDelete] = useState<CompanyData | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

  useEffect(() => {
    // Listener for all companies
    const unsubCompanies = onSnapshot(collection(db, 'companies'), (snapshot) => {
      const allCompanies = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as CompanyData));
      setCompanies(allCompanies);
    });

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
      unsubCompanies();
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

  const handleUpdateCompany = async (companyId: string, data: Partial<CompanyData>) => {
    setFeedbackMessage(null);
    try {
      await updateDoc(doc(db, 'companies', companyId), data);
      setEditingCompany(null);
      playSound.success();
      setFeedbackMessage({ type: 'success', text: 'Empresa atualizada com sucesso!' });
      setTimeout(() => setFeedbackMessage(null), 3000);
    } catch (error) {
      console.error('Error updating company:', error);
      setFeedbackMessage({ type: 'error', text: 'Erro ao atualizar empresa.' });
      setTimeout(() => setFeedbackMessage(null), 3000);
    }
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    setFeedbackMessage(null);
    setIsDeleting(companyId);
    try {
      const batch = writeBatch(db);

      // Collections to cascade delete from
      const collectionsToDelete = ['employees', 'locations', 'shifts', 'attendance'];
      
      for (const collectionName of collectionsToDelete) {
        const q = query(collection(db, collectionName), where('companyId', '==', companyId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
          batch.delete(doc.ref);
        });
        console.log(`[CASCADE DELETE] ${snapshot.size} documents from '${collectionName}' will be deleted for company ${companyId}.`);
      }

      // Delete the company document itself
      const companyRef = doc(db, 'companies', companyId);
      batch.delete(companyRef);

      // Commit all deletions at once
      await batch.commit();

      setFeedbackMessage({ type: 'success', text: `Empresa "${companyName}" e todos os seus dados foram excluídos com sucesso.` });
      setTimeout(() => setFeedbackMessage(null), 5000);
      playSound.success();
      
    } catch (error) {
      console.error('Error performing cascade delete:', error);
      setFeedbackMessage({ type: 'error', text: 'Erro ao excluir a empresa e seus dados.' });
      setTimeout(() => setFeedbackMessage(null), 5000);
      playSound.error();
    } finally {
      setIsDeleting(null);
      setCompanyToDelete(null);
    }
  };

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
            <div>
              <h1 className="font-tech text-3xl text-white mb-6">Gerenciamento de Empresas</h1>
              {renderFeedback()}
              <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-x-auto">
                <table className="w-full text-sm text-left text-slate-400">
                  <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 font-mono">
                    <tr>
                      <th scope="col" className="px-6 py-3">Empresa</th>
                      <th scope="col" className="px-6 py-3">E-mail</th>
                      <th scope="col" className="px-6 py-3">Funcionários</th>
                      <th scope="col" className="px-6 py-3">Validade</th>
                      <th scope="col" className="px-6 py-3">Status</th>
                      <th scope="col" className="px-6 py-3 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companies.map(company => {
                      const isExpired = company.planExpiresAt && new Date(company.planExpiresAt) < new Date();
                      const status = company.isBlocked ? 'Bloqueado' : isExpired ? 'Expirado' : 'Ativo';
                      return (
                        <tr key={company.uid} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <th scope="row" className="px-6 py-4 font-medium text-white whitespace-nowrap">{company.companyName}</th>
                          <td className="px-6 py-4">{company.email}</td>
                          <td className="px-6 py-4">{company.maxEmployees || 0}</td>
                          <td className="px-6 py-4">{company.planExpiresAt ? new Date(company.planExpiresAt).toLocaleDateString('pt-BR') : 'N/A'}</td>
                          <td className={`px-6 py-4 font-bold ${status === 'Ativo' ? 'text-green-400' : 'text-red-400'}`}>{status}</td>
                          <td className="px-6 py-4 text-right">
                            {isDeleting === company.uid ? (
                              <div className="flex justify-end">
                                <Loader2 className="w-5 h-5 animate-spin text-red-400" />
                              </div>
                            ) : (
                              <div className="flex justify-end items-center gap-2">
                                <button onClick={() => setEditingCompany(company)} className="font-medium text-cyan-400 hover:underline">Editar</button>
                                <button onClick={() => setCompanyToDelete(company)} className="p-1 text-slate-500 hover:text-red-400" title="Excluir Empresa">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
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

      {/* Company Edit Modal */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <CompanyEditModal 
            company={editingCompany}
            onClose={() => setEditingCompany(null)}
            onSave={handleUpdateCompany}
          />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {companyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-lg w-full shadow-[0_0_50px_rgba(239,68,68,0.2)] relative">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                <Trash2 className="w-6 h-6 text-red-400"/>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-1">Confirmar Exclusão</h2>
                <p className="text-slate-400 text-sm">
                  Tem certeza que deseja excluir permanentemente a empresa <strong>{companyToDelete.companyName}</strong> e todos os seus dados associados (funcionários, locais, turnos e registros de ponto)?
                </p>
                <p className="text-amber-400 text-xs mt-2 font-bold uppercase">Essa ação não pode ser desfeita.</p>
              </div>
            </div>
            
            <div className="flex justify-end gap-4 mt-8">
              <button 
                onClick={() => setCompanyToDelete(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm rounded-lg"
              >
                Cancelar
              </button>
              <button 
                onClick={() => handleDeleteCompany(companyToDelete.uid!, companyToDelete.companyName)}
                className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-sm rounded-lg flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Excluir Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-component for the modal
const CompanyEditModal: React.FC<{company: CompanyData, onClose: () => void, onSave: (id: string, data: Partial<CompanyData>) => void}> = ({ company, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    maxEmployees: company.maxEmployees || 0,
    planExpiresAt: company.planExpiresAt ? company.planExpiresAt.split('T')[0] : '',
    isBlocked: company.isBlocked || false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSave: Partial<CompanyData> = {
      maxEmployees: Number(formData.maxEmployees),
      isBlocked: formData.isBlocked,
      planExpiresAt: formData.planExpiresAt ? new Date(formData.planExpiresAt).toISOString() : new Date(0).toISOString(),
    };
    onSave(company.uid!, dataToSave);
  };

  return (
    <div className="bg-slate-900 border border-fuchsia-500/30 rounded-2xl p-8 max-w-lg w-full shadow-lg animate-in fade-in zoom-in-95">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-white">Editar {company.companyName}</h2>
        <button onClick={onClose}><X className="text-slate-500 hover:text-white"/></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <TechInput 
          label="Limite de Funcionários"
          type="number"
          value={formData.maxEmployees}
          onChange={e => setFormData({...formData, maxEmployees: parseInt(e.target.value) || 0})}
          icon={<Users className="w-4 h-4"/>}
        />
        <TechInput 
          label="Expiração do Plano"
          type="date"
          value={formData.planExpiresAt}
          onChange={e => setFormData({...formData, planExpiresAt: e.target.value})}
        />
        <div className="flex items-center justify-between bg-slate-800/50 p-4 rounded-lg">
           <label className="font-bold text-white">Bloquear Acesso</label>
           <button
             type="button"
             onClick={() => setFormData(f => ({...f, isBlocked: !f.isBlocked}))}
             className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 ${formData.isBlocked ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}
           >
             {formData.isBlocked ? <><XCircle className="w-4 h-4"/> Bloqueado</> : <><CheckCircle className="w-4 h-4"/> Ativo</>}
           </button>
        </div>
        <div className="flex justify-end gap-4 pt-4 border-t border-slate-800">
          <button type="button" onClick={onClose} className="px-6 py-2 bg-slate-700 text-white font-bold rounded-lg">Cancelar</button>
          <button type="submit" className="px-6 py-2 bg-fuchsia-600 text-white font-bold rounded-lg">Salvar</button>
        </div>
      </form>
    </div>
  );
}

export default SuperAdminDashboard;
