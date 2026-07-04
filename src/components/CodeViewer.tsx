import React, { useState } from "react";
import { Copy, Check, Download, Code, Layers, Share2, BookOpen, Cpu } from "lucide-react";
import { dartCodeChunks } from "../data/dartCode";

interface CodeViewerProps {
  onDownloadDart: () => void;
}

export default function CodeViewer({ onDownloadDart }: CodeViewerProps) {
  const [activeTab, setActiveTab] = useState<keyof typeof dartCodeChunks>("full");
  const [copied, setCopied] = useState<boolean>(false);

  const codeTabs: Array<{ id: keyof typeof dartCodeChunks; label: string; desc: string }> = [
    { id: "full", label: "main.dart (Full)", desc: "Complete All-in-One production file containing models, crawlers, and UI." },
    { id: "models", label: "JobPosting Model", desc: "JobPosting data structure, serialization, and deterministic SHA-256 hashing." },
    { id: "crawlers", label: "Concrete Crawlers", desc: "Abstract base JobCrawler with GyOffice, GyWoman, and IceNtt implementations." },
    { id: "factory", label: "Registry & Factory", desc: "Dynamic configuration-driven initialization of crawlers with parallel streams." },
    { id: "ui", label: "HomeScreen UI", desc: "Material 3 interface designed to display status lists and control local network scraping." },
  ];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(dartCodeChunks[activeTab]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  // Ultra-simple syntax-highlight simulator for Dart code
  const highlightCode = (code: string) => {
    const keywords = [
      "class", "extends", "implements", "abstract", "final", "var", "const", "return", 
      "await", "async", "Future", "try", "catch", "throw", "if", "for", "in", "new", 
      "import", "as", "void", "static", "required", "factory", "null", "switch", "case", 
      "default", "super", "get", "set"
    ];
    const types = [
      "String", "int", "double", "bool", "List", "Map", "Set", "Uri", "DateTime", 
      "Widget", "BuildContext", "State", "StatefulWidget", "StatelessWidget", "JobPosting", 
      "JobCrawler", "GyOfficeCrawler", "GyWomanCrawler", "IceNttCrawler", "CrawlerFactory", 
      "CrawlerManager", "ScraperApp", "HomeScreen", "Color", "ThemeData", "ColorScheme", 
      "AppBar", "Card", "Padding", "Row", "Column", "Icon", "Text", "ElevatedButton", 
      "CircularProgressIndicator", "ListView", "ListTile", "Chip", "SnackBar", 
      "Scaffold", "Colors", "utf8", "parser", "http"
    ];

    const lines = code.split("\n");
    return lines.map((line, idx) => {
      // Escape HTML entities to prevent rendering issues
      let safeLine = line
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

      // Highlighting comments
      if (safeLine.trim().startsWith("//") || safeLine.trim().startsWith("/*")) {
        return (
          <div key={idx} className="text-slate-500 font-mono text-xs leading-5">
            {line}
          </div>
        );
      }

      // Format annotations
      safeLine = safeLine.replace(/(@override)/g, '<span class="text-amber-500 font-semibold">$1</span>');

      // Highlight keywords
      keywords.forEach((kw) => {
        const regex = new RegExp(`\\b(${kw})\\b`, "g");
        safeLine = safeLine.replace(regex, '<span class="text-rose-500 font-semibold">$1</span>');
      });

      // Highlight types
      types.forEach((type) => {
        const regex = new RegExp(`\\b(${type})\\b`, "g");
        safeLine = safeLine.replace(regex, '<span class="text-blue-400 font-medium">$1</span>');
      });

      // Highlight strings
      safeLine = safeLine.replace(/('(.*?)')/g, '<span class="text-emerald-400">$1</span>');
      safeLine = safeLine.replace(/("(.*?)")/g, '<span class="text-emerald-400">$1</span>');

      return (
        <div 
          key={idx} 
          className="font-mono text-xs leading-5"
          dangerouslySetInnerHTML={{ __html: safeLine || " " }}
        />
      );
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Code Viewer Panel */}
      <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow-xl overflow-hidden flex flex-col">
        {/* Header bar */}
        <div className="bg-slate-900 px-5 py-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-900/40 rounded-lg text-blue-400">
              <Code className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                Dart / Flutter Scraper Code Board
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Explore the scalable client-side crawling architecture.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={handleCopyCode}
              className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 border border-slate-700"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Code</span>
                </>
              )}
            </button>
            <button
              onClick={onDownloadDart}
              className="py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download main.dart</span>
            </button>
          </div>
        </div>

        {/* Tab Selection Row */}
        <div className="bg-slate-900/50 px-4 pt-2.5 border-b border-slate-800 overflow-x-auto flex gap-1.5 no-scrollbar">
          {codeTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setCopied(false);
              }}
              className={`px-4 py-2 text-xs font-semibold rounded-t-lg transition-all duration-150 border-t-2 whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-slate-950 text-blue-400 border-blue-500"
                  : "bg-transparent text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active tab short description */}
        <div className="bg-slate-900/30 px-5 py-2.5 text-[11px] text-slate-400 italic border-b border-slate-800/50">
          {codeTabs.find((t) => t.id === activeTab)?.desc}
        </div>

        {/* Code Content Area */}
        <div className="bg-slate-950 p-5 overflow-auto max-h-[480px] scrollbar-thin scrollbar-thumb-slate-800 select-text">
          <pre className="text-slate-300 font-mono text-xs select-text">
            {highlightCode(dartCodeChunks[activeTab])}
          </pre>
        </div>
      </div>

      {/* Architectural Concept Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl text-blue-600 dark:text-blue-400 w-fit">
            <Cpu className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
            Client-Side Edge Scraping
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            By embedding HTML requests directly into the client mobile code, scrapers utilize local carriers (LTE/5G) or residential Wi-Fi networks. This prevents firewalls from identifying requests as datacenter IPs.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
          <div className="p-2.5 bg-purple-50 dark:bg-purple-950/40 rounded-xl text-purple-600 dark:text-purple-400 w-fit">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
            Robust Multi-Target Selectors
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Targets Java Spring boards, GNUBoard systems, and specialized NTT boards using custom selectors: <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] text-purple-600 dark:text-purple-400 font-bold">td.subject a</code>, <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] text-purple-600 dark:text-purple-400 font-bold">.bo_tit a</code>, and <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] text-purple-600 dark:text-purple-400 font-bold">td.nttSj a</code>.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col gap-3">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl text-emerald-600 dark:text-emerald-400 w-fit">
            <Share2 className="w-5 h-5" />
          </div>
          <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
            Parallel Concurrency
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Using <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">Future.wait()</code>, crawlers run concurrent async network pipelines. This allows sub-second scraping while isolating errors: one broken site won't crash the pipeline.
          </p>
        </div>
      </div>
    </div>
  );
}
