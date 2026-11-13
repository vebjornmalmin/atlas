# Quiz-off – direkte quiz mellom 2–8 telefoner

## Hvorfor det er bygd slik

Atlas er en nettapp på hjemskjermen. Den har ikke tilgang til Bluetooth eller AirDrop, så telefoner kan ikke finne hverandre direkte. Direkte forbindelser mellom telefoner (WebRTC) feiler ofte på mobilnett og gjestenett uten en relétjeneste som videresender trafikken, og en slik tjeneste må drives uansett.

Løsningen er ett lite rom på Cloudflare (en Durable Object, `QuizRoom`) per spill. Alle telefonene kobler seg til rommet. Rommet gir hendelsene én felles rekkefølge og én felles klokke. Selve spillet ligger likevel på hver telefon: hver telefon har hele hendelsesloggen og regner ut stillingen selv. Rommet trenger derfor ikke kjenne kunnskapspakken, og det er lite å drive og lite å betale for.

## Modell

- **Rommet nummererer og tar tiden.** Hver hendelse får `seq` (1, 2, 3 … uten hull) og `at` (romklokken i millisekunder). Rommet vurderer aldri om et svar er riktig og leser aldri kunnskapspakken.
- **Telefonene regner spillet ut fra loggen.** `replay` i `src/lib/quizoff/game.js` er en ren funksjon fra loggen til spilltilstand. Samme logg gir samme spill på alle telefoner. Loggen lagres lokalt, så en telefon som kommer tilbake henter bare det den mangler.
- **Hver telefon retter hvert avslørt svar selv**, med Atlas' vanlige rettekode. Derfor må appversjon og kunnskapspakke være like for alle spillerne. Rommet sammenligner `app` og `pack` ved innlogging og avviser en telefon med annen versjon (`version`).
- **Svar holdes tilbake til runden er lukket.** Rommet sender ikke svarene før `reveal` (eller `ballot` for et forklaringsspørsmål), og ingen kan kopiere hverandre. Rommet viser bare hvem som har svart og hvem som har stemt (`progress`). Stemmene sendes først med `reveal`.
- **Forklaringsspørsmål avgjøres av spillerne.** Et svar med egne ord kan ikke rettes automatisk. Spillerne stemmer derfor på svaret som ligger nærmest fasiten, og reduseren gir poeng ut fra stemmene. Rommet teller ikke stemmene; det tar bare imot dem og sender dem videre.
- **Svartiden måles av rommet**, fra `question`-hendelsen til svaret kommer. Telefonens egen klokke brukes bare til nedtellingen, justert med `now` fra `welcome`.

## Et spill sett fra spilleren

1. **Start.** Spilleren trykker på fanen «Quiz-off» (mellom Atlas og Deg), skriver navn og oppretter et rom eller skriver en kode. Navnet huskes til neste gang.
2. **Kode, lenke og QR-kode.** Rommet får en kode på fire bokstaver (A–Z uten I og O, 331 776 mulige koder). I lobbyen står koden, en QR-kode og lenken til spillet. Man kan bli med på tre måter, se «Å bli med».
3. **Lobby.** Spillerne dukker opp etter hvert som de kommer. Den første som kom er vert og velger fagområde, antall spørsmål, tid per spørsmål og form: «Flervalg», «Flervalg og skriving» eller «Med forklaringer». Vertens telefon plukker spørsmålene og sender dem med startmeldingen. Det trengs minst to spillere.
4. **Runder.** Alle får samme spørsmål samtidig og en nedtelling. Svaret kan ikke endres. Runden lukkes når alle har svart eller tiden er ute.
5. **Forklaringsspørsmål** (bare med formen «Med forklaringer»). Spørsmålet ber om en forklaring, og svaret skrives i et felt med flere linjer, høyst 400 tegn. Det har alltid 60 sekunder, uansett hva verten valgte for de andre spørsmålene.
6. **Stemming.** Har minst to svart på et forklaringsspørsmål, kommer en stemmerunde på 30 sekunder. Alle ser fasiten og kriteriene for et godt svar, og så svarene uten navn, i en rekkefølge som ikke følger spillerlisten. Hver spiller velger svaret som ligger nærmest fasiten og trykker «Stem på svar B». Det egne svaret vises, merket «Ditt svar», men kan ikke velges. Én stemme, og den kan ikke endres. Også den som ikke svarte, stemmer. Mens de venter, ser spillerne hvem som har stemt, men ikke på hvem. Stemmingen lukkes når alle har stemt eller tiden er ute. Svarte bare én, vinner det svaret uten stemming; svarte ingen, går runden rett til avsløringen.
7. **Avsløring.** Alle ser alles svar, hvem som hadde rett, poengene for runden og stillingen. Etter et forklaringsspørsmål ser de hvem som skrev hva, hvor mange stemmer hvert svar fikk, hvem som vant, fasiten og forklaringen. Nederst står «Neste spørsmål om 14 s» (eller «Resultatet om …» etter siste spørsmål). Spillet går videre av seg selv etter 20 sekunder, eller før hvis alle tilkoblede har trykket «Neste».
8. **Slutt.** Etter siste runde vises sluttstillingen. Etter 30 minutter er rommet slettet, men telefonen beholder loggen til spilleren går ut av spillet med «Nytt spill».

