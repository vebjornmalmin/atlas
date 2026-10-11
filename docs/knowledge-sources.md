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
