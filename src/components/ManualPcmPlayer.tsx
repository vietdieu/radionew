import React, { useEffect, useRef, useState } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  RotateCw, 
  Download, 
  Volume2, 
  Layers, 
  FileCheck,
  Sparkles,
  Headphones,
  Share2,
  Copy,
  Check,
  Radio,
  Sliders,
  MessageSquare,
  Facebook
} from "lucide-react";
import { NewsChapter, SummaryPayload } from "../types";
import { base64ToArrayBuffer, pcmToFloat32, encodeWavHeader } from "../utils";
import { useUserPreferences } from "./UserPreferencesProvider";
import DrivingMode from "./DrivingMode";
import { motion, AnimatePresence } from "motion/react";
import ShareModal from "./ShareModal";
import { ClearDataButton } from './ClearDataButton';

interface ManualPcmPlayerProps {
  payload: SummaryPayload;
  audioChunks: string[];
  title?: string;
  preferencesInfo?: string;
  uiLanguage?: "vi" | "en";
  briefingId?: string;
  onEnded?: () => void;
}

const playerTranslations = {
  vi: {
    systemTitle: "Hệ Thống Phát Thanh Tin Tức",
    poweredBy: "Vận hành bởi Gemini 3.1 TTS",
    speed: "Tốc độ",
    exportBtn: "Xuất file âm thanh (.wav)",
    scriptTitle: "Nội Dung Kịch Bản Bản Tin",
    scriptSub: "Nhấp phân đoạn bên dưới để nghe vị trí mong muốn",
    labelIntro: "📻 Chào Đầu Bản Tin",
    labelOutro: "🚗 Chào Kết & Giao Thông",
    labelTopic: "📚 Phân Đoạn Tin Tức Summary",
    studioCenter: "🎛️ Trung Tâm Studio & Chia Sẻ",
    studioDesc: "Hậu trường phát thanh: Tải file, sao chép kịch bản hoặc truyền thông trực tiếp.",
    onAirLabel: "PHÒNG THU LIVE",
    onAirBroadcasting: "ĐÀI ĐANG PHÁT SÓNG TRỰC TIẾP",
    onAirStandby: "MÁY CHỦ SẴN SÀNG - ĐANG CHỜ PHÁT",
    copyTranscript: "Sao chép tin tức",
    copySuccess: "Đã sao chép kịch bản!",
    shareZalo: "Chia sẻ lên Zalo",
    shareFacebook: "Chia sẻ lên Facebook",
    downloadTiktok: "Tải xuống Audio (Dùng cho TikTok/Reels)",
    studioEfx: "Giám Sát Tần Số Sóng & Âm Lượng Mixer",
    volumeLabel: "Âm lượng phòng thu",
  },
  en: {
    systemTitle: "Commute Audio System",
    poweredBy: "Powered by Gemini 3.1 TTS",
    speed: "Speed",
    exportBtn: "Export Audio",
    scriptTitle: "Interactive Commute Broadcast Script",
    scriptSub: "Click segments to jump audio",
    labelIntro: "📻 Welcome Greeting",
    labelOutro: "🚗 Traffic Outro",
    labelTopic: "📚 Broadcast Topic",
    studioCenter: "🎛️ Studio Suite & Sharing Center",
    studioDesc: "Backstage tools: download audio feed, export transcripts or stream direct.",
    onAirLabel: "LIVE STUDIO",
    onAirBroadcasting: "ON AIR - LIVE BROADCASTING",
    onAirStandby: "STANDBY - READY TO PLAY",
    copyTranscript: "Copy Transcript",
    copySuccess: "Transcript Copied!",
    shareZalo: "Share to Zalo",
    shareFacebook: "Share to Facebook",
    downloadTiktok: "Download Audio (for TikTok/Reels)",
    studioEfx: "Studio Frequency & Visual Level Mixer Monitor",
    volumeLabel: "Studio Monitor Volume",
  }
};

export default function ManualPcmPlayer({ 
  payload, 
  audioChunks, 
  title, 
  preferencesInfo, 
  uiLanguage: propUiLanguage = "vi", 
  briefingId,
  onEnded
}: ManualPcmPlayerProps) {
  const { preferences: userPref, updateDrivingMode, updatePreferences } = useUserPreferences();
  
  // Local active tab for Audio Studio
  const [activeStudioTab, setActiveStudioTab] = useState<"mixer" | "music" | "lexicon">("mixer");

  // Local state for adding pronunciation entry
  const [newWord, setNewWord] = useState("");
  const [newReplace, setNewReplace] = useState("");

  // Local state for Voice Preview
  const [previewText, setPreviewText] = useState("");
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const getDefaultLanguage = (): "vi" | "en" => {
    if (propUiLanguage === "vi" || propUiLanguage === "en") return propUiLanguage;
    if (userPref?.language === "vi" || userPref?.language === "en") return userPref.language;
    const browserLang = navigator.language?.split('-')[0];
    if (browserLang === "vi") return "vi";
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    if (langParam === "vi" || langParam === "en") return langParam;
    return "vi";
  };

  const [uiLanguage, setUiLanguage] = useState<"vi" | "en">(getDefaultLanguage());
  const pt = playerTranslations[uiLanguage];
  
  useEffect(() => {
    if (userPref?.language === "vi" || userPref?.language === "en") {
      setUiLanguage(userPref.language);
    }
  }, [userPref?.language]);

  useEffect(() => {
    if (!previewText) {
      setPreviewText(
        uiLanguage === "vi" 
          ? "Chào buổi sáng, chúc bạn một ngày lái xe an toàn!" 
          : "Good morning! Wishing you an incredibly safe commute today!"
      );
    }
  }, [uiLanguage]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(userPref.speed || 1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const activeSegmentIndexRef = useRef(0);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(0);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setCurrentPlayingIndex(activeSegmentIndex);
  }, [activeSegmentIndex]);

  useEffect(() => {
    if (userPref.speed) {
      setPlaybackRate(userPref.speed);
    }
  }, [userPref.speed]);

  // Web Audio Variables
  const audioCtxRef = useRef<AudioContext | null>(null);
  const mainBufferRef = useRef<AudioBuffer | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  // Background Music & Jingle Variables
  const [isBgMusicEnabled, setIsBgMusicEnabled] = useState(false);
  const [bgMusicVolume, setBgMusicVolume] = useState<number>(0.15);
  const bgOscsRef = useRef<OscillatorNode[]>([]);
  const bgGainRef = useRef<GainNode | null>(null);

  const [volume, setVolume] = useState<number>(0.9);
  const [isHighQualityVoice, setIsHighQualityVoice] = useState(true);
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(32).fill(12));
  const [copied, setCopied] = useState(false);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  const [showRemaining, setShowRemaining] = useState(false);
  
  const startTimeCtxRef = useRef<number>(0);
  const elapsedOffsetRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);
  
  const [segmentOffsets, setSegmentOffsets] = useState<{ start: number; end: number }[]>([]);

  const allSegments = [
    { type: "intro", title: "Introduction", text: payload.introduction, bullets: [] as string[] },
    ...payload.chapters.map((ch, i) => ({ 
      type: "chapter", 
      title: `${i + 1}. ${ch.topic}`, 
      text: ch.scriptText, 
      bullets: ch.summaryBullets 
    })),
    { type: "outro", title: "Signing Off", text: payload.conclusion, bullets: [] as string[] }
  ];

  const getTimelineSegments = () => {
    if (!payload) return [];
    
    const introText = payload.introduction || "";
    const chapterTexts = payload.chapters?.map(c => c.scriptText || "") || [];
    const outroText = payload.conclusion || "";
    
    const introLen = introText.length;
    const chapLens = chapterTexts.map(t => t.length);
    const outroLen = outroText.length;
    
    const totalChars = introLen + chapLens.reduce((a, b) => a + b, 0) + outroLen;
    if (totalChars === 0) return [];
    
    const totalDur = totalDuration || 120; // fallback to 120s if not loaded yet
    
    const segments: Array<{ label: string; start: number; end: number; startPct: number; endPct: number }> = [];
    let currentPct = 0;
    
    // Intro
    const introPct = (introLen / totalChars) * 100;
    segments.push({
      label: uiLanguage === "vi" ? "Lời chào" : "Intro",
      start: (currentPct / 100) * totalDur,
      end: ((currentPct + introPct) / 100) * totalDur,
      startPct: currentPct,
      endPct: currentPct + introPct
    });
    currentPct += introPct;
    
    // Chapters
    payload.chapters?.forEach((chap, idx) => {
      const chapPct = (chapLens[idx] / totalChars) * 100;
      segments.push({
        label: chap.topic || `${uiLanguage === "vi" ? "Chương" : "Chapter"} ${idx + 1}`,
        start: (currentPct / 100) * totalDur,
        end: ((currentPct + chapPct) / 100) * totalDur,
        startPct: currentPct,
        endPct: currentPct + chapPct
      });
      currentPct += chapPct;
    });
    
    // Outro
    const outroPct = (outroLen / totalChars) * 100;
    segments.push({
      label: uiLanguage === "vi" ? "Kết bài" : "Outro",
      start: (currentPct / 100) * totalDur,
      end: ((currentPct + outroPct) / 100) * totalDur,
      startPct: currentPct,
      endPct: currentPct + outroPct
    });
    
    return segments;
  };

  const handleAddPronunciation = () => {
    if (!newWord.trim() || !newReplace.trim()) return;
    const currentDict = userPref.audioPronunciationDict || [];
    if (currentDict.some(e => e.word.toLowerCase() === newWord.trim().toLowerCase())) {
      return;
    }
    const updated = [...currentDict, { word: newWord.trim(), replace: newReplace.trim() }];
    updatePreferences({ audioPronunciationDict: updated });
    setNewWord("");
    setNewReplace("");
  };

  const handleRemovePronunciation = (word: string) => {
    const currentDict = userPref.audioPronunciationDict || [];
    const updated = currentDict.filter(e => e.word !== word);
    updatePreferences({ audioPronunciationDict: updated });
  };

  const handlePlayVoicePreview = async () => {
    if (!previewText.trim()) return;
    setIsPreviewing(true);
    setPreviewError("");
    try {
      let processedPreview = previewText;
      const dict = userPref.audioPronunciationDict || [];
      const sortedDict = [...dict].sort((a, b) => b.word.length - a.word.length);
      for (const entry of sortedDict) {
        if (!entry.word.trim()) continue;
        const escaped = entry.word.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
        processedPreview = processedPreview.replace(regex, entry.replace);
      }

      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: processedPreview,
          voice: userPref.voice,
          tone: userPref.tone,
          emotion: userPref.audioEmotion
        })
      });

      if (!res.ok) {
        throw new Error(uiLanguage === "vi" ? "Lỗi tổng hợp bản xem trước." : "Synthesis preview error.");
      }

      const data = await res.json();
      if (!data.base64Audio) {
        throw new Error("No base64 audio data");
      }

      const audioSrc = `data:audio/mp3;base64,${data.base64Audio}`;
      if (previewAudioRef.current) {
        previewAudioRef.current.pause();
      }
      const audio = new Audio(audioSrc);
      previewAudioRef.current = audio;
      audio.play();
      audio.onended = () => {
        setIsPreviewing(false);
      };
    } catch (err: any) {
      console.error(err);
      setPreviewError(err.message || "Failed to preview");
      setIsPreviewing(false);
    }
  };

