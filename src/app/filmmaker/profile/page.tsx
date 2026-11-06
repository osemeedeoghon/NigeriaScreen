import Link from "next/link";
import AdminActionButton from "@/components/admin/AdminActionButton";
import { Feedback } from "@/components/industry/Panel";
import PortalGate, { NeedsApproval } from "@/components/industry/PortalGate";
import { FilmmakerProfileForm } from "@/components/industry/PortalForms";
import StatusPill from "@/components/industry/StatusPill";
import { requestProfileVerification } from "@/lib/industry/actions";
import { getPortalAccess } from "@/lib/industry/access";
import { countryOptions, languageOptions } from "@/lib/industry/options";
import { asFilmography, getOwnApplication, getOwnFilmmakerProfile } from "@/lib/industry/queries";
import { formatFilmography } from "@/lib/industry/validation";

export default function FilmmakerProfilePage() {
  return (
    <PortalGate label="Loading your profile…">
      <ProfileEditor />
    </PortalGate>
  );
}

async function ProfileEditor() {
  const access = await getPortalAccess("/filmmaker/profile");
  if (!access.isMember) return <NeedsApproval suspended={access.suspended} />;
  const [profile, application] = await Promise.all([getOwnFilmmakerProfile(access.user.id), getOwnApplication(access.user.id)]);

  const initial: Record<string, string> = profile
    ? {
        slug: profile.slug,
        professionalName: profile.professional_name,
        professionalRole: profile.professional_role,
        expertise: profile.expertise.join(", "),
        biography: profile.biography,
        avatarUrl: profile.avatar_url ?? "",
        city: profile.city ?? "",
        country: profile.country ?? "",
        websiteUrl: profile.website_url ?? "",
        portfolioLinks: profile.portfolio_links.join("\n"),
        socialLinks: profile.social_links.join("\n"),
        filmography: formatFilmography(asFilmography(profile.filmography)),
        visibility: profile.visibility,
      }
    : {
        // Start from the approved application.
        professionalName: application?.professional_name ?? "",
        professionalRole: application?.professional_role ?? "",
        biography: application?.biography ?? "",
        city: application?.city ?? "",
        country: application?.country ?? "",
        portfolioLinks: application?.portfolio_links.join("\n") ?? "",
        visibility: "private",
      };

  const canRequest = profile && (profile.verification_status === "unverified" || profile.verification_status === "rejected");

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_20rem] lg:gap-14">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-cream sm:text-4xl">{profile ? "Edit your profile" : "Create your profile"}</h1>
        <p className="mt-2 text-cream-muted">Only what you enter here is public, and only once you choose &ldquo;Public&rdquo;. Your account email is never shown.</p>
        <div className="mt-8">
          <FilmmakerProfileForm
            initial={initial}
            countries={countryOptions()}
            languages={languageOptions()}
            selectedLanguages={profile?.languages ?? []}
          />
        </div>
      </div>
      <aside aria-labelledby="verify-heading" className="h-fit space-y-4 rounded-2xl border border-line bg-ink-2 p-6">
        <h2 id="verify-heading" className="font-display text-xl font-semibold text-cream">
          Verification
        </h2>
        {profile ? (
          <>
            <StatusPill status={profile.verification_status} />
            <p className="text-sm text-cream-muted">
              A verified badge means a moderator has checked your professional links. It is never given automatically.
            </p>
            <Feedback text={profile.verification_feedback} tone={profile.verification_status === "rejected" ? "terracotta" : "gold"} />
            {canRequest && <AdminActionButton label="Request verification" tone="positive" run={requestProfileVerification} />}
            {profile.visibility === "public" && (
              <Link href={`/filmmakers/${profile.slug}`} className="block text-sm font-semibold text-gold hover:text-cream">
                View public profile →
              </Link>
            )}
          </>
        ) : (
          <p className="text-sm text-cream-muted">Save your profile first, then ask for verification.</p>
        )}
      </aside>
    </div>
  );
}
