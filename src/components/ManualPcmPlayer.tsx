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
  ChevronRight,
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

interface ManualPcmPlayerProps {
  payload: SummaryPayload;
  audioChunks: string[]; // Base64 audio per segment: [Intro, ...Chapters, Conclusion]
  title?: string;
  preferencesInfo?: string;
  uiLanguage?: "vi" | "en";
  briefingId?: string;
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

export default function ManualPcmPlayer({ payload, audioChunks, title, preferencesInfo, uiLanguage = "vi", briefingId }: ManualPcmPlayerProps) {
  const { preferences: userPref, updateDrivingMode } = useUserPreferences();
  const pt = playerTranslations[uiLanguage];
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(userPref.speed || 1.0);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(0);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(0);
  const activeSegmentIndexRef = useRef(0);
  const [currentPlayingIndex, setCurrentPlayingIndex] = useState(0);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Synchronize currentPlayingIndex with activeSegmentIndex
  useEffect(() => {
    setCurrentPlayingIndex(activeSegmentIndex);
  }, [activeSegmentIndex]);

  // Handle auto-scroll into view when segment changes
  useEffect(() => {
    const activeEl = segmentRefs.current[currentPlayingIndex];
    if (activeEl) {
      activeEl.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [currentPlayingIndex]);

  // Sync playbackRate with user preferences speed
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
  const [bgMusicVolume, setBgMusicVolume] = useState<number>(0.25);
  const bgOscsRef = useRef<OscillatorNode[]>([]);
  const bgGainRef = useRef<GainNode | null>(null);

  // Studio and custom state structures
  const [volume, setVolume] = useState<number>(0.9);
  const [frequencyData, setFrequencyData] = useState<number[]>(new Array(32).fill(12));
  const [copied, setCopied] = useState(false);
  const [isPreparingDownload, setIsPreparingDownload] = useState(false);
  
  // Timing references
  const startTimeCtxRef = useRef<number>(0);
  const elapsedOffsetRef = useRef<number>(0); // how many seconds have we played since start
  const animFrameIdRef = useRef<number | null>(null);
  
  // Segment durations and cumulative offsets for "Read-along highlighting"
  const [segmentOffsets, setSegmentOffsets] = useState<{ start: number; end: number }[]>([]);

  // Prepare segments & text for quick highlighting match
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

  // 1. Initialize audio buffer when chunks change
  useEffect(() => {
    let active = true;

    const initAudio = async () => {
      if (!audioChunks || audioChunks.length === 0) {
        setSegmentOffsets([]);
        setTotalDuration(0);
        mainBufferRef.current = null;
        return;
      }

      // Reset player states
      stopAudio();
      setIsPlaying(false);
      setCurrentTime(0);
      elapsedOffsetRef.current = 0;

      try {
        // Create an AudioContext for decoding and playback
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioCtxRef.current = audioCtx;

        const decodedBuffers: AudioBuffer[] = [];

        for (let i = 0; i < audioChunks.length; i++) {
          if (!active) return;
          const chunk = audioChunks[i];
          const arrayBuffer = base64ToArrayBuffer(chunk);

          try {
            // decodeAudioData consumes the arrayBuffer, so we decode a fresh copy if needed.
            const decoded = await audioCtx.decodeAudioData(arrayBuffer);
            decodedBuffers.push(decoded);
          } catch (decodeErr) {
            console.warn(`[ManualPcmPlayer] Standard decodeAudioData failed for chunk ${i + 1}, trying raw PCM fallback...`, decodeErr);
            try {
              // Fallback: If the chunk is raw headerless PCM, parse manually
              const rawPCM = base64ToArrayBuffer(chunk);
              const floatArray = pcmToFloat32(rawPCM);
              const fallbackBuf = audioCtx.createBuffer(1, floatArray.length, 24000);
              fallbackBuf.getChannelData(0).set(floatArray);
              decodedBuffers.push(fallbackBuf);
            } catch (pcmErr) {
              console.error(`[ManualPcmPlayer] Fallback PCM decoding also failed for chunk ${i + 1}:`, pcmErr);
            }
          }
        }

        if (!active) return;
        if (decodedBuffers.length === 0) {
          throw new Error("No audio chunks could be decoded successfully.");
        }

        // Calculate sizes, channels, and offsets
        const sampleRate = decodedBuffers[0].sampleRate;
        const numberOfChannels = Math.max(...decodedBuffers.map(b => b.numberOfChannels));
        
        let totalSamples = 0;
        const offsets: { start: number; end: number }[] = [];

        decodedBuffers.forEach((buf) => {
          const startSec = totalSamples / sampleRate;
          totalSamples += Math.round(buf.duration * sampleRate);
          const endSec = totalSamples / sampleRate;
          offsets.push({ start: startSec, end: endSec });
        });

        if (!active) return;
        setSegmentOffsets(offsets);
        setTotalDuration(totalSamples / sampleRate);

        // Concatenate buffers into a single unified AudioBuffer
        const unifiedBuffer = audioCtx.createBuffer(numberOfChannels, totalSamples, sampleRate);
        for (let channel = 0; channel < numberOfChannels; channel++) {
          const outputChannel = unifiedBuffer.getChannelData(channel);
          let writeOffset = 0;
          decodedBuffers.forEach((buf) => {
            const bufSamples = Math.round(buf.duration * sampleRate);
            if (channel < buf.numberOfChannels) {
              const srcData = buf.getChannelData(channel);
              // If the chunk sample rate matches, copy directly; otherwise, resample slightly or set safely
              if (srcData.length === bufSamples) {
                outputChannel.set(srcData, writeOffset);
              } else {
                // Safe guard to prevent out-of-bounds
                const copyLength = Math.min(srcData.length, bufSamples);
                outputChannel.set(srcData.subarray(0, copyLength), writeOffset);
              }
            }
            writeOffset += bufSamples;
          });
        }

        mainBufferRef.current = unifiedBuffer;
        console.log(`[ManualPcmPlayer] Successfully decoded and concatenated ${decodedBuffers.length} audio segments. Total duration: ${(totalSamples / sampleRate).toFixed(2)}s.`);

      } catch (err) {
        console.error("Failed to construct audio buffer:", err);
      }
    };

    initAudio();

    return () => {
      active = false;
      stopAudio();
    };
  }, [audioChunks]);

  // Play beautiful, procedural pentatonic chime transition jingles between chapters
  const playJingle = () => {
    if (!audioCtxRef.current) return;
    try {
      const now = audioCtxRef.current.currentTime;
      // Pentatonic scale notes: E5 (659.25Hz), G5 (783.99Hz), A5 (880Hz), B5 (987.77Hz), E6 (1318.51Hz)
      const notes = [659.25, 783.99, 880.00, 987.77, 1318.51];
      const noteDurations = [0.12, 0.12, 0.12, 0.12, 0.40];
      const startOffsets = [0, 0.10, 0.20, 0.30, 0.40];

      notes.forEach((freq, idx) => {
        const osc = audioCtxRef.current!.createOscillator();
        const jingleGain = audioCtxRef.current!.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + startOffsets[idx]);

        // Jingle envelope: fast attack, exponential decay for chime bell sounds
        jingleGain.gain.setValueAtTime(0, now + startOffsets[idx]);
        jingleGain.gain.linearRampToValueAtTime(volume * 0.12, now + startOffsets[idx] + 0.01);
        jingleGain.gain.exponentialRampToValueAtTime(0.001, now + startOffsets[idx] + noteDurations[idx]);

        osc.connect(jingleGain);
        jingleGain.connect(audioCtxRef.current!.destination);

        osc.start(now + startOffsets[idx]);
        osc.stop(now + startOffsets[idx] + noteDurations[idx]);
      });
    } catch (err) {
      console.warn("Failed to play transition jingle:", err);
    }
  };

  // Start procedural background ambient music drone (Completely disabled as requested to prevent any annoying background noise)
  const startBgMusic = () => {
    return;
  };

  const stopBgMusic = () => {
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

  // Sync background music play state
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

  // Adjust background music volume smoothly live
  useEffect(() => {
    if (bgGainRef.current && audioCtxRef.current) {
      bgGainRef.current.gain.setTargetAtTime(bgMusicVolume * volume * 0.12, audioCtxRef.current.currentTime, 0.1);
    }
  }, [bgMusicVolume, volume]);

  // Adjust playback rate live
  useEffect(() => {
    if (sourceNodeRef.current && isPlaying) {
      sourceNodeRef.current.playbackRate.value = playbackRate;
      // adjust startTimeCtx so elapsed offset computes accurately
      const elapsedSoFar = currentTime;
      startTimeCtxRef.current = audioCtxRef.current!.currentTime;
      elapsedOffsetRef.current = elapsedSoFar;
    }
  }, [playbackRate]);

  // Constantly update progress tracker
  const startTrackingProgress = () => {
    if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);

    const updateProgress = () => {
      if (!audioCtxRef.current || !isPlaying) return;

      const now = audioCtxRef.current.currentTime;
      const elapsedSeconds = elapsedOffsetRef.current + (now - startTimeCtxRef.current) * playbackRate;

      if (elapsedSeconds >= totalDuration) {
        // finished playback
        setCurrentTime(totalDuration);
        setIsPlaying(false);
        stopAudio();
        elapsedOffsetRef.current = 0;
        setActiveSegmentIndex(0);
        activeSegmentIndexRef.current = 0;
        return;
      }

      setCurrentTime(elapsedSeconds);

      // Identify active segment highlight
      const activeIdx = segmentOffsets.findIndex(
        (offset) => elapsedSeconds >= offset.start && elapsedSeconds <= offset.end
      );
      if (activeIdx !== -1) {
        if (activeIdx !== activeSegmentIndexRef.current) {
          // Play a sweet transition jingle between chapters
          if (activeIdx > 0) {
            playJingle();
          }
          activeSegmentIndexRef.current = activeIdx;
          setActiveSegmentIndex(activeIdx);
        }
      }

      // Read Web Audio frequency spectrum livedata
      if (analyserRef.current) {
        const dataArr = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(dataArr);
        const values: number[] = [];
        for (let i = 0; i < 32; i++) {
          // Normalize standard speech frequency weights nicely for display
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
      } catch (err) {
        // already stopped
      }
      sourceNodeRef.current = null;
    }
  };

  const playAudio = (offset: number) => {
    if (!mainBufferRef.current || !audioCtxRef.current) return;

    stopAudio();

    // Resume AudioContext if suspended (browser constraints)
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }

    const source = audioCtxRef.current.createBufferSource();
    source.buffer = mainBufferRef.current;
    source.playbackRate.value = playbackRate;

    // Create and attach Analyser and Gain Node chain
    const analyser = audioCtxRef.current.createAnalyser();
    analyser.fftSize = 64; // 32 spectrum bins
    analyser.smoothingTimeConstant = 0.75;
    analyserRef.current = analyser;

    const gainNode = audioCtxRef.current.createGain();
    gainNode.gain.value = volume;
    gainNodeRef.current = gainNode;

    source.connect(analyser);
    analyser.connect(gainNode);
    gainNode.connect(audioCtxRef.current.destination);

    // Apply offset bounds
    const safeOffset = Math.max(0, Math.min(offset, totalDuration));
    
    // Start playback
    source.start(0, safeOffset);
    sourceNodeRef.current = source;

    startTimeCtxRef.current = audioCtxRef.current.currentTime;
    elapsedOffsetRef.current = safeOffset;
    setIsPlaying(true);
  };

  useEffect(() => {
    if (isPlaying) {
      startTrackingProgress();
    } else {
      stopTrackingProgress();
    }
  }, [isPlaying]);

  // Adjust volume active node live
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
  }, [volume]);

