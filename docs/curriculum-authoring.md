# Kunnskapskjernen – skrive emner og oppgaver

Kunnskapskjernen er Atlas' kuraterte pensum. Den er bygd for én voksen elev som vil ha bred allmenndannelse på norsk: først forstå hva noe er og hvorfor det betyr noe, så huske de viktigste navnene og begrepene, deretter se sammenhenger, og til slutt mestre detaljer.

Registeret (Nobelprisvinnere, kommuner, land) er et oppslagsverk. Kjernen er undervisning. Den ene erstatter ikke den andre.

## Struktur

```
fagområde (domain)  →  emne (unit)  →  kort (card)
Norgeshistorie         Vikingtiden      «Hvem ledet ferden til Vinland …?»
```

Hvert fagområde ligger i `knowledge-build/core/<fagområde>.json`:

```json
{
  "domain": { "id": "norgeshistorie", "title": "Norgeshistorie", "subject": "history", "order": 1, "description": "…" },
  "units": [ { …emne… } ]
}
```

### Emne

| Felt | Krav |
|---|---|
| `id` | Fast, kort ID med fagområdets prefiks, f.eks. `nh-vikingtiden`. Endres aldri etter publisering. |
| `title` | Emnets navn slik eleven ser det. |
| `tier` | 1 = grunnmur (kan starte uten forkunnskaper), 2 = bygger videre, 3 = fordypning. |
| `prerequisites` | Emne-ID-er som bør være kjent først. Kan krysse fagområder. Bare reelle faglige avhengigheter. |
| `years` | Valgfritt `{from, to}` for emner med en tydelig periode. Brukes til tidslinje og filtrering. |
| `summary` | Én setning: hva emnet handler om og hvorfor det betyr noe. |
| `lesson` | 2–3 korte avsnitt (maks ca. 70 ord hvert). «Kort fortalt» som eleven leser før første oppgave. Forklar det store bildet og de viktigste navnene. |
| `keyPoints` | 3–5 korte setninger eleven skal sitte igjen med. |
| `sources` | Kildene du faktisk bygger på, helst 2–6. Bruk Store norske leksikon med URL nøyaktig slik `node scripts/snl.mjs search …` gir den, og kontroller innholdet med `node scripts/snl.mjs read <url>`. Andre autoritative kilder (museer, offentlige etater, NASA, FN) er tillatt. |
| `cards` | 10–14 kort fordelt på fire steg. |

### Steg

| Steg | Navn i appen | Hensikt | Typiske kort |
|---|---|---|---|
| 1 | Oversikt | Hva, når, hvor, hvorfor viktig. Svaret står i leksjonen. | `choice` |
| 2 | Kjerne | Hente fram sentrale navn, begreper og steder fra hukommelsen. | `text`, `choice` |
| 3 | Sammenheng | Årsak, virkning, sammenligning og forklaring. | `choice` med «hvorfor», `explain`, `order`, `match` |
| 4 | Detalj | Presise årstall, tall og mindre sentrale navn. | `year`, `number`, `text`, `choice` |

Typisk fordeling: 3–4 kort i steg 1, 3–4 i steg 2, 2–3 i steg 3 (minst ett `explain` eller `order`/`match`), 2–3 i steg 4.

### Kort

Felles felt: `id` (begynner med emne-ID-en), `step`, `type`, `prompt`, `explain` og `hint` (se «Hint» under). Valgfritt: `media` (ID til et lisensavklart bilde i `public/knowledge/media.json`, f.eks. `the-scream`). Bildet vises sammen med spørsmålet, så spørsmålet skal ikke spørre om noe tittelen eller kunstnernavnet i bildeteksten røper; tittelen vises først etter svaret.

| Type | Ekstra felt | Brukes til |
|---|---|---|
| `choice` | `answer`, `distractors` (nøyaktig 3) | Gjenkjenning. Alternativene skal være samme slags svar, like lange og troverdige, men entydig feil. |
| `text` | `answer` (1–4 ord), `accept` (alternative skrivemåter) | Fri gjenhenting av navn, begrep eller sted. Ta med vanlige stavevarianter og kortformer. |
| `year` | `answer` (f.eks. `"1814"`), valgfritt `tolerance` (antall år) | Årstall. Bruk `tolerance` når kildene sier «omkring». Før vår tidsregning: bruk `choice`. |
| `number` | `answer`, valgfritt `unit` og `tolerance` | Tall, f.eks. antall fylker eller prosent. |
| `order` | `items`: 3–5 `{ "label", "year" }` | Kronologi. Årstallene vises etter svaret. År før vår tidsregning skrives som negative tall og vises som «480 f.Kr.». |
| `match` | `pairs`: 3–4 `{ "left", "right" }` | Koble person–verk, land–hovedstad, begrep–forklaring. |
| `explain` | `answer` (modellsvar, 1–3 setninger), `checklist` (2–4 punkter) | Forklar med egne ord. Eleven vurderer seg selv mot sjekklisten. |

`explain` (forklaringen etter svaret) er obligatorisk for alle kort. Den skal lære bort noe nytt: en årsak, en følge eller en forbindelse til et annet emne – ikke gjenta svaret.

### Hint

