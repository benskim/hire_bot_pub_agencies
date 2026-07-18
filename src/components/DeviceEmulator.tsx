import React, { useState, useEffect } from "react";
import {
  trackEvent,
  trackButtonClick,
  trackFormSubmission,
  trackInputInteraction,
  trackNavigation,
} from "../lib/firebaseAnalytics";
import { 
  Play, 
  RotateCw, 
  Wifi, 
  Battery, 
  Radio, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink,
  ChevronRight,
  Terminal,
  Globe,
  Database,
  Building,
  Trash2,
  Plus,
  AlertCircle
} from "lucide-react";

interface Posting {
  id: string;
  agencyCode: string;
  agencyName: string;
  title: string;
  url: string;
  createdAt: string;
  isReal?: boolean;
}

interface CustomAgency {
  code: string;
  agency: string;
  url: string;
}

interface DeviceEmulatorProps {
  onStartScrape: (networkType: string) => void;
  isLoading: boolean;
  listings: Posting[];
  logs: Array<{ agencyCode: string; message: string; timestamp: string; isError?: boolean }>;
  scrapeSummary: Record<string, { status: string; source: string; count: number }> | null;
  customAgencies: CustomAgency[];
  defaultAgencies: Array<{ code: string; agency: string; url: string }>;
  onAddAgency: (name: string, url: string) => string | null;
  onRemoveAgency: (code: string, isDefault: boolean) => void;
  onRestoreDefaultAgencies: () => void;
  hasDeletedDefaults: boolean;
}