Spilleren kan bytte fane i lobbyen og etter spillet. Skjermen for quiz-off lever videre bak de andre fanene, så forbindelsen og klokken går som før, og fanen får en prikk så lenge spillet pågår. Når verten starter, går alle spillerne til første spørsmål, uansett hvilken fane de er på. Under spørsmål, stemming og avsløring er fanelinjen skjult.

### Å bli med

| Måte | Slik virker det |
|---|---|
| Skrive koden | I Atlas: fanen «Quiz-off», navn og koden. |
| Lenke | «Inviter» åpner delingsmenyen med en tekst, lenken og koden. Får ikke telefonen delt, kopieres teksten med lenken; går ikke det heller, vises lenken. Lenken står også under QR-koden, kan merkes og har «Kopier lenke». |
| QR-kode | De andre i rommet retter kameraet mot QR-koden i lobbyen og trykker på lenken som dukker opp. QR-koden er bare lenken. |

**Lenken** er appens egen adresse med koden: `https://<adresse>/?quizoff=ABCD`. Den inneholder ikke navn, nøkkel eller noe annet. Når Atlas åpnes med `?quizoff=`:

1. Parameteren fjernes fra adressen med en gang (`history.replaceState`), slik at en ny innlasting eller et senere besøk ikke prøver å bli med igjen. Andre parametere blir stående, og adressen får `#quizoff`, så appen åpner på Quiz-off-fanen. Koden huskes i fanen (`sessionStorage`, `atlas-quizoff-invite`) til spilleren er med eller velger noe annet. Nettleseren kan ha en eldre utgave av Atlas lagret og tilby «Oppdater appen» før spilleren har blitt med; etter oppdateringen står bli med-steget der fortsatt.
2. Har telefonen et lagret spill med samme kode, fortsetter det bare.
3. Har telefonen et lagret spill med en annen kode, beholdes det, og spilleren får vite at hen allerede er med i et spill og må forlate det for å bli med i det andre. Begge valgene vises: «Fortsett i spillet …» og «Forlat … og bli med i …». Et ferdig spill teller ikke; det glemmes, og lenken åpnes som vanlig.
4. Ellers åpnes quiz-off på «Bli med i spillet ABCD», med koden ferdig utfylt. Spilleren skriver bare navn (det er fylt ut hvis nettleseren har et lagret navn) og trykker én gang. «Skriv en annen kode» og «Start et eget spill» fører til den vanlige startsiden.
5. Har lenken ingen gyldig kode, åpnes den vanlige startsiden med beskjed om det.

Koden leses av `codeFromUrl` i `src/lib/quizoff/invite.js`. Den tåler små bokstaver og tegn rundt koden, og gir tom kode for alt annet. Hva som lagres hvor, er uendret: spillet under `atlas-quizoff`, navnet under `atlas-quizoff-name`, begge bare i nettleseren som åpnet lenken.

**På iPhone åpnes en lenke alltid i Safari**, også når Atlas ligger på hjem-skjermen. Det gjelder lenker fra kameraet og fra meldinger. Hjem-skjerm-appen og Safari har hver sin lagring, så spillet havner i Safari. Det er godtatt fordi et spill er kort og ikke bruker læringshistorikken: lenken virker for en som aldri har åpnet Atlas, siden lastes, kunnskapspakken hentes, og spilleren er med etter ett trykk. Den som heller vil spille i hjem-skjerm-appen, åpner den og skriver koden; derfor står koden også i invitasjonsteksten.

**QR-koden** lages på telefonen av `src/lib/quizoff/qr.js`, uten biblioteker og uten nett: bytemodus, feilretting M, versjon 1–10 velges etter lengden (en lenke på rundt 60 tegn blir versjon 4), alle åtte masker prøves og den med lavest straffepoeng velges. Den tegnes som SVG med mørke moduler på hvitt og en hvit sone på fire moduler rundt, i alle stiler og i mørk modus, minst 200 punkter bred og uten utjevning (`shape-rendering: crispEdges`). Den vises bare i lobbyen, fordi ingen kan bli med etter start. Koderen er kontrollert med en uavhengig leser (Vision på macOS) for versjon 1–10, også for norske bokstaver og 200 tegn, og testene holder fast matrisene som ble lest riktig.

### Når telefonen sovner, mister nettet eller appen lukkes

