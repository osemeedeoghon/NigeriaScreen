/**
 * FICTIONAL SAMPLE CONTENT.
 * Credits link films to people. This is the single source of truth for cast
 * and crew: each film's `actorIds` and `directorIds` are derived from it.
 */
import type { FilmCredit } from "@/types";

export const credits: FilmCredit[] = [
  // Harmattan Letters
  { filmId: "film-harmattan-letters", personId: "person-zainab-musa-lawal", role: "director" },
  { filmId: "film-harmattan-letters", personId: "person-ifeoma-adebanjo-eze", role: "actor", characterName: "Hauwa Sani" },
  { filmId: "film-harmattan-letters", personId: "person-aminu-garba-lawson", role: "actor", characterName: "Malam Bashir" },

  // Third Mainland
  { filmId: "film-third-mainland", personId: "person-obinna-eze-williams", role: "director" },
  { filmId: "film-third-mainland", personId: "person-emeka-nwosu-hart", role: "actor", characterName: "Dayo" },
  { filmId: "film-third-mainland", personId: "person-chiamaka-ndukwe-obi", role: "actor", characterName: "Ezinne" },

  // Owambe Season
  { filmId: "film-owambe-season", personId: "person-bolanle-ajayi-coker", role: "director" },
  { filmId: "film-owambe-season", personId: "person-yetunde-fashola-grant", role: "actor", characterName: "Morenike" },
  { filmId: "film-owambe-season", personId: "person-tunde-olaleye-bassey", role: "actor", characterName: "Uncle Gbenga" },
  { filmId: "film-owambe-season", personId: "person-nkechi-umeh-sterling", role: "actor", characterName: "Tolu" },

  // The Lagoon Keeps Secrets
  { filmId: "film-the-lagoon-keeps-secrets", personId: "person-tamuno-briggs-alagoa", role: "director" },
  { filmId: "film-the-lagoon-keeps-secrets", personId: "person-ebiere-tonye-douglas", role: "actor", characterName: "Dr. Preye Ebi" },
  { filmId: "film-the-lagoon-keeps-secrets", personId: "person-ifeoma-adebanjo-eze", role: "actor", characterName: "Mama Tari" },

  // Red Earth Rising
  { filmId: "film-red-earth-rising", personId: "person-halima-bello-okafor", role: "director" },
  { filmId: "film-red-earth-rising", personId: "person-chiamaka-ndukwe-obi", role: "actor", characterName: "Adaugo" },
  { filmId: "film-red-earth-rising", personId: "person-segun-adewale-moore", role: "actor", characterName: "Eze Nnamdi" },

  // Danfo Diaries
  { filmId: "film-danfo-diaries", personId: "person-emeka-nwosu-hart", role: "director" },
  { filmId: "film-danfo-diaries", personId: "person-musa-idris-kalu", role: "actor", characterName: "Kelvin" },
  { filmId: "film-danfo-diaries", personId: "person-yetunde-fashola-grant", role: "actor", characterName: "Iya Basira" },

  // Calabar Blue
  { filmId: "film-calabar-blue", personId: "person-ngozi-ikemefuna-hale", role: "director" },
  { filmId: "film-calabar-blue", personId: "person-folake-odusanya-blake", role: "actor", characterName: "Ekaette" },
  { filmId: "film-calabar-blue", personId: "person-tunde-olaleye-bassey", role: "actor", characterName: "Etim" },

  // Ink of the Ancestors
  { filmId: "film-ink-of-the-ancestors", personId: "person-obinna-eze-williams", role: "director" },
  { filmId: "film-ink-of-the-ancestors", personId: "person-ada-okorocha-lane", role: "actor", characterName: "Ogechi" },
  { filmId: "film-ink-of-the-ancestors", personId: "person-chukwudi-anyanwu-price", role: "actor", characterName: "Nna Ukwu" },

  // Sunday Rice
  { filmId: "film-sunday-rice", personId: "person-bolanle-ajayi-coker", role: "director" },
  { filmId: "film-sunday-rice", personId: "person-chukwudi-anyanwu-price", role: "actor", characterName: "Papa Akin" },
  { filmId: "film-sunday-rice", personId: "person-ifeoma-adebanjo-eze", role: "actor", characterName: "Bisi" },
  { filmId: "film-sunday-rice", personId: "person-nkechi-umeh-sterling", role: "actor", characterName: "Lara" },

  // Kano Nights
  { filmId: "film-kano-nights", personId: "person-zainab-musa-lawal", role: "director" },
  { filmId: "film-kano-nights", personId: "person-aminu-garba-lawson", role: "actor", characterName: "Officer Sadiq" },
  { filmId: "film-kano-nights", personId: "person-emeka-nwosu-hart", role: "actor", characterName: "Garba" },

  // Okada Express
  { filmId: "film-okada-express", personId: "person-kunle-ogunsanya-reid", role: "director" },
  { filmId: "film-okada-express", personId: "person-musa-idris-kalu", role: "actor", characterName: "Sunny" },
  { filmId: "film-okada-express", personId: "person-ebiere-tonye-douglas", role: "actor", characterName: "Inspector Timi" },

  // Daughter of the Palace
  { filmId: "film-daughter-of-the-palace", personId: "person-halima-bello-okafor", role: "director" },
  { filmId: "film-daughter-of-the-palace", personId: "person-ifeoma-adebanjo-eze", role: "actor", characterName: "Princess Adetutu" },
  { filmId: "film-daughter-of-the-palace", personId: "person-segun-adewale-moore", role: "actor", characterName: "Oba Adelabu" },

  // Port Harcourt Blues
  { filmId: "film-port-harcourt-blues", personId: "person-tamuno-briggs-alagoa", role: "director" },
  { filmId: "film-port-harcourt-blues", personId: "person-tamuno-briggs-alagoa", role: "actor", characterName: "Sotonye" },
  { filmId: "film-port-harcourt-blues", personId: "person-chiamaka-ndukwe-obi", role: "actor", characterName: "Ibiso" },

  // Aso-Ebi Wars
  { filmId: "film-aso-ebi-wars", personId: "person-bolanle-ajayi-coker", role: "director" },
  { filmId: "film-aso-ebi-wars", personId: "person-folake-odusanya-blake", role: "actor", characterName: "Simi" },
  { filmId: "film-aso-ebi-wars", personId: "person-musa-idris-kalu", role: "actor", characterName: "Jide" },

  // The Last Train to Kafanchan
  { filmId: "film-the-last-train-to-kafanchan", personId: "person-zainab-musa-lawal", role: "director" },
  { filmId: "film-the-last-train-to-kafanchan", personId: "person-aminu-garba-lawson", role: "actor", characterName: "Yakubu" },
  { filmId: "film-the-last-train-to-kafanchan", personId: "person-ada-okorocha-lane", role: "actor", characterName: "Ngozi" },

  // Ojuelegba Run
  { filmId: "film-ojuelegba-run", personId: "person-kunle-ogunsanya-reid", role: "director" },
  { filmId: "film-ojuelegba-run", personId: "person-ebiere-tonye-douglas", role: "actor", characterName: "Kemi" },
  { filmId: "film-ojuelegba-run", personId: "person-segun-adewale-moore", role: "actor", characterName: "Major Adebayo" },

  // Mama Nkoli's Garden
  { filmId: "film-mama-nkolis-garden", personId: "person-ngozi-ikemefuna-hale", role: "director" },
  { filmId: "film-mama-nkolis-garden", personId: "person-nkechi-umeh-sterling", role: "actor", characterName: "Chioma" },
  { filmId: "film-mama-nkolis-garden", personId: "person-chukwudi-anyanwu-price", role: "actor", characterName: "Nnanna" },

  // Bride Price, Paid in Full
  { filmId: "film-bride-price-paid-in-full", personId: "person-ngozi-ikemefuna-hale", role: "director" },
  { filmId: "film-bride-price-paid-in-full", personId: "person-ada-okorocha-lane", role: "actor", characterName: "Ifunanya" },
  { filmId: "film-bride-price-paid-in-full", personId: "person-tunde-olaleye-bassey", role: "actor", characterName: "Uncle Ikenna" },

  // Gidan Haske
  { filmId: "film-gidan-haske", personId: "person-zainab-musa-lawal", role: "director" },
  { filmId: "film-gidan-haske", personId: "person-aminu-garba-lawson", role: "actor", characterName: "Alhaji Danladi" },
  { filmId: "film-gidan-haske", personId: "person-chiamaka-ndukwe-obi", role: "actor", characterName: "Safiya" },

  // The Ledger
  { filmId: "film-the-ledger", personId: "person-obinna-eze-williams", role: "director" },
  { filmId: "film-the-ledger", personId: "person-folake-odusanya-blake", role: "actor", characterName: "Ronke Alabi" },
  { filmId: "film-the-ledger", personId: "person-tunde-olaleye-bassey", role: "actor", characterName: "Chief Ademola" },

  // Beyond the Moat
  { filmId: "film-beyond-the-moat", personId: "person-halima-bello-okafor", role: "director" },
  { filmId: "film-beyond-the-moat", personId: "person-segun-adewale-moore", role: "actor", characterName: "Captain Osaro" },
  { filmId: "film-beyond-the-moat", personId: "person-ebiere-tonye-douglas", role: "actor", characterName: "Ewaen" },

  // Generator Wahala
  { filmId: "film-generator-wahala", personId: "person-emeka-nwosu-hart", role: "director" },
  { filmId: "film-generator-wahala", personId: "person-yetunde-fashola-grant", role: "actor", characterName: "Mama Ijeoma" },
  { filmId: "film-generator-wahala", personId: "person-musa-idris-kalu", role: "actor", characterName: "Chinedu" },

  // Creek Runner
  { filmId: "film-creek-runner", personId: "person-tamuno-briggs-alagoa", role: "director" },
  { filmId: "film-creek-runner", personId: "person-ebiere-tonye-douglas", role: "actor", characterName: "Ebi" },
  { filmId: "film-creek-runner", personId: "person-tamuno-briggs-alagoa", role: "actor", characterName: "Commander Boma" },

  // Love at Area Eleven
  { filmId: "film-love-at-area-eleven", personId: "person-ngozi-ikemefuna-hale", role: "director" },
  { filmId: "film-love-at-area-eleven", personId: "person-folake-odusanya-blake", role: "actor", characterName: "Zara" },
  { filmId: "film-love-at-area-eleven", personId: "person-emeka-nwosu-hart", role: "actor", characterName: "Tobenna" },

  // A Wedding in Jos
  { filmId: "film-a-wedding-in-jos", personId: "person-bolanle-ajayi-coker", role: "director" },
  { filmId: "film-a-wedding-in-jos", personId: "person-nkechi-umeh-sterling", role: "actor", characterName: "Ruth" },
  { filmId: "film-a-wedding-in-jos", personId: "person-tunde-olaleye-bassey", role: "actor", characterName: "Pastor Dung" },
  { filmId: "film-a-wedding-in-jos", personId: "person-yetunde-fashola-grant", role: "actor", characterName: "Aunty Lami" },
];