export default function DeviceEmulator({
  onStartScrape,
  isLoading,
  listings,
  logs,
  scrapeSummary,
  customAgencies,
  defaultAgencies,
  onAddAgency,
  onRemoveAgency,
  onRestoreDefaultAgencies,
  hasDeletedDefaults
}: DeviceEmulatorProps) {
  const [networkType, setNetworkType] = useState<string>("KT_5G");
  const [currentTime, setCurrentTime] = useState<string>("19:49");
  const [activeTab, setActiveTab] = useState<"results" | "targets">("results");
  const [filterInstructor, setFilterInstructor] = useState<boolean>(false);
  const [filterTodayOnly, setFilterTodayOnly] = useState<boolean>(false);
  const [agencyToDelete, setAgencyToDelete] = useState<{ code: string; name: string; isDefault: boolean } | null>(null);

  const todayKst = (() => {
    const localTime = new Date();
    const utcTime = localTime.getTime() + (localTime.getTimezoneOffset() * 60000);
    const kstTime = utcTime + (9 * 60 * 60 * 1000);
    const kstDate = new Date(kstTime);
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, "0");
    const day = String(kstDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  })();

  const displayedListings = listings.filter(p => {
    if (filterInstructor && !p.title.includes("강사")) return false;
    if (filterTodayOnly && p.createdAt !== todayKst) return false;
    return true;
  });

  // Phone Add form states
  const [phoneName, setPhoneName] = useState("");
  const [phoneUrl, setPhoneUrl] = useState("");
  const [phoneError, setPhoneError] = useState("");

  // Keep simulated clock updated
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  const handlePhoneAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");

    trackFormSubmission("add_agency_form", {
      agency_name_length: phoneName.trim().length,
      url_length: phoneUrl.trim().length,
    });

    const errorMsg = onAddAgency(phoneName, phoneUrl);
    if (errorMsg) {
      setPhoneError(errorMsg);
      trackEvent("agency_add_failed", { error_message: errorMsg });
    } else {
      setPhoneName("");
      setPhoneUrl("");
      trackEvent("agency_add_success", {
        agency_name: phoneName.trim(),
      });
    }
  };

  const handleTabChange = (nextTab: "results" | "targets") => {
    setActiveTab(nextTab);
    trackNavigation(nextTab === "results" ? "results_tab" : "targets_tab");
  };

  const getAgencyColor = (code: string) => {
    switch (code) {
      case "GY_OFFICE":
        return {
          bg: "bg-blue-100 dark:bg-blue-900/30",
          text: "text-blue-700 dark:text-blue-400",
          border: "border-blue-200 dark:border-blue-800",
          badge: "bg-blue-600"
        };
      case "GY_WOMAN":
        return {
          bg: "bg-purple-100 dark:bg-purple-900/30",
          text: "text-purple-700 dark:text-purple-400",
          border: "border-purple-200 dark:border-purple-800",
          badge: "bg-purple-600"
        };
      case "BUKBU_ICE":
        return {
          bg: "bg-emerald-100 dark:bg-emerald-900/30",
          text: "text-emerald-700 dark:text-emerald-400",
          border: "border-emerald-200 dark:border-emerald-800",
          badge: "bg-emerald-600"
        };
      case "ICE":
        return {
          bg: "bg-teal-100 dark:bg-teal-900/30",
          text: "text-teal-700 dark:text-teal-400",
          border: "border-teal-200 dark:border-teal-800",
          badge: "bg-teal-600"
        };
      default:
        return {
          bg: "bg-slate-100 dark:bg-slate-800",
          text: "text-slate-700 dark:text-slate-400",
          border: "border-slate-200 dark:border-slate-700",
          badge: "bg-slate-600"
        };
    }
  };

  return (
    <div className="w-full bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden min-h-[600px] relative">
      {/* Material 3 App Bar */}
      <div className="h-16 bg-blue-700 text-white flex items-center justify-between px-5 shadow-md z-10">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-amber-300 animate-pulse" />
          <h1 className="font-bold text-sm tracking-tight">공공기관 일자리 수집 엔진</h1>
        </div>
        <div className="flex gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
        </div>
      </div>

      {/* Screen Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3 bg-slate-50 dark:bg-slate-900">
        
        {activeTab === "results" ? (
          // TAB 1: 수집 현황 (RESULTS)
          <>
            {/* Action Trigger Button */}
            <button
              onClick={() => {
                trackButtonClick("start_scrape", "수집 엔진 가동");
                trackEvent("scrape_started", { network_type: networkType });
                onStartScrape(networkType);
              }}
              disabled={isLoading}
              className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                isLoading 
                  ? "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed" 
                  : "bg-blue-600 hover:bg-blue-700 text-white active:scale-[0.98]"
              }`}
            >
              {isLoading ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>수집중...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>수집 엔진 가동 (Start)</span>
                </>
              )}
            </button>

            {/* Scrape Listings Result Grid / List */}
            <div className="flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  수집된 채용 목록 ({displayedListings.length})
                </span>
                {listings.length > 0 && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => setFilterTodayOnly(!filterTodayOnly)}
                      className={`px-1.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                        filterTodayOnly
                          ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800"
                          : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${filterTodayOnly ? 'bg-amber-600 dark:bg-amber-400' : 'bg-slate-400'}`}></span>
                      오늘 등록
                    </button>
                    <button
                      onClick={() => setFilterInstructor(!filterInstructor)}
                      className={`px-1.5 py-1 text-[10px] font-bold rounded-lg border transition-all cursor-pointer flex items-center gap-1 ${
                        filterInstructor
                          ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-800"
                          : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${filterInstructor ? 'bg-blue-600 dark:bg-blue-400' : 'bg-slate-400'}`}></span>
                      '강사' 공고
                    </button>
                  </div>
                )}
              </div>

              {isLoading ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm px-4">
                  <div className="relative mb-3">
                    <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                    <Radio className="w-4 h-4 text-rose-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <span className="text-[12px] font-bold text-slate-800 dark:text-white text-center">
                    Scraping via local residential IP network...
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1">
                    Connecting direct to government web hosts to bypass cloud blacklists...
                  </span>
                </div>
              ) : listings.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 px-4">
                  <Database className="w-8 h-8 mb-2 text-slate-300 dark:text-slate-600" />
                  <span className="text-sm font-black text-slate-700 dark:text-slate-300 text-center tracking-tight">
                    공고없음
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1 leading-normal">
                    수집 버튼을 눌러 최근 3일치 등록된 공고를 수집하세요.
                  </span>
                </div>
              ) : displayedListings.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center py-12 bg-white dark:bg-slate-800/50 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400 px-4">
                  <AlertCircle className="w-8 h-8 mb-2 text-amber-500" />
                  <span className="text-sm font-black text-slate-700 dark:text-slate-300 text-center tracking-tight">
                    필터링된 결과 없음
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 text-center mt-1 leading-normal">
                    활성화된 필터 조건에 맞는 공고가 없습니다. 필터를 변경해 보세요.
                  </span>
                </div>
              ) : (
                <div className="space-y-2 flex-1 pb-4">
                  {displayedListings.map((posting) => {
                    const color = getAgencyColor(posting.agencyCode);
                    return (
                      <div
                        key={posting.id}
                        className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-500 shadow-sm transition-all duration-200 flex flex-col gap-2 group relative text-left"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${color.bg} ${color.text} ${color.border}`}>
                            {posting.agencyName}
                          </span>
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 dark:text-slate-500">
                            <span>{posting.createdAt}</span>
                          </div>
                        </div>

                        <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {posting.title}
                        </h4>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-50 dark:border-slate-700 text-[10px]">
                          <span className="text-slate-400 dark:text-slate-500 text-[9px] font-mono">
                            ID: {posting.id}
                          </span>
                          <a
                            href={posting.url}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-bold flex items-center gap-0.5 hover:underline"
                          >
                            링크로 이동
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : (
          // TAB 2: 수집 대상 관리 (TARGETS / 추가수집)
          <div className="flex-1 flex flex-col gap-3 text-left animate-fadeIn">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>수집 대상 사이트 ({defaultAgencies.length + customAgencies.length}개)</span>
              </div>
              {hasDeletedDefaults && (
                <button
                  onClick={onRestoreDefaultAgencies}
                  className="px-1.5 py-0.5 text-[9px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 rounded border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  기본 대상 전체 복원
                </button>
              )}
            </div>

            {/* Target Site Lists on Phone */}
            <div className="flex flex-wrap gap-1.5 max-h-[260px] overflow-y-auto pr-1">
              {/* Default Agencies */}
              {defaultAgencies.map((agency) => (
                <div 
                  key={agency.code}
                  className="bg-white dark:bg-slate-850 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-850 flex items-center gap-1.5 text-[11px] font-bold shadow-xs hover:border-blue-400 hover:dark:border-blue-600 transition-all shrink-0"
                  title={`${agency.agency} (${agency.code})`}
                >
                  <Building className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-slate-800 dark:text-slate-200 truncate max-w-[90px]">{agency.agency}</span>
                  <span className="text-[8px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1 rounded scale-90">기본</span>
                  <button
                    onClick={() => setAgencyToDelete({ code: agency.code, name: agency.agency, isDefault: true })}
                    className="p-0.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors cursor-pointer shrink-0"
                    title="기본 수집 대상 삭제"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}

              {/* Custom Agencies */}
              {customAgencies.map((agency) => (
                <div 
                  key={agency.code}
                  className="bg-blue-50/60 dark:bg-blue-950/20 px-2 py-1 rounded-lg border border-blue-200 dark:border-blue-900/50 flex items-center gap-1.5 text-[11px] font-bold shadow-xs hover:border-blue-400 hover:dark:border-blue-600 transition-all shrink-0"
                  title={`${agency.agency} (${agency.code})`}
                >
                  <Building className="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0" />
                  <span className="text-blue-800 dark:text-blue-200 truncate max-w-[100px]">{agency.agency}</span>
                  <button
<<<<<<< HEAD
                    onClick={() => setAgencyToDelete({ code: agency.code, name: agency.agency, isDefault: false })}
=======
                    onClick={() => {
                      trackButtonClick("remove_custom_agency_chip", agency.agency);
                      trackEvent("agency_remove_clicked", { agency_code: agency.code });
                      onRemoveAgency(agency.code);
                    }}
>>>>>>> 0d10c69 (firebase + flutter setting.)
                    className="p-0.5 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition-colors cursor-pointer shrink-0"
                    title="추가 수집 대상 삭제"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Mobile Add Form */}
            <form onSubmit={handlePhoneAdd} className="bg-white dark:bg-slate-800 rounded-xl p-3 border border-slate-200 dark:border-slate-700 flex flex-col gap-2 mt-2">
              <div className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                새 수집 대상 등록
              </div>

              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500">기관명</label>
                <input
                  type="text"
                  placeholder="예: 계양보건소"
                  value={phoneName}
                  onChange={(e) => {
                    setPhoneName(e.target.value);
                    trackInputInteraction("agency_name", e.target.value.length);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-0.5">
                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500">수집 주소 URL</label>
                <input
                  type="text"
                  placeholder="예: https://..."
                  value={phoneUrl}
                  onChange={(e) => {
                    setPhoneUrl(e.target.value);
                    trackInputInteraction("agency_url", e.target.value.length);
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 dark:text-white"
                />
              </div>

              {phoneError && (
                <div className="text-[10px] text-red-500 font-semibold flex items-center gap-1 animate-pulse">
                  <AlertCircle className="w-3 h-3" />
                  <span>{phoneError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 mt-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-all active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>추가 완료</span>
              </button>
            </form>
          </div>
        )}

      </div>

      {/* App Bottom Tab Bar (Material 3 Navigation Bar) */}
      <div className="h-14 bg-white dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-around text-slate-500 z-10">
        <button
          onClick={() => handleTabChange("results")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === "results"
              ? "text-blue-600 dark:text-blue-400 font-extrabold"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          <Database className="w-4.5 h-4.5" />
          <span className="text-[9px]">수집 현황</span>
        </button>
        <button
          onClick={() => handleTabChange("targets")}
          className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
            activeTab === "targets"
              ? "text-blue-600 dark:text-blue-400 font-extrabold"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          }`}
        >
          <Globe className="w-4.5 h-4.5" />
          <span className="text-[9px]">추가 수집</span>
        </button>
      </div>

      {agencyToDelete && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xl max-w-[270px] w-full text-center">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-3">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 tracking-tight leading-snug">
              수집 대상 사이트 삭제
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              정말 <span className="font-extrabold text-slate-800 dark:text-white">'{agencyToDelete.name}'</span> 사이트를 수집 대상에서 삭제할까요?
            </p>
            <div className="flex gap-2.5 mt-5">
              <button
                onClick={() => setAgencyToDelete(null)}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={() => {
                  onRemoveAgency(agencyToDelete.code, agencyToDelete.isDefault);
                  setAgencyToDelete(null);
                }}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-xs"
              >
                삭제하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