| Hendelse | Hva skjer |
|---|---|
| Nettet faller eller telefonen sovner | Telefonen går til «kobler til igjen» og prøver på nytt med ventetid fra 0,5 til 8 sekunder (dobler hver gang). Når appen blir synlig igjen eller nettet kommer tilbake, prøves det med en gang. Hver ny forbindelse starter med `hello` og `have` (siste `seq` telefonen har), og rommet sender bare det som mangler. |
| Svar gitt uten nett | Svaret lagres på telefonen og sendes på nytt etter `welcome`, hvis spørsmålet fortsatt er åpent og rommet ikke allerede har registrert det. |
| Stemme gitt uten nett | Det samme som for svar: stemmen lagres (`myVotes`) og sendes på nytt etter `welcome` mens stemmingen er åpen og `progress.voted` ikke allerede har spilleren. En spiller som faller ut etter å ha stemt, beholder stemmen, fordi rommet lagrer den. |
| Skrevet, men ikke sendt | Teksten i svarfeltet, også en halvskrevet forklaring, lagres per spørsmål på telefonen (`atlas-quizoff-local`) og står der igjen når appen åpnes på nytt. |
| Hull i `seq` | Telefonen kobler til igjen og henter loggen på nytt. Hendelser den allerede har, hoppes over. |
| Død forbindelse | Telefonen sender `ping` hvert 25. sekund. Kommer ikke `pong` innen 10 sekunder, regnes forbindelsen som død. |
| Appen lukkes og åpnes igjen | `resume()` henter rom, spiller, nøkkel, logg, egne svar og egne stemmer fra lagringen og kobler til. Spilleren kommer tilbake til samme spørsmål, samme stemmerunde og samme stilling. Et lagret spill som ikke kan leses (for eksempel en hendelse uten `seq`), glemmes i stedet for å gjenopprettes halvveis. |
| Spillet åpnes på en annen telefon eller fane | Den gamle forbindelsen lukkes med kode 4000 og viser `replaced` i stedet for å koble til igjen, ellers ville de to lukket hverandre om og om igjen. Åpnes appen igjen på den telefonen, tar den over spillet. |
| Spilleren trykker «Forlat» | Telefonen sender `leave` og glemmer spillet. Spilleren kan ikke komme tilbake. |

## Protokollen

Meldingene er JSON i tekstrammer, høyst 16 KB. `PROTOCOL = 1`. Tallene står i `src/lib/quizoff/protocol.js`.

### Endepunkter

| Endepunkt | Svar |
|---|---|
| `POST /api/quizoff/rooms` med `{app, pack}` | `201 {code}`. Workeren lager en kode og ber rommet starte. Er koden i bruk (409), prøver den på nytt, opptil 5 ganger, deretter `503 busy`. |
| `GET /api/quizoff/rooms/:code/ws` med `Upgrade: websocket` | Kobler til rommet. Rommet tar alltid imot forbindelsen; feil meldes som `error` og forbindelsen lukkes. En kode som ikke kan finnes (feil lengde eller bokstaver) får `no-room`. |
| Alt annet under `/api/` | `404` med JSON. Feil metode `405`, ikke websocket `426`, fremmed opprinnelse `403`, ugyldig innhold `400`. |
| Alt utenfor `/api/` | Statiske filer. `run_worker_first = ["/api/*"]` gjør at de leveres uten at Workeren kjører. |

### Telefon til rom

| Melding | Betydning |
|---|---|
| `hello {v, player:{id,name}, key, app, pack, have}` | Første melding på hver forbindelse. `id` er en UUID telefonen laget for dette spillet. `key` er en hemmelighet (16–128 tegn) telefonen beholder; rommet lagrer den ved første innlogging og krever den hver gang etterpå. `have` er høyeste `seq` telefonen har (0 uten logg). |
| `start {settings:{count,seconds,title}, questions:[{id,mode}]}` | Bare i lobbyen. Se «Romregler» for hvem som kan starte. `questions.length` må være lik `count`. `mode` er `recognition`, `recall` eller `open` (forklaring). Rommet husker formen per spørsmål og bruker den til fristen og til hva som kommer etter runden. |
| `answer {q, answer}` | Tekst på 1–200 tegn, eller 1–400 tegn på et forklaringsspørsmål. Det første svaret per spiller per spørsmål teller, senere svar ignoreres. Bare mens spørsmål `q` er åpent. |
| `vote {q, for}` | Stemme på svaret til spilleren `for` i stemmerunden for `q`. Avvises uten svar når `for` er spilleren selv, når `for` ikke har et svar på stemmeseddelen, når spilleren alt har stemt, og utenfor stemmerunden. |
| `timeup {q}` | Nedtellingen på telefonen er ferdig, for et spørsmål eller en stemmerunde. Sendes hvert 2. sekund så lenge fasen står åpen og telefonen er tilkoblet. |
| `ready {q}` | Spilleren har trykket «Neste» etter avsløringen av `q`. |
| `force {q}` | Avsløringen av `q` har stått i 20 sekunder. Sendes av telefonen selv, hvert 2. sekund så lenge avsløringen vises og telefonen er tilkoblet. |
| `leave` | Spilleren forlater spillet for godt. |
| `"ping"` | Besvares med `"pong"` av `setWebSocketAutoResponse` uten å vekke rommet. |

