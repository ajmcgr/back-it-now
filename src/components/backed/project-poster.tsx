import { Download, Linkedin, Link2, MessageCircle, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PosterProject = {
  slug: string;
  name: string;
  summary: string;
  coverImage: string | null;
  creatorName: string;
  amountBacked: number;
  goal: number;
};

const money = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount / 100);

function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

async function renderPoster(project: PosterProject) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 630;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Poster rendering is unavailable.");
  context.fillStyle = "#f7f7f6";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#ffffff";
  context.fillRect(45, 45, 1110, 540);
  context.strokeStyle = "#e5e5e5";
  context.lineWidth = 2;
  context.strokeRect(45, 45, 1110, 540);

  try {
    const image = await loadImage(project.coverImage || "/logo.png");
    const scale = Math.max(510 / image.width, 360 / image.height);
    const width = image.width * scale;
    const height = image.height * scale;
    context.drawImage(image, 65 + (510 - width) / 2, 115 + (360 - height) / 2, width, height);
  } catch {
    context.fillStyle = "#5171ff";
    context.fillRect(65, 115, 510, 360);
  }

  try {
    const logo = await loadImage("/logo.png");
    const width = 188;
    const height = (logo.height / logo.width) * width;
    context.drawImage(logo, 65, 65, width, height);
  } catch {
    context.fillStyle = "#5171ff";
    context.font = "700 38px Inter, Arial, sans-serif";
    context.fillText("backed", 65, 90);
  }
  context.fillStyle = "#111111";
  context.font = "700 54px Inter, Arial, sans-serif";
  const title = project.name.slice(0, 42);
  context.fillText(title, 625, 185);
  context.fillStyle = "#5f6368";
  context.font = "500 27px Inter, Arial, sans-serif";
  const summary = project.summary.slice(0, 100);
  context.fillText(summary, 625, 235);
  context.fillStyle = "#111111";
  context.font = "700 44px Inter, Arial, sans-serif";
  context.fillText(`${money(project.amountBacked)} backed`, 625, 355);
  context.fillStyle = "#5f6368";
  context.font = "500 23px Inter, Arial, sans-serif";
  const funded = project.goal ? Math.round((project.amountBacked / project.goal) * 100) : 0;
  context.fillText(`${funded}% of ${money(project.goal)} goal`, 625, 395);
  context.fillStyle = "#e7e7e7";
  context.fillRect(625, 430, 470, 16);
  context.fillStyle = "#5171ff";
  context.fillRect(625, 430, Math.min(470, 470 * (funded / 100)), 16);
  context.fillStyle = "#111111";
  context.font = "600 24px Inter, Arial, sans-serif";
  context.fillText(project.creatorName, 625, 515);
  context.fillStyle = "#5f6368";
  context.font = "500 21px Inter, Arial, sans-serif";
  context.fillText("backedit.co", 955, 550);
  return canvas.toDataURL("image/png");
}

export function ProjectPosterDialog({
  project,
  open,
  onOpenChange,
}: {
  project: PosterProject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [poster, setPoster] = useState<string | null>(null);
  const url = `https://backedit.co/projects/${project.slug}`;
  useEffect(() => {
    if (!open) return;
    void renderPoster(project)
      .then(setPoster)
      .catch(() => setPoster(null));
  }, [open, project]);
  const copy = `Back ${project.name} on Backed\n${url}`;
  const share = (href: string) => window.open(href, "_blank", "noopener,noreferrer");
  const download = () => {
    if (!poster) return;
    const anchor = document.createElement("a");
    anchor.href = poster;
    anchor.download = `${project.slug}-backed-poster.png`;
    anchor.click();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Share project</DialogTitle>
          <DialogDescription>
            A 1200 × 630 Backed social poster, ready to download and share.
          </DialogDescription>
        </DialogHeader>
        {poster ? (
          <img
            src={poster}
            alt={`${project.name} social poster`}
            className="mt-3 w-full border border-border"
          />
        ) : (
          <div className="mt-3 aspect-[1200/630] animate-pulse bg-muted" />
        )}
        <div className="grid gap-2 sm:grid-cols-3">
          <Button onClick={download} disabled={!poster}>
            <Download />
            Download poster
          </Button>
          <Button variant="outline" onClick={() => void navigator.clipboard.writeText(url)}>
            <Link2 />
            Copy link
          </Button>
          <Button
            variant="outline"
            onClick={() => share(`https://x.com/intent/post?text=${encodeURIComponent(copy)}`)}
          >
            <X />
            Share on X
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              share(
                `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
              )
            }
          >
            <Linkedin />
            LinkedIn
          </Button>
          <Button
            variant="outline"
            onClick={() => share(`https://wa.me/?text=${encodeURIComponent(copy)}`)}
          >
            <MessageCircle />
            WhatsApp
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
