# Verdensblikk – perspektivgrafen

## Idé

Atlas har én kunnskapsgraf. Et historiesyn er en *projeksjon* av den samme grafen: det bestemmer hvilke nodetyper og forbindelser som løftes fram, hvilke land som blir mørke på kartet, hvilken rute «Finn sammenhengen» foretrekker, og hvilke spørsmål som passer. Brukeren kan bytte linse og se den samme verden omorganisere seg. Det er et eksperiment. Det er ikke sikkert at alle tjue linsene gir meningsfulle bilder med dagens register, og appen viser derfor hver linses blindsone.

Linsene er redaksjonelle tolkninger av historikernes perspektiver. Vektene i `knowledge-build/lens-projections.mjs` er ikke påstander om hva historikerne mente, og en linse avgjør ikke hva som er sant.

## De tjue historiesynene

Kildekritikk, lineær frelseshistorie, sykluser, fremskritt, store personer, materielle krefter og klasse, sivilisasjoner, lang varighet og mentaliteter (Annales), historie nedenfra, mikrohistorie, metahistorie (Hayden White), makt og diskurs, postkolonialt blikk, kjønn, verdenssystem, nettverk og møter, natur og økologi, Big History, erindring og geopolitikk.

Hver linse har et grunnspørsmål, et sammendrag, kritikk, sentrale tenkere, nøkkelverk, begreper og eksempler fra eksisterende noder. Innholdet er kildebelagt i `knowledge-build/perspectives.json`.

Fire linser har egne mål fordi registeret gir et konkret, men begrenset spor:

- **Verdenssystem:** balansen mellom prisvinnere som kom inn til og reiste ut fra et land (tilknytning ved tildeling).
- **Postkolonialt blikk:** andelen av landets prisvinnere som ble anerkjent mens de arbeidet i et annet land.
- **Kjønn:** andelen kvinner blant prisvinnere født i landet.
- **Kildekritikk:** antall ulike kilder for noder knyttet til landet.

Dette er stedfortredende mål. De er merket slik i appen og skal ikke leses som mål på kolonihistorie, verdensøkonomi eller kjønnsforhold generelt.

## Relevans: påvirkning, aktualitet og nærhet

- **Påvirkning:** vektet PageRank over hele grafen, oppgitt som persentil. Administrative koblinger (kommune → fylke, pristildeling → priskategori) teller lite, ellers blir fylker og priskategorier de «viktigste» nodene. Målet sier hvor sentralt noe står i Atlas, ikke historisk betydning i seg selv.
- **Aktualitet:** et datert nyhetsutvalg (`knowledge-build/news-snapshot.json`). En sak teller mest på publiseringsdagen og halveres hver 14. dag. Hovedsteder og naboland får en liten andel. Nyhetene oppdateres gjennom nye kunnskapspakker, aldri i bakgrunnen.
- **Nærhet:** luftlinje fra Oslo til landets geografiske midtpunkt på kartet. Norge og norske steder regnes som nære.

Brukeren vekter de tre selv i Verden og under «Tilpass økten» → «Registre og fri quiz». Vektingen ordner spørsmål fra registrene og fri quiz. Dagens økt i læringskjernen følger pensumets rekkefølge og påvirkes ikke. Hver linse har en standardvekting som kan tas i bruk med ett trykk.

## Nye forbindelser i grafen

- **Landegrenser** er avledet fra delte punkter i Natural Earth 1:110m. To kontakter over vann er fjernet (Egypt–Jordan, Kamerun–Niger). Frankrike grenser til Brasil og Surinam gjennom Fransk Guyana. Svært små stater mangler på kartgrunnlaget.
- **Kunnskapsflyt** kobler fødeland til landet der prisvinneren var tilknyttet en institusjon ved tildelingen. Det er ikke utvandring eller statsborgerskap.
- **Historiesyn, tenkere, verk og begreper:** stemme i historiesynet, nøkkelverk for, bruker begrepet, påvirket, knyttet til begrepet, lest som (Whites plotformer, troper, argumentasjonsformer og ideologiske implikasjoner) og ser på (eksempler).
- **Big History:** David Christians terskler i rekkefølge.
- **Nyheter** omtaler land, byer og personer.

## Ti måter å lære verden på

Flagg (begge veier), naboland, naboreise over land, nyhetskartet, linsens spørsmål, tenkere og ideer, plottlesing, skalastigen (kosmisk tid og avstand fra Oslo), kunnskapsflyt og perspektivbytte. Formatene genereres ved kjøring fra pakken, som de øvrige strukturerte quizformene. De har egne vanskelighetsfamilier og egen repetisjonsplan.

Spørsmål skal ikke røpe svaret: nyhetskartet hopper over saker der overskriften nevner landet eller en vanlig avledning av navnet. Flagg vises som systemets flaggtegn, så ingen bildefiler eller lisenser trengs. Formatet forutsetter iPhone, der alle flaggtegn vises.

## Blindsoner