### Rom til telefon

| Melding | Betydning |
|---|---|
| `welcome {room:{code,app,pack}, you, now, events, online, progress}` | Svar på en gyldig `hello`. `events` er alle hendelser med `seq > have`. `now` er romklokken. |
| `event {event}` | En ny hendelse, til alle. |
| `presence {online}` | Hvem som er koblet til. Sendes når noen kobler til eller fra. Ikke en del av loggen. |
| `progress {q, answered, voted, ready}` | Hvem som har svart, hvem som har stemt og hvem som er klare i runde `q`, uten selve svarene og uten hvem de stemte på. Ikke en del av loggen. |
| `error {code, …}` | Feil. Rommet lukker forbindelsen ved alle koder unntatt `bad` etter at spilleren er innlogget. |

### Hendelser i loggen

Hver hendelse har `seq`, `at` og typen i feltet `t`.

| `t` | Felter |
|---|---|
| `joined` | `player:{id,name}` |
| `left` | `player` (id) |
| `started` | `settings:{count,seconds,title}`, `questions:[{id,mode}]` |
| `question` | `q` (fra 0), `deadline` (= `at` + sekunder × 1000, eller + 60 000 for et forklaringsspørsmål) |
| `ballot` | Bare for et forklaringsspørsmål med minst to svar. `q`, `answers:{[spillerId]:{answer, ms}}`, `deadline` (= `at` + 30 000). Åpner stemmerunden. |
| `reveal` | `q`, `answers:{[spillerId]:{answer, ms}}`. Spillere som ikke svarte, mangler. `ms` er tiden rommet målte, begrenset til 0 … rundens lengde. For et forklaringsspørsmål også `votes:{[velgerId]:spillerId}` (tom når det ikke ble stemt). Svarene gjentas fra `ballot`, så avsløringen kan leses alene; det koster noen få kilobyte per forklaringsrunde. |
| `finished` | – |

### Feilkoder

| Kode | Når | Videre |
|---|---|---|
| `no-room` | Rommet finnes ikke, er slettet, spilleren har forlatt det, eller telefonen har logg (`have > 0`) men er ukjent i rommet (en kode som er gjenbrukt). | Fatal. Telefonen glemmer det lagrede spillet. |
| `version` | `v`, `app` eller `pack` er ulik rommets. Meldingen har med `app` og `pack` fra rommet. | Fatal |
| `full` | Ny spiller når 8 spillere er med. | Fatal |
| `started` | Ny spiller etter at spillet har startet. | Fatal |
| `name` | Navnet er ikke 1–20 tegn etter rensing. | Fatal |
| `key` | Kjent spiller med feil nøkkel. | Fatal |
| `bad` | Første melding var ikke `hello`, eller meldingen er ugyldig. Før innlogging lukkes forbindelsen; etterpå svares det bare med feilen. | Ikke fatal |

Telefonen har i tillegg egne koder som ikke kommer fra rommet: `unreachable` (rommet kan ikke nås), `create-failed` (rommet ble ikke opprettet), `cancelled` og `replaced`.

Lukkekoder: 1000 vanlig, 4000 `replaced`, 4001 feil.

### Grenser

| Grense | Verdi |
|---|---|
| Spillere | 2–8 |
| Navn | 1–20 tegn, renset for kontrolltegn og dobbel mellomrom |
| Spørsmål | 3–20 |
| Tid per spørsmål | 10–60 sekunder |
| Tittel | høyst 60 tegn |
| Spørsmåls-ID | høyst 200 tegn |
| Svar | 1–200 tegn, 1–400 på et forklaringsspørsmål |
| Forklaringsspørsmål | 60 sekunder (`OPEN_SECONDS`) |
| Stemmerunde | 30 sekunder (`VOTE_SECONDS`) |
| Avsløring før spillet går videre | 20 sekunder (`REVEAL_SECONDS`, `FORCE_AFTER`) |
| Melding | høyst 16 KB |
| Toleranse for `timeup` og `force` | 250 ms |
| Rommets levetid | 6 timer, 30 minutter etter slutt |

## Romregler

Alle beslutninger ligger i `worker/room-core.js` som rene funksjoner over vanlige data. `worker/quiz-room.js` lagrer, sender og lukker, så reglene kan testes i Node uten Cloudflare.

**Hvem kan starte.** Vert er den første spilleren som ikke har forlatt spillet. Verten kan starte når minst to spillere er med. Er verten ikke koblet til, kan hvilken som helst spiller starte. Når verten forlater lobbyen, går vertskapet videre til neste.

**Når et spørsmål lukkes:**

