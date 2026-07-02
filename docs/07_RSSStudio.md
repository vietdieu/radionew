# CommuteCast 3.0: AI Broadcast Studio
## Document 07: RSS Studio Specification

This document details the specifications and functional requirements for the **RSS Studio** module, the primary ingestion layer of the **AI Broadcast Studio**. This module handles robust data harvesting, dynamic taxonomy categorization, duplicate elimination, smart semantic filtering, and real-time feed previews.

---

### 1. Ingestion Engine Architecture

The RSS Studio acts as an intelligent aggregator capable of fetching, parsing, normalising, and transforming standard XML-based syndicate content (Atom, RSS 1.0, RSS 2.0) into normalized, clean JSON structures.

```
 [ Feed Sources: Tech, News, Personal ]
                   │
                   ▼
       [ Express Backend Proxy ]  ──────> [ Read-ability Parser (Extract Body Text) ]
                   │
                   ▼
    [ AI Semantic Clustering Layer ] ───> [ Deduplication & Smart Filters ]
                   │
                   ▼
    [ Structured Feeds & Live Preview ]
```

---

### 2. Core Modules & Features

#### A. RSS Feed Manager
*   **Source Configuration:** Users can add, delete, rename, and toggle feeds. Supports bulk import/export via standard OPML files.
*   **Rate Limits & Error Handling:** Configures intelligent fallback states and custom HTTP user-agents to prevent source bans or connection timeouts.
*   **Status Tracking:** Displays health statuses of feeds (Last Synced, Active, Broken/SSL Error, Slow connection).

#### B. Categories & Collections Taxonomy
*   **Default Categories:** Pre-seeded categories including *Technology*, *Business/Finance*, *World News*, *Science/Health*, and *Sports*.
*   **Custom Collections:** Allows producers to bundle distinct, cross-category feeds into custom collections (e.g., "Commute Briefing Collection" or "Weekly Tech Deep Dive").
*   **Dynamic Hierarchy:** Feeds can belong to multiple Collections, giving producers absolute flexibility during compilation curation.

#### C. Smart Filter & Deduplication Core
*   **Semantic Clustering:** Recognizes highly similar articles reporting on the exact same event across different outlets (e.g., Reuters, TechCrunch, Verge all reporting on a new model release).
*   **Deduplication Rules:** Filters out duplicates based on:
    1.  *Title Jaccard Similarity index* (Threshold: > 0.75 similarity).
    2.  *AI Topic Clustering* (Grouping articles covering the same sub-topic within a 24-hour window).
    3.  *User-defined priority:* Pick the primary source first (e.g., prioritize original source, fallback to secondary aggregator).
*   **Keyword Exclusions:** Regex-based filters to skip unwanted keywords (e.g., skip articles with "sponsored", "ad", "giveaway", "roundup").

#### D. AI Brief Summarization & Content Extraction
*   **Readability extraction:** Strips out navigation bars, side elements, cookie warnings, scripts, and promotional footers to retrieve clean, raw markdown text.
*   **Mini AI Summary:** Generates quick, single-paragraph key takeaways of each article directly inside the selection pane. Enables producers to quickly understand the article's importance without reading the full text.

---

### 3. User Interface Layout

```
+-----------------------------------------------------------------------------------+
|  RSS STUDIO  |  [Add New Feed Input + Import OPML]                [Smart Filter: ON] |
|--------------+--------------------------------------------------------------------|
|  [Collections]       | [Ingestion Feed Grid: Filtered & Sorted]                    |
|  * Tech (3 feeds)    | +--------------------------------------------------------+ |
|  * Finance (2 feeds) | | [x] Apple Releases New Silicon Chips  -  TechCrunch    | |
|  * Daily Brief (5)   | |     "Apple introduces new high-efficiency processing..."| |
|  * Draft Collection  | |     [AI Summary: 3nm architecture, 20% speed boost]    | |
|                      | +--------------------------------------------------------+ |
|  [Manage Feeds]      | | [ ] Apple Unveils New M4 Processors -  The Verge       | |
|  - Wired [Active]    | |     [!] DUPLICATE DETECTED - Hidden automatically      | |
|  - HackerNews [Slow] | +--------------------------------------------------------+ |
|  - Substack [Error]  | | [x] Local Temperature Anomalies     -  Weather Feed   | |
|                      | |     "Today's peak is forecasted to hit record highs..."| |
+-----------------------------------------------------------------------------------+
```

---

### 4. Technical Constraints & APIs

1.  **Proxy Server Enforcements:** Direct client-side calls to external RSS feeds violate CORS. All feeds MUST pass through the local `/api/rss` backend controller.
2.  **Payload Schema:**
    ```typescript
    interface FeedItem {
      id: string;
      title: string;
      link: string;
      pubDate: string;
      creator: string;
      contentSnippet: string;
      fullText: string;
      category: string;
      isDuplicate: boolean;
      originalSourceId?: string;
      aiSummary?: string;
    }
    ```
