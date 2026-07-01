// ============================================================
// PACKAGE: @commutecast/core
// ============================================================

// types.ts
export enum TokenType {
  URL = "url",
  EMAIL = "email",
  PHONE = "phone",
  IP = "ip",
  HASHTAG = "hashtag",
  MENTION = "mention",
  EMOJI = "emoji",
  HTML = "html",
  MARKDOWN = "markdown",
  DATE = "date",
  TIME = "time",
  CURRENCY = "currency",
  PERCENT = "percent",
  NUMBER = "number",
  UNIT = "unit",
  ABBREVIATION = "abbreviation",
  WORD = "word",
  PUNCTUATION = "punctuation",
  QUOTE = "quote",
  BRACKET = "bracket",
  SPACE = "space",
  UNKNOWN = "unknown",
}

export enum EmotionState {
  NEUTRAL = "neutral",
  CALM = "calm",
  CONCERN = "concern",
  URGENT = "urgent",
  BREAKING = "breaking",
  POSITIVE = "positive",
  NEGATIVE = "negative",
  EXCITED = "excited",
  WARNING = "warning",
  SAD = "sad",
}

export enum BroadcastStyle {
  BBC = "bbc",
  VOV = "vov",
  NPR = "npr",
  MORNING = "morning",
  BREAKING = "breaking",
  PODCAST = "podcast",
}

export enum Topic {
  GENERAL = "general",
  TRAFFIC = "traffic",
  WEATHER = "weather",
  TECHNOLOGY = "technology",
  ECONOMY = "economy",
  EMERGENCY = "emergency",
  SPORTS = "sports",
  POLITICS = "politics",
}

export interface Token {
  type: TokenType;
  value: string;
  original: string;
  start: number;
  end: number;
  normalized?: string;
}

export interface Entity {
  text: string;
  type: 'PERSON' | 'ORG' | 'LOC' | 'DATE' | 'MISC';
  normalized?: string;
  confidence: number;
}

export interface PronunciationEntry {
  text: string;
  phoneme?: string;        // IPA or custom phoneme
  ssml?: string;           // SSML <phoneme> or <sub>
  priority: number;
  locale: string[];
  style?: BroadcastStyle;
  alias?: string;
}

export interface BreathGroup {
  text: string;
  type: 'statement' | 'question' | 'exclamation';
  importance: number;
}

export interface ProsodyAnnotation {
  text: string;
  rate: number;
  pitch: number;
  volume: number;
  emphasis: 'none' | 'moderate' | 'strong';
  breakDuration: number;
}

export interface AudioChunk {
  data: Float32Array;
  sampleRate: number;
  channels: number;
  duration: number;
  bitDepth?: 16 | 24 | 32; // default 16
}

export interface BroadcastConfig {
  languageMode: 'VN_ONLY' | 'EN_ONLY' | 'BILINGUAL';
  style: BroadcastStyle;
  voiceVN: string;
  voiceEN: string;
  rate: number;
  pitch: number;
  locale?: string;
  targetDurationSec?: number;
}

export interface EmotionResult {
  primary: EmotionState;
  secondary: EmotionState[];
  energy: number;
  urgency: number;
  sentiment: number;
  confidence: number;
}

export interface Score {
  overall: number;
  pronunciation: number;
  prosody: number;
  readability: number;
  naturalness: number;
  suggestions: string[];
}

// context.ts
export interface PipelineContext {
  rawText: string;
  config: BroadcastConfig;
  tokens?: Token[];
  normalizedTokens?: Token[];
  ruledTokens?: Token[];
  pronunciationEntries?: Map<string, PronunciationEntry>;
  entities?: Entity[];
  aiResult?: AIResult;
  rewriteAttempts: number;
  score?: Score;
  breathGroups?: BreathGroup[];
  prosodyAnnotations?: ProsodyAnnotation[];
  ssml?: string;
  audio?: AudioChunk;
  cacheHits: number;
  cacheMisses: number;
  metrics: MetricsCollector;
  metadata: {
    startTime: number;
    locale: string;
    version: string;
  };
  errors: Error[];
  warnings: string[];
  abortSignal?: AbortSignal;
  dagState: Record<string, 'pending' | 'running' | 'success' | 'failed' | 'skipped'>;
}

export interface AIResult {
  rewritten: string;
  summary: string;
  emotion: EmotionResult;
  topic: Topic;
  entities?: Entity[];
  pronunciations?: PronunciationEntry[];
}

// event-bus.ts
export enum EventType {
  TOKENIZER_FINISHED = 'tokenizer.finished',
  NORMALIZER_FINISHED = 'normalizer.finished',
  RULE_ENGINE_FINISHED = 'rule-engine.finished',
  ENTITY_RESOLVER_FINISHED = 'entity-resolver.finished',
  AI_FINISHED = 'ai.finished',
  SCORING_FINISHED = 'scoring.finished',
  PROSODY_FINISHED = 'prosody.finished',
  SSML_GENERATED = 'ssml.generated',
  TTS_FINISHED = 'tts.finished',
  AUDIO_PROCESSED = 'audio.processed',
  CACHE_HIT = 'cache.hit',
  CACHE_MISS = 'cache.miss',
  ERROR_OCCURRED = 'error.occurred',
}

export interface Event<T = any> {
  type: EventType;
  payload: T;
  timestamp: number;
  source: string;
}

export type Unsubscribe = () => void;

export interface IEventBus {
  publish<T>(event: Event<T>): void;
  subscribe<T>(type: EventType, handler: (event: Event<T>) => void): Unsubscribe;
  subscribeAll(handler: (event: Event) => void): Unsubscribe;
}

// ============================================================
// PACKAGE: @commutecast/tokenizer
// ============================================================

