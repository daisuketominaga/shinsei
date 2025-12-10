/**
 * 全国の指定都市（政令指定都市）リスト
 * 介護保険・医療保険の指定事業者の指定権者となる
 */
export const DESIGNATED_CITIES = [
  // 北海道・東北
  "札幌市",
  "仙台市",
  // 関東
  "さいたま市",
  "千葉市",
  "横浜市",
  "川崎市",
  "相模原市",
  // 中部
  "新潟市",
  "静岡市",
  "浜松市",
  "名古屋市",
  // 近畿
  "京都市",
  "大阪市",
  "堺市",
  "神戸市",
  // 中国・四国
  "岡山市",
  "広島市",
  // 九州
  "北九州市",
  "福岡市",
  "熊本市",
] as const;

/**
 * 全国の中核市リスト（主要なもの）
 * 介護保険の指定事業者の指定権者となる
 */
export const CORE_CITIES = [
  // 北海道・東北
  "旭川市",
  "函館市",
  "青森市",
  "八戸市",
  "盛岡市",
  "秋田市",
  "山形市",
  "福島市",
  "郡山市",
  "いわき市",
  // 関東
  "水戸市",
  "宇都宮市",
  "前橋市",
  "高崎市",
  "川越市",
  "越谷市",
  "川口市",
  "船橋市",
  "柏市",
  "八王子市",
  "横須賀市",
  // 中部
  "富山市",
  "金沢市",
  "福井市",
  "甲府市",
  "長野市",
  "松本市",
  "岐阜市",
  "豊橋市",
  "岡崎市",
  "豊田市",
  "一宮市",
  "春日井市",
  // 近畿
  "津市",
  "四日市市",
  "大津市",
  "豊中市",
  "吹田市",
  "高槻市",
  "枚方市",
  "八尾市",
  "寝屋川市",
  "東大阪市",
  "姫路市",
  "尼崎市",
  "明石市",
  "西宮市",
  "奈良市",
  "和歌山市",
  // 中国・四国
  "鳥取市",
  "松江市",
  "倉敷市",
  "呉市",
  "福山市",
  "下関市",
  "高松市",
  "松山市",
  "高知市",
  // 九州・沖縄
  "久留米市",
  "長崎市",
  "佐世保市",
  "大分市",
  "宮崎市",
  "鹿児島市",
  "那覇市",
] as const;

export type DesignatedCity = (typeof DESIGNATED_CITIES)[number];
export type CoreCity = (typeof CORE_CITIES)[number];

/**
 * 指定された市が指定都市かどうかを判定
 */
export function isDesignatedCity(city: string): boolean {
  return DESIGNATED_CITIES.some(
    (c) => c === city || city.includes(c) || c.includes(city.replace("市", ""))
  );
}

/**
 * 指定された市が中核市かどうかを判定
 */
export function isCoreCity(city: string): boolean {
  return CORE_CITIES.some(
    (c) => c === city || city.includes(c) || c.includes(city.replace("市", ""))
  );
}

/**
 * 指定された市が独自の指定権限を持つかどうかを判定
 * （指定都市または中核市の場合、市が指定権者となる）
 */
export function hasOwnJurisdiction(city: string): boolean {
  return isDesignatedCity(city) || isCoreCity(city);
}

/**
 * 指定権者を判定して返す
 * @param prefecture 都道府県名
 * @param city 市区町村名
 * @returns 指定権者（都道府県名または市名）
 */
export function determineJurisdiction(
  prefecture: string,
  city: string
): { jurisdiction: string; isCity: boolean; reason: string } {
  if (isDesignatedCity(city)) {
    return {
      jurisdiction: city,
      isCity: true,
      reason: `${city}は政令指定都市のため、市が指定権者となります`,
    };
  }
  if (isCoreCity(city)) {
    return {
      jurisdiction: city,
      isCity: true,
      reason: `${city}は中核市のため、市が指定権者となります`,
    };
  }
  return {
    jurisdiction: prefecture,
    isCity: false,
    reason: `${city}は政令指定都市・中核市ではないため、${prefecture}が指定権者となります`,
  };
}
