import React, { useState } from "react";
import { Sparkles, Play, Globe, Check } from "lucide-react";
import { SavedSummary, SummaryPayload, SummaryPreferences } from "../types";

interface SampleBriefingsProps {
  saveNewBriefing: (item: SavedSummary) => Promise<boolean>;
  onPlaySample: (item: SavedSummary) => void;
  uiLanguage?: "vi" | "en";
}

// Helper to convert an ArrayBuffer directly to a base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Generates beautiful synthetic 16-bit Mono 24kHz PCM chimes of specific duration & note pitch
function generateSyntheticChime(durationSec: number, frequency: number): string {
  const sampleRate = 24000;
  const numSamples = Math.floor(durationSec * sampleRate);
  const buffer = new ArrayBuffer(numSamples * 2);
  const view = new DataView(buffer);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    
    // Smooth fade-in (first 0.3s) and long ringing fade-out envelope
    let envelope = 1.0;
    if (t < 0.3) {
      envelope = t / 0.3;
    } else {
      envelope = Math.max(0, 1.0 - (t - 0.3) / (durationSec - 0.3));
    }

    // Combine simple tones to make it sound richer like an instrument chime (fundamental + harmonics)
    const wave = 
      Math.sin(2 * Math.PI * frequency * t) * 0.6 +
      Math.sin(2 * Math.PI * frequency * 2 * t) * 0.25 + 
      Math.sin(2 * Math.PI * frequency * 3 * t) * 0.15;

    const sampleVal = wave * 16000 * envelope;
    view.setInt16(i * 2, Math.floor(sampleVal), true);
  }

  return arrayBufferToBase64(buffer);
}

