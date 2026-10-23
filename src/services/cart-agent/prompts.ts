import { assertPromptDoesNotPay } from './safety';
import { CartRequestItem } from './types';

const STOP = `REGLAS ESTRICTAS:
- NO pagues.
- NO hagas clic en Pagar, Comprar ahora, Confirmar pedido, Finalizar compra, Ir al pago ni Continuar al pago.
- NO ingreses tarjeta, clave, contraseña, RUT ni dirección.
- Detente en la página del carrito.
- Si aparece un aviso de ubicación, elige retiro en tienda en Santiago sin escribir datos personales, solo para ver precios.
- Responde al final solo con JSON: {"ready":true,"itemsAdded":0,"total":0,"note":""}`;

export function jumboHandoffPrompt(sessionId: string): string {
  const prompt = `El carrito de Jumbo ya está armado en el servidor para la sesión de invitado.
1. Abre https://www.jumbo.cl/mi-carro?avi_session=${sessionId}
2. Si el carro sale vacío, ejecuta en la página: localStorage.setItem('sessionId', '${sessionId}') y vuelve a abrir https://www.jumbo.cl/mi-carro
3. Confirma que se ven productos. No agregues productos nuevos.
${STOP}`;
  assertPromptDoesNotPay(prompt);
  return prompt;
}

export function storeSearchPrompt(store: 'unimarc' | 'tottus', items: CartRequestItem[]): string {
  const start = store === 'unimarc'
    ? 'https://www.unimarc.cl'
    : 'https://www.tottus.cl/tottus-cl';
  const search = store === 'unimarc'
    ? (query: string) => `https://www.unimarc.cl/search?q=${encodeURIComponent(query)}`
    : (query: string) => `https://www.tottus.cl/tottus-cl/search?Ntt=${encodeURIComponent(query)}`;
  const lines = items.map((item, index) => {
    const qty = item.quantity || 1;
    return `${index + 1}. Busca "${item.productName}" en ${search(item.productName)}. Elige el primer producto de supermercado que coincida con el nombre. Agrégalo ${qty} vez/veces con el botón Agregar. No abras el pago.`;
  });
  const prompt = `Abre ${start} y arma el carrito de supermercado. No inicies sesión.
${lines.join('\n')}
Al terminar abre el carrito (no el pago) y lee el total.
${STOP}`;
  assertPromptDoesNotPay(prompt);
  return prompt;
}
