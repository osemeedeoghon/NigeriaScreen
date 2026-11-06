import SectionTabs from "@/components/industry/SectionTabs";

const tabs = [
  { href: "/industry", label: "Overview", exact: true },
  { href: "/industry/filmmakers", label: "Filmmakers" },
  { href: "/industry/companies", label: "Production companies" },
];

export default function IndustryLayout({ children }: LayoutProps<"/industry">) {
  return (
    <main id="main">
      <div className="relative overflow-hidden border-b border-line">
        <div aria-hidden="true" className="texture-adire absolute inset-0" />
        <div className="relative mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
          <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.25em] text-gold uppercase">
            <span aria-hidden="true" className="weave-bar h-0.5 w-8 rounded-full" />
            Industry
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-cream sm:text-5xl">The people behind Nollywood</h1>
          <p className="mt-3 max-w-2xl text-cream-muted">
            Filmmakers and production companies who&rsquo;ve joined NaijaScreen. Every listing is reviewed by a moderator; a verified badge means
            their professional links have been checked.
          </p>
          <div className="mt-8">
            <SectionTabs label="Industry directory" tabs={tabs} />
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">{children}</div>
    </main>
  );
}