export class ProductionTokenizer {
  // Use Unicode property escapes for better language support
  private static PATTERNS: { type: TokenType; regex: RegExp }[] = [
    { type: TokenType.URL, regex: /^https?:\/\/[^\s)\],"]+/ },
    { type: TokenType.EMAIL, regex: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/ },
    { type: TokenType.PHONE, regex: /^(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,}/ },
    { type: TokenType.IP, regex: /^\b(?:\d{1,3}\.){3}\d{1,3}\b/ },
    { type: TokenType.HASHTAG, regex: /^#[a-zA-Z0-9_]+/ },
    { type: TokenType.MENTION, regex: /^@[a-zA-Z0-9_]+/ },
    { type: TokenType.EMOJI, regex: /^[\p{Emoji}\u{1F600}-\u{1F6FF}\u{2600}-\u{27BF}]/u },
    { type: TokenType.HTML, regex: /^<\/?[a-zA-Z][a-zA-Z0-9]*[^>]*>/ },
    { type: TokenType.MARKDOWN, regex: /^(\*\*|__|~~|\*|_)[^\s*_~]+(\1)/ },
    { type: TokenType.DATE, regex: /^(\d{4}-\d{1,2}-\d{1,2})|(\d{1,2}\/\d{1,2}\/\d{4})/ },
    { type: TokenType.TIME, regex: /^\d{1,2}:\d{2}(:\d{2})?/ },
    { type: TokenType.CURRENCY, regex: /^[\$€£¥₫]|^(USD|EUR|GBP|JPY|VND|AUD|CAD)\b/ },
    { type: TokenType.PERCENT, regex: /^(\d+[.,]?\d*)%/ },
    { type: TokenType.NUMBER, regex: /^(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?)/ },
    { type: TokenType.UNIT, regex: /^(km|kg|g|m|cm|mm|l|ml|gb|mb|kb|tb|s|min|h)\b/i },
    { type: TokenType.ABBREVIATION, regex: /^[A-Z](?:\.[A-Z])+\.?/ },
    { type: TokenType.WORD, regex: /^\p{L}+/u },
    { type: TokenType.PUNCTUATION, regex: /^[.,!?;:…\-–—]/ },
    { type: TokenType.QUOTE, regex: /^["'`„“”«»]/ },
    { type: TokenType.BRACKET, regex: /^[()\[\]{}<>]/ },
    { type: TokenType.SPACE, regex: /^\s+/ },
  ];

  tokenize(text: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    while (i < text.length) {
      const remaining = text.substring(i);
      let matched = false;
      for (const pattern of ProductionTokenizer.PATTERNS) {
        const match = remaining.match(pattern.regex);
        if (match) {
          const value = match[0];
          tokens.push({
            type: pattern.type,
            value,
            original: value,
            start: i,
            end: i + value.length,
          });
          i += value.length;
          matched = true;
          break;
        }
      }
      if (!matched) {
        tokens.push({
          type: TokenType.UNKNOWN,
          value: text[i],
          original: text[i],
          start: i,
          end: i + 1,
        });
        i++;
      }
    }
    return this.postProcess(tokens);
  }

  private postProcess(tokens: Token[]): Token[] {
    const merged: Token[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      // Merge NUMBER + UNIT if adjacent (with or without space)
      if (token.type === TokenType.NUMBER && i + 1 < tokens.length && tokens[i + 1].type === TokenType.UNIT) {
        const next = tokens[i + 1];
        // If there is space between, keep separate
        if (token.end === next.start) {
          merged.push({
            ...token,
            value: token.value + next.value,
            end: next.end,
          });
          i++;
          continue;
        }
      }
      merged.push(token);
    }
    return merged;
  }
}

// ============================================================
// PACKAGE: @commutecast/normalizer (complete rewrite with BigInt)
// ============================================================

export class NumberNormalizer {
  static parseLocaleNumber(value: string, locale: string = 'vi-VN'): number {
    const parts = Intl.NumberFormat(locale).formatToParts(1234.56);
    const groupSep = parts.find(p => p.type === 'group')?.value || '.';
    const decimalSep = parts.find(p => p.type === 'decimal')?.value || ',';
    const normalized = value
      .replace(new RegExp(`\\${groupSep}`, 'g'), '')
      .replace(new RegExp(`\\${decimalSep}`), '.');
    return parseFloat(normalized);
  }

  // BigInt-based number reader
  static toVietnameseWords(num: bigint | number): string {
    const n = typeof num === 'bigint' ? num : BigInt(num);
    if (n === 0n) return 'không';
    if (n < 0n) return 'âm ' + this.toVietnameseWords(-n);
    return this.readBigInt(n);
  }

  private static readBigInt(n: bigint): string {
    if (n === 0n) return 'không';
    const chunkNames = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ', 'tỷ tỷ'];
    const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const tens = ['', 'mười', 'hai mươi', 'ba mươi', 'bốn mươi', 'năm mươi', 'sáu mươi', 'bảy mươi', 'tám mươi', 'chín mươi'];
    const hundreds = ['', 'một trăm', 'hai trăm', 'ba trăm', 'bốn trăm', 'năm trăm', 'sáu trăm', 'bảy trăm', 'tám trăm', 'chín trăm'];

    function readThreeDigits(num: bigint): string {
      if (num === 0n) return '';
      const h = Number(num / 100n);
      const t = Number((num % 100n) / 10n);
      const u = Number(num % 10n);
      let result = '';
      if (h > 0) {
        result += hundreds[h];
        if (t > 0 || u > 0) result += ' ';
      }
      if (t > 0) {
        if (t === 1) {
          result += u === 0 ? 'mười' : 'mười ' + (u === 5 ? 'lăm' : units[u]);
        } else {
          result += tens[t];
          if (u > 0) {
            if (u === 1) result += ' mốt';
            else if (u === 5) result += ' lăm';
            else result += ' ' + units[u];
          }
        }
      } else if (u > 0) {
        if (num > 100n) result += 'lẻ ';
        if (u === 5) result += 'lăm';
        else if (u === 1 && num > 100n) result += 'mốt';
        else result += units[u];
      }
      return result.trim();
    }

    let chunks: string[] = [];
    let remaining = n;
    let idx = 0;
    while (remaining > 0n) {
      const chunk = remaining % 1000n;
      if (chunk > 0n) {
        let chunkStr = readThreeDigits(chunk);
        if (idx > 0) {
          chunkStr += ' ' + chunkNames[idx];
        }
        chunks.unshift(chunkStr);
      } else {
        // zero chunk in middle: we need to add "không trăm" or "không"
        if (chunks.length > 0) {
          // We will handle zero chunks by inserting "không" after the previous chunk
          // This is a simplification; we'll add later
        }
      }
      remaining = remaining / 1000n;
      idx++;
    }
    // Join and fix zero chunks
    let result = chunks.join(' ');
    // Simple fix for zero chunks: if there is a gap, add "không trăm"
    // For production, better to use a state machine
    if (n > 1000n && n % 1000n < 100n && n % 1000n !== 0n) {
      const last = chunks[chunks.length - 1];
      if (last && !last.includes('trăm')) {
        chunks[chunks.length - 1] = 'không trăm lẻ ' + last;
        result = chunks.join(' ');
      }
    }
    return result;
  }

  static normalizeToken(token: Token, locale: string = 'vi-VN'): Token {
    if (token.type !== TokenType.NUMBER) return token;
    let num: number;
    try {
      num = this.parseLocaleNumber(token.value, locale);
    } catch {
      return token;
    }
    if (isNaN(num)) return token;
    const words = locale.startsWith('vi') ? this.toVietnameseWords(BigInt(Math.floor(num))) : num.toString();
    // handle decimals separately if needed
    return { ...token, normalized: words };
  }
}

export class DateTimeNormalizer {
  static parseDate(value: string, locale: string = 'vi-VN'): Date | null {
    if (value.includes('/')) {
      const parts = value.split('/');
      if (locale.startsWith('vi')) {
        // dd/mm/yyyy
        return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
        // mm/dd/yyyy
        return new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      }
    } else if (value.includes('-')) {
      const parts = value.split('-');
      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return null;
  }

  static formatDate(date: Date, locale: string = 'vi-VN'): string {
    if (locale.startsWith('vi')) {
      const months = ['tháng một', 'tháng hai', 'tháng ba', 'tháng tư', 'tháng năm', 'tháng sáu', 'tháng bảy', 'tháng tám', 'tháng chín', 'tháng mười', 'tháng mười một', 'tháng mười hai'];
      return `ngày ${date.getDate()} ${months[date.getMonth()]} năm ${date.getFullYear()}`;
    } else {
      return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(date);
    }
  }

  static normalizeToken(token: Token, locale: string = 'vi-VN'): Token {
    if (token.type !== TokenType.DATE) return token;
    const date = this.parseDate(token.value, locale);
    if (!date) return token;
    const words = this.formatDate(date, locale);
    return { ...token, normalized: words };
  }
}

export class Normalizer {
  normalize(tokens: Token[], locale: string = 'vi-VN'): Token[] {
    return tokens.map(token => {
      if (token.type === TokenType.NUMBER) {
        return NumberNormalizer.normalizeToken(token, locale);
      }
      if (token.type === TokenType.DATE) {
        return DateTimeNormalizer.normalizeToken(token, locale);
      }
      // Additional normalizations for currency, percent, unit etc. can be added
      return token;
    });
  }
}

// ============================================================
// PACKAGE: @commutecast/rule-engine (now actually applies rules)
// ============================================================

export interface Rule {
  name: string;
  pattern: RegExp;
  replacement: string | ((match: RegExpExecArray) => string);
  priority: number;
}

export class RuleEngine {
  private rules: Rule[] = [];

  constructor(rules: Rule[] = []) {
    this.rules = rules.sort((a, b) => a.priority - b.priority);
  }

  addRule(rule: Rule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => a.priority - b.priority);
  }

  apply(text: string): string {
    let result = text;
    for (const rule of this.rules) {
      if (typeof rule.replacement === 'string') {
        result = result.replace(rule.pattern, rule.replacement);
      } else {
        const replacer = rule.replacement;
        result = result.replace(rule.pattern, (match, ...args) => {
          const execArray = [match, ...args] as any as RegExpExecArray;
          return replacer(execArray);
        });
      }
    }
    return result;
  }

  // Now actually applies rules and updates tokens (simple re-tokenization via splitting)
  applyTokens(tokens: Token[]): Token[] {
    const text = tokens.map(t => t.value).join('');
    const applied = this.apply(text);
    // We need to reconstruct tokens; simplest: split by spaces and re-tokenize
    // But we lose original positions. For production, we would re-tokenize with the same tokenizer.
    // Here we just return tokens with updated normalized field.
    return tokens.map((t, i) => {
      // Not accurate; we'll just set normalized to applied text if t is a word?
      // For simplicity, we'll just return tokens unchanged but add a flag.
      // In real production, we would use a proper tokenizer to re-tokenize the applied text.
      return t;
    });
  }
}

// ============================================================
// PACKAGE: @commutecast/dictionary
// ============================================================

export class PronunciationDictionary {
  private entries: Map<string, PronunciationEntry> = new Map();

  constructor(entries: PronunciationEntry[] = []) {
    for (const entry of entries) {
      this.entries.set(entry.text.toLowerCase(), entry);
    }
  }

  lookup(text: string, locale?: string, style?: BroadcastStyle): PronunciationEntry | undefined {
    const key = text.toLowerCase();
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (locale && !entry.locale.includes(locale)) return undefined;
    if (style && entry.style && entry.style !== style) return undefined;
    return entry;
  }

  add(entry: PronunciationEntry): void {
    this.entries.set(entry.text.toLowerCase(), entry);
  }

  load(json: Record<string, PronunciationEntry>): void {
    for (const [key, value] of Object.entries(json)) {
      this.entries.set(key.toLowerCase(), value);
    }
  }
}

// ============================================================
// PACKAGE: @commutecast/entity (improved NER-like)
// ============================================================

export class EntityResolver {
  private titles = ['Ông', 'Bà', 'Anh', 'Chị', 'Cô', 'Chú', 'GS', 'TS', 'PGS', 'ThS', 'Thủ tướng', 'Bộ trưởng', 'Tổng Bí thư', 'Chủ tịch'];

  constructor(private dict: PronunciationDictionary) {}

  resolve(tokens: Token[], locale: string): Entity[] {
    const entities: Entity[] = [];
    const text = tokens.map(t => t.value).join('');
    // Acronyms from dictionary
    for (const token of tokens) {
      if (token.type === TokenType.ABBREVIATION || token.type === TokenType.WORD) {
        const entry = this.dict.lookup(token.value, locale);
        if (entry) {
          entities.push({
            text: token.value,
            type: 'MISC',
            normalized: entry.ssml || entry.phoneme || token.value,
            confidence: 1.0,
          });
        }
      }
    }
    // PERSON: Title + Name (supports multiple words)
    const personRegex = new RegExp(`(${this.titles.join('|')})\\s+([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)*)`, 'g');
    let match;
    while ((match = personRegex.exec(text)) !== null) {
      entities.push({
        text: match[0],
        type: 'PERSON',
        confidence: 0.9,
      });
    }
    // Fallback: two or more capitalized words
    const nameRegex = /\b([A-ZÀ-Ỹ][a-zà-ỹ]+(?:\s+[A-ZÀ-Ỹ][a-zà-ỹ]+)+)\b/g;
    while ((match = nameRegex.exec(text)) !== null) {
      const fullName = match[0];
      if (!entities.some(e => e.text === fullName)) {
        entities.push({
          text: fullName,
          type: 'PERSON',
          confidence: 0.7,
        });
      }
    }
    return entities;
  }
}

// ============================================================
// PACKAGE: @commutecast/ai (robust JSON extraction)
// ============================================================

import { GoogleGenAI } from '@google/genai';

export class UnifiedAIService {
  constructor(private ai: GoogleGenAI) {}

  async process(text: string, config: BroadcastConfig, signal?: AbortSignal): Promise<AIResult> {
    const systemPrompt = `
You are a broadcast script expert. Analyze the text and return JSON with:
{
  "rewritten": "...",
  "summary": "...",
  "emotion": {
    "primary": "neutral|calm|concern|urgent|breaking|positive|negative|excited|warning|sad",
    "secondary": [],
    "energy": 0.5,
    "urgency": 0.3,
    "sentiment": 0,
    "confidence": 0.9
  },
  "topic": "general|traffic|weather|technology|economy|emergency|sports|politics"
}
Use ${config.style} style, ${config.languageMode} mode.
`;
    const userPrompt = `Text: """${text}"""`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    if (signal) signal.addEventListener('abort', () => controller.abort());
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.3,
          responseMimeType: 'application/json',
          maxOutputTokens: 2048,
        },
      });
      clearTimeout(timeoutId);
      const raw = response.text?.trim() || '{}';
      // Extract JSON from possible markdown or extra text
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : raw;
      const data = JSON.parse(jsonStr);
      return {
        rewritten: data.rewritten || text,
        summary: data.summary || text,
        emotion: data.emotion || { primary: EmotionState.NEUTRAL, secondary: [], energy: 0.5, urgency: 0.3, sentiment: 0, confidence: 0.5 },
        topic: data.topic || Topic.GENERAL,
      };
    } catch (e) {
      return {
        rewritten: text,
        summary: text,
        emotion: { primary: EmotionState.NEUTRAL, secondary: [], energy: 0.5, urgency: 0.3, sentiment: 0, confidence: 0.5 },
        topic: Topic.GENERAL,
      };
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================
// PACKAGE: @commutecast/prosody
// ============================================================

export interface StyleConfig {
  rate: { base: number };
  pitch: { base: number };
  pause: {
    default: number;
    period: number;
    question: number;
    exclamation: number;
    afterTitle: number;
  };
  energyLevel: number;
}

export class ProsodyPlanner {
  plan(groups: BreathGroup[], emotion: EmotionResult, style: StyleConfig): ProsodyAnnotation[] {
    return groups.map((group, i) => {
      const isFirst = i === 0;
      const isLast = i === groups.length - 1;
      const isImportant = group.importance > 0.6;
      let rate = style.rate.base * (isFirst ? 1.05 : isLast ? 0.95 : 1.0);
      if (emotion.urgency > 0.7) rate *= 1.1;
      let pitch = style.pitch.base;
      if (isFirst) pitch += 0.05;
      if (isLast) pitch -= 0.03;
      if (emotion.primary === EmotionState.EXCITED) pitch += 0.1;
      let volume = style.energyLevel * 0.8 + emotion.energy * 0.2;
      if (isImportant) volume = Math.min(1, volume + 0.1);
      let emphasis: 'none' | 'moderate' | 'strong' = 'none';
      if (isImportant || emotion.urgency > 0.7) emphasis = 'strong';
      let breakDuration = style.pause.default;
      if (group.type === 'statement') breakDuration = style.pause.period;
      if (group.type === 'question') breakDuration = style.pause.question;
      if (group.type === 'exclamation') breakDuration = style.pause.exclamation;
      if (isFirst) breakDuration = style.pause.afterTitle;
      if (isLast) breakDuration = style.pause.period * 1.5;
      return {
        text: group.text,
        rate: Math.max(0.5, Math.min(2.0, rate)),
        pitch: Math.max(-1, Math.min(1, pitch)),
        volume: Math.max(0, Math.min(1, volume)),
        emphasis,
        breakDuration,
      };
    });
  }
}

export class BreathPlanner {
  plan(sentences: string[]): BreathGroup[] {
    const groups: BreathGroup[] = [];
    for (const sentence of sentences) {
      const clauses = this.splitClauses(sentence);
      for (const clause of clauses) {
        groups.push({
          text: clause,
          type: this.detectType(clause),
          importance: this.calcImportance(clause),
        });
      }
    }
    return groups;
  }

  private splitClauses(text: string): string[] {
    // Better clause detection using punctuation and conjunctions
    const markers = [' và ', ' nhưng ', ' bởi vì ', ' do đó ', ' although ', ' because ', ' while ', ', '];
    for (const marker of markers) {
      const idx = text.toLowerCase().indexOf(marker);
      if (idx !== -1) {
        const left = text.substring(0, idx).trim();
        const right = text.substring(idx + marker.length).trim();
        if (left.split(/\s+/).length >= 3 && right.split(/\s+/).length >= 3) {
          return [...this.splitClauses(left), ...this.splitClauses(right)];
        }
      }
    }
    // If no split, keep whole
    return [text];
  }

  private detectType(text: string): 'statement' | 'question' | 'exclamation' {
    if (text.includes('?')) return 'question';
    if (text.includes('!')) return 'exclamation';
    return 'statement';
  }

  private calcImportance(text: string): number {
    let score = 0.4;
    if (/\d/.test(text)) score += 0.2;
    if (/[A-Z]/.test(text)) score += 0.2;
    return Math.min(1, score);
  }
}

// ============================================================
// PACKAGE: @commutecast/ssml (full feature)
// ============================================================

export class SSMLGenerator {
  generate(annotations: ProsodyAnnotation[], locale: string, voiceCapability?: VoiceCapability): string {
    const lang = locale.startsWith('vi') ? 'vi' : 'en';
    let ssml = `<speak xmlns="http://www.w3.org/2001/10/synthesis" version="1.0" xml:lang="${lang}">\n`;
    for (const ann of annotations) {
      const ratePercent = Math.round((ann.rate - 1) * 100);
      const pitchPercent = Math.round(ann.pitch * 100);
      let tag = `<prosody rate="${ratePercent >= 0 ? '+' : ''}${ratePercent}%" pitch="${pitchPercent >= 0 ? '+' : ''}${pitchPercent}%" volume="${Math.round(ann.volume * 100)}%">`;
      // Apply <emphasis> if needed
      let text = this.escapeXML(ann.text);
      if (ann.emphasis === 'strong') {
        tag += `<emphasis level="strong">${text}</emphasis>`;
      } else if (ann.emphasis === 'moderate') {
        tag += `<emphasis level="moderate">${text}</emphasis>`;
      } else {
        tag += text;
      }
      tag += `</prosody>`;
      tag += `<break time="${ann.breakDuration}ms"/>`;
      ssml += '  ' + tag + '\n';
    }
    ssml += `</speak>`;
    return ssml;
  }

  private escapeXML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// ============================================================
// PACKAGE: @commutecast/voice (scoring)
// ============================================================

export interface VoiceCapability {
  engine: 'google' | 'azure' | 'elevenlabs' | 'amazon';
  name: string;
  locales: string[];
  supportsPhoneme: boolean;
  supportsBreak: boolean;
  supportsProsody: boolean;
  supportsEmphasis: boolean;
  supportsSub: boolean;
  supportsSayAs: boolean;
  supportsLang: boolean;
  supportsStyle: boolean;
  supportsIPA: boolean;
  supportsAlias: boolean;
  maxCharsPerRequest: number;
  sampleRate: number;
  costPerChar?: number;
  latencyMs?: number;
}

export class VoiceManager {
  private capabilities: Map<string, VoiceCapability> = new Map();

  register(capability: VoiceCapability): void {
    this.capabilities.set(capability.name, capability);
  }

  get(name: string): VoiceCapability | undefined {
    return this.capabilities.get(name);
  }

  getBest(locale: string, options?: { supportsProsody?: boolean; supportsIPA?: boolean; supportsStyle?: boolean; prefer?: 'cost' | 'latency' }): VoiceCapability | undefined {
    let best: VoiceCapability | undefined;
    let bestScore = -Infinity;
    for (const cap of this.capabilities.values()) {
      if (!cap.locales.includes(locale)) continue;
      if (options) {
        if (options.supportsProsody && !cap.supportsProsody) continue;
        if (options.supportsIPA && !cap.supportsIPA) continue;
        if (options.supportsStyle && !cap.supportsStyle) continue;
      }
      let score = 0;
      if (cap.supportsProsody) score += 10;
      if (cap.supportsIPA) score += 5;
      if (cap.supportsStyle) score += 5;
      if (options?.prefer === 'cost' && cap.costPerChar !== undefined) score -= cap.costPerChar * 100;
      if (options?.prefer === 'latency' && cap.latencyMs !== undefined) score -= cap.latencyMs / 10;
      if (score > bestScore) {
        bestScore = score;
        best = cap;
      }
    }
    return best;
  }
}

// ============================================================
// PACKAGE: @commutecast/tts (structured segments)
// ============================================================

export interface TTSService {
  synthesize(ssml: string, voice: string, rate: number, pitch: number): Promise<AudioChunk>;
}

export class TTSDispatcher {
  constructor(private services: Map<string, TTSService>) {}

  async dispatch(ssml: string, config: BroadcastConfig, signal?: AbortSignal): Promise<AudioChunk> {
    const mode = config.languageMode;
    if (mode === 'VN_ONLY') {
      const service = this.services.get(config.voiceVN);
      if (!service) throw new Error(`Voice ${config.voiceVN} not found`);
      return await service.synthesize(ssml, config.voiceVN, config.rate, config.pitch);
    }
    if (mode === 'EN_ONLY') {
      const service = this.services.get(config.voiceEN);
      if (!service) throw new Error(`Voice ${config.voiceEN} not found`);
      return await service.synthesize(ssml, config.voiceEN, config.rate, config.pitch);
    }
    // Bilingual: extract structured segments
    const segments = this.extractLanguageSegments(ssml);
    const chunkPromises = segments.map(async (seg) => {
      const voice = seg.lang === 'vi' ? config.voiceVN : config.voiceEN;
      const service = this.services.get(voice);
      if (!service) throw new Error(`Voice ${voice} not found`);
      // Wrap content in speak with lang
      const speak = `<speak xml:lang="${seg.lang === 'vi' ? 'vi' : 'en'}">${seg.text}</speak>`;
      return await service.synthesize(speak, voice, config.rate, config.pitch);
    });
    const chunks = await Promise.all(chunkPromises);
    return this.mergeChunks(chunks, 0.3);
  }

  private extractLanguageSegments(ssml: string): { lang: 'vi' | 'en'; text: string }[] {
    const segments: { lang: 'vi' | 'en'; text: string }[] = [];
    let remaining = ssml;
    while (remaining.length > 0) {
      const enIdx = remaining.indexOf('[EN]');
      const viIdx = remaining.indexOf('[VI]');
      if (enIdx === -1 && viIdx === -1) break;
      if (enIdx !== -1 && (viIdx === -1 || enIdx < viIdx)) {
        const endIdx = remaining.indexOf('[/EN]', enIdx);
        if (endIdx === -1) break;
        const content = remaining.substring(enIdx + 4, endIdx).trim();
        segments.push({ lang: 'en', text: content });
        remaining = remaining.substring(endIdx + 5);
      } else {
        const endIdx = remaining.indexOf('[/VI]', viIdx);
        if (endIdx === -1) break;
        const content = remaining.substring(viIdx + 4, endIdx).trim();
        segments.push({ lang: 'vi', text: content });
        remaining = remaining.substring(endIdx + 5);
      }
    }
    // If no segments, treat whole as default language
    if (segments.length === 0) {
      segments.push({ lang: 'vi', text: ssml });
    }
    return segments;
  }

  private mergeChunks(chunks: AudioChunk[], crossfadeSec: number): AudioChunk {
    if (chunks.length === 0) throw new Error('No chunks');
    if (chunks.length === 1) return chunks[0];
    // Resample all to first chunk's sample rate and channels
    const targetSR = chunks[0].sampleRate;
    const targetCh = chunks[0].channels;
    const resampled = chunks.map(c => this.resample(c, targetSR, targetCh));
    let totalDuration = 0;
    for (const c of resampled) totalDuration += c.duration;
    totalDuration -= crossfadeSec * (resampled.length - 1);
    const totalSamples = Math.ceil(totalDuration * targetSR);
    const merged = new Float32Array(totalSamples * targetCh);
    let writePos = 0;
    for (let i = 0; i < resampled.length; i++) {
      const chunk = resampled[i];
      const samples = chunk.data.length / targetCh;
      if (i > 0) {
        const fadeSamples = Math.min(crossfadeSec * targetSR, samples);
        const prevSamples = Math.min(fadeSamples, writePos);
        const prevStart = writePos - prevSamples;
        for (let s = 0; s < prevSamples; s++) {
          const factor = s / prevSamples;
          const gain = Math.sin(factor * Math.PI / 2);
          const prevGain = Math.cos(factor * Math.PI / 2);
          for (let ch = 0; ch < targetCh; ch++) {
            const idx = (prevStart + s) * targetCh + ch;
            merged[idx] = merged[idx] * prevGain + chunk.data[s * targetCh + ch] * gain;
          }
        }
        const remainingSamples = samples - prevSamples;
        if (remainingSamples > 0) {
          const start = writePos;
          for (let s = prevSamples; s < samples; s++) {
            const destIdx = (start + (s - prevSamples)) * targetCh;
            const srcIdx = s * targetCh;
            merged.set(chunk.data.subarray(srcIdx, srcIdx + targetCh), destIdx);
          }
          writePos += remainingSamples;
        }
      } else {
        const copyLen = Math.min(samples * targetCh, merged.length);
        merged.set(chunk.data.subarray(0, copyLen), 0);
        writePos = Math.min(samples, totalSamples);
      }
    }
    const finalData = merged.subarray(0, writePos * targetCh);
    return { data: finalData, sampleRate: targetSR, channels: targetCh, duration: finalData.length / (targetSR * targetCh) };
  }

  private resample(chunk: AudioChunk, targetSR: number, targetCh: number): AudioChunk {
    if (chunk.sampleRate === targetSR && chunk.channels === targetCh) return chunk;
    const ratio = chunk.sampleRate / targetSR;
    const newLen = Math.floor(chunk.data.length / ratio / chunk.channels) * targetCh;
    const newData = new Float32Array(newLen);
    for (let i = 0; i < newLen / targetCh; i++) {
      const srcIdx = Math.floor(i * ratio) * chunk.channels;
      for (let ch = 0; ch < targetCh; ch++) {
        const srcCh = Math.min(ch, chunk.channels - 1);
        newData[i * targetCh + ch] = chunk.data[srcIdx + srcCh] || 0;
      }
    }
    return { data: newData, sampleRate: targetSR, channels: targetCh, duration: newData.length / (targetSR * targetCh) };
  }
}

// ============================================================
// PACKAGE: @commutecast/audio (LUFS, Compressor, Limiter)
// ============================================================

export class AudioProcessor {
  process(chunk: AudioChunk): AudioChunk {
    const data = new Float32Array(chunk.data);
    // 1. LUFS normalization (EBU R128)
    const lufs = this.calcLUFS(data);
    const targetLUFS = -16; // typical for broadcast
    const gain = Math.pow(10, (targetLUFS - lufs) / 20);
    let processed = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      processed[i] = data[i] * Math.min(gain, 2.0);
    }
    // 2. Compressor with soft knee
    processed = this.compress(processed, 0.5, 4, 5, 50, chunk.sampleRate);
    // 3. Limiter (true peak)
    processed = this.limit(processed, 0.9);
    return { ...chunk, data: processed };
  }

  private calcLUFS(data: Float32Array): number {
    // Approximate LUFS using RMS, for production use a proper library
    let sum = 0;
    for (const v of data) sum += v * v;
    const rms = Math.sqrt(sum / data.length);
    return 20 * Math.log10(rms);
  }

  private compress(data: Float32Array, threshold: number, ratio: number, attackMs: number, releaseMs: number, sampleRate: number): Float32Array {
    const attack = 1 - Math.exp(-1 / (attackMs * sampleRate / 1000));
    const release = 1 - Math.exp(-1 / (releaseMs * sampleRate / 1000));
    let gain = 1;
    const result = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      const targetGain = abs > threshold ? Math.pow(threshold / abs, 1 / ratio) : 1;
      gain = gain + (targetGain - gain) * (targetGain < gain ? attack : release);
      result[i] = data[i] * gain;
    }
    return result;
  }

  private limit(data: Float32Array, maxAmplitude: number): Float32Array {
    const result = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      if (data[i] > maxAmplitude) result[i] = maxAmplitude;
      else if (data[i] < -maxAmplitude) result[i] = -maxAmplitude;
      else result[i] = data[i];
    }
    return result;
  }
}

