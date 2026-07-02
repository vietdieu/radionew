# CommuteCast 3.0: AI Broadcast Studio
## Document 08: AI Studio & Copilot Core

This document details the architecture, capabilities, and system specifications for the **AI Studio & Copilot Core** inside **CommuteCast 3.0 (AI Broadcast Studio)**. This module serves as the primary cognitive engine, turning unstructured text from diverse RSS feeds into engaging, highly professional audio scripts.

---

### 1. Conceptual Framework: The AI Copilot

The AI Studio does not just summarize text; it acts as a **Creative Producer**. It understands narrative arcs, conversational flow, transitions, and phonetic pacing. It adapts its writing style to the configured hosts, applies branding or user rules from memory, and validates facts before compiling the final broadcast script.

```
                  ┌──────────────────────────────┐
                  │ Raw Ingested Articles & Notes│
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │   AI Studio Cognitive Hub    │
                  │                              │
                  │  * Topic & Sentiment Detect  │
                  │  * Deduplication & Filter    │
                  │  * AI Memory (User Context)  │
                  │  * Prompt Library Templates  │
                  └──────────────┬───────────────┘
                                 │ (Gemini API Orchestration)
                                 ▼
                  ┌──────────────────────────────┐
                  │ Structured Broadcast Script │
                  │     (JSON/XML Speaker Turns) │
                  └──────────────┬───────────────┘
                                 │
                                 ▼
                  ┌──────────────────────────────┐
                  │     Refinements Engine       │
                  │ (Rewrite, Fact-Check, Trans) │
                  └──────────────────────────────┘
```

---

### 2. Core Functional Modules

#### A. AI Recommendations & Suggestion Engine
*   **Daily Editorial Curation:** Suggests which articles from the user's collections would pair well together for a thematic broadcast (e.g., "AI Advancements", "Global Markets Update").
*   **Dynamic Title & Hook Generator:** Automatically proposes engaging, punchy titles and intro hooks based on the day's top headlines to capture listener attention.

#### B. Prompt Library
*   **Segment Templates:** A curated registry of pre-built system prompts that shape the output's format, style, and structure:
    *   *The Morning Coffee:* Lighthearted dual-host banter, friendly tone, focus on high-level takeaways.
    *   *The Executive Brief:* Concise, fast-paced, high density of facts, formal single narrator.
    *   *The Tech Breakdown:* Deep dive into technical specifications, monospaced style, clear explanations of jargon.
    *   *The Investigative Report:* Serious, dramatic pacing, deep contextual backing, investigative tone.
*   **Custom Prompt Builder:** Allows advanced producers to create, edit, save, and test their own custom system instructions.

#### C. AI Memory & Context Persistence
*   **Brand Voice Registry:** Remembers the user's preferred broadcast guidelines (e.g., "Always explain acronyms", "Do not mention celebrity gossip", "Focus on practical implications of science news").
*   **Phonetic Memory:** Keeps a local vocabulary dictionary mapping difficult terms or names to their phonetically spelled pronunciations (e.g., *Vite* ➔ *veet*, *Supabase* ➔ *soo-pah-bays*) to feed into the TTS pipeline.
*   **Commuter Profiles:** Remembers the listener's preferences, commute duration, and professional interests to prioritize relevant feed categories during automatic preparation.

#### D. Prompt History & Version Control
*   **Generation Logging:** Maintains a full database log of past generations, system prompts used, and manual script adjustments.
*   **One-Click Rollbacks:** Allows producers to revert to previous drafts of a script if a rewrite attempt goes off track.

#### E. Translation & Localization
*   **Multilingual Scripting:** Supports translating raw foreign-language articles into a unified target broadcast language (e.g., translating English newsletters into a highly natural Vietnamese broadcast script).
*   **Colloquial Localization:** Converts literal translations into culturally natural conversational phrases suitable for verbal podcast formats rather than textbook reading.

#### F. Fact Check & Source Grounding
*   **Cross-Source Verification:** Flags conflicting claims between articles reporting on the same story (e.g., Reuters claims 100 casualties while AP claims 50).
*   **AI Credibility Warning:** Places contextual warning markers inside the editor for unverified sources or sensationalized headlines, prompting the editor to adjust the tone to "cautious" or "skeptical".

#### G. Semantic Diagnostics: Topic, Duplicate & Sentiment Detection
*   **Topic Classification:** Automatically labels input articles with primary and secondary topic tags.
*   **Multi-Source Deduplication:** Clusters articles with high overlap, extracting unique details from each source to build a singular, rich paragraph instead of repeating headlines.
*   **Sentiment Modulation:** Gauges the mood of a story (e.g., tragic, celebratory, neutral) and inserts metadata markers so the voice synthesizer can adjust its emotional tone accordingly (e.g., reading a market crash with a serious tone, or tech achievements with an excited voice).

---

### 3. Unified Script Payload Specification

To hand off successfully to the **Script Editor** (Stage 3) and **Audio Studio** (Stage 4), the AI Studio outputs a strictly validated JSON structure:

```typescript
interface BroadcastScript {
  meta: {
    title: string;
    targetDurationSeconds: number;
    toneProfile: "morning_coffee" | "executive_brief" | "tech_deepdive" | "investigative";
    primaryLanguage: string;
  };
  chapters: Array<{
    id: string;
    title: string;
    topic: string;
    sentiment: "excited" | "serious" | "neutral" | "concerned";
    segments: Array<{
      id: string;
      speakerId: "host_a" | "host_b" | "guest" | "narrator";
      text: string; // The literal speech text
      prompterCue?: string; // e.g., "pacing: slow", "emphasis: high"
      sourceReferences?: string[]; // IDs of source articles
    }>;
  }>;
}
```
