import Link from "next/link";

/** Section-heading action that opens the /films discovery page. */
export default function BrowseAllLink({ href = "/films", children = "Browse all films" }: { href?: string; children?: string }) {
  return (
    <Link
      href={href}
      className="self-start rounded-full border border-gold/60 px-4 py-2 text-sm font-semibold whitespace-nowrap text-gold transition-colors hover:bg-gold hover:text-ink sm:self-auto"
    >
      {children} <span aria-hidden="true">→</span>
    </Link>
  );
}
