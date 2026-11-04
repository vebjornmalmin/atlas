# Nivåer, historien gjennom tid og ett samlet læringsløp

Gjelder fra app 1.2.0 og kunnskapspakke 2.2.0.

## Hvorfor dette ble bygd om

Appen hadde vokst til tre læringssystemer som ikke møttes: dagens økt med emner og repetisjon, fri quiz med registre, formater og nivåer, og Verden med tjue historiesyn og egne øvelser. Hvert system hadde egne innganger og egne innstillinger, fordelt på seks faner pluss en skjult «Utvalg»-side. Historiesynene var et sted man besøkte, ikke en del av hukommelsestreningen.

Nivåene var filtre, ikke trinn. «Avansert» tok med alt, og øktvalget sorterte lette spørsmål først. En avansert quiz ble derfor stort sett den samme som en grunnleggende. Samtidig ble alle sammenhengsoppgaver regnet som vanskeligst, selv om det å tegne en kjent forbindelse ofte er lettere enn å huske ett årstall.

## Beslutninger

### Tre steder

- **I dag**: dagens kapittel og fri øving. Hukommelsen er hovedsaken.
- **Atlas**: søk, og tre visninger av samme kunnskap: *Tid* (hele pensumet som én historie), *Kart* (verden gjennom historiesynene) og *Emner*.
- **Deg**: fremgang, innstillinger for økten og appinnstillinger.

Gamle lenker (`#learn`, `#world`, `#explore`, `#focus`, `#progress`, `#settings`) åpner delen som erstattet dem.

### Historien gjennom tid

Nye emner åpnes omtrent i tidsrekkefølge på tvers av fag, fra der eleven sist begynte (`storyCursor`). Mellom hvert daterte emne kommer et tidløst emne fra naturfag, geografi eller samfunn. Forutsetningene mellom emner gjelder fortsatt. Hver dag er et kapittel med epoke og tidsrom. Rekkefølgen kan slås av under Deg → Økten.

I dagens økt flettes inntil to **perspektiver** inn etter emnets egne kort:

1. **Samtidig i verden**: hva skjedde først, en hendelse fra dette emnet eller en fra et emne i et annet fag fra samme tidsrom? Laget av de daterte hendelsene i pensumets rekkefølgekort. Det brukes bare når eleven har begynt på begge emnene, slik at spørsmålet tester hukommelse og ikke gjetting.
2. **Historisk pil** fra samme periode, når det finnes.
3. **Et annet blikk**: en oppgave fra historiesynene, valgt etter fagområdet (for eksempel kildekritikk og historiesyn for historie, naboland og ruter for geografi, skalastigen for naturfag).

Perspektivene følger valgt nivå og nylig øvde perspektiver hviler i tre dager.

### Fire akser i stedet for én stige

Hvert spørsmål får en profil på fire akser, hver med tre trinn:

| Akse | 1 | 2 | 3 |
|---|---|---|---|
| Henting | Gjenkjenne (velge, koble) | Plassere (kart, pil, tidslinje) | Hente fram (skrive) |
| Presisjon | Omtrent | Bestemt navn | Eksakt årstall, tall eller hel liste |
| Kjennskap | Kjent | Mindre kjent | Smalt |
| Sammenheng | Ett holdepunkt | To ting | Et mønster (rekkefølge, rute, forklaring) |

Belastningen er en vektet sum (presisjon og kjennskap 1,4, henting 0,8, sammenheng 0,6) og gir nivå 1–4: **Orientering, Holdepunkter, Presisjon, Ekspert**. Vektene er redaksjonelle anslag, ikke empirisk kalibrert. Sammenheng veier minst, fordi en forbindelse eleven forstår, ofte er lettere enn ett isolert tall.

Nivåene er bånd. En quiz på nivå N bruker nivå N først og fyller med N−1, aldri med vanskeligere spørsmål. Dermed blir nivå 4 en annen quiz enn nivå 1, ikke den samme med noen ekstra spørsmål. Testen `a higher level is a different quiz` kontrollerer at de ikke deler et eneste spørsmål.

Rekkefølger vurderes etter minste avstand i tid mellom hendelsene: under 12 år er eksakt, 12–50 år er bestemt, over 50 år er omtrent. Det er avstandseffekten fra kognitiv psykologi: to ting langt fra hverandre er lettere å sammenligne.

### Samme faktum på flere nivåer

- **Når skjedde det?** Årstallsspørsmål kan besvares ved å plassere en nål på en logaritmisk tidslinje. Slingringsmonnet er 8 % av alderen (minst 3 år): ±7 år for 1939, ±77 år for 1066. På en logaritmisk akse blir dette omtrent like bredt overalt. Varianten har egen repetisjonsplan (`estimate`), slik at et omtrentlig svar ikke teller som at det eksakte årstallet sitter. Slingringsmonnet vises først etter svaret, fordi det ellers røper omtrent hvor gammel hendelsen er.
- **Historiske piler** finnes både som bare retning (nivå 1) og som retning med eksakt årstall (nivå 3).
- **Tidslinjer** finnes både som de historiske utsnittene med fem hendelser tett i tid og som spredte utvalg med tre hendelser langt fra hverandre.

### Interaksjon

- Kart (finn stedet, piler, naboreise, Atlas-kartet) bruker én felles kartkomponent: dra for å flytte med moment, knip eller rull for å zoome rundt fingrene, dobbelttrykk for å zoome inn, trykk for å velge. Et trykk velger og kan endres; svaret kontrolleres med en knapp. Etter svaret flyr kartet til riktig sted og viser eget valg sammen med det.
- Piler tegnes ved å dra fra ett land til et annet. Pilen har et ekte pilhode og følger fingeren. Å trykke på to land gir samme resultat, og en skjult knappeliste gjør det mulig med tastatur og skjermleser.
- Rekkefølger sorteres ved å holde på et element og dra det. Grepet til høyre starter dra med en gang; andre steder starter et kort trykk-og-hold, slik at siden fortsatt kan rulles. Piltastene flytter elementet med fokus.
- Koble sammen gjøres ved å dra en linje fra et element til partneren, eller ved å trykke på begge. Etter svaret vises riktige linjer grønt, feil rødt og de riktige parene stiplet.
- Interaktive oppgaver blir stående etter svaret og viser hva som var riktig.

### Rettet underveis

Presidentenes nummer («16. Abraham Lincoln») sto i etikettene i tidslinjer og «hva kom først»-oppgaver og røpet rekkefølgen. Nummeret fjernes nå i alle slike oppgaver.

## Kode

- `src/lib/levels.js`: akser, profil, nivå, bånd, logaritmisk tidslinje, variantene og `axisInsights`.
- `src/lib/story.js`: historiens rekkefølge, kapittel, «samtidig i verden» og innfletting av perspektiver.
- `src/lib/PanZoomMap.svelte`, `map-view.js`: kartbevegelser og geometri.
- `src/lib/SortableList.svelte`, `MatchLines.svelte`, `EstimateTimeline.svelte`, `StorySpine.svelte`.
