export interface CartRequestItem {
  productName: string;
  quantity?: number;
  sku?: string;
  price?: number;
}

export interface CartLineResult {
  query: string;
  quantity: number;
  added: boolean;
  matchedName?: string;
  sku?: string;
  price?: number;
  lineTotal?: number;
  productUrl?: string;
  reason?: string;
}

export type CartStatus = 'ready' | 'running' | 'needs_setup' | 'unsupported' | 'failed';

export type CartMode = 'jumbo-bff' | 'deep-link' | 'hyperbrowser' | 'assisted' | 'unsupported';

export type CartHandoff = 'extension' | 'cloud' | 'user-browser' | 'none';

export interface AutomaticCartResult {
  status: CartStatus;
  mode: CartMode;
  store: string;
  storeSlug: string;
  itemsAdded: number;
  itemsFailed: string[];
  items: CartLineResult[];
  totalEstimated: number;
  cartUrl: string;
  liveUrl: string | null;
  jobId: string | null;
  handoff: CartHandoff;
  message: string;
  /** AVI nunca confirma el pago. El usuario paga en el supermercado. */
  paymentStopped: true;
  needsKey: boolean;
  keyHint?: string;
}

export interface JumboProduct {
  name: string;
  sku: string;
  price?: number;
  brand?: string;
  productUrl?: string;
}

export const JUMBO_CART_PAGE = 'https://www.jumbo.cl/mi-carro';
export const JUMBO_SEARCH_PAGE = 'https://www.jumbo.cl/busqueda';
export const JUMBO_DEFAULT_SELLER = 'jumboclj512';
export const JUMBO_CART_API = 'https://be-reg-groceries-bff-jumbo.ecomm.cencosud.com';

/** Clave pública del sitio web de Jumbo (va en el JavaScript del frontend). */
export const JUMBO_PUBLIC_CART_KEY = 'be-reg-groceries-jumbo-cart-rhk68rqi0adn';

export const HYPERBROWSER_KEY_HINT =
  'Entra a https://www.hyperbrowser.ai, crea una cuenta (tienen plan gratis) y copia la API key del panel. En Vercel (o en .env) crea HYPERBROWSER_API_KEY con ese valor. También se acepta el nombre BROWSER_AGENT_KEY.';
