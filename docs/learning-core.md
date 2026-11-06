# Læringskjernen – modell og beslutninger (1.0.0)

## Hvorfor kjernen ble bygd på nytt

En gjennomgang av appen i november 2026 viste at kunnskapen manglet der eleven trenger den mest:

- 808 spørsmål, men 90 % var eksakte detaljer (tiltredelsesår, FNs delregioner, prisår). Bare 26 spørsmål var egnet for en nybegynner.
- Historie hadde seks hendelser, kunst fem bilder. Norgeshistorie, naturvitenskapelige begreper, samfunn og musikk manglet.
- Dagens quiz var et filter over samlinger. Ingenting bygde fra grunnlag til dybde, og ingen emner ble «ferdige».
- Innledningen viste svaret rett før spørsmålet, slik at eleven kopierte i stedet for å hente fram.
- Riktig svaralternativ sto nesten alltid først eller sist, fordi stokkingen brukte en svak hash.
- «Hvorfor»-spørsmål hadde et kort enlinjefelt, og engelske stedsnavn (Belgrade) ble brukt i en norsk app.

Registrene (Nobelpriser, kommuner, land) er beholdt som oppslagsverk og fri quiz. Læringskjernen er det nye pensumet som dagens økt bygger på.

## Modell

```
fagområde → emne → kort (steg 1–4)
```

- **Fagområde**: Norgeshistorie, verdenshistorie, det moderne århundret, geografi, naturvitenskap, liv/kropp/miljø, samfunn, kunst/musikk og litteratur/språk.
- **Emne**: en kort innføring («Kort fortalt»), 3–5 punkter som skal sitte, kilder og 10–14 kort. Emner har forkunnskaper som kan krysse fagområder (Norge under andre verdenskrig bygger på Andre verdenskrig).
- **Steg**: 1 Oversikt (gjenkjenne det store bildet), 2 Kjerne (hente fram navn og begreper), 3 Sammenheng (årsak, følge, rekkefølge, forklaring), 4 Detalj (årstall og tall).

Innholdet skrives i `knowledge-build/core/*.json` etter reglene i [curriculum-authoring.md](curriculum-authoring.md), kontrolleres av `scripts/validate-core.mjs` og kompileres inn i kunnskapspakken av `scripts/build-core.mjs`. Hvert kort blir et øvelsesmål med fast ID `core:<kort-id>` og en egen påstand `fact:core:<kort-id>`, slik at læringshistorikken følger kortet.

## Progresjon

| Status | Betingelse |
|---|---|
| Ikke startet | Ingen kort besvart. |
| Påbegynt | Minst ett kort besvart. |
| Lært – repeteres | Kortene i steg 1–2 er besvart, minst 70 % riktig, men ennå ikke hentet fram en senere dag. |
| Grunnlaget sitter | Alle kort i steg 1–2 besvart, minst 70 % riktig uten hjelp sist, og minst halvparten husket riktig også ved en senere repetisjon. Låser opp emner som bygger på dette. |
| Gjennomført | Grunnlaget sitter, alle kort er besvart og minst 80 % var riktige uten hjelp sist. |
| Sitter godt | Gjennomført, og alle kort har FSRS-stabilitet på minst 21 dager. |

Svar rett etter innføringen viser lite om hva som huskes. Derfor krever «Grunnlaget sitter» at stoffet også er hentet fram en annen dag. Forkunnskaper styrer bare anbefalingene. Eleven kan alltid åpne og begynne på et hvilket som helst emne.

## Dagens økt

1. Repetisjoner som er klare (FSRS), også fra registrene eleven har øvd på, kommer først. Omtrent 40 % av økten holdes av til nytt stoff.
2. Nye kort hentes fra påbegynte emner, deretter fra anbefalte emner som veksler mellom fagområder. En ny elev møter derfor to fag i første økt.
3. Et nytt emne åpner med innføringen som eget steg. Spørsmålene om emnet kommer senere i økten, mellom andre kort, så eleven må hente fram i stedet for å kopiere.
4. Et kort tas aldri før kortene i tidligere steg i samme emne er prøvd.
5. Hvis forklaringen til et kort i økten nevner svaret på et annet kort, venter det andre kortet til en senere økt. Det gir avstand mellom læring og prøving.
6. Feil eller støttede svar kommer tilbake inntil to ganger mot slutten av økten uten å flytte langtidsplanen.