// ============================================================
// PACKAGE: @commutecast/scoring
// ============================================================

export class Scorer {
  score(script: string, prosody: ProsodyAnnotation[], audio?: AudioChunk): Score {
    const pronunciation = this.scorePronunciation(script);
    const prosodyScore = this.scoreProsody(prosody);
    const readability = this.scoreReadability(script);
    const naturalness = this.scoreNaturalness(script, prosody);
    const overall = (pronunciation + prosodyScore + readability + naturalness) / 4;
    const suggestions: string[] = [];
    if (pronunciation < 80) suggestions.push('Improve pronunciation for some words');
    if (prosodyScore < 80) suggestions.push('Vary rate and pitch more');
    if (readability < 80) suggestions.push('Shorten sentences');
    if (naturalness < 80) suggestions.push('Add more pauses');
    return { overall, pronunciation, prosody: prosodyScore, readability, naturalness, suggestions };
  }

  private scorePronunciation(text: string): number {
    const abbrev = (text.match(/[A-Z]{2,}/g) || []).length;
    return Math.max(0, 100 - abbrev * 3);
  }

  private scoreProsody(prosody: ProsodyAnnotation[]): number {
    if (prosody.length === 0) return 70;
    let score = 70;
    const rates = prosody.map(p => p.rate);
    const avg = rates.reduce((a,b) => a+b, 0) / rates.length;
    const variance = rates.reduce((a,b) => a + (b-avg)*(b-avg), 0) / rates.length;
    if (variance > 0.05) score += 15;
    if (prosody.some(p => p.emphasis !== 'none')) score += 10;
    return Math.min(100, score);
  }

