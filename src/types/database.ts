export type ProductCategory = "Bếp" | "Quầy";
export type ProductUnit = string;
export type PackageUnit = string;
export type UnitType = "base" | "package";

export interface Unit {
  id: string;
  name: string;
  type: UnitType;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;          // đơn vị cơ bản: g, kg, l, ml
  package_unit: PackageUnit | null;  // đơn vị bao bì: túi, hộp, chai...
  package_size: number;       // quy đổi: 1 bao bì = ? đơn vị cơ bản
  created_at: string;
  updated_at: string;
}

export interface InventoryDaily {
  id: string;
  product_id: string;
  date: string;
  opening_stock: number;
  received: number;
  closing_stock: number;
  actual_used: number; // opening + received - closing
  updated_by: string | null;       // last user who entered/edited this row
  updated_by_name?: string | null; // resolved on client
  product?: Product;
  created_at: string;
}

export interface RecipeIngredient {
  product_id: string;
  quantity: number; // in product's unit
  product?: Product;
}

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  created_at: string;
  updated_at: string;
}

export interface FabiSale {
  id: string;
  date: string;
  item_name: string;
  quantity: number;
  created_at: string;
}

// ───────────────────────────────── Finance ─────────────────────────────────

export type PaymentType = "cash" | "transfer";
export type RevenueSource = "bar" | "ticket";

export interface DailyRevenue {
  id: string;
  date: string;
  source: RevenueSource;
  cash: number;
  transfer: number;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  date: string;
  name: string;
  payment_type: PaymentType;
  amount: number;
  created_by: string | null;
  created_by_name?: string | null;
  created_at: string;
}

export interface CashDeposit {
  id: string;
  date: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      products: {
        Row: Product;
        Insert: Omit<Product, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Product, "id" | "created_at" | "updated_at">>;
      };
      inventory_daily: {
        Row: InventoryDaily;
        Insert: Omit<InventoryDaily, "id" | "actual_used" | "created_at" | "product">;
        Update: Partial<Omit<InventoryDaily, "id" | "created_at" | "product">>;
      };
      recipes: {
        Row: Recipe;
        Insert: Omit<Recipe, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<Recipe, "id" | "created_at" | "updated_at">>;
      };
      fabi_sales: {
        Row: FabiSale;
        Insert: Omit<FabiSale, "id" | "created_at">;
        Update: Partial<Omit<FabiSale, "id" | "created_at">>;
      };
      units: {
        Row: Unit;
        Insert: Omit<Unit, "id" | "created_at">;
        Update: Partial<Omit<Unit, "id" | "created_at">>;
      };
      daily_revenue: {
        Row: DailyRevenue;
        Insert: Omit<DailyRevenue, "id" | "created_at" | "updated_at">;
        Update: Partial<Omit<DailyRevenue, "id" | "created_at" | "updated_at">>;
      };
      expenses: {
        Row: Expense;
        Insert: Omit<Expense, "id" | "created_at">;
        Update: Partial<Omit<Expense, "id" | "created_at">>;
      };
      cash_deposits: {
        Row: CashDeposit;
        Insert: Omit<CashDeposit, "id" | "created_at">;
        Update: Partial<Omit<CashDeposit, "id" | "created_at">>;
      };
    };
  };
}
