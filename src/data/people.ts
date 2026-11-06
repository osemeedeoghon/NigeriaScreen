/**
 * FICTIONAL SAMPLE CONTENT.
 * These actors and directors are invented. Any resemblance to real people is
 * unintended. Portraits are generated monograms, not photographs.
 */
import type { Person } from "@/types";

export const people: Person[] = [
  // Directors
  {
    id: "person-zainab-musa-lawal",
    name: "Zainab Musa-Lawal",
    biography:
      "A former documentary editor from Kano who shoots on location across the North, favouring natural light and long, patient takes.",
    profession: "director",
    profileImage: { kind: "monogram", palette: ["#2F6B4F", "#9FD0B8"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-bolanle-ajayi-coker",
    name: "Bolanle Ajayi-Coker",
    biography:
      "Builds warm ensemble comedies around big family tables, drawing on years directing Lagos stage revues.",
    profession: "director",
    profileImage: { kind: "monogram", palette: ["#D9A441", "#F4EAD9"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-obinna-eze-williams",
    name: "Obinna Eze-Williams",
    biography:
      "A writer-director from Enugu with a taste for tight, single-night plots and morally tangled heroes.",
    profession: "director",
    profileImage: { kind: "monogram", palette: ["#1F4D44", "#E2CDA8"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-halima-bello-okafor",
    name: "Halima Bello-Okafor",
    biography:
      "Trained in production design before moving behind the camera; known for meticulous period detail in historical drama.",
    profession: "director",
    profileImage: { kind: "monogram", palette: ["#8E3B22", "#E8B95A"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-kunle-ogunsanya-reid",
    name: "Kunle Ogunsanya-Reid",
    biography:
      "Raised between Ibadan and Birmingham, he directs kinetic action films with practical stunts and a sharp sense of humour.",
    profession: "director",
    profileImage: { kind: "monogram", palette: ["#C2562F", "#F0C987"] },
    nationality: "British-Nigerian",
    isFictional: true,
  },
  {
    id: "person-ngozi-ikemefuna-hale",
    name: "Ngozi Ikemefuna-Hale",
    biography:
      "Makes intimate romances and family stories in Igbo and English, often working with first-time performers.",
    profession: "director",
    profileImage: { kind: "monogram", palette: ["#2C4A7A", "#F0C987"] },
    nationality: "Nigerian",
    isFictional: true,
  },

  // Actor-directors
  {
    id: "person-emeka-nwosu-hart",
    name: "Emeka Nwosu-Hart",
    biography:
      "Moves easily between street comedy and slow-burn thrillers, and recently stepped behind the camera for his directing debut.",
    profession: "actor-director",
    profileImage: { kind: "monogram", palette: ["#8E3B22", "#F0C987"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-tamuno-briggs-alagoa",
    name: "Tamuno Briggs-Alagoa",
    biography:
      "A Port Harcourt native who acts in and directs Delta-set crime stories, with a background in community theatre.",
    profession: "actor-director",
    profileImage: { kind: "monogram", palette: ["#1F4D44", "#9FD0B8"] },
    nationality: "Nigerian",
    isFictional: true,
  },

  // Actors
  {
    id: "person-ifeoma-adebanjo-eze",
    name: "Ifeoma Adebanjo-Eze",
    biography: "A stage-trained lead known for quiet, devastating close-ups and roles in three languages.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#C2562F", "#E8B95A"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-tunde-olaleye-bassey",
    name: "Tunde Olaleye-Bassey",
    biography: "A versatile character actor equally at home as a doting father or a smooth-talking con man.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#D9A441", "#2F6B4F"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-chiamaka-ndukwe-obi",
    name: "Chiamaka Ndukwe-Obi",
    biography: "Commanding in historical epics and modern thrillers, she began her career in Enugu radio drama.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#2C4A7A", "#E2CDA8"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-yetunde-fashola-grant",
    name: "Yetunde Fashola-Grant",
    biography: "A comic actor with impeccable timing who also performs in Yoruba-language stage revivals.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#E8B95A", "#C2562F"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-aminu-garba-lawson",
    name: "Aminu Garba-Lawson",
    biography: "A Kaduna-born actor known for still, watchful performances in Hausa and English productions.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#2F6B4F", "#E8B95A"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-ebiere-tonye-douglas",
    name: "Ebiere Tonye-Douglas",
    biography: "A former competitive swimmer from Bayelsa who now leads action and adventure roles.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#1F4D44", "#F0C987"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-chukwudi-anyanwu-price",
    name: "Chukwudi Anyanwu-Price",
    biography: "A veteran screen actor whose warmth anchors family dramas and the occasional villain.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#5A2A18", "#E2CDA8"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-folake-odusanya-blake",
    name: "Folake Odusanya-Blake",
    biography: "A British-Nigerian actor who returned to Lagos and became a favourite in romantic comedies.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#D9714A", "#F4EAD9"] },
    nationality: "British-Nigerian",
    isFictional: true,
  },
  {
    id: "person-musa-idris-kalu",
    name: "Musa Idris-Kalu",
    biography: "Known for physical comedy and stunt work, he trained as a dancer before turning to film.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#C2562F", "#9FD0B8"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-ada-okorocha-lane",
    name: "Ada Okorocha-Lane",
    biography: "A rising lead praised for emotionally precise work in Igbo-language drama.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#B89BD9", "#F4EAD9"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-segun-adewale-moore",
    name: "Segun Adewale-Moore",
    biography: "Plays detectives, soldiers and kings with equal gravity; a regular in historical productions.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#8E3B22", "#D9A441"] },
    nationality: "Nigerian",
    isFictional: true,
  },
  {
    id: "person-nkechi-umeh-sterling",
    name: "Nkechi Umeh-Sterling",
    biography: "A young actor who broke out in a family comedy and now moves between genres with ease.",
    profession: "actor",
    profileImage: { kind: "monogram", palette: ["#6FAF8A", "#F0C987"] },
    nationality: "Nigerian",
    isFictional: true,
  },
];
