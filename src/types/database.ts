export type ProductCategory = "Bếp" | "Quầy" | "Lễ tân";
// Inventory tracking is per-warehouse. A product can be tracked in multiple
// warehouses simultaneously (e.g. Bếp tracks total stock, Lễ tân tracks the
// portion they hold for guests).
export type Warehouse = "Bếp" | "Quầy" | "Lễ tân";
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
  // If true and category is Bếp/Quầy, the product ALSO appears in Lễ tân
  // for separate tracking. Products with category="Lễ tân" always show up
  // in Lễ tân regardless of this flag.
  in_letan: boolean;
  is_intermediate: boolean;  // true cho cốt trà nhài/caramel/lẩu gà/xôi - output của sub-recipe
  created_at: string;
  updated_at: string;
}

export interface InventoryDaily {
  id: string;
  product_id: string;
  date: string;
  warehouse: Warehouse;            // which warehouse this snapshot is for
  opening_stock: number;
  received: number;
  closing_stock: number;
  actual_used: number; // opening + received - closing
  updated_by: string | null;       // last user who entered/edited this row
  updated_by_name?: string | null; // resolved on client
  product?: Product;
  created_at: string;
}

// ──────────────── Recipe (new format with type + overhead support) ────────────────

// Old format (legacy): { product_id, quantity }
// New format: { type: "product"|"overhead", product_id|overhead_id, qty, unit, note? }
export interface RecipeIngredientLegacy {
  product_id: string;
  quantity: number; // in product's unit
  product?: Product;
}

export interface RecipeIngredientProduct {
  type: "product";
  product_id: string;
  qty: number;
  unit: string;
  note?: string;
}

export interface RecipeIngredientOverhead {
  type: "overhead";
  overhead_id: string;
  qty: number;
  unit: string;
  note?: string;
}

export type RecipeIngredientNew = RecipeIngredientProduct | RecipeIngredientOverhead;

// Any ingredient (handle both legacy + new)
export type RecipeIngredient = RecipeIngredientLegacy | RecipeIngredientNew;

// Helpers to distinguish
export function isLegacyIngredient(ing: RecipeIngredient): ing is RecipeIngredientLegacy {
  return !("type" in ing) && "quantity" in ing;
}
export function isOverheadIngredient(ing: RecipeIngredient): ing is RecipeIngredientOverhead {
  return "type" in ing && ing.type === "overhead";
}
export function isProductIngredient(ing: RecipeIngredient): ing is RecipeIngredientProduct {
  return "type" in ing && ing.type === "product";
}

export type RecipeType = "final" | "sub";

export interface Recipe {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  recipe_type: RecipeType;                  // 'sub' = ủ cốt, 'final' = món bán
  output_product_id: string | null;         // chỉ sub-recipe: ref tới product intermediate
  output_qty: number | null;
  output_unit: string | null;
  created_at: string;
  updated_at: string;
}

// ──────────────── Supplier + PriceList + CostOverhead ────────────────

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  note: string | null;
  created_at: string;
}

export interface PriceList {
  id: string;
  name: string;
  effective_from: string;        // ISO date
  is_active: boolean;            // chỉ 1 bảng active tại 1 thời điểm
  note: string | null;
  created_at: string;
}

export interface PriceListItem {
  id: string;
  price_list_id: string;
  product_id: string;
  supplier_id: string | null;
  price: number;                 // price per BASE UNIT (đã chia package_size)
  unit: string;
  note: string | null;
  // resolved on client
  product?: Product;
  supplier?: Supplier;
}

export interface CostOverhead {
  id: string;
  code: string;                  // 'da_vien', 'dien_chien', 'gas_cn'...
  name: string;
  unit: string;                  // 'suất', 'lần', 'bộ'
  cost: number;
  note: string | null;
  created_at: string;
}

// View `recipe_costs_active` - returned by SELECT * FROM recipe_costs_active
export interface RecipeCostActive {
  recipe_id: string;
  recipe_name: string;
  recipe_type: RecipeType;
  output_product_id: string | null;
  output_qty: number | null;
  output_unit: string | null;
  total_cost: number | null;
  unit_cost: number | null;
}

// ──────────────── Existing finance types (unchanged) ────────────────

export interface FabiSale {
  id: string;
  date: string;
  item_name: string;
  quantity: number;
  created_at: string;
}

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
      suppliers: {
        Row: Supplier;
        Insert: Omit<Supplier, "id" | "created_at">;
        Update: Partial<Omit<Supplier, "id" | "created_at">>;
      };
      price_lists: {
        Row: PriceList;
        Insert: Omit<PriceList, "id" | "created_at">;
        Update: Partial<Omit<PriceList, "id" | "created_at">>;
      };
      price_list_items: {
        Row: PriceListItem;
        Insert: Omit<PriceListItem, "id" | "product" | "supplier">;
        Update: Partial<Omit<PriceListItem, "id" | "product" | "supplier">>;
      };
      cost_overhead: {
        Row: CostOverhead;
        Insert: Omit<CostOverhead, "id" | "created_at">;
        Update: Partial<Omit<CostOverhead, "id" | "created_at">>;
      };
    };
    Views: {
      recipe_costs_active: {
        Row: RecipeCostActive;
      };
    };
  };
}
