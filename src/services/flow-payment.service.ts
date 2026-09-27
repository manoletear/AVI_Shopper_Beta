/**
 * Flow.cl Payment Gateway Service
 *
 * Integración con la pasarela de pagos Flow (https://www.flow.cl)
 * para procesar pagos en CLP en supermercados chilenos.
 *
 * Endpoints Flow:
 *   POST /payment/create    → Crear orden de pago
 *   GET  /payment/getStatus → Consultar estado de pago
 *   POST /refund/create     → Solicitar reembolso
 *
 * Autenticación: HMAC-SHA256 sobre parámetros ordenados alfabéticamente.
 */

import crypto from 'crypto';

const FLOW_API_URL = process.env.FLOW_ENV === 'production'
  ? 'https://www.flow.cl/api'
  : 'https://sandbox.flow.cl/api';

const FLOW_PAYMENT_URL = process.env.FLOW_ENV === 'production'
  ? 'https://www.flow.cl/app/web/pay.php'
  : 'https://sandbox.flow.cl/app/web/pay.php';

interface FlowConfig {
  apiKey: string;
  secretKey: string;
}

function getConfig(): FlowConfig {
  const apiKey = process.env.FLOW_API_KEY;
  const secretKey = process.env.FLOW_SECRET_KEY;

  if (!apiKey || !secretKey) {
    throw new Error('FLOW_API_KEY y FLOW_SECRET_KEY son requeridos en .env');
  }

  return { apiKey, secretKey };
}

/**
 * Genera la firma HMAC-SHA256 para los parámetros de Flow.
 * Los parámetros se ordenan alfabéticamente por key y se concatenan como key=value.
 */
function signParams(params: Record<string, string>, secretKey: string): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => `${key}${params[key]}`)
    .join('');

  return crypto.createHmac('sha256', secretKey).update(sorted).digest('hex');
}

/**
 * Hace una llamada POST a la API de Flow con firma.
 */
async function flowPost(
  endpoint: string,
  params: Record<string, string>
): Promise<any> {
  const config = getConfig();
  params.apiKey = config.apiKey;
  params.s = signParams(params, config.secretKey);

  const body = new URLSearchParams(params);

  const res = await fetch(`${FLOW_API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flow API error ${res.status}: ${text}`);
  }

  return res.json();
}

/**
 * Hace una llamada GET a la API de Flow con firma.
 */
async function flowGet(
  endpoint: string,
  params: Record<string, string>
): Promise<any> {
  const config = getConfig();
  params.apiKey = config.apiKey;
  params.s = signParams(params, config.secretKey);

  const query = new URLSearchParams(params).toString();

  const res = await fetch(`${FLOW_API_URL}${endpoint}?${query}`, {
    method: 'GET',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Flow API error ${res.status}: ${text}`);
  }

  return res.json();
}

// ============================================
// CREAR ORDEN DE PAGO
// ============================================

export interface CreatePaymentInput {
  orderId: string;        // ID de la orden en AVI Shopper
  amount: number;         // Monto en CLP (entero)
  email: string;          // Email del comprador
  subject: string;        // Descripción del pago
  urlConfirmation: string; // URL webhook de confirmación (POST)
  urlReturn: string;      // URL de retorno al usuario
  optional?: Record<string, string>;
}

export interface CreatePaymentResult {
  url: string;        // URL para redirigir al usuario a pagar
  token: string;      // Token del pago en Flow
  flowOrder: number;  // Número de orden en Flow
}

export async function createPayment(
  input: CreatePaymentInput
): Promise<CreatePaymentResult> {
  const params: Record<string, string> = {
    commerceOrder: input.orderId,
    subject: input.subject,
    currency: 'CLP',
    amount: String(input.amount),
    email: input.email,
    urlConfirmation: input.urlConfirmation,
    urlReturn: input.urlReturn,
  };

  if (input.optional) {
    params.optional = JSON.stringify(input.optional);
  }

  const response = await flowPost('/payment/create', params);

  return {
    url: `${FLOW_PAYMENT_URL}?token=${response.token}`,
    token: response.token,
    flowOrder: response.flowOrder,
  };
}

// ============================================
// CONSULTAR ESTADO DE PAGO
// ============================================

export type PaymentStatus = 1 | 2 | 3 | 4;
// 1 = Pendiente, 2 = Pagada, 3 = Rechazada, 4 = Anulada

export interface PaymentStatusResult {
  flowOrder: number;
  commerceOrder: string;
  status: PaymentStatus;
  statusText: string;
  amount: number;
  email: string;
  paymentDate?: string;
  paymentMethod?: string;
}

const STATUS_TEXT: Record<number, string> = {
  1: 'Pendiente',
  2: 'Pagada',
  3: 'Rechazada',
  4: 'Anulada',
};

export async function getPaymentStatus(
  token: string
): Promise<PaymentStatusResult> {
  const response = await flowGet('/payment/getStatus', { token });

  return {
    flowOrder: response.flowOrder,
    commerceOrder: response.commerceOrder,
    status: response.status,
    statusText: STATUS_TEXT[response.status] || 'Desconocido',
    amount: response.amount,
    email: response.payer,
    paymentDate: response.paymentData?.date,
    paymentMethod: response.paymentData?.media,
  };
}

// ============================================
// SOLICITAR REEMBOLSO
// ============================================

export interface RefundInput {
  flowOrder: number;     // Número de orden en Flow
  amount: number;        // Monto a devolver en CLP
  receiverEmail: string; // Email del destinatario del reembolso
}

export interface RefundResult {
  token: string;
  flowRefundOrder: number;
  status: string;
}

export async function createRefund(
  input: RefundInput
): Promise<RefundResult> {
  const response = await flowPost('/refund/create', {
    refundCommerceOrder: String(Date.now()),
    receiverEmail: input.receiverEmail,
    amount: String(input.amount),
    urlCallBack: `${process.env.NEXTAUTH_URL}/api/payments/refund-callback`,
  });

  return {
    token: response.token,
    flowRefundOrder: response.flowRefundOrder,
    status: response.status,
  };
}

// ============================================
// VERIFICAR FIRMA DE WEBHOOK
// ============================================

export function verifyWebhookSignature(
  params: Record<string, string>,
  signature: string
): boolean {
  const config = getConfig();
  const expected = signParams(params, config.secretKey);
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signature)
  );
}
