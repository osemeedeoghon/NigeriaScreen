import { countryOptions, genreOptions, languageOptions } from "@/lib/industry/options";
import { asViewingLinks, type OwnCompany, type Submission } from "@/lib/industry/queries";
import { formatViewingLinks } from "@/lib/industry/validation";
import { SubmissionForm } from "./PortalForms";

/** Server wrapper that turns a stored submission into form defaults. */
export default function SubmissionEditor({ submission, companies }: { submission?: Submission; companies: OwnCompany[] }) {
  const initial: Record<string, string> = submission
    ? {
        title: submission.title,
        originalTitle: submission.original_title ?? "",
        synopsis: submission.synopsis,
        releaseYear: submission.release_year?.toString() ?? "",
        runtimeMinutes: submission.runtime_minutes?.toString() ?? "",
        language: submission.language ?? "",
        country: submission.country ?? "",
        director: submission.director ?? "",
        producers: submission.producers.join("\n"),
        castNames: submission.cast_names.join("\n"),
        companyId: submission.company_id ?? "",
        trailerUrl: submission.trailer_url ?? "",
        posterUrl: submission.poster_url ?? "",
        websiteUrl: submission.website_url ?? "",
        viewingLinks: formatViewingLinks(asViewingLinks(submission.viewing_links)),
        rightsConfirmed: submission.rights_confirmed ? "on" : "",
        rightsStatement: submission.rights_statement ?? "",
        notesForAdmins: submission.notes_for_admins ?? "",
      }
    : { country: "NG" };
  return (
    <SubmissionForm
      initial={initial}
      submissionId={submission?.id}
      countries={countryOptions()}
      languages={languageOptions()}
      genres={genreOptions()}
      selectedGenres={submission?.genres ?? []}
      companies={companies.filter((c) => c.membership.status === "active").map(({ company }) => ({ value: company.id, label: company.name }))}
    />
  );
}
