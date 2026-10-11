# Nobelpriser og vitenskap

Pakken bygges fra Nobelprisens offisielle API, med alle fullførte prisår fra 1901 til og med 2025. Snapshotene inneholder også senere oppføringer. Disse utelates slik at delvis offentliggjorte prisår ikke blandes med et komplett register.

## Innhold

- 1 018 forskjellige prisvinnere og 1 026 prisvinner–tildeling-par.
- 682 kategori–år-oppføringer: 633 tildelte priser og 49 oppføringer uten tildeling.
- 2 212 entiteter og 5 099 kildeforankrede forbindelser i utvidelsen, inkludert eksisterende entiteter som får flere forbindelser.
- 63 redaksjonelt utvalgte bidrag, med 189 norske øvingsmål som kobler bidrag, prisvinner og prisår.
- Seks faglige samlinger og en tidslinje over vitenskapelig anerkjennelse.

Det komplette registeret er et oppslagsnettverk. Det blir ikke automatisk tusen navnespørsmål. Øvingsutvalget omfatter blant annet røntgenstråler, radioaktivitet, atomstruktur, penicillin, transistoren, den genetiske koden, grafen, genomredigering, fredsarbeid og litterære bidrag.

## Viktige skiller

Prisår og oppdagelsesår er forskjellige opplysninger. Spørsmålene tester uttrykkelig prisåret. Ved delt pris brukes bare prisvinnerne som hører til den aktuelle begrunnelsen. For eksempel gjelder kjemiprisen i 1980 flere bidrag; sekvenseringsspørsmålene knyttes til Frederick Sanger og Walter Gilbert, ikke Paul Berg.

Fødeland viser plasseringen av fødestedet etter registerets nåværende geografiske referanse. Det angir ikke statsborgerskap. Land- og områdenoder kan omfatte områder som ikke er selvstendige stater. Institusjonstilknytning gjelder opplysningene ved pristildelingen og sier ikke at personen arbeidet der hele livet.

Avslåtte priser og begrensninger på mottak beholdes som prisstatus. Jean-Paul Sartre og Le Duc Tho får en forbindelse for tildeling, ikke en påstand om at de mottok prisen. Boris Pasternaks registrerte begrensning bevares også. Økonomiprisen betegnes separat som Sveriges Riksbanks pris til minne om Alfred Nobel.

Eksisterende ID-er gjenbrukes for blant annet Marie Curie, Albert Einstein, Jon Fosse og amerikanske presidenter. Barack Obama har eksplisitt kobling mellom navnevarianten i prisregisteret og eksisterende presidentnode. Samme institusjonsnavn får én node; stedsforbindelsene kommer fra dokumenterte tilknytninger.

## Reprodusering

Kjør `node scripts/ingest-nobel.mjs` fra prosjektroten. Skriptet leser de lokale snapshotene og den uforanderlige grunnpakken `knowledge-build/base-foundation.json`. Det validerer utvidelsen sammen med grunnpakken før resultatet skrives atomisk til `knowledge-build/nobel-science.json`.

`node scripts/ingest-nobel.mjs --refresh` henter nye snapshot fra de to API-endepunktene. Antall returnerte rader må stemme med API-ets metadata, og offset må være null. Ufullstendige svar erstatter ikke eksisterende snapshot. Oppdater innhentingsdatoen i skriptet når nye snapshot skal publiseres. Årsgrensen endres først når det nye prisåret er komplett og kontrollert.

Snapshotenes SHA-256, radantall og årsdekning følger pakkens `coverage`. Graphen har både kilder per entitet og kilder per forbindelse. Prisoppføringene peker til API-endepunkter også når det ikke ble tildelt en pris.

API-data er publisert under CC0. Dette omfatter ikke automatisk bilder, forelesninger eller andre nettsidetekster. Ingen av disse mediene kopieres i denne pakken. Lisensgrunnlaget er Nobel Medias [publisering av åpne data](https://www.mynewsdesk.com/us/nobelprize.org/pressreleases/open-data-about-the-nobel-prize-now-available-832152) og API-ets oppgitte vilkårsadresse.

## Kontrollert

Streng pakkevalidering kontrollerer unike ID-er, unike navn innen entitetstype, alle referanser, øvingsmål, kildeadresser, tidslinjerekkefølge og eksisterende presidentkronologi. Utvalgte delpriser kontrolleres mot de konkrete prisvinner-ID-ene; feil ID stopper byggingen.

Svar med flere prisvinnere godtar alle navnerekkefølger og vanlige norske skilletegn. Videre utvikling bør utvide begrepsforklaringer med egne primærkilder utover prisbegrunnelsene.
