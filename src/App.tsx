import React, { useState, useEffect } from "react";
import DeviceEmulator from "./components/DeviceEmulator";
import { TARGET_AGENCIES } from "./data/targetAgencies";
import { 
  trackEvent, 
  trackButtonClick, 
  trackUIAction,
  trackScrapeAction, 
  trackException,
  saveAddedAgencyToFirebase,
  saveDeletedAgencyToFirebase
} from "./lib/firebaseAnalytics";

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

  // Track initial page view in Firebase Google Analytics
  useEffect(() => {
    trackEvent("page_view", { page_title: "JobScraper Emulator" });
  }, []);

  useEffect(() => {
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const element = target?.closest("button, a, input, textarea, select, [role='button']") as HTMLElement | null;

      if (!element) return;

      const label =
        element.getAttribute("aria-label") ||
        element.getAttribute("title") ||
        element.textContent?.trim().slice(0, 80) ||
        "";
      const tagName = element.tagName.toLowerCase();
      const action = tagName === "a" ? "link_click" : tagName === "button" || element.getAttribute("role") === "button" ? "button_click" : "control_interaction";

      trackUIAction(action, {
        element: tagName,
        label,
        url: tagName === "a" ? (element as HTMLAnchorElement).href : undefined,
      });
    };

    document.addEventListener("click", handleGlobalClick);
    return () => document.removeEventListener("click", handleGlobalClick);
  }, []);

  // Load custom agencies from localStorage
  const [customAgencies, setCustomAgencies] = useState<CustomAgency[]>(() => {
    try {
      const saved = localStorage.getItem("custom_scrape_agencies");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load deleted default agencies from localStorage
  const [deletedDefaultCodes, setDeletedDefaultCodes] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("deleted_default_codes");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save custom agencies to localStorage
  useEffect(() => {
    localStorage.setItem("custom_scrape_agencies", JSON.stringify(customAgencies));
  }, [customAgencies]);

  // Save deleted default agencies to localStorage
  useEffect(() => {
    localStorage.setItem("deleted_default_codes", JSON.stringify(deletedDefaultCodes));
  }, [deletedDefaultCodes]);

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
    saveAddedAgencyToFirebase(trimmedName, trimmedUrl);
    trackButtonClick("add_custom_agency", trimmedName);
    setLogs(prev => [
      ...prev,
      { agencyCode: "SYSTEM", message: `Added new target site: ${trimmedName}`, timestamp: getTimestamp() }
    ]);
    return null;
  };

  const handleRemoveAgency = (code: string, isDefault: boolean) => {
    if (isDefault) {
      const agencyToRemove = DEFAULT_AGENCIES.find(a => a.code === code);
      if (agencyToRemove) {
        saveDeletedAgencyToFirebase(agencyToRemove.agency, agencyToRemove.url);
        setDeletedDefaultCodes(prev => [...prev, code]);
        trackButtonClick("remove_default_agency", code);
        setLogs(prev => [
          ...prev,
          { agencyCode: "SYSTEM", message: `Removed default target site: ${agencyToRemove.agency}`, timestamp: getTimestamp() }
        ]);
      }
    } else {
      const agencyToRemove = customAgencies.find(a => a.code === code);
      if (agencyToRemove) {
        saveDeletedAgencyToFirebase(agencyToRemove.agency, agencyToRemove.url);
      }
      setCustomAgencies(prev => prev.filter(a => a.code !== code));
      trackButtonClick("remove_custom_agency", code);
      setLogs(prev => [
        ...prev,
        { agencyCode: "SYSTEM", message: `Removed custom target site: ${code}`, timestamp: getTimestamp() }
      ]);
    }
  };

  const handleRestoreDefaultAgencies = () => {
    setDeletedDefaultCodes([]);
    trackButtonClick("restore_default_agencies", "all");
    setLogs(prev => [
      ...prev,
      { agencyCode: "SYSTEM", message: "Restored all deleted default target sites", timestamp: getTimestamp() }
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
    const d1 = new Date(clientDate);
    const d2 = new Date(d1);
    d2.setDate(d2.getDate() - 2);
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const targetRangeStr = `${formatDate(d2)} ~ ${clientDate}`;

    const activeDefaultAgencies = DEFAULT_AGENCIES.filter(a => !deletedDefaultCodes.includes(a.code));
    const activeAgencies = [...activeDefaultAgencies, ...customAgencies];

    // Initial Logs Sequence (creates a highly immersive simulated terminal output)
    const initialLogs: LogEntry[] = [
      { agencyCode: "SYSTEM", message: `Starting Flutter Dart JobScraper Engine (Target Dates: ${targetRangeStr})...`, timestamp: getTimestamp() },
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
        body: JSON.stringify({ 
          clientDate, 
          customAgencies,
          activeDefaultCodes: activeDefaultAgencies.map(a => a.code)
        })
      });

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const data = await res.json();
      
      if (data.success) {
        setListings(data.postings);
        setScrapeSummary(data.summary);

        // Track successful scraping action in GA
        trackScrapeAction(networkType, true, data.postings.length);

        // Map log outputs based on scraping results
        const resultLogs: LogEntry[] = [];
        Object.entries(data.summary).forEach(([code, value]: [string, any]) => {
          if (value.status === "success") {
            resultLogs.push({
              agencyCode: code,
              message: `Success: Found ${value.count} items.`,
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
      
      // Track failed scraping action and log exception in Web Crashlytics simulator
      trackScrapeAction(networkType, false, 0, err.message);
      trackException(`Scrape aborted: ${err.message}`, false, err.stack);

      setLogs(prev => [
        ...prev,
        { agencyCode: "SYSTEM", message: `Scraping processes aborted: ${err.message}`, timestamp: getTimestamp(), isError: true }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-sm">
        <DeviceEmulator 
          onStartScrape={handleStartScrape}
          isLoading={isLoading}
          listings={listings}
          logs={logs}
          scrapeSummary={scrapeSummary}
          customAgencies={customAgencies}
          defaultAgencies={DEFAULT_AGENCIES.filter(a => !deletedDefaultCodes.includes(a.code))}
          onAddAgency={addAgencyDirect}
          onRemoveAgency={handleRemoveAgency}
          onRestoreDefaultAgencies={handleRestoreDefaultAgencies}
          hasDeletedDefaults={deletedDefaultCodes.length > 0}
        />
      </div>
    </div>
  );
}
