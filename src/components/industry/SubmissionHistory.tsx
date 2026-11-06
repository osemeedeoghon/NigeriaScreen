import { STATUS_LABELS } from "@/lib/industry/constants";
import type { SubmissionEvent } from "@/lib/industry/queries";

const dateTime = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Status timeline from submission_events, oldest first. */
export default function SubmissionHistory({ events }: { events: SubmissionEvent[] }) {
  if (!events.length) return <p className="text-sm text-cream-muted">No history yet.</p>;
  return (
    <ol className="space-y-4 border-l border-line pl-5">
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span aria-hidden="true" className="absolute top-1.5 -left-[1.6rem] h-2.5 w-2.5 rounded-full bg-gold" />
          <p className="text-sm text-cream">
            {event.from_status ? `${STATUS_LABELS[event.from_status] ?? event.from_status} → ` : "Created as "}
            <span className="font-semibold">{STATUS_LABELS[event.to_status] ?? event.to_status}</span>
          </p>
          <p className="text-xs text-cream-muted">
            <time dateTime={event.created_at}>{dateTime.format(new Date(event.created_at))}</time>
          </p>
          {event.note && <p className="mt-1 text-sm whitespace-pre-line text-cream-muted">&ldquo;{event.note}&rdquo;</p>}
        </li>
      ))}
    </ol>
  );
}
