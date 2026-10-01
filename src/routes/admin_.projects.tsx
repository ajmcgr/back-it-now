import { createFileRoute, Link } from "@tanstack/react-router";
import { ExternalLink, Trash2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useState } from "react";
import { AdminDeleteDialog } from "@/components/backed/admin-delete-dialog";
import { AdminLoading, AdminShell, AdminUnavailable } from "@/components/backed/admin-shell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  invokeAdmin,
  loadProjectCancellationSummaries,
  retryProjectCancellation,
  type AdminProject,
} from "@/lib/admin";
import { privateSeo } from "@/lib/seo";

export const Route = createFileRoute("/admin_/projects")({
  head: () => privateSeo("Projects — Backed Admin"),
  component: AdminProjects,
});

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

const relatedRows = <T,>(value: T[] | T | null | undefined): T[] =>
  Array.isArray(value) ? value : value ? [value] : [];

function AdminProjects() {
  const [projects, setProjects] = useState<AdminProject[] | null>(null);
  const [denied, setDenied] = useState(false);
  const [selected, setSelected] = useState<AdminProject | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { note: string; evidence: string }>
  >({});

  const load = useCallback(async () => {
    const [response, cancellations] = await Promise.all([
      invokeAdmin<{ projects: AdminProject[] }>("list_projects"),
      loadProjectCancellationSummaries(),
    ]);
    const byProject = new Map(cancellations.map((item) => [item.project_id, item]));
    setProjects(
      response.projects.map((project) => ({
        ...project,
        project_cancellations: byProject.get(project.id) ?? null,
      })),
    );
  }, []);

  useEffect(() => {
    void load().catch(() => setDenied(true));
  }, [load]);

  async function remove() {
    if (!selected) return;
    setBusy(true);
    setMessage("");
    try {
      await invokeAdmin("delete_project", { projectId: selected.id });
      setSelected(null);
      setMessage("Project removed from public Backed. Financial history was preserved.");
      await load();
    } catch {
      setMessage("The project could not be deleted. Please try again.");
    } finally {
      setBusy(false);
    }
  }
  async function retryCancellation(project: AdminProject) {
    setBusy(true);
    setMessage("");
    try {
      await retryProjectCancellation(project.slug);
      setMessage(
        `Retried unresolved refunds for ${project.name}. Completed refunds were not duplicated.`,
      );
      await load();
    } catch {
      setMessage("Unresolved refunds could not be retried. No completed refund was duplicated.");
    } finally {
      setBusy(false);
    }
  }
  async function reviewCompliance(
    project: AdminProject,
    outcome: "approved" | "rejected" | "needs_information",
  ) {
    const draft = reviewDrafts[project.id] ?? { note: "", evidence: "" };
    if (draft.note.trim().length < 10) {
      setMessage("Add a concise review note of at least 10 characters.");
      return;
    }
    const evidenceUrls = draft.evidence
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);
    setBusy(true);
    setMessage("");
    try {
      await invokeAdmin("review_project", {
        projectId: project.id,
        outcome,
        reviewNote: draft.note,
        evidenceUrls,
      });
      setMessage(
        outcome === "approved"
          ? `${project.name} was approved for ${project.compliance_intended_status ?? "live"}.`
          : outcome === "needs_information"
            ? `${project.name} now shows that more information is needed.`
            : `${project.name} was rejected and suspended.`,
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error && error.message === "creator_connect_not_ready"
          ? "The creator must complete Stripe setup before this project can be approved."
          : "The compliance review could not be saved. Check the note and evidence URLs, then try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (denied) return <AdminUnavailable message="You don’t have access to Backed Admin." />;
  if (!projects) return <AdminLoading />;

  return (
    <AdminShell
      active="projects"
      title="Projects"
      description="View every project and safely remove it from public Backed without destroying payment history."
    >
      {message ? <p className="mb-4 text-sm text-muted-foreground">{message}</p> : null}
      {projects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No projects yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-4">Project</th>
                <th>Creator</th>
                <th>Status</th>
                <th>Compliance</th>
                <th>Amount backed</th>
                <th>Created</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const creator = project.profiles;
                const archived = Boolean(project.admin_archived_at);
                const cancellation = project.project_cancellations;
                const complianceFlags = Array.isArray(project.project_compliance_flags)
                  ? project.project_compliance_flags
                  : project.project_compliance_flags
                    ? [project.project_compliance_flags]
                    : [];
                const openComplianceFlag = complianceFlags.find((flag) => flag.status === "open");
                const attestations = relatedRows(project.project_compliance_attestations).sort(
                  (a, b) => Date.parse(b.accepted_at) - Date.parse(a.accepted_at),
                );
                const attestation = attestations[0] ?? null;
                const reviews = relatedRows(project.project_compliance_reviews).sort(
                  (a, b) => Date.parse(b.reviewed_at) - Date.parse(a.reviewed_at),
                );
                const latestReview = reviews[0] ?? null;
                const reward = relatedRows(project.rewards)[0] ?? null;
                const connectReady =
                  Boolean(creator.stripe_account_id) &&
                  creator.stripe_onboarding_complete &&
                  creator.stripe_charges_enabled &&
                  creator.stripe_payouts_enabled;
                const reviewable =
                  project.status === "pending_review" &&
                  ["pending", "needs_information"].includes(project.compliance_review_status);
                const reviewDraft = reviewDrafts[project.id] ?? { note: "", evidence: "" };
                const refundRows = cancellation?.project_cancellation_refunds ?? [];
                const refunded = refundRows.filter((refund) => refund.status === "succeeded");
                const failed = refundRows.filter((refund) => refund.status === "failed");
                const pending = refundRows.filter((refund) =>
                  ["queued", "processing", "pending"].includes(refund.status),
                );
                return (
                  <Fragment key={project.id}>
                    <tr key={project.id} className="border-b border-border last:border-0">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-16 overflow-hidden rounded-md bg-muted">
                            {project.image_url ? (
                              <img
                                src={project.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                          </div>
                          <span className="font-semibold">{project.name}</span>
                        </div>
                      </td>
                      <td>{creator.display_name || creator.username || "Backed creator"}</td>
                      <td>
                        <span className="capitalize">{archived ? "archived" : project.status}</span>
                        {cancellation ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {refunded.length}/{cancellation.eligible_refund_count} refunded ·{" "}
                            {pending.length} pending · {failed.length} failed
                          </p>
                        ) : null}
                      </td>
                      <td>
                        {project.compliance_review_status === "pending" ? (
                          <>
                            <span className="font-semibold">Compliance review required</span>
                            <p className="mt-1 text-xs text-muted-foreground">
                              Beneficiary answer:{" "}
                              {project.compliance_benefits_third_party_or_cause ? "Yes" : "No"}
                            </p>
                          </>
                        ) : project.compliance_review_status === "needs_information" ? (
                          <>
                            <span className="font-semibold">More information needed</span>
                            {latestReview ? (
                              <p className="mt-1 max-w-64 text-xs text-muted-foreground">
                                {latestReview.review_note}
                              </p>
                            ) : null}
                          </>
                        ) : openComplianceFlag ? (
                          <>
                            <span className="font-semibold">Manual review flagged</span>
                            <p className="mt-1 max-w-64 text-xs text-muted-foreground">
                              {openComplianceFlag.reason}
                            </p>
                          </>
                        ) : (
                          <span className="capitalize text-muted-foreground">
                            {project.compliance_review_status.replace("_", " ")}
                          </span>
                        )}
                      </td>
                      <td className="tabular-nums">
                        {formatMoney(
                          project.initial_backed_amount + project.successful_backed_amount,
                        )}
                      </td>
                      <td>{new Date(project.created_at).toLocaleDateString()}</td>
                      <td className="p-4">
                        <div className="flex justify-end gap-1">
                          {failed.length > 0 ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busy}
                              onClick={() => void retryCancellation(project)}
                            >
                              Retry refunds
                            </Button>
                          ) : null}
                          <Button variant="ghost" size="icon" asChild>
                            <Link
                              to="/projects/$slug"
                              params={{ slug: project.slug }}
                              aria-label={`View ${project.name}`}
                            >
                              <ExternalLink />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelected(project)}
                            disabled={archived}
                            aria-label={`Delete ${project.name}`}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </td>
                    </tr>
                    {reviewable ? (
                      <tr className="border-b border-border bg-muted/20">
                        <td colSpan={7} className="p-5">
                          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,1fr)]">
                            <div className="space-y-4">
                              <div>
                                <p className="font-semibold">Project information</p>
                                <p className="mt-1 text-sm">{project.summary}</p>
                                <p className="mt-2 line-clamp-4 whitespace-pre-line text-xs leading-5 text-muted-foreground">
                                  {project.description}
                                </p>
                              </div>
                              <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
                                <div>
                                  <dt className="text-muted-foreground">Creator</dt>
                                  <dd className="mt-1 font-medium">
                                    {creator.display_name || creator.username || "Backed creator"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-muted-foreground">Stripe Connect</dt>
                                  <dd className="mt-1 font-medium">
                                    {connectReady ? "Ready" : "Incomplete"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-muted-foreground">Attestation</dt>
                                  <dd className="mt-1 font-medium">
                                    {attestation
                                      ? `Accepted · AUP ${attestation.acceptable_use_version}`
                                      : "Missing"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-muted-foreground">Cause / beneficiary</dt>
                                  <dd className="mt-1 font-medium">
                                    {project.compliance_benefits_third_party_or_cause
                                      ? "Yes"
                                      : "No"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-muted-foreground">Goal / deadline</dt>
                                  <dd className="mt-1 font-medium">
                                    {formatMoney(project.funding_goal_amount)} ·{" "}
                                    {project.deadline_at
                                      ? new Date(project.deadline_at).toLocaleDateString()
                                      : "No deadline"}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="text-muted-foreground">Category / reward</dt>
                                  <dd className="mt-1 font-medium">
                                    {project.category} · {reward?.title ?? "No reward"}
                                  </dd>
                                </div>
                              </dl>
                              <div className="flex flex-wrap gap-4 text-xs font-semibold">
                                {project.external_website ? (
                                  <a
                                    href={project.external_website}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-4"
                                  >
                                    Project website
                                  </a>
                                ) : null}
                              </div>
                            </div>
                            <div className="space-y-3">
                              <label className="block">
                                <span className="mb-2 block text-xs font-semibold">
                                  Review note
                                </span>
                                <Textarea
                                  value={reviewDraft.note}
                                  onChange={(event) =>
                                    setReviewDrafts((current) => ({
                                      ...current,
                                      [project.id]: {
                                        ...reviewDraft,
                                        note: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="Record what was reviewed and the reasonable consistency checks performed."
                                  className="min-h-28"
                                  maxLength={2000}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-2 block text-xs font-semibold">
                                  Evidence URLs (optional, one per line)
                                </span>
                                <Textarea
                                  value={reviewDraft.evidence}
                                  onChange={(event) =>
                                    setReviewDrafts((current) => ({
                                      ...current,
                                      [project.id]: {
                                        ...reviewDraft,
                                        evidence: event.target.value,
                                      },
                                    }))
                                  }
                                  placeholder="https://example.com"
                                  className="min-h-20"
                                />
                              </label>
                              <div className="flex flex-wrap gap-2 pt-1">
                                <Button
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => void reviewCompliance(project, "approved")}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() =>
                                    void reviewCompliance(project, "needs_information")
                                  }
                                >
                                  Needs information
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => void reviewCompliance(project, "rejected")}
                                >
                                  Reject / Suspend
                                </Button>
                              </div>
                              {!connectReady ? (
                                <p className="text-xs text-muted-foreground">
                                  Approval will recheck Stripe and remains blocked until setup is
                                  complete.
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <AdminDeleteDialog
        open={Boolean(selected)}
        title={`Delete “${selected?.name ?? "project"}”?`}
        description="This project will be removed from public Backed. Payment and accounting records will be preserved."
        busy={busy}
        onCancel={() => setSelected(null)}
        onConfirm={() => void remove()}
      />
    </AdminShell>
  );
}
