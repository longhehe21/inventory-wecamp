export type UserRole = "admin" | "manager" | "employee";
export type UserCategory = "Bếp" | "Quầy" | "Lễ tân";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  category: UserCategory | null;
  created_at: string;
}
