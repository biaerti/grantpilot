import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("project_id")
  const gender = searchParams.get("gender")
  const search = searchParams.get("search")

  let query = supabase
    .from("participants")
    .select("*")
    .order("last_name")

  if (projectId) query = query.eq("project_id", projectId)
  if (gender) query = query.eq("gender", gender)
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%`)

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const body = await request.json()

  // Check for duplicate PESEL within same project
  if (body.pesel && body.project_id) {
    const { data: existing } = await supabase
      .from("participants")
      .select("id")
      .eq("pesel", body.pesel)
      .eq("project_id", body.project_id)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: "Uczestnik z tym numerem PESEL już istnieje w tym projekcie." },
        { status: 409 }
      )
    }
  }

  const { data, error } = await supabase
    .from("participants")
    .insert(body)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
