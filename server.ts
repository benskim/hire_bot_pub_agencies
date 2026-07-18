import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import { GoogleGenAI, Type } from "@google/genai";
import { TARGET_AGENCIES } from "./src/data/targetAgencies";

// Helper to determine if a title represents a strict job notice
function isJobTitle(title: string): boolean {
  const keywords = ["채용", "모집", "공고", "강사", "대체", "직원", "인력", "근로자", "사원", "조리", "초빙", "일자리", "구인", "임용", "선발", "요원", "지도사", "조리원", "행정원", "지도원", "복지사", "모십니다"];
  return keywords.some(kw => title.includes(kw));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const ai = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      })
    : null;

  // Configuration for target agencies
  const targetAgencies = TARGET_AGENCIES;

  // Resolve detailed page URL from various formats (such as relative path or JavaScript function strings)
  function resolveDetailedUrl(href: string, agency: { code: string; url: string; baseUrl?: string }): string {
    const resolvedBaseUrl = agency.baseUrl || new URL(agency.url).origin;
    if (!href) return agency.url;

    let cleanHref = href.trim();

    // Strip leading relative path prefixes like './'
    if (cleanHref.startsWith("./")) {
      cleanHref = cleanHref.substring(2);
    }

    // Parse JavaScript functions often used in government web boards
    if (cleanHref.startsWith("javascript:") || cleanHref.includes("javascript")) {
      const matches = cleanHref.match(/['"](\d+)['"]/g) || cleanHref.match(/\((\d+)\)/) || cleanHref.match(/(\d+)/g);
      if (matches && matches.length > 0) {
        const ids = matches.map(m => m.replace(/['"()]/g, ""));
        // The posting ID is typically the last ID in the javascript arguments (e.g. goLink('86', '305411') -> 305411)
        const lastId = ids[ids.length - 1];

        if (agency.code === "ICE") {
          return `${resolvedBaseUrl}/ice/na/ntt/selectNttInfo.do?mi=10997&bbsId=1981&nttSn=${lastId}`;
        } else if (agency.code === "BUKBU_ICE") {
          return `${resolvedBaseUrl}/bbs/data/view.do?menu_idx=86&data_idx=${lastId}`;
        } else if (agency.code === "GY_OFFICE" || agency.code === "SEOHAE_OFFICE") {
          return `${agency.url}?mode=view&idx=${lastId}`;
        } else if (agency.code === "GY_WOMAN") {
          return `${resolvedBaseUrl}/bbs/board.php?bo_table=notice02&wr_id=${lastId}`;
        } else if (agency.code === "GY_SISEOL") {
          return `https://www.gysiseol.or.kr/main/main.php?categoryid=07&menuid=09&groupid=00&mode=view&wr_id=${lastId}`;
        } else if (agency.code === "IC_SISEOL") {
          return `https://www.insiseol.or.kr/main/notice/job2.jsp?mode=view&idx=${lastId}`;
        } else if (agency.code === "BP_GU") {
          return `https://www.icbp.go.kr/main/eminwon/eminwonJobList.do?pgno=1&mode=view&idx=${lastId}`;
        } else if (agency.code === "BPSS") {
          return `https://www.bpss.or.kr:444/open_content/main/community/job.jsp?mode=view&idx=${lastId}`;
        } else if (agency.code === "ISSI") {
          return `https://www.issi.or.kr/sub/common_board.asp?mNo=MA030010000&mode=view&idx=${lastId}`;
        }
      }
    }

    if (cleanHref.startsWith("http://") || cleanHref.startsWith("https://")) {
      return cleanHref;
    }

    let finalUrl = "";
    if (cleanHref.startsWith("/")) {
      finalUrl = `${resolvedBaseUrl}${cleanHref}`;
    } else if (agency.code === "GY_OFFICE") {
      finalUrl = `${resolvedBaseUrl}/open_content/main/open_info/admin/${cleanHref}`;
    } else if (agency.code === "GY_WOMAN") {
      finalUrl = `${resolvedBaseUrl}/bbs/${cleanHref}`;
    } else {
      try {
        const parts = agency.url.split("/");
        parts.pop();
        finalUrl = `${parts.join("/")}/${cleanHref}`;
      } catch {
        finalUrl = `${resolvedBaseUrl}/${cleanHref}`;
      }
    }

    // Clean up duplicate slashes in the path part of the URL (ignoring 'http://' or 'https://')
    return finalUrl.replace(/([^:]\/)\/+/g, "$1");
  }

  // Validate if a link returns 403 or 404
  async function isValidLink(url: string, referrer: string): Promise<boolean> {
    if (!url || !url.startsWith("http")) return false;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
          "Referer": referrer
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.status === 403 || res.status === 404) {
        console.log(`[LinkCheck] Link ${url} is forbidden/404 (status: ${res.status}). Excluding.`);
        return false;
      }
      return true;
    } catch (err: any) {
      console.log(`[LinkCheck] Link validation warning for ${url}: ${err.message}`);
      // If it's a transient network or SSL error, we do not explicitly treat it as 403/404,
      // but let's default to true to be safe, unless it is a clear HTTP 403 or 404.
      return true;
    }
  }

  function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  // Scraping fallback using Gemini Search Grounding to bypass strict firewall/IP blocks on gov servers
  async function scrapeAgencyWithGemini(
    agency: { code: string; agency: string; url: string; baseUrl?: string; type?: string },
    clientDate: string
  ): Promise<{ success: boolean; list: any[]; source: string; error?: string }> {
    if (!ai) {
      return { success: false, list: [], source: "gemini_fallback", error: "Gemini API client not initialized" };
    }

    try {
      const d1 = new Date(clientDate);
      const d2 = new Date(d1);
      d2.setDate(d2.getDate() - 1);
      const formatDate = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };
      const targetDates = [clientDate, formatDate(d2)];

      console.log(`[Gemini Fallback] Querying Google Search Grounding for ${agency.agency} (${agency.code}) around ${targetDates.join(", ")}...`);

      const prompt = `Find live job announcements or recruitment postings (e.g. 채용공고, 모집, 강사 채용, 기간제 채용, 대체 인력) from the website "${agency.agency}" at URL "${agency.url}".
You must search for postings that were published or created on either of these dates: ${targetDates.join(", ")}.
For each matching job posting, retrieve:
1. title: The exact title of the job announcement/post (must contain keywords like '채용', '모집', '공고' etc).
2. url: The absolute URL link to the detail page (e.g. containing wr_id=... or idx=... or selectNttInfo.do?...).
3. createdAt: The creation/publication date, formatted exactly as "YYYY-MM-DD" (must be one of: ${targetDates.join(", ")}).

Return a valid JSON array of objects representing these postings. Example:
[
  { "title": "2026년 제3회 계양구청 일반임기제공무원 채용 시험 공고", "url": "https://www.gyeyang.go.kr/open_content/main/open_info/admin/job.jsp?mode=view&idx=10352", "createdAt": "${clientDate}" }
]`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                url: { type: Type.STRING },
                createdAt: { type: Type.STRING }
              },
              required: ["title", "url", "createdAt"]
            }
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response from Gemini Search Grounding");
      }

      const list = JSON.parse(text.trim());
      if (Array.isArray(list)) {
        const formattedList = list.map((item: any) => {
          const detailedUrl = resolveDetailedUrl(item.url, agency);
          return {
            id: Math.abs(hashCode(`${agency.code}-${item.title}-${detailedUrl}`)).toString(16).substring(0, 16),
            agencyCode: agency.code,
            agencyName: agency.agency,
            title: item.title,
            url: detailedUrl,
            createdAt: item.createdAt || clientDate,
            isReal: true
          };
        });
        console.log(`[Gemini Fallback] Retrieved ${formattedList.length} items for ${agency.agency} using Gemini Search Grounding.`);
        return { success: true, list: formattedList, source: "gemini_fallback" };
      }

      throw new Error("Response was not a JSON array");
    } catch (err: any) {
      console.log(`[Gemini Fallback] Failed for ${agency.agency}: ${err.message}`);
      return { success: false, list: [], source: "gemini_fallback", error: err.message };
    }
  }

  // Scraping logic with zero mockup fallbacks, with Gemini Search Grounding fallback on failure
  async function scrapeAgency(
    agency: { code: string; agency: string; url: string; baseUrl?: string; type?: string },
    clientDate: string
  ): Promise<{ success: boolean; list: any[]; source: string; error?: string }> {
    const resolvedBaseUrl = agency.baseUrl || new URL(agency.url).origin;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6.0s timeout for fast response

      const res = await fetch(agency.url, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          "Referer": resolvedBaseUrl + "/",
          "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}`);
      }

      const html = await res.text();
      const $ = cheerio.load(html);
      const postings: Array<{
        id: string;
        agencyCode: string;
        agencyName: string;
        title: string;
        url: string;
        createdAt: string;
        isReal: boolean;
      }> = [];

      let elements: cheerio.Cheerio<any>;

      if (agency.code === "GY_OFFICE") {
        elements = $("td.subject a");
        if (elements.length === 0) {
          elements = $(".left a");
        }
      } else if (agency.code === "GY_WOMAN") {
        elements = $(".td_subject a");
        if (elements.length === 0) {
          elements = $(".bo_tit a");
        }
      } else {
        elements = $("td.nttSj a");
        if (elements.length === 0) {
          elements = $("td.title a");
        }
        if (elements.length === 0) {
          elements = $("td.subject a");
        }
        if (elements.length === 0) {
          elements = $("a").filter((_, el) => {
            const t = $(el).text().trim();
            return t.length > 5 && (t.includes("채용") || t.includes("모집") || t.includes("공고") || t.includes("강사") || t.includes("대체"));
          });
        }
      }

      elements.each((_, el) => {
        const text = $(el).text().trim();
        let href = $(el).attr("href") || "";

        if (text && href) {
          const cleanTitle = text.replace(/\s+/g, ' ').trim();
          if (cleanTitle.includes("댓글") || cleanTitle === "") return;

          // STRICT FILTER: 수집대상은 반드시 채용공고글에 한정됨
          if (!isJobTitle(cleanTitle)) {
            return;
          }

          // Use the high-fidelity URL resolver to target detailed page
          const detailedUrl = resolveDetailedUrl(href, agency);

          const simpleHash = Math.abs(hashCode(`${agency.code}-${cleanTitle}-${detailedUrl}`))
            .toString(16)
            .substring(0, 16);

          // Extract date from table row
          let itemDate = "";
          const row = $(el).closest('tr');
          if (row.length > 0) {
            row.find('td, span, div').each((_, cell) => {
              const cellText = $(cell).text().trim();
              const dateMatch = cellText.match(/(\d{4})[-.](\d{2})[-.](\d{2})/);
              if (dateMatch) {
                itemDate = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
              } else {
                const shortMatch = cellText.match(/^(\d{2})[-.](\d{2})$/);
                if (shortMatch) {
                  const year = new Date().getFullYear();
                  itemDate = `${year}-${shortMatch[1]}-${shortMatch[2]}`;
                }
              }
            });
          }

          postings.push({
            id: simpleHash,
            agencyCode: agency.code,
            agencyName: agency.agency,
            title: cleanTitle,
            url: detailedUrl,
            createdAt: itemDate,
            isReal: true
          });
        }
      });

      return { success: true, list: postings, source: "live" };
    } catch (err: any) {
      console.log(`[Scraper] Failed direct scrape for ${agency.code} (${agency.agency}): ${err.message}`);
      if (ai) {
        console.log(`[Scraper] Falling back to Gemini Search Grounding for ${agency.code} (${agency.agency})...`);
        return await scrapeAgencyWithGemini(agency, clientDate);
      }
      return { success: false, list: [], source: "live", error: err.message };
    }
  }

  // API Scrape endpoint
  app.post("/api/scrape", async (req, res) => {
    console.log("[API] /api/scrape called");
    const { clientDate, customAgencies } = req.body;
    const clientCustomAgencies = Array.isArray(customAgencies) ? customAgencies : [];

    // Parse the clientDate and compute clientDate-1 (yesterday) to filter for recent 2 days
    const d1 = new Date(clientDate);
    const d2 = new Date(d1);
    d2.setDate(d2.getDate() - 1);
    
    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    
    const targetDates = [clientDate, formatDate(d2)];
    console.log(`[API] Filtering for targetDates: ${targetDates.join(", ")}, received ${clientCustomAgencies.length} custom agencies.`);
    try {
      const mergedAgencies = [...targetAgencies, ...clientCustomAgencies];
      const promises = mergedAgencies.map(agency => scrapeAgency(agency, clientDate));
      const results = await Promise.all(promises);

      const allList: any[] = [];
      const summary: Record<string, { status: string; source: string; count: number }> = {};

      results.forEach((res, idx) => {
        const code = mergedAgencies[idx].code;
        if (res.success) {
          // STRICT FILTER: Date must match either targetDates exactly AND title must be a recruitment/job post
          const filteredAgencyList = res.list.filter((item: any) => {
            const matchesDate = targetDates.includes(item.createdAt);
            const matchesJob = isJobTitle(item.title);
            return matchesDate && matchesJob;
          });
          allList.push(...filteredAgencyList);
          summary[code] = {
            status: "success",
            source: res.source,
            count: filteredAgencyList.length
          };
        } else {
          summary[code] = {
            status: "failed",
            source: "none",
            count: 0
          };
        }
      });

      // Direct pass-through of all retrieved postings without blocking the event loop with synchronous server-side fetch checks
      const validList = [...allList];

      // Sort by date (newest first)
      validList.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

      // Update accurate counts in summary after link validation
      mergedAgencies.forEach((agency) => {
        const code = agency.code;
        if (summary[code] && summary[code].status === "success") {
          summary[code].count = validList.filter(item => item.agencyCode === code).length;
        }
      });

      res.json({
        success: true,
        postings: validList,
        summary
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Serve Dart file for direct download
  app.get("/api/download-dart", (req, res) => {
    const dartPath = path.join(process.cwd(), "main.dart");
    res.download(dartPath, "main.dart", (err) => {
      if (err) {
        console.error("Error downloading file:", err);
        if (!res.headersSent) {
          res.status(404).send("File not found");
        }
      }
    });
  });

  // Serve static files in production, or mount Vite in dev
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