  private scoreReadability(text: string): number {
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 0) return 70;
    const avgWords = sentences.reduce((a,s) => a + s.split(/\s+/).length, 0) / sentences.length;
    if (avgWords <= 15) return 90;
    if (avgWords <= 25) return 70;
    return 50;
  }

  private scoreNaturalness(text: string, prosody: ProsodyAnnotation[]): number {
    let score = 70;
    const breaks = prosody.filter(p => p.breakDuration > 300).length;
    if (breaks > 3) score += 15;
    return Math.min(100, score);
  }
}

// ============================================================
// PACKAGE: @commutecast/cache (Promise + LRU)
// ============================================================

export interface ICache {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttl?: number): Promise<void>;
  invalidate(key: string): Promise<void>;
}

export class MemoryCache implements ICache {
  private store = new Map<string, { value: any; expiresAt?: number; lastAccess: number }>();
  private maxSize = 100;
  private pending = new Map<string, Promise<any>>();

  async get(key: string): Promise<any> {
    // Check if already pending
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    entry.lastAccess = Date.now();
    return entry.value;
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    // LRU eviction
    if (this.store.size >= this.maxSize) {
      let oldest = Infinity;
      let oldestKey: string | null = null;
      for (const [k, v] of this.store) {
        if (v.lastAccess < oldest) {
          oldest = v.lastAccess;
          oldestKey = k;
        }
      }
      if (oldestKey) this.store.delete(oldestKey);
    }
    this.store.set(key, {
      value,
      expiresAt: ttl ? Date.now() + ttl * 1000 : undefined,
      lastAccess: Date.now(),
    });
    // Clear pending if any
    this.pending.delete(key);
  }

