import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface SearchHistory {
  id: string;
  user_id: string;
  timestamp: string;
  business_type: string;
  prefecture: string;
  city: string;
  jurisdiction: string;
  jurisdiction_detail?: string;
  summary: string;
  reference_url?: string;
  reference_name?: string;
  guideline_url?: string;
  guideline_name?: string;
  flow: any;
  checked_steps: number[];
}

// 履歴一覧を取得
export async function GET(request: NextRequest) {
  try {
    const { data, error } = await supabase
      .from("search_history")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: "履歴の取得に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ history: data || [] });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

// 履歴を保存
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      userId,
      businessType,
      prefecture,
      city,
      jurisdiction,
      jurisdictionDetail,
      summary,
      referenceUrl,
      referenceName,
      guidelineUrl,
      guidelineName,
      flow,
      checkedSteps,
    } = body;

    const { data, error } = await supabase
      .from("search_history")
      .upsert({
        id,
        user_id: userId || "anonymous",
        timestamp: new Date().toISOString(),
        business_type: businessType,
        prefecture,
        city,
        jurisdiction,
        jurisdiction_detail: jurisdictionDetail,
        summary,
        reference_url: referenceUrl,
        reference_name: referenceName,
        guideline_url: guidelineUrl,
        guideline_name: guidelineName,
        flow,
        checked_steps: checkedSteps || [],
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: "履歴の保存に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

// チェック状態を更新
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, checkedSteps } = body;

    const { data, error } = await supabase
      .from("search_history")
      .update({ checked_steps: checkedSteps })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: "チェック状態の更新に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

// 履歴を削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "IDが指定されていません" }, { status: 400 });
    }

    const { error } = await supabase.from("search_history").delete().eq("id", id);

    if (error) {
      console.error("Supabase Error:", error);
      return NextResponse.json({ error: "履歴の削除に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: "サーバーエラーが発生しました" }, { status: 500 });
  }
}

