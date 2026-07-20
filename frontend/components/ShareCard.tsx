"use client";
import { useEffect, useRef, useState } from "react";

// Canvas dimensions – 1080 × 1080 (square, works on X and WhatsApp)
const W = 1080;
const H = 1080;

// Design tokens
const INK      = "#15110D";
const LIME     = "#CFE94B";
const LIMEDEEP = "#A9C931";
const CORAL    = "#FF5B45";
const CREAM    = "#F5EFE2";
const CREAMDIM = "#CBC0AE";
const PANEL    = "#241C13";
const MUTED    = "#9A8C77";

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawQIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const r = size / 2;
  // Outer dark square
  roundRect(ctx, x, y, size, size, size * 0.23);
  ctx.fillStyle = INK;
  ctx.fill();

  // Lime tile edge (bottom strip)
  const tx = x + size * 0.16, ty = y + size * 0.13;
  const tw = size * 0.68, th = size * 0.75;
  roundRect(ctx, tx, ty, tw, th, size * 0.17);
  ctx.fillStyle = LIMEDEEP;
  ctx.fill();

  // Lime tile face
  roundRect(ctx, tx, ty, tw, th * 0.81, size * 0.17);
  ctx.fillStyle = LIME;
  ctx.fill();

  // Q circle
  ctx.beginPath();
  ctx.arc(x + size * 0.5, y + size * 0.42, size * 0.19, 0, Math.PI * 2);
  ctx.strokeStyle = INK;
  ctx.lineWidth   = size * 0.097;
  ctx.stroke();

  // Q tail
  ctx.beginPath();
  ctx.moveTo(x + size * 0.594, y + size * 0.547);
  ctx.lineTo(x + size * 0.688, y + size * 0.648);
  ctx.lineTo(x + size * 0.628, y + size * 0.695);
  ctx.lineTo(x + size * 0.554, y + size * 0.609);
  ctx.closePath();
  ctx.fillStyle = INK;
  ctx.fill();
}

function rankChipColor(rank: string): { bg: string; fg: string } {
  const r = rank.toUpperCase();
  if (r === "LEGEND")   return { bg: "#F4C84B", fg: "#3c2e05" };
  if (r === "ULTIMATE") return { bg: LIME,      fg: INK       };
  if (r === "MASTER")   return { bg: CORAL,     fg: "#fff"    };
  if (r === "ACE")      return { bg: "rgba(207,233,75,.22)", fg: LIME };
  return { bg: "rgba(255,255,255,.10)", fg: MUTED };
}

export interface ShareCardProps {
  score:    number;
  words:    number;
  bestWord: string | null;
  bestPts:  number;
  username: string;
  rank:     string;
  streak:   number;
}