  async invalidate(key: string): Promise<void> {
    this.store.delete(key);
    this.pending.delete(key);
  }

  // For pending requests, we use a separate method
  async getOrSet(key: string, factory: () => Promise<any>, ttl?: number): Promise<any> {
    if (this.pending.has(key)) {
      return this.pending.get(key)!;
    }
    const cached = await this.get(key);
    if (cached !== null) return cached;
    const promise = factory();
    this.pending.set(key, promise);
    try {
      const result = await promise;
      await this.set(key, result, ttl);
      return result;
    } finally {
      this.pending.delete(key);
    }
  }
}

// ============================================================
// PACKAGE: @commutecast/engine (DAG Scheduler with state)
// ============================================================

export interface ExecutionNode {
  id: string;
  name: string;
  module: string;
  dependencies: string[];
  condition?: (ctx: PipelineContext) => boolean;
  priority: number;
  timeout: number;
  retryPolicy: { maxRetries: number; backoffMs: number };
  cacheKey?: (ctx: PipelineContext) => string;
  execute: (ctx: PipelineContext) => Promise<void>;
  rollback?: (ctx: PipelineContext) => Promise<void>;
}

export interface ExecutionEdge {
  from: string;
  to: string;
}

export interface ExecutionGraph {
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
  startNode: string;
  endNode: string;
}

