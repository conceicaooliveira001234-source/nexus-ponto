import React, { useState } from 'react';
import { Building2, Mail, Lock, Phone, FileBadge, ArrowLeft, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import TechInput from '../ui/TechInput';
import TechBackground from '../TechBackground';
import { CompanyData } from '../../types';
import { playSound } from '../../lib/sounds';

interface CompanyRegisterProps {
  onRegister: (data: CompanyData) => Promise<void>;
  onBack: () => void;
}

const CompanyRegister: React.FC<CompanyRegisterProps> = ({ onRegister, onBack }) => {
  const [formData, setFormData] = useState<CompanyData>({
    cnpj: '',
    companyName: '',
    whatsapp: '',
    email: '',
    password: ''
  });
  const [isLoadingCNPJ, setIsLoadingCNPJ] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // CNPJ Mask: 00.000.000/0000-00
  const maskCNPJ = (value: string) => {
    return value
      .replace(/\D/g, '')
      .slice(0, 14)
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  };

  // Phone Mask: (00) 00000-0000
  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .slice(0, 11)
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d)(\d{4})$/, '$1-$2');
  };

  const fetchCNPJData = async (cnpj: string) => {
    setIsLoadingCNPJ(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
      if (!response.ok) throw new Error('Failed to fetch CNPJ data');
      
      const data = await response.json();
      
      // Prefer trade name (nome_fantasia), fallback to legal name (razao_social)
      const name = data.nome_fantasia || data.razao_social;
      
      if (name) {
        setFormData(prev => ({
          ...prev,
          companyName: name
        }));
        playSound.success();
      }
    } catch (error) {
      console.error("Error fetching CNPJ:", error);
      // Allow user to type manually if fetch fails
    } finally {
      setIsLoadingCNPJ(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    let newValue = value;

    if (name === 'cnpj') {
      newValue = maskCNPJ(value);
      const numericCNPJ = newValue.replace(/\D/g, '');
      
      // Trigger fetch only when fully typed (14 digits) and distinct from previous
      if (numericCNPJ.length === 14 && numericCNPJ !== formData.cnpj.replace(/\D/g, '')) {
         fetchCNPJData(numericCNPJ);
      }
    } else if (name === 'whatsapp') {
      newValue = maskPhone(value);
    }

    setFormData(prev => ({ ...prev, [name]: newValue }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playSound.click();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      await onRegister(formData);
      setSuccess('Conta criada com sucesso! Redirecionando...');
      playSound.success();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar conta.');
      playSound.error();
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <TechBackground />
      
      <div className="relative z-30 w-full max-w-2xl">
        <button 
          onClick={() => { playSound.click(); onBack(); }}
          className="mb-6 text-slate-400 hover:text-cyan-400 transition-colors flex items-center gap-2 font-mono text-xs uppercase"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Login
        </button>

        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 p-8 rounded-2xl shadow-[0_0_50px_-10px_rgba(8,145,178,0.2)]">
          <div className="flex items-center gap-4 mb-8 border-b border-slate-800 pb-6">
            <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
              <Building2 className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h2 className="font-tech text-2xl font-bold text-white">Novo Cadastro Empresarial</h2>
              <p className="text-slate-400 text-sm">Preencha os dados para registrar sua organização no Nexus.</p>
            </div>
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

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <TechInput 
              label="CNPJ" 
              name="cnpj"
              placeholder="00.000.000/0000-00"
              value={formData.cnpj}
              onChange={handleChange}
              icon={<FileBadge className="w-4 h-4" />}
              required
              maxLength={18} // 14 digits + 4 separators
              disabled={isSubmitting}
            />
            
            <TechInput 
              label="Nome da Empresa" 
              name="companyName"
              placeholder={isLoadingCNPJ ? "Buscando dados..." : "Nexus Industries Ltda"}
              value={formData.companyName}
              onChange={handleChange}
              icon={isLoadingCNPJ ? <Loader2 className="w-4 h-4 animate-spin text-cyan-400" /> : <Building2 className="w-4 h-4" />}
              required
              readOnly={isLoadingCNPJ}
              disabled={isSubmitting}
            />

            <TechInput 
              label="WhatsApp Corporativo" 
              name="whatsapp"
              type="tel"
              placeholder="(00) 00000-0000"
              value={formData.whatsapp}
              onChange={handleChange}
              icon={<Phone className="w-4 h-4" />}
              required
              maxLength={15} // 11 digits + 4 separators
              disabled={isSubmitting}
            />

            <div className="md:col-span-2 border-t border-slate-800 pt-4 mt-2">
               <h3 className="text-slate-300 font-mono text-sm mb-4">Credenciais de Acesso</h3>
            </div>

            <TechInput 
              label="E-mail de Acesso" 
              name="email"
              type="email"
              placeholder="admin@empresa.com"
              value={formData.email}
              onChange={handleChange}
              icon={<Mail className="w-4 h-4" />}
              required
              disabled={isSubmitting}
            />
            
            <TechInput 
              label="Senha" 
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              icon={<Lock className="w-4 h-4" />}
              required
              disabled={isSubmitting}
            />

            <div className="md:col-span-2 pt-4">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 px-4 rounded-lg shadow-[0_0_20px_rgba(8,145,178,0.4)] hover:shadow-[0_0_30px_rgba(8,145,178,0.6)] transition-all duration-300 flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Concluir Cadastro
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompanyRegister;
