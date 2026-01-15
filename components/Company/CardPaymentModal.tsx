import React, { useState, useEffect } from 'react';
import { initMercadoPago, Payment } from '@mercadopago/sdk-react';
import { getPublicKey, processCardPayment } from '../../lib/mercadopago';
import { X, Loader2, AlertTriangle } from 'lucide-react';
import { playSound } from '../../lib/sounds';

interface CardPaymentModalProps {
  amount: number;
  payerEmail: string;
  onClose: () => void;
  onPaymentSuccess: () => void;
}

const CardPaymentModal: React.FC<CardPaymentModalProps> = ({ amount, payerEmail, onClose, onPaymentSuccess }) => {
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false); // For payment submission
  const [isSdkLoading, setIsSdkLoading] = useState(true); // For SDK key fetching
  const [isReady, setIsReady] = useState(false); // For Brick rendering

  useEffect(() => {
    let isMounted = true;
    const initializeMP = async () => {
      try {
        const publicKey = await getPublicKey();
        if (isMounted && publicKey) {
          initMercadoPago(publicKey, { locale: 'pt-BR' });
          setIsSdkLoading(false);
        } else if (isMounted) {
          throw new Error('Chave pública do Mercado Pago não foi encontrada.');
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message || 'Erro ao carregar o gateway de pagamento.');
          setIsSdkLoading(false);
        }
      }
    };
    initializeMP();

    return () => { isMounted = false; };
  }, []);
  
  const initialization = {
    amount: Number(amount),
    payer: {
      email: payerEmail,
      entity_type: 'individual',
    },
  };

  const customization = {
    visual: {
      style: {
        theme: 'dark' as const,
      }
    },
    paymentMethods: {
      creditCard: 'all' as const,
      debitCard: 'all' as const,
    }
  };

  const onSubmit = async (formData: any) => {
    setIsLoading(true);
    setError('');
    try {
      const response = await processCardPayment(formData);
      if (response.status === 'approved') {
        playSound.success();
        onPaymentSuccess();
      } else {
        throw new Error(`Pagamento ${response.status}. Motivo: ${response.status_detail}`);
      }
    } catch (err: any) {
      console.error("Card payment error:", err);
      setError(err.message || 'Ocorreu um erro ao processar seu pagamento. Verifique os dados e tente novamente.');
      playSound.error();
      setIsLoading(false);
      return Promise.reject();
    }
  };

  const onError = (err: any) => {
    console.error('🚨 Payment Brick onError callback:', err);
    setError('Ocorreu um erro inesperado ao carregar o formulário de pagamento. Verifique o console para mais detalhes.');
  };
  
  const onReady = () => {
    setIsReady(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-slate-900 border border-fuchsia-500/30 rounded-2xl p-8 max-w-lg w-full shadow-lg relative animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">Pagamento com Cartão de Crédito</h2>
          <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X /></button>
        </div>
        
        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center rounded-2xl z-10">
            <Loader2 className="w-12 h-12 text-fuchsia-400 animate-spin"/>
            <p className="mt-4 text-white">Processando pagamento...</p>
          </div>
        )}
        
        {error && (
           <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 text-red-300 rounded-lg flex items-center gap-2">
             <AlertTriangle className="w-5 h-5"/>
             <span className="text-sm">{error}</span>
           </div>
        )}
        
        {isSdkLoading && (
          <div className="flex flex-col items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
            <p className="mt-4 text-slate-400">A inicializar gateway de pagamento...</p>
          </div>
        )}
        {!isSdkLoading && !error && (
          <>
            {!isReady && (
              <div className="flex flex-col items-center justify-center h-48">
                <Loader2 className="w-8 h-8 animate-spin text-fuchsia-400" />
                <p className="mt-4 text-slate-400">A carregar formulário de pagamento...</p>
              </div>
            )}
            <div style={{ display: isReady ? 'block' : 'none' }}>
              <Payment
                initialization={initialization}
                customization={customization}
                onSubmit={onSubmit}
                onError={onError}
                onReady={onReady}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CardPaymentModal;