- Alle spillere runden venter på har svart og minst ett svar finnes. Runden venter på `waitFor`: spillerne som var tilkoblet da den åpnet. En spiller som mister forbindelsen midt i runden, blir fortsatt ventet på til tiden er ute, så et kort nettbrudd koster ikke spørsmålet. En spiller som var frakoblet da runden åpnet, ventes det bare på hvis hen kommer tilbake i løpet av runden. En som har forlatt spillet, ventes det aldri på.
- Rommet får `timeup`, og romklokken er innenfor 250 ms av fristen eller forbi den. Kommer `timeup` mindre enn 5 sekunder for tidlig, prøver rommet selv én gang på nytt ved fristen (en tidtaker i minnet).
- Et svar kommer mer enn 250 ms etter fristen. Da lukkes runden uten at svaret teller.

Et vanlig spørsmål går så rett til `reveal`. Et forklaringsspørsmål med minst to svar går til stemmerunden (`ballot`); med ett svar eller ingen går det rett til `reveal`.

**Stemmerunden** har sin egen frist (30 sekunder) og sin egen `waitFor`, etter samme regel: tilkoblet da den åpnet, pluss spillere som kommer tilbake underveis; et brudd fjerner ingen; en som har forlatt spillet, ventes det ikke på. Den lukkes (`reveal` med `votes`) når alle den venter på har stemt og minst én stemme finnes, når `timeup` kommer innenfor 250 ms av fristen (med samme forsøk på nytt som over), eller når en stemme kommer for sent. Er ingen tilkoblet, venter den til fristen og en telefon melder tiden ute; den lukkes aldri tom før det. Rommet tar imot én stemme per spiller, ikke på eget svar og bare på et svar som står på stemmeseddelen. Et svar fra en som har forlatt spillet, blir stående og kan få stemmer.

**Når neste spørsmål åpnes.** Når alle tilkoblede spillere som ikke har forlatt spillet, har sendt `ready` for runden, eller når en telefon sender `force` og det har gått 20 sekunder siden avsløringen (med 250 ms toleranse). Telefonene sender `force` av seg selv når nedtellingen på avsløringen er ferdig. Kommer `force` mindre enn 5 sekunder for tidlig, prøver rommet selv på nytt etter 20 sekunder, akkurat som for `timeup`. Etter siste runde kommer `finished`. Er ingen tilkoblet, sender ingen `force`, og spillet venter.

**Å forlate spillet.** `leave` gir hendelsen `left`, forbindelsene til spilleren lukkes, og spilleren telles ikke lenger med. Rundene sjekkes på nytt, så en spiller som går midt i en runde holder ikke de andre igjen. Har alle forlatt spillet, avsluttes det og rommet slettes med en gang. Etter `finished` legges ingen hendelse til; `leave` husker bare at spilleren gikk, slik at et tomt rom kan slettes tidlig.

**Samme spiller to steder.** En ny forbindelse for samme spiller erstatter den gamle (kode 4000). Den nye arver `ready`-merket fra den gamle.

**Opprydding.** En alarm slår til 6 timer etter opprettelsen. Er det aktivitet siste time og spillet ikke er ferdig, settes alarmen en time frem. 30 minutter etter `finished` slettes alt. Spillere som fortsatt er koblet til, får `no-room` før forbindelsen lukkes.

**Hva som lagres hvor.** All varig tilstand ligger under én lagringsnøkkel (`room`): kode, versjoner, spillere med nøkler, loggen, innstillingene, formen per spørsmål og den åpne runden med svarene og stemmene så langt. Hver avgjørelse koster dermed høyst én rad skrevet. `ready`-merker og hvilken spiller en forbindelse tilhører, ligger bare i forbindelsens vedlegg (`serializeAttachment`), og overlever hvilemodus uten å skrive til lagringen. Hvem som er tilkoblet, regnes ut fra forbindelsene.

## Spørsmål og poeng

### Hvilke kort som brukes

Bare kort fra læringskjernen (ID starter med `core:`), fordi de følger med kunnskapspakken og alle telefoner derfor har dem. `quizoffPool` slipper gjennom:

- **Flervalg** med minst tre egne skrevne gale alternativer. Alternativer lånt fra andre kort kunne vært ulike fra telefon til telefon.
- **Tekstsvar** med svarformen `short`, `year` eller `number`.
- **Forklaring** (`answerFormat: 'explanation'`, i quiz-off formen `open`) med fasit og kriterieliste (`rubric`), bare når verten velger «Med forklaringer». De rettes ikke av appen, men avgjøres av spillernes stemmer.

Kobling og rekkefølge er utelatt: de lar seg ikke svare på eller rette like entydig i tidsnød.

Tellingen mot `public/knowledge/foundation.json`:

| | Kort |
|---|---|
| Kjernekort i pakken | 1520 |
| Flervalg (alle har tre egne gale alternativer) | 734 |
| Tekstsvar: kort svar / årstall / tall | 435 / 76 / 34 (545 til sammen) |
| **I puljen** | **1279** |
| Forklaring, med «Med forklaringer» | 120 (ett per emne, 6–12 per fagområde) |
| Utelatt: kobling / rekkefølge | 45 / 76 |

