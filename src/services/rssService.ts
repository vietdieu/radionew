import { RSSFeed, RSSArticle } from "../types";
import { saveRSSFeed } from "./storageService";

const OFFLINE_ARTICLES_CACHE_KEY = "commute_cast_offline_articles";

/**
 * Automatically assign categories based on keywords if not specified
 */
export function detectCategoryFromKeywords(title: string, content: string): string {
  const text = `${title} ${content}`.toLowerCase();
  if (
    text.includes("công nghệ") || 
    text.includes("số hóa") || 
    text.includes("smartphone") || 
    text.includes("ai") || 
    text.includes("artificial intelligence") || 
    text.includes("technology") || 
    text.includes("software") || 
    text.includes("gpt") || 
    text.includes("máy tính")
  ) {
    return "Công nghệ";
  }
  if (
    text.includes("giáo dục") || 
    text.includes("trường học") || 
    text.includes("học sinh") || 
    text.includes("sinh viên") || 
    text.includes("thi tốt nghiệp") || 
    text.includes("education") || 
    text.includes("học tập")
  ) {
    return "Giáo dục";
  }
  if (
    text.includes("kinh tế") || 
    text.includes("tài chính") || 
    text.includes("bất động sản") || 
    text.includes("doanh nghiệp") || 
    text.includes("cổ phiếu") || 
    text.includes("vàng") || 
    text.includes("finance") || 
    text.includes("economy")
  ) {
    return "Kinh tế";
  }
  if (
    text.includes("sức khỏe") || 
    text.includes("y tế") || 
    text.includes("bác sĩ") || 
    text.includes("dịch bệnh") || 
    text.includes("health") || 
    text.includes("fitness")
  ) {
    return "Sức khỏe";
  }
  if (
    text.includes("thể thao") || 
    text.includes("bóng đá") || 
    text.includes("euro") || 
    text.includes("olympic") || 
    text.includes("sports") || 
    text.includes("champion")
  ) {
    return "Thể thao";
  }
  if (
    text.includes("giải trí") || 
    text.includes("phim") || 
    text.includes("nhạc") || 
    text.includes("showbiz") || 
    text.includes("celebrity") || 
    text.includes("entertainment")
  ) {
    return "Giải trí";
  }
  return "Thời sự";
}

/**
 * Filter duplicates out or label them.
 * Performs deep duplicate detection by title normalized comparison or link comparison.
 */
export function detectAndMarkDuplicates(articles: RSSArticle[]): RSSArticle[] {
  const seenTitles = new Set<string>();
  const seenLinks = new Set<string>();

  return articles.map(art => {
    const normalizedTitle = (art.title || "").trim().toLowerCase().replace(/\s+/g, " ");
    const normalizedLink = (art.link || "").trim().toLowerCase();
    
    let isDuplicate = false;
    if (seenTitles.has(normalizedTitle) || seenLinks.has(normalizedLink)) {
      isDuplicate = true;
    }

    if (normalizedTitle) {
      seenTitles.add(normalizedTitle);
    }
    if (normalizedLink) {
      seenLinks.add(normalizedLink);
    }

    return {
      ...art,
      isDuplicate
    };
  });
}

/**
 * Load offline cached articles
 */
