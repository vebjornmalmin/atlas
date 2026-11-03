# Atlas

Offline kunnskapstrening på norsk, laget for iPhone 17 Pro.

Live app: https://atlas-first-app.atlas-memory.workers.dev

## Gjeldende utgave — 1.1.2: Innstillinger på én side

Innstillinger er én flat liste uten undersider: utseende, daglig påminnelse, oppdateringer, sikkerhetskopi, gjenoppretting og installasjon. Én knapp ser etter både app- og innholdsoppdateringer. Den egne utviklersiden er borte; diagnostikken ligger i en lukket «Diagnostikk»-seksjon nederst på samme side.

Kontrollert i iPhone 17 Pro-simulatoren mot produksjonsbygget kjørt lokalt: Innstillinger viser én liste med app 1.1.2 og innhold 2.1.0, Diagnostikk er lukket nederst, og I dag viser dagens økt og læringsveien. 178 automatiske tester består.

## 1.1.1: Én dagens økt

I dag-skjermen har nå bare ett kort for dagens økt. Før viste den både et «Fortsett der du var»-kort og et «Start dagens økt»-kort, begge med tittelen «Dagens økt», når en økt fra en tidligere dag ikke var fullført. Regelen er nå:

- **Dagens økt er påbegynt:** kortet viser fremdriften og «Fortsett der du var».
- **En økt fra en tidligere dag står uferdig:** kortet viser dagens plan og en linje om den uferdige økten med «Fortsett den». Starter du dagens økt, legges den gamle under «Quizer på pause», så ingenting går tapt.
- **Fri quiz og emnequiz** har fortsatt sitt eget fortsettkort, fordi de ikke er dagens økt.

«Din læringsvei» var tom når bare registre (for eksempel Nobelpriser) var valgt i utvalget. Læringsveien ser nå bare på fagområdene i pensumet, som dagens økt allerede gjorde, og kortet skjules hvis det ikke er noe å vise.

Publisert 3. november 2026: app 1.1.1, utgivelse `0ff7aa155068`, kunnskapspakke 2.1.0 (uendret), via Wrangler. Kontrollert i mobilvisning mot produksjonsbygget med en uferdig økt fra dagen før og bare Nobelpriser valgt i utvalget.

## 1.1.0: Verden gjennom tjue historiesyn

Ny fane **Verden** ved siden av Emner: den samme kunnskapsgrafen sett gjennom tjue historiesyn, fra kildekritikk og Ibn Khalduns sykluser til Annales, Hayden Whites metahistorie, verdenssystem, Big History og Mackinders geopolitikk. Hvert syn har et grunnspørsmål, tenkere, verk, begreper, kritikk og en synlig blindsone. Kartet, rangeringen, forbindelsene og «Finn sammenhengen» vektes etter linsen og etter brukerens vekting av påvirkning, aktualitet og nærhet til Oslo. Den samme vektingen ordner spørsmål fra registrene og fri quiz. Dagens økt i læringskjernen følger fortsatt pensumets rekkefølge.

Kunnskapspakke 2.1.0 bygger perspektivlaget oppå læringskjernen: 302 landegrenser fra kartgrunnlaget, 116 strømmer av Nobelprisvinnere mellom land, 48 historikere og tenkere, 52 verk, 45 begreper, Whites troper og plotformer, David Christians åtte terskler og 27 daterte nyheter fra 21. oktober til 2. november 2026. Ti nye øvelsesformer under fri quiz: flagg begge veier, naboland, naboreise, nyhetskartet, linsens spørsmål, tenkere og ideer, plottlesing, skalastigen, kunnskapsflyt og perspektivbytte. Pensumets emner holdes utenfor påvirkningsberegningen, slik at kjernen kan bygges om uten å gjøre perspektivlaget ugyldig.

Modell, mål, avgrensninger og validering: [docs/world-perspectives.md](docs/world-perspectives.md).

Tjenestearbeideren henter nå hver utgaves filer forbi nettleserens HTTP-buffer. En test mot en server uten `Cache-Control` viste at en ny utgave ellers kunne lagre forrige utgaves side sammen med sine egne filer, og appen ble blank etter oppdatering. Den publiserte Workeren sender `no-cache` og var ikke rammet, men utgavene er nå uavhengige av mellomlagring. Oppdatering fra 1.0.0 til 1.1.0 er kontrollert i iPhone 17 Pro-simulatoren mot Workeren kjørt lokalt: påbegynt emne og svar ble bevart, og Verden fungerer på den oppdaterte pakken.

