# Kultur og historie: første sammenhengende utvidelse

Pakken i `knowledge-build/culture-history.json` inneholder 132 noder, 144 forbindelser og 130 øvingsmål. Tallene omfatter gjenbrukte grunnnoder; de er ikke antall nye unike noder etter sammenslåing. 42 litterære verk er kontrollert mot utgavemetadata og tekstbelegg i verkene selv. Alle seks historiske grunnbegivenhetene har fått forbindelser til personer, dokumenter, organisasjoner, oppdrag eller steder.

## Kilder og kontroll

Litteraturdelen bruker de faktiske tekstutgavene hos Project Gutenberg. Hver kilde har en direkte tekstlenke, innhentingsdato, SHA-256, filstørrelse, forfatter- og tittelmetadata samt kontrollord i pakkens lokale `snapshot`. Katalogens automatiske sammendrag brukes ikke som belegg. Årstallene for digital publisering brukes aldri som førsteutgivelsesår. Engelske utgavetitler og forfatternavn godtas også når de norske visningsnavnene har en annen form.

Eksempler på kontrollerte forbindelser:

- Alice følger en kanin i [Alice's Adventures in Wonderland](https://www.gutenberg.org/cache/epub/11/pg11.txt), mens sjakk organiserer reisen i [Through the Looking-Glass](https://www.gutenberg.org/cache/epub/12/pg12.txt). Spørsmål som forbinder Alice med ett bestemt verk angir hvilken hendelse de gjelder.
- Skaperen heter Victor Frankenstein i [Frankenstein](https://www.gutenberg.org/cache/epub/84/pg84.txt). Vesenet får ikke dette personnavnet i teksten.
- Watson formidler Holmes' undersøkelser i [The Adventures of Sherlock Holmes](https://www.gutenberg.org/cache/epub/1661/pg1661.txt).
- Badeanstaltens forurensede vann er grunnlaget for konflikten i [En folkefiende](https://www.gutenberg.org/cache/epub/2446/pg2446.txt).

Historiedelen knytter eksisterende grunnnoder til etterprøvbare fakta:

| Grunnbegivenhet | Tilføyd forbindelse | Kilde |
| --- | --- | --- |
| Magna Carta besegles | Johan, dokumentet og Runnymede | [The National Archives](https://www.nationalarchives.gov.uk/explore-the-collection/explore-by-time-period/medieval/magna-carta/) |
| USAs uavhengighetserklæring vedtas | Jeffersons hovedutkast, dokumentet og Kontinentalkongressens vedtak | [National Archives](https://www.archives.gov/milestone-documents/declaration-of-independence) |
| D-dagen | Normandie, Frankrike, Overlord og Eisenhowers overordnede kommando | [National Army Museum](https://www.nam.ac.uk/explore/d-day) |
| FN opprettes | Organisasjonen, pakten og dens ikrafttredelse | [FNs historie](https://www.un.org/en/about-us/history-of-the-un), [FN-pakten](https://www.un.org/en/about-us/un-charter/) |
| Apollo 11 lander på månen | Oppdraget og besetningsrollene til Armstrong, Aldrin og Collins | [NASA](https://www.nasa.gov/mission/apollo-11/) |
| Fylkesendringene i 2024 | Norges administrative inndeling | Kartverkets reformkilde fra den eksisterende grunnpakken |

## Læringsvalg

Spørsmålene kombinerer forfatter–verk, figur–verk og konkrete forbindelser i handlingen. De handler blant annet om fortellerrolle, identitet, makt, miljø, institusjoner og forskjellen mellom et utkast og et vedtak. Forklaringene etter svaret setter faktaene inn i en sammenheng. Støtteteksten før svaret gir tematisk hjelp uten å nevne det forventede svaret.

Svar har eksplisitt type, slik at personer, litterære verk, steder og gjenstander får passende svaralternativer. «Brontë» alene godtas ikke som svar når Charlotte og Emily må skilles. Homers forfatterskap angis som tradisjonell tilskrivelse. Engelske oversettelsesformer av personnavn godtas når de forekommer i kildene, blant annet George Tesman for Jørgen Tesman.

Litterære figurer har typen `fictional-character`. Det hindrer at en romanfigur blir behandlet som en historisk person. Begivenheter, dokumenter og organisasjoner har separate noder. Historiedelen angir ingen historiske kartgrenser ut fra dagens kart.

## Reprodusering

Kjør `node scripts/ingest-culture.mjs` for å bygge på nytt fra de kontrollerte utvalgene og de lagrede kildefingeravtrykkene. Kjør med `--verify` for å hente de 42 tekstutgavene på nytt og oppdatere fingeravtrykkene. Skriptet leser den uforanderlige `knowledge-build/base-foundation.json`, ikke den allerede sammenslåtte publiseringsfilen.

Før filen skrives valideres pakken strengt sammen med grunnpakken. Kontrollene dekker ID-er, kildereferanser, relasjonsender, svar, samlinger og entydige spørsmål. En ekstra kontroll avviser støttetekster som inneholder svaret eller en godkjent svarvariant. Den erstatter ikke redaksjonell kontroll av semantiske hint; støttetekstene er også gjennomgått manuelt.

## Avgrensning

Dette er et kuratert utvalg, ikke en fullstendig verdenslitteratur eller historiedatabase. Utvalget har overvekt av eldre europeisk og amerikansk litteratur som finnes i åpne tekstutgaver. Samtidslitteratur, muntlige tradisjoner og flere verdensregioner trenger egne kildebaserte utvidelser. Dypere diskusjonsspørsmål trenger fri vurdering framfor kontroll mot én kort fasit.

Det er ikke lagt til nye bilder eller kunstverk i denne leveransen. De fem eksisterende museumsbelagte verkene og bildelisensene bevares. Flere kunstverk skal først tas inn når riktig versjon, museumskatalog og bildebruk er kontrollert. Ingen tekstutgaver eller illustrasjoner gjengis i den publiserte kunnskapspakken; kun fakta, egne sammendrag og kildelenker brukes.
