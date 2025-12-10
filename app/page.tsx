"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  ExternalLink,
  Building2,
  FileText,
  ListChecks,
  MapPin,
  BookOpen,
  ScrollText,
  ShieldCheck,
  CheckCircle2,
  Home as HomeIcon,
  Stethoscope,
  HeartHandshake,
  History,
  Trash2,
  Clock,
} from "lucide-react";

type BusinessType = "residential_home" | "visiting_nursing" | "visiting_care";

const BUSINESS_TYPE_INFO = {
  residential_home: {
    name: "住宅型有料老人ホーム",
    icon: HomeIcon,
    description: "住宅型有料老人ホームの届出・設置申請",
  },
  visiting_nursing: {
    name: "訪問看護事業所",
    icon: Stethoscope,
    description: "訪問看護事業所の指定申請・開設",
  },
  visiting_care: {
    name: "訪問介護事業所",
    icon: HeartHandshake,
    description: "訪問介護事業所の指定申請・開設",
  },
};

interface FlowStep {
  step: string;
  documents: string[];
}

interface SearchResult {
  jurisdiction: string;
  jurisdiction_detail?: string;
  flow: FlowStep[];
  summary: string;
  reference_url: string;
  reference_name?: string;
  guideline_url?: string;
  guideline_name?: string;
}

interface SearchHistory {
  id: string;
  timestamp: string;
  businessType: BusinessType;
  prefecture: string;
  city: string;
  result: SearchResult;
  checkedSteps: number[];
}

// ユーザーID（社内共有のため、ブラウザのlocalStorageで管理）
const getUserId = () => {
  if (typeof window === "undefined") return "anonymous";
  let userId = localStorage.getItem("app-guide-user-id");
  if (!userId) {
    userId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem("app-guide-user-id", userId);
  }
  return userId;
};