Publisert 3. november 2026: app 1.1.0, utgivelse `4323f301106f`, kunnskapspakke 2.1.0. Helse- og versjonsendepunktene, pakkens hash og tjenestearbeideren er kontrollert mot bygget. En installert 1.0.0 i iPhone 17 Pro-simulatoren fikk tilbud om oppdatering på den publiserte adressen, oppdaterte seg og åpnet Verden. Publiseringen gikk via Wrangler med samme oppsett som 1.0.0 (Cloudflare-tilkoblingen var ikke tilgjengelig i økten).

## 1.0.0: Læringskjernen

Atlas er bygd om rundt et kuratert pensum for én voksen elev på iPhone 17 Pro.

- **Læringskjernen**: 9 fagområder, 84 emner og 1093 kort, skrevet fra Store norske leksikon, faglig gjennomgått av fire fagspesialister og språkvasket. Hvert emne har en kort innføring, punkter som skal sitte, kilder og kort i fire steg: oversikt, kjerne, sammenheng og detalj.
- **Progresjon**: emner bygger på hverandre på tvers av fag. Dagens økt starter med repetisjoner, åpner nye emner med innføringen som eget steg, og sprer spørsmålene slik at eleven henter fram i stedet for å kopiere. Et emnes grunnlag regnes som på plass først når det er husket også en annen dag.
- **Skjermer**: I dag (dagens økt og læringsvei), Emner (fagområder, tidslinje, emnesider), Verden (fra 1.1.0), Søk, Fremgang (kunnskapskart) og Innstillinger.
- **Svar**: jevn stokking av alternativer, toleranse for skrivefeil, årstall og tall, egen godkjenning av tekstsvar, sjekkliste for forklaringer og ett trykk på «Neste».
- **Registrene** (land, kommuner, Nobelpriser, presidenter) er beholdt som oppslagsverk og fri quiz. Tidligere repetisjoner fortsetter i dagens økt.

Modell og beslutninger: [docs/learning-core.md](docs/learning-core.md). Skrive nye emner: [docs/curriculum-authoring.md](docs/curriculum-authoring.md).

Publisert 2. november 2026: app 1.0.0, utgivelse `cbdd4fd4fe3e`, kunnskapspakke 2.0.0 (84 emner, 1093 kort). Helse- og versjonsendepunktene og pakkens hash er kontrollert mot bygget, og den publiserte appen er installert og startet i iPhone 17 Pro-simulatoren. Den første publiseringen viste at Safari kan melde `navigator.onLine = false` selv om nettet virker; appen prøver nå nettverket og regner bare et mislykket kall som frakoblet.

Publiseringen gikk denne gangen via Wrangler, fordi Cloudflare-tilkoblingen ikke var tilgjengelig i økten. Oppsettet tilsvarer det tidligere: `name = "atlas-first-app"`, `main = "worker.mjs"`, `compatibility_date = "2026-10-10"`, `workers_dev = true`, `no_bundle = true` og observability slått på.

## Source and deployment

The app lives in `src/`; public knowledge, maps, icons, and the manifest are in `public/`. Run `npm install`, `npm test`, and `npm run build`. The build validates and hashes knowledge, compiles the SvelteKit app, generates a versioned service worker, and creates `worker.mjs` with compressed public assets. Run `npm run dev` for local development.

Deployment uses the authenticated Cloudflare plugin's API tools. Upload `worker.mjs` as a module using multipart metadata with `main_module: worker.mjs`, compatibility date `2026-10-10`, and observability enabled. The Worker is named `atlas-first-app`; its workers.dev route is enabled. No Wrangler CLI is required. Precompressed responses use explicit manual body encoding.

Cloudflare serves public assets only. Personal learning data remains on the current browser/device and may be cleared by browser settings. Offline learning needs one successful online visit and completed cache installation.

## Revised delivery plan — 10 October 2026

Atlas is an offline-first knowledge and long-term memory training PWA. The supplied mission is the proposed product roadmap. The current release delivers the first learning foundation; subsequent work expands its content and exercise depth through stable releases.

The original proposed mission is preserved in `docs/proposed-mission.txt`.

### Changes from the proposal

