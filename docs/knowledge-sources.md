# Foundation knowledge provenance

The installed foundation contains 126 shared entities, 147 typed relationships, 141 retrieval targets, 10 collection views and two timelines. It is a curated starting package, not the eventual 2,000–3,000 entity library. Coverage is deliberately uneven: presidential chronology is complete; other domains are introductory selections.

Every entity, relationship, target and timeline carries source IDs resolving to HTTPS source URLs inside the package. Summaries and explanations are original factual descriptions. Source articles, photographs, scans and literary text are not redistributed. A source's `license` field records this reuse boundary; it does not claim a blanket license over the original website.

Evidence was checked on 10 October 2026. Some Nobel pages reject direct fetches; their indexed official summaries and official historical Nobel essays supplied the verified facts. No external calls are needed during exercises.

| Domain | Evidence | Scope |
| --- | --- | --- |
| US presidents | [White House Historical Association chronology](https://www.whitehousehistory.org/the-presidents-timeline) | Presidency start/end years and succession, 1789 through the administration beginning in 2025 |
| Nobel and science | [Official history of physics prizes](https://www.nobelprize.org/prizes/themes/the-nobel-prize-in-physics-1901-2000/), official laureate records and award summaries | Categories, award years and paraphrased scientific contributions |
| Literature | [Project Gutenberg primary edition records](https://www.gutenberg.org/ebooks/1342), [Fosse biobibliography](https://www.nobelprize.org/prizes/literature/2023/bio-bibliography/) | Authorship; Fosse's written language; no book text copied |
| World geography | [UN Statistics Division country profiles](https://data.un.org/legacy/en/iso/no.html) | Ten capitals and the UN statistical geographic regions; no population estimates used |
| Norwegian geography | [Kartverket 2024 county reform](https://www.kartverket.no/om-kartverket/nyheter/eiendom/2024/januar/kommune-og-fylkesendringene-per-1.-januar-2024) | Oslo from UN evidence; date-specific county reform and replacement counties |
| History | [UK National Archives Magna Carta](https://www.nationalarchives.gov.uk/explore-the-collection/explore-by-time-period/medieval/magna-carta/), [US National Archives timeline](https://www.archives.gov/founding-docs/timeline), [National Army Museum D-Day](https://www.nam.ac.uk/explore/d-day), [UN history](https://www.un.org/en/about-us/history-of-the-un), [NASA Apollo 11](https://www.nasa.gov/mission/apollo-11/) | Five dated historical anchors |
| Art | [National Gallery collection records](https://www.nationalgallery.org.uk/paintings/claude-monet-the-water-lily-pond), [Mauritshuis](https://www.mauritshuis.nl/en/our-collection/artworks/670-girl-with-a-pearl-earring), [MUNCH](https://www.munch.no/en/The-Scream/) | Authorship and catalog-specific dates for five works; no artwork files included |

Presidential chronology represents 47 administrations and 45 people. Cleveland's 22nd/24th and Trump's 45th/47th administrations reference shared person IDs. Each timeline entry has its own stable administration ID and ordinal, so the two 1841 and two 1881 transitions remain ordered even though the year matches. Term dates have year precision; they must not be presented as exact inauguration dates. The final term is marked ongoing as of the verification date, with no invented end year.

Collections reuse target IDs. Learning Oslo in World capitals also advances Norwegian geography and European capitals; Nobel science targets appear in both Nobel and Scientific foundations. Collection membership does not create separate copies of a person or a memory target.

The package provides factual relationships, not speculative educational connections. A relationship confidence of 1 means the stated relationship is directly documented by its cited record; it is not a statistical confidence estimate. Difficulty and significance are editable editorial heuristics on a 1–5 scale, independent of personal memory scheduling.

Run `node scripts/validate-knowledge.mjs` to check IDs, all references, descriptions, explanations, years, chronology, non-consecutive administrations and count metadata. Validation checks structure and editorial invariants; it cannot independently prove a factual assertion. Content corrections require review against the source.

Remaining content work: all Norwegian counties and cities, broader country coverage and borders, deeper historical context, licensed visual media, and substantially more literature, art and scientific connections. Expansions should pass the same source and quality checks rather than meeting a count through repetitive questions.

## Dynamisk innlasting av bilder og spørsmål

Biblioteket og emnesidene har «Hent flere bilder og spørsmål». Biblioteket henter opptil åtte tidligere uhentede kildeposter fra valgt samling per trykk; emnesiden kan hente samme post på nytt. Eksisterende Wikidata-ID-er gir et utgangspunkt for over tusen registerposter. Dette er ikke en påstand om at alle postene har et brukbart bilde eller et nytt spørsmål.

Den felles spørringsstrukturen er definert i `src/lib/source-loading.js` som `SOURCE_QUERY_STRUCTURE`. Den følger identitet og kildebelegg, ikke fritekstsøk etter navn:

| Kilde | Innparameter | Struktur og kobling |
| --- | --- | --- |
| Wikipedia, alle språkverter | HTTPS-artikkellenke fra nodens kilder | `action=query`, `prop=pageprops\|info`, `redirects=1`, `titles`; `pageprops.wikibase_item` peker på samme Wikidata-post. Tvetydighetssider utelates. |
| Wikidata | Eksakt Q-ID fra artikkelen eller noden | `action=wbgetentities`, `props=labels\|aliases\|claims\|sitelinks`; svarnoder hentes samlet med norske navn og aliaser. |
| Wikimedia Commons | Filnavn fra den identifiserte postens P18 | `action=query`, `prop=imageinfo`, `iiprop=url\|size\|extmetadata`, `iiurlwidth=900`; kontroll av filadresse, lisens, fotograf/kreditering og dimensjoner. |
| The Metropolitan Museum of Art | Eksakt objekt-ID fra museumskilden | `/public/collection/v1/objects/{id}`; bildet brukes bare når `objectID` stemmer og `isPublicDomain` er sant. Kunstnerforbindelsen får museumskatalogen som kilde. |

API-kontraktene er dokumentert hos [MediaWiki](https://www.mediawiki.org/wiki/API:Query), [Commons-bildemetadata](https://www.mediawiki.org/wiki/API:Imageinfo), [Wikidata](https://www.wikidata.org/w/api.php?action=help&modules=wbgetentities) og [Met](https://metmuseum.github.io/). Wikipedia-strukturen er generell på tvers av språk, men behandler én identifisert artikkel om gangen; den laster ikke ned hele Wikipedia. Andre nettsteder trenger egne adaptere for faktisk dokumenterte felt, identitet og lisens.

Når kilden ikke gir nye brukbare påstander, lager innlastingen også spørsmål fra allerede dokumenterte forbindelser i det installerte nettverket: pris, institusjon ved pristildelingen og anerkjent faglig bidrag. År, entydig svar og kildereferanser må finnes i forbindelsen. Disse spørsmålene bruker samme kunnskapspåstand som forbindelsen og introduserer ingen nye faktapåstander.

Spørsmålsmalene bruker fødested (P19), dødssted (P20), forfatter (P50) og kunstner (P170). Bare én entydig verdi med en eksplisitt HTTPS-kildelenke i referansene og et norsk svarnavn blir til et kortsvarsspørsmål. Foretrukne påstander prioriteres. Utgåtte, tidsavgrensede eller andre kvalifiserte påstander, flertydige svar og manglende kildebelegg utelates. Sammenheng, referanselenker og eventuell postrevisjon følger spørsmålet. Det lages ikke formåls- eller oppdragsgiverspørsmål fra antakelser.

Generiske Wikipedia-/Wikidata-bilder brukes ikke automatisk som en bestemt versjon av et kunstverk. De fem gjennomgåtte lokale versjonene beholdes. Nye kunstbilder krever et eksakt museumskatalogobjekt; personbilder og andre illustrasjoner kommer fra identifiserte P18-filer med godkjent fri lisens. Kreditering og lisens er tilgjengelig i fordypningen etter svaret. Navnet i alternativ tekst skjules før svaret.

Nedlastingen skjer bare etter brukerens valg. Offentlige kildeidentifikatorer sendes til kildene; svar, fremgang og personlige innstillinger sendes ikke. Nye forbindelser og spørsmål valideres som et lokalt tillegg til installert kunnskap. De bevarer tidligere spørsmåls-ID-er, minneplan og påbegynte svar, og følger med den vanlige sikkerhetskopien i innstillinger. Bildene lagres som lokale dataadresser, maksimalt 2 MB per bilde og 8 MB totalt før base64-koding. Tillegget gjenopprettes ved oppstart, etter innholdsoppdatering og fra sikkerhetskopi. Midlertidige nettfeil lar tidligere innhold være tilgjengelig; et tillegg som ikke lenger passer med en oppdatert grunnpakke holdes utenfor visningen.
