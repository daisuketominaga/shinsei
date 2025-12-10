import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

interface SaveRequest {
  businessType: string;
  prefecture: string;
  city: string;
  jurisdiction: string;
  jurisdictionDetail: string;
  summary: string;
  guidelineUrl: string;
}

const BUSINESS_TYPE_NAMES: Record<string, string> = {
  residential_home: "住宅型有料老人ホーム",
  visiting_nursing: "訪問看護事業所",
  visiting_care: "訪問介護事業所",
};

export async function POST(request: NextRequest) {
  try {
    const body: SaveRequest = await request.json();

    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
    const clientEmail = process.env.GOOGLE_SHEETS_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");

    if (!spreadsheetId || !clientEmail || !privateKey) {
      return NextResponse.json(
        { error: "Google Sheets の設定が不足しています" },
        { status: 500 }
      );
    }

    // Google Sheets API認証
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: privateKey,
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });

    // 現在日時（日本時間）
    const now = new Date();
    const jstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateStr = jstDate.toISOString().replace("T", " ").substring(0, 19);

    // スプレッドシートに追加するデータ
    const values = [
      [
        dateStr,
        BUSINESS_TYPE_NAMES[body.businessType] || body.businessType,
        body.prefecture,
        body.city,
        body.jurisdiction,
        body.jurisdictionDetail,
        body.summary,
        body.guidelineUrl || "",
      ],
    ];

    // データを追加
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "A:H",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    return NextResponse.json({ success: true, message: "スプレッドシートに保存しました" });
  } catch (error) {
    console.error("Google Sheets Error:", error);
    return NextResponse.json(
      { error: "スプレッドシートへの保存に失敗しました" },
      { status: 500 }
    );
  }
}

