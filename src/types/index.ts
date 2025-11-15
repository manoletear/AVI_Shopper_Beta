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