export default function ShareCard({ score, words, bestWord, bestPts, username, rank, streak }: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [blob,    setBlob]    = useState<Blob | null>(null);
  const [copied,  setCopied]  = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Background ────────────────────────────────────────────────
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);

    // Subtle noise texture (random dots)
    ctx.save();
    for (let i = 0; i < 3200; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.018})`;
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
    ctx.restore();

    // Gradient glow behind score
    const grd = ctx.createRadialGradient(W / 2, H * 0.44, 0, W / 2, H * 0.44, W * 0.55);
    grd.addColorStop(0, "rgba(207,233,75,0.10)");
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, W, H);

    // ── Logo row ──────────────────────────────────────────────────
    const logoSize = 72;
    const logoX    = (W - logoSize - 14 - 160) / 2;
    const logoY    = 88;
    drawQIcon(ctx, logoX, logoY, logoSize);

    ctx.fillStyle = CREAM;
    ctx.font      = `800 52px 'Bricolage Grotesque', sans-serif`;
    ctx.textBaseline = "middle";
    ctx.fillText("Lexiq", logoX + logoSize + 14, logoY + logoSize / 2);

    // ── Score ─────────────────────────────────────────────────────
    const scoreStr  = String(score);
    const scoreFsz  = score >= 100 ? 280 : score >= 10 ? 320 : 360;
    ctx.font        = `800 ${scoreFsz}px 'Bricolage Grotesque', sans-serif`;
    ctx.textAlign   = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle   = LIME;
    ctx.shadowColor = "rgba(207,233,75,0.35)";
    ctx.shadowBlur  = 80;
    ctx.fillText(scoreStr, W / 2, H * 0.54);
    ctx.shadowBlur  = 0;

    ctx.font      = `700 38px 'Bricolage Grotesque', sans-serif`;
    ctx.fillStyle = CREAMDIM;
    ctx.fillText("points", W / 2, H * 0.54 + 54);

    // ── Stat pills row ────────────────────────────────────────────
    const pillY   = H * 0.67;
    const pillH   = 72;
    const pillR   = 20;
    const pills: { label: string; value: string }[] = [
      { label: "WORDS",     value: String(words) },
      ...(bestWord ? [{ label: "BEST",  value: `${bestWord} +${bestPts}` }] : []),
      ...(streak > 1 ? [{ label: "STREAK", value: `DAY ${streak}` }] : []),
    ];
    // Measure each pill width
    ctx.font = `700 26px 'Space Mono', monospace`;
    const pillWidths = pills.map(p => {
      const vw = ctx.measureText(p.value).width;
      const lw = ctx.measureText(p.label).width;
      return Math.max(vw, lw) + 60;
    });
    const totalPW = pillWidths.reduce((a, b) => a + b, 0) + (pills.length - 1) * 18;
    let px = (W - totalPW) / 2;

    pills.forEach((p, i) => {
      const pw = pillWidths[i];
      roundRect(ctx, px, pillY, pw, pillH, pillR);
      ctx.fillStyle = PANEL;
      ctx.fill();
      // Border
      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.lineWidth   = 1.5;
      ctx.stroke();

      ctx.textAlign   = "center";
      ctx.textBaseline = "middle";
      const cx = px + pw / 2;
      ctx.font      = `700 20px 'Space Mono', monospace`;
      ctx.fillStyle = MUTED;
      ctx.fillText(p.label, cx, pillY + 22);
      ctx.font      = `800 27px 'Bricolage Grotesque', sans-serif`;
      ctx.fillStyle = CREAM;
      ctx.fillText(p.value, cx, pillY + 52);
      px += pw + 18;
    });

    // ── Username + rank chip ──────────────────────────────────────
    const nameY = H * 0.83;
    ctx.font        = `700 32px 'Hanken Grotesk', sans-serif`;
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle   = CREAMDIM;
    const nameText  = `@${username}`;
    const nameW     = ctx.measureText(nameText).width;

    // Rank chip
    const { bg: chipBg, fg: chipFg } = rankChipColor(rank);
    const chipText = rank.toUpperCase();
    ctx.font = `800 22px 'Bricolage Grotesque', sans-serif`;
    const chipW  = ctx.measureText(chipText).width + 32;
    const chipH  = 40;
    const gap    = 20;
    const rowW   = nameW + gap + chipW;
    const rowX   = (W - rowW) / 2;

    ctx.font        = `700 32px 'Hanken Grotesk', sans-serif`;
    ctx.fillStyle   = CREAMDIM;
    ctx.textAlign   = "left";
    ctx.fillText(nameText, rowX, nameY);

    // Draw chip
    roundRect(ctx, rowX + nameW + gap, nameY - chipH / 2, chipW, chipH, chipH / 2);
    ctx.fillStyle = chipBg;
    ctx.fill();
    ctx.font        = `800 22px 'Bricolage Grotesque', sans-serif`;
    ctx.textAlign   = "center";
    ctx.fillStyle   = chipFg;
    ctx.fillText(chipText, rowX + nameW + gap + chipW / 2, nameY);

    // ── URL footer ────────────────────────────────────────────────
    ctx.font        = `400 26px 'Space Mono', monospace`;
    ctx.textAlign   = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle   = "rgba(154,140,119,.55)";
    ctx.fillText("lexiq-rust.vercel.app", W / 2, H - 66);

    // Export
    const url = canvas.toDataURL("image/png");
    setDataUrl(url);
    canvas.toBlob(b => { if (b) setBlob(b); }, "image/png");
  }, [score, words, bestWord, bestPts, username, rank, streak]);

  async function handleShare() {
    if (!blob) return;
    setSharing(true);
    try {
      const file = new File([blob], "lexiq-score.png", { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `I scored ${score} pts on Lexiq!`, url: "https://lexiq-rust.vercel.app" });
      } else if (navigator.share) {
        await navigator.share({ title: `I scored ${score} pts on Lexiq!`, url: "https://lexiq-rust.vercel.app" });
      } else {
        handleDownload();
      }
    } catch {
      // user cancelled — fine
    } finally {
      setSharing(false);
    }
  }

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href     = dataUrl;
    a.download = "lexiq-score.png";
    a.click();
  }

  async function handleCopy() {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Fallback: copy text
      await navigator.clipboard.writeText(`I scored ${score} pts on Lexiq! https://lexiq-rust.vercel.app`).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  }

  const LINE2 = "1px solid rgba(255,255,255,.12)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Hidden full-res canvas */}
      <canvas ref={canvasRef} width={W} height={H} style={{ display: "none" }} />

      {/* Live preview */}
      {dataUrl && (
        <div style={{ borderRadius: 14, overflow: "hidden", border: LINE2 }}>
          <img src={dataUrl} alt="Share card preview" style={{ width: "100%", display: "block" }} />
        </div>
      )}

      {/* Action buttons */}
      <button onClick={handleShare} disabled={!blob || sharing}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px", borderRadius: 13, width: "100%", background: "#CFE94B", color: "#15110D", fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15, cursor: blob ? "pointer" : "default", border: "none", opacity: (!blob || sharing) ? 0.6 : 1 }}>
        {sharing ? "Sharing…" : "↗ Share image"}
      </button>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleDownload} disabled={!dataUrl}
          style={{ flex: 1, padding: 12, borderRadius: 12, border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, cursor: dataUrl ? "pointer" : "default", background: "transparent", opacity: dataUrl ? 1 : 0.5 }}>
          ↓ Download PNG
        </button>
        <button onClick={handleCopy} disabled={!blob}
          style={{ flex: 1, padding: 12, borderRadius: 12, border: LINE2, color: "#F5EFE2", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, cursor: blob ? "pointer" : "default", background: "transparent", opacity: blob ? 1 : 0.5 }}>
          {copied ? "✓ Copied!" : "⎘ Copy image"}
        </button>
      </div>
    </div>
  );
}
