# CommuteCast 3.0: AI Broadcast Studio
## Document 10: Audio Studio & Synthesizer Core

This document details the architecture, signal flow, and technical specifications of the **Audio Studio & Synthesizer Core** inside **CommuteCast 3.0 (AI Broadcast Studio)**. 

We are transitioning the audio engine from basic text-to-speech parameters (`Voice`, `Speed`, `Pitch`) into a professional-grade digital audio workstation (DAW) pipeline. The new framework introduces advanced vocal controls (Emotion, Breath, Pauses, Pronunciation) coupled with a dynamic client-side Web Audio mastering processor (EQ, Background Music Ducking, Limiting, and Loudness Normalization).

---

### 1. High-Fidelity Synthesizer Pipeline (The Mastering Desk)

The Audio Studio treats vocal synthesis as a multi-track audio engineering pipeline. The signal flow utilizes the native client-side browser **Web Audio API** to mix, shape, filter, and master the synthesized voice tracks combined with background music tracks.

```
 [ Host A Voice Track ] ──> [ Pitch/Speed ] ──> [ EQ Filter ] ───┐
                                                                 │
 [ Host B Voice Track ] ──> [ Pitch/Speed ] ──> [ EQ Filter ] ───┼─> [ Gain Normalizer ] ──> [ Compressor / Limiter ] ──> [ Audio Out ]
                                                                 │
 [ Background Music BGM] ─> [ Lowpass Filter ] ─> [ Ducking Gain ]┘
                               (Auto-Fade)
```

---

### 2. Vocal Synthesis & Performance Engineering

To produce speech indistinguishable from a live radio broadcast, we implement highly detailed synthesis directives:

#### A. Voice Casting & Multi-Speaker Mapping
*   Assign specific AI voices based on specialized domains or roles.
*   *Host A (Alex):* Deep, confident, warm masculine voice; optimized for technical breakdowns and hard news.
*   *Host B (Sophia):* Energetic, clear, friendly feminine voice; optimized for listener interaction and storytelling.
*   *Narrator (Marcus):* Highly professional, measured newscast delivery; optimized for summaries and segment introductions.

#### B. Emotion & Speech Style Directives
*   Uses high-tier Google Cloud TTS or Edge Neural styles to apply emotional postures:
    *   `Newscast`: Formal, authoritative cadence, standard professional spacing.
    *   `Cheerful / Excited`: Higher pitch modulation, fast tempo, expressive curve.
    *   `Empathetic / Warm`: Softer tones, rounded vowels, slower pacing.
    *   `Serious`: Deepened pitch register, deliberate syllable stresses.

#### C. Pause, Breath & Conversational Cadence
*   **Speech Break Markers:** The script parser reads precise timing markup (e.g. `<break time="750ms" />` or `<pause strength="strong" />`) to establish natural speech pauses between paragraphs or topic shifts.
*   **Physiological Breath Simulation:** Inserts subtle, quiet inhalation audio buffers at paragraph boundaries, preventing the unnatural "asphyxiated reading" typical of standard TTS engines.

#### D. Pronunciation Lexicons & Phonetic Overrides
*   Maintains a global phonetic dictionary (`/src/types/pronunciation.ts`) matching difficult tech acronyms, product brands, or foreign names to phonetic equivalents.
*   *Rule examples:*
    *   `Vite` ➔ `veet`
    *   `SQL` ➔ `sequel`
    *   `SaaS` ➔ `sass`
    *   `Nvidia` ➔ `en-vid-ee-ah`

---

### 3. Dynamic Web Audio Mastering Pipeline

The client-side playback system processes voice buffers and backing tracks through a custom Node Graph utilizing standard browser audio nodes:

#### A. Graphic Equalizer (EQ Node)
Implements a multi-band `BiquadFilterNode` configuration with presets:
*   *Warm Podcast:* Boosts lower mid-frequencies (200Hz - 400Hz) and softens harsh high frequencies to recreate "studio microphone" warmth.
*   *Crisp Presence:* Boosts mid-high frequencies (2kHz - 5kHz) to increase speech clarity for noisy commutes.
*   *Flat Vocal:* Raw unaltered pass-through for high-fidelity headphones.

#### B. Ambiance & Background Music (BGM Mix)
*   **Backing Audio Tracks:** Users can select different subtle, non-intrusive instrumental background tracks (e.g., "Lo-Fi Morning", "Ambient Tech Drone", "Corporate Chill").
*   **Automatic Ducking Engine:** Integrates a dynamic gain control node. When speech is active on a voice track, the background music gain automatically fades down (ducks) to **-18dB** (15% volume). When the voice stops (during breaks/pauses), the music swells back up to **-8dB** (40% volume) over a 400ms transition curve.

#### C. Fade & Crossfade Engine
*   Executes clean linear/exponential volume transitions:
    *   *Intro Fade-In:* 1.5-second fade-in on background music before the host speaks.
    *   *Segment Crossfade:* Music swells slightly during transitions, then ducks as the next speaker begins.
    *   *Outro Fade-Out:* 3-second gradual fade-out of background music at the end of the broadcast.

#### D. Dynamics Compressor & Limiter Node
*   Uses `DynamicsCompressorNode` to level audio volume:
    *   *Threshold:* `-18dB`
    *   *Knee:* `12`
    *   *Ratio:* `4` (standard broadcast compression ratio)
    *   *Attack:* `0.01s` (instantly catches loud vocal bursts)
    *   *Release:* `0.25s`
*   Acts as a brick-wall **Limiter** to prevent clip distortion and digital crackling when hosts talk loudly, protecting commuting drivers' speakers and eardrums.

#### E. Loudness Normalizer
*   Automates peak signal analysis on incoming vocal buffers. If Host A's voice chunk was synthesized quieter than Host B's chunk, the engine normalizes their volume peaks to a target `-14 LUFS` (Podcast loudness standard) prior to output.

---

### 4. Technical Configuration Schema

```typescript
interface AudioStudioSettings {
  masterVolume: number; // 0.0 to 1.0
  voiceEQPreset: "warm_podcast" | "crisp_presence" | "flat";
  compressionEnabled: boolean;
  normalizationTargetLoudness: number; // e.g. -14 LUFS
  bgm: {
    enabled: boolean;
    trackId: string;
    mixVolume: number; // 0.0 to 1.0
    duckingAttenuation: number; // e.g. -18dB when voice active
    fadeDurationMs: number; // e.g. 400ms transition
  };
  vocalDirectives: {
    pacingMultiplier: number; // e.g., 1.05
    breathLevel: "none" | "subtle" | "natural";
    autoCorrectPronunciation: boolean;
  };
}
```
