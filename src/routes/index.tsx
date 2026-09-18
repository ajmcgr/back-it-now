import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectGrid } from "@/components/backed/project-card";
import { projects } from "@/lib/projects";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Backed — Back things you want to exist" }, { name: "description", content: "Discover products and projects from people building what's next." }, { property: "og:title", content: "Backed — Back things you want to exist" }, { property: "og:description", content: "Discover products and projects from people building what's next." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: Index,
});

function Index() {
  return <main><section className="container-backed pb-16 pt-20 sm:pb-24 sm:pt-28"><div className="max-w-4xl"><h1 className="text-5xl font-semibold leading-[1.02] text-foreground sm:text-7xl lg:text-8xl">Back things you want to exist.</h1><p className="mt-7 max-w-xl text-lg leading-7 text-muted-foreground">Discover products and projects from people building what's next.</p><div className="mt-9 flex flex-wrap gap-3"><Button asChild size="lg"><Link to="/discover" search={{ q: "" }}>Explore projects</Link></Button><Button asChild size="lg" variant="outline"><Link to="/start">Start a project</Link></Button></div></div></section><section className="container-backed pb-24"><div className="mb-8 flex items-end justify-between"><h2 className="text-3xl font-semibold">Projects worth backing</h2><Link to="/discover" search={{ q: "" }} className="hidden items-center gap-1 text-sm font-semibold hover:text-primary sm:flex">View all <ArrowRight className="size-4"/></Link></div><ProjectGrid items={projects.slice(0, 3)} /></section><section className="border-t border-border bg-muted/40 py-20"><div className="container-backed"><h2 className="mb-8 text-3xl font-semibold">New &amp; noteworthy</h2><ProjectGrid items={projects.slice(3)} /></div></section><section className="container-backed py-20 sm:py-28"><h2 className="max-w-2xl text-4xl font-semibold sm:text-5xl">Have something you want to make?</h2><Link to="/start" className="mt-6 inline-flex items-center gap-2 text-lg font-semibold text-primary">Start a project <ArrowRight className="size-5"/></Link></section></main>;
}