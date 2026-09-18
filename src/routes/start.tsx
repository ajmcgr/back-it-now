import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, ImagePlus } from "lucide-react";
import { useState } from "react";
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
  const sample = projects[0];
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
                  <Input placeholder="e.g. Your project" className="h-12" />
                </Field>
                <Field label="Short description">
                  <Textarea
                    placeholder="One clear sentence about what you want to make"
                    className="min-h-28"
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
                  <Input type="number" placeholder="$10,000" className="h-12" />
                </Field>
                <Field label="Deadline">
                  <Input type="date" className="h-12" />
                </Field>
                <p className="text-sm leading-6 text-muted-foreground">
                  Backers are charged only if your project reaches its goal by the deadline.
                </p>
              </>
            )}
            {step === 2 && (
              <>
                <Field label="Product or reward name">
                  <Input placeholder="Founding edition" className="h-12" />
                </Field>
                <Field label="Price">
                  <Input type="number" placeholder="$100" className="h-12" />
                </Field>
                <Field label="Description">
                  <Textarea placeholder="What backers receive" className="min-h-28" />
                </Field>
                <Field label="Estimated delivery">
                  <Input type="month" className="h-12" />
                </Field>
              </>
            )}
            {step === 3 && (
              <>
                <Field label="Project story">
                  <Textarea
                    placeholder="Tell backers what you're making, why it matters, and how you'll make it happen."
                    className="min-h-64"
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
              <Button disabled>Launch project</Button>
            )}
          </div>
          {step === 4 && (
            <p className="mt-3 text-right text-xs text-muted-foreground">
              Launching requires sign-in and Lovable Cloud.
            </p>
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