  // Slowly animate virtual room acoustics/wave when idle
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

  const handlePlayPause = () => {
    if (isPlaying) {
      // Pause
      setIsPlaying(false);
      stopAudio();
    } else {
      // Play
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
      // find static segment index highlight manually
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

  // WAV File Downloader with server-side prepare flow for mobile/in-app/iframe compatibility
  const handleDownloadWav = async () => {
    if (isPreparingDownload) return;
    setIsPreparingDownload(true);

    try {
      // Fetch server-side prepared temporary file URL
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

    // Client-side fallback if server api is unavailable or fails
    try {
      const arrayBuffers = audioChunks.map(chunk => base64ToArrayBuffer(chunk));
      
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
      
      // Chiến lược sao chép thông minh chống lỗi Iframe Sandbox / HTTP không bảo mật
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

    // Phát hiện thiết bị di động (Mobile/Tablet)
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    if (isMobile) {
      // Trên Mobile: Ưu tiên Deep Link mở trực tiếp ứng dụng Zalo đã cài trên máy để chia sẻ lập tức
      const mobileShareLink = `zalo://app?action=share&url=${encodedUrl}&title=${encodedTitle}`;
      // Giao diện Web App hoặc đăng nhập Zalo sạch sẽ cho mobile nếu không có app hoặc chưa log in
      const backupWebLink = `https://zalo.me/share?url=${encodedUrl}&title=${encodedTitle}`;
      
      // Chuyển hướng đến ứng dụng Zalo
      window.location.href = mobileShareLink;

      // Đặt cơ chế tự động dự phòng: Nếu không mở được app Zalo (ví dụ máy chưa cài),
      // thì sau 1.5 giây sẽ tự định tuyến sang trang web của Zalo - nơi có giao diện đăng nhập chia sẻ cực tiện lợi
      setTimeout(() => {
        if (!document.hidden) {
          window.location.href = backupWebLink;
        }
      }, 1500);
    } else {
      // Trên Desktop: Sử dụng liên kết Zalo Share Web mở ra Popup đăng nhập bằng QR Code / Số điện thoại để chia sẻ
      const webShareLink = `https://sp.zalo.me/share_to_zalo?url=${encodedUrl}&title=${encodedTitle}`;
      window.open(webShareLink, "_blank", "width=600,height=500,scrollbars=yes,resizable=yes");
    }
  };

  const handleShareFacebook = () => {
    const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`;
    window.open(shareUrl, "_blank", "width=600,height=550,scrollbars=yes,resizable=yes");
  };

  // Helper formatting for seconds to MM:SS
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
        
        {/* Futuristic Grid Overlay Background */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none opacity-20" />
        
        {/* Glow Circles */}
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

        {/* Snappy Title display */}
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

        {/* Dynamic Waveform Visualizer - Connected directly to the real frequency analyzer */}
        <div className="relative z-10 h-14 flex items-end justify-between gap-[3px] px-2.5 mb-4 bg-slate-950/60 rounded-2xl py-3 border border-slate-850">
          {frequencyData.map((val, barIdx) => {
            // Scale val (0-255) to height (typically 4px - 44px)
            const heightPx = Math.max(4, Math.min(44, (val / 255) * 40));
            // Highlight bar index according to temporal progress
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
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />
          <div className="flex justify-between items-center mt-2 text-xs text-slate-400 font-mono">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(totalDuration)}</span>
          </div>
        </div>

        {/* Controls Layout */}
        <div className="relative z-10 flex flex-wrap justify-between items-center gap-4 pt-1 border-t border-slate-800/80">
          
          {/* Rate speed selector */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-slate-500 font-mono uppercase mr-1">{pt.speed}</span>
            <div className="bg-slate-800/80 p-0.5 rounded-lg flex border border-slate-700/40">
              {[0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                <button
                  key={rate}
                  onClick={() => setPlaybackRate(rate)}
                  className={`px-1.5 py-1 text-[10px] font-mono rounded font-bold transition-all ${
                    playbackRate === rate 
                      ? "bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-900" 
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {rate}x
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Playback controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSkip(-10)}
              title={uiLanguage === "vi" ? "Tua lại 10 giây" : "Rewind 10 seconds"}
              className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition border border-slate-700/20"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <motion.button
              onClick={() => handlePlayPause()}
              disabled={audioChunks.length === 0}
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
              className="p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition border border-slate-700/20"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Master export trigger */}
          <button
            onClick={() => handleDownloadWav()}
            disabled={isPreparingDownload}
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

      </div>

      {/* Share Control & Studio Effects Panel */}
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-6 shadow-xs flex flex-col gap-5 sm:mt-1" id="studio-share-suite">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/60 pb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-600 animate-pulse" />
              <span>{pt.studioCenter}</span>
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">{pt.studioDesc}</p>
          </div>
          
          {/* Studio Stream Indicator */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5 self-start shadow-2xs">
            <span className="relative flex h-2 w-2">
              <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isPlaying ? "animate-ping bg-red-500" : "bg-slate-300"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isPlaying ? "bg-red-500" : "bg-slate-400"
              }`}></span>
            </span>
            <span className="text-[10px] font-mono font-bold text-slate-600 tracking-wider">
              {isPlaying ? "ON AIR / STREAM SYSTEM" : "STUDIO STANDBY / READY"}
            </span>
          </div>
        </div>

        {/* Studio Mixer: Multi-channel Volume adjust */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-white border border-slate-150 rounded-2xl p-4 shadow-sm">
          <div className="flex flex-col gap-1 col-span-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 font-mono">
              <Radio className="w-3.5 h-3.5 text-cyan-500" />
              {pt.studioEfx}
            </span>
            <span className="text-xs text-slate-500 leading-normal">
              {uiLanguage === "vi" 
                ? "Bản tin tích hợp nhạc nền không gian, hiệu ứng jingle chuyển chương và điều chỉnh âm lượng đa kênh chuyên nghiệp." 
                : "Professional multi-channel audio deck including space ambience, chapter jingles, and master volume sliders."}
            </span>
          </div>

          {/* Master Voice Volume */}
          <div className="flex flex-col gap-2 justify-center col-span-1">
            <div className="flex justify-between items-center">
              <label htmlFor="volume-slider" className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 select-none">
                <Volume2 className="w-4 h-4 text-slate-400" />
                <span>{pt.volumeLabel}</span>
              </label>
              <span className="text-xs font-mono font-bold text-cyan-700 bg-cyan-50 border border-cyan-100 rounded-md px-2 py-0.5">
                {Math.round(volume * 100)}%
              </span>
            </div>
            <input
              id="volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-cyan-500 hover:accent-cyan-600 transition"
            />
          </div>

          {/* Background Music Config Removed */}
        </div>

        {/* Sharing Utility Group */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          
          {/* Copy Transcript Button */}
          <button
            onClick={() => handleCopyTranscript()}
            className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center transition-all cursor-pointer group hover:shadow-xs active:scale-97 ${
              copied 
                ? "bg-emerald-55/70 border-emerald-300 text-emerald-800 shadow-inner" 
                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300"
            }`}
          >
            {copied ? (
              <Check className="w-5 h-5 text-emerald-600 animate-bounce mb-1" />
            ) : (
              <Copy className="w-5 h-5 text-slate-400 group-hover:text-slate-700 transition mb-1" />
            )}
            <span className="text-xs font-bold">{copied ? pt.copySuccess : pt.copyTranscript}</span>
            <span className="text-[9px] text-slate-400 mt-0.5">
              {uiLanguage === "vi" ? "Lưu toàn bộ kịch bản" : "Send whole script"}
            </span>
          </button>

          {/* Zalo Share Button */}
          <button
            onClick={() => handleShareZalo()}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-[#ebf4ff] hover:border-sky-300 flex flex-col items-center justify-center p-4 rounded-2xl text-center transition-all cursor-pointer group hover:shadow-xs active:scale-97"
            title={uiLanguage === "vi" ? "Chia sẻ nhanh lên Zalo" : "Quick share to Zalo"}
          >
            <MessageSquare className="w-5 h-5 text-sky-500 group-hover:text-sky-600 transition mb-1" />
            <span className="text-xs font-bold text-slate-800">{pt.shareZalo}</span>
            <span className="text-[9px] text-slate-400 mt-0.5">via zalo.me</span>
          </button>

          {/* Facebook Share Button */}
          <button
            onClick={() => handleShareFacebook()}
            className="bg-white border border-slate-200 text-slate-700 hover:bg-[#ecf1ff] hover:border-blue-300 flex flex-col items-center justify-center p-4 rounded-2xl text-center transition-all cursor-pointer group hover:shadow-xs active:scale-97"
            title={uiLanguage === "vi" ? "Chia sẻ nhanh lên Facebook" : "Quick share to Facebook"}
          >
            <Facebook className="w-5 h-5 text-blue-600 group-hover:text-blue-700 transition mb-1" />
            <span className="text-xs font-bold text-slate-800">{pt.shareFacebook}</span>
            <span className="text-[9px] text-slate-400 mt-0.5">via facebook.com</span>
          </button>

          {/* Multi-Platform Social Hub Share Button */}
          {briefingId && (
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="bg-[#f0fdfa] border border-teal-200 text-teal-800 hover:bg-[#ccfbf1] hover:border-teal-300 flex flex-col items-center justify-center p-4 rounded-2xl text-center transition-all cursor-pointer group hover:shadow-sm active:scale-97"
              title={uiLanguage === "vi" ? "Chia sẻ đa nền tảng" : "Multi-platform Share"}
            >
              <Share2 className="w-5 h-5 text-teal-600 group-hover:text-teal-700 transition mb-1 animate-pulse" />
              <span className="text-xs font-bold text-slate-800">
                {uiLanguage === "vi" ? "Hộp chia sẻ lớn" : "Social Share Hub"}
              </span>
              <span className="text-[9px] text-slate-400 mt-0.5">
                {uiLanguage === "vi" ? "Twitter, WA, LinkedIn..." : "Twitter, WA, LinkedIn..."}
              </span>
            </button>
          )}

          {/* Download Audio trigger configured for TikTok with hover tooltip */}
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
        <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-slate-500 text-[11px] leading-relaxed relative flex items-start gap-2">
          <span className="text-amber-550 pt-0.5 text-xs animate-bounce">💡</span>
          <div>
            <p className="font-bold text-slate-700 mb-0.5">
              {uiLanguage === "vi" ? "Hướng dẫn chia sẻ & Đăng tải mạng xã hội:" : "Social Media Sharing & Posting Guide:"}
            </p>
            <p className="text-slate-600">
              {uiLanguage === "vi" 
                ? "Bấm Chia sẻ để gửi nhanh bản tin này lên Zalo hoặc Facebook. Đối với TikTok/Reels, hãy tải file âm thanh chất lượng cao (.wav) về máy, sau đó ghép âm thanh này làm nhạc nền vào video sáng tạo của bạn!"
                : "Click Share to quickly post to Zalo or Facebook. For TikTok/Reels, download the high-quality .wav audio file first, then import/mix this background track into your video creation!"}
            </p>
          </div>
        </div>
      </div>

      {/* Read-Along Script Display */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-600" />
            <span>{pt.scriptTitle}</span>
          </h4>
          <span className="text-xs text-slate-550 font-medium">{pt.scriptSub}</span>
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
                    ? "bg-cyan-50/40 border-cyan-500 shadow-md scale-[1.015] ring-2 ring-cyan-500/15 opacity-100 z-10" 
                    : "bg-white border-slate-150 hover:bg-slate-50/50 hover:border-slate-300 opacity-60 hover:opacity-90 scale-100"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-mono tracking-wider uppercase font-semibold transition-colors duration-300 ${
                    isActive ? "text-cyan-700" : "text-slate-400"
                  }`}>
                    {seg.type === "intro" ? pt.labelIntro : seg.type === "outro" ? pt.labelOutro : pt.labelTopic}
                  </span>
                  
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-colors duration-300 ${
                    isActive ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
                  }`}>
                    {seg.title}
                  </span>
                </div>

                <p className={`text-sm leading-relaxed transition-all duration-300 mt-2 ${
                  isActive ? "text-slate-900 font-bold" : "text-slate-650 font-normal"
                }`}>
                  {seg.text}
                </p>

                {/* Bullets takeaways (if chapters have them) */}
                {seg.bullets && seg.bullets.length > 0 && (
                  <div className={`mt-3 pl-2.5 border-l-2 transition-colors duration-300 flex flex-col gap-1.5 ${
                    isActive ? "border-cyan-450" : "border-slate-200"
                  }`}>
                    {seg.bullets.map((b, bIdx) => (
                      <div key={bIdx} className="flex gap-2 items-start text-xs text-slate-600">
                        <FileCheck className={`w-3.5 h-3.5 mt-0.5 shrink-0 transition-colors duration-300 ${
                          isActive ? "text-cyan-600" : "text-slate-400"
                        }`} />
                        <span className={isActive ? "text-slate-800 font-medium" : ""}>{b}</span>
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