Registeret består mest av navngitte personer, prisvinnere og administrative steder. Linser som historie nedenfra, mikrohistorie og økologi ser derfor lite. Atlas viser andelen noder hver linse ser og en konkret blindsone i stedet for å fylle tomrommet med svake koblinger.

## Gjenbygging

`npm run build` kjører `scripts/build-world-graph.mjs` etter at læringskjernen er satt sammen (`build-core.mjs`). Skriptet fjerner forrige perspektivlag (`layer: "perspective"`) og bygger det på nytt fra kartet, Nobelregisteret, forskningsfilen og nyhetsutvalget. Deretter kjøres berikelse, revisjoner, validering og pakking som før. `validatePerspectives` kontrollerer linser, terskler, påvirkningsverdier, datoer og posisjoner både ved bygging og før en pakke installeres på telefonen.

## Validering av ideen – 2. november 2026

`scripts/audit-perspectives.mjs` skriver `docs/perspective-audit.json` ved hver bygging.

- **Linsene ser forskjellige ting.** Blant de 25 høyest rangerte nodene deler to linser i snitt 8,6 %. Blant de ti mørkeste landene på kartet deler de 21 %. De mest like parene er materielle krefter/verdenssystem (84 %), postkolonialt/nettverk (76 %) og kildekritikk/historie nedenfra (68 %). De bygger på de samme få dataene, særlig prisvinnernes flyt og nyhetene, og bør få egne kilder før de kan skilles tydelig.
- **Volum alene ga feil kart.** Den første versjonen farget nesten alle linser som Nobelregisteret: USA, Storbritannia, Tyskland og Frankrike. Kartet bruker nå en blanding av volum og *løft*, det vil si hvor mye mer linsen ser i et land enn den nøytrale visningen. Løftet dempes for land med lite data. Land linsen ikke ser i det hele tatt, får ingen farge.
- **Påvirkning måtte vektes.** Uten vekting av koblingstyper ble Agder og Nobelprisens kategorier de mest «påvirkende» nodene. Med vekting kommer land, embeter og sentrale personer først.
- **Dekning:** Fremskritt (56 %), nettverk (47 %), Big History (46 %) og store personer (33 %) ser mye. Lineær frelseshistorie (0,7 %), kildekritikk (1,5 %), sykluser (1,8 %), erindring (2,1 %), økologi (2,4 %) og historie nedenfra (2,9 %) ser lite. De er tydelig merket med blindsoner.
- **Oppgaver per format:** flagg 235, naboland 134, naboreise 19, nyhetskartet 5, linsens spørsmål 20, tenkere og ideer 58, plottlesing 12, skalastigen 9, kunnskapsflyt 14 og perspektivbytte 53.

Kontroller i iOS Simulator (iPhone 17 Pro) mot produksjonsbygget: oppdatering fra en eldre installert kunnskapspakke, ny installasjon, Verden med linsevalg, kart, nodekort med flagg, påvirkning, aktualitet og avstand, perspektivbytte, naboland og forbindelser. En naboreise fra Finland til Ungarn ble vurdert som riktig med korteste rute. Påbegynt quiz ble gjenopprettet etter omlasting. Ny apputgave ble aktivert uten tap av fremgang, og Verden lastet fra hurtigbufferen med serveren stoppet. Fysisk telefon, flymodus og mørk modus er ikke kontrollert.

Nyhetsutvalget er kontrollert ved stikkprøver mot kildene (Al Jazeera om ebola og om Burnham, Equinors kvartalsrapport). Utvalget bygger på kilder fra perioden og beskriver forhold etter forfatterens egen kunnskap, blant annet kong Haakon som konge, Andy Burnham som britisk statsminister og krigen mot Iran.

## Sammenslåing med læringskjernen – 3. november 2026

Perspektivlaget ble først bygd på kunnskapspakke 1.2.0 og deretter flyttet oppå læringskjernen i 1.0.0. Fra app 1.1.0 og kunnskapspakke 2.1.0 bygges laget etter at pensumet er satt sammen. Pensumets egne rader (`unit:`, `core:` og tilhørende fakta og kilder) holdes utenfor påvirkningsberegningen. De har ingen forbindelser i grafen og skiftes ut hver gang pensumet kompileres, så laget skal ikke være avhengig av dem. Revisjonstallene er de samme etter sammenslåingen: 8,6 % felles toppnoder og 21 % felles land på kartet.


## En linse som ikke ser noe, sier det

Kartet skrev «Gjennom lineær frelseshistorie» over forbindelsene til Fijis utsatte grunnlovsavstemning, selv om den linsen ikke ser noe der: `relatedThrough` gir hver forbindelse minst 0,1 i vekt uansett linse. Nå får forbindelsene linsens overskrift bare når linsen er blant dem `lensesFor` regner som relevante for stedet eller emnet (poeng over 0,3). Ellers står «Sterkeste forbindelser», vektet uten linsen, og en linje sier at linsen sier lite om stedet. Beslutning som skal holde: en linse skal aldri se ut til å mene noe den ikke har grunnlag for.
