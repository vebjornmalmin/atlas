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
