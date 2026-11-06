import Link from "next/link";
import Wordmark from "./Wordmark";

const columns = [
  {
    title: "Discover",
    links: [
      { href: "/films", label: "Browse all films" },
      { href: "/#featured", label: "Featured film" },
      { href: "/#trending", label: "Trending now" },
      { href: "/#genres", label: "Genres" },
    ],
  },
  {
    title: "People & stories",
    links: [
      { href: "/#people", label: "Actors & directors" },
      { href: "/#stories", label: "Editorial" },
      { href: "/films", label: "Search the catalogue" },
      { href: "/industry", label: "Industry directory" },
      { href: "/filmmaker/onboarding", label: "For filmmakers" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-ink">
      <div aria-hidden="true" className="weave-bar h-1 w-full" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-cream-muted">
            An independent guide to Nollywood: discover films, the people behind them and legitimate places to
            watch.
          </p>
        </div>
        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <h2 className="text-sm font-semibold text-cream">{column.title}</h2>
            <ul className="mt-4 space-y-3">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-cream-muted transition-colors hover:text-gold">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line/60">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-6 text-xs text-cream-muted sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <p>© 2026 NaijaScreen. Design preview.</p>
          <p>
            All films, people, stories and viewing destinations shown are fictional sample content. Artwork is
            original and code-generated.
          </p>
        </div>
      </div>
    </footer>
  );
}
