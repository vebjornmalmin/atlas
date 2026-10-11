# Mobil læringsflyt

## Produktbeslutninger – 11. oktober 2026

Atlas prioriterer telefonen. En aktiv quiz har én spørsmålvisning og én svarvisning. Hovednavigasjonen kommer tilbake ved pause. Neste spørsmål flytter visningen til toppen og flytter skjermleserfokus til aktiviteten uten å aktivere tastaturet. Kontroll- og videreknapper ligger fast nederst; innholdet har plass under seg slik at kilder og forklaringer kan leses uten å dekkes av handlingene. Små skjermer får mindre typografi og kortere kartvisning. Tilbakemelding er tilgjengelig øverst i quizvisningen.

Svarvisningen viser resultatet, fasiten og forklaringen. Fordypning, forbindelser og kilder åpnes ved behov. Kunstbildet kan fortsatt undersøkes etter svaret. Kartfasiten kan åpnes fra svarvisningen. Vi låser ikke hele siden til en bestemt skjermhøyde: lange spørsmål, hjelpemidler, store tekstinnstillinger og tastatur må fortsatt kunne bruke scrolling.

Quizmenyen skiller den anbefalte økten fra valg av emne og format. Formater uten spørsmål i valgt emne er utilgjengelige og forklares før start. Avanserte oppgaver velger riktig nivå. Økter, resultater og frie quizer følger de eksisterende reglene for lokal lagring og repetisjon.

## Variasjon med etterprøvbare svar

- Koble sammen: tre land/hovedsteder eller verk/forfattere. Hvert svar brukes én gang. Bare spørsmål med ulike svar inngår i samme oppgave. Ni oppgaver bygges fra allerede kildebelagte fakta.
- Hva kom først: to daterte elementer fra eksisterende tidslinjer, med ulike år. Ingen årstall legges til svaralternativene. 43 oppgaver dekker presidentperioder, historiske hendelser og Nobelpristildelinger. Tildelingsår omtales eksplisitt og skilles fra oppdagelsesår.
- Historiske piler: tegn mellom land eller bruk likeverdige landvelgere, og oppgi år. Retning og år vurderes hver for seg i forklaringen; begge må være riktige for at hele oppgaven skal regnes som riktig. Fire konkrete hendelser inngår, med dagens grenser tydelig merket. Pilen viser en forbindelse, ikke frontlinjer eller den faktiske militære ruten.

Historiske piler omfatter [invasjonen av Polen i 1939](https://encyclopedia.ushmm.org/content/en/article/invasion-of-poland-fall-1939), [invasjonene av Norge og Danmark i 1940](https://www.deutschlandmuseum.de/en/history/calendar/1940-04-09-germany-invades-denmark-and-norway/) og [D-dagens overfart fra England til Normandie i 1944](https://www.gov.uk/government/news/d-day-anniversary-we-remember-69-years-later). Kildene finnes også etter svaret i appen. Utvalget er et første kuratert sett; historiske grenser, flere perioder og detaljerte ruter er ikke implementert.

Variasjon skal trene gjenhenting og forbindelser, ikke bare gi nye knapper. [Smith og Karpicke (2014)](https://learninglab.psych.purdue.edu/downloads/2014/2014_Smith_Karpicke_Memory.pdf) undersøkte korte tekstsvar, flervalg og blandede formater. Studien gir ikke grunnlag for å love at en bestemt ny spillmekanikk alltid gir bedre læring. Vi beholder forsøk før fasit, etterfølgende forklaring og eksisterende repetisjon. Grupperte koblingsoppgaver regnes som egne spørsmål; de innebærer ikke dokumentert mestring av hver enkelt underliggende faktavariant.

## Fremgang og videre øving

Øktsteg viser fullførte oppgaver og markerer det aktive spørsmålet. Grønt betyr sist riktig uten hjelp; øvrige fullførte steg er dempet. Tall skiller riktige uten hjelp, støtte og svar som må øves videre på. Resultatet telles først når svaret lagres ved videreknappen.

Fremgangssiden har separate visninger for oversikt, nivåer, emner og siste svar. Nivåstolpene skiller riktig uten hjelp, besvart med feil/støtte og usett innhold. Tallene beskriver siste besvarelse, ikke varig mestring. Ukesaktivitet viser antall lagrede svar. «Øv videre» bruker siste resultat per faktum, slik at et senere riktig svar erstatter en tidligere feil i samme faktavariant. Etter en økt tilbys en ny fri quiz med spørsmål som hadde feil svar eller støtte. Frie quizer flytter ikke planlagte repetisjoner.

Påbegynt kobling, pil, årstall og valget i før/etter-oppgaven journalføres sammen med eksisterende svarutkast. Utkast omgjøres til vanlige serialiserbare data før arkivering, slik at bytte av quiz bevarer den forrige økten.

## Kontroll av 0.9.0

121 automatiske tester består. Produksjonsbygg og innholdsvalidering består. Nettleserkontroll ved 390 × 844 verifiserte de tre nye formatene, lagring ved omlasting, fast videreknapp, automatisk flytting til toppen og fremgangssiden. Ved 320 × 568 ble anbefalt quiz, tegnede piler, landvelgere, fast kontrollknapp, retur fra tilbakemelding og omlasting uten nett kontrollert. Den publiserte utgaven ble kontrollert med samme lille telefonflate og frakoblet videreføring. Publisert utgivelse: e85bdae1a84d. Faktisk installasjon, skjermtastatur og flymodus på en fysisk telefon trenger fortsatt egen kontroll.

## Repetisjon – 0.10.0

Nye spørsmål åpner direkte, slik repetisjoner gjør. «Jeg vil lære dette først» gir fasit og forklaring, og biografisk introduksjon finnes under fordypning etter svaret. Gamle påbegynte læringssteg kan fortsatt gjenopptas.

Ukjente svar, feil, viste svar og svar med hint eller introduksjon legges tilbake etter de øvrige spørsmålene i samme quiz. «Igjen» legger også et ellers riktig svar tilbake. Et riktig svar uten hjelp avslutter forsøksrekken. Hvert spørsmål kan få inntil to ekstra forsøk per quiz; deretter beholdes det i videre øving. Dette hindrer at ett vanskelig spørsmål holder økten åpen uten ende. Øktsteg viser antall ekstra forsøk, og resultatoversikten bruker siste forsøk per spørsmål. Vellykket gjentakelse fjerner spørsmålet fra forslag om videre øving.

[FSRS har valg for korte læringssteg](https://open-spaced-repetition.github.io/ts-fsrs/interfaces/FSRSParameters.html). Vi slår av disse minuttstegene og håndterer korte gjentakelser i den aktive quizen. Første planlagte repetisjon settes til neste dag. Første «Lett» behandles høyst som «Bra» og kan ikke gi åtte dagers pause. Senere intervaller bruker lagret stabilitet, vanskelighetsgrad, tidligere repetisjoner og faktisk tid siden forrige planlagte svar. Dette bruker standard FSRS-parametere; personlige modellvekter trenes ikke.

Kanonisk faktum-ID deler repetisjonsplan mellom tekst og flervalg, og mellom kart og omriss. Historiske varianttilstander beholdes i databasen; nyeste relevante tilstand brukes, og videre planlagte svar skriver til felles ID. Eksisterende datoer flyttes ikke samlet ved oppdatering. Gjentakelser i samme økt lagres som ekstraøving og endrer ikke langtidsplanen. Frie emnequizer flytter fortsatt ikke planlagte repetisjoner.

128 automatiske tester dekker blant annet delte varianttilstander, voksende intervaller etter øving over flere dager, rekkefølge i den utvidede køen, maks antall forsøk og at vellykkede gjentakelser løser tidligere feil. Mobiltesten følger en ny anbefalt quiz gjennom ukjent svar, omlasting, øvrige spørsmål, gjentakelse til slutt og fullføring, og kontrollerer at gjentakelsen ikke øker planlagte repetisjoner.

Utgivelse 0.10.0 (`bf3c56e16732`) er også kontrollert på den publiserte adressen med samme mobiltest.


## 0.11.0 – Lær i sammenheng

Quizmenyen har fem korte læringsstier. Nytt stoff kan begynne med «Kort fortalt» på en separat skjerm. Svar etter denne støtten lagres som støttet læring og får et nytt forsøk. Forklaringsspørsmål bruker et flerlinjefelt og innholdskriterier etter svaret; originalsvaret vises ved siden av vurderingsgrunnlaget. Ordlyden trenger ikke være identisk med eksempelsvaret.

Gjenkjenning, fri gjenhenting og egenvurdert forklaring vises separat i fremgangen. Innholdsdekning beskriver bibliotekets svakheter uavhengig av egen historie. Tilbakemelding, pause, omlasting og appoppdatering skal bevare svaret og den nøyaktige aktiviteten. Kunstverk beholder sine gjennomgåtte bildeversjoner og lisensopplysninger etter svaret.
