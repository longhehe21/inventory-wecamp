export type ProductCategory = "Bếp" | "Quầy" | "Lễ tân";
export type ProductUnit = "g" | "kg" | "l" | "ml" | "con" | "cái" | "phần";
export type PackageUnit = "túi" | "hộp" | "chai" | "gói" | "lon" | "thùng" | "cái" | "kg" | "lít";

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
    };
  };
}