- Replace Wrangler installation and interactive login milestones with the authenticated Cloudflare plugin. Access and deployment are already established.
- Every screen targets mobile use. Desktop browsers may render the same PWA, with no separate desktop interface or milestone.
- Remove the personal name from the public address. Use the neutral `atlas-memory.workers.dev` suffix.
- The first learning release now contains actual recall exercises and sourced knowledge. A deployed shell alone does not complete the first product milestone.
- Bring a minimal entity/relationship/retrieval-target schema and IndexedDB into that first learning release. Otherwise temporary question IDs and localStorage scheduling would need avoidable migrations.
- Keep all personal state on-device, without sign-in or hosted personal databases. This replaces the earlier starter roadmap's suggestion of possible authentication and shared storage.
- Integrate testing, accessibility, backups, update safety, and mobile performance throughout the milestones instead of postponing them to final polish.
- Treat the large content counts as long-term quality targets. Begin with a small verified package; expand only when sources and exercises pass validation.

### Release sequence

1. **Deployment foundation — shipped.** Mobile shell, manifest, icons, service worker, local note persistence, and Cloudflare deployment. Physical-phone installation remains to be verified. Learning sessions now ship in release 0.2.0.
2. **First learning release — shipped in 0.2.0.** Today home screen, a short free-recall session, answer reveal, contextual feedback, and local review history. Ship a small source-verified package covering geography, history, and science. Use stable entity, relationship, and retrieval-target IDs, IndexedDB migrations, and separate content from learning state. Include export/restore and offline learning checks.
3. **Memory scheduling — implemented.** Integrate a maintained FSRS implementation, per-target review state, due reviews, daily duration, and performance-based scheduling. Validate scheduling and persistence across app restarts. Do not represent an interim scheduler as FSRS.
4. **Navigation and focus — implemented.** Today, Focus, Explore, Progress, and Settings. Implement progressive disclosure for subject, topic, geography, time, depth, objective, breadth, and discovery/review balance. Collections share targets and progress; default relevance is Oslo, Norway without excluding global significance.
5. **Exercises and exploration — foundation implemented; advanced formats pending.** Add recognition, before/after, chronology, connections, collection recall, context reconstruction, and art recognition. Search entities and browse sourced relationships. Distinguish explicit facts from suggested educational connections. Reject unclear or redundant questions.
6. **Offline geography — modern outlines and map taps implemented.** Package licensed country and Norwegian county boundaries locally. Support outlines, blank-map taps, capitals, and relationships without hosted map tiles. Validate touch interaction and modern/historical boundary distinctions. Use MapLibre only if required by the interaction and performance needs.
7. **Safe content delivery — first package mechanism implemented.** Versioned JSON packages, public manifest, hashes, compatibility checks, atomic activation, rollback, and explicit entity migrations. Preserve personal review state. Check approximately daily while active and opportunistically on startup, resume, and reconnection. Closed-PWA background execution is optional, never required for correctness.
8. **Ingestion and quality.** Source adapters for Wikidata, Wikipedia, the official Nobel API, Natural Earth, and official geographic data. Retrieve current API and licensing documentation before implementing adapters. Deterministically normalize, validate, connect, and generate targets, preserving provenance. Track coverage, prerequisites, mastered/weak/unintroduced targets, and exhaustion separately from reviews due.
9. **Diagnostics and reliability — implemented.** The collapsed Diagnostics section at the bottom of Settings exposes measured storage, quota, persistence, graph integrity, scheduling decisions, package updates, and bounded local errors. Include diagnostic export, database export/import, index rebuilding, manual validation/update checks, offline readiness, and confirmation for destructive actions. Keep Knowledge Readiness, Memory Mastery, and Learning Difficulty separate and explain their formulas.
10. **Knowledge expansion.** Build substantial collections for US presidents, Nobel laureates, world and Norwegian geography, history, literature, art, and science; add enough meaningful collections to reach the proposed portfolio. Aim eventually for 2,000–3,000 entities, 8,000–12,000 verified relationships, and 4,000–6,000 distinct targets without filler. Suppress automatic optional expansions for the first 14 days while permitting corrections and explicitly requested topics.
11. **Reminders and polish — browser foundation implemented; phone checks pending.** Preferred practice time, due indicators, and recurring calendar `.ics` export. Light/dark themes, smaller-phone layout, safe-area/keyboard behaviour, accessibility, startup performance, and lazy media loading. Do not promise closed-app local notification scheduling.

The implementation uses SvelteKit, Svelte, and Vite with a static build. Next.js is excluded following the framework preference. Cloudflare serves only public assets and knowledge packages. Add public-content storage or scheduled publication jobs only when the package mechanism requires them, and document the dependency. No personal learning data is uploaded.

### Acceptance checks for every release

Run relevant automated knowledge, learning, migration, update, and backup tests. Verify the deployed release, then exercise the mobile flow through first launch, session completion, persistence, restart, and actual network-disabled operation. Validate previously installed knowledge after interrupted or failed updates. Check installability and service-worker updates, including preservation of active sessions. Physical-phone checks supplement browser testing.

The complete product is not done until the mission's graph, substantial sourced content, focus controls, spaced repetition, multiple exercise mechanics, offline geography, safe updates, local diagnostics, backup/restore, and automated validation are implemented and tested. No background automation or continuing build job has been scheduled by this plan revision.

## Validation

77 automated tests pass across knowledge integrity, exercise grading, FSRS scheduling, focus selection, IndexedDB persistence, atomic updates, backups, invalid restore rollback, calendar output, and bounded diagnostic logs. Production compilation succeeds.

Browser verification at a 390 × 844 phone viewport covered a ten-question session, saved reviews, restart and paused-session resumption, and correct Norwegian county selection while the service worker blocked network requests. The live release also restarted in cache-only mode and upgraded successfully from the previous app shell. Physical-phone installation and airplane-mode checks remain outstanding.

The old personal-name address was retired and no longer resolved in a fresh network check. Any previously installed offline copy is separate from the retired public route.

The roadmap remains larger than this first learning release: substantial knowledge expansion, historical boundaries, collection recall/context reconstruction, art-image exercises, broader topic ingestion, and advanced historical map arrows are later work. Quality checks for installed content do not claim full subject coverage.

### Later exercise: geography with historical context

Combine maps, event dates, and historical relationships. Ask learners to draw a directional arrow between countries, then retrieve the specific event and year. Prompts must name a precise, sourced event rather than imply a disputed single cause or universal start date. Use historically appropriate boundaries or explicitly label modern boundaries. This belongs after the foundational map and history exercises are reliable.

## Norsk og tilbakemeldinger — 0.3.0

Alle spørsmål, svarforklaringer, kartoppgaver og navigasjon er på norsk bokmål. Kunnskapspakken er 1.0.1; stabile øvelses-ID-er beholder tidligere læringshistorikk. Tidligere engelske svar godtas fortsatt der det er relevant.

«Gi tilbakemelding» er tilgjengelig på alle skjermer. Et trykk tar et bilde av den synlige appskjermen før dialogen åpnes. Kommentar, skjermbilde, spørsmål-ID, pakkeversjon, aktuell skjerm, øvelsesstatus og fokusvalg lagres lokalt i en separat tilbakemeldingsdatabase. Lukk dialogen eller velg «Fortsett der du var» for å gå tilbake uten å endre spørsmålet, det påbegynte svaret eller øktens fremgang.

Åpne samme knapp senere for å finne lagrede rapporter. Kopier tekst og kontekst, kopier eller last ned skjermbildet, eller last ned hele rapporten som en JSON-fil med bildet inkludert. Rapporten kan legges ved i en chat. Nettlesere uten bildekopiering får nedlasting og deling som alternativer. Ingenting sendes automatisk. Tilbakemeldingsrapporter er separate fra sikkerhetskopien av læringsdatabasen; last ned rapporter du vil ta vare på utenfor denne enheten.

Skjermbildet gjengir appens synlige innhold, inkludert kart, med en lokal renderer. Det inneholder ikke nettleserens verktøylinje eller mobilens tastatur. Hvis gjengivelsen feiler, kan et eget skjermbilde vedlegges.

79 automatiske tester bestått. Mobil nettlesertest bekreftet lokal lagring, gjenåpning etter omstart, PNG/JSON-eksport, kopiering av tekst og bilde, og retur til samme spørsmål med et uferdig svar bevart.

## Læring i sammenheng — 0.4.0

Svarfelt tilpasses oppgaven: ett kompakt felt for navn, et smalere felt med talltastatur for årstall, og flere linjer ved forklaringssvar. Før svaret vises relevant støtte som ikke røper den testede opplysningen; etterpå vises fordypning og kildebelagte forbindelser.

Fem lokale bilder viser de konkrete versjonene av Solsikker, Vannliljedammen, Arnolfini-portrettet, Pike med perleøredobb og Skrik. Bildene er pakket for offline bruk med kilder, versjoner og lisensinformasjon. Ni nye kunstmål omfatter blant annet tittelgjenkjenning, dokumentert formål og sted. Kunnskapspakke 1.0.2 har 129 entiteter, 150 forbindelser og 150 kuraterte mål; tidligere mål beholder sine ID-er og læringshistorikk.

Prinsippet for produktfeedback er lagret i AGENTS.md: rett den konkrete feilen, undersøk det underliggende behovet og samme årsak i beslektede komponenter, og verifiser både eksemplet og representative andre tilfeller.

Validering av 0.4.0: 82 tester består. Mobilvisningen ble kontrollert med bilde, kompakt årstallfelt og utfyllende tilbakemelding. På den publiserte adressen ble kunstbildet også lastet fra installert cache mens nettverkstilgang var blokkert i appens service worker.

## Kunnskapsnettverk — 0.5.0

Tre faglige importer bygger et felles nettverk fra FN, Kartverket, Nobelprisens register og litterære primærtekster. Registeret omfatter 248 land og områder, 357 norske kommuner, 15 fylker, 1018 Nobelprisvinnere og 42 litterære verk. Land og personer deles mellom fagområdene; tidligere øvelses-ID-er beholdes.

Søk og forbindelser vises i porsjoner på mobil. Flervalg bruker eksplisitte svargrupper, og lange tidslinjer deles i små øvelser. Nye apputgaver utløser oppdatering fra eldre grunnpakker uten å erstatte læringshistorikken.

Registerdekning og øvingsdekning er separate mål. Bredere kunst- og historiedekning, dypere vitenskapelige begreper og flere varierte øvelser gjenstår. Kunnskapsberedskap på 100 % gjelder kontrollkriteriene for installert pakke. Det betyr ikke at hele kunnskapsnettverket er faglig komplett.

Gjenbygging og avgrensninger beskrives i docs/knowledge-network.md og de tre faglige importdokumentene.

Den publiserte pakken 1.1.1 inneholder 3178 elementer, 6446 forbindelser, 798 øvelsesmål og 1995 kildereferanser i 17 samlinger. Alle noder har forbindelser. 88 tester består, og oppdatering på eksisterende enhet samt nettverkets søk og litterære forbindelser er kontrollert i cachebasert frakoblet test.

## Fri ekstraøving — 0.6.0

Anbefalt øktlengde er en rytme, ikke en daglig grense. I dag har egne knapper for blandet quiz, flervalg, kart, omriss, tidslinje og tekstsvar. Ekstraøving lagres separat i historikken uten å flytte planlagte FSRS-repetisjoner. Nylig øvde oppgaver prioriteres etter andre tilgjengelige oppgaver, slik at nye ekstraøkter ikke alltid starter likt. Etter en økt kan du ta en quiz til. Blandede anbefalte økter varierer også øvelsesform.

92 tester består, inkludert øving når ingen repetisjoner er klare, rotasjon, faktiske tidslinjeøvelser og sikkerhetskopi av ekstraøving uten endrede repetisjonsdatoer. Linkkontrollen dekker 1991 unike eksterne adresser: 1990 svarte på HTTP-kontroll; Mauritshuis blokkerte automatisk forespørsel, men museumssiden ble bekreftet ved en separat sidelesing. Resultat og kontrolltidspunkt ligger i docs/link-audit.json. Dette er en kontroll på tidspunktet, ikke en garanti for eksterne tjenesters fremtidige tilgjengelighet.


## 0.7.0 – Grunnlag før sammenhenger

Quizmenyen skiller dagens utvalg fra fri emnequiz. Personsider starter en quiz om personen når det finnes spørsmål. Grunnlag utelukker eksakte årstall, rekkefølge og sammenhengsoppgaver; neste nivå legger til detaljer, deretter sammenhenger. Nivåvalget er manuelt. Nybegynnerinnholdet har 12 kildebelagte historiske introduksjoner og periodestøtte for presidenter uten slike introduksjoner. Dette er en start, ikke full biografisk dekning.

Introduksjon og spørsmål er separate steg. Svar etter introduksjon eller hint regnes som øving med støtte, ikke som selvstendig riktig svar. Fri quiz teller i fremgangen, men endrer fortsatt ikke planlagte FSRS-repetisjoner. Fremgang viser besvarte spørsmål og siste riktige svar uten hjelp, ikke et udokumentert mestringsnivå.

Quizutvalget slår sammen tekst-/flervalgsvarianter og kart-/omrissvarianter. Geografiske spørsmål med samme svar unngås i samme quiz. Nylig besvarte varianter viker for usett innhold. Ved et lite utvalg kan spørsmål komme tilbake i en senere quiz. Kartets startutsnitt avhenger bare av kartpakken, aldri av svaret; brukeren kan zoome og flytte utsnittet.

Påbegynt svar, kartvalg, tidslinjerekkefølge og læresteg journalføres lokalt for omlasting. Ny quiz arkiverer en uferdig quiz som kan fortsettes fra menyen. En full sikkerhetskopi inneholder IndexedDB-økter; den løpende journalen for aktivt, ikke vurdert svar ligger separat i nettleserlagring.

Produkttekst skal hjelpe brukeren å forstå et valg, en oppgave eller et resultat. Stemningsfraser og generelle instruksjoner som gjentar spørsmålet er fjernet fra hovedflyten. Teknisk diagnostikk ligger under Innstillinger.

Innstillinger er én flat liste uten undersider: utseende, daglig påminnelse, oppdateringer, sikkerhetskopi og installasjon. Én knapp ser etter både app- og innholdsoppdateringer. Teknisk diagnostikk ligger i en lukket «Diagnostikk»-seksjon nederst på samme side, ikke på en egen side.

Kontrollert for 0.7.0: 106 tester bestått; mobilkontroll ved 390 × 844 av emnequiz, personquiz, læringssteg, fremgang og gjenopptak. Påbegynt tekst og vist flervalgssvar beholdes etter omlasting. En tidligere presidentquiz ble gjenopptatt på spørsmål 2 etter at andre quizer var startet. Publisert og kontrollert ny quizmeny; eksisterende påbegynt produksjonsøkt beholdt. Utgivelse: 69e91ea8868e.

## 0.8.0 – Oppdatering, emnequiz og vurderte nivåer

Innstillinger har en egen appsjekk, adskilt fra innholdsoppdatering. Appen henter versjonsinformasjon uten mellomlagring, ber nettleseren se etter en ny apputgave og venter på nedlasting før installasjon tilbys. Automatisk sjekk skjer ved oppstart, ved retur til synlig app/nett og hvert femte minutt mens siden er synlig, med fem minutters begrensning mellom automatiske sjekker. Manuell kontroll omgår begrensningen. Manglende nett eller ufullført nedlasting omtales aldri som «nyeste utgave». Ingen bakgrunnssjekk loves når appen er lukket.

Fra en persons emneknapper starter nå en quiz i akkurat det emnet, uten å endre dagens utvalg. Et valgt emne i Søk har også egen startknapp og nivåvalg.

Alle 798 pakkespørsmål og 57 innledende spørsmål er dekket av en eksplisitt oppgavefamilie med begrunnelse i difficulty-audit.json. De 46 presidentrekkefølgene er nivå 5 også i flervalg; tiltredelsesår er nivå 4. Nobelprisår og komplette navnelister er nivå 5. Kort svar betyr ikke lett spørsmål, og en forbindelse i kunnskapsnettverket betyr ikke automatisk avansert oppgave. Klassifiseringen lagres i kunnskapspakke 1.1.2 og gjentas ved senere sammenslåing. Det er redaksjonelle anslag per oppgavefamilie, ikke empirisk kalibrerte elevnivåer. Grunnlagstilbudet er fortsatt tynt i flere emner; nettverkets registerdekning skal ikke forveksles med undervisningsdekning. Eldre påbegynte quizer bevares, men avanserte spørsmål får en vei til å starte på grunnlag.

Referanser for oppdateringsmekanismen: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/update og https://developers.cloudflare.com/workers/best-practices/workers-best-practices/.

Kontrollert for 0.8.0: 114 tester bestått. Manuell appsjekk oppdaget en ny lokal utgave uten omlasting, og installasjon beholdt lagrede quizer. Mobilflyten Thomas Jefferson → Quiz: USAs presidenter startet en grunnlagsquiz. Publisert utgivelse a5b8fcb71502, app 0.8.0, kunnskapspakke 1.1.2.

## 0.9.0 – Varierte quizer og fokus på telefonen

Quizflyten viser spørsmål og svarforklaring separat. Hovedmenyen skjules mens en quiz pågår, kontroll- og videreknapper ligger fast nederst, og neste spørsmål starter øverst. Typografi og kart tilpasses små telefonflater. Påbegynte svar og tilbakemeldinger bevares.

Ni koblingsoppgaver, 43 før/etter-oppgaver og fire kildebelagte historiske kartpiler supplerer flervalg, tekstsvar, kart, omriss og tidslinjer. Historiske piler kan tegnes eller besvares med landvelgere, og krever også riktig årstall. Dagens grenser og forenklet retning er tydelig merket. Formatvalg viser når et emne mangler oppgaver av en bestemt type.

Øktsteg viser både fremgang og svarstatus. Fremgangssiden deler oversikt, nivåer, emner og siste svar i egne visninger, viser sju dagers aktivitet og tilbyr målrettet ekstraøving. Feil og læringsstøtte kan øves igjen etter en fullført quiz.

121 automatiske tester består. Mobilkontroll dekker 390 × 844 og 320 × 568, inkludert tegnede piler, lagrede utkast, automatisk skjermflytting, fast videreknapp, retur fra tilbakemelding og frakoblet omlasting. Beslutninger, kilder og avgrensninger finnes i [mobil læringsflyt](docs/mobile-learning.md).

Publisert og kontrollert utgivelse: `e85bdae1a84d`. Cloudflare-utrullingen og den publiserte versjonsfilen bekrefter 0.9.0.

## 0.10.0 – Repetisjon i quizen og historikk over tid

Feil, ukjente svar og svar med hjelp kommer tilbake mot slutten av samme quiz, med inntil to ekstra forsøk per spørsmål. Nye spørsmål vises direkte, og læringsstøtte kan åpnes når den trengs. Første planlagte repetisjon blir i morgen; senere intervaller følger FSRS-historikken og faktisk tid siden øving. Tekst/flervalg og kart/omriss deler repetisjonsplan, med tidligere varianttilstander bevart. Øktgjentakelser lagres uten å blåse opp langtidsintervallet. 128 tester består; mobiltesten bekrefter gjentakelse til slutt, lagring ved omlasting og at en vellykket gjentakelse fjerner tidligere feil fra videre øving.

Utgivelse `bf3c56e16732` er publisert via Cloudflare og kontrollert med hele repetisjonsforløpet i mobilnettleseren.


## 0.11.0 – Stabile fakta og læring i sammenheng

Alle publiserte spørsmål og historiske introduksjoner har eksplisitte koblinger til stabile, kildebelagte påstander. Grafretning, dateringer og undervisningsforutsetninger valideres. Tidligere ID-er og svarhistorikk beholdes, mens gjenkjenning, fri gjenhenting og forklaring får egne repetisjonstilstander.

Fem kuraterte stier innfører betydning før detaljspørsmål og bygger videre til sammenligning og forklaring. Egenvurdering skjer mot innholdskriterier. Spørsmål som røpes av tidligere materiale utsettes til andre økter. Etter svaret vises relevante, dokumenterte forbindelser til tidligere øvd stoff. Dekningsrapporten omfatter alle 17 samlinger og synliggjør hva som fortsatt mangler. Se `docs/knowledge-network.md` for modell, kompatibilitet og redaksjonelle avgrensninger.

Utgivelsen er kontrollert med 152 automatiske tester og produksjonsbygg. Mobilkontrollen ved 390 × 844 bekrefter introduksjon før øving, støttet repetisjon, overgang til forklaring, egenvurdering, separate ferdighetsvisninger, innholdsdekning, gjenoppretting av skrevet svar etter tilbakemelding og omlasting, samt læringssti ved nettverksblokkering. Pakkeutskifting, avviste oppdateringer, sikkerhetskopi og tilbakeføring bevarer historikk i automatiske tester. Fysisk telefon og flymodus er ikke kontrollert i denne utgivelsen.

Publisert utgivelse: `c25cc4269d3b`, app 0.11.0, kunnskapspakke 1.2.0. Cloudflare bekreftet utrullingen; offentlige helse- og versjonsendepunkter samsvarer med bygget. Mobilnettleseren bekreftet de fem læringsstiene etter oppdatering, med tidligere svarantall og påbegynt quiz bevart.
