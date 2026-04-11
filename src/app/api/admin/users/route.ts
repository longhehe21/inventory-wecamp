import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY chưa được cấu hình");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// POST /api/admin/users — create a new user
export async function POST(req: NextRequest) {
  try {
    const { email, password, full_name, role, category } = await req.json();

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
    }
    if (role === "employee" && !category) {
      return NextResponse.json({ error: "Nhân viên phải có phân loại (Bếp/Quầy)" }, { status: 400 });
    }

    const admin = getAdminClient();

    // Create auth user
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Insert profile
    const { error: profileError } = await admin.from("user_profiles").insert({
      id: authData.user.id,
      email,
      full_name,
      role,
      category: role === "employee" ? category : null,
    });
    if (profileError) {
      // Rollback: delete auth user if profile insert fails
      await admin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: authData.user.id });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/admin/users?id=UUID — delete a user
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Thiếu id" }, { status: 400 });

    const admin = getAdminClient();

    // Delete auth user (cascades to user_profiles via FK)
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