Puljen dekker 120 emner og alle 15 fagområder. Et fagområde kan velges som tema når det har minst 10 kort i puljen uten forklaringene; det laveste har 47. Alternativt kan temaet være «blandet».

### Hvordan spørsmålene velges

Vertens telefon velger med `pickQuestions` ut fra et frø, så valget kan gjentas, og sender listen `[{id, mode}]` i `start`. Rommet sjekker bare form og lengde, ikke at kortene finnes.

- Ett kort per emne før et emne gjentas, slik at spillet sprer seg.
- Med «Med forklaringer» er omtrent ett spørsmål av fem et forklaringsspørsmål, minst ett: 1 av 5, 2 av 10, 3 av 15. De spres utover: resten av spillet etter første spørsmål deles i like store bolker, og hvert forklaringsspørsmål havner et tilfeldig sted i sin bolk. Første spørsmål er aldri et forklaringsspørsmål. Finnes ikke noe forklaringskort å ta, blir plassen et tekstsvar.
- Av de andre spørsmålene er omtrent 60 % flervalg og resten tekstsvar, i blandet rekkefølge, når puljen har begge former. Mangler en form i emnet, tas den andre.
- To kort med samme svar velges aldri i samme spill.

Et forklaringsspørsmål viser bare spørsmålet og et felt med flere linjer; fasiten og kriteriene vises først i stemmerunden. Flervalg har fire alternativer i fast rekkefølge per kort, slik at rekkefølgen er lik på alle telefoner. Svaret på et flervalg er alternativets ID, og riktig er det som er lik kortets ID. Tekstsvar rettes med `gradeAnswer`, som i resten av appen (skrivefeil i lengre navn, dokumenterte varianter, toleranse for årstall). Har en telefon ikke kortet, markeres spørsmålet som manglende og rettes som galt.

### Poeng

Riktig svar gir `100 + round(50 × (1 − ms / (sekunder × 1000)))`, altså 150 for et umiddelbart svar og 100 ved fristen. Galt svar og uteblitt svar gir 0.

**Forklaringsspørsmål.** Svaret eller svarene med flest stemmer vinner, så lenge det er minst én stemme. Deler flere svar flest stemmer, vinner alle. Bare stemmer på et annet svar på stemmeseddelen telles. Vinnerne får 150 poeng (`WIN_POINTS = BASE_POINTS + SPEED_POINTS`, det et perfekt svar på et annet spørsmål kan gi), alle andre 0. Det gis ikke fartspoeng. Et svar som er det eneste, vinner uten stemming. Ingen svar, eller ingen stemmer, gir ingen vinner. To spillere som begge svarte, kan bare stemme på hverandre; de får én stemme hver og vinner begge. Det er med vilje.

Stemmeseddelens rekkefølge regnes ut av reduseren fra `ballot`-hendelsen (en hash av `q`, `at` og spiller-ID), så den er lik på alle telefoner uten å følge spillerlisten.

### Stillingen

Rekkefølgen er:

1. flest poeng,
2. lavest samlet svartid på riktige svar (en vunnet forklaring teller som riktig, men tiden telles ikke med, fordi stemmingen ikke handler om fart),
3. navnet i norsk alfabetisk rekkefølge,
4. ID.

Spillere med like mange poeng og lik tid deler plassering. Spillere som har forlatt spillet, blir stående i stillingen.

## Beslutninger som skal holde

