import { SavedSummary } from "../types";

export async function generateCoverImage(title: string, dateStr: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 630;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve("");
        return;
      }

      // 1. Draw beautiful dark gradient background matching CommuteCast identity
      const grad = ctx.createLinearGradient(0, 0, 1200, 630);
      grad.addColorStop(0, "#020617"); // Slate 950
      grad.addColorStop(0.5, "#0f172a"); // Slate 900
      grad.addColorStop(1, "#083344"); // Cyan 950
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1200, 630);

      // 2. Decorative glowing curves and audio wave symbols
      ctx.strokeStyle = "rgba(34, 211, 238, 0.12)"; // Cyan 400
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        ctx.arc(1050, 315, 180 + i * 55, 0, Math.PI * 2);
      }
      ctx.stroke();

      ctx.strokeStyle = "rgba(245, 158, 11, 0.08)"; // Amber 500
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        ctx.arc(150, 480, 140 + i * 45, 0, Math.PI * 2);
      }
      ctx.stroke();

      // 3. Draw CommuteCast Logo Branding
      // Glow background for icon
      ctx.fillStyle = "rgba(34, 211, 238, 0.15)";
      ctx.beginPath();
      ctx.arc(120, 100, 32, 0, Math.PI * 2);
      ctx.fill();

      // Draw custom radio waves icon
      ctx.strokeStyle = "#22d3ee"; // Cyan 400
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(120, 100, 18, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(120, 100, 10, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.fillStyle = "#f59e0b"; // Amber 500
      ctx.beginPath();
      ctx.arc(120, 100, 5, 0, Math.PI * 2);
      ctx.fill();

      // Brand text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 38px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
      ctx.fillText("CommuteCast", 175, 112);

      // Status indicator line
      ctx.fillStyle = "#22d3ee";
      ctx.font = "bold 15px 'JetBrains Mono', 'Fira Code', monospace";
      ctx.fillText("● PERSONAL STATION", 175, 138);

      // 4. Creation Date Badge
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(120 + 10, 210, 15, Math.PI / 2, (3 * Math.PI) / 2);
      ctx.lineTo(340 + 10, 195);
      ctx.arc(340 + 10, 210, 15, -Math.PI / 2, Math.PI / 2);
      ctx.lineTo(120 + 10, 225);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "14px system-ui, sans-serif";
      ctx.fillText(`📅  CREATED ON: ${dateStr}`, 145, 215);

      // 5. Briefing Title (Multi-line wrap helper)
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 52px system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
      
      const words = title.split(" ");
      let line = "";
      const maxWidth = 960;
      const lineHeight = 70;
      let x = 120;
      let y = 310;

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + " ";
        const metrics = ctx.measureText(testLine);
        const testWidth = metrics.width;
        if (testWidth > maxWidth && n > 0) {
          ctx.fillText(line, x, y);
          line = words[n] + " ";
          y += lineHeight;
        } else {
          line = testLine;
        }
      }
      ctx.fillText(line, x, y);

      // 6. Subtext / Tagline
      ctx.fillStyle = "#64748b";
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText("Listen to your personalized AI commute radio podcast. Created on CommuteCast.", 120, 560);

      resolve(canvas.toDataURL("image/png"));
    } catch (err) {
      console.error("Cover image generation failed, falling back to empty string:", err);
      resolve("");
    }
  });
}

export async function saveSharedBriefing(briefing: SavedSummary): Promise<string> {
  const response = await fetch("/api/share", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ briefing }),
  });

  if (!response.ok) {
    throw new Error("Failed to register shared briefing on backend.");
  }

  const data = await response.json();
  const briefingId = data.briefingId || briefing.id;
  return `${window.location.origin}/share/${briefingId}`;
}

export async function fetchSharedBriefing(id: string): Promise<SavedSummary | null> {
  try {
    const response = await fetch(`/api/share/${id}`);
    if (!response.ok) return null;
    const data = await response.json();
    return data.briefing || null;
  } catch (err) {
    console.error("Error fetching shared briefing:", err);
    return null;
  }
}
