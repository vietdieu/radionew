import { RSSFeed, RSSArticle } from "../types";

/**
 * Fetch and parse articles from multiple RSS feeds.
 * Uses the server proxy `/api/parse-rss` to avoid CORS issues.
 */
export async function fetchRSSArticles(
  feeds: RSSFeed[], 
  getApiUrl: (path: string) => string,
  forceRefresh: boolean = false
): Promise<RSSArticle[]> {
  const aggregatedArticles: RSSArticle[] = [];

  for (const feed of feeds) {
    try {
      const urlWithForce = `/api/parse-rss?url=${encodeURIComponent(feed.url)}${forceRefresh ? "&forceRefresh=true" : ""}`;
      const response = await fetch(getApiUrl(urlWithForce));
      if (!response.ok) {
        console.warn(`Failed to fetch articles for feed: ${feed.title} (${feed.url})`);
        continue;
      }
      const data = await response.json();
      
      if (data.articles && Array.isArray(data.articles)) {
        const withFeedInfo = data.articles.map((art: any) => ({
          ...art,
          feedTitle: data.title || feed.title,
          feedCategory: feed.category,
          feedType: feed.feedType
        }));
        aggregatedArticles.push(...withFeedInfo);
      }
    } catch (err) {
      console.warn(`Error processing feed ${feed.title}:`, err);
    }
  }

  // Sort articles by publication date if available (newest first)
  return aggregatedArticles.sort((a, b) => {
    const timeA = a.pubDate ? new Date(a.pubDate).getTime() : 0;
    const timeB = b.pubDate ? new Date(b.pubDate).getTime() : 0;
    if (timeA && timeB) {
      return timeB - timeA;
    }
    return 0; // retain default order otherwise
  });
}

/**
 * Format a list of RSS articles into a single raw text string for summarization.
 */
export function formatArticlesForPrompt(articles: RSSArticle[], uiLanguage: "vi" | "en"): string {
  if (articles.length === 0) return "";

  const header = uiLanguage === "vi"
    ? `Dưới đây là danh sách tin tức mới nhất tổng hợp từ nguồn RSS tự động:\n\n`
    : `Here is the aggregated news list from the registered RSS channels:\n\n`;

  const formatted = articles.map((art, index) => {
    const sourceLabel = art.feedTitle ? `[Nguồn: ${art.feedTitle}]` : "";
    return `Bài báo #${index + 1}: ${art.title} ${sourceLabel}
Ngày đăng: ${art.pubDate || "N/A"}
Nội dung: ${art.content || "N/A"}
Liên kết: ${art.link}
---`;
  }).join("\n\n");

  return header + formatted;
}
