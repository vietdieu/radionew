# CommuteCast 3.0: AI Broadcast Studio
## Document 09: Script Editor Specification

This document details the specifications, user experience design, and technical structure of the **Script Editor** inside **CommuteCast 3.0 (AI Broadcast Studio)**. This component acts as the "Notion of Audio Writing"—an interactive, block-structured, highly intuitive text processor tailored specifically for speech pacing, multi-host dialogues, and real-time AI collaborations.

---

### 1. The Core Paradigm: Notion-Like Audio Blocks

Unlike generic, flat text editors, the CommuteCast 3.0 Script Editor manages content as **structured audio blocks**. Each block belongs to a specific speaker (e.g., Host A, Host B, Guest) and contains custom speech metadata.

```
 +-----------------------------------------------------------------------------------+
 |  SCRIPT EDITOR  |  [Undo] [Redo]  | [AI Command Bar: Ctrl + Space]   [Version Hist] |
 |-----------------+-----------------------------------------------------------------|
 |                                                                                   |
 |  [Host A]  "Welcome back to your morning brief. Today, OpenAI released its       |
 |             new paradigm-shifting model. What are your thoughts on this, Sophia?" |
 |             +------------------------------------------------------------------+  |
 |             |  AI Rewrite Selection: [Make More Conversational] [Shorten] [Tr] |  |
 |             +------------------------------------------------------------------+  |
 |                                                                                   |
 |  [Host B]  "It's fascinating, Alex. The benchmarks are showing a significant     |
 |             jump in multi-step reasoning capabilities, especially in math."      |
 |                                                                                   |
 |  [Narrator] "Moving on to science, researchers have discovered a new deep-sea    |
 |              ecosystem off the coast of South America..."                         |
 +-----------------------------------------------------------------------------------+
```

---

### 2. Key Functional Capabilities

#### A. Structured State Engine (Undo, Redo & Time Travel)
*   **Action History Stack:** Tracks all content modifications, speaker changes, chapter splits, and deletions.
*   **Granular History Tracking:** Keeps a bidirectional history pointer allowing instant `Undo` (Cmd/Ctrl + Z) and `Redo` (Cmd/Ctrl + Shift + Z) transitions.
*   **Crash Recovery Autosave:** Saves the editor's state to IndexedDB every 5 seconds to ensure zero data loss in case of unexpected browser refreshes.

#### B. Dynamic Version Control & Comparisons (Diff Engine)
*   **Revision History Logs:** Every major AI generation or manual milestone session creates a persistent commit version.
*   **Side-by-Side Diff Visualizer:** Displays changes between versions (e.g., comparing the raw AI draft with the human-edited script), highlighting added speech text in green, modified cues in orange, and deleted lines in red.

#### C. Embedded AI Assistant (Inline Command Palette)
*   **Trigger Action:** Highlighting any block or pressing `Ctrl + Space` launches a contextual AI Command Bar.
*   **Block Tools:**
    *   *AI Rewrite:* Refactor the selected paragraph to match a new tone (e.g., "Add professional banter", "Explain this to a child", "Make it sound dramatic").
    *   *Shorten / Expand:* Intelligently adjust text density to fit specific commute duration targets.
    *   *Phonetic Spelling Generator:* Generates phonetically simple text replacements for hard-to-pronounce names or words (e.g., *Nvidia* ➔ *en-vid-ee-ah*).

#### D. Grammar, Cadence & Syntax Checkers
*   **Speech-Optimized Grammar Check:** Flags overly complex, long sentences that are difficult for voice models or human narrators to read without breaking. Proposes splitting them into natural, conversational, punchy sentences.
*   **Vocal Cadence Profiler:** Warns when paragraphs are too dense, lack rhythm, or repeat words that make synthetic speech sound robotic.

#### E. Translation & Speech-Level Localization
*   **Target Translation:** Easily translate individual chapters or the entire script into other languages.
*   **Localization Tone Matcher:** Converts text from literal written prose style (typical in RSS articles) into natural, rhythmic spoken phrases tailored specifically for audio broadcasts.

---

### 3. State Management Schematics

The state of the Script Editor is governed by an immutable block tree to maintain robust undo/redo capabilities:

```typescript
interface EditorialBlock {
  id: string;
  speakerId: string;
  text: string;
  prompterCue?: {
    speed?: number; // Pitch/tempo adjustments
    pacing?: "fast" | "normal" | "slow";
    emphasis?: string[]; // Words to emphasize
  };
}

interface EditorState {
  history: {
    past: EditorialBlock[][];
    present: EditorialBlock[];
    future: EditorialBlock[][];
  };
  activeVersionId: string;
  isDirty: boolean;
}
```
