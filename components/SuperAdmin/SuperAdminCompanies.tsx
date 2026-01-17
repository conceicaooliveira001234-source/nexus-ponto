import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { collection, onSnapshot, doc, updateDoc, query, where, getDocs, writeBatch } from 'firebase/firestore';
import { CompanyData } from '../../types';
import { Loader2, Edit, X, Save, Users, CheckCircle, XCircle, Trash2, AlertTriangle, ExternalLink } from 'lucide-react';
import TechInput from '../ui/TechInput';
import { playSound } from '../../lib/sounds';

interface CompanyWithCount extends CompanyData {
  employeeCount: number;
}

interface SuperAdminCompaniesProps {
  onImpersonate: (company: CompanyData) => void;
}

const SuperAdminCompanies: React.FC<SuperAdminCompaniesProps> = ({ onImpersonate }) => {
  const [companies, setCompanies] = useState<CompanyWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingCompany, setEditingCompany] = useState<CompanyData | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<CompanyData | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{type: 'success'|'error', text: string} | null>(null);


  useEffect(() => {
    const unsubCompanies = onSnapshot(collection(db, 'companies'), async (snapshot) => {
      setIsLoading(true);
      const allCompaniesData = snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as CompanyData));
      
      const companiesWithCounts = await Promise.all(
        allCompaniesData.map(async (company) => {
          const employeesQuery = query(collection(db, 'employees'), where('companyId', '==', company.uid));
          const employeesSnapshot = await getDocs(employeesQuery);
          return {
            ...company,
            employeeCount: employeesSnapshot.size,
          };
        })
      );

      setCompanies(companiesWithCounts);
      setIsLoading(false);
    });

    return () => unsubCompanies();
  }, []);
  
  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMessage({ type, text });
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleUpdateCompany = async (companyId: string, data: Partial<CompanyData>) => {
    try {
      await updateDoc(doc(db, 'companies', companyId), data);
      setEditingCompany(null);
      playSound.success();
      showFeedback('success', 'Empresa atualizada com sucesso!');
    } catch (error) {
      console.error('Error updating company:', error);
      showFeedback('error', 'Erro ao atualizar empresa.');
    }
  };

  const handleDeleteCompany = async (companyId: string, companyName: string) => {
    setIsDeleting(companyId);
    try {
      const batch = writeBatch(db);
      const collectionsToDelete = ['employees', 'locations', 'shifts', 'attendance'];
      
      for (const collectionName of collectionsToDelete) {
        const q = query(collection(db, collectionName), where('companyId', '==', companyId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => batch.delete(doc.ref));
      }

      const companyRef = doc(db, 'companies', companyId);
      batch.delete(companyRef);
      await batch.commit();

      showFeedback('success', `Empresa "${companyName}" e todos os seus dados foram excluídos.`);
      playSound.success();
    } catch (error) {
      console.error('Error performing cascade delete:', error);
      showFeedback('error', 'Erro ao excluir a empresa.');
      playSound.error();
    } finally {
      setIsDeleting(null);
      setCompanyToDelete(null);
    }
  };
  
  const renderFeedback = () => feedbackMessage && (
    <div className={`mb-4 flex items-center gap-2 text-sm p-3 rounded-lg border ${
        feedbackMessage.type === 'success' ? 'text-green-300 bg-green-900/50 border-green-500/30' : 'text-red-300 bg-red-900/50 border-red-500/30'
      } animate-in fade-in`}
    >
      {feedbackMessage.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
      <span>{feedbackMessage.text}</span>
    </div>
  );

  return (
    <div>
      <h1 className="font-tech text-3xl text-white mb-6">Gerenciamento de Empresas</h1>
      {renderFeedback()}
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-400">
          <thead className="text-xs text-slate-400 uppercase bg-slate-800/50 font-mono">
            <tr>
              <th scope="col" className="px-6 py-3">Empresa</th>
              <th scope="col" className="px-6 py-3">Status</th>
              <th scope="col" className="px-6 py-3">Cota</th>
              <th scope="col" className="px-6 py-3">Validade</th>
              <th scope="col" className="px-6 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="text-center p-8"><Loader2 className="animate-spin inline-block"/></td></tr>}
            {!isLoading && companies.map(company => {
              const isExpired = company.subscriptionExpiresAt && new Date(company.subscriptionExpiresAt) < new Date();
              const status = company.planStatus || (isExpired ? 'inactive' : 'active');
              
              const statusStyles = {
                active: 'text-green-400',
                inactive: 'text-amber-400',
                blocked: 'text-red-400',
              };

              return (
                <tr key={company.uid} className="border-b border-slate-800 hover:bg-slate-800/30">
                  <td className="px-6 py-4 font-medium text-white whitespace-nowrap">{company.companyName}</td>
                  <td className={`px-6 py-4 font-bold capitalize ${statusStyles[status]}`}>{status}</td>
                  <td className="px-6 py-4">{company.employeeCount} / {company.maxEmployees || '∞'}</td>
                  <td className="px-6 py-4">{company.subscriptionExpiresAt ? new Date(company.subscriptionExpiresAt).toLocaleDateString('pt-BR') : 'N/A'}</td>
                  <td className="px-6 py-4 text-right">
                    {isDeleting === company.uid ? <Loader2 className="w-5 h-5 animate-spin text-red-400 ml-auto" /> : (
                      <div className="flex justify-end items-center gap-4">
                        <button
                          onClick={() => {
                            if (window.confirm(`Acessar o painel de ${company.companyName}?`)) {
                              onImpersonate(company);
                            }
                          }}
                          className="font-medium text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 text-xs"
                        >
                          <ExternalLink className="w-3 h-3" /> Acessar
                        </button>
                        <button onClick={() => setEditingCompany(company)} className="font-medium text-cyan-400 hover:underline text-xs">Editar</button>
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
      {editingCompany && <CompanyEditModal company={editingCompany} onClose={() => setEditingCompany(null)} onSave={handleUpdateCompany} />}
      {companyToDelete && <DeleteConfirmationModal company={companyToDelete} onClose={() => setCompanyToDelete(null)} onConfirm={handleDeleteCompany} isDeleting={!!isDeleting} />}
    </div>
  );
};

const CompanyEditModal: React.FC<{company: CompanyData, onClose: () => void, onSave: (id: string, data: Partial<CompanyData>) => void}> = ({ company, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    maxEmployees: company.maxEmployees || 5,
    planStatus: company.planStatus || 'active',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(company.uid!, { ...formData, maxEmployees: Number(formData.maxEmployees) });
  };

  return (
     <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
        <div className="bg-slate-900 border border-fuchsia-500/30 rounded-2xl p-8 max-w-lg w-full shadow-lg">
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
            <div>
              <label className="text-xs font-mono text-cyan-400 tracking-wider uppercase ml-1">Status do Plano</label>
              <select 
                value={formData.planStatus}
                onChange={e => setFormData({...formData, planStatus: e.target.value as any})}
                className="w-full bg-slate-950/50 border border-slate-700 text-white placeholder-slate-600 text-sm rounded-lg focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 block p-3 transition-all duration-300"
              >
                <option value="active">Ativo</option>
                <option value="inactive">Inativo</option>
                <option value="blocked">Bloqueado</option>
              </select>
            </div>
            <div className="flex justify-end gap-4 pt-4 border-t border-slate-800">
              <button type="button" onClick={onClose} className="px-6 py-2 bg-slate-700 text-white font-bold rounded-lg">Cancelar</button>
              <button type="submit" className="px-6 py-2 bg-fuchsia-600 text-white font-bold rounded-lg">Salvar</button>
            </div>
          </form>
        </div>
     </div>
  );
}

const DeleteConfirmationModal: React.FC<{company: CompanyData, onClose: () => void, onConfirm: (id: string, name: string) => void, isDeleting: boolean}> = ({ company, onClose, onConfirm, isDeleting }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
    <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-8 max-w-lg w-full shadow-lg">
      <h2 className="text-xl font-bold text-white mb-2">Confirmar Exclusão</h2>
      <p className="text-slate-400 text-sm">
        Tem certeza que deseja excluir permanentemente a empresa <strong>{company.companyName}</strong> e todos os seus dados? (funcionários, locais, turnos, etc).
      </p>
      <p className="text-amber-400 text-xs mt-2 font-bold uppercase">Essa ação não pode ser desfeita.</p>
      <div className="flex justify-end gap-4 mt-8">
        <button onClick={onClose} disabled={isDeleting} className="px-6 py-2 bg-slate-700 text-white font-bold rounded-lg disabled:opacity-50">Cancelar</button>
        <button onClick={() => onConfirm(company.uid!, company.companyName)} disabled={isDeleting} className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg flex items-center gap-2 disabled:opacity-50">
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          Excluir
        </button>
      </div>
    </div>
  </div>
);

export default SuperAdminCompanies;
