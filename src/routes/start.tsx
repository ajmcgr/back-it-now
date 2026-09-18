import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ImagePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { projects } from "@/lib/projects";
import { ProjectCard } from "@/components/backed/project-card";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/start")({
  head: () => ({
    meta: [
      { title: "Start a project — Backed" },
      { name: "description", content: "Launch a project and get it backed." },
      { property: "og:title", content: "Start a project — Backed" },
      { property: "og:description", content: "Launch a project and get it backed." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StartPage,
});

const steps = ["Project", "Funding", "What backers get", "Story", "Preview"];
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}
function StartPage() {
  const [step, setStep] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [draftRecord, setDraftRecord] = useState<{ id: string; secret: string } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      return JSON.parse(window.localStorage.getItem("backed-project-draft-record") ?? "null");
    } catch {
      return null;
    }
  });
  const [launchMessage, setLaunchMessage] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => {
    if (typeof window === "undefined") return {} as Record<string, string>;
    try {
      return JSON.parse(window.localStorage.getItem("backed-project-draft") ?? "{}") as Record<
        string,
        string
      >;
    } catch {
      return {} as Record<string, string>;
    }
  });
  const sample = projects[0];
  useEffect(() => {
    window.localStorage.setItem("backed-project-draft", JSON.stringify(draft));
  }, [draft]);
  useEffect(() => {
    if (draftRecord)
      window.localStorage.setItem("backed-project-draft-record", JSON.stringify(draftRecord));
  }, [draftRecord]);
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      setIsAuthenticated(Boolean(data.session));
      if (data.session && new URLSearchParams(window.location.search).get("publish") === "1") {
        void publish();
      }
    });
  }, []);
  const field = (name: string) => ({
    value: draft[name] ?? "",
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((current) => ({ ...current, [name]: event.target.value })),
  });
  async function saveDraft() {
    if (!supabase) throw new Error("Project saving is temporarily unavailable.");
    const secret = draftRecord?.secret ?? `${crypto.randomUUID()}${crypto.randomUUID()}`;
    const { data, error } = await supabase.functions.invoke("project-drafts", {
      body: {
        action: draftRecord ? "save" : "create",
        id: draftRecord?.id,
        secret,
        payload: draft,
      },
    });
    if (error || !data?.id) throw new Error(error?.message ?? "Could not save your draft.");
    const record = { id: data.id as string, secret };
    setDraftRecord(record);
    return record;
  }
  async function publish() {
    setLaunchMessage(null);
    let record: { id: string; secret: string };
    try {
      record = await saveDraft();
    } catch (error) {
      setLaunchMessage(error instanceof Error ? error.message : "Could not save your draft.");
      return;
    }
    if (!isAuthenticated) {
      window.location.assign(`/auth?next=${encodeURIComponent("/start?publish=1")}`);
      return;
    }
    const { data, error } = await supabase!.functions.invoke("project-drafts", {
      body: { action: "publish", id: record.id, secret: record.secret },
    });
    if (error || !data?.slug)
      return setLaunchMessage(error?.message ?? "Could not launch your project.");
    window.localStorage.removeItem("backed-project-draft");
    window.localStorage.removeItem("backed-project-draft-record");
    window.location.assign(`/projects/${data.slug}`);
  }
  if (!sample) return null;
  return (
    <main className="container-backed py-12 sm:py-16">
      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,680px)]">
        <aside>
          <h1 className="text-3xl font-semibold">Start a project</h1>
          <ol className="mt-7 flex gap-2 overflow-x-auto lg:block lg:space-y-1">
            {steps.map((name, index) => (
              <li key={name}>
                <button
                  onClick={() => setStep(index)}
                  className={`flex min-w-max items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold ${step === index ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <span className="grid size-6 place-items-center rounded-full border border-border text-xs">
                    {index + 1}
                  </span>
                  {name}
                </button>
              </li>
            ))}
          </ol>
        </aside>
        <section>
          <p className="text-sm font-semibold text-primary">Step {step + 1} of 5</p>
          <h2 className="mt-2 text-4xl font-semibold">{steps[step]}</h2>
          <div className="mt-8 space-y-6">
            {step === 0 && (
              <>
                <Field label="Project name">
                  <Input placeholder="e.g. Your project" className="h-12" {...field("name")} />
                </Field>
                <Field label="Short description">
                  <Textarea
                    placeholder="One clear sentence about what you want to make"
                    className="min-h-28"
                    {...field("summary")}
                  />
                </Field>
                <Field label="Category">
                  <Select>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "Technology",
                        "Design",
                        "Fashion",
                        "Games",
                        "Publishing",
                        "Food",
                        "Other",
                      ].map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Cover image">
                  <button className="grid min-h-44 w-full place-items-center rounded-md border border-dashed border-input bg-muted/30 text-sm font-semibold text-muted-foreground hover:bg-muted">
                    <span className="flex flex-col items-center gap-2">
                      <ImagePlus className="size-6" />
                      Upload a 16:10 image
                    </span>
                  </button>
                </Field>
              </>
            )}
            {step === 1 && (
              <>
                <Field label="Funding goal">
                  <Input type="number" placeholder="$10,000" className="h-12" {...field("goal")} />
                </Field>
                <Field label="Deadline">
                  <Input type="date" className="h-12" {...field("deadline")} />
                </Field>
                <p className="text-sm leading-6 text-muted-foreground">
                  Backed charges a 10% platform fee only on successful campaigns, plus payment
                  processing. If your project does not reach its goal by the deadline, eligible
                  backings are refunded and no Backed platform fee applies.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <Field label="Product or reward name">
                  <Input placeholder="Founding edition" className="h-12" {...field("rewardName")} />
                </Field>
                <Field label="Price">
                  <Input
                    type="number"
                    placeholder="$100"
                    className="h-12"
                    {...field("rewardPrice")}
                  />
                </Field>
                <Field label="Description">
                  <Textarea
                    placeholder="What backers receive"
                    className="min-h-28"
                    {...field("rewardDescription")}
                  />
                </Field>
                <Field label="Estimated delivery">
                  <Input type="month" className="h-12" {...field("delivery")} />
                </Field>
              </>
            )}
            {step === 3 && (
              <>
                <Field label="Project story">
                  <Textarea
                    placeholder="Tell backers what you're making, why it matters, and how you'll make it happen."
                    className="min-h-64"
                    {...field("story")}
                  />
                </Field>
                <Field label="Additional images">
                  <button className="grid min-h-36 w-full place-items-center rounded-md border border-dashed border-input bg-muted/30 text-sm font-semibold text-muted-foreground hover:bg-muted">
                    <span className="flex flex-col items-center gap-2">
                      <ImagePlus className="size-6" />
                      Add story images
                    </span>
                  </button>
                </Field>
              </>
            )}
            {step === 4 && (
              <div>
                <p className="mb-5 text-sm text-muted-foreground">
                  Your project card and public campaign will use the details from the previous
                  steps.
                </p>
                <div className="max-w-sm">
                  <ProjectCard project={sample} />
                </div>
              </div>
            )}
          </div>
          <div className="mt-10 flex items-center justify-between border-t border-border pt-6">
            <Button
              variant="ghost"
              disabled={step === 0}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              <ArrowLeft />
              Back
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep((s) => Math.min(4, s + 1))}>
                Continue
                <ArrowRight />
              </Button>
            ) : (
              <Button onClick={publish}>
                {isAuthenticated ? "Launch project" : "Sign in to launch"}
              </Button>
            )}
          </div>
          {step === 4 && (
            <div className="mt-3 space-y-1 text-right text-xs text-muted-foreground">
              <p>Your draft is saved on this device. Sign in only when you are ready to launch.</p>
              <p>Successful campaigns pay a 10% Backed platform fee, plus payment processing.</p>
            </div>
          )}
          {launchMessage && (
            <p className="mt-3 text-right text-xs text-destructive">{launchMessage}</p>
          )}
        </section>
      </div>
      <div className="mt-16 border-t border-border pt-6 text-sm text-muted-foreground">
        <Link to="/dashboard" className="font-semibold text-foreground hover:text-primary">
          View creator dashboard
        </Link>
      </div>
    </main>
  );
}
