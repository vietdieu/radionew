import { getRSSFeeds } from "./storageService";
import { fetchRSSArticles } from "./rssService";
import { RSSArticle } from "../types";

const AUTO_CHECK_KEY = "commute_cast_last_rss_check";
const CHECK_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours

export interface AutoBriefingCheckResult {
  shouldGenerate: boolean;
  newArticles: RSSArticle[];
}

/**
 * Checks if there are any configured RSS feeds and if the cooldown period of 6 hours has elapsed.
 * If yes, fetches latest articles and flags that an auto-briefing can be generated.
 */
export async function checkForNewRSSArticles(
  getApiUrl: (path: string) => string,
  forceCheck = false
): Promise<AutoBriefingCheckResult> {
  try {
    const feeds = await getRSSFeeds();
    if (!feeds || feeds.length === 0) {
      return { shouldGenerate: false, newArticles: [] };
    }

    const lastCheck = localStorage.getItem(AUTO_CHECK_KEY);
    const now = Date.now();

    // Check cooldown unless forced
    if (!forceCheck && lastCheck && now - parseInt(lastCheck) < CHECK_INTERVAL) {
      return { shouldGenerate: false, newArticles: [] };
    }

    // Fetch fresh articles
    const articles = await fetchRSSArticles(feeds, getApiUrl);
    if (!articles || articles.length === 0) {
      // Still update checked timestamp to avoid continuous retries on empty feeds
      localStorage.setItem(AUTO_CHECK_KEY, now.toString());
      return { shouldGenerate: false, newArticles: [] };
    }

    // Save timestamp of successful check
    localStorage.setItem(AUTO_CHECK_KEY, now.toString());
    return { shouldGenerate: true, newArticles: articles.slice(0, 12) }; // Limit to top 12 articles
  } catch (err) {
    console.warn("Failed to check for auto RSS articles:", err);
    return { shouldGenerate: false, newArticles: [] };
  }
}

/**
 * Set up a periodic background timer that runs checking logic every 6 hours or similar.
 */
export function setupBackgroundRSSCheck(
  getApiUrl: (path: string) => string,
  onNewBriefingReady: (articles: RSSArticle[]) => void
): () => void {
  
  // CHIẾN LƯỢC: Ngay khi người dùng mở điện thoại truy cập vào trang web vào buổi sáng
  // Hệ thống sẽ kiểm tra xem hôm nay đã dệt bản tin mới chưa, nếu chưa sẽ tự động kích hoạt ngay lập tức.
  setTimeout(async () => {
    const res = await checkForNewRSSArticles(getApiUrl);
    if (res.shouldGenerate && res.newArticles.length > 0) {
      onNewBriefingReady(res.newArticles);
    }
  }, 1000); 

  // Giữ nguyên interval cũ để phục vụ người dùng treo tab trên máy tính đi làm
  const intervalId = setInterval(async () => {
    const res = await checkForNewRSSArticles(getApiUrl);
    if (res.shouldGenerate && res.newArticles.length > 0) {
      onNewBriefingReady(res.newArticles);
    }
  }, 30 * 60 * 1000);

  return () => clearInterval(intervalId);
}
