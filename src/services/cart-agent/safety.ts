const BLOCKED_PATH = /\/cart\/(transaction|payment-method|checkout|shipping-data|order-info)\b/i;

const BLOCKED_TEXT = /(pagar|confirmar pedido|finalizar compra|realizar pedido|ir al pago|continuar al pago|datos de tarjeta)/i;

export function assertSafeCartRequest(url: string): void {
  let path = url;
  try {
    path = new URL(url).pathname;
  } catch {
    path = url;
  }
  if (BLOCKED_PATH.test(path)) {
    throw new Error('AVI se detiene en el carrito y no llama al pago del supermercado.');
  }
}

export function isPaymentAction(label: string): boolean {
  return BLOCKED_TEXT.test(label);
}

export function assertPromptDoesNotPay(prompt: string): void {
  if (!/no hagas clic en pagar/i.test(prompt) && !/no pagues/i.test(prompt)) {
    throw new Error('La instrucción del navegador tiene que prohibir el pago.');
  }
  if (/password|contraseña|tarjeta/i.test(prompt) && /ingresa (tu |la )?(clave|contraseña|tarjeta)/i.test(prompt)) {
    throw new Error('La instrucción no puede pedir claves ni tarjetas.');
  }
}