Øktlengde og andel nytt stoff velges under Emner → Tilpass økten.

## Svar og vurdering

- Flervalg stokkes jevnt. Riktig alternativ er like ofte på hver plass.
- Tekstsvar godtar dokumenterte varianter, små skrivefeil i lengre navn (én feil fra 5 tegn, to fra 10, samme forbokstav) og etternavn alene når spørsmålet gjelder en person. Korte svar må være eksakte. Et annet kjent navn godtas aldri som skrivefeil (Irland for Island, Zambia for Gambia).
- Autokorrektur er slått av for korte svar på iPhone, slik at navn ikke byttes ut med engelske ord.
- Årstall og tall kan ha en dokumentert toleranse når kildene sier «omkring».
- Eleven kan godkjenne et tekstsvar selv når appen ikke kjente igjen en riktig formulering. Knappen heter «Godkjenn svaret mitt» og er skrevet som en handling: «Svaret mitt var riktig» ble lest som om appen skrøt av sitt eget svar. En egengodkjenning lagres med `assessment: 'self'`, `selfApproved` og det skrevne svaret, kan angres før neste spørsmål, teller som riktig, men gir aldri vurderingen «Satt lett». Deg → Fremgang viser hvor mange svar som er godkjent slik, og tilbakemeldinger tar med de siste 20, slik at formuleringer som burde godtas kan legges inn i kortene. Det kan ikke hindre juks, og skal ikke: det er bare egen læring som går tapt. Målet er at statistikken forteller sannheten.
- Hint kommer i trinn. «Hint» viser først kortets skrevne ledetråd, et holdepunkt fra sammenhengen som ikke gir bort svaret. «Mer hjelp» viser deretter et trinn som lages av svarets form: antall tegn eller ord og forbokstav for navn, tiåret (eller århundret når kortet har toleranse) for årstall, størrelsesorden for tall og ett galt alternativ strøket ut for flervalg. Rekkefølge, kobling og forklaring har bare den skrevne ledetråden; kartoppgaver har ingen hint. Før dette fantes ingen skrevne hint, og «Hint» viste bare forbokstaven, også for årstall der det ikke hjelper. Ethvert hint gjør svaret støttet, ikke selvstendig, og hvor langt eleven gikk lagres som `hintLevel`.
- Forklaringskort vurderes mot sjekklisten: alt med gir «riktig», noe gir «delvis».
- Etter et riktig svar holder ett trykk på «Neste». «Var usikker» og «Satt lett» justerer intervallet for dem som vil.

## Navneformer

`knowledge-build/corrections.json` retter registerets stedsnavn til norske former etter Store norske leksikon (Beograd, București, Teheran …). Den gamle formen godtas fortsatt som svar.

## Kontroller

- `node scripts/validate-core.mjs` – struktur, svar i spørsmålet, distraktorer, svarformer og om svaret er undervist før det testes.
- `tests/progression.test.mjs` – status, opplåsing, øktsammensetning, avstand etter innføring og vurdering.
- Faktainnholdet er skrevet fra kildene i hvert emne og deretter gjennomgått i egne runder for historie, naturfag, geografi/samfunn og kunst/litteratur, fulgt av språkvask. Rundene rettet rundt hundre feil og hull, blant annet årstall, foreldede formuleringer og svar som ble testet før de var undervist. Strukturkontroll erstatter ikke faglig kontroll.

## Omfang i 1.0.0

84 emner og 1093 kort: 300 oversikt, 333 kjerne, 264 sammenheng og 196 detalj. Kortformene er 500 flervalg, 302 korte tekstsvar, 132 årstall og tall, 84 forklaringer, 38 koblinger og 37 rekkefølger. `docs/core-report.json` viser fordelingen per emne.

## Kart

Emnene om verdensdeler og Norge kobles til kartøving. Kartet bruker de 176 landene i kartpakken med norske navn fra registeret; land som er for små til å treffes med en finger på telefonen, er utelatt.
