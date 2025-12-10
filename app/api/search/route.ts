import { NextRequest, NextResponse } from "next/server";
import { determineJurisdiction } from "@/lib/constants";

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";
const PERPLEXITY_MODEL = "sonar-pro";

interface SearchRequest {
  prefecture: string;
  city: string;
  businessType: "residential_home" | "visiting_nursing" | "visiting_care";
}

interface FlowStep {
  step: string;
  documents: string[];
}

interface SearchResponse {
  jurisdiction: string;
  jurisdiction_detail?: string;
  flow: FlowStep[];
  summary: string;
  reference_url: string;
  reference_name?: string;
  guideline_url?: string;
  guideline_name?: string;
}

interface JurisdictionCheckResponse {
  jurisdiction: string;
  is_city: boolean;
  reason: string;
  source_url?: string;
}

// 神奈川県の訪問看護/訪問介護は「横浜・川崎・相模原・横須賀」以外は県が申請先
const KANAGAWA_SPECIAL_CITIES = ["横浜市", "川崎市", "相模原市", "横須賀市"];

const BUSINESS_TYPE_CONFIG = {
  residential_home: {
    name: "住宅型有料老人ホーム",
    searchTerms: "住宅型有料老人ホーム 届出 設置 手引き",
    jurisdictionSearchTerms: "有料老人ホーム 届出 届出先 窓口",
    blockKeywords: ["建築確認", "指導事項", "完成検査"],
  },
  visiting_nursing: {
    name: "訪問看護事業所",
    searchTerms: "訪問看護事業所 指定申請 開設 手引き 介護保険",
    jurisdictionSearchTerms: "訪問看護 指定申請 申請先 窓口 介護保険",
    blockKeywords: [],
  },
  visiting_care: {
    name: "訪問介護事業所",
    searchTerms: "訪問介護事業所 指定申請 開設 手引き 介護保険",
    jurisdictionSearchTerms: "訪問介護 指定申請 申請先 窓口 介護保険",
    blockKeywords: [],
  },
};

const resolveJurisdiction = (
  businessType: keyof typeof BUSINESS_TYPE_CONFIG,
  prefecture: string,
  city: string
) => {
  // 神奈川県の訪問看護/訪問介護は指定4市以外は県
  if (
    (businessType === "visiting_nursing" || businessType === "visiting_care") &&
    prefecture === "神奈川県"
  ) {
    if (KANAGAWA_SPECIAL_CITIES.some((c) => c === city || city.includes(c))) {
      return {
        jurisdiction: city,
        isCity: true,
        reason: `${city}は政令指定都市（横浜/川崎/相模原）または中核市（横須賀）に該当するため市が申請先です。`,
      };
    }
    return {
      jurisdiction: prefecture,
      isCity: false,
      reason: `${city}は政令指定都市・中核市ではないため神奈川県が申請先です。`,
    };
  }

  // それ以外は一般ルール（政令市・中核市は市、それ以外は県）
  const general = determineJurisdiction(prefecture, city);
  return { jurisdiction: general.jurisdiction, isCity: general.isCity, reason: general.reason };
};

/**
 * Step 1: 申請先を調査・確認する
 */