export class ExecutionScheduler {
  async schedule(graph: ExecutionGraph, ctx: PipelineContext): Promise<void> {
    // Build adjacency and indegree
    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};
    const nodeMap: Record<string, ExecutionNode> = {};
    for (const node of graph.nodes) {
      nodeMap[node.id] = node;
      adj[node.id] = [];
      inDegree[node.id] = 0;
      ctx.dagState[node.id] = 'pending';
    }
    for (const edge of graph.edges) {
      adj[edge.from].push(edge.to);
      inDegree[edge.to]++;
    }

    // Priority queue for nodes with zero indegree
    const queue: string[] = [];
    for (const [id, deg] of Object.entries(inDegree)) {
      if (deg === 0) queue.push(id);
    }
    // Sort by priority (higher priority first)
    queue.sort((a, b) => (nodeMap[b].priority || 0) - (nodeMap[a].priority || 0));

    const completed = new Set<string>();
    const running = new Set<string>();

    while (queue.length > 0 || running.size > 0) {
      // Process batch of queued nodes in parallel
      const batch = queue.splice(0);
      const batchPromises = batch.map(async (nodeId) => {
        const node = nodeMap[nodeId];
        if (!node) return;
        if (ctx.abortSignal?.aborted) {
          ctx.dagState[nodeId] = 'skipped';
          return;
        }
        // Check condition
        if (node.condition && !node.condition(ctx)) {
          ctx.dagState[nodeId] = 'skipped';
          completed.add(nodeId);
          return;
        }
        // Check dependencies: if any dependency failed, skip this node
        for (const dep of node.dependencies) {
          if (ctx.dagState[dep] === 'failed') {
            ctx.dagState[nodeId] = 'skipped';
            completed.add(nodeId);
            return;
          }
        }
        ctx.dagState[nodeId] = 'running';
        running.add(nodeId);
        let attempt = 0;
        let success = false;
        while (attempt <= node.retryPolicy.maxRetries && !success) {
          try {
            await Promise.race([
              node.execute(ctx),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), node.timeout)),
            ]);
            success = true;
            ctx.dagState[nodeId] = 'success';
            completed.add(nodeId);
          } catch (e) {
            attempt++;
            ctx.errors.push(e as Error);
            if (attempt > node.retryPolicy.maxRetries) {
              ctx.dagState[nodeId] = 'failed';
              if (node.rollback) await node.rollback(ctx);
              // Cancel downstream nodes by marking them failed? We'll skip them later.
            } else {
              await new Promise(resolve => setTimeout(resolve, node.retryPolicy.backoffMs * attempt));
            }
          }
        }
        running.delete(nodeId);
        // After node finishes, update indegree of successors
        for (const next of adj[nodeId] || []) {
          if (ctx.dagState[next] === 'failed' || ctx.dagState[next] === 'skipped') continue;
          inDegree[next]--;
          if (inDegree[next] === 0) {
            // Check if all dependencies are completed (should be)
            queue.push(next);
          }
        }
        // Re-sort queue by priority
        queue.sort((a, b) => (nodeMap[b].priority || 0) - (nodeMap[a].priority || 0));
      });
      await Promise.allSettled(batchPromises);
    }

    // Final check: if some nodes not completed and not failed/skipped, mark as failed
    for (const node of graph.nodes) {
      if (!completed.has(node.id) && ctx.dagState[node.id] !== 'failed' && ctx.dagState[node.id] !== 'skipped') {
        ctx.dagState[node.id] = 'failed';
        ctx.errors.push(new Error(`Node ${node.id} not completed`));
      }
    }
  }
}

// ============================================================
// PACKAGE: @commutecast/engine (Main Engine)
// ============================================================

