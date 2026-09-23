import { Download, Share2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AdminTotals } from "@/lib/admin";

type MetricKey = keyof AdminTotals;

const metrics: Array<{ key: MetricKey; label: string; filenameLabel: string }> = [
  { key: "users", label: "Users", filenameLabel: "users" },
  { key: "projects", label: "Projects", filenameLabel: "projects" },
  { key: "amountBacked", label: "Backed", filenameLabel: "backed" },
  { key: "backers", label: "Backers", filenameLabel: "backers" },
  { key: "comments", label: "Comments", filenameLabel: "comments" },
];

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

const loadImage = (source: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });

async function renderStatsCard(label: string, displayValue: string) {
  await document.fonts?.ready;
  const logo = await loadImage("/logo.png");
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("card_render_unavailable");

  context.fillStyle = "#f5f5f3";
  context.fillRect(0, 0, 1200, 630);
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#deded9";
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(34, 34, 1132, 562, 22);
  context.fill();
  context.stroke();

  const logoWidth = 220;
  const logoHeight = (logo.height / logo.width) * logoWidth;
  context.drawImage(logo, 600 - logoWidth / 2, 68, logoWidth, logoHeight);

  context.fillStyle = "#5171ff";
  context.fillRect(548, 164, 104, 6);

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#0a0a0a";
  context.font = "700 150px Inter, Arial, sans-serif";
  context.fillText(displayValue, 600, 294, 1000);

  context.font = "700 34px Inter, Arial, sans-serif";
  context.fillStyle = "#5171ff";
  context.fillText(label.toUpperCase(), 600, 414);

  context.font = "500 25px Inter, Arial, sans-serif";
  context.fillStyle = "#353535";
  context.fillText("Back things you want to exist.", 600, 500);

  context.font = "500 20px Inter, Arial, sans-serif";
  context.fillStyle = "#777773";
  context.fillText("backedit.co", 600, 548);

  return canvas.toDataURL("image/png");
}

export function AdminStatsCard({ totals }: { totals: AdminTotals }) {
  const [metricKey, setMetricKey] = useState<MetricKey>("users");
  const [inputValue, setInputValue] = useState(String(totals.users));
  const [preview, setPreview] = useState("");
  const [error, setError] = useState("");
  const selected = metrics.find((metric) => metric.key === metricKey) ?? metrics[0];
  const actual = totals[metricKey];
  const isMoney = metricKey === "amountBacked";

  useEffect(() => {
    setInputValue(isMoney ? String(actual / 100) : String(actual));
  }, [actual, isMoney, metricKey]);

  const cardValue = useMemo(() => {
    const parsed = Number(inputValue);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    const normalized = isMoney ? Math.round(parsed * 100) : Math.floor(parsed);
    return normalized <= actual ? normalized : null;
  }, [actual, inputValue, isMoney]);

  useEffect(() => {
    let cancelled = false;
    if (cardValue === null) {
      setPreview("");
      setError("Choose the current value or a lower truthful milestone.");
      return;
    }
    setError("");
    const displayValue = isMoney ? formatMoney(cardValue) : cardValue.toLocaleString("en-US");
    void renderStatsCard(selected.label, displayValue)
      .then((image) => {
        if (!cancelled) setPreview(image);
      })
      .catch(() => {
        if (!cancelled) setError("The stats card could not be rendered.");
      });
    return () => {
      cancelled = true;
    };
  }, [cardValue, isMoney, selected.label]);

  const filenameValue = cardValue === null ? "0" : isMoney ? cardValue / 100 : cardValue;
  const filename = `backed-${String(filenameValue).replace(/\./g, "-")}-${selected.filenameLabel}.png`;

  function download() {
    if (!preview) return;
    const anchor = document.createElement("a");
    anchor.href = preview;
    anchor.download = filename;
    anchor.click();
  }

  async function share() {
    if (!preview || !navigator.share || !navigator.canShare) return;
    const blob = await (await fetch(preview)).blob();
    const file = new File([blob], filename, { type: "image/png" });
    if (navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Backed ${selected.label}` });
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <div className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="stats-metric">Metric</Label>
          <select
            id="stats-metric"
            value={metricKey}
            onChange={(event) => setMetricKey(event.target.value as MetricKey)}
            className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {metrics.map((metric) => (
              <option key={metric.key} value={metric.key}>
                {metric.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="stats-value">Card value</Label>
          <Input
            id="stats-value"
            type="number"
            min="0"
            max={isMoney ? actual / 100 : actual}
            step={isMoney ? "0.01" : "1"}
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
          />
          <p className="text-xs leading-5 text-muted-foreground">
            Current verified value: {isMoney ? formatMoney(actual) : actual.toLocaleString("en-US")}
            . You can use this or a lower milestone.
          </p>
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button onClick={download} disabled={!preview}>
            <Download /> Download PNG
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <Button variant="outline" onClick={() => void share()} disabled={!preview}>
              <Share2 /> Share
            </Button>
          ) : null}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium">Preview</p>
        <div className="overflow-hidden rounded-lg border border-border bg-muted">
          {preview ? (
            <img
              src={preview}
              alt={`${selected.label} share card preview`}
              width={1200}
              height={630}
              className="aspect-[1200/630] h-auto w-full"
            />
          ) : (
            <div className="aspect-[1200/630] animate-pulse bg-muted" />
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">1200 × 630 PNG</p>
      </div>
    </div>
  );
}