async function verifyJurisdiction(
  apiKey: string,
  prefecture: string,
  city: string,
  businessType: keyof typeof BUSINESS_TYPE_CONFIG
): Promise<JurisdictionCheckResponse> {
  const config = BUSINESS_TYPE_CONFIG[businessType];

  // まず事前判定を行う（参考値として）: 事業種別に応じた判定
  const preJudgment = resolveJurisdiction(businessType, prefecture, city);

  const verifyPrompt = `あなたは日本の行政手続きに詳しい専門家です。${prefecture}${city}で${config.name}を新規開設する場合の「申請先・届出先」を、${prefecture}の公式サイトの情報を基に調査してください。

【調査のポイント】
1. ${prefecture}の公式サイトで「${config.jurisdictionSearchTerms}」に関するページを検索
2. 政令指定都市・中核市とそれ以外の市町村で申請先が異なるかを確認
3. ${city}がどちらに該当するかを特定

【一般的なルール（参考）】
- 介護保険サービス事業者の指定申請：政令指定都市・中核市は市が指定権者、それ以外は都道府県
- 有料老人ホームの届出：都道府県または政令指定都市・中核市

【事前判定結果（参考）】
${preJudgment.reason}

この事前判定が正しいか、${prefecture}の公式サイトで確認し、以下のJSON形式で回答してください。マークダウン形式は含めず、純粋なJSON文字列のみを返してください。

{
  "jurisdiction": "確認した申請先（例：神奈川県、相模原市）",
  "is_city": true または false（市が申請先ならtrue、県が申請先ならfalse）,
  "reason": "この申請先と判断した根拠（公式サイトの記載内容を引用）",
  "source_url": "確認した公式サイトのURL"
}`;

  const verifyQuery = `${prefecture} ${city} ${config.jurisdictionSearchTerms} 公式サイト`;

  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: [
        { role: "system", content: verifyPrompt },
        { role: "user", content: verifyQuery },
      ],
    }),
  });

  if (!response.ok) {
    // API失敗時は事前判定を使用
    return {
      jurisdiction: preJudgment.jurisdiction,
      is_city: preJudgment.isCity,
      reason: preJudgment.reason + "（※公式サイト確認が行えなかったため、一般ルールに基づく判定）",
    };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return {
      jurisdiction: preJudgment.jurisdiction,
      is_city: preJudgment.isCity,
      reason: preJudgment.reason + "（※公式サイト確認が行えなかったため、一般ルールに基づく判定）",
    };
  }

  // JSONの抽出
  let jsonString = content.trim();
  if (jsonString.startsWith("```json")) {
    jsonString = jsonString.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  } else if (jsonString.startsWith("```")) {
    jsonString = jsonString.replace(/^```\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const result: JurisdictionCheckResponse = JSON.parse(jsonString);
    // 必須フィールドの検証
    if (!result.jurisdiction || typeof result.is_city !== "boolean" || !result.reason) {
      throw new Error("Invalid response format");
    }
    return result;
  } catch {
    // パース失敗時は事前判定を使用
    return {
      jurisdiction: preJudgment.jurisdiction,
      is_city: preJudgment.isCity,
      reason: preJudgment.reason + "（※公式サイト確認が行えなかったため、一般ルールに基づく判定）",
    };
  }
}

/**
 * Step 2: 確定した申請先の詳細情報を取得する
 */
async function fetchApplicationDetails(
  apiKey: string,
  jurisdiction: JurisdictionCheckResponse,
  prefecture: string,
  city: string,
  businessType: keyof typeof BUSINESS_TYPE_CONFIG
): Promise<SearchResponse> {
  const config = BUSINESS_TYPE_CONFIG[businessType];

  const detailPrompt = `あなたは日本の行政手続きに詳しい専門家です。

【確定した申請先】
${prefecture}${city}で${config.name}を新規開設する場合、申請先は「${jurisdiction.jurisdiction}」です。
理由：${jurisdiction.reason}

${jurisdiction.jurisdiction}の公式サイトから、${config.name}の申請に必要な情報を検索し、以下のJSON形式で回答してください。マークダウン形式は含めず、純粋なJSON文字列のみを返してください。

${businessType === "residential_home" ? "【注意】建築確認申請、指導事項への対応・改善報告、完成検査などテナントが関与しない工程は含めないでください。" : ""}

{
  "jurisdiction": "${jurisdiction.jurisdiction}",
  "jurisdiction_detail": "${jurisdiction.reason}",
  "flow": [
    {
      "step": "申請手順のステップ（例：事前相談、申請書類の準備、申請書の提出など）",
      "documents": ["必要書類1", "必要書類2"]
    }
  ],
  "summary": "${config.name}の手続き概要と注意点（200文字程度）",
  "reference_url": "参考URL",
  "reference_name": "参考情報の情報源名（例：厚生労働省、WAM NET）",
  "guideline_url": "${jurisdiction.jurisdiction}が公表している設置指針・ガイドライン・手引きのURL",
  "guideline_name": "ガイドラインの情報源名（例：${jurisdiction.jurisdiction}公式サイト）"
}`;

  const detailQuery = `${jurisdiction.jurisdiction} ${config.searchTerms} 申請 必要書類 公式サイト`;

  const response = await fetch(PERPLEXITY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: PERPLEXITY_MODEL,
      messages: [
        { role: "system", content: detailPrompt },
        { role: "user", content: detailQuery },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error("詳細情報の取得に失敗しました");
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("詳細情報が取得できませんでした");
  }

  // JSONの抽出
  let jsonString = content.trim();
  if (jsonString.startsWith("```json")) {
    jsonString = jsonString.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  } else if (jsonString.startsWith("```")) {
    jsonString = jsonString.replace(/^```\n?/, "").replace(/\n?```$/, "");
  }

  const result: SearchResponse = JSON.parse(jsonString);

  // 申請先を確定値で上書き
  result.jurisdiction = jurisdiction.jurisdiction;
  result.jurisdiction_detail = jurisdiction.reason;

  return result;
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchRequest = await request.json();
    const prefecture = body.prefecture?.trim();
    const city = body.city?.trim();
    const businessType = body.businessType || "residential_home";

    if (!prefecture) {
      return NextResponse.json(
        { error: "都道府県名が指定されていません" },
        { status: 400 }
      );
    }

    if (!city) {
      return NextResponse.json(
        { error: "市区町村名が指定されていません" },
        { status: 400 }
      );
    }

    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "PERPLEXITY_API_KEYが設定されていません" },
        { status: 500 }
      );
    }

    const config = BUSINESS_TYPE_CONFIG[businessType];

    // Step 1: 申請先を調査・確認
    console.log(`Step 1: ${prefecture}${city}の${config.name}申請先を調査中...`);
    const jurisdictionInfo = await verifyJurisdiction(
      apiKey,
      prefecture,
      city,
      businessType
    );
    console.log(`申請先確定: ${jurisdictionInfo.jurisdiction}`);

    // Step 2: 詳細情報を取得
    console.log(`Step 2: ${jurisdictionInfo.jurisdiction}の申請手順を取得中...`);
    let searchResult = await fetchApplicationDetails(
      apiKey,
      jurisdictionInfo,
      prefecture,
      city,
      businessType
    );

    // バリデーション
    if (!Array.isArray(searchResult.flow) || !searchResult.summary) {
      return NextResponse.json(
        { error: "検索結果の形式が正しくありません" },
        { status: 500 }
      );
    }

    // 後方互換性: 古い形式（flowが文字列配列の場合）を新しい形式に変換
    if (searchResult.flow.length > 0 && typeof searchResult.flow[0] === "string") {
      const oldFlow = searchResult.flow as unknown as string[];
      const oldDocuments = (searchResult as any).documents || [];
      searchResult.flow = oldFlow.map((step, index) => ({
        step,
        documents: index === 0 ? oldDocuments : [],
      }));
    }

    // 各ステップのバリデーションと不要工程の除去
    const blockKeywords = config.blockKeywords;
    searchResult.flow = searchResult.flow
      .filter(
        (flowItem) =>
          flowItem.step &&
          Array.isArray(flowItem.documents) &&
          !blockKeywords.some((keyword) => flowItem.step.includes(keyword))
      )
      .map((item) => ({
        ...item,
        documents: Array.isArray(item.documents) ? item.documents : [],
      }));

    // ガイドラインURLの後方互換性
    if (!searchResult.guideline_url && searchResult.reference_url) {
      searchResult.guideline_url = searchResult.reference_url;
      searchResult.guideline_name = searchResult.reference_name || `${jurisdictionInfo.jurisdiction}公式情報`;
    }

    // 情報源名のデフォルト値
    if (!searchResult.guideline_name && searchResult.guideline_url) {
      searchResult.guideline_name = `${jurisdictionInfo.jurisdiction}公式ガイドライン`;
    }
    if (!searchResult.reference_name && searchResult.reference_url) {
      searchResult.reference_name = "参考情報";
    }

    return NextResponse.json(searchResult);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "サーバーエラーが発生しました" },
      { status: 500 }
    );
  }
}
