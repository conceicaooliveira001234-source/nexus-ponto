import React, { useState, useEffect } from 'react';
import { db } from '../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SystemSettings } from '../../types';
import { Loader2, CreditCard } from 'lucide-react';

// Declaração para a SDK do MercadoPago
declare const MercadoPago: any;

const Checkout: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'system_settings', 'payment_config'));
        if (settingsDoc.exists()) {
          const data = settingsDoc.data() as SystemSettings;
          if (!data.mercadoPagoPublicKey) {
            setError('Chave pública do Mercado Pago não configurada pelo administrador.');
          } else {
            setSettings(data);
          }
        } else {
          setError('Configurações de pagamento não encontradas.');
        }
      } catch (err) {
        setError('Erro ao carregar configurações de pagamento.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings?.mercadoPagoPublicKey && typeof MercadoPago !== 'undefined') {
      try {
        const mp = new MercadoPago(settings.mercadoPagoPublicKey);
        // Aqui você inicializaria os "bricks" do Mercado Pago
        // Exemplo: mp.cardPayment({ ... });
        console.log('SDK do Mercado Pago inicializada com a Public Key.');
      } catch (e) {
        console.error('Erro ao inicializar SDK do Mercado Pago:', e);
        setError('Falha ao inicializar o gateway de pagamento. Verifique a Public Key.');
      }
    }
  }, [settings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
        <p className="ml-4 text-slate-400">A carregar o gateway de pagamento...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/30 border border-red-500/50 text-red-300 p-4 rounded-lg">
        <h3 className="font-bold">Erro de Configuração</h3>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-tech text-3xl text-white mb-6 flex items-center gap-3">
        <CreditCard className="w-8 h-8 text-cyan-400" />
        Financeiro e Assinatura
      </h2>
      
      <div className="bg-slate-900/50 border border-slate-800 rounded-lg p-8">
        <h3 className="text-xl font-bold text-white mb-2">O seu Plano</h3>
        <p className="text-slate-400 mb-6">Aqui poderá gerir a sua assinatura, visualizar faturas e alterar o seu plano.</p>

        {/* Placeholder para o formulário de checkout */}
        <div className="border-2 border-dashed border-slate-700 rounded-xl p-12 text-center">
           <p className="text-slate-500">
             O formulário de Checkout do Mercado Pago será renderizado aqui.
           </p>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