| Beslutning | Begrunnelse |
|---|---|
| Ingen hint | Hint ville gjort svarene ulikt støttet og poengene ujevne. Alle får samme oppgave på samme vilkår. |
| Ingen «Jeg vil lære dette først» | Det stopper klokken for én spiller og gir et forsprang. Quiz-off er konkurranse, ikke innføring. |
| Ingen «Godkjenn svaret mitt» | Poeng i en konkurranse må ikke kunne gis av spilleren selv. Appens egen retting avgjør, likt på alle telefoner. |
| Svar fra quiz-off skrives ikke til læringshistorikken i denne versjonen | Et svar med tidspress i en konkurranse sier lite om hva som huskes, og ukjente kort ville hoppet over innføringen sin. |
| Ingen kan bli med etter start | Alle telefoner regner ut spillet fra hele loggen fra første hendelse, og spørsmålene er valgt for dem som var med. Å komme sent inn gir en spiller som har gått glipp av spørsmål og poeng. |
| Quiz-off har sin egen fane | Det er noe du gjør sammen med andre, ikke en del av dagens læring, og passet ikke inn i I dag. En egen fane gjør det lett å finne når noen sier «bli med», og gir lobbyen og resultatet et sted å være mens spilleren ser på noe annet. |
| Spillet starter for alle, uansett fane | Runden venter ikke på dem som ikke ser spørsmålet; klokken går. At verten starter, er derfor det eneste som flytter spilleren til en annen fane uten at spilleren har trykket. |
| Appoppdatering venter til spillet er over | Å bytte app- eller pakkeversjon midt i et spill kan gi en annen retting enn de andre har. Oppdateringsbanneret vises etter spillet. |
| Kode, lenke og QR-kode; ingen skanner i appen | En skanner i appen krever kameratilgang og en QR-leser i tillegg til koderen, mens kameraappen på iPhone allerede leser QR-koder og åpner lenken. Lenken går derfor via Safari, ikke hjem-skjerm-appen, og koden finnes fortsatt for dem som vil skrive den. |
| Lenken bærer bare koden | Det som skal til for å bli med, er koden og et navn. Navn og nøkkel lages på telefonen som blir med. |
| Forklaringer avgjøres av spillernes stemmer | Et svar med egne ord kan ikke rettes pålitelig av appen, og å la hver spiller vurdere seg selv gir ikke poeng som kan sammenlignes. Å stemme på svaret som ligger nærmest fasiten, med fasiten og kriteriene foran seg, gjør vurderingen til en del av spillet. |
| Ingen stemme på eget svar | Ellers ville alle stemt på seg selv. Det egne svaret vises likevel, merket, slik at spilleren ser hva de andre sammenlignes med. |
| Én stemme, og den er endelig | Som svarene: én gang, ingen angring. Det holder runden kort og regelen enkel. |
| Delt seier ved likt antall stemmer | Det finnes ingen rettferdig måte å skille dem på. Med to spillere som begge svarte, vinner alltid begge; det er godtatt. |
| 150 poeng for seier, ingen fartspoeng | Like mye som det beste svaret på et vanlig spørsmål, så forklaringene verken veier for lite eller tar over spillet. Fart skal ikke straffe den som tenker seg om. |
| Faste tider: 60 sekunder for forklaringen, 30 for stemmingen | En forklaring tar lengre tid å skrive enn et navn, og tiden verten velger er laget for korte svar. |
| Navnene skjules bare på stemmeskjermen | Hvem som skrev hva, ligger i `ballot`-hendelsen på telefonen, og en som leser lagringen, kan se det. Det er godtatt for et spill mellom venner; poenget er at skjermen ikke påvirker stemmene. |
| Avsløringen går videre av seg selv etter 20 sekunder | Før måtte alle trykke «Neste», og etter 20 sekunder kunne én spiller tvinge spillet videre. Nå teller skjermen ned og går videre selv, så ingen trenger å vente på en som har lagt fra seg telefonen. «Neste» finnes fortsatt for dem som vil fortere videre; knappen «Gå videre uten å vente» er fjernet. |

## Personvern

- **Rommet ser** navn, svar (også forklaringene), svartider, stemmer og kort-ID-er. Poengene regnes ut på telefonene og er aldri hos rommet. Det ser ikke kortinnholdet, riktige svar eller hva spilleren har lært.
- **Rommet slettes** 30 minutter etter at spillet er ferdig, eller så snart alle har forlatt det. Et rom ingen spilte i, slettes etter 6 timer.
- **Læringshistorikken forlater aldri telefonen.** Quiz-off skriver ikke til den, og loggen telefonen lagrer, ligger bare lokalt under `atlas-quizoff`.
- **Workeren avviser forespørsler fra andre opprinnelser.** Har en forespørsel `Origin` som ikke er appens egen adresse, får den `403`. Forespørsler uten `Origin` (ikke-nettlesere) slippes gjennom; det som holder dem ute av et spill, er koden og nøkkelen.
- **Lenken og QR-koden inneholder bare koden**, ingen navn, nøkkel eller annet som peker på en person. Den som får lenken videresendt, vet ikke mer enn den som har hørt koden.
- Den som kan koden, kan bli med i lobbyen til spillet starter. Spillere identifiseres med nøkkelen, ikke navnet, så ingen kan ta over en annens plass.

## Kostnad på Cloudflares gratisplan

Gratisgrensene for Durable Objects per dag er 100 000 forespørsler, 100 000 rader skrevet, 5 millioner rader lest og 13 000 GB-sekunder. De nullstilles klokken 00:00 UTC. `wrangler.toml` bruker `new_sqlite_classes`, som er det gratisplanen krever.

Tallene under er regnet ut fra koden, ikke målt på Cloudflare.