export default function SampleBriefings({ saveNewBriefing, onPlaySample, uiLanguage = "vi" }: SampleBriefingsProps) {
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);

  const t = {
    vi: {
      sectionTitle: "Bản Tin Mẫu Trực Quan",
      sectionDesc: "Trải nghiệm CommuteCast ngay lập tức bằng các bản tin mẫu chất lượng cao mà không tốn dung lượng API hay thời gian tải kịch bản.",
      playBtn: "Phát bản tin mẫu",
      playBtnLoading: "Đang dệt nhạc phát thanh...",
      tagVi: "Tiếng Việt",
      tagEn: "Tiếng Anh"
    },
    en: {
      sectionTitle: "Interactive Sample Briefings",
      sectionDesc: "Try CommuteCast instantly with high-fidelity pre-compiled sample broadcasts without using your API quota.",
      playBtn: "Play Sample Brief",
      playBtnLoading: "Weaving audio track...",
      tagVi: "Vietnamese",
      tagEn: "English"
    }
  }[uiLanguage];

  const samples = [
    {
      id: "sample-vietnamese",
      language: "vi" as const,
      tag: t.tagVi,
      title: "Bản tin Hành trình Đô thị Việt Nam",
      preferences: {
        targetDuration: "medium" as const,
        tone: "conversational" as const,
        voice: "vi-HN" as const,
        focus: "giao thông đô thị thông minh và tin nhanh công nghệ nổi bật",
        commuteType: "driving" as const,
        customInstructions: "",
        language: "vi" as const
      },
      payload: {
        title: "Bản tin Hành trình Đô thị Việt Nam",
        introduction: "Chào mừng quý thính giả đến với CommuteCast. Đây là bản tin hành trình đô thị cá nhân hóa dành riêng cho bạn vào sáng hôm nay. Hãy cùng điểm qua các thông tin giao thông và công nghệ nổi bật.",
        chapters: [
          {
            topic: "Tuyến Metro số 1 TP.HCM thử nghiệm thành công toàn tuyến",
            scriptText: "Tuyến đường sắt đô thị số 1 Bến Thành - Suối Tiên đã hoàn thành thử nghiệm kỹ thuật cuối cùng với sự tham gia của hàng ngàn người dân. Hệ thống vận hành tự động thông minh giúp rút ngắn thời gian di chuyển từ quận 1 đến Thủ Đức xuống chỉ còn 20 phút.",
            summaryBullets: [
              "Vận hành thử nghiệm toàn tuyến thành công",
              "Rút ngắn thời gian di chuyển từ trung tâm xuống 20 phút",
              "Hệ thống thông minh và an toàn đạt chuẩn quốc tế"
            ]
          },
          {
            topic: "Giải pháp chuyển đổi số thông minh cho giao thông Hà Nội",
            scriptText: "Hà Nội vừa thí điểm hệ thống camera AI tại các ngã tư trọng điểm để tự động điều chỉnh chu kỳ đèn tín hiệu. Công nghệ này giúp giảm thiểu 20% tình trạng ùn tắc giao thông vào giờ cao điểm, giúp hành trình di chuyển của bạn thuận lợi hơn.",
            summaryBullets: [
              "Thí điểm camera AI giám sát thông minh",
              "Giảm thiểu 20% ùn tắc giao thông",
              "Hỗ trợ tự động tối ưu hóa tín hiệu đèn"
            ]
          }
        ],
        conclusion: "Cảm ơn bạn đã đồng hành cùng CommuteCast Việt Nam. Chúc bạn một ngày mới tràn đầy năng lượng và có một chuyến hành trình an toàn, thuận lợi. Hẹn gặp lại trong bản tin tiếp theo!"
      }
    },
    {
      id: "sample-english",
      language: "en" as const,
      tag: t.tagEn,
      title: "CommuteCast International Tech Review",
      preferences: {
        targetDuration: "medium" as const,
        tone: "informative" as const,
        voice: "en-US" as const,
        focus: "global electric transit grids and artificial intelligence developments",
        commuteType: "transit" as const,
        customInstructions: "",
        language: "en" as const
      },
      payload: {
        title: "CommuteCast International Tech Review",
        introduction: "Welcome back to CommuteCast, your personalized daily audio feed. Today, we bring you the latest breakthroughs in smart transit technology and green urban computing. Let's dive in!",
        chapters: [
          {
            topic: "Electric Micro-Mobility Sweeps European Capitals",
            scriptText: "Cities like Paris and Amsterdam have integrated modern multi-modal e-bike sharing schemes directly into their rapid-transit rail grids. Commuters can now seamlessly transition from subways to electric micro-vehicles, slicing average journey times by 25 minutes.",
            summaryBullets: [
              "Direct integration with rapid-transit rail grids",
              "Reduces average commute by 25 minutes",
              "Promotes eco-friendly active travel"
            ]
          },
          {
            topic: "Gemini-Powered Navigation Systems Launched",
            scriptText: "New navigation platforms running on Gemini AI are now offering predictive rerouting. Rather than reacting to traffic jams after they form, the system analyzes historic commute flows to predict congestion 15 minutes before it occurs, guiding you through clearer paths.",
            summaryBullets: [
              "Powered by Gemini predictive AI routing",
              "Congestion predicted 15 minutes in advance",
              "Optimized paths to ensure seamless travel"
            ]
          }
        ],
        conclusion: "That wraps up today's global commute update. Have a safe, pleasant, and highly productive day ahead. See you tomorrow!"
      }
    }
  ];

  const handlePlaySampleClick = async (sample: typeof samples[0]) => {
    if (loadingSampleId) return;
    setLoadingSampleId(sample.id);

    try {
      // Create distinct melodic chime notes for each audio segment dynamically (intro, chapter 1, chapter 2, outro)
      const introAudio = generateSyntheticChime(5.5, 440);      // Note A4 (440Hz)
      const ch1Audio = generateSyntheticChime(8.0, 554.37);    // Note C#5 (554Hz)
      const ch2Audio = generateSyntheticChime(8.0, 659.25);    // Note E5 (659Hz)
      const outroAudio = generateSyntheticChime(6.0, 880);      // Note A5 (880Hz)

      const savedItem: SavedSummary = {
        id: `sample-${Date.now()}`,
        timestamp: new Date().toLocaleString("vi-VN", { hour12: false }),
        preferences: sample.preferences as any,
        payload: sample.payload,
        audioChunks: [introAudio, ch1Audio, ch2Audio, outroAudio]
      };

      // Save into IndexedDB so it persists and displays in the history
      const savedSuccess = await saveNewBriefing(savedItem);
      if (savedSuccess) {
        // Trigger select and automatic preview play immediately!
        onPlaySample(savedItem);
      }
    } catch (err) {
      console.error("Failed to compile or play sample briefing:", err);
    } finally {
      setLoadingSampleId(null);
    }
  };

  return (
    <div className="bg-slate-50 rounded-3xl border border-slate-200 p-5 flex flex-col gap-4 text-left" id="sample-briefings-panel">
      <div>
        <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-4.5 h-4.5 text-amber-550 animate-pulse" />
          <span>{t.sectionTitle}</span>
        </h4>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
          {t.sectionDesc}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {samples.map((sample) => {
          const isLoading = loadingSampleId === sample.id;
          return (
            <div
              key={sample.id}
              className="bg-white border border-slate-150 p-4 rounded-2xl flex flex-col justify-between gap-3 shadow-2xs hover:border-slate-300 transition"
            >
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    sample.language === "vi" 
                      ? "bg-red-50 text-red-700 border border-red-100" 
                      : "bg-blue-50 text-blue-750 border border-blue-100"
                  }`}>
                    {sample.tag}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">27s Synth Feed</span>
                </div>
                <h5 className="text-xs font-extrabold text-slate-800 tracking-tight leading-snug">
                  {sample.title}
                </h5>
                <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {sample.payload.introduction}
                </p>
              </div>

              <button
                onClick={() => handlePlaySampleClick(sample)}
                disabled={loadingSampleId !== null}
                className={`w-full flex items-center justify-center gap-2 text-xs font-bold py-2 px-3 rounded-xl transition cursor-pointer active:scale-97 disabled:opacity-50 ${
                  isLoading
                    ? "bg-cyan-50 text-cyan-600 border border-cyan-200"
                    : "bg-cyan-600 hover:bg-cyan-700 text-white border border-transparent shadow-2xs"
                }`}
              >
                {isLoading ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-cyan-600 border-t-transparent rounded-full animate-spin"></span>
                    <span>{t.playBtnLoading}</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t.playBtn}</span>
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
