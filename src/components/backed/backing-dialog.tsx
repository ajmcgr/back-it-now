import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { rewardAvailability, type Project } from "@/lib/projects";

export function BackingDialog({
  project,
  children,
}: {
  project: Project;
  children?: React.ReactNode;
}) {
  const availability = rewardAvailability(project.reward);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children ?? (
          <Button size="lg" className="w-full">
            Back this project
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-xl p-0">
        <div className="grid sm:grid-cols-[180px_1fr]">
          <img
            src={project.coverImage}
            alt=""
            width={720}
            height={480}
            className="h-full min-h-44 w-full object-cover"
          />
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="text-2xl">{project.reward.name}</DialogTitle>
              <DialogDescription>{project.reward.description}</DialogDescription>
            </DialogHeader>
            {availability && (
              <p className="mt-4 text-sm font-semibold text-foreground">{availability}</p>
            )}
            <div className="mt-6">
              <p className="text-sm font-semibold">Includes</p>
              <ul className="mt-3 space-y-3 text-sm text-muted-foreground">
                {project.reward.includes.map((item) => (
                  <li key={item} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <Button className="mt-7 w-full">Back this project</Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Payment will be collected only if this project reaches its goal.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
