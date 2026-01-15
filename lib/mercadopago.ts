import { db } from './firebase';
import { doc, getDoc } from 'firebase/firestore';
import { SystemSettings } from '../types';

// Função para buscar o Access Token do Firestore de forma segura
async function getAccessToken(): Promise<string> {
  const settingsDoc = await getDoc(doc(db, 'system_settings', 'payment_config'));
  if (!settingsDoc.exists()) {
    throw new Error('Configurações de pagamento não encontradas.');
  }
  const settings = settingsDoc.data() as SystemSettings;
  if (!settings.mercadoPagoAccessToken) {
    throw new Error('Access Token do Mercado Pago não configurado pelo administrador.');
  }
  return settings.mercadoPagoAccessToken;
}

interface PixPaymentResponse {
  paymentId: number;
  qrCode: string;
  qrCodeBase64: string;
}

/**
 * Cria uma ordem de pagamento PIX no Mercado Pago.
 */
export async function processPixPayment(
  amount: number,
  email: string,
  cpf: string,
  description: string
): Promise<PixPaymentResponse> {
  const accessToken = await getAccessToken();
  const url = 'https://api.mercadopago.com/v1/payments';

  const body = {
    transaction_amount: amount,
    description: description,
    payment_method_id: 'pix',
    payer: {
      email: email,
      identification: {
        type: 'CPF',
        number: cpf.replace(/\D/g, ''), // Envia apenas os números
      },
    },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Erro na API do Mercado Pago:', data);
    throw new Error(data.message || 'Erro ao processar pagamento PIX.');
  }

  return {
    paymentId: data.id,
    qrCode: data.point_of_interaction.transaction_data.qr_code,
    qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64,
  };
}

/**
 * Verifica o status de um pagamento no Mercado Pago.
 */
export async function checkPaymentStatus(paymentId: number): Promise<string> {
  const accessToken = await getAccessToken();
  const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Erro ao verificar status do pagamento:', data);
    throw new Error(data.message || 'Erro ao verificar status do pagamento.');
  }

  return data.status; // ex: 'pending', 'approved', 'cancelled'
}