- **Rader skrevet er den trangeste grensen.** Ett spill med 4 spillere og 10 spørsmål skriver 56 rader: 1 for opprettelsen, 4 for innlogginger, 1 for start, 40 for svar (det siste svaret i en runde skriver også avsløringen), 9 for neste spørsmål og 1 for slutt. Det er det samme om spillet går videre med «Neste» eller av seg selv: begge koster den ene skrivingen av neste spørsmål. Legger man til to alarmskrivinger (ved opprettelsen og ved slutten) og slettingen til slutt, blir det om lag 58 rader per spill, altså omtrent 1 700 slike spill per dag.
- **En stemmerunde koster én rad per stemme.** Stemmene lagres som svarene, så en spiller som faller ut, beholder stemmen; den siste stemmen skriver også avsløringen, og det siste svaret skriver stemmeseddelen. Med 4 spillere, 8 vanlige spørsmål og 2 forklaringsspørsmål der alle stemmer, blir det 64 rader: 56 som over pluss 8 stemmer. Med alarmer og sletting om lag 66 rader, altså omtrent 1 500 slike spill per dag. Testene i `tests/quizoff-room.test.mjs` slår fast begge tallene.
- **Forespørsler.** Å åpne en forbindelse er én forespørsel, og 20 innkommende meldinger regnes som én. Et slikt spill har rundt 85 innkommende meldinger og 4 forbindelser pluss opprettelsen, altså omtrent 10–15 forespørsler. Det rekker til flere tusen spill.
- **Rader lest.** Rommet leser sin ene rad når det våkner. Grensen er langt unna.
- **Kjøretid.** Ventende rom koster ingenting, fordi rommet bruker hvilemodus (Hibernation API) og ikke kjører mens forbindelsene står stille. Det eneste som holder rommet våkent, er den korte pausen før en frist når en telefon melder tiden ute eller sender `force` litt for tidlig (høyst 5 sekunder).

## Kjøre og teste lokalt

```
node --test tests/quizoff-*.test.mjs
```

Kjører alle testene uten Cloudflare.

```
npm run build              # lager build/ som Workeren leverer som statiske filer
npx wrangler dev --port 8799
node scripts/quizoff-smoke.mjs
```

Smoketesten tar valgfritt en adresse (standard `http://127.0.0.1:8799`) og spiller et spill mot en kjørende Worker.

| Fil | Dekker |
|---|---|
| `tests/quizoff-room.test.mjs` | Protokollen (koder, navn, meldinger, `vote`) og alle romregler: runder, frister, `timeup` i begge faser, `force` med toleranse og nytt forsøk, stemmerunden bare for forklaringer, avviste stemmer, stemmer skjult til avsløringen, ett svar og ingen svar, velgere som faller ut og kommer tilbake, frakobling og retur, avvisning ved `hello`, vert, `leave`, antall skrevne rader og opprydding. |
| `tests/quizoff-game.test.mjs` | Reduseren: poeng, stemmeseddelen og rekkefølgen, stemmetelling, delt seier, ett svar og ingen svar, `replay` og hull i `seq`, vert, stillingen og delte plasseringer. |
| `tests/quizoff-questions.test.mjs` | Puljen og dens filtre, utvalget (også én av fem forklaringer, spredt og aldri først), at riktig alternativ og fasiten ikke avsløres, retting og tellinger mot den ekte kunnskapspakken. |
| `tests/quizoff-client.test.mjs` | Forbindelsen: opprette og bli med, lagring og gjenopptak (også stemmer og et lagret spill som ikke kan leses), ny tilkobling med ventetid, svar og stemmer uten nett, `ping`, fatale feil og lagring som feiler. |
| `tests/quizoff-invite.test.mjs` | Lenken (`inviteUrl`, `codeFromUrl` med små bokstaver, ugyldige koder og søppel) og QR-koderen: kapasitet og størrelse per versjon, søkemønstre, tidslinjer, den mørke modulen, formatinformasjonen (nivå M og masken) og versjonsinformasjonen, og hele matrisen for tre tekster som er lest riktig av en uavhengig leser. |
| `tests/quizoff-integration.test.mjs` | Tre telefoner spiller to hele spill gjennom rommet og ender med samme spill: ett med vanlige spørsmål, og ett med to forklaringsspørsmål med stemming (en stemme gitt uten nett, en spiller som ikke svarer, en som ikke stemmer, delt seier, appen lukket midt i stemmingen) og avsløringer som går videre av seg selv. Ulik versjon og sen ankomst avvises. |
| `scripts/quizoff-smoke.mjs` | To roboter spiller fire spørsmål mot en kjørende Worker; den ene mister forbindelsen og kommer tilbake med `have`. Det siste er et forklaringsspørsmål: begge svarer, stemmer på hverandre og deler seieren. Avsløringen går videre av seg selv: den ene roboten sender `force` et sekund for tidlig, og rommet går videre ved 20 sekunder. Begge må ende med samme logg. |

## Til senere

- QR-skanner inne i appen, slik at et spill fra en QR-kode kan åpnes i hjem-skjerm-appen i stedet for Safari.
- Flere spørsmålsformer, som tidslinje og kart.
- Å lagre svarene som øving i læringshistorikken, med en vurdering som tar hensyn til tidspresset.
- Å bli med etter start.
- Direkte forbindelse mellom telefoner eller spill uten nett.
