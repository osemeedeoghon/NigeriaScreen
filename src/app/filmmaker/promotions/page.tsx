import AdminActionButton from "@/components/admin/AdminActionButton";
import Panel, { EmptyState, Feedback } from "@/components/industry/Panel";
import PortalGate, { NeedsApproval } from "@/components/industry/PortalGate";
import { PromotionForm } from "@/components/industry/PortalForms";
import StatusPill from "@/components/industry/StatusPill";
import { cancelPromotion } from "@/lib/industry/actions";
import { getPortalAccess } from "@/lib/industry/access";
import { PLACEMENT_LABELS, type Placement, type PromotionStatus } from "@/lib/industry/constants";
import { genreOptions } from "@/lib/industry/options";
import { getOwnPromotions, getOwnPublishedFilms } from "@/lib/industry/queries";
import { effectivePromotionStatus } from "@/lib/industry/status";

export default function PromotionsPage() {
  return (
    <PortalGate label="Loading promotions…">
      <Promotions />
    </PortalGate>
  );
}

async function Promotions() {
  const access = await getPortalAccess("/filmmaker/promotions");
  if (!access.isMember) return <NeedsApproval suspended={access.suspended} />;
  const [films, requests] = await Promise.all([getOwnPublishedFilms(), getOwnPromotions()]);
  const today = new Date().toISOString().slice(0, 10);
  const titles = new Map(films.map((film) => [film.id, film.title]));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">Promotional placements</h1>
        <p className="mt-2 max-w-3xl text-cream-muted">
          Ask for an editorial placement for one of your approved films. Every request is moderated. NaijaScreen doesn&rsquo;t sell placements;
          there are no fees, and nothing here is a paid promotion.
        </p>
      </header>
      <Panel title="Request a placement">
        {films.length === 0 ? (
          <EmptyState title="No approved films yet">Only films approved and listed on NaijaScreen can be promoted.</EmptyState>
        ) : (
          <PromotionForm films={films.map((f) => ({ value: f.id, label: f.title }))} genres={genreOptions()} today={today} />
        )}
      </Panel>
      <Panel title="Your requests">
        {!requests?.length ? (
          <p className="text-sm text-cream-muted">No requests yet.</p>
        ) : (
          <ul className="space-y-3">
            {requests.map((r) => {
              const status = effectivePromotionStatus(r.status as PromotionStatus, r.ends_on, today);
              return (
                <li key={r.id} className="rounded-xl border border-line p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-cream">
                      <span className="font-semibold">{titles.get(r.film_id) ?? r.film_id}</span> · {PLACEMENT_LABELS[r.placement as Placement]}
                      {r.genre && ` (${r.genre})`}
                    </p>
                    <StatusPill status={status} />
                  </div>
                  <p className="mt-1 text-xs text-cream-muted">
                    {r.starts_on} to {r.ends_on} · editorial, unpaid
                  </p>
                  <div className="mt-2">
                    <Feedback text={r.reviewer_feedback} />
                  </div>
                  {r.status === "pending" && (
                    <div className="mt-3">
                      <AdminActionButton label="Cancel request" tone="danger" confirm="Cancel this request?" run={cancelPromotion.bind(null, r.id)} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
