/**
 * Guardas puras (sin Playwright) para los adaptadores. Se testean sin navegador.
 */

/** Rutas que pagan o cierran el pedido. Se abortan siempre: AVI nunca hace checkout. */
const FORBIDDEN_URL_PATTERNS: RegExp[] = [
  /\/api\/checkout\/pub\/orderForm\/[^/]+\/transaction/i,
  /\/api\/checkout\/pub\/orders?\b/i,
  /\/api\/payments?\//i,
  /\/checkout\/?#\/payment/i,
  /\/checkout\/?(#\/)?orderPlaced/i,
  /\/(place-?order|confirm-?order|pagar|payment|pago)\b/i,
];

export function isForbiddenCheckoutUrl(url: string): boolean {
  return FORBIDDEN_URL_PATTERNS.some((re) => re.test(url));
}

/** Texto de botones que nunca se clickean. */
export const FORBIDDEN_BUTTON_TEXT = /(pagar|finalizar compra|ir a pagar|confirmar (pedido|compra)|place order|comprar ahora)/i;

/**
 * Señales de captcha, 2FA o verificación humana. Si aparece cualquiera,
 * el adaptador devuelve needs_user_action y se detiene. No hay evasión.
 */
export const BLOCKER_SELECTORS = [
  'iframe[src*="recaptcha/api2/bframe"]',
  'iframe[src*="hcaptcha.com"]',
  'iframe[src*="challenges.cloudflare.com"]',
  '#challenge-form',
  '#px-captcha',
  'input[autocomplete="one-time-code"]',
];

export function looksLikeBlockerTitle(title: string): boolean {
  return /(just a moment|attention required|access denied|verify you are human|un momento|verificaci[oó]n de seguridad)/i.test(title);
}

/** "$2.690" -> 2690; "1.234,5" -> 1234; vacío -> 0. Precios CLP enteros. */
export function parseClp(text: string | null | undefined): number {
  if (!text) return 0;
  const intPart = text.split(',')[0];
  const digits = intPart.replace(/\D/g, '');
  return digits ? Number.parseInt(digits, 10) : 0;
}

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Mismo producto si todas las palabras del aprobado están en el de la tienda. */
export function sameProduct(approvedName: string, storeName: string): boolean {
  const tokens = normalizeName(approvedName).split(' ').filter((t) => t.length > 1);
  const target = ` ${normalizeName(storeName)} `;
  return tokens.length > 0 && tokens.every((t) => target.includes(` ${t} `));
}
