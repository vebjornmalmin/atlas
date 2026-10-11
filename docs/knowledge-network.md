# Kunnskapsnettverket

## Register og læring

Kunnskapsnettverket har to forskjellige dekningsmål. Registeret gir søkbare personer, steder, institusjoner, verk og hendelser med kildebelagte forbindelser. Øvelsene velges separat for å bygge forståelse og hente fram relevante sammenhenger. En komplett kommuneliste eller prisvinnerliste skal ikke automatisk gi ett enkelt navnespørsmål per rad.

Geografi og Nobelpriser har brede registre. Kultur og historie utvides med kuraterte forbindelser. Videre utvikling trenger dypere begrepsforklaringer, norske kultur- og historieemner, flere dokumenterte kunstverk og mer varierte øvelser. Tall alene viser ikke at hele fagområdet er dekket.

## Felles identiteter

`knowledge-build/base-foundation.json` er den uforanderlige grunnpakken fra versjon 1.0.2. Importene gjenbruker kjente ID-er. `scripts/merge-knowledge.mjs` samler ferdige importer, kobler identiske navn og typer, og behandler land/område som kompatible typer. Forbindelser og øvelser får de felles ID-ene før validering. Et likt navn på en by, en kommune og et fylke betyr forskjellige administrative roller og beholder forskjellige noder.

Spørsmål med identisk formulering og forskjellige svar stopper sammenslåingen. Originale øvelses-ID-er beholdes slik at læringshistorikken følger med oppdateringen. Kilderegistre og importer holdes adskilt fra personlige data.

## Gjenbygging

Kjør de dokumenterte importscriptene først. Deretter:

```
node scripts/merge-knowledge.mjs knowledge-build/geography.json knowledge-build/nobel-science.json knowledge-build/culture-history.json
npm test
npm run build
```

Valideringen kontrollerer referanser, unike ID-er og spørsmål, kilder, kronologi og presidentperioder. Innholdskontrollen må også vurdere riktige svar, flere mulige svar, kildenes avgrensning og om ledeteksten røper svaret. Strukturkontroll alene bekrefter ikke alle fakta.

## Bruk på mobil

Nettverket søkes lokalt og kan utforskes uten nett når pakken er installert. Treff og forbindelser vises i porsjoner. Flervalgsalternativer deler faglig svartype; land, regioner, fylker, bidrag og prisvinnere blandes ikke i samme svargruppe. Lange tidslinjer deles i små øvelser.

## Læringsmodell 1 – utgivelse 0.11.0

Kunnskapspakken beholder `schemaVersion: 1` og utvider den med `knowledgeModelVersion: 1`. Eldre pakker kan fortsatt installeres, eksporteres og gjenopprettes. `claims` inneholder stabile, kildebelagte påstander; `exerciseFacts` kobler eksisterende øvelses-ID-er til påstandene de tester. Spørsmålsformuleringen inngår ikke i identiteten. Et kunstnernavn, verkets tittel og verkets årstall er ulike fakta. En sammenligningsøvelse har en egen identitet og refererer også til bestanddelene uten å tilskrive dem automatisk mestring.

Grafens relasjonstyper har kontrollerte endepunkter og retning. Påstander har dokumentert, omstridt eller usikker status. Datering kan være eksakt år, omtrentlig år eller et tidsrom. Presidentperioder får sluttdato der den er dokumentert. En kildehenvisning og en gyldig struktur erstatter ikke redaksjonell faktakontroll.

Repetisjonsnøkkelen omfatter faktum, gjenhentingsretning og ferdighet: gjenkjenning, fri gjenhenting, forklaring eller strukturert rekkefølge. Tidligere kort gjenbrukes konservativt etter dokumentert svarform; ukjent gammel svarform behandles bare som fri gjenhenting. Nye kort og speil under tidligere ID-er skrives atomisk, slik at eldre apputgaver fortsatt finner siste planlagte tilstand. Historiske svar og påbegynte økter omskrives ikke. Frie quizer og øktgjentakelser endrer fortsatt ikke langtidsplanen.

`learningObjectives` og `learningPaths` beskriver undervisningen separat fra faktagrafen. Forkunnskaper har en begrunnelse og kontrolleres for manglende referanser og sirkler. De åpner støtte og veiledning; de sperrer ikke utforskning. Fem gjennomgåtte læringsstier omfatter Solsikker og Monets hage, Vermeers karakterstudie, Kennedy/Apollo, Lincoln og Jefferson. De tre tilknyttede samlingene er kunst, USAs presidenter og historie. Andre samlinger får faktamodell og dekningsrapport, men er ikke dermed ferdig kuraterte læreplaner.

Betydning kommer før fine detaljer. Presisjon og tankearbeid beskrives separat fra vanskelighetsgrad. Eksakte Nobelprisår og komplette navnelister er detaljer; høy vanskelighetsgrad gjør dem ikke i seg selv til dyp forståelse. Forklaringsoppgaver har en synlig sjekkliste etter svaret og lagres som egenvurdering, ikke automatisk språkvurdering.

Læringskøen utsetter spørsmål som røpes av tidligere svar, alternative svarformer, introduksjoner eller fordypning om samme kunstverk. Slik bygges stier over flere økter. Planlagte repetisjoner prioriteres før nytt stoff. Etter svaret prioriteres kildebelagte forbindelser til tidligere øvd materiale, uten å hevde at stoffet er mestret. Forbindelser som røper senere køoppgaver skjules.

`node scripts/enrich-knowledge.mjs` bygger den additive modellen og kuraterte øvelser fra `knowledge-build/learning-curriculum.mjs`. `npm run build` kjører berikelse, vanskelighetsgjennomgang, dekningsrapport, validering og pakking i rekkefølge. Berikelsen er idempotent. Import og sammenslåing skal følges av denne byggingen før publisering.

`docs/learning-coverage.json` og Fremgang → Innholdsdekning skiller mellom register, kildebelagte øvelser, introduksjoner, sammenhengsøvelser og gjennomgåtte læringsmål. Manglende kuratering og ubearbeidede registerposter vises eksplisitt. Personlig øvingshistorikk er en separat visning og forblir på enheten.