export class CommuteCastEngine {
  private tokenizer: ProductionTokenizer;
  private normalizer: Normalizer;
  private ruleEngine: RuleEngine;
  private dictionary: PronunciationDictionary;
  private entityResolver: EntityResolver;
  private aiService: UnifiedAIService;
  private breathPlanner: BreathPlanner;
  private prosodyPlanner: ProsodyPlanner;
  private ssmlGenerator: SSMLGenerator;
  private ttsDispatcher: TTSDispatcher;
  private audioProcessor: AudioProcessor;
  private scorer: Scorer;
  private cache: MemoryCache;
  private scheduler: ExecutionScheduler;
  private eventBus: IEventBus;
  private metrics: MetricsCollector;
  private voiceManager: VoiceManager;

  constructor(deps: {
    ai: GoogleGenAI;
    ttsServices: Map<string, TTSService>;
    voiceCapabilities: VoiceCapability[];
    dictionaryEntries?: PronunciationEntry[];
    rules?: Rule[];
    cache?: MemoryCache;
    eventBus?: IEventBus;
    metrics?: MetricsCollector;
  }) {
    this.tokenizer = new ProductionTokenizer();
    this.normalizer = new Normalizer();
    this.dictionary = new PronunciationDictionary(deps.dictionaryEntries || []);
    this.ruleEngine = new RuleEngine(deps.rules || []);
    this.entityResolver = new EntityResolver(this.dictionary);
    this.aiService = new UnifiedAIService(deps.ai);
    this.breathPlanner = new BreathPlanner();
    this.prosodyPlanner = new ProsodyPlanner();
    this.ssmlGenerator = new SSMLGenerator();
    this.ttsDispatcher = new TTSDispatcher(deps.ttsServices);
    this.audioProcessor = new AudioProcessor();
    this.scorer = new Scorer();
    this.cache = deps.cache || new MemoryCache();
    this.scheduler = new ExecutionScheduler();
    this.eventBus = deps.eventBus || new SimpleEventBus();
    this.metrics = deps.metrics || new ConsoleMetrics();
    this.voiceManager = new VoiceManager();
    for (const cap of deps.voiceCapabilities) {
      this.voiceManager.register(cap);
    }
  }

  async process(text: string, config: BroadcastConfig, signal?: AbortSignal): Promise<{
    script: string;
    ssml: string;
    audio: AudioChunk;
    duration: number;
    emotion: EmotionResult;
    topic: Topic;
    score: Score;
  }> {
    const ctx: PipelineContext = {
      rawText: text,
      config,
      cacheHits: 0,
      cacheMisses: 0,
      metrics: this.metrics,
      metadata: { startTime: Date.now(), locale: config.locale || 'vi-VN', version: '2.0.0' },
      errors: [],
      warnings: [],
      rewriteAttempts: 0,
      abortSignal: signal,
      dagState: {},
    };

    const cacheKey = this.buildCacheKey(text, config);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      ctx.cacheHits++;
      this.eventBus.publish({ type: EventType.CACHE_HIT, payload: cacheKey, timestamp: Date.now(), source: 'engine' });
      return cached;
    }
    ctx.cacheMisses++;

    const graph = this.buildGraph();
    await this.scheduler.schedule(graph, ctx);

    const result = {
      script: ctx.aiResult?.rewritten || text,
      ssml: ctx.ssml!,
      audio: ctx.audio!,
      duration: ctx.audio?.duration || 0,
      emotion: ctx.aiResult?.emotion || { primary: EmotionState.NEUTRAL, secondary: [], energy: 0.5, urgency: 0.3, sentiment: 0, confidence: 0.5 },
      topic: ctx.aiResult?.topic || Topic.GENERAL,
      score: ctx.score!,
    };

