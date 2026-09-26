import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ToolPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="container-backed py-12 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" /> Free tools
        </Link>
        <header className="mt-7 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Free crowdfunding tool
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-5 text-lg leading-8 text-muted-foreground">{description}</p>
        </header>
        <div className="mt-10">{children}</div>
      </div>
    </main>
  );
}

export function ToolPanel({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card p-6 sm:p-8 ${className}`}>
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export function NumberField({
  id,
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  step = "0.01",
  help,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  step?: string;
  help?: string;
}) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative mt-2">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={min}
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(event) => onChange(Math.max(min, Number(event.target.value) || 0))}
          className={`${prefix ? "pl-7" : ""} ${suffix ? "pr-12" : ""}`}
        />
        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
      {help ? <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{help}</p> : null}
    </div>
  );
}

export function EstimateNote({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 flex items-start gap-2 text-sm leading-6 text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

export function ResultRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-3 ${strong ? "text-lg font-semibold" : "text-sm"}`}
    >
      <span className={strong ? "text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

export function ToolCta() {
  return (
    <section className="mt-10 rounded-xl border border-border bg-muted/35 p-6 sm:flex sm:items-center sm:justify-between sm:gap-8 sm:p-8">
      <div>
        <h2 className="text-xl font-semibold">Ready to put the plan into action?</h2>
        <p className="mt-2 text-muted-foreground">Build your Backed project page for free.</p>
      </div>
      <Link
        to="/start"
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 font-semibold text-primary-foreground transition-opacity hover:opacity-90 sm:mt-0"
      >
        Start a project <ArrowRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
