import { getEditorialStories } from "@/lib/catalogue";
import SectionHeading from "./SectionHeading";

export default function EditorialSection() {
  const [lead, ...rest] = getEditorialStories();

  return (
    <section id="stories" aria-labelledby="stories-title" className="border-t border-line/60 bg-ink-2/50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <SectionHeading
          id="stories-title"
          eyebrow="Discover"
          title="Stories, guides and context"
          description="Editorial picks to help you go deeper into Nigerian cinema."
        />
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <article className="texture-adire relative flex min-h-72 flex-col justify-end overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-10">
            <div
              aria-hidden="true"
              className="absolute -top-24 -right-24 h-72 w-72 rounded-full border-[28px] border-terracotta/30"
            />
            <p className="relative text-xs font-semibold tracking-[0.25em] text-gold uppercase">{lead.kicker}</p>
            <h3 className="relative mt-3 max-w-xl font-display text-3xl leading-tight font-semibold text-cream sm:text-4xl">
              {lead.title}
            </h3>
            <p className="relative mt-4 max-w-xl text-base leading-relaxed text-cream-muted">{lead.excerpt}</p>
            <p className="relative mt-6 text-sm text-cream-muted">
              {lead.author} · {lead.readMinutes} min read · <span className="text-palm">Full story coming soon</span>
            </p>
          </article>

          <div className="grid gap-4">
            {rest.map((story) => (
              <article key={story.id} className="flex flex-col rounded-3xl border border-line bg-ink p-6">
                <p className="text-xs font-semibold tracking-[0.25em] text-gold uppercase">{story.kicker}</p>
                <h3 className="mt-2 font-display text-xl leading-snug font-semibold text-cream">{story.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-muted">{story.excerpt}</p>
                <p className="mt-4 text-sm text-cream-muted">
                  {story.author} · {story.readMinutes} min read
                </p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