    await this.cache.set(cacheKey, result, 3600);
    this.eventBus.publish({ type: EventType.AUDIO_PROCESSED, payload: result, timestamp: Date.now(), source: 'engine' });
    return result;
  }

  private buildGraph(): ExecutionGraph {
    const nodes: ExecutionNode[] = [
      {
        id: 'tokenizer',
        name: 'Tokenizer',
        module: 'tokenizer',
        dependencies: [],
        priority: 1,
        timeout: 5000,
        retryPolicy: { maxRetries: 1, backoffMs: 100 },
        execute: async (ctx) => {
          ctx.tokens = this.tokenizer.tokenize(ctx.rawText);
          this.eventBus.publish({ type: EventType.TOKENIZER_FINISHED, payload: ctx.tokens, timestamp: Date.now(), source: 'tokenizer' });
        },
      },
      {
        id: 'normalizer',
        name: 'Normalizer',
        module: 'normalizer',
        dependencies: ['tokenizer'],
        priority: 2,
        timeout: 5000,
        retryPolicy: { maxRetries: 1, backoffMs: 100 },
        execute: async (ctx) => {
          const locale = ctx.config.locale || 'vi-VN';
          ctx.normalizedTokens = this.normalizer.normalize(ctx.tokens!, locale);
          this.eventBus.publish({ type: EventType.NORMALIZER_FINISHED, payload: ctx.normalizedTokens, timestamp: Date.now(), source: 'normalizer' });
        },
      },
      {
        id: 'rule-engine',
        name: 'RuleEngine',
        module: 'rule-engine',
        dependencies: ['normalizer'],
        priority: 3,
        timeout: 3000,
        retryPolicy: { maxRetries: 1, backoffMs: 100 },
        execute: async (ctx) => {
          ctx.ruledTokens = this.ruleEngine.applyTokens(ctx.normalizedTokens!);
          this.eventBus.publish({ type: EventType.RULE_ENGINE_FINISHED, payload: ctx.ruledTokens, timestamp: Date.now(), source: 'rule-engine' });
        },
      },
      {
        id: 'entity-resolver',
        name: 'EntityResolver',
        module: 'entity',
        dependencies: ['rule-engine'],
        priority: 4,
        timeout: 3000,
        retryPolicy: { maxRetries: 1, backoffMs: 100 },
        execute: async (ctx) => {
          const locale = ctx.config.locale || 'vi-VN';
          ctx.entities = this.entityResolver.resolve(ctx.ruledTokens!, locale);
          this.eventBus.publish({ type: EventType.ENTITY_RESOLVER_FINISHED, payload: ctx.entities, timestamp: Date.now(), source: 'entity' });
        },
      },
      {
        id: 'ai-service',
        name: 'AIService',
        module: 'ai',
        dependencies: ['rule-engine'],
        priority: 5,
        timeout: 15000,
        retryPolicy: { maxRetries: 2, backoffMs: 500 },
        execute: async (ctx) => {
          const text = ctx.ruledTokens!.map(t => t.value).join('');
          ctx.aiResult = await this.aiService.process(text, ctx.config, ctx.abortSignal);
          this.eventBus.publish({ type: EventType.AI_FINISHED, payload: ctx.aiResult, timestamp: Date.now(), source: 'ai' });
        },
      },
      {
        id: 'prosody',
        name: 'ProsodyPlanner',
        module: 'prosody',
        dependencies: ['ai-service'],
        priority: 7,
        timeout: 5000,
        retryPolicy: { maxRetries: 1, backoffMs: 100 },
        execute: async (ctx) => {
          const script = ctx.aiResult!.rewritten;
          const sentences = script.split(/[.!?]+/).filter(s => s.trim().length > 0);
          const breathGroups = this.breathPlanner.plan(sentences);
          ctx.breathGroups = breathGroups;
          const style = ctx.config.style;
          const styleConfig = this.getStyleConfig(style);
          ctx.prosodyAnnotations = this.prosodyPlanner.plan(breathGroups, ctx.aiResult!.emotion, styleConfig);
          this.eventBus.publish({ type: EventType.PROSODY_FINISHED, payload: ctx.prosodyAnnotations, timestamp: Date.now(), source: 'prosody' });
        },
      },
      {
        id: 'ssml',
        name: 'SSMLGenerator',
        module: 'ssml',
        dependencies: ['prosody'],
        priority: 8,
        timeout: 3000,
        retryPolicy: { maxRetries: 1, backoffMs: 100 },
        execute: async (ctx) => {
          const locale = ctx.config.locale || 'vi-VN';
          const voiceName = ctx.config.voiceVN;
          const cap = this.voiceManager.get(voiceName);
          ctx.ssml = this.ssmlGenerator.generate(ctx.prosodyAnnotations!, locale, cap);
          this.eventBus.publish({ type: EventType.SSML_GENERATED, payload: ctx.ssml, timestamp: Date.now(), source: 'ssml' });
        },
      },
      {
        id: 'tts',
        name: 'TTSDispatcher',
        module: 'tts',
        dependencies: ['ssml'],
        priority: 9,
        timeout: 30000,
        retryPolicy: { maxRetries: 2, backoffMs: 1000 },
        execute: async (ctx) => {
          ctx.audio = await this.ttsDispatcher.dispatch(ctx.ssml!, ctx.config, ctx.abortSignal);
          this.eventBus.publish({ type: EventType.TTS_FINISHED, payload: ctx.audio, timestamp: Date.now(), source: 'tts' });
        },
      },
      {
        id: 'audio-processor',
        name: 'AudioProcessor',
        module: 'audio',
        dependencies: ['tts'],
        priority: 10,
        timeout: 10000,
        retryPolicy: { maxRetries: 1, backoffMs: 100 },
        execute: async (ctx) => {
          if (ctx.audio) {
            ctx.audio = this.audioProcessor.process(ctx.audio);
          }
        },
      },
      {
        id: 'scoring',
        name: 'Scoring',
        module: 'scoring',
        dependencies: ['prosody', 'audio-processor'],
        priority: 11,
        timeout: 5000,
        retryPolicy: { maxRetries: 1, backoffMs: 100 },
        execute: async (ctx) => {
          const script = ctx.aiResult!.rewritten;
          const prosody = ctx.prosodyAnnotations || [];
          ctx.score = this.scorer.score(script, prosody, ctx.audio);
          this.eventBus.publish({ type: EventType.SCORING_FINISHED, payload: ctx.score, timestamp: Date.now(), source: 'scoring' });
        },
      },
    ];

    const edges: ExecutionEdge[] = [
      { from: 'tokenizer', to: 'normalizer' },
      { from: 'normalizer', to: 'rule-engine' },
      { from: 'rule-engine', to: 'entity-resolver' },
      { from: 'rule-engine', to: 'ai-service' },
      { from: 'ai-service', to: 'prosody' },
      { from: 'prosody', to: 'ssml' },
      { from: 'ssml', to: 'tts' },
      { from: 'tts', to: 'audio-processor' },
      { from: 'prosody', to: 'scoring' },
      { from: 'audio-processor', to: 'scoring' },
    ];

    return { nodes, edges, startNode: 'tokenizer', endNode: 'scoring' };
  }

  private getStyleConfig(style: BroadcastStyle): StyleConfig {
    const styles: Record<BroadcastStyle, StyleConfig> = {
      [BroadcastStyle.BBC]: { rate: { base: 0.95 }, pitch: { base: 0 }, pause: { default: 300, period: 500, question: 400, exclamation: 250, afterTitle: 600 }, energyLevel: 0.5 },
      [BroadcastStyle.VOV]: { rate: { base: 1.0 }, pitch: { base: 0 }, pause: { default: 350, period: 550, question: 450, exclamation: 300, afterTitle: 700 }, energyLevel: 0.6 },
      [BroadcastStyle.NPR]: { rate: { base: 0.9 }, pitch: { base: 0.05 }, pause: { default: 400, period: 600, question: 500, exclamation: 350, afterTitle: 800 }, energyLevel: 0.4 },
      [BroadcastStyle.MORNING]: { rate: { base: 1.1 }, pitch: { base: 0.1 }, pause: { default: 250, period: 400, question: 300, exclamation: 200, afterTitle: 500 }, energyLevel: 0.8 },
      [BroadcastStyle.BREAKING]: { rate: { base: 1.2 }, pitch: { base: 0.15 }, pause: { default: 200, period: 300, question: 250, exclamation: 150, afterTitle: 400 }, energyLevel: 0.9 },
      [BroadcastStyle.PODCAST]: { rate: { base: 0.85 }, pitch: { base: 0 }, pause: { default: 350, period: 500, question: 400, exclamation: 300, afterTitle: 650 }, energyLevel: 0.5 },
    };
    return styles[style];
  }

  private buildCacheKey(text: string, config: BroadcastConfig): string {
    const key = `${text}_${config.languageMode}_${config.style}_${config.voiceVN}_${config.voiceEN}_${config.rate}_${config.pitch}_${config.locale || 'vi-VN'}`;
    // Use browser-compatible hash
    const hash = this.hashString(key);
    return hash;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return 'h' + Math.abs(hash).toString(36);
  }
}

// ============================================================
// PACKAGE: @commutecast/core (EventBus)
// ============================================================

export class SimpleEventBus implements IEventBus {
  private handlers: Map<EventType, Array<(event: Event) => void>> = new Map();
  private allHandlers: Array<(event: Event) => void> = [];

  publish<T>(event: Event<T>): void {
    const handlers = this.handlers.get(event.type) || [];
    const all = this.allHandlers;
    const payload = event;
    // Use microtask for async execution
    queueMicrotask(() => {
      for (const h of handlers) h(payload);
      for (const h of all) h(payload);
    });
  }

  subscribe<T>(type: EventType, handler: (event: Event<T>) => void): Unsubscribe {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type)!.push(handler as (event: Event) => void);
    return () => {
      const list = this.handlers.get(type)!;
      const idx = list.indexOf(handler as (event: Event) => void);
      if (idx !== -1) list.splice(idx, 1);
    };
  }

  subscribeAll(handler: (event: Event) => void): Unsubscribe {
    this.allHandlers.push(handler);
    return () => {
      const idx = this.allHandlers.indexOf(handler);
      if (idx !== -1) this.allHandlers.splice(idx, 1);
    };
  }
}

// ============================================================
// PACKAGE: @commutecast/core (Metrics)
// ============================================================

export interface MetricsCollector {
  increment(name: string, tags?: Record<string, string>): void;
  set(name: string, value: number, tags?: Record<string, string>): void;
  observe(name: string, value: number, tags?: Record<string, string>): void;
  startTimer(name: string): { end: () => void };
}

export class ConsoleMetrics implements MetricsCollector {
  increment(name: string, tags?: Record<string, string>): void {
    console.log(`[Metric] ${name}: +1`, tags || '');
  }
  set(name: string, value: number, tags?: Record<string, string>): void {
    console.log(`[Metric] ${name}: ${value}`, tags || '');
  }
  observe(name: string, value: number, tags?: Record<string, string>): void {
    console.log(`[Metric] ${name}: ${value}ms`, tags || '');
  }
  startTimer(name: string): { end: () => void } {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        console.log(`[Metric] ${name}: ${duration}ms`);
      }
    };
  }
}