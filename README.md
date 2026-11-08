# Atlas

Offline kunnskapstrening på norsk, laget for iPhone 17 Pro.

Live app: https://atlas-first-app.atlas-memory.workers.dev

## Gjeldende utgave — 1.8.0: En gjennomgått kunnskapskjerne og hint i to trinn

**Hele kunnskapskjernen er gått gjennom.** Hvert fagområde ble lest i fire runder: to for riktighet, én for om spørsmålene er verdt å vite og stilt slik en god lærer ville stilt dem, og en siste kontroll av omskrivingene. Kuriositeter, nakne årstall og rekordtall er byttet ut med spørsmål om hva ting er, hvorfor de skjedde og hva de førte til; ankre som 1814 og 1905 testes fortsatt skarpt. Kjernen har nå 1520 kort i 120 emner. 329 kort som spurte om noe som ikke var verdt å vite, er erstattet av nye kort med nye ID-er, og læringshistorikken på de gamle kortene følger ikke med. Regelen «Verdt å vite, ikke quiz» står i `docs/curriculum-authoring.md`.

**Fakta kontrollert mot Store norske leksikon.** Gjennomgangen ble gjort uten tilgang til snl.no, og 310 påstander ble satt på vent. Alle er nå kontrollert mot SNL, med offentlige etater og museer der SNL ikke dekker saken: 222 stemte, 45 er rettet og 40 omformulert fordi kildene gir et spenn eller er uenige. Blant rettelsene: Danmark deltok ikke i selve invasjonen av Irak i 2003, Stalin var enehersker i praksis fra slutten av 1930-årene, over 2100 norske sjøfolk omkom i første verdenskrig, Parthenon ble sterkt skadet, ikke sprengt, i 1687, og Svalbardtraktaten har nesten 50 land. Andelen treller i vikingtiden spørres nå som spennet i anslagene, fordi kildene er uenige. Tre påstander som ingen autoritativ kilde dekker, står igjen i `docs/fact-check-queue.md`.

**Hint i to trinn** (`src/lib/hints.js`). Alle kort har et skrevet hint, et holdepunkt fra sammenhengen som ikke gir bort svaret, og bygget stopper kort uten hint. «Hint» viser det skrevne hintet, og «Mer hjelp» viser et trinn laget av svarets form: antall tegn eller ord og forbokstav for navn, tiåret (eller århundret når kortet har toleranse) for årstall, størrelsesorden for tall og ett galt alternativ strøket ut for flervalg. Hvor langt eleven gikk, lagres som `hintLevel`, og hintene står der fortsatt når appen åpnes igjen.

**En påbegynt økt fortsetter etter oppdateringen.** En økt som var lagret før de nye kortene kom, stoppet ved første kort som ikke finnes lenger, med «Spørsmålet er ikke tilgjengelig». Kort som er fjernet, hoppes nå over når økten åpnes eller gjenopptas, og svarene som alt er gitt, beholdes (`dropRetired` i `src/lib/session-journal.js`).

Kunnskapspakken er 2.3.0. 270 automatiske tester består, og produksjonsbygget lages uten feil. Produksjonsbygget er servert med `wrangler dev` og prøvd i en nettleser som etterligner iPhone, lyst og mørkt: begge hinttrinnene i en flervalgsoppgave, det strøkne alternativet, og at hintene står der etter at siden er lastet på nytt. I den installerte hjemmeskjermappen i iPhone 17 Pro-simulatoren viste produksjonsbygget app 1.8.0 og innhold 2.3.0, begge hinttrinnene og det strøkne alternativet virket, og etter at appen var lukket helt og åpnet igjen, sto økten på samme spørsmål med begge hintene.

Publisert 8. november 2026: app 1.8.0, utgivelse `07bb9dfcf104`, kunnskapspakke 2.3.0, som statiske filer via Wrangler fra `main` (`e4aaba4`), som alt var sendt til GitHub. `/version.json` viser den nye utgivelsen, og `/` og `/sw.js` svarer med sikkerhetshodene. Den installerte hjemmeskjermappen for den publiserte adressen i iPhone 17 Pro-simulatoren, som sto på 1.7.1, viste «En ny utgave er klar», oppdaterte seg og ble stående på I dag. Etter lukking og gjenåpning viste Innstillinger app 1.8.0 og innhold 2.3.0, og begge hinttrinnene virket i dagens kapittel.

## 1.7.1: Linser og linjer sammen

**Linsen bestemmer hvilke linjer som teller.** Hver linse har allerede vekter på relasjonstypene, og de samme vektene brukes nå på linjene: Verdenssystem vektlegger nobelpriser, Nettverk og møter nobelpriser og påvirkning, Geopolitikk nyheter. Linjene linsen vektlegger, kommer først blant de 30 som tegnes, og de andre tones ned på kartet og i listen. Under listen står det hva linsen vektlegger, og kortet for en linje sier om linsen legger vekt på den eller sier lite om den. En linse som ikke vektlegger noen av linjetypene (for eksempel Sivilisasjoner), endrer ingenting, og listen sier det. Felles emner er Atlas' egen gruppering og vektes ikke av noen linse. Varmekartet har ingen linse, så der vises alle linjer likt. Logikken er `lensLinkWeights` og `placeLinks` i `src/lib/world-graph.js`.

**Linjene synes over alle farger.** Pilene og Verdenssystems varme farger var den samme oransje tonen, så pilene forsvant. Hver linje har nå en lys kant under seg, som også holder dem lesbare over det mørke varmekartet.

**Ikoner i stedet for ord på kartknappene** (`src/lib/map-icons.js`). «Linse» og «Kart» er byttet ut med ikoner. Linsen er et øye med en lupe som iris, og varmekartet er fargede ruter. Hver karttype har sitt eget omriss: et rutenett for Standard, en globus, Mercator med breddegrader som sprer seg mot polene, Equal Earths avrundede sider, appelsinskallet med kutt, Sør opp med pil, ringer rundt Oslo, et hjerte og Peirces kvadrat med rute. Ikonene står også i menyen over karttyper. Knappene har fortsatt fullt navn for skjermlesere.

**Knappene trekker seg sammen når du bruker kartet.** Så snart du drar, knipper, zoomer eller trykker på kartet, viser knappene bare ikonet, og landknappen bare flagg og ↓. Et trykk på flagget viser navnet i tre sekunder, eller til du rører kartet igjen. Trykker du mens navnet vises, går du til omtalen under kartet. Når du velger et nytt land, vises navnet i tre sekunder. Linse- og kartknappen viser navnet mens menyen deres er åpen. Når Kart åpnes på nytt, vises navnene igjen.

**Rettelser fra en full gjennomgang av appen før publisering.**

- **Quiz om én person eller ett sted starter på et nivå som har spørsmål.** Nivåmenyen på en side som Marie Curie tilbød alle nivåer, og «Quiz om Marie Curie» på nivå 2 sa bare at det ikke fantes spørsmål. Menyen viser nå bare nivåene som har spørsmål om det du står på, og velger ditt quiznivå når det finnes der, ellers det nærmeste (`levelsWithQuestions` og `usableLevel` i `src/lib/levels.js`).
- **Ingen zoom ved dobbelttrykk.** To raske trykk zoomet hele siden, både på tekst og på flagget som skifter mellom flagg og navn. Hele appen bruker nå `touch-action: manipulation`, så to trykk er to trykk. Knipe-zoom virker fortsatt.
- **Mellomrom i datolinjen på I dag.** «6. NOVEMBER· 2 DAGER PÅ RAD» manglet mellomrommet før prikken.
- **Skjermbildet i en tilbakemelding viser lukkede seksjoner som lukket.** Innholdet i «Fordypning og forbindelser» og «Kilder» ble tegnet oppå hverandre i bildet selv om seksjonene var lukket.

263 automatiske tester består, og produksjonsbygget lages uten feil. Hele appen er gått gjennom i den installerte hjemmeskjermappen i iPhone 17 Pro-simulatoren, lyst og mørkt, med lukking og gjenåpning underveis: oppdateringsbanneret (fremgang og side beholdes), søk, en personside og quiz om personen, tilbakemelding som lagres og fører tilbake til samme svar, en økt som fortsetter på samme spørsmål etter omstart, Tid med epoker, Emner, Deg (fremgang, siste svar, økten, innstillinger), og Kart: karttyper, linser, bryterne for piler, stiplede linjer og varmekart, kortet for en linje, valg av nytt land, knapper som trekker seg sammen, og flagget som viser navnet og skjules igjen ved zoom. Et nytt trykk på flagget mens navnet vises går til omtalen; to svært raske trykk viser bare navnet.

Publisert 6. november 2026: app 1.7.1, utgivelse `48ea166881d5`, kunnskapspakke 2.2.2 (uendret), som statiske filer via Wrangler fra `main` etter at `main` var sendt til GitHub. `/version.json` viser den nye utgivelsen, og `/` og `/sw.js` svarer med sikkerhetshodene. Den installerte hjemmeskjermappen for den publiserte adressen i iPhone 17 Pro-simulatoren fant den nye utgaven, oppdaterte seg og beholdt Italia på Globus. Etter lukking og gjenåpning trakk knappene seg sammen når kartet ble dratt, flagget viste navnet, et dobbelttrykk zoomet ikke, Innstillinger viste app 1.7.1, og siden for Marie Curie startet på nivå 3.

## 1.7.0: Forbindelser og varmekart på kartet

Publisert 6. november 2026: app 1.7.0, utgivelse `873e7755ff74`, kunnskapspakke 2.2.2 (uendret), som statiske filer via Wrangler fra `main` etter at `main` var sendt til GitHub. Safari i simulatoren fant den nye utgaven på den publiserte adressen, oppdaterte seg og viste Kart med forbindelseslinjene og lagknappen.

**Velger du et land eller en person i Atlas → Kart, tegnes forbindelsene til andre land.** Hele linjer med pilspiss er kildebelagte forbindelser med retning: nobelprisvinnere og institusjonen de var knyttet til da prisen ble tildelt, påvirkning mellom tenkere, og nyheter som omtaler et annet land. Stiplede linjer uten pilspiss er land som nevnes i samme emne i Atlas, for eksempel Brasil og Angola i «Oppdagelsesreisene» eller Egypt og Hellas i «Antikkens Hellas». Linjene er tykkere jo flere forbindelser det er, og vifter ut når flere går samme vei. Inntil 30 land tegnes, de sterkeste først.
- **Trykk på et land med linje**, på kartet eller i listen «Forbindelser på kartet»: linjen utheves, de andre tones ned, landet får navn, og et kort sier hva forbindelsen er, med kildesetningen eller emnet. Emnene i kortet åpnes i Emner. Trykk på landet igjen eller på «Gå til …» for å gå dit. På globusen snus kloden til landet først, og land på baksiden får ingen linje.
- Norge har nå forbindelser til 33 land (4 fra registrene alene), Brasil til 14 (2), Egypt til 37 (0), og 93 av 172 land har minst én. Grenser, regioner og hovedsteder er geografi og tegnes ikke som linjer.

**Varmekart: «Innhold i Atlas».** Kartet kan farges etter hvor mye av Atlas som er knyttet til hvert land: emner, spørsmål og personer, steder og verk. Skalaen er logaritmisk, så land med lite innhold synes. 164 land har noe. Under landet står «I Atlas» med antallet, knapper til emnene og «Øv på spørsmål om …», som starter en quiz med bare de spørsmålene.

**Slå av og på.** Lagknappen nederst til venstre på kartet åpner «Vis på kartet» med tre brytere: Piler (kildebelagte forbindelser), Stiplede linjer (felles emner) og Varmekart. Hver kan slås av for seg, og valgene huskes på enheten, også etter at appen lukkes. Listen «Forbindelser på kartet» under landet følger bryterne, og er begge linjetypene av, står det der med en knapp som slår dem på igjen. Varmekartet erstatter linsens farger mens det er på; slås det av, kommer linsen du hadde tilbake. Linsemenyen har bare linser.
- Bryterne er skjult når de ikke brukes. Panelet lukkes litt etter siste endring, så kartet viser hva som ble endret, og ellers ved et trykk utenfor, når siden rulles, eller med Esc. Det samme gjelder linse- og kartmenyen. Et trykk på kartet som lukker en meny, velger ikke et land.

**Hvordan et emne eller spørsmål knyttes til et land** (`src/lib/content-places.js`): teksten i emnet (tittel, sammendrag, leksjon og hovedpunkter) og i spørsmålet (spørsmål, svar og forklaring) leses etter navn på dagens land og hovedsteder, også i genitiv («Norges»). Et emne får også landene spørsmålene i det nevner. Et registerspørsmål knyttes i tillegg til landet personen eller stedet det spør om hører til. England, Skottland, Wales og Nord-Irland regnes som Storbritannia, og Holland som Nederland.

Beslutninger som skal holde:
- Ingenting gjettes. Navn som like gjerne betyr noe annet, er utelatt: Georgia (også en delstat), Jordan og Niger (også elver), Sofia (Hagia Sofia) og hovedsteder som deler navn med andre steder (Santiago, San José, Kingston med flere).
- Historiske navn oversettes ikke til dagens land. Mesopotamia blir ikke Irak, og Romerriket blir ikke Italia, med mindre teksten selv nevner landet. Kartet viser dagens land, og forklaringen under kartet sier det.
- En linje mellom to land som nevnes i samme emne sier bare at Atlas behandler dem sammen, ikke hva forbindelsen var. Kortet og listen sier derfor «Emnet … nevner både …».

**Lett for telefonen.** Registeret over innhold per land bygges én gang når Kart åpnes (rundt 13 ms på en Mac), og bare det valgte stedet regnes ut deretter (under 2 ms for Norge, som har flest emner).

Logikken er `contentPlaces` og `placesIn` i `src/lib/content-places.js` og `placeLinks` i `src/lib/world-graph.js`, med tester for navnematching (genitiv, lengste navn først, Sør-Sudan og Guinea-Bissau, utelatte navn), at hvert land samler emner, spørsmål og elementer uten dobbelttelling, de stiplede forbindelsene, at hver linjetype kan slås av for seg, og at registeret bygges én gang. 261 automatiske tester består, og produksjonsbygget lages uten feil. Kontrollert i den installerte hjemmeskjermappen i iPhone 17 Pro-simulatoren, lyst og mørkt: Brasil og USA på flatt kart og globus, kortet med «Gå til USA», listevalget som snur globusen, varmekartet over hele verden, «I Atlas» for USA, «Øv på spørsmål om USA» som startet en quiz med ti spørsmål, og at varmekartet var valgt etter at appen ble lukket og åpnet igjen. Bryterne er kontrollert på samme måte: hver av dem av og på, at valgene huskes etter at appen lukkes, meldingen når begge linjetypene er av, at linsen kommer tilbake når varmekartet slås av, at panelet lukker seg selv etter en endring, og at et trykk på kartet som lukker panelet ikke velger et land.

Funnet underveis og rettet: når kartet ble rullet fram, havnet knappene øverst på kartet under statuslinjen. Kartet holder nå avstand til den.

## 1.6.1: Rettelser etter en runde gjennom hele appen

Før 1.6.0 ble publisert, ble alle sidene gått gjennom i appen installert på hjemmeskjermen i iPhone 17 Pro-simulatoren: I dag med dagens kapittel, riktige og gale svar, lukking og gjenåpning midt i et spørsmål, Atlas → Tid, Kart (Standard og Globus) og Emner, Deg → Fremgang, Økten og Innstillinger, og Lag en quiz. Dette ble rettet:

- **Kartet rammer inn landet og naboene, ikke halve verden.** Utsnittet var landet pluss naboenes hele omriss. Frankrike grenser til Brasil gjennom Fransk Guyana, så et trykk på Brasil zoomet ut til et utsnitt fra Sør-Amerika til Paris, med Brasil nede i hjørnet og Argentina utenfor. Nå teller bare den delen av en nabo som ligger nærmest landet, og en stor nabo tas bare med så langt den ligger nær landet: Russland ved siden av Aserbajdsjan er Kaukasus, ikke Sibir. Brasil fyller nå kartet med alle naboene og navnene deres. Logikken ligger i `regionFrame` i `src/lib/map-view.js`, med tester for Brasil, Aserbajdsjan og Norge.
- **En ny fane åpner øverst.** Byttet du fra en side du hadde rullet ned på, åpnet neste fane like langt nede, så overskriften var borte. Nå åpner I dag, Atlas og Deg alltid øverst. Trykker du på fanen du allerede er i, går du til toppen og tilbake til fanens start, for eksempel fra Lag en quiz til I dag, slik andre iPhone-apper gjør.
- **Tall brytes ikke midt i.** «12 000» ble delt over to linjer som «12» og «000», og «4000 f.Kr.» som «4000» og «f.Kr.». Det siste byggesteget for kunnskapspakken (`scripts/package-knowledge.mjs`) setter nå hardt mellomrom i sifergrupper og mellom årstall og f.Kr./e.Kr. i all tekst (`src/lib/typography.js`). Retting av svar påvirkes ikke, fordi svarene normaliseres før de sammenlignes, og en test sjekker begge deler. Kunnskapspakke 2.2.2 har bare denne endringen.
- **Pilene i listene i Atlas og Deg.** To stilark tegnet hver sin pil. Den ene ble vridd til en vinkel ved siden av «›», og i lange rader lå den oppå teksten (Peter Medawar under Brasil). Nå er det én pil, og den tar plass i raden. Quiztemaer under Deg → Fremgang hadde i tillegg en egen «→».
- **«1 riktig», ikke «1 riktige».** Gjelder linjen over spørsmålene i økten, Quiztemaer og innholdsdekningen. Linjen over spørsmålene brytes nå slik at skilletegnet står på slutten av linjen og ikke først på neste.

Beslutning som skal holde: tall, årstall og tidsregning skrives med hardt mellomrom i innholdet, og det gjøres i byggingen, ikke for hånd i hver tekst.

Funnet, men ikke rettet: verdenskartet er laget uten Antarktis (se `docs/map-sources.md`). Det merkes ikke på det flate kartet, men på Globus, Fra Oslo og Kvadrat mangler et helt kontinent rundt Sydpolen. Det krever nye kartdata fra Natural Earth.

250 automatiske tester består, og produksjonsbygget lages uten feil. Hver rettelse ble kontrollert i den installerte hjemmeskjermappen i simulatoren etter oppdatering fra 1.6.0: Brasil og naboene på kartet, fanebytte fra en nedrullet side, trykk på I dag fra Lag en quiz, «11 000» på én linje etter at innholdet ble oppdatert til 2.2.2, pilene under Brasil og i Quiztemaer, og at økten fortsatte på samme spørsmål etter at appen ble lukket og åpnet igjen.

Publisert 5. november 2026: app 1.6.1, utgivelse `4916cc20872a`, kunnskapspakke 2.2.2, som statiske filer via Wrangler fra `main` etter at `main` var sendt til GitHub. 1.6.0 ble aldri publisert for seg; endringene i den følger med her. En installert 1.5.0 i Safari i simulatoren fant den nye utgaven, oppdaterte til 1.6.1 og hentet innhold 2.2.2.

## 1.6.0: Verden som globus, hjerte og kvadrat

Denne utgaven bygger på tilbakemeldinger fra de første brukerne.

**Kartet kan tegnes på ni måter.** Under Atlas → Kart har kartet fått en knapp, «Kart», ved siden av landet du ser på. Der velger du projeksjon: Standard, **Globus**, Mercator, Riktige arealer (Equal Earth), Appelsinskall (Goode), Sør opp, Fra Oslo, Hjerte (Werner) og Kvadrat (Peirce). Under kartet står det én setning om hva projeksjonen beholder og hva den ofrer, for eksempel at Grønland ser like stort ut som Afrika i Mercator, selv om Afrika er omtrent fjorten ganger større.
- **Globusen snus med fingeren** og zoomes med knip. Trykker du på et land, snur kloden seg dit og zoomer inn på landet og naboene. Baksiden av kloden er skjult, og kloden er skyggelagt som en kule.
- Linser, farger, landnavn og valg av land virker på samme måte i alle projeksjonene. Valget og utsnittet huskes for hver projeksjon når appen lukkes og åpnes igjen.
- Tegningen gjøres på telefonen: kartfilen er lagret som ekvirektangulære lengde- og breddegrader, så punktene leses tilbake og projiseres med d3-geo og d3-geo-projection (ISC-lisens, låst til versjoner fra 2021–2024). Ingen nye kartdata lastes ned.

Beslutning som skal holde: projeksjonene finnes bare i Atlas → Kart. Oppgavene bruker fortsatt det flate kartet, fordi piler, grenseruter og lagrede utsnitt i oppgavene regner med det.

**Flervalg uten tull.** De tolv håndskrevne introduksjonsspørsmålene (Kennedy, Lincoln, D-dagen og de andre) hadde to gale svar hver, og de fleste var umulige: Jupiter, en Mars-base og andre verdenskrig for Lincoln. Tre spørsmål røpet dessuten svaret («landgangen i Normandie» → Frankrike). Nå har alle tre gale svar fra samme felt, gjerne vanlige misforståelser: frigjøringserklæringen *avskaffet ikke* slaveriet i hele USA, tyskerne ventet landgangen ved Calais, og Apollo 8 fløy rundt månen før Apollo 11 landet. Forklaringen etter svaret sier hvorfor de nærmeste alternativene er feil.
- Reglene for flervalg var bare kontrollert for pensumet, ikke for de håndskrevne spørsmålene. Nå bruker begge samme kontroll (`choiceProblems` i `src/lib/core-curriculum.js`), og en test stopper et introduksjonsspørsmål som bryter den.
- Kontrollen ser nå også etter ordstammer som bare spørsmålet og det riktige svaret har felles («uavhengighetserklæringen» → «uavhengige»). Den fant samme feil i pensumet: spørsmålet om uavhengighetserklæringen hadde «George Washington var konge» som alternativ, og spørsmålet om kinesiske embetsmenn sto med svaret i spørsmålet. Begge er rettet. De 17 andre advarslene må vurderes én for én; mange er ord som er felles uten å røpe noe.

**«Godkjenn svaret mitt».** Knappen het «Svaret mitt var riktig» og ble lest som om appen skrøt av sitt eget svar. Den er nå skrevet som en handling, med en linje under om hva den er til. En egengodkjenning merkes «Godkjent av deg», kan angres før neste spørsmål, lagres som egenvurdering sammen med det du skrev, og gir aldri «Satt lett». Deg → Fremgang viser hvor mange svar du har godkjent selv, og en tilbakemelding tar med de siste 20, slik at formuleringer appen burde godta kan legges inn.

**Linsene påstår ikke mer enn de vet.** Kartet skrev «Gjennom lineær frelseshistorie» over forbindelsene til Fijis utsatte grunnlovsavstemning, selv om den linsen ikke sier noe om Fiji. Nå får forbindelsene linsens navn bare når linsen faktisk ser stedet, og ellers står det at linsen sier lite om det.

Relativitet og kvanter fantes allerede: Atlas → Emner → Naturvitenskap → «Relativitet og kvanter».

Kunnskapspakke 2.2.1 inneholder de rettede pensumspørsmålene. 244 automatiske tester består, og produksjonsbygget lages uten feil. iOS-simulatoren finnes ikke i miljøet der dette ble laget. Derfor ble endringene kontrollert mot produksjonsbygget i Chromium med iPhone-størrelse og berøring, i lyst og mørkt: projeksjonsmenyen, dra for å snu globusen, trykk på Australia som snur og zoomer kloden dit, Hjerte og Mercator med forklaringen under kartet, at valget huskes etter omlasting, Fiji med frelseshistorielinsen, og egengodkjenning med angring og lagret vurdering. Kontrollen i iPhone 17 Pro-simulatoren og som hjemmeskjermapp gjenstår, og utgaven er ikke publisert.

## 1.5.0: Appen husker hvor du var, og kartet går til det du velger

**Åpne der du slapp.** Når appen lukkes og åpnes igjen, kommer du tilbake til samme sted: fanen (I dag, Atlas, Deg) og underfanen, siden du hadde åpen, søket, valgt emne i Emner, tidslinjens epoke, fag og valgte emne, valgene i fri øving og hvor langt ned du hadde rullet. Kartet beholder linse, land og utsnitt. Den påbegynte økten med skrevne svar ble allerede lagret og er uendret.

Beslutning som skal holde: etter mer enn 12 timer åpner appen på I dag igjen, med tom søkelinje og uten åpen side, men beholder fanevalg, tidslinjevisning og øvingsvalg. Tilstanden lagres i `localStorage` på enheten (`src/lib/ui-state.js`) og sjekkes felt for felt, så en skadet eller eldre lagring aldri hindrer appen i å starte. En lenke med egen `#rute` vinner over det lagrede.

**Kartet**
- Trykk på et land, og kartet glir inn til landet sammen med nabolandene. Små land får alltid nok omgivelser rundt seg, og store naboskap (Russland, Kina) viser bare landet (`neighbourhoodFrame` i `src/lib/map-view.js`).
- Navnet på valgt land står på kartet, og nabolandene får navn når de er store nok på skjermen.
- De 20 linsene lå som en rad med knapper oppå kartet. Nå er det én knapp, «Linse», som åpner en liste over kartet.
- Kartet åpnet seg stadig lenger ut hver gang appen ble startet på nytt, fordi det lagrede utsnittet ble tilpasset før kartet visste sin egen størrelse. Det er rettet.

**Hvert skjermbilde har én jobb.** Jeg gikk gjennom alle skjermbildene og hvordan man kommer dit. I dag er det du skal gjøre i dag, Atlas er å utforske på egen hånd, og Deg er fremgang og innstillinger. Fire steder passet ikke:
- Emner → Tidslinje er fjernet. Visningen var eldre enn Atlas → Tid og viste de samme emnene i tidsrekkefølge, med færre muligheter. Emner viser nå bare fagområdene.
- Deg → Fremgang → «Emner» het det samme som Atlas → Emner, men viste quiztemaene du har øvd på. Den heter nå «Quiztemaer».
- Innholdsdekning handler om hva biblioteket inneholder, ikke om din fremgang. Den ligger nå under Innstillinger → Diagnostikk.
- Vektingen av påvirkning, aktualitet og nærhet kunne endres to steder. Den endres nå bare under Kart, der du ser hva den gjør, og Deg → Økten viser verdiene med en knapp dit. Teksten ved glidebryterne sier nå riktig at vektingen styrer fri quiz fra registrene, ikke dagens kapittel.

Beslutning som skal holde: én ting skal ha ett sted. Når noe kan nås fra flere skjermbilder, er det snarveier til samme side, ikke kopier.

**Testing som hjemmeskjermapp.** Atlas brukes som installert app. Testene i simulatoren gjøres nå med produksjonsbygget servert lokalt (`npx wrangler dev`), lagt til på hjemskjermen fra Safari, åpnet derfra, og lukket og åpnet igjen. Dette står i `AGENTS.md`.

Kontrollert slik i iPhone 17 Pro-simulatoren: appen ble avsluttet helt og åpnet fra hjemskjermen igjen, og kom tilbake til Atlas → Tid med middelalderen, verdenshistorie og samme rulling, og til Kart med Egypt, linsen «Store personer» og samme utsnitt. Oppryddingen ble kontrollert på samme måte: en app som sist sto på Innholdsdekning åpnet på Oversikt etter oppdateringen, Fremgang viser «Quiztemaer», «Endre vektingen i Kart» åpner Kart med glidebryterne, Emner har ingen tidslinjeknapp, Innholdsdekning ligger under Diagnostikk, og appen kom tilbake til Innstillinger etter at den ble lukket helt. 236 automatiske tester består.

Publisert 5. november 2026: app 1.5.0, utgivelse `72202032d8cc`, kunnskapspakke 2.2.0 (uendret), som statiske filer via Wrangler fra `main` etter at `main` var sendt til GitHub. En installert 1.4.0 i Safari i simulatoren fant den nye utgaven på den publiserte adressen, oppdaterte seg og viste Fremgang med «Quiztemaer» og uten Innholdsdekning.

## 1.4.0: En tidslinje du kan utforske

Tidslinjen under Atlas → Tid er tegnet om fra en rad prikker til et kart over tid.

- **Logaritmisk med plass til de siste århundrene**: skalaen var allerede logaritmisk, men regnet fra i dag, så 2000–2026 tok over en tredjedel av bredden mens 74 emner trengtes sammen til venstre. Nå regnes avstanden fra i dag pluss 50 år: år 0 ligger ved en femdel, 1500 ved halvparten, 1900 ved tre firedeler og 2000 ved ni tideler. Dagens kapittel på I dag bruker samme skala.
- **Hvert emne er en strek over hele perioden**, stablet i rader så ingen overlapper, og farget etter hvor godt det sitter.
- **Dra langs tidslinjen** for å se et årstall og hvilke emner som pågikk da. Med mus vises det samme ved hover, og piltastene flytter året.
- **Trykk på en strek** for å velge emnet: det fremheves sammen med emner i andre fag fra samme tid, og kan åpnes derfra.
- **Zoom inn på en epoke**: da blir skalaen lineær med runde årstall, og listen under viser bare den epoken.
- **Fremhev et fag**: de andre emnene tones ned, og listen viser bare faget.

Beslutning som skal holde: tidslinjens skala (`storyPosition` i `src/lib/story.js`) er egen for Tid og I dag. Tallinjen i anslå-året-oppgavene bruker fortsatt `yearToPosition`, slik at retting og svar er uendret.

Kontrollert i iPhone 17 Pro-simulatoren, i lyst og mørkt: dra langs tidslinjen, velge et emne, zoome til middelalderen og fremheve verdenshistorie, og den nye skalaen i dagens kapittel. 228 automatiske tester består.

Publisert 5. november 2026: app 1.4.0, utgivelse `a03f28acaa16`, kunnskapspakke 2.2.0 (uendret), som statiske filer via Wrangler fra `main` etter at `main` var sendt til GitHub. En installert 1.3.1 i Safari i simulatoren fant den nye utgaven på den publiserte adressen, oppdaterte seg og viste den nye tidslinjen.

## 1.3.1: Filene serveres direkte

Appen ser ut og virker som 1.3.0. Endringen gjelder hvordan Cloudflare leverer filene: i stedet for at Workeren pakker ut hver fil ved hver forespørsel, serveres `build/` som statiske filer. Kunnskapspakken krevde omkring 60 ms prosessortid per nedlasting med den gamle løsningen, mens gratisplanen tillater 10 ms. Nå brukes ingen prosessortid, så første installasjon og oppdateringer er mindre utsatt for feil. Sikkerhetshodene ligger i `build/_headers`, og `/version.json` erstatter `/health`.

Publisert 5. november 2026: app 1.3.1, utgivelse `2549ed8cd190`, kunnskapspakke 2.2.0 (uendret), som statiske filer via Wrangler fra `main` etter at `main` var sendt til GitHub. `/`, `/sw.js` og kunnskapspakken svarer med sikkerhetshodene, ETag og Brotli-komprimering, og `/_app/immutable/*` caches i ett år. `/_headers` og `/health` svarer 404. I iPhone 17 Pro-simulatoren oppdaterte en installert eldre utgave seg mot det lokale bygget, og den publiserte adressen viste I dag med dagens kapittel.

## 1.3.0: Et atlas, ikke en mal

Hele grensesnittet er tegnet om, slik at appen ser ut som et redigert oppslagsverk og bruker skjermen bedre. Funksjoner, spørsmål, retting og data er uendret.

- **Mer innhold høyere opp**: toppfeltet er omkring 48 pt i stedet for 120, og «Gi tilbakemelding» er en ikonknapp som fortsatt finnes på alle skjermer, også under en økt. Fanelinjen fordeler de tre fanene over hele bredden.
- **Typografi og linjer i stedet for kort**: serif til titler, spørsmål, årstall og tall; tynne linjer, innrykk og luft deler opp innholdet. Et fylt kort brukes bare til det ene som skal ha oppmerksomheten på en skjerm (dagens kapittel, spørsmålet). Lister er linjerte rader.
- **I dag**: dagens kapittel og startknappen ligger over bretten. «Slik fungerer Atlas» er én sammenleggbar linje.
- **Økten**: tynn fremdriftslinje med teller, spørsmålet øverst, handlingen i en fast bunnlinje. Tilbakemeldingen viser svaret stort, så forklaringen, og samler sammenheng og kilder i sammenleggbare rader. Flervalg, tidslinjer, koblinger, kart, melodier og avstander følger samme formspråk.
- **Atlas**: Tid er en tidslinje med epoker langs en rygg, Kart fyller bredden med historiesynene lagt på kartet, og Emner er en linjert innholdsfortegnelse.
- **Deg**: én rad med faner og én rad med underfaner som aldri deler ord. Fremgangen vises som tall og tynne søyler, innstillingene i grupper.
- **Ingen emoji**: landenes flagg var emoji. Nå er de ekte flaggbilder (flag-icons, MIT-lisens, `public/vendor/FLAG-ICONS-LICENSE.txt`) samlet i `public/flags.json` og lastet ved første bruk. En test stopper emoji i spørsmålstekster.

Designbeslutninger som skal holde: farger, skrift, avstander og hjørner er tokens i `src/lib/design.css`, og skjermene bruker bare tokens. Felles komponenter ligger i `design.css`; I dag og øktene i `src/lib/styles/today.css`; Atlas og Deg i `src/lib/styles/atlas-me.css`. Bare ett fremhevet kort (`.card.feature`) per skjerm.

Kontrollert i iPhone 17 Pro-simulatoren mot produksjonsbygget kjørt lokalt, i lyst og mørkt: I dag, en innføring, et flervalgsspørsmål med tilbakemelding, Atlas (Tid og Kart med flaggbilde) og Deg. 224 automatiske tester består, og Svelte-kontrollen finner ingen feil. Ikke alle oppgavetyper er gått gjennom i simulatoren.

Publisert 4. november 2026: app 1.3.0, utgivelse `5f1d31e5665b`, kunnskapspakke 2.2.0 (uendret), via Wrangler fra `main`, 2,8 MiB komprimert. Helse- og versjonsendepunktene og tjenestearbeideren samsvarer med bygget. En installert 1.2.0 i Safari i iPhone 17 Pro-simulatoren fant den nye utgaven, oppdaterte seg og viste den nye utformingen.

## 1.2.0: Én historie gjennom tid

Appen er samlet til tre steder: **I dag**, **Atlas** og **Deg**. Før var dagens økt, fri quiz og Verden tre separate læringssystemer med egne innganger og innstillinger, fordelt på seks faner. Nå er hukommelsen hovedsaken, og perspektivene er vevd inn i den.

- **Dagens kapittel**: nye emner åpnes omtrent i tidsrekkefølge på tvers av fag, med et tidløst emne innimellom. Hver økt får epoke og tidsrom, og inntil to perspektiver: «Samtidig i verden» (hva skjedde først, i to fag fra samme tid), en historisk pil fra perioden, eller en oppgave gjennom et historiesyn. Repetisjon med FSRS ligger fortsatt i bunnen.
- **Atlas**: søk og tre visninger av samme kunnskap: *Tid* (hele pensumet som én tidslinje), *Kart* (verden gjennom historiesynene) og *Emner*.
- **Deg**: fremgang, økten og innstillinger på ett sted.
- **Nivåer på fire akser**: henting, presisjon, kjennskap og sammenheng. Nivå 1–4 (Orientering, Holdepunkter, Presisjon, Ekspert) er bånd, så en høyere quiz er virkelig en annen quiz. Å tegne en kjent forbindelse regnes som lettere enn å huske ett årstall. Under Deg → Fremgang → Nivåer og akser vises hvilken akse du faller på.
- **Samme faktum på flere nivåer**: plasser et årstall omtrent på en logaritmisk tidslinje før du skriver det eksakt, tegn bare retningen på en pil før du også skal kunne året, og ordne tre hendelser langt fra hverandre før fem tett i tid.
- **Naturlig interaksjon**: kartene dras, knipes og dobbelttrykkes som et kartprogram på telefonen; piler tegnes ved å dra fra land til land; rekkefølger sorteres ved å holde og dra; koblinger tegnes som linjer. Oppgavene blir stående etter svaret og viser hva som var riktig.
- **Rettet**: presidentenes nummer røpet rekkefølgen i tidslinjer og «hva kom først»-oppgaver.

**Ny kunnskap og nye øvelser i samme utgave**

- **Seks nye fagområder**, alle daterte og derfor nye kapitler i historien: Musikkhistorie, Filosofi og idéhistorie, Teknologi og oppfinnelser, Medisinens historie, Astronomi og romfart, og Verden utenfor Europa (Kina, den islamske gullalderen, Vest-Afrikas riker, Amerika før europeerne, osmanerne og mogulene, Japan). Pensumet har nå 15 fagområder, 120 emner og 1490 kort, med kilder fra Store norske leksikon. Alle valideres uten feil eller advarsler.
- **Nærmest i tid**: «Hva ligger nærmest Kleopatras død i tid: månelandingen eller Kheopspyramiden?» 120 spørsmål fra 34 daterte holdepunkter over 17 000 år. Etter svaret vises avstandene på en lineær tidslinje, fordi poenget er de ekte proporsjonene.
- **Kjenn igjen temaet**: sju kjente åpningsmotiver (Beethoven, Grieg, Vivaldi, Tsjajkovskij) spilt av en innebygd synthesizer med flere deltoner, anslag og romklang. Fungerer uten nett.
- **Ekte innspillinger**: 30 klassiske verk der et 20 sekunders utdrag hentes direkte fra Wikimedia Commons. Bare filer med fri lisens brukes, og utøver og lisens vises etter svaret. Krever nett og flettes derfor ikke inn i dagens kapittel.
- **Historiske piler**: 22 hendelser fra Hannibal til Pearl Harbor, i stedet for 4.

Innholdet ble skrevet parallelt og deretter gjennomgått. Faktafeil som ble rettet under gjennomgangen: Lascaux-maleriene er omkring 17 000 år gamle, ikke fra 11 500 f.Kr. År 426 er da Copáns kongedynasti ble grunnlagt, ikke da Tikal erobret byen. Qin-keiseren knyttet sammen eldre murer, men begynte ikke på muren. ENIAC veide omkring 27 tonn. Sartres foredrag om eksistensialismen ble holdt i 1945. Dessuten er tvilsomme kilder og melodier fjernet. Faktasjekken kunne bare gjøres mot søkeresultater, ikke mot hele artikler, så noe innhold er utelatt fordi det ikke kunne bekreftes. Hentingen fra Wikimedia Commons er ikke prøvd mot den virkelige tjenesten fra dette miljøet.

Kunnskapspakke 2.2.0 har nivåprofil på alle spørsmål. Appen lager i tillegg 118 «samtidig»-oppgaver, 200 tidslinjeplasseringer og 12 spredte tidslinjer fra det kildebelagte innholdet. Beslutninger og avgrensninger: [docs/levels-and-story.md](docs/levels-and-story.md).

Kontrollert mot produksjonsbygget kjørt lokalt i en iPhone-visning med berøring: piltegning med én finger, knip, dra og trykk på kartet, trykk-og-hold-sortering, linjekobling, tidslinjeplassering, melodier, «Nærmest i tid», dagens kapittel, Atlas og Deg. 224 automatiske tester består. iOS-simulatoren var ikke tilgjengelig i dette miljøet, så kontrollen i Safari på iPhone 17 Pro gjenstår.

Publisert 4. november 2026: app 1.2.0, utgivelse `46f1bbd71e4c`, kunnskapspakke 2.2.0, via Wrangler fra `main`. Helse- og versjonsendepunktene og tjenestearbeideren samsvarer med bygget. En installert 1.1.3 i Safari i iPhone 17 Pro-simulatoren fant den nye utgaven på den publiserte adressen, oppdaterte seg og viste den nye inndelingen i I dag, Atlas og Deg. 224 automatiske tester består.

## 1.1.3: «Uten nett» bare når nettet faktisk mangler

Toppfeltet viste «Uten nett» selv om nettet virket. Merket fulgte nettleserens `navigator.onLine`, som Safari kan melde som usann på en tilkoblet enhet; oppdateringene hadde allerede sluttet å stole på det i 1.0.0, men merket hadde ikke. Nå følger merket bare appversjonssjekken: en forespørsel som ikke når serveren, eller tjenestearbeiderens svar når nettet mangler (merket med `X-Atlas-Offline`), betyr frakoblet. Alt annet skjuler merket. Sjekken kjører ved oppstart, hvert femte minutt, når appen kommer tilbake i forgrunnen og når nettleseren melder at forbindelsen endrer seg.

Kontrollert i iPhone 17 Pro-simulatoren mot produksjonsbygget kjørt lokalt: en installert 1.1.2 oppdaterte seg til 1.1.3 uten merket, merket kom da serveren ble stoppet og «Se etter» trykket, og forsvant igjen da serveren var tilbake. 179 automatiske tester består.

Publisert 4. november 2026: app 1.1.3, utgivelse `5aca29003f4d`, kunnskapspakke 2.1.0 (uendret), via Wrangler fra `main`. Helse- og versjonsendepunktene og tjenestearbeideren samsvarer med bygget. En installert 1.1.2 i iPhone 17 Pro-simulatoren oppdaterte seg til 1.1.3 på den publiserte adressen og viste ikke «Uten nett».

## 1.1.2: Innstillinger på én side

Innstillinger er én flat liste uten undersider: utseende, daglig påminnelse, oppdateringer, sikkerhetskopi, gjenoppretting og installasjon. Én knapp ser etter både app- og innholdsoppdateringer. Den egne utviklersiden er borte; diagnostikken ligger i en lukket «Diagnostikk»-seksjon nederst på samme side.

Kontrollert i iPhone 17 Pro-simulatoren mot produksjonsbygget kjørt lokalt: Innstillinger viser én liste med app 1.1.2 og innhold 2.1.0, Diagnostikk er lukket nederst, og I dag viser dagens økt og læringsveien. 178 automatiske tester består.

Publisert 3. november 2026: app 1.1.2, utgivelse `1e5dc7cf9969`, kunnskapspakke 2.1.0 (uendret), via Wrangler fra `main`. Helse- og versjonsendepunktene og tjenestearbeideren samsvarer med bygget. En installert 1.1.0 i iPhone 17 Pro-simulatoren fant den nye utgaven på den publiserte adressen, lastet den inn og viste den nye innstillingssiden.

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

The app lives in `src/`; public knowledge, maps, icons, and the manifest are in `public/`. Run `npm install`, `npm test`, and `npm run build`. The build validates and hashes knowledge, compiles the SvelteKit app into `build/`, generates a versioned service worker and `version.json`, and writes `build/_headers` with the security headers and the content security policy. Run `npm run dev` for local development, and `npx wrangler dev` to try the built app with Cloudflare's static asset serving and headers.

Since 1.3.1 the Worker `atlas-first-app` has no script: Cloudflare serves `build/` as Workers static assets, configured in `wrangler.toml` (compatibility date `2026-10-10`, workers.dev enabled, observability on). Deploy from `main` after pushing it, with `npx wrangler deploy` from the repository root. Static asset requests run no code, so they use no CPU time and don't count toward the free plan's daily request limit. The limits that apply are 20,000 files and 25 MiB per file.

Headers come from `build/_headers`, not from code. After a deploy, check that `/` and `/sw.js` return the `Content-Security-Policy` header and that `/version.json` reports the new release. `/_app/immutable/*` is cached for a year; everything else is revalidated on each request with an ETag. The former `/health` endpoint is gone; `/version.json` replaces it.

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
