/** Read-only star rating with a text equivalent for screen readers. */
export default function Stars({ rating, className = "" }: { rating: number; className?: string }) {
  const rounded = Math.round(rating);
  return (
    <span className={`inline-flex items-center gap-0.5 text-gold ${className}`}>
      <span className="sr-only">{Number.isInteger(rating) ? rating : rating.toFixed(1)} out of 5 stars</span>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill={n <= rounded ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
          <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  );
}
