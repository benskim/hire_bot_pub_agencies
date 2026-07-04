import React, { useState, useEffect } from "react";
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
  onRemoveAgency: (code: string) => void;
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
  onRemoveAgency
}: DeviceEmulatorProps) {
  const [networkType, setNetworkType] = useState<string>("KT_5G");
  const [currentTime, setCurrentTime] = useState<string>("19:49");
  const [activeTab, setActiveTab] = useState<"results" | "targets">("results");

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

    const errorMsg = onAddAgency(phoneName, phoneUrl);
    if (errorMsg) {
      setPhoneError(errorMsg);
    } else {
      setPhoneName("");
      setPhoneUrl("");
      // Quick temporary UI alert or feedback can go here if needed
    }
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
    <div className="flex flex-col items-center">
      {/* Network Bypass Simulator Controls */}
      <div className="w-full max-w-sm mb-4 bg-slate-900 text-slate-100 p-4 rounded-xl border border-slate-800 shadow-lg">
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-blue-400">
          <Radio className="w-4 h-4 animate-pulse text-rose-500" />
          Carrier Network IP Controller
        </h3>
        <p className="text-xs text-slate-400 mb-3 leading-relaxed">
          Select routing method. Real-device crawler leverages your LTE/5G carrier network to route connections through domestic residential IPs, bypassing overseas cloud firewalls.
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <button
            onClick={() => setNetworkType("KT_5G")}
            className={`py-2 px-1 rounded border transition-all font-medium text-center cursor-pointer ${
              networkType === "KT_5G"
                ? "bg-blue-600 text-white border-blue-500 shadow"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <div className="font-bold">KT 5G</div>
            <div className="text-[10px] opacity-75">Domestic IP</div>
          </button>
          <button
            onClick={() => setNetworkType("SKT_LTE")}
            className={`py-2 px-1 rounded border transition-all font-medium text-center cursor-pointer ${
              networkType === "SKT_LTE"
                ? "bg-blue-600 text-white border-blue-500 shadow"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <div className="font-bold">SKT LTE</div>
            <div className="text-[10px] opacity-75">Residential</div>
          </button>
          <button
            onClick={() => setNetworkType("CLOUD_RUN")}
            className={`py-2 px-1 rounded border transition-all font-medium text-center cursor-pointer ${
              networkType === "CLOUD_RUN"
                ? "bg-rose-950 text-rose-300 border-rose-800 shadow"
                : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
            }`}
          >
            <div className="font-bold">Cloud Server</div>
            <div className="text-[10px] opacity-75 text-rose-400">Restricted IP</div>
          </button>
        </div>
      </div>

      {/* Smartphone Frame Wrapper */}
      <div className="relative w-full max-w-[360px] aspect-[9/18.5] bg-slate-950 rounded-[40px] p-3 shadow-2xl border-[5px] border-slate-800 ring-8 ring-slate-900 flex flex-col overflow-hidden">
        {/* Notch / Camera Bar */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-slate-950 rounded-full z-40 flex items-center justify-center">
          <div className="w-2.5 h-2.5 bg-slate-900 rounded-full mr-2 border border-slate-800"></div>
          <div className="w-8 h-1 bg-slate-800 rounded-full"></div>
        </div>

        {/* Outer buttons indicators on phone */}
        <div className="absolute -left-1.5 top-24 w-1 h-12 bg-slate-800 rounded-r"></div>
        <div className="absolute -left-1.5 top-40 w-1 h-10 bg-slate-800 rounded-r"></div>
        <div className="absolute -right-1.5 top-32 w-1.5 h-16 bg-slate-800 rounded-l"></div>

        {/* Screen Content */}
        <div className="w-full h-full bg-slate-50 text-slate-900 rounded-[30px] overflow-hidden flex flex-col relative border border-slate-900">
          
          {/* Mobile Status Bar */}
          <div className="h-9 bg-blue-800 text-white flex justify-between items-center px-6 text-xs select-none pt-2 font-medium z-30">
            <span>{currentTime}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold tracking-tight px-1 py-0.5 rounded bg-blue-900">
                {networkType === "KT_5G" ? "KT 5G" : networkType === "SKT_LTE" ? "SKT LTE" : "Cloud Run"}
              </span>
              <Wifi className="w-3.5 h-3.5" />
              <Battery className="w-4 h-4" />
            </div>
          </div>

          {/* Material 3 App Bar */}
          <div className="h-14 bg-blue-700 text-white flex items-center justify-between px-4 shadow-md z-10">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-amber-300 animate-pulse" />
              <h1 className="font-bold text-sm tracking-tight">공공기관 일자리 수집 엔진</h1>
            </div>
            <div className="flex gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            </div>
          </div>

          {/* Screen Scrollable Body */}
          <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-3 bg-slate-50 dark:bg-slate-900">
            
            {activeTab === "results" ? (
              // TAB 1: 수집 현황 (RESULTS)
              <>
                {/* Action Trigger Button */}
                <button
                  onClick={() => onStartScrape(networkType)}
                  disabled={isLoading}
                  className={`w-full py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer ${
                    isLoading 
                      ? "bg-slate-300 text-slate-500 cursor-not-allowed" 
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
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      수집된 채용 목록 ({listings.length})
                    </span>
                    {listings.length > 0 && listings.some(l => !l.isReal) && (
                      <span className="text-[8px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium flex items-center gap-0.5">
                        <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                        Simulation Fallback Mode
                      </span>
                    )}
                  </div>

                  {isLoading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 bg-white rounded-xl border border-slate-200 shadow-sm px-4">
                      <div className="relative mb-3">
                        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <Radio className="w-4 h-4 text-rose-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                      </div>
                      <span className="text-[12px] font-bold text-slate-800 text-center">
                        Scraping via local residential IP network...
                      </span>
                      <span className="text-[10px] text-slate-400 text-center mt-1">
                        Connecting direct to government web hosts to bypass cloud blacklists...
                      </span>
                    </div>
                  ) : listings.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-14 bg-white rounded-xl border border-dashed border-slate-300 text-slate-400 px-4">
                      <Database className="w-8 h-8 mb-2 text-slate-300" />
                      <span className="text-sm font-black text-slate-700 text-center tracking-tight">
                        공고없음
                      </span>
                      <span className="text-[10px] text-slate-400 text-center mt-1 leading-normal">
                        수집 버튼을 눌러 오늘 등록된 공고를 수집하세요.
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2 flex-1 pb-4">
                      {listings.map((posting) => {
                        const color = getAgencyColor(posting.agencyCode);
                        return (
                          <div
                            key={posting.id}
                            className="bg-white rounded-xl p-3 border border-slate-200 hover:border-blue-400 shadow-sm transition-all duration-200 flex flex-col gap-2 group relative text-left"
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border ${color.bg} ${color.text} ${color.border}`}>
                                {posting.agencyName}
                              </span>
                              <div className="flex items-center gap-1 text-[9px] text-slate-400">
                                <span>{posting.createdAt}</span>
                                {posting.isReal === false && (
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" title="Simulated via Mobile Residential Fallback"></span>
                                )}
                              </div>
                            </div>

                            <h4 className="font-bold text-xs text-slate-800 leading-snug group-hover:text-blue-600 transition-colors">
                              {posting.title}
                            </h4>

                            <div className="flex items-center justify-between pt-1 border-t border-slate-50 text-[10px]">
                              <span className="text-slate-400 text-[9px] font-mono">
                                ID: {posting.id}
                              </span>
                              <a
                                href={posting.url}
                                target="_blank"
                                referrerPolicy="no-referrer"
                                className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-0.5 hover:underline"
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
              <div className="flex-1 flex flex-col gap-3 text-left">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                  <Globe className="w-4 h-4 text-blue-600" />
                  <span>수집 대상 사이트 ({defaultAgencies.length + customAgencies.length}개)</span>
                </div>

                {/* Target Site Lists on Phone */}
                <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                  {/* Default Agencies */}
                  {defaultAgencies.map((agency) => (
                    <div 
                      key={agency.code}
                      className="bg-white rounded-lg p-2 border border-slate-200 flex items-center justify-between text-xs font-medium"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Building className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-slate-800 font-bold truncate">{agency.agency}</span>
                        <span className="text-[8px] bg-slate-100 text-slate-500 px-1 py-0.2 rounded">기본</span>
                      </div>
                      <span className="text-[8px] text-slate-400 font-mono truncate max-w-[100px]">{agency.code}</span>
                    </div>
                  ))}

                  {/* Custom Agencies */}
                  {customAgencies.map((agency) => (
                    <div 
                      key={agency.code}
                      className="bg-blue-50/60 rounded-lg p-2 border border-blue-200 flex items-center justify-between text-xs font-medium animate-fadeIn"
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <Building className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-blue-800 font-bold truncate">{agency.agency}</span>
                        <span className="text-[8px] bg-blue-100 text-blue-600 px-1 py-0.2 rounded">추가</span>
                      </div>
                      <button
                        onClick={() => onRemoveAgency(agency.code)}
                        className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors cursor-pointer"
                        title="삭제"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Mobile Add Form */}
                <form onSubmit={handlePhoneAdd} className="bg-white rounded-xl p-3 border border-slate-200 flex flex-col gap-2 mt-2">
                  <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
                    새 수집 대상 등록
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold text-slate-400">기관명</label>
                    <input
                      type="text"
                      placeholder="예: 계양보건소"
                      value={phoneName}
                      onChange={(e) => setPhoneName(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex flex-col gap-0.5">
                    <label className="text-[9px] font-bold text-slate-400">수집 주소 URL</label>
                    <input
                      type="text"
                      placeholder="예: https://..."
                      value={phoneUrl}
                      onChange={(e) => setPhoneUrl(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500"
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
          <div className="h-14 bg-white border-t border-slate-200 flex items-center justify-around text-slate-500 z-10">
            <button
              onClick={() => setActiveTab("results")}
              className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                activeTab === "results"
                  ? "text-blue-600 font-extrabold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Database className="w-4.5 h-4.5" />
              <span className="text-[9px]">수집 현황</span>
            </button>
            <button
              onClick={() => setActiveTab("targets")}
              className={`flex-1 py-1 flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                activeTab === "targets"
                  ? "text-blue-600 font-extrabold"
                  : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Globe className="w-4.5 h-4.5" />
              <span className="text-[9px]">추가 수집</span>
            </button>
          </div>

          {/* Android Virtual Navigation Bar Simulation */}
          <div className="h-11 bg-slate-100 flex items-center justify-around border-t border-slate-200 text-slate-500 px-6 pb-1">
            <div className="w-5 h-5 border-2 border-slate-400 rounded-md"></div>
            <div className="w-5 h-5 rounded-full border-2 border-slate-400"></div>
            <div className="w-4 h-4 border-y-2 border-l-2 border-slate-400 rotate-45 transform"></div>
          </div>

        </div>
      </div>
    </div>
  );
}
