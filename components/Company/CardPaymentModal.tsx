import React, { useState, useEffect, useRef } from 'react';
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
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let isMounted = true;
    const initializeMP = async () => {
      try {
        console.log('Buscando Public Key...');
        const publicKey = await getPublicKey();
        
        if (!isMounted) return;

        if (publicKey) {
          console.log('Public Key encontrada. Inicializando SDK...');
          initMercadoPago(publicKey, { locale: 'pt-BR' });
          
          // Delay de seguranca para evitar erro de container
          setTimeout(() => {
            if (isMounted) setIsReady(true);
          }, 1000);
        } else {
          setError('Erro: Chave Publica nao configurada no Painel Admin.');
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Erro ao inicializar pagamento.');
      }
    };
    initializeMP();
    return () => { isMounted = false; };
  }, []);

  const initialization = {
    amount: Number(amount),
    payer: {
      email: payerEmail || 'cliente@nexuswork.com.br',
      entity_type: 'individual',
      first_name: 'Cliente',
      last_name: 'Nexus',
    },
  };

  const customization = {
    visual: { style: { theme: 'dark' as const } },
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
        throw new Error(`Pagamento nao aprovado: ${response.status_detail}`);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao processar pagamento.');
      playSound.error();
      setIsLoading(false);
      return Promise.reject();
    }
  };

  const onError = (err: any) => {
    console.error('Erro no Brick:', err);
  };

  const onReady = () => {
    console.log('Brick pronto.');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div 
        className="bg-slate-900 border border-cyan-500/30 rounded-2xl p-8 max-w-lg w-full shadow-lg relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-white">
          <X />
        </button>
        
        <h2 className="text-xl font-bold text-white mb-6">Pagamento Seguro</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-500 text-red-200 rounded text-sm flex gap-2 items-center">
            <AlertTriangle size={16} />
            {error}
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 bg-slate-900/90 z-20 flex flex-col items-center justify-center rounded-2xl">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin mb-2" />
            <p className="text-white">Processando...</p>
          </div>
        )}

        <div className="min-h-[450px] flex flex-col justify-center">
          {!isReady ? (
            <div className="flex flex-col items-center text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin mb-2" />
              <p>Carregando gateway...</p>
            </div>
          ) : (
            <Payment
              initialization={initialization}
              customization={customization}
              onSubmit={onSubmit}
              onError={onError}
              onReady={onReady}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default CardPaymentModal;