// Initialize audio buffer
useEffect(() => {
  let active = true;

  const initAudio = async () => {
    if (!audioChunks || audioChunks.length === 0) {
      setSegmentOffsets([]);
      setTotalDuration(0);
      mainBufferRef.current = null;
      return;
    }

    // ===== LOẠI BỎ DUPLICATE CHUNKS =====
    const uniqueChunks: string[] = [];
    const seen = new Set<string>();
    for (const chunk of audioChunks) {
      if (!seen.has(chunk)) {
        seen.add(chunk);
        uniqueChunks.push(chunk);
      }
    }
    if (uniqueChunks.length !== audioChunks.length) {
      console.warn(
        `[ManualPcmPlayer] ⚠️ Found ${audioChunks.length - uniqueChunks.length} duplicate chunks. Original: ${audioChunks.length}, Unique: ${uniqueChunks.length}`
      );
    }
    
    const chunksToProcess = uniqueChunks;
     console.log(`[ManualPcmPlayer] Chunks to process: ${chunksToProcess.length}`);
    
    stopAudio();
    setIsPlaying(false);
    setCurrentTime(0);
    elapsedOffsetRef.current = 0;

    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioCtxRef.current = audioCtx;

      const decodedBuffers: AudioBuffer[] = [];

      for (let i = 0; i < chunksToProcess.length; i++) {
        if (!active) return;
        const chunk = chunksToProcess[i];
        
        let arrayBuffer: ArrayBuffer;
        if (chunk.startsWith("http")) {
          try {
            const res = await fetch(chunk);
            arrayBuffer = await res.arrayBuffer();
          } catch (fetchErr) {
            console.error(`[ManualPcmPlayer] Failed to fetch cloud audio chunk ${i}:`, fetchErr);
            continue;
          }
        } else {
          arrayBuffer = base64ToArrayBuffer(chunk);
        }

        try {
          let decoded = await audioCtx.decodeAudioData(arrayBuffer);
          
          if (decoded.sampleRate !== 24000) {
            const targetRate = 24000;
            const ratio = targetRate / decoded.sampleRate;
            const newLength = Math.round(decoded.length * ratio);
            const newBuffer = audioCtx.createBuffer(
              decoded.numberOfChannels,
              newLength,
              targetRate
            );
            for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
              const srcData = decoded.getChannelData(ch);
              const dstData = newBuffer.getChannelData(ch);
              for (let j = 0; j < newLength; j++) {
                const srcIdx = j / ratio;
                const idx0 = Math.floor(srcIdx);
                const idx1 = Math.min(idx0 + 1, srcData.length - 1);
                const frac = srcIdx - idx0;
                dstData[j] = srcData[idx0] * (1 - frac) + srcData[idx1] * frac;
              }
            }
            decoded = newBuffer;
          }
          
          if (decoded.numberOfChannels > 1) {
            const monoBuffer = audioCtx.createBuffer(1, decoded.length, decoded.sampleRate);
            const monoData = monoBuffer.getChannelData(0);
            for (let ch = 0; ch < decoded.numberOfChannels; ch++) {
              const chData = decoded.getChannelData(ch);
              for (let j = 0; j < decoded.length; j++) {
                monoData[j] += chData[j] / decoded.numberOfChannels;
              }
            }
            decoded = monoBuffer;
          }
          
          decodedBuffers.push(decoded);
          console.log(`[ManualPcmPlayer] Chunk ${i} duration: ${decoded.duration.toFixed(2)}s, sampleRate: ${decoded.sampleRate}Hz`);
          
        } catch (decodeErr) {
          console.warn(`[ManualPcmPlayer] Standard decodeAudioData failed for chunk ${i + 1}, trying raw PCM fallback...`, decodeErr);
          try {
            const rawPCM = chunk.startsWith("http") ? arrayBuffer : base64ToArrayBuffer(chunk);
            const floatArray = pcmToFloat32(rawPCM);
            const fallbackBuf = audioCtx.createBuffer(1, floatArray.length, 24000);
            fallbackBuf.getChannelData(0).set(floatArray);
            decodedBuffers.push(fallbackBuf);
          } catch (pcmErr) {
            console.error(`[ManualPcmPlayer] Fallback PCM decoding also failed for chunk ${i + 1}:`, pcmErr);
          }
        }
      }
      console.log(`[ManualPcmPlayer] Decoded buffers count: ${decodedBuffers.length}`);
      
      if (!active) return;
      if (decodedBuffers.length === 0) {
        throw new Error("No audio chunks could be decoded successfully.");
      }

      const sampleRate = decodedBuffers[0].sampleRate;
      const numberOfChannels = Math.max(...decodedBuffers.map(b => b.numberOfChannels));
      const pauseSamples = Math.round(sampleRate * (userPref.audioPauseDuration ?? 0.25)); // Đọc cấu hình khoảng lặng từ Audio Studio
      console.log(`[ManualPcmPlayer] Pause samples: ${pauseSamples}, pause duration: ${(pauseSamples / sampleRate).toFixed(2)}s`);
      
      let totalSamples = 0;
      const offsets: { start: number; end: number }[] = [];

      decodedBuffers.forEach((buf, idx) => {
        const startSec = totalSamples / sampleRate;
        const durationSamples = Math.round(buf.duration * sampleRate);
        totalSamples += durationSamples;
        const endSec = totalSamples / sampleRate;
        offsets.push({ start: startSec, end: endSec });
        
        if (idx < decodedBuffers.length - 1) {
          totalSamples += pauseSamples;
        }
      });

      if (!active) return;
      setSegmentOffsets(offsets);
      
      const calculatedDuration = totalSamples / sampleRate;
      setTotalDuration(calculatedDuration);
      console.log(`[ManualPcmPlayer] Total duration: ${calculatedDuration.toFixed(2)}s, Samples: ${totalSamples}, Rate: ${sampleRate}Hz`);

      const unifiedBuffer = audioCtx.createBuffer(numberOfChannels, totalSamples, sampleRate);
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const outputChannel = unifiedBuffer.getChannelData(channel);
        let writeOffset = 0;
        decodedBuffers.forEach((buf, idx) => {
          const bufSamples = Math.round(buf.duration * sampleRate);
          if (channel < buf.numberOfChannels) {
            const srcData = buf.getChannelData(channel);
            const copyLength = Math.min(srcData.length, bufSamples);
            outputChannel.set(srcData.subarray(0, copyLength), writeOffset);
          }
          writeOffset += bufSamples;
          if (idx < decodedBuffers.length - 1) {
            writeOffset += pauseSamples;
          }
        });
      }

      mainBufferRef.current = unifiedBuffer;

    } catch (err) {
      console.error("Failed to construct audio buffer:", err);
    }
  };

  initAudio();

  return () => {
    active = false;
    stopAudio();
    if (audioCtxRef.current) {
      const ctx = audioCtxRef.current;
      if (ctx.state !== "closed") {
        ctx.close().catch(err => console.log("[ManualPcmPlayer] Error closing AudioContext:", err));
      }
      audioCtxRef.current = null;
    }
  };
}, [audioChunks, userPref.audioPauseDuration]);

  // ===== FIX: Cải thiện playAudio với timing chính xác =====
  const playAudio = (offset: number) => {
    if (!mainBufferRef.current || !audioCtxRef.current) return;

    stopAudio();

    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }

    const audioCtx = audioCtxRef.current;
    const source = audioCtx.createBufferSource();
    source.buffer = mainBufferRef.current;
    
    // ===== FIX: Giới hạn rate để tránh biến dạng giọng quá nhiều =====
    const safeRate = Math.max(0.6, Math.min(2.5, playbackRate));
    source.playbackRate.value = safeRate;
    
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.75;
    analyserRef.current = analyser;

    let lastNode: AudioNode = source;

    // 1. Áp dụng Bộ lọc Giảm nhiễu (Noise Reduction)
    if (userPref.audioNoiseReduction) {
      const hpFilter = audioCtx.createBiquadFilter();
      hpFilter.type = "highpass";
      hpFilter.frequency.value = 85; // Cắt âm trầm ù nền nhiễu thiết bị

      const lpFilter = audioCtx.createBiquadFilter();
      lpFilter.type = "lowpass";
      lpFilter.frequency.value = 7500; // Cắt nhiễu xè rít tần số cao

      lastNode.connect(hpFilter);
      hpFilter.connect(lpFilter);
      lastNode = lpFilter;
    }

    // Kết nối đến Analyser vẽ phổ tần
    lastNode.connect(analyser);

    // 2. Chuẩn hóa âm lượng giọng nói (Normalize: Tự động nâng dải âm)
    const normVolume = userPref.audioNormalize ? volume * 1.35 : volume;

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = normVolume;
    gainNodeRef.current = gainNode;
    analyser.connect(gainNode);

    // 3. Bộ giới hạn biên độ chống rè (Limiter)
    if (userPref.audioLimiter) {
      const limiter = audioCtx.createDynamicsCompressor();
      limiter.threshold.setValueAtTime(-1.5, audioCtx.currentTime);
      limiter.knee.setValueAtTime(0, audioCtx.currentTime);
      limiter.ratio.setValueAtTime(20, audioCtx.currentTime);
      limiter.attack.setValueAtTime(0.003, audioCtx.currentTime);
      limiter.release.setValueAtTime(0.08, audioCtx.currentTime);

      gainNode.connect(limiter);
      limiter.connect(audioCtx.destination);
    } else {
      gainNode.connect(audioCtx.destination);
    }

    const safeOffset = Math.max(0, Math.min(offset, totalDuration));
    
    // ===== FIX: Lưu timing chính xác =====
    const startTime = audioCtx.currentTime;
    source.start(0, safeOffset);
    sourceNodeRef.current = source;

    startTimeCtxRef.current = startTime;
    elapsedOffsetRef.current = safeOffset;
    setIsPlaying(true);
  };

  // ===== FIX: Cập nhật timing khi thay đổi playback rate =====
  useEffect(() => {
    if (sourceNodeRef.current && isPlaying) {
      // Lưu vị trí hiện tại và restart với rate mới
      const currentOffset = currentTime;
      stopAudio();
      playAudio(currentOffset);
    }
  }, [playbackRate]);

  // ===== FIX: Theo dõi progress với timing chính xác =====
  const startTrackingProgress = () => {
    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);

    const updateProgress = () => {
      if (!audioCtxRef.current || !isPlaying) return;

      const now = audioCtxRef.current.currentTime;
      
      // ===== FIX: Tính elapsed với rate hiện tại =====
      let elapsedSeconds = elapsedOffsetRef.current + (now - startTimeCtxRef.current) * playbackRate;
      
      // Giới hạn trong khoảng hợp lệ
      elapsedSeconds = Math.max(0, Math.min(elapsedSeconds, totalDuration));

      if (elapsedSeconds >= totalDuration - 0.05) {
        setCurrentTime(totalDuration);
        setIsPlaying(false);
        stopAudio();
        elapsedOffsetRef.current = 0;
        setActiveSegmentIndex(0);
        activeSegmentIndexRef.current = 0;
        if (onEnded) {
          onEnded();
        }
        return;
      }

      setCurrentTime(elapsedSeconds);

      // Tìm segment active
      const activeIdx = segmentOffsets.findIndex(
        (offset) => elapsedSeconds >= offset.start && elapsedSeconds <= offset.end
      );
      if (activeIdx !== -1) {
        if (activeIdx !== activeSegmentIndexRef.current) {
          activeSegmentIndexRef.current = activeIdx;
          setActiveSegmentIndex(activeIdx);
        }
      }

      if (analyserRef.current) {
        const dataArr = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArr);
        const values: number[] = [];
        for (let i = 0; i < 32; i++) {
          const weight = i < 8 ? 1.0 : i < 16 ? 1.3 : 1.6;
          values.push(Math.min(255, (dataArr[i] || 0) * weight));
        }
        setFrequencyData(values);
      }

      animFrameIdRef.current = requestAnimationFrame(updateProgress);
    };

    animFrameIdRef.current = requestAnimationFrame(updateProgress);
  };

  const stopTrackingProgress = () => {
    if (animFrameIdRef.current) {
      cancelAnimationFrame(animFrameIdRef.current);
      animFrameIdRef.current = null;
    }
  };

  const stopAudio = () => {
    stopTrackingProgress();
    if (sourceNodeRef.current) {
      try {
        sourceNodeRef.current.stop();
      } catch (err) {}
      sourceNodeRef.current = null;
    }
  };

  const playJingle = () => {
    if (!audioCtxRef.current) return;
    try {
      const now = audioCtxRef.current.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.50];
      const noteDurations = [0.1, 0.1, 0.1, 0.3];

      notes.forEach((freq, idx) => {
        const osc = audioCtxRef.current!.createOscillator();
        const jingleGain = audioCtxRef.current!.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        jingleGain.gain.setValueAtTime(0, now + idx * 0.08);
        jingleGain.gain.linearRampToValueAtTime(volume * 0.08, now + idx * 0.08 + 0.01);
        jingleGain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + noteDurations[idx]);

        osc.connect(jingleGain);
        jingleGain.connect(audioCtxRef.current!.destination);

        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + noteDurations[idx]);
      });
    } catch (err) {
      console.warn("Failed to play transition jingle:", err);
    }
  };

  const startBgMusic = () => {
    if (!audioCtxRef.current || !isBgMusicEnabled) return;
    const genre = userPref.audioMusicGenre ?? "lofi";
    if (genre === "none") return;

    try {
      stopBgMusic();
      const now = audioCtxRef.current.currentTime;

      const masterGain = audioCtxRef.current.createGain();
      // Bắt đầu từ 0 để fade-in mượt mà
      masterGain.gain.setValueAtTime(0, now);
      const targetVol = (userPref.audioMusicVolume ?? bgMusicVolume) * volume * 0.08;
      const fadeDur = userPref.audioFadeDuration ?? 1.5;
      masterGain.gain.linearRampToValueAtTime(targetVol, now + fadeDur);
      
      masterGain.connect(audioCtxRef.current.destination);
      bgGainRef.current = masterGain;

      // Chọn hợp âm & loại sóng dựa trên thể loại nhạc
      let baseFreqs = [130.81, 164.81, 196.00, 246.94]; // Mặc định: Lofi (Cmaj7)
      let type: OscillatorType = "sine";
      let detuneMultiplier = 1;

      if (genre === "acoustic") {
        baseFreqs = [261.63, 329.63, 392.00, 523.25]; // C Major
        type = "triangle";
        detuneMultiplier = 0.5;
      } else if (genre === "synthwave") {
        baseFreqs = [110.00, 165.00, 220.00, 330.00]; // Am pulse style
        type = "sawtooth";
        detuneMultiplier = 2.5;
      } else if (genre === "classical") {
        baseFreqs = [196.00, 293.66, 349.23, 440.00]; // G7 classical style
        type = "sine";
        detuneMultiplier = 0.2;
      }

      const oscs: OscillatorNode[] = [];

      baseFreqs.forEach((freq, idx) => {
        const osc = audioCtxRef.current!.createOscillator();
        osc.type = type;
        const detune = ((idx % 3) * 0.7 - 0.7) * detuneMultiplier;
        osc.frequency.setValueAtTime(freq + detune, now);
        osc.detune.setValueAtTime(detune * 2, now);

        const gain = audioCtxRef.current!.createGain();
        const vol = 0.025 + (idx * 0.005);
        gain.gain.setValueAtTime(vol, now);
        gain.gain.linearRampToValueAtTime(vol * 0.6, now + 2.5);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + idx * 0.18);
        oscs.push(osc);
      });

      bgOscsRef.current = oscs;
    } catch (err) {
      console.warn("Failed to start background music:", err);
    }
  };

  const stopBgMusic = () => {
    if (bgGainRef.current && audioCtxRef.current) {
      try {
        const now = audioCtxRef.current.currentTime;
        const fadeDur = userPref.audioFadeDuration ?? 1.5;
        const currentGain = bgGainRef.current.gain;
        currentGain.cancelScheduledValues(now);
        currentGain.setValueAtTime(currentGain.value, now);
        currentGain.linearRampToValueAtTime(0, now + fadeDur);
        
        const oscs = bgOscsRef.current;
        const gainNode = bgGainRef.current;
        setTimeout(() => {
          oscs.forEach(osc => {
            try { osc.stop(); osc.disconnect(); } catch(e){}
          });
          try { gainNode.disconnect(); } catch(e){}
        }, fadeDur * 1000 + 100);
        
        bgOscsRef.current = [];
        bgGainRef.current = null;
        return;
      } catch (e) {
        console.warn("Failed to stop bg music with fade:", e);
      }
    }

    if (bgOscsRef.current.length > 0) {
      bgOscsRef.current.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
      bgOscsRef.current = [];
    }
    if (bgGainRef.current) {
      try {
        bgGainRef.current.disconnect();
      } catch (e) {}
      bgGainRef.current = null;
    }
  };

  useEffect(() => {
    if (isPlaying && isBgMusicEnabled) {
      startBgMusic();
    } else {
      stopBgMusic();
    }
    return () => {
      stopBgMusic();
    };
  }, [isPlaying, isBgMusicEnabled]);

  useEffect(() => {
    if (bgGainRef.current && audioCtxRef.current) {
      bgGainRef.current.gain.setTargetAtTime(bgMusicVolume * volume * 0.06, audioCtxRef.current.currentTime, 0.1);
    }
  }, [bgMusicVolume, volume]);

  useEffect(() => {
    if (isPlaying) {
      startTrackingProgress();
    } else {
      stopTrackingProgress();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  useEffect(() => {
    let interval: any;
    if (!isPlaying) {
      interval = setInterval(() => {
        setFrequencyData((prev) =>
          prev.map((_, i) => {
            const angle = (Date.now() * 0.002) + (i * 0.4);
            return Math.sin(angle) * 8 + 12;
          })
        );
      }, 80);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  // Handle global player control events from keyboard shortcuts
  useEffect(() => {
    const handleTogglePlayEvent = () => {
      handlePlayPause();
    };
    const handlePauseEvent = () => {
      if (isPlaying) {
        handlePlayPause();
      }
    };
    const handleSeekEvent = (e: Event) => {
      const direction = (e as CustomEvent).detail?.direction;
      if (direction === "forward") {
        handleSkip(10);
      } else if (direction === "backward") {
        handleSkip(-10);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.getAttribute("contenteditable") === "true")
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handleSkip(-10);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleSkip(10);
      }
    };

    window.addEventListener("commutecast-toggle-play", handleTogglePlayEvent);
    window.addEventListener("commutecast-pause", handlePauseEvent);
    window.addEventListener("commutecast-seek", handleSeekEvent);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("commutecast-toggle-play", handleTogglePlayEvent);
      window.removeEventListener("commutecast-pause", handlePauseEvent);
      window.removeEventListener("commutecast-seek", handleSeekEvent);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isPlaying, currentTime, totalDuration, playbackRate, volume]);

  // ===== FIX: Xử lý rate change với giới hạn =====
  const handleRateChange = (rate: number) => {
    // Giới hạn rate để tránh biến dạng giọng quá nhiều
    if (rate < 0.6) {
      alert(uiLanguage === "vi" 
        ? "Tốc độ quá chậm có thể làm biến dạng giọng. Khuyến nghị từ 0.75x đến 2.0x." 
        : "Speed too slow may distort voice. Recommended 0.75x to 2.0x.");
      return;
    }
    if (rate > 2.5) {
      alert(uiLanguage === "vi" 
        ? "Tốc độ quá nhanh có thể làm biến dạng giọng. Khuyến nghị từ 0.75x đến 2.0x." 
        : "Speed too fast may distort voice. Recommended 0.75x to 2.0x.");
      return;
    }
    setPlaybackRate(rate);
  };

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stopAudio();
    } else {
      playAudio(currentTime >= totalDuration ? 0 : currentTime);
    }
  };

  const handleSkip = (seconds: number) => {
    const newTime = Math.max(0, Math.min(currentTime + seconds, totalDuration));
    setCurrentTime(newTime);
    if (isPlaying) {
      playAudio(newTime);
    } else {
      elapsedOffsetRef.current = newTime;
      const activeIdx = segmentOffsets.findIndex(
        (offset) => newTime >= offset.start && newTime <= offset.end
      );
      if (activeIdx !== -1) {
        activeSegmentIndexRef.current = activeIdx;
        setActiveSegmentIndex(activeIdx);
      }
    }
  };

  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (isPlaying) {
      playAudio(newTime);
    } else {
      elapsedOffsetRef.current = newTime;
      const activeIdx = segmentOffsets.findIndex(
        (offset) => newTime >= offset.start && newTime <= offset.end
      );
      if (activeIdx !== -1) {
        activeSegmentIndexRef.current = activeIdx;
        setActiveSegmentIndex(activeIdx);
      }
    }
  };

  const handleChapterClick = (index: number) => {
    if (segmentOffsets[index]) {
      const targetTime = segmentOffsets[index].start;
      setCurrentTime(targetTime);
      playAudio(targetTime);
      activeSegmentIndexRef.current = index;
      setActiveSegmentIndex(index);
      setCurrentPlayingIndex(index);
    }
  };

  const handleDownloadWav = async () => {
    if (isPreparingDownload) return;
    setIsPreparingDownload(true);

    try {
      const response = await fetch("/api/prepare-wav", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title || "CommuteSummary",
          chunksJson: JSON.stringify(audioChunks),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.downloadUrl) {
          const a = document.createElement("a");
          a.href = data.downloadUrl;
          a.download = `${title || "CommuteSummary"}_Audio_24khz.wav`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setIsPreparingDownload(false);
          return;
        }
      }
    } catch (err) {
      console.warn("Server-side prepare failed, falling back to local packaging...", err);
    }

    try {
      const arrayBuffers: ArrayBuffer[] = [];
      for (const chunk of audioChunks) {
        if (chunk.startsWith("http")) {
          try {
            const res = await fetch(chunk);
            const ab = await res.arrayBuffer();
            arrayBuffers.push(ab);
          } catch (fetchErr) {
            console.error("[ManualPcmPlayer] Export fetch chunk error:", fetchErr);
          }
        } else {
          arrayBuffers.push(base64ToArrayBuffer(chunk));
        }
      }
      
      const totalByteLength = arrayBuffers.reduce((acc, ab) => acc + ab.byteLength, 0);
      const concatenatedPCM = new Uint8Array(totalByteLength);
      
      let writePos = 0;
      arrayBuffers.forEach((ab) => {
        concatenatedPCM.set(new Uint8Array(ab), writePos);
        writePos += ab.byteLength;
      });

      const wavBlob = encodeWavHeader(concatenatedPCM.buffer, 24000);
      const url = URL.createObjectURL(wavBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "CommuteSummary"}_Audio_24khz.wav`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(uiLanguage === "vi" ? "Tải xuống âm thanh thất bại." : "Failed to package WAV file for download.");
    } finally {
      setIsPreparingDownload(false);
    }
  };

  const handleCopyTranscript = () => {
    try {
      const fullTranscript = [
        `🎙️ BẢN TIN PHÁT THANH: ${title || "CommuteCast"}`,
        `==================================`,
        `[${pt.labelIntro}]`,
        payload.introduction,
        ...payload.chapters.map((ch, idx) => `\n[${idx + 1}. ${ch.topic}]\n${ch.scriptText}`),
        `\n[${pt.labelOutro}]`,
        payload.conclusion,
        `==================================`,
        `© 2026 CommuteCast Radio News | Vận hành bởi Gemini 3.5 & TTS`
      ].join("\n");
      
      let successful = false;
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(fullTranscript);
        successful = true;
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = fullTranscript;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          successful = document.execCommand("copy");
        } catch (err) {
          console.error("Fallback copy failed", err);
        }
        document.body.removeChild(textArea);
      }

      if (successful) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2400);
      } else {
        alert(uiLanguage === "vi" 
          ? "Thiết bị không hỗ trợ sao chép tự động. Bạn vui lòng tự bôi đen văn bản để sao chép." 
          : "Auto-copy not supported. Please select text manually to copy."
        );
      }
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const handleShareZalo = () => {
    const postTitle = title ? `Bản tin phát thanh CommuteCast: ${title}` : "Nghe Bản tin phát thanh cá nhân hóa của tôi!";
    const shareUrl = window.location.href;
    const encodedTitle = encodeURIComponent(postTitle);
    const encodedUrl = encodeURIComponent(shareUrl);

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      const mobileShareLink = `zalo://app?action=share&url=${encodedUrl}&title=${encodedTitle}`;
      const backupWebLink = `https://zalo.me/share?url=${encodedUrl}&title=${encodedTitle}`;
      
      window.location.href = mobileShareLink;

      setTimeout(() => {
        if (!document.hidden) {
          window.location.href = backupWebLink;
        }
      }, 1500);
    } else {
      const webShareLink = `https://sp.zalo.me/share_to_zalo?url=${encodedUrl}&title=${encodedTitle}`;
      window.open(webShareLink, "_blank", "width=600,height=500,scrollbars=yes,resizable=yes");
    }
  };

  const handleShareFacebook = () => {
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
    window.open(shareUrl, "_blank", "width=600,height=550,scrollbars=yes,resizable=yes");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <>
      <AnimatePresence>
        {userPref.isDrivingMode && (
          <DrivingMode
            key="driving-active"
            title={title || (uiLanguage === "vi" ? "Bản tin hành trình của bạn" : "Custom Commute Podcast")}
            isPlaying={isPlaying}
            currentTime={currentTime}
            totalDuration={totalDuration}
            onPlayPause={handlePlayPause}
            onSkip={handleSkip}
            onScrubberChange={handleScrubberChange}
            onExit={() => updateDrivingMode(false)}
            uiLanguage={uiLanguage}
          />
        )}
      </AnimatePresence>

      <div className={`flex flex-col gap-6 ${userPref.isDrivingMode ? "hidden" : ""}`} id="pcm-commute-player">
      {/* Visual Audio Deck Widget */}
      <div className="bg-radial from-[#1e293b] to-[#0f172a] text-slate-100 rounded-3xl p-6 shadow-2xl relative overflow-hidden border border-slate-700/50">
        
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />
        
        <div className="absolute -top-12 -right-12 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Metadata */}
        <div className="flex justify-between items-center relative z-10 mb-4">
          <div className="flex items-center gap-2 bg-slate-800/80 backdrop-blur-sm px-3 py-1.5 rounded-full border border-slate-700/50">
            <div className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isPlaying ? "bg-red-500" : "bg-emerald-500"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isPlaying ? "bg-red-500" : "bg-emerald-500"
              }`}></span>
            </div>
            <span className="text-[10px] font-mono tracking-widest text-slate-300 uppercase font-bold">
              {isPlaying 
                ? (uiLanguage === "vi" ? "ĐANG PHÁT (LIVE CAST)" : "LIVE BROADCAST") 
                : (uiLanguage === "vi" ? "CHẾ ĐỘ CHỜ (STANDBY)" : "STUDIO STANDBY")}
            </span>
          </div>
          {preferencesInfo && (
            <span className="text-xs text-slate-400 font-mono italic bg-slate-800/40 px-2.5 py-1 rounded-md border border-slate-700/30">
              {preferencesInfo}
            </span>
          )}
        </div>

        {/* Title display */}
        <div className="relative z-10 mb-6">
          <h3 className="text-xl font-bold text-white tracking-tight leading-snug line-clamp-2">
            {title || (uiLanguage === "vi" ? "Bản tin hành trình của bạn" : "Custom Commute Podcast")}
          </h3>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <span>{pt.poweredBy}</span>
            <span className="inline-block w-1 h-1 rounded-full bg-slate-500" />
            <span>Mono 24kHz</span>
          </p>
        </div>

        {/* Dynamic Waveform Visualizer */}
        <div className="relative z-10 h-14 flex items-end justify-between gap-[3px] px-2.5 mb-4 bg-slate-950/60 rounded-2xl py-3 border border-slate-850">
          {frequencyData.map((val, barIdx) => {
            const heightPx = Math.max(4, Math.min(44, (val / 255) * 40));
            const currentHighlight = (barIdx / 32) <= (currentTime / (totalDuration || 1));
            
            return (
              <div
                key={barIdx}
                className={`w-full rounded-t-sm transition-all duration-75 ${
                  isPlaying 
                    ? currentHighlight
                      ? "bg-gradient-to-t from-cyan-400 via-emerald-400 to-amber-300 shadow-[0_0_8px_rgba(34,211,238,0.4)]" 
                      : "bg-cyan-600/40"
                    : "bg-slate-700/65"
                }`}
                style={{ 
                  height: `${heightPx}px` 
                }}
              />
            );
          })}
        </div>

        {/* Interactive Progress Bar Slider */}
        <div className="relative z-10 mb-4">
          <input
            type="range"
            min={0}
            max={totalDuration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleScrubberChange}
            aria-label={uiLanguage === "vi" ? "Thanh tua thời gian bản tin" : "Podcast time scrubber"}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
          />
          <div className="flex justify-between items-center mt-2 text-xs text-slate-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span 
              onClick={() => setShowRemaining(!showRemaining)} 
              className="cursor-pointer hover:text-white transition select-none flex items-center gap-1"
              title={uiLanguage === "vi" ? "Bấm để đổi chế độ hiển thị thời gian" : "Click to toggle remaining time"}
              role="button"
              aria-label={uiLanguage === "vi" ? "Chuyển đổi hiển thị thời gian còn lại" : "Toggle remaining time display"}
            >
              {showRemaining ? `-${formatTime(totalDuration - currentTime)}` : formatTime(totalDuration)}
            </span>
          </div>
        </div>

        {/* Controls Layout */}
        <div className="relative z-10 flex flex-wrap justify-between items-center gap-4 pt-1 border-t border-slate-800/80">
          
          {/* Rate speed selector */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 font-mono uppercase mr-1">{pt.speed}</span>
            <div className="bg-slate-800/80 p-0.5 rounded-lg flex border border-slate-700/40" role="group" aria-label={uiLanguage === "vi" ? "Chọn tốc độ phát" : "Select playback speed"}>
              {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => {
                const isSelected = playbackRate === rate;
                return (
                  <button
                    key={rate}
                    onClick={() => handleRateChange(rate)}
                    aria-pressed={isSelected}
                    aria-label={uiLanguage === "vi" ? `Tốc độ phát ${rate}x` : `Playback speed ${rate}x`}
                    className={`px-1.5 py-1 text-[10px] font-mono rounded font-bold transition-all relative group cursor-pointer ${
                      isSelected 
                        ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-900" 
                        : "text-slate-400 hover:text-white hover:bg-slate-700/30"
                    }`}
                    title={rate === 0.75 && uiLanguage === "vi" ? "Tốc độ chậm - giọng hơi trầm" : 
                           rate === 2.0 && uiLanguage === "vi" ? "Tốc độ nhanh - giọng hơi cao" : ""}
                  >
                    {rate}x
                    {rate === 0.75 && (
                      <span className="absolute -top-1 -right-1 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Playback controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSkip(-10)}
              title={uiLanguage === "vi" ? "Tua lại 10 giây" : "Rewind 10 seconds"}
              aria-label={uiLanguage === "vi" ? "Tua lại 10 giây" : "Rewind 10 seconds"}
              className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition border border-slate-700/20 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <motion.button
              onClick={() => handlePlayPause()}
              disabled={audioChunks.length === 0}
              aria-label={isPlaying ? (uiLanguage === "vi" ? "Tạm dừng" : "Pause") : (uiLanguage === "vi" ? "Phát bản tin" : "Play briefing")}
              whileHover={{ scale: audioChunks.length === 0 ? 1 : 1.08 }}
              whileTap={{ scale: audioChunks.length === 0 ? 1 : 0.95 }}
              animate={isPlaying ? {
                boxShadow: [
                  "0 0 0 0px rgba(245, 158, 11, 0.4)",
                  "0 0 0 12px rgba(245, 158, 11, 0)",
                  "0 0 0 0px rgba(245, 158, 11, 0.4)"
                ]
              } : {}}
              transition={isPlaying ? {
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              } : {}}
              className={`p-4 rounded-full transition-all duration-300 flex items-center justify-center cursor-pointer ${
                audioChunks.length === 0 
                  ? "bg-slate-800 text-slate-600 cursor-not-allowed" 
                  : isPlaying 
                  ? "bg-gradient-to-r from-amber-400 to-amber-500 text-slate-900 ring-4 ring-amber-500/20" 
                  : "bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-900 ring-4 ring-cyan-500/20"
              }`}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current ml-0.5" />
              )}
            </motion.button>

            <button
              onClick={() => handleSkip(10)}
              title={uiLanguage === "vi" ? "Tới 10 giây" : "Forward 10 seconds"}
              aria-label={uiLanguage === "vi" ? "Tới 10 giây" : "Forward 10 seconds"}
              className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition border border-slate-700/20 cursor-pointer"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Master export trigger */}
          <button
            onClick={() => handleDownloadWav()}
            disabled={isPreparingDownload}
            aria-label={uiLanguage === "vi" ? "Xuất file âm thanh chất lượng cao" : "Export high fidelity audio file"}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full border border-slate-700 hover:border-slate-600 text-xs text-white font-medium transition cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            title={uiLanguage === "vi" ? "Tải xuống toàn bộ bản tin thành file WAV" : "Download full summary in high fidelity WAV format"}
          >
            {isPreparingDownload ? (
              <>
                <span className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></span>
                <span>{uiLanguage === "vi" ? "Đang chuẩn bị..." : "Preparing..."}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>{pt.exportBtn}</span>
              </>
            )}
          </button>
        </div>

        {/* ===== FIX: Voice Quality Toggle ===== */}
        <div className="relative z-10 mt-4 flex justify-between items-center border-t border-slate-800/80 pt-3">
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-slate-500 font-mono uppercase">Giọng phát thanh</span>
            <button
              onClick={() => setIsHighQualityVoice(!isHighQualityVoice)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                isHighQualityVoice 
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" 
                  : "bg-slate-800/50 text-slate-400 border border-slate-700/30"
              }`}
            >
              {isHighQualityVoice ? "🎙️ Studio" : "⚡ Cơ bản"}
            </button>
            {isHighQualityVoice && (
              <span className="text-[8px] text-cyan-400/60 animate-pulse">
                EQ + Compressor
              </span>
            )}
          </div>
          
          {playbackRate !== 1.0 && (
            <div className="text-[10px] text-amber-400/70 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse"></span>
              {uiLanguage === "vi" 
                ? `Tốc độ ${playbackRate}x - Giọng ${playbackRate < 1 ? "trầm hơn" : "cao hơn"} bình thường`
                : `Speed ${playbackRate}x - Voice ${playbackRate < 1 ? "deeper" : "higher"} than normal`}
            </div>
          )}
        </div>
      </div>

      {/* Share Control & Studio Effects Panel */}
      <div className="bg-card-bg border border-border-primary rounded-3xl p-6 shadow-xs flex flex-col gap-5 sm:mt-1" id="studio-share-suite">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border-primary/60 pb-3">
          <div>
            <h4 className="text-sm font-bold text-text-main uppercase tracking-widest flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-600 animate-pulse" />
              <span>{pt.studioCenter}</span>
            </h4>
            <p className="text-xs text-text-muted mt-0.5">{pt.studioDesc}</p>
          </div>
          
          <div className="flex items-center gap-2 bg-bg-secondary border border-border-primary rounded-xl px-3 py-1.5 self-start shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isPlaying ? "animate-ping bg-red-500" : "bg-slate-350"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isPlaying ? "bg-red-500" : "bg-slate-400"
              }`}></span>
            </span>
            <span className="text-[10px] font-mono font-bold text-text-main tracking-wider">
              {isPlaying ? "ON AIR / STREAM SYSTEM" : "STUDIO STANDBY / READY"}
            </span>
          </div>
        </div>

        {/* Audio Studio Tabs Switcher */}
        <div className="flex border-b border-border-primary/85" role="tablist" aria-label="Audio Studio Tabs">
          <button
            onClick={() => setActiveStudioTab("mixer")}
            role="tab"
            aria-selected={activeStudioTab === "mixer"}
            className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-all cursor-pointer ${
              activeStudioTab === "mixer"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            🎛️ {uiLanguage === "vi" ? "Mixer & Hiệu ứng" : "Mixer & Effects"}
          </button>
          <button
            onClick={() => setActiveStudioTab("music")}
            role="tab"
            aria-selected={activeStudioTab === "music"}
            className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-all cursor-pointer ${
              activeStudioTab === "music"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            🎵 {uiLanguage === "vi" ? "Nhạc nền & Fade" : "BGM & Fade"}
          </button>
          <button
            onClick={() => setActiveStudioTab("lexicon")}
            role="tab"
            aria-selected={activeStudioTab === "lexicon"}
            className={`flex-1 py-2 text-xs font-bold text-center border-b-2 transition-all cursor-pointer ${
              activeStudioTab === "lexicon"
                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                : "border-transparent text-text-muted hover:text-text-main"
            }`}
          >
            🗣️ {uiLanguage === "vi" ? "Từ điển & Preview" : "Lexicon & Preview"}
          </button>
        </div>

        {/* Tab Contents */}
        <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 shadow-xs">
          
          {/* TAB 1: MIXER & EFFECTS */}
          {activeStudioTab === "mixer" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Volume & Emotion */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-text-main flex items-center gap-1.5 select-none">
                        <Volume2 className="w-4 h-4 text-text-muted" />
                        <span>{pt.volumeLabel}</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-950/20 border border-cyan-100 dark:border-cyan-800/40 rounded-md px-2 py-0.5">
                        {Math.round(volume * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-full h-2 bg-border-primary rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-600 transition"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-text-main select-none">
                      🎭 {uiLanguage === "vi" ? "Cảm xúc giọng nói (Emotion)" : "Vocal Emotion Tone"}
                    </label>
                    <select
                      value={userPref.audioEmotion || "cheerful"}
                      onChange={(e) => updatePreferences({ audioEmotion: e.target.value as any })}
                      className="w-full text-xs bg-bg-primary text-text-main border border-border-primary rounded-xl px-3 py-2 focus:ring-2 focus:ring-cyan-500"
                    >
                      <option value="cheerful">☀️ {uiLanguage === "vi" ? "Vui tươi, rạng rỡ" : "Cheerful / Warm"}</option>
                      <option value="professional">💼 {uiLanguage === "vi" ? "Đĩnh đạc, chuyên nghiệp" : "Professional / Executive"}</option>
                      <option value="calm">🧘 {uiLanguage === "vi" ? "Điềm tĩnh, nhẹ nhàng" : "Calm / Relaxed"}</option>
                      <option value="energetic">🔥 {uiLanguage === "vi" ? "Nhiệt huyết, mạnh mẽ" : "Energetic / Dynamic"}</option>
                      <option value="empathetic">❤️ {uiLanguage === "vi" ? "Thấu hiểu, đồng cảm" : "Empathetic / Heartfelt"}</option>
                    </select>
                  </div>
                </div>

                {/* Pause spacing & Voice Quality Toggles */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-text-main">
                        ⏱️ {uiLanguage === "vi" ? "Thời lượng ngắt nghỉ (Pause)" : "Custom Chapter Pause"}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                        {(userPref.audioPauseDuration ?? 0.25).toFixed(2)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={2.5}
                      step={0.05}
                      value={userPref.audioPauseDuration ?? 0.25}
                      onChange={(e) => updatePreferences({ audioPauseDuration: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-border-primary rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-600 transition"
                    />
                  </div>

                  {/* High Quality Features Toggles */}
                  <div className="flex flex-col gap-2 bg-bg-primary/50 p-2.5 rounded-xl border border-border-primary/50">
                    <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider">
                      🎛️ {uiLanguage === "vi" ? "Bộ xử lý tín hiệu số (DSP Effects)" : "DSP Voice Enhancement Hardware"}
                    </span>
                    <div className="flex flex-col gap-2 mt-1">
                      
                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <span className="text-xs text-text-main flex items-center gap-1.5">
                          <span className="text-cyan-500">📈</span>
                          <span>{uiLanguage === "vi" ? "Chuẩn hóa giọng đọc (Normalize)" : "Voice Normalization (+3dB)"}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={userPref.audioNormalize || false}
                          onChange={(e) => updatePreferences({ audioNormalize: e.target.checked })}
                          className="w-4 h-4 text-cyan-500 rounded border-border-primary accent-cyan-500 focus:ring-0"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <span className="text-xs text-text-main flex items-center gap-1.5">
                          <span className="text-red-500">🛡️</span>
                          <span>{uiLanguage === "vi" ? "Giới hạn chống rè (Limiter)" : "Digital Peak Limiter (-1.5dB)"}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={userPref.audioLimiter || false}
                          onChange={(e) => updatePreferences({ audioLimiter: e.target.checked })}
                          className="w-4 h-4 text-cyan-500 rounded border-border-primary accent-cyan-500 focus:ring-0"
                        />
                      </label>

                      <label className="flex items-center justify-between cursor-pointer select-none">
                        <span className="text-xs text-text-main flex items-center gap-1.5">
                          <span className="text-emerald-500">🍃</span>
                          <span>{uiLanguage === "vi" ? "Bộ giảm nhiễu nền (Noise Reduction)" : "Noise Gate & Rumble Filter"}</span>
                        </span>
                        <input
                          type="checkbox"
                          checked={userPref.audioNoiseReduction || false}
                          onChange={(e) => updatePreferences({ audioNoiseReduction: e.target.checked })}
                          className="w-4 h-4 text-cyan-500 rounded border-border-primary accent-cyan-500 focus:ring-0"
                        />
                      </label>

                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: BACKGROUND MUSIC & FADE */}
          {activeStudioTab === "music" && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* BGM Genre Selector */}
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-text-main select-none flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span>{uiLanguage === "vi" ? "Thể loại nhạc nền (BGM)" : "Background Music Genre"}</span>
                  </label>
                  
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-muted">
                      {isBgMusicEnabled ? (uiLanguage === "vi" ? "Đang bật" : "Active") : (uiLanguage === "vi" ? "Đang tắt" : "Disabled")}
                    </span>
                    <button
                      onClick={() => setIsBgMusicEnabled(!isBgMusicEnabled)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        isBgMusicEnabled ? "bg-cyan-500" : "bg-border-primary"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                          isBgMusicEnabled ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </div>

                  <select
                    value={userPref.audioMusicGenre || "none"}
                    disabled={!isBgMusicEnabled}
                    onChange={(e) => updatePreferences({ audioMusicGenre: e.target.value as any })}
                    className="w-full text-xs bg-bg-primary text-text-main border border-border-primary rounded-xl px-3 py-2 focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
                  >
                    <option value="none">❌ {uiLanguage === "vi" ? "Không dùng nhạc nền" : "No Background Music"}</option>
                    <option value="lofi">☕ {uiLanguage === "vi" ? "Lofi Thư giãn (Cmaj7)" : "Relaxing Lofi Chords"}</option>
                    <option value="acoustic">🎸 {uiLanguage === "vi" ? "Acoustic Tươi sáng (C Major)" : "Acoustic Fingerstyle"}</option>
                    <option value="synthwave">🚀 {uiLanguage === "vi" ? "Pulse Điện tử (Retro Synthwave)" : "Cyberpunk Synthwave Bass"}</option>
                    <option value="classical">🎹 {uiLanguage === "vi" ? "Cổ điển Độc tấu (G7 Symphony)" : "Classical Piano Arpeggios"}</option>
                  </select>
                </div>

                {/* BGM Volume & Fade Duration */}
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-text-main">
                        🔊 {uiLanguage === "vi" ? "Âm lượng nhạc nền" : "BGM Volume Mix"}
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-600">
                        {Math.round((userPref.audioMusicVolume ?? bgMusicVolume) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.02}
                      max={0.5}
                      step={0.02}
                      disabled={!isBgMusicEnabled}
                      value={userPref.audioMusicVolume ?? bgMusicVolume}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setBgMusicVolume(val);
                        updatePreferences({ audioMusicVolume: val });
                      }}
                      className="w-full h-2 bg-border-primary rounded-lg appearance-none cursor-pointer accent-amber-500 hover:accent-amber-600 transition disabled:opacity-50"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-text-main">
                        📉 {uiLanguage === "vi" ? "Thời gian Fade In / Fade Out" : "BGM Fade-in / Fade-out"}
                      </span>
                      <span className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                        {(userPref.audioFadeDuration ?? 1.5).toFixed(1)}s
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={4.0}
                      step={0.1}
                      disabled={!isBgMusicEnabled}
                      value={userPref.audioFadeDuration ?? 1.5}
                      onChange={(e) => updatePreferences({ audioFadeDuration: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-border-primary rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-600 transition disabled:opacity-50"
                    />
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 3: PRONUNCIATION LEXICON & PREVIEW */}
          {activeStudioTab === "lexicon" && (
            <div className="flex flex-col gap-4">
              
              {/* Voice Preview widget */}
              <div className="bg-bg-primary/50 border border-border-primary p-3 rounded-xl flex flex-col gap-2">
                <span className="text-[10px] font-mono font-bold text-text-muted uppercase tracking-wider flex items-center justify-between">
                  <span>🎙️ {uiLanguage === "vi" ? "BẢN XEM TRƯỚC GIỌNG ĐỌC (VOICE PREVIEW)" : "REALTIME VOICE PREVIEW ENGINE"}</span>
                  <span className="text-[8px] text-cyan-500 bg-cyan-50 dark:bg-cyan-950/40 px-1 py-0.5 rounded border border-cyan-100">
                    Active: {userPref.audioEmotion || 'cheerful'} emotion
                  </span>
                </span>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={previewText}
                    onChange={(e) => setPreviewText(e.target.value)}
                    placeholder={uiLanguage === "vi" ? "Nhập từ khóa hoặc câu ngắn để kiểm tra giọng đọc..." : "Enter a word or phrase to test synthesis..."}
                    className="flex-1 text-xs bg-bg-primary text-text-main border border-border-primary rounded-xl px-3 py-2 focus:ring-1 focus:ring-cyan-500"
                  />
                  <button
                    onClick={handlePlayVoicePreview}
                    disabled={isPreviewing || !previewText.trim()}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer select-none ${
                      isPreviewing 
                        ? "bg-slate-700 text-white cursor-not-allowed" 
                        : "bg-cyan-500 hover:bg-cyan-600 text-slate-950 shadow-sm"
                    }`}
                  >
                    {isPreviewing ? (
                      <>
                        <span className="w-3 h-3 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                        <span>Playing...</span>
                      </>
                    ) : (
                      <>
                        <span>▶️ Preview</span>
                      </>
                    )}
                  </button>
                </div>
                {previewError && <p className="text-[10px] text-red-500 font-mono">{previewError}</p>}
              </div>

              {/* Pronunciation addition form */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-text-main">
                  📖 {uiLanguage === "vi" ? "Từ điển phát âm (Pronunciation Dictionary)" : "Pronunciation Lexicon Substitutions"}
                </label>
                <p className="text-[10px] text-text-muted">
                  {uiLanguage === "vi"
                    ? "Sửa các từ viết tắt hoặc từ mượn tiếng Anh để Gemini đọc tự nhiên hơn (ví dụ: 'AI' -> 'ai ai', 'GPS' -> 'gi pi ét')."
                    : "Substitute custom abbreviations or foreign phrases (e.g. 'Stripe' -> 'straip', 'GPS' -> 'g p s') for natural reads."}
                </p>

                <div className="flex flex-col sm:flex-row gap-2 mt-1">
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder={uiLanguage === "vi" ? "Ví dụ: AI, ChatGPT..." : "Word (e.g. ChatGPT)"}
                    className="flex-1 text-xs bg-bg-primary text-text-main border border-border-primary rounded-xl px-3 py-2"
                  />
                  <input
                    type="text"
                    value={newReplace}
                    onChange={(e) => setNewReplace(e.target.value)}
                    placeholder={uiLanguage === "vi" ? "Đọc thành: ai ai, chát gípiti..." : "Read As (e.g. chat jipiti)"}
                    className="flex-1 text-xs bg-bg-primary text-text-main border border-border-primary rounded-xl px-3 py-2"
                  />
                  <button
                    onClick={handleAddPronunciation}
                    disabled={!newWord.trim() || !newReplace.trim()}
                    className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    ➕ {uiLanguage === "vi" ? "Thêm" : "Add word"}
                  </button>
                </div>

                {/* Word Lexicon Table List */}
                {(userPref.audioPronunciationDict || []).length > 0 ? (
                  <div className="max-h-32 overflow-y-auto border border-border-primary/60 rounded-xl mt-1.5 divide-y divide-border-primary bg-bg-primary/30">
                    {(userPref.audioPronunciationDict || []).map((entry, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 text-xs font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-text-main">{entry.word}</span>
                          <span className="text-text-muted">→</span>
                          <span className="text-cyan-600 dark:text-cyan-400 font-medium">{entry.replace}</span>
                        </div>
                        <button
                          onClick={() => handleRemovePronunciation(entry.word)}
                          className="text-[10px] text-red-500 hover:text-red-700 font-sans cursor-pointer"
                        >
                          ❌ {uiLanguage === "vi" ? "Xóa" : "Remove"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-text-muted italic text-center py-2">
                    {uiLanguage === "vi" ? "Chưa có từ phát âm tùy chỉnh nào." : "No custom pronunciation overrides added yet."}
                  </p>
                )}
              </div>

            </div>
          )}

        </div>

        {/* ================= AUDIO TIMELINE ================= */}
        <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 shadow-xs mt-2 flex flex-col gap-3">
          <h5 className="text-xs font-bold text-text-main uppercase tracking-widest flex items-center gap-2">
            <span className="text-sm">📅</span>
            <span>{uiLanguage === "vi" ? "Trục thời gian bản tin (Audio Timeline)" : "Audio Timeline Grid"}</span>
          </h5>
          <p className="text-xs text-text-muted">
            {uiLanguage === "vi" 
              ? "Bấm vào phân đoạn bất kỳ bên dưới để di chuyển đầu phát đến vị trí đó." 
              : "Click any block on the interactive timeline to jump the playhead to that segment."}
          </p>
          
          {/* Timeline visualization bar */}
          <div className="relative w-full h-8 bg-slate-100 dark:bg-slate-900 rounded-xl overflow-hidden flex border border-border-primary">
            {getTimelineSegments().map((seg, sIdx) => {
              const isActive = currentTime >= seg.start && currentTime <= seg.end;
              return (
                <button
                  key={sIdx}
                  onClick={() => {
                    handleScrubberChange({ target: { value: seg.start.toString() } } as any);
                  }}
                  title={`${seg.label} (${Math.round(seg.start)}s - ${Math.round(seg.end)}s)`}
                  className={`h-full relative group transition-all duration-300 border-r border-slate-200 dark:border-slate-800 text-center flex items-center justify-center cursor-pointer select-none`}
                  style={{ width: `${seg.endPct - seg.startPct}%` }}
                >
                  <div className={`absolute inset-0 transition-opacity ${
                    isActive 
                      ? "bg-cyan-500/15 dark:bg-cyan-400/25 animate-pulse" 
                      : "bg-transparent group-hover:bg-slate-200/50 dark:group-hover:bg-slate-800/40"
                  }`} />
                  <span className={`text-[9px] font-mono font-bold truncate px-1 relative z-10 transition-colors ${
                    isActive 
                      ? "text-cyan-600 dark:text-cyan-400" 
                      : "text-slate-550 dark:text-slate-400"
                  }`}>
                    {seg.label}
                  </span>
                  
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 opacity-0 pointer-events-none group-hover:opacity-100 transition-all z-50 bg-slate-900 text-white text-[10px] py-1 px-2.5 rounded-lg shadow-xl border border-slate-700 whitespace-nowrap font-mono">
                    <span className="font-bold">{seg.label}</span>
                    <br />
                    <span>{formatTime(seg.start)} - {formatTime(seg.end)}</span>
                  </div>
                </button>
              );
            })}
            
            {/* Live Playhead Indicator line */}
            {totalDuration > 0 && (
              <div 
                className="absolute top-0 bottom-0 w-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] z-20 pointer-events-none transition-all duration-100"
                style={{ left: `${(currentTime / totalDuration) * 100}%` }}
              />
            )}
          </div>

          {/* Legend and Layers */}
          <div className="flex flex-wrap items-center gap-4 text-[10px] text-text-muted font-mono bg-bg-primary/50 p-2 rounded-lg border border-border-primary/50">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-250 dark:bg-slate-800 border border-slate-300" />
              <span>{uiLanguage === "vi" ? "Khối tin tức" : "News segments"}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-cyan-400/30 border border-cyan-400/50" />
              <span>{uiLanguage === "vi" ? "Đoạn đang phát" : "Active Playing"}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-0.5 h-3 bg-red-500" />
              <span>{uiLanguage === "vi" ? "Đầu đọc thời gian thực" : "Live playhead"}</span>
            </span>
            <span className="ml-auto font-bold text-cyan-600 dark:text-cyan-400">
              {uiLanguage === "vi" ? "Nhạc nền:" : "BGM Layer:"} {isBgMusicEnabled ? `Genre [${userPref.audioMusicGenre ?? 'lofi'}]` : "OFF"}
            </span>
          </div>
        </div>

              {/* ===== QUẢN LÝ BỘ NHỚ BẢN TIN ===== */}
        <div className="bg-bg-secondary border border-border-primary rounded-2xl p-4 shadow-xs mt-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h5 className="text-sm font-semibold text-text-main flex items-center gap-2">
                <span className="text-lg">💾</span>
                Quản lý bộ nhớ bản tin
              </h5>
              <p className="text-xs text-text-muted mt-0.5">
                Xóa dữ liệu cục bộ (chỉ trên máy này) để giải phóng bộ nhớ.
              </p>
            </div>
            <div className="flex-shrink-0">
              <ClearDataButton />
            </div>
          </div>
        </div>
        
        {/* Sharing Utility Group */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <button
            onClick={() => handleCopyTranscript()}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all cursor-pointer group hover:shadow-xs active:scale-97 ${
              copied 
                ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 shadow-inner" 
                : "bg-bg-secondary border-border-primary text-text-main hover:bg-surface-bg hover:border-text-muted"
            }`}
          >
            {copied ? (
              <Check className="w-5 h-5 text-emerald-600 animate-bounce mb-1" />
            ) : (
              <Copy className="w-5 h-5 text-text-muted group-hover:text-text-main transition mb-1" />
            )}
            <span className="text-xs font-bold">{copied ? pt.copySuccess : pt.copyTranscript}</span>
            <span className="text-[9px] text-text-muted mt-0.5">
              {uiLanguage === "vi" ? "Lưu toàn bộ kịch bản" : "Send whole script"}
            </span>
          </button>

          <button
            onClick={() => handleShareZalo()}
            className="bg-bg-secondary border border-border-primary text-text-main hover:bg-[#ebf4ff] dark:hover:bg-sky-950/10 hover:border-sky-300 flex flex-col items-center justify-center p-4 rounded-2xl text-center transition-all cursor-pointer group hover:shadow-xs active:scale-97"
            title={uiLanguage === "vi" ? "Chia sẻ nhanh lên Zalo" : "Quick share to Zalo"}
          >
            <MessageSquare className="w-5 h-5 text-sky-500 group-hover:text-sky-600 transition mb-1" />
            <span className="text-xs font-bold text-text-main">{pt.shareZalo}</span>
            <span className="text-[9px] text-text-muted mt-0.5">via zalo.me</span>
          </button>

          <button
            onClick={() => handleShareFacebook()}
            className="bg-bg-secondary border border-border-primary text-text-main hover:bg-[#ecf1ff] dark:hover:bg-blue-950/10 hover:border-blue-300 flex flex-col items-center justify-center p-4 rounded-2xl text-center transition-all cursor-pointer group hover:shadow-xs active:scale-97"
            title={uiLanguage === "vi" ? "Chia sẻ nhanh lên Facebook" : "Quick share to Facebook"}
          >
            <Facebook className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition mb-1" />
            <span className="text-xs font-bold text-text-main">{pt.shareFacebook}</span>
            <span className="text-[9px] text-text-muted mt-0.5">via facebook.com</span>
          </button>

          {briefingId && (
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="bg-[#f0fdfa] dark:bg-teal-950/10 border border-teal-200 dark:border-teal-850 text-teal-850 dark:text-teal-400 hover:bg-[#ccfbf1] dark:hover:bg-teal-950/20 hover:border-teal-300 flex flex-col items-center justify-center p-4 rounded-2xl text-center transition-all cursor-pointer group hover:shadow-sm active:scale-97"
              title={uiLanguage === "vi" ? "Chia sẻ đa nền tảng" : "Multi-platform Share"}
            >
              <Share2 className="w-5 h-5 text-teal-600 group-hover:text-teal-700 transition mb-1 animate-pulse" />
              <span className="text-xs font-bold text-text-main">
                {uiLanguage === "vi" ? "Hộp chia sẻ lớn" : "Social Share Hub"}
              </span>
              <span className="text-[9px] text-text-muted mt-0.5">
                {uiLanguage === "vi" ? "Twitter, WA, LinkedIn..." : "Twitter, WA, LinkedIn..."}
              </span>
            </button>
          )}

          <div className="relative group/tooltip flex flex-col">
            <button
              onClick={() => handleDownloadWav()}
              disabled={audioChunks.length === 0 || isPreparingDownload}
              className="w-full bg-gradient-to-br from-amber-400 to-amber-500 border border-transparent text-slate-950 hover:from-amber-500 hover:to-amber-600 flex flex-col items-center justify-center p-4 rounded-2xl text-center shadow-xs transition-all cursor-pointer group/btn relative overflow-hidden active:scale-97 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span className="absolute top-1 right-1 px-1 py-0.5 text-[8px] font-bold font-mono bg-black/10 group-hover/btn:bg-black/15 transition rounded text-amber-900 tracking-wider">
                TikTok
              </span>
              {isPreparingDownload ? (
                <>
                  <span className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mb-1"></span>
                  <span className="text-xs font-bold leading-tight">
                    {uiLanguage === "vi" ? "Đang chuẩn bị..." : "Preparing..."}
                  </span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 text-slate-900 transition mb-1" />
                  <span className="text-xs font-bold leading-tight">{pt.downloadTiktok}</span>
                </>
              )}
              <span className="text-[9px] text-amber-950 mt-0.5">
                {uiLanguage === "vi" ? "Tải xuống file âm thanh" : "HQ sound WAV"}
              </span>
            </button>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-56 p-2.5 bg-slate-950 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity duration-200 shadow-lg text-center z-20 leading-relaxed border border-slate-700/60">
              {uiLanguage === "vi" 
                ? "Tải file âm thanh chất lượng cao, sau đó đăng lên TikTok cùng video của bạn."
                : "Download high-quality audio file, then post to TikTok along with your video."}
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-950"></div>
            </div>
          </div>
        </div>

        {/* Guided Share & Posting helper card */}
        <div className="bg-bg-secondary border border-border-primary rounded-xl p-3 text-text-muted text-[11px] leading-relaxed relative flex items-start gap-2">
          <span className="text-amber-550 pt-0.5 text-xs animate-bounce">💡</span>
          <div>
            <p className="font-bold text-text-main mb-0.5">
              {uiLanguage === "vi" ? "Hướng dẫn chia sẻ & Đăng tải mạng xã hội:" : "Social Media Sharing & Posting Guide:"}
            </p>
            <p className="text-text-muted">
              {uiLanguage === "vi" 
                ? "Bấm Chia sẻ để gửi nhanh bản tin này lên Zalo hoặc Facebook. Đối với TikTok/Reels, hãy tải file âm thanh chất lượng cao (.wav) về máy, sau đó ghép âm thanh này làm nhạc nền vào video sáng tạo của bạn!"
                : "Click Share to quickly post to Zalo or Facebook. For TikTok/Reels, download the high-quality .wav audio file first, then import/mix this background track into your video creation!"}
            </p>
          </div>
        </div>
      </div>

      {/* Read-Along Script Display */}
      <div className="bg-card-bg rounded-2xl border border-border-primary shadow-xs p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-text-main uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-600" />
            <span>{pt.scriptTitle}</span>
          </h4>
          <span className="text-xs text-text-muted font-medium">{pt.scriptSub}</span>
        </div>

        <div className="flex flex-col gap-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
          {allSegments.map((seg, sIdx) => {
            const isActive = currentPlayingIndex === sIdx;
            
            return (
              <div
                key={sIdx}
                ref={(el) => { segmentRefs.current[sIdx] = el; }}
                onClick={() => handleChapterClick(sIdx)}
                className={`text-left p-4 rounded-xl border transition-all duration-300 cursor-pointer group relative ${
                  isActive 
                    ? "bg-cyan-500/5 dark:bg-cyan-500/10 border-cyan-500 shadow-sm scale-[1.015] ring-2 ring-cyan-500/15 opacity-100 z-10" 
                    : "bg-bg-secondary border-border-primary hover:bg-surface-bg hover:border-text-muted opacity-60 hover:opacity-95 scale-100"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-mono tracking-wider uppercase font-semibold transition-colors duration-300 ${
                    isActive ? "text-cyan-700 dark:text-cyan-400" : "text-text-muted"
                  }`}>
                    {seg.type === "intro" ? pt.labelIntro : seg.type === "outro" ? pt.labelOutro : pt.labelTopic}
                  </span>
                  
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors duration-300 ${
                    isActive ? "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400" : "bg-surface-bg text-text-muted group-hover:bg-bg-secondary"
                  }`}>
                    {seg.title}
                  </span>
                </div>

                <p className={`text-sm leading-relaxed transition-all duration-300 mt-2 ${
                  isActive ? "text-text-main font-bold" : "text-text-muted font-normal"
                }`}>
                  {seg.text}
                </p>

                {seg.bullets && seg.bullets.length > 0 && (
                  <div className={`mt-3 pl-2.5 border-l-2 transition-colors duration-300 flex flex-col gap-1.5 ${
                    isActive ? "border-cyan-400" : "border-border-primary"
                  }`}>
                    {seg.bullets.map((b, bIdx) => (
                      <div key={bIdx} className="flex gap-2 items-start text-xs text-text-muted">
                        <FileCheck className={`w-3.5 h-3.5 mt-0.5 shrink-0 transition-colors duration-300 ${
                          isActive ? "text-cyan-600 dark:text-cyan-400" : "text-text-muted"
                        }`} />
                        <span className={isActive ? "text-text-main font-medium" : ""}>{b}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
    {briefingId && (
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        briefingId={briefingId}
        uiLanguage={uiLanguage}
      />
    )}
    </>
  );
}