# Geografisk kunnskapsnettverk

Geografipakken bygger et komplett register over områdene i FNs M49-tabell og norske kommuner, og et utvalg øvelser som knytter geografiske nivåer sammen. Registerdekning og øvingsdekning er forskjellige størrelser: hver kommune finnes som node uten at alle trenger den samme enkle fylkesøvelsen.

## Dekning

- 248 land og områder fra [FNs M49-inndeling](https://unstats.un.org/unsd/methodology/m49/overview/), med ISO2, ISO3 og M49-kode. Dette er områder i en statistisk inndeling; antallet er ikke antallet selvstendige stater.
- 30 geografiske regioner og forbindelser gjennom hele M49-hierarkiet. Afrika sør for Sahara og Latin-Amerika og Karibia er delregioner; Afrika har også mellomregioner som Øst-Afrika.
- 210 bynoder fra individuelle [UNdata-profiler](https://data.un.org/legacy/en/iso/no.html). Opplysninger med fotnoter, uavklart hovedstadsstatus eller kjente overgangssituasjoner er utelatt fra ukvalifiserte hovedstadspåstander.
- Alle 15 fylker og 357 kommuner fra [Kartverkets register](https://www.kartverket.no/til-lands/fakta-om-norge/norske-fylke-og-kommunar). Oslo gjenbruker bynoden og får kommunenummer 0301; den er koblet til en egen fylkesnode.
- 329 nye øvelser: 108 om geografisk delregion, 93 hovedsteder, 103 motsatte hovedstadsforbindelser, 23 utvalgte kommuners fylker og to om administrative nivåer. Ti eksisterende hovedstadsøvelser beholdes uten å opprette duplikater.

Pakken inneholder 859 noder, 1069 relasjoner og 212 kildereferanser. Flere noder finnes allerede i grunnpakken, så antallet nye noder etter sammenslåing er lavere.

## Navn, kontekst og usikkerhet

Visningsnavn på land følger norske regionnavn i den lokale språktabellen. Opprinnelige engelske navn oppbevares som metadata eller alternative svar. Kommunenes fullstendige offisielle flerspråklige navn beholdes, mens Bokmål-visningen bruker det norske navnet. Herøy og Våler får fylkesnavn i parentes for å skille to forskjellige kommuner med samme navn.

Spørsmål om geografisk delregion sier uttrykkelig at det gjelder FN. Det hindrer at en statistisk inndeling behandles som en entydig kulturell eller politisk region. Kildestøttet forklaring og videre forbindelser vises etter svaret. Feltet `answerType` skiller land, hovedstad, region og fylke, slik at flervalg kan bruke alternativer på samme geografiske nivå.

38 M49-områder mangler en trygg, ukvalifisert hovedstadsopplysning i denne importen. Årsaken er registrert i `excluded`; noen profiler mangler opplysningen, andre kvalifiserer den i fotnote. Fravær betyr ikke at området mangler et administrativt sentrum. Indonesia, Sør-Afrika, Nederland, Bolivia, Sveits og omstridte områder må få egne, presise formuleringer før slike øvelser legges til. Pakken fastslår ikke nye hovedstadsendringer uten en nyere primærkilde.

## Gjenbygging og kontroll

Kjør `node scripts/ingest-geography.mjs` fra prosjektroten. Scriptet leser det lagrede kildeuttrekket i `knowledge-build/geography.json` og den uforanderlige grunnpakken `knowledge-build/base-foundation.json` versjon 1.0.2. Det skriver geografipakken på nytt. Dette er en deterministisk gjenbygging fra et kildeuttrekk, ikke en automatisk henting av nye kilder.

Kildeuttrekket er datert 10. oktober 2026 og inneholder M49-rader, individuelle hovedstadsopplysninger med profiladresse og fotnotemarkering, samt Kartverkets kommunerader. SHA-256 av uttrekket oppbevares i `provenance.snapshotSha256`. En oppdatering krever et nytt uttrekk, ny dato og kontroll av fotnoter og administrative endringer; de forventede registertallene må vurderes ved endring.

Gjenbyggingen kontrollerer 248 M49-rader, 15 fylker og 357 unike kommunenumre. Den validerer også sammenslåingen med grunnpakken: ingen dupliserte etiketter innen samme type, ingen dupliserte spørsmål, gyldige kildereferanser og samlinger, og ingen relasjoner til manglende noder. Eksisterende identiteter og øvelser beholdes; kommunenumre gjør identitet uavhengig av navneform.

Pakken består av faktiske opplysninger og egne sammendrag. Den gjengir ikke institusjonenes løpende forklaringstekst. Kartgeometri og dens lisens håndteres separat i `docs/map-sources.md`.
