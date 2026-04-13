// ============================================
// API TYPES
// ============================================

export interface ApiError {
  message: string;
  code?: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ============================================
// SHOPPING TYPES
// ============================================

export interface CartItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  storeId: string;
  storeName: string;
}

export interface StoreSuggestion {
  storeId: string;
  storeName: string;
  items: CartItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  eta?: Date;
  savings?: number;
}

export interface SplitCartResult {
  bags: StoreSuggestion[];
  totalSavings: number;
  savingsPercentage: number;
  consolidatedOption?: StoreSuggestion;
}

// ============================================
// NUTRITION TYPES
// ============================================

export interface NutritionSummary {
  score: number;
  ultraProcessedPercentage: number;
  fruitServings: number;
  proteinGrams: number;
  totalCalories: number;
  trend?: {
    scoreDiff: number;
    ultraProcessedDiff: number;
  };
}

// ============================================
// ANALYTICS TYPES
// ============================================

export interface UserAnalytics {
  wauMau: number;
  retentionD30: number;
  ordersWithSplit: number;
  otif: number;
  totalSavings: number;
  averageOrderValue: number;
  topCategories: Array<{
    category: string;
    spent: number;
    percentage: number;
  }>;
}

// ============================================
// ALERT TYPES
// ============================================

export type AlertType = 'budget' | 'stock' | 'savings' | 'nutrition';
export type AlertLevel = 'info' | 'warn' | 'good';

export interface AlertData {
  type: AlertType;
  level: AlertLevel;
  title: string;
  message: string;
  actionLabel?: string;
  actionUrl?: string;
}

// ============================================
// STORE ACCOUNT TYPES
// ============================================

export type StoreAccountStatus = 'active' | 'pending' | 'suspended';

// ============================================
// CHAT & ORCHESTRATOR TYPES
// ============================================

export type ChatRole = 'user' | 'avi' | 'system';
export type AgentId = 'orchestrator' | 'shopping' | 'pricing' | 'nutrition' | 'budget' | 'account' | 'delivery';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  agentId?: AgentId;
  timestamp: string;
  metadata?: {
    intent?: string;
    agentsInvolved?: AgentId[];
    products?: Array<{ name: string; price?: number }>;
    savings?: number;
    actionButtons?: Array<{ label: string; action: string }>;
  };
}

export interface ChatSession {
  id: string;
  messages: ChatMessage[];
  context: {
    currentList?: string[];
    budget?: number;
    familySize?: number;
    activeAgents: AgentId[];
  };
}

export interface StoreAccountData {
  id: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  accountEmail: string;
  accountName: string | null;
  accountPhone: string | null;
  loyaltyNumber: string | null;
  isVerified: boolean;
  isAutoCreated: boolean;
  status: StoreAccountStatus;
  createdAt: string;
}