export function getOfflineCachedArticles(): RSSArticle[] {
  try {
    const raw = localStorage.getItem(OFFLINE_ARTICLES_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to load cached articles:", err);
    return [];
  }
}

/**
 * Save articles to offline cache
 */
export function saveOfflineCachedArticles(articles: RSSArticle[]): void {
  try {
    // Keep at most 150 latest articles for offline storage to preserve quota
    const sliced = articles.slice(0, 150);
    localStorage.setItem(OFFLINE_ARTICLES_CACHE_KEY, JSON.stringify(sliced));
  } catch (err) {
    console.error("Failed to cache articles offline:", err);
  }
}

/**
 * Fetch and parse articles from multiple RSS feeds.
 * Uses the server proxy `/api/parse-rss` to avoid CORS issues.
 * Adds health statistics tracking & caching fallbacks.
 */
export async function fetchRSSArticles(
  feeds: RSSFeed[], 
  getApiUrl: (path: string) => string,
  forceRefresh: boolean = false,
  onFeedUpdated?: (feed: RSSFeed) => void
): Promise<RSSArticle[]> {
  const aggregatedArticles: RSSArticle[] = [];
  const isOnline = typeof navigator !== "undefined" ? navigator.onLine : true;

  if (!isOnline && !forceRefresh) {
    console.log("Device is offline. Loading feeds from offline Cache Storage...");
    return detectAndMarkDuplicates(getOfflineCachedArticles());
  }

  // Group feeds by priority (high first, then medium, then low)
  const sortedFeedsByPriority = [...feeds].sort((a, b) => {
    const priorityWeight = { high: 3, medium: 2, low: 1 };
    const weightA = priorityWeight[a.priority || "medium"];
    const weightB = priorityWeight[b.priority || "medium"];
    return weightB - weightA;
  });

  for (const feed of sortedFeedsByPriority) {
    const startTime = performance.now();
    let isSuccess = false;
    let errorMessage = "";
    
    try {
      const urlWithForce = `/api/parse-rss?url=${encodeURIComponent(feed.url)}${forceRefresh ? "&forceRefresh=true" : ""}`;
      const response = await fetch(getApiUrl(urlWithForce));
      
      const duration = Math.round(performance.now() - startTime);

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      isSuccess = true;
      
      // Update statistics
      const currentFetchCount = (feed.fetchCount || 0) + 1;
      const currentSuccessCount = (feed.successCount || 0) + 1;
      const currentAvgDuration = feed.avgFetchDuration 
        ? Math.round((feed.avgFetchDuration * (currentFetchCount - 1) + duration) / currentFetchCount)
        : duration;

      const updatedFeed: RSSFeed = {
        ...feed,
        lastFetchedAt: new Date().toISOString(),
        healthStatus: "healthy",
        healthError: undefined,
        fetchCount: currentFetchCount,
        successCount: currentSuccessCount,
        avgFetchDuration: currentAvgDuration
      };

      // Save updated feed statistics asynchronously
      saveRSSFeed(updatedFeed).then(() => {
        if (onFeedUpdated) onFeedUpdated(updatedFeed);
      }).catch(e => console.warn("Could not auto-save feed health statistics:", e));

      if (data.articles && Array.isArray(data.articles)) {
        const withFeedInfo = data.articles.map((art: any) => {
          const category = feed.category || detectCategoryFromKeywords(art.title || "", art.content || "");
          return {
            ...art,
            feedId: feed.id,
            feedTitle: data.title || feed.title,
            feedCategory: category,
            feedType: feed.feedType || "news"
          };
        });
        aggregatedArticles.push(...withFeedInfo);
      }
    } catch (err: any) {
      errorMessage = err?.message || String(err);
      console.warn(`Error processing feed ${feed.title}:`, errorMessage);

      const duration = Math.round(performance.now() - startTime);
      const currentFetchCount = (feed.fetchCount || 0) + 1;
      const currentAvgDuration = feed.avgFetchDuration 
        ? Math.round((feed.avgFetchDuration * (currentFetchCount - 1) + duration) / currentFetchCount)
        : duration;

      // Unstable if some failed, failing if totally down
      const failureRatio = currentFetchCount > 0 ? (currentFetchCount - (feed.successCount || 0)) / currentFetchCount : 0;
      const health: "unstable" | "failing" = failureRatio > 0.5 ? "failing" : "unstable";

      const updatedFeed: RSSFeed = {
        ...feed,
        healthStatus: health,
        healthError: errorMessage,
        fetchCount: currentFetchCount,
        avgFetchDuration: currentAvgDuration
      };

      saveRSSFeed(updatedFeed).then(() => {
        if (onFeedUpdated) onFeedUpdated(updatedFeed);
      }).catch(e => console.warn("Could not save failing feed stats:", e));
    }
  }

  // If we couldn't fetch anything but have feeds, fallback to offline cache
  if (aggregatedArticles.length === 0 && getOfflineCachedArticles().length > 0) {
    return detectAndMarkDuplicates(getOfflineCachedArticles());
  }

  // Sort articles by publication date if available (newest first)
  const sortedArticles = aggregatedArticles.sort((a, b) => {
    const timeA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const timeB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    if (timeA && timeB) {
      return timeB - timeA;
    }
    return 0; // retain default order otherwise
  });

  // Save successful result list to offline cache
  if (sortedArticles.length > 0) {
    saveOfflineCachedArticles(sortedArticles);
  }

  return detectAndMarkDuplicates(sortedArticles);
}

/**
 * Format a list of RSS articles into a single raw text string for summarization.
 */
export function formatArticlesForPrompt(articles: RSSArticle[], uiLanguage: "vi" | "en"): string {
  if (articles.length === 0) return "";

  const header = uiLanguage === "vi"
    ? `Dưới đây là danh sách tin tức mới nhất tổng hợp từ nguồn RSS tự động:\n\n`
    : `Here is the aggregated news list from the registered RSS channels:\n\n`;

  // Filter out duplicates for clean prompts
  const activeArticles = articles.filter(art => !art.isDuplicate);

  const formatted = activeArticles.map((art, index) => {
    const sourceLabel = art.feedTitle ? `[Nguồn: ${art.feedTitle}]` : "";
    const categoryLabel = art.feedCategory ? ` [Chủ đề: ${art.feedCategory}]` : "";
    return `Bài báo #${index + 1}: ${art.title} ${sourceLabel}${categoryLabel}
Ngày đăng: ${art.pubDate || "N/A"}
Nội dung: ${art.content || "N/A"}
Liên kết: ${art.link}
---`;
  }).join("\n\n");

  return header + formatted;
}

/**
 * Export subscribed feeds to standard OPML XML string
 */
export function exportToOPML(feeds: RSSFeed[]): string {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>CommuteCast RSS Feeds Export</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
    <outline text="Subscriptions" title="Subscriptions">`;
  
  const body = feeds.map(feed => {
    const title = (feed.title || "").replace(/&/g, "&amp;").replace(/"/g, '&quot;').replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const url = (feed.url || "").replace(/&/g, "&amp;").replace(/"/g, '&quot;').replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const category = (feed.category || "Thời sự").replace(/&/g, "&amp;").replace(/"/g, '&quot;');
    const type = feed.feedType || "news";
    const priority = feed.priority || "medium";
    return `      <outline type="rss" text="${title}" title="${title}" xmlUrl="${url}" htmlUrl="${url}" category="${category}" feedType="${type}" priority="${priority}" />`;
  }).join("\n");

  const footer = `
    </outline>
  </body>
</opml>`;

  return header + "\n" + body + "\n" + footer;
}

/**
 * Parse an imported OPML XML string into raw feed parameters
 */
export function parseOPML(xmlText: string): Array<{ url: string; title: string; category: string; feedType: "news" | "podcast" | "blog"; priority: "low" | "medium" | "high" }> {
  const feeds: any[] = [];
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    // Check if xml parsing failed
    const parserError = xmlDoc.getElementsByTagName("parsererror");
    if (parserError.length > 0) {
      console.warn("OPML Parser Error:", parserError[0].textContent);
    }

    const outlines = xmlDoc.getElementsByTagName("outline");
    
    for (let i = 0; i < outlines.length; i++) {
      const el = outlines[i];
      const xmlUrl = el.getAttribute("xmlUrl") || el.getAttribute("url");
      const text = el.getAttribute("text") || el.getAttribute("title") || "Untitled Feed";
      const category = el.getAttribute("category") || "Thời sự";
      const feedTypeAttr = el.getAttribute("feedType");
      const priorityAttr = el.getAttribute("priority");

      if (xmlUrl) {
        feeds.push({
          url: xmlUrl,
          title: text,
          category: category,
          feedType: (feedTypeAttr === "news" || feedTypeAttr === "podcast" || feedTypeAttr === "blog") ? feedTypeAttr : "news",
          priority: (priorityAttr === "low" || priorityAttr === "medium" || priorityAttr === "high") ? priorityAttr : "medium"
        });
      }
    }
  } catch (err) {
    console.error("Failed to parse OPML XML content:", err);
  }
  return feeds;
}
