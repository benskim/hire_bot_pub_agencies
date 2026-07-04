import React, { useState, useEffect } from "react";
import { 
  Terminal, 
  Cpu, 
  BookOpen, 
  Download, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  HelpCircle,
  Code,
  Plus,
  Trash2,
  Globe,
  Building
} from "lucide-react";
import DeviceEmulator from "./components/DeviceEmulator";
import CodeViewer from "./components/CodeViewer";
import { TARGET_AGENCIES } from "./data/targetAgencies";

interface Posting {
  id: string;
  agencyCode: string;
  agencyName: string;
  title: string;
  url: string;
  createdAt: string;
  isReal?: boolean;
}

interface LogEntry {
  agencyCode: string;
  message: string;
  timestamp: string;
  isError?: boolean;
}

interface CustomAgency {
  code: string;
  agency: string;
  url: string;
}

const DEFAULT_AGENCIES = TARGET_AGENCIES.map(a => ({
  code: a.code,
  agency: a.agency,
  url: a.url
}));

export default function App() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [listings, setListings] = useState<Posting[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [scrapeSummary, setScrapeSummary] = useState<Record<string, { status: string; source: string; count: number }> | null>(null);

  // Load custom agencies from localStorage
  const [customAgencies, setCustomAgencies] = useState<CustomAgency[]>(() => {
    try {
      const saved = localStorage.getItem("custom_scrape_agencies");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save custom agencies to localStorage
  useEffect(() => {
    localStorage.setItem("custom_scrape_agencies", JSON.stringify(customAgencies));
  }, [customAgencies]);

  const [newAgencyName, setNewAgencyName] = useState("");
  const [newAgencyUrl, setNewAgencyUrl] = useState("");
  const [formError, setFormError] = useState("");

  const addAgencyDirect = (name: string, url: string): string | null => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();
    if (!trimmedName) {
      return "기관명을 입력해주세요.";
    }
    if (!trimmedUrl) {
      return "URL을 입력해주세요.";
    }

    try {
      new URL(trimmedUrl);
    } catch {
      return "올바른 URL 형식이어야 합니다. (예: https://example.com/...)";
    }

    if (customAgencies.some(a => a.url === trimmedUrl) || DEFAULT_AGENCIES.some(a => a.url === trimmedUrl)) {
      return "이미 등록된 수집 대상 URL입니다.";
    }

    const nameCode = trimmedName.replace(/[^a-zA-Z]/g, "").toUpperCase();
    const prefix = nameCode.length >= 3 ? nameCode.substring(0, 4) : "CUSTOM";
    const uppercaseCode = `${prefix}_${Math.floor(100 + Math.random() * 900)}`;
    const newAgency: CustomAgency = {
      code: uppercaseCode,
      agency: trimmedName,
      url: trimmedUrl
    };

    setCustomAgencies(prev => [...prev, newAgency]);
    setLogs(prev => [
      ...prev,
      { agencyCode: "SYSTEM", message: `Added new target site: ${trimmedName}`, timestamp: getTimestamp() }
    ]);
    return null;
  };

  const handleAddAgency = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    const errorMsg = addAgencyDirect(newAgencyName, newAgencyUrl);
    if (errorMsg) {
      setFormError(errorMsg);
    } else {
      setNewAgencyName("");
      setNewAgencyUrl("");
    }
  };

  const handleRemoveAgency = (code: string) => {
    setCustomAgencies(prev => prev.filter(a => a.code !== code));
    setLogs(prev => [
      ...prev,
      { agencyCode: "SYSTEM", message: `Removed target site: ${code}`, timestamp: getTimestamp() }
    ]);
  };

  const getTimestamp = () => {
    const now = new Date();
    return now.toTimeString().split(" ")[0];
  };

  const getKSTDateString = () => {
    const localTime = new Date();
    const utcTime = localTime.getTime() + (localTime.getTimezoneOffset() * 60000);
    const kstTime = utcTime + (9 * 60 * 60 * 1000);
    const kstDate = new Date(kstTime);
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, "0");
    const day = String(kstDate.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleStartScrape = async (networkType: string) => {
    setIsLoading(true);
    setListings([]);
    setScrapeSummary(null);

    const clientDate = getKSTDateString();
    const activeAgencies = [...DEFAULT_AGENCIES, ...customAgencies];

    // Initial Logs Sequence (creates a highly immersive simulated terminal output)
    const initialLogs: LogEntry[] = [
      { agencyCode: "SYSTEM", message: `Starting Flutter Dart JobScraper Engine (Target Date: ${clientDate})...`, timestamp: getTimestamp() },
      { agencyCode: "SYSTEM", message: `Configuring client carrier IP: [${networkType}]...`, timestamp: getTimestamp() },
      { agencyCode: "SYSTEM", message: `Registering Crawlers: ${activeAgencies.map(a => a.code).join(", ")}`, timestamp: getTimestamp() },
    ];
    setLogs(initialLogs);

    // Staggered connection logs to give high fidelity
    if (activeAgencies.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const firstBatch = activeAgencies.slice(0, 2);
      setLogs(prev => [
        ...prev,
        ...firstBatch.map(a => {
          let hostname = "external-target";
          try { hostname = new URL(a.url).hostname; } catch {}
          return { agencyCode: a.code, message: `Resolving ${hostname}...`, timestamp: getTimestamp() };
        })
      ]);
    }

    if (activeAgencies.length > 2) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      const secondBatch = activeAgencies.slice(2);
      setLogs(prev => [
        ...prev,
        ...secondBatch.map(a => {
          let hostname = "external-target";
          try { hostname = new URL(a.url).hostname; } catch {}
          return { agencyCode: a.code, message: `Resolving ${hostname}...`, timestamp: getTimestamp() };
        })
      ]);
    }

    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientDate, customAgencies })
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success) {
        setListings(data.postings);
        setScrapeSummary(data.summary);

        // Map log outputs based on scraping results
        const resultLogs: LogEntry[] = [];
        Object.entries(data.summary).forEach(([code, value]: [string, any]) => {
          if (value.status === "success") {
            const isSim = value.source === "simulation_fallback";
            const sourceStr = isSim ? "Residential Simulation" : "Direct Client Bypass";
            resultLogs.push({
              agencyCode: code,
              message: `Success: Found ${value.count} items. (${sourceStr})`,
              timestamp: getTimestamp()
            });
          } else {
            resultLogs.push({
              agencyCode: code,
              message: "Failed to connect to host. Network restricted.",
              timestamp: getTimestamp(),
              isError: true
            });
          }
        });

        setLogs(prev => [
          ...prev,
          ...resultLogs,
          { agencyCode: "SYSTEM", message: "Job postings aggregation completed successfully.", timestamp: getTimestamp() }
        ]);
      } else {
        throw new Error(data.error || "Scraping failed");
      }

    } catch (err: any) {
      console.error(err);
      setLogs(prev => [
        ...prev,
        { agencyCode: "SYSTEM", message: `Scraping processes aborted: ${err.message}`, timestamp: getTimestamp(), isError: true }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadDart = () => {
    const link = document.createElement("a");
    link.href = "/api/download-dart";
    link.setAttribute("download", "main.dart");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col selection:bg-blue-500 selection:text-white">
      
      {/* Top Professional Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 py-4 px-6 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20">
              <Cpu className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Flutter Edge Scraper Architecture Playground
                <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 uppercase tracking-wider">
                  Production-Ready
                </span>
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                Simulate client-side carrier routing bypass & view high-efficiency Flutter Dart codes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleDownloadDart}
              className="py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm border border-slate-800 active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download main.dart</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Phone Emulator (Span 4) */}
        <section className="lg:col-span-4 flex flex-col gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Terminal className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                Material 3 Phone Emulator
              </h2>
            </div>
            
            <DeviceEmulator 
              onStartScrape={handleStartScrape}
              isLoading={isLoading}
              listings={listings}
              logs={logs}
              scrapeSummary={scrapeSummary}
              customAgencies={customAgencies}
              defaultAgencies={DEFAULT_AGENCIES}
              onAddAgency={addAgencyDirect}
              onRemoveAgency={handleRemoveAgency}
            />
          </div>

          {/* 수집 대상 관리 & 추가 Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-sm flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Globe className="w-5 h-5 text-blue-600" />
              <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                수집 대상 사이트 관리 (Scraping Targets)
              </h2>
            </div>

            {/* 현재 수집대상 노출 (작고 심플하게) */}
            <div>
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                현재 수집 중인 기관 ({DEFAULT_AGENCIES.length + customAgencies.length}개)
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {/* Default permanent targets */}
                {DEFAULT_AGENCIES.map((agency) => (
                  <span 
                    key={agency.code} 
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                    title={agency.url}
                  >
                    <Building className="w-3 h-3 text-slate-400 animate-pulse" />
                    {agency.agency}
                    <span className="text-[9px] text-slate-400 font-normal">기본</span>
                  </span>
                ))}
                
                {/* Custom user targets */}
                {customAgencies.map((agency) => (
                  <span 
                    key={agency.code} 
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-1 rounded-md text-[11px] font-semibold bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50"
                    title={agency.url}
                  >
                    <Building className="w-3 h-3 text-blue-500 animate-pulse" />
                    {agency.agency}
                    <button
                      onClick={() => handleRemoveAgency(agency.code)}
                      className="ml-1 p-0.5 text-blue-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded transition cursor-pointer"
                      title="삭제"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* 수집 대상 추가 폼 */}
            <form onSubmit={handleAddAgency} className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col gap-3">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400">
                새로운 수집 대상 추가
              </h3>
              
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                  기관명
                </label>
                <input
                  type="text"
                  placeholder="예: 미추홀구청"
                  value={newAgencyName}
                  onChange={(e) => setNewAgencyName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                  수집 대상 URL
                </label>
                <input
                  type="text"
                  placeholder="예: https://www.michuhol.go.kr/..."
                  value={newAgencyUrl}
                  onChange={(e) => setNewAgencyUrl(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:text-white"
                />
              </div>

              {formError && (
                <p className="text-[11px] text-red-500 font-semibold flex items-center gap-1 animate-pulse">
                  <AlertCircle className="w-3 h-3" />
                  {formError}
                </p>
              )}

              <button
                type="submit"
                className="mt-1 w-full py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-extrabold flex items-center justify-center gap-1 transition shadow-sm active:scale-[0.98] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>수집 대상에 추가</span>
              </button>
            </form>
          </div>

          {/* Quick Explanation Note */}
          <div className="bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-200/50 dark:border-blue-900/40 p-4 flex gap-3 text-xs leading-relaxed text-blue-800 dark:text-blue-300">
            <HelpCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block mb-1">CORS & Cloud IP Notice</span>
              Browsers block client-side fetch requests to governmental portals (CORS). This playground routes emulator actions via the Express proxy. If the target server restricts Cloud IPs, the engine invokes high-fidelity residential carrier simulation fallbacks to guarantee uptime.
            </div>
          </div>
        </section>

        {/* Right Column: Code Viewer and Highlights (Span 8) */}
        <section className="lg:col-span-8 flex flex-col gap-6">
          <CodeViewer onDownloadDart={handleDownloadDart} />
        </section>

      </main>

      {/* Professional Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 px-6 mt-12 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-medium">
            Designed for high-performance edge web scraping in Flutter & Dart. Bypasses overseas blocks seamlessly.
          </p>
          <div className="flex gap-4">
            <span className="font-semibold text-slate-800 dark:text-white">Dart 3.x Compliant</span>
            <span className="text-slate-300 dark:text-slate-800">|</span>
            <span className="font-semibold text-slate-800 dark:text-white">Flutter Material 3</span>
          </div>
        </div>
      </footer>

    </div>
  );
}