Alle kort har et skrevet `hint`. Hintet er første hjelpetrinn: et faglig holdepunkt som gjør det lettere å hente fram svaret, uten å gi det bort. Eleven skal fortsatt måtte huske noe selv.

- Én setning, helst under 120 tegn (maks 160), som slutter med punktum.
- Gi en ledetråd fra sammenhengen: tid, sted, fagfelt, en kjent person eller hendelse i nærheten, ordets opprinnelse eller en huskeregel. «Han var dansk og arbeidet med atomets bygning.» – ikke «Han heter Niels.»
- Aldri svaret, et godtatt svar, samme ordstamme som svaret, årstallet selv eller et helt par fra en kobling. Validatoren stopper de tydeligste tilfellene.
- Ikke gjenta spørsmålet med andre ord, og ikke snevre inn til ett mulig svar.
- Flervalg: pek på hva som skiller det riktige alternativet («Tenk på hvem av dem som var lege.»).
- Årstall og tall: gi et holdepunkt i tid eller størrelse («Det var året etter at krigen sluttet.», «Tenk på antall fylker før reformen.»), ikke tiåret – det gir appen selv i neste trinn.
- Rekkefølge: hjelp med én forankring («Bare én av hendelsene skjedde før vår tidsregning.»).
- Kobling: hjelp med ett par uten å nevne begge sider.
- Forklaring: si hvilke sider svaret bør dekke («Tenk både på økonomien og på religionen.»).

Appen har et andre hjelpetrinn som lages automatisk: forbokstav og antall bokstaver for tekstsvar, århundre eller tiår for årstall, størrelsesorden for tall og ett alternativ fjernet for flervalg. Et svar med hint lagres som støttet, ikke som selvstendig.

## Kvalitetsregler

1. **Lær før du tester.** Svaret på et kort i steg 1 skal stå i leksjonen. Svaret på et senere kort skal stå i leksjonen, i `keyPoints` eller i forklaringen til et kort på et tidligere eller samme steg. Appen sørger for at et svar som nettopp er vist, først testes i en senere økt.
2. **Spørsmålet røper ikke svaret.** Ingen ord fra svaret i ledeteksten, heller ikke samme ordstamme («uavhengighetserklæringen» → «uavhengige»). En stamme som også står i et galt alternativ, er ingen ledetråd. Kontrollen fanger ikke alt: «landgangen i Normandie» røper «Frankrike» uten at noen ord er felles.
3. **Ett entydig svar.** Unngå spørsmål der flere svar er like riktige. Si «omtrent» når kildene gjør det.
4. **Betydning før detaljer.** Steg 1 og 2 skal handle om det en allmenndannet voksen bør vite.
5. **Usikkerhet skal fram.** Omstridte opplysninger (f.eks. rikssamlingens omfang) formuleres som det de er. Test ikke sagn som fakta.
6. **Klart, voksent bokmål.** Korte setninger. Ingen fyllfraser («Det gir et konkret holdepunkt …»), ingen utropstegn, ingen engelske stedsnavn når det finnes norske (Beograd, ikke Belgrade).
7. **Svarformen passer svaret.** Navn og årstall får korte felt; forklaringer får `explain`.
8. **Distraktorer lærer også.** Bruk ekte personer, steder og perioder fra samme felt. Ikke tull, ikke «alle de ovennevnte». Det riktige svaret skal ikke skille seg ut ved lengde eller form. De beste distraktorene er vanlige misforståelser (frigjøringserklæringen avskaffet *ikke* slaveriet i hele USA) og naboer i tid (krigen i 1812 for Lincoln). Forklaringen etter svaret sier gjerne hvorfor den nærmeste distraktoren er feil.
9. **Verdt å vite, ikke quiz.** Hvert kort skal kunne forsvares som noe en allmenndannet voksen har nytte av å vite. Kuriositeter, tilfeldige antall, rekordtall og perifere navn hører ikke hjemme i steg 1–3, og sjelden i steg 4. Still spørsmålet slik en god lærer ville gjort: med nok sammenheng til at det gir mening og eleven skjønner hva slags svar som ventes, uten gåteform, «Hvilket av følgende» eller formuleringer kopiert fra leksjonen. Foretrekk hva noe er, hvorfor det skjedde og hva det førte til framfor isolerte fakta. Ankerne som bærer kunnskapen (1814, 1905, Ibsen, fotosyntese) er ikke trivia og skal testes skarpt. Alle punktene i `keyPoints` skal testes av minst ett kort, og to kort skal ikke teste det samme.
10. **Faste ID-er.** ID-er endres aldri etter publisering, fordi læringshistorikken følger dem. Endres betydningen av et kort vesentlig, får det ny ID.

## Kontroll

Reglene for flervalg (`choiceProblems` og `answerLeaks` i `src/lib/core-curriculum.js`) gjelder alt flervalg, også de håndskrevne introduksjonene i `src/lib/foundations.js`. En test stopper en introduksjon som bryter dem. Ordstammekontrollen gir advarsler, ikke feil: den finner også ord som er felles uten å røpe noe, så hver advarsel må vurderes.

```
node scripts/validate-core.mjs                 # alle fagområder, med feil og advarsler
node scripts/validate-core.mjs norgeshistorie  # ett fagområde
```

Feil stopper bygget. Advarsler (for eksempel «svaret ser ikke ut til å være undervist før det testes») skal vurderes av en person.