export default function Home() {
  const [businessType, setBusinessType] = useState<BusinessType>("residential_home");
  const [prefecture, setPrefecture] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkedSteps, setCheckedSteps] = useState<Set<number>>(new Set());
  const [history, setHistory] = useState<SearchHistory[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // 履歴をSupabaseから読み込み
  const loadHistoryFromApi = async () => {
    try {
      const response = await fetch("/api/history");
      if (response.ok) {
        const data = await response.json();
        const convertedHistory: SearchHistory[] = (data.history || []).map((item: any) => ({
          id: item.id,
          timestamp: item.timestamp,
          businessType: item.business_type as BusinessType,
          prefecture: item.prefecture,
          city: item.city,
          result: {
            jurisdiction: item.jurisdiction,
            jurisdiction_detail: item.jurisdiction_detail,
            flow: item.flow,
            summary: item.summary,
            reference_url: item.reference_url,
            reference_name: item.reference_name,
            guideline_url: item.guideline_url,
            guideline_name: item.guideline_name,
          },
          checkedSteps: item.checked_steps || [],
        }));
        setHistory(convertedHistory);
      } else {
        console.error("履歴の取得に失敗しました:", await response.text());
      }
    } catch (err) {
      console.error("履歴の読み込みに失敗しました:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistoryFromApi();
  }, []);

  // 履歴をSupabaseに保存
  const saveHistoryToSupabase = async (historyItem: SearchHistory) => {
    try {
      const response = await fetch("/api/history", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: historyItem.id,
          userId: getUserId(),
          businessType: historyItem.businessType,
          prefecture: historyItem.prefecture,
          city: historyItem.city,
          jurisdiction: historyItem.result.jurisdiction,
          jurisdictionDetail: historyItem.result.jurisdiction_detail,
          summary: historyItem.result.summary,
          referenceUrl: historyItem.result.reference_url,
          referenceName: historyItem.result.reference_name,
          guidelineUrl: historyItem.result.guideline_url,
          guidelineName: historyItem.result.guideline_name,
          flow: historyItem.result.flow,
          checkedSteps: historyItem.checkedSteps,
        }),
      });

      if (!response.ok) {
        throw new Error("履歴の保存に失敗しました");
      }
      // 保存後に最新を再取得して共有状態を同期
      await loadHistoryFromApi();
    } catch (err) {
      console.error("履歴の保存に失敗しました:", err);
    }
  };

  const handleSearch = async () => {
    if (!prefecture.trim()) {
      setError("都道府県名を入力してください");
      return;
    }
    if (!city.trim()) {
      setError("市区町村名を入力してください");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setCheckedSteps(new Set());
    setCurrentHistoryId(null);

    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prefecture: prefecture.trim(),
          city: city.trim(),
          businessType,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "検索に失敗しました");
      }

      const data: SearchResult = await response.json();
      setResult(data);

      // 履歴に自動保存（Supabase）
      const newHistoryItem: SearchHistory = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        businessType,
        prefecture: prefecture.trim(),
        city: city.trim(),
        result: data,
        checkedSteps: [],
      };
      await saveHistoryToSupabase(newHistoryItem);
      setHistory((prev) => [newHistoryItem, ...prev].slice(0, 100));
      setCurrentHistoryId(newHistoryItem.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "検索に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !loading) {
      handleSearch();
    }
  };

  const handleStepCheck = async (index: number, checked: boolean) => {
    setCheckedSteps((prev) => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(index);
      } else {
        newSet.delete(index);
      }
      
      // 現在の履歴のチェック状態をSupabaseに更新
      if (currentHistoryId) {
        const checkedStepsArray = Array.from(newSet);
        
        // Supabaseに更新
        fetch("/api/history", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: currentHistoryId,
            checkedSteps: checkedStepsArray,
          }),
        }).catch((err) => console.error("チェック状態の更新に失敗しました:", err));

        // ローカル状態も更新
        setHistory((prev) =>
          prev.map((item) => {
            if (item.id === currentHistoryId) {
              return { ...item, checkedSteps: checkedStepsArray };
            }
            return item;
          })
        );
      }
      
      return newSet;
    });
  };

  const handleBusinessTypeChange = (value: string) => {
    setBusinessType(value as BusinessType);
    setResult(null);
    setError(null);
    setCheckedSteps(new Set());
    setCurrentHistoryId(null);
  };

  const handleLoadHistory = (item: SearchHistory) => {
    setBusinessType(item.businessType);
    setPrefecture(item.prefecture);
    setCity(item.city);
    setResult(item.result);
    setError(null);
    // チェック状態を復元（後方互換性のためcheckedStepsがない場合は空配列）
    setCheckedSteps(new Set(item.checkedSteps || []));
    setCurrentHistoryId(item.id);
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/history?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setHistory((prev) => prev.filter((item) => item.id !== id));
        if (currentHistoryId === id) {
          setResult(null);
          setCurrentHistoryId(null);
        }
      }
    } catch (err) {
      console.error("履歴の削除に失敗しました:", err);
    }
  };

  const handleClearAllHistory = async () => {
    if (confirm("すべての検索履歴を削除しますか？")) {
      try {
        // すべての履歴を削除（各IDに対してDELETEリクエスト）
        const deletePromises = history.map((item) =>
          fetch(`/api/history?id=${item.id}`, { method: "DELETE" })
        );
        await Promise.all(deletePromises);
        setHistory([]);
        setResult(null);
        setCurrentHistoryId(null);
      } catch (err) {
        console.error("履歴の削除に失敗しました:", err);
      }
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const currentBusinessInfo = BUSINESS_TYPE_INFO[businessType];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 relative overflow-hidden">
      {/* 背景アクセント */}
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute right-10 top-10 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
      </div>

      <div className="relative container mx-auto px-4 py-12 max-w-6xl">
        {/* ヘッダー */}
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex items-center space-x-2 rounded-full bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-blue-100 ring-1 ring-white/10">
            <ShieldCheck className="h-4 w-4" />
            <span>Application Guide</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold text-white drop-shadow-sm">
            申請ガイド
          </h1>
          <p className="text-slate-200 text-lg">
            都道府県と市区町村を指定して、新規開設に必要な申請情報をAIが整理します
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* 左サイドバー: 検索履歴 */}
          <div className="lg:col-span-1">
            <Card className="bg-white/5 border-white/10 backdrop-blur-lg sticky top-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center justify-between">
                  <span className="flex items-center space-x-2">
                    <History className="h-5 w-5 text-blue-200" />
                    <span>検索履歴</span>
                  </span>
                  {history.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClearAllHistory}
                      className="text-slate-400 hover:text-red-300 h-8 px-2"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-[60vh] overflow-y-auto">
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-200" />
                  </div>
                ) : history.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">
                    検索履歴はありません
                  </p>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => {
                      const info = BUSINESS_TYPE_INFO[item.businessType];
                      const Icon = info.icon;
                      const isActive = currentHistoryId === item.id;
                      const totalSteps = item.result.flow.length;
                      const checkedCount = item.checkedSteps?.length || 0;
                      const isComplete = totalSteps > 0 && checkedCount === totalSteps;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleLoadHistory(item)}
                          className={`group p-3 rounded-lg cursor-pointer transition-all ${
                            isActive
                              ? "bg-blue-500/20 ring-1 ring-blue-400/50"
                              : "bg-white/5 hover:bg-white/10"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center space-x-2 mb-1">
                                <Icon className="h-3 w-3 text-blue-200 flex-shrink-0" />
                                <span className="text-xs text-blue-200 truncate">
                                  {info.name}
                                </span>
                              </div>
                              <p className="text-sm text-white font-medium truncate">
                                {item.prefecture} {item.city}
                              </p>
                              <p className="text-xs text-slate-400 truncate">
                                → {item.result.jurisdiction}
                              </p>
                              <div className="flex items-center justify-between mt-2">
                                <div className="flex items-center space-x-1 text-xs text-slate-500">
                                  <Clock className="h-3 w-3" />
                                  <span>{formatDate(item.timestamp)}</span>
                                </div>
                                {totalSteps > 0 && (
                                  <div className={`text-xs px-2 py-0.5 rounded-full ${
                                    isComplete 
                                      ? "bg-green-500/20 text-green-300" 
                                      : checkedCount > 0 
                                        ? "bg-yellow-500/20 text-yellow-300"
                                        : "bg-white/10 text-slate-400"
                                  }`}>
                                    {checkedCount}/{totalSteps}
                                  </div>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleDeleteHistory(item.id, e)}
                              className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-300 h-6 w-6 p-0"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* メインコンテンツ */}
          <div className="lg:col-span-3 space-y-6">
            {/* 事業種別タブ */}
            <Tabs value={businessType} onValueChange={handleBusinessTypeChange} className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-white/5 border border-white/10 p-1 h-auto">
                {(Object.entries(BUSINESS_TYPE_INFO) as [BusinessType, typeof BUSINESS_TYPE_INFO.residential_home][]).map(
                  ([key, info]) => {
                    const Icon = info.icon;
                    return (
                      <TabsTrigger
                        key={key}
                        value={key}
                        className="flex flex-col md:flex-row items-center gap-2 py-3 px-2 md:px-4 text-slate-300 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-cyan-400 data-[state=active]:text-slate-900 data-[state=active]:shadow-lg transition-all"
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-xs md:text-sm font-medium text-center leading-tight">
                          {info.name}
                        </span>
                      </TabsTrigger>
                    );
                  }
                )}
              </TabsList>
            </Tabs>

            {/* 検索フォーム */}
            <Card className="shadow-2xl bg-white/10 border-white/10 backdrop-blur-lg">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-xl text-white flex items-center space-x-2">
                      <MapPin className="h-5 w-5 text-blue-200" />
                      <span>エリアを指定</span>
                    </CardTitle>
                    <CardDescription className="text-slate-200">
                      {currentBusinessInfo.description}の申請先と手続き情報を取得します
                    </CardDescription>
                  </div>
                  <div className="hidden md:flex items-center space-x-2 rounded-full bg-white/5 px-3 py-1 text-xs text-blue-100 ring-1 ring-white/10">
                    <currentBusinessInfo.icon className="h-4 w-4" />
                    <span>{currentBusinessInfo.name}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prefecture" className="text-slate-100">
                      都道府県
                    </Label>
                    <Input
                      id="prefecture"
                      placeholder="例: 埼玉県、神奈川県"
                      value={prefecture}
                      onChange={(e) => setPrefecture(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={loading}
                      className="text-base bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-blue-300"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-slate-100">
                      市区町村
                    </Label>
                    <Input
                      id="city"
                      placeholder="例: 川口市、大和市"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      onKeyPress={handleKeyPress}
                      disabled={loading}
                      className="text-base bg-white/10 border-white/20 text-white placeholder:text-slate-400 focus-visible:ring-blue-300"
                    />
                  </div>
                </div>
                <div className="mt-4 text-sm text-slate-300 flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-blue-200" />
                  <span>
                    検索結果は自動で履歴に保存されます
                  </span>
                </div>
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={loading}
                  className="mt-6 w-full bg-gradient-to-r from-blue-500 via-blue-400 to-cyan-300 text-slate-900 font-semibold hover:shadow-xl transition-shadow"
                  size="lg"
                >
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      AIが最新情報を検索中...
                    </>
                  ) : (
                    "検索する"
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* エラー表示 */}
            {error && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-100">
                {error}
              </div>
            )}

            {/* 結果表示 */}
            {result && (
              <div className="space-y-6">
                {/* 管轄表示 */}
                <Card className="border border-white/10 bg-white/5 shadow-xl backdrop-blur">
                  <CardContent className="pt-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-center space-x-4">
                        <div className="h-14 w-14 rounded-full bg-gradient-to-br from-blue-400 to-cyan-300 flex items-center justify-center text-slate-900 shadow-lg">
                          <Building2 className="h-7 w-7" />
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-blue-200 mb-1">申請先</p>
                          <p className="text-2xl md:text-3xl font-bold text-white">
                            {result.jurisdiction}
                          </p>
                          {result.jurisdiction_detail && (
                            <p className="text-sm text-slate-300 mt-1 max-w-md">
                              {result.jurisdiction_detail}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right text-slate-200 bg-white/5 rounded-lg px-4 py-3 ring-1 ring-white/10">
                        <p className="text-xs uppercase tracking-wider text-blue-200 mb-1">
                          検索対象
                        </p>
                        <p className="text-lg font-medium text-white">
                          {prefecture} {city}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {currentBusinessInfo.name}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 概要 */}
                <Card className="shadow-xl border border-white/10 bg-white/5 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-white">
                      <FileText className="h-5 w-5 text-blue-200" />
                      <span>手続きの概要</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-100 leading-relaxed text-lg">
                      {result.summary}
                    </p>
                  </CardContent>
                </Card>

                {/* 申請フロー */}
                <Card className="shadow-xl border border-white/10 bg-white/5 backdrop-blur">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2 text-white">
                      <ListChecks className="h-5 w-5 text-blue-200" />
                      <span>申請手順</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {result.flow.map((flowItem, index) => {
                        const isChecked = checkedSteps.has(index);
                        return (
                          <AccordionItem
                            key={index}
                            value={`item-${index}`}
                            className="border-b border-white/10"
                          >
                            <div className="flex items-start space-x-3 py-3">
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="mt-1"
                              >
                                <Checkbox
                                  id={`step-${index}`}
                                  checked={isChecked}
                                  onCheckedChange={(checked) =>
                                    handleStepCheck(index, checked === true)
                                  }
                                  className="border-white/30 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                                />
                              </div>
                              <div className="flex-1">
                                <AccordionTrigger className="hover:no-underline">
                                  <div className="flex items-center justify-between gap-3 w-full pr-2">
                                    <div className="flex items-center space-x-3 flex-1">
                                      <span className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-400 to-cyan-300 text-slate-900 rounded-full flex items-center justify-center font-bold text-sm">
                                        {index + 1}
                                      </span>
                                      <span
                                        className={`text-slate-100 text-left ${
                                          isChecked ? "line-through text-slate-400" : ""
                                        }`}
                                      >
                                        {flowItem.step}
                                      </span>
                                    </div>
                                    <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-blue-100 ring-1 ring-white/10 flex-shrink-0">
                                      書類 {flowItem.documents.length}件
                                    </span>
                                  </div>
                                </AccordionTrigger>
                                <AccordionContent className="pt-2 pb-4">
                                  <div className="ml-11 space-y-3">
                                    <p className="text-sm font-semibold text-blue-200 mb-1">
                                      必要な書類
                                    </p>
                                    <ul className="space-y-2">
                                      {flowItem.documents.length > 0 ? (
                                        flowItem.documents.map((doc, docIndex) => (
                                          <li
                                            key={docIndex}
                                            className="flex items-start space-x-2 p-3 rounded-lg border border-white/10 bg-white/5"
                                          >
                                            <span className="text-blue-300 mt-0.5">•</span>
                                            <span className="text-slate-100">{doc}</span>
                                          </li>
                                        ))
                                      ) : (
                                        <li className="text-slate-400 text-sm">
                                          このステップに必要な書類情報はありません
                                        </li>
                                      )}
                                    </ul>
                                  </div>
                                </AccordionContent>
                              </div>
                            </div>
                          </AccordionItem>
                        );
                      })}
                    </Accordion>
                  </CardContent>
                </Card>

                {/* ガイドライン＆参考URL */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.guideline_url && (
                    <Card className="shadow-xl border border-white/10 bg-white/5 backdrop-blur">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center space-x-2 text-white text-lg">
                          <BookOpen className="h-5 w-5 text-blue-200" />
                          <span>設置指針・ガイドライン</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <a
                          href={result.guideline_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <span className="text-blue-100 group-hover:text-white font-medium">
                            {result.guideline_name || "公式ガイドライン"}
                          </span>
                          <ExternalLink className="h-4 w-4 text-blue-200 group-hover:text-white" />
                        </a>
                      </CardContent>
                    </Card>
                  )}

                  {result.reference_url && (
                    <Card className="shadow-xl border border-white/10 bg-white/5 backdrop-blur">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center space-x-2 text-white text-lg">
                          <ScrollText className="h-5 w-5 text-blue-200" />
                          <span>参考情報</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <a
                          href={result.reference_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
                        >
                          <span className="text-blue-100 group-hover:text-white font-medium">
                            {result.reference_name || "参考情報"}
                          </span>
                          <ExternalLink className="h-4 w-4 text-blue-200 group-hover:text-white" />
                        </a>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
