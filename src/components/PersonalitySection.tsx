import { getFeaturedPeople } from "@/lib/catalogue";
import PersonalityCard from "./PersonalityCard";
import SectionHeading from "./SectionHeading";

export default function PersonalitySection() {
  return (
    <section id="people" aria-labelledby="people-title" className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <SectionHeading
        id="people-title"
        eyebrow="Featured personalities"
        title="The faces and voices behind the films"
        description="Actors and directors shaping contemporary Nollywood."
      />
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {getFeaturedPeople().map((person) => (
          <li key={person.id}>
            <PersonalityCard person={person} />
          </li>
        ))}
      </ul>
    </section>
  );
}
