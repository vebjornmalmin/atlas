import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { validatePackage } from './validate-knowledge.mjs';

// Kuraterte fakta kontrolleres mot verkene selv, ikke katalogenes sammendrag.
const works = [
  ['alice-in-wonderland','Alice i Eventyrland','lewis-carroll','Lewis Carroll',11,'alice-fictional','Alice','Alice','en jente som følger en kanin ned i et hull','Hvilket dyr følger Alice før hun havner i Eventyrland?','En kanin',['kanin','hvit kanin','Den hvite kaninen'],'White Rabbit'],
  ['through-the-looking-glass','Gjennom speilet','lewis-carroll','Lewis Carroll',12,'alice-fictional','Alice','Alice','en jente som går gjennom et speil til en annen verden','Hvilket brettspill gir verdenen i Gjennom speilet en sentral struktur?','Sjakk',['sjakkspill'],'chess'],
  ['dracula','Dracula','bram-stoker','Bram Stoker',345,'jonathan-harker','Jonathan Harker','Jonathan Harker','en engelsk jurist som reiser til grev Draculas slott','I hvilket område ligger grevens slott i begynnelsen av Dracula?','Transilvania',['Transylvania'],'Transylvania'],
  ['frankenstein','Frankenstein','mary-shelley','Mary Shelley',84,'victor-frankenstein','Victor Frankenstein','Victor','en student som skaper et levende vesen og frykter resultatet','Hva heter skaperen av vesenet i Frankenstein?','Victor Frankenstein',['Viktor Frankenstein'],'Frankenstein'],
  ['pride-and-prejudice','Stolthet og fordom','jane-austen','Jane Austen',1342,'elizabeth-bennet','Elizabeth Bennet','Elizabeth Bennet','en kvinne som vurderer ekteskap, klasse og førsteinntrykk','Hva heter mannen Elizabeth Bennet til slutt gifter seg med i Stolthet og fordom?','Fitzwilliam Darcy',['Darcy','Mr Darcy','Mr. Darcy'],'Darcy'],
  ['sense-and-sensibility','Fornuft og følelse','jane-austen','Jane Austen',161,'elinor-dashwood','Elinor Dashwood','Elinor','en av to søstre med ulike måter å håndtere følelsene sine på','Hva heter Elinors søster, som står sentralt i Fornuft og følelse?','Marianne Dashwood',['Marianne'],'Marianne'],
  ['emma','Emma','jane-austen','Jane Austen',158,'emma-woodhouse','Emma Woodhouse','Emma Woodhouse','en kvinne som prøver å styre andre menneskers kjærlighetsliv','Hvilken rolle tar Emma Woodhouse gjerne på seg i romanen Emma?','Ekteskapsformidler',['matchmaker','ekteskapsmegler','koblerske','kobler'],'match'],
  ['persuasion','Overtalelse','jane-austen','Jane Austen',105,'anne-elliot','Anne Elliot','Anne Elliot','en kvinne som møter igjen mannen hun tidligere avviste','Hva heter sjøoffiseren Anne Elliot møter igjen i Overtalelse?','Frederick Wentworth',['Wentworth','Kaptein Wentworth'],'Wentworth'],
  ['moby-dick','Moby Dick','herman-melville','Herman Melville',2701,'ahab-fictional','Kaptein Ahab','Ahab','en kaptein som lar jakten på en hvit hval dominere reisen','Hva heter skipet kaptein Ahab fører i Moby Dick?','Pequod',['The Pequod'],'Pequod'],
  ['a-tale-of-two-cities','To byer','charles-dickens','Charles Dickens',98,'sydney-carton','Sydney Carton','Sydney Carton','en advokat hvis skjebne knyttes til revolusjon og et personlig offer','Hvilke to byer er de viktigste stedene i To byer?','London og Paris',['Paris og London'],'London'],
  ['great-expectations','Store forventninger','charles-dickens','Charles Dickens',1400,'pip-fictional','Pip','Pip','en gutt som ønsker å bli gentleman og får en ukjent velgjører','Hvem viser seg å være Pips velgjører i Store forventninger?','Abel Magwitch',['Magwitch'],'Magwitch'],
  ['a-christmas-carol','En julefortelling','charles-dickens','Charles Dickens',46,'ebenezer-scrooge','Ebenezer Scrooge','Scrooge','en gjerrig mann som blir konfrontert med fortid, nåtid og framtid','Hva heter den døde forretningspartneren som først besøker Scrooge i En julefortelling?','Jacob Marley',['Marley'],'Marley'],
  ['david-copperfield','David Copperfield','charles-dickens','Charles Dickens',766,'david-copperfield-fictional','David Copperfield (romanfigur)','David Copperfield','en forteller som ser tilbake på barndom og voksenliv','Hvilket yrke får romanfiguren David Copperfield etter hvert?','Forfatter',['skribent'],'author'],
  ['oliver-twist','Oliver Twist','charles-dickens','Charles Dickens',730,'oliver-twist-fictional','Oliver Twist (romanfigur)','Oliver','en foreldreløs gutt som flykter fra fattighuset og møter en tyvegjeng','Hva heter mannen som leder tyvegjengen i Oliver Twist?','Fagin',[],'Fagin'],
  ['jane-eyre','Jane Eyre','charlotte-bronte','Charlotte Brontë',1260,'jane-eyre-fictional','Jane Eyre (romanfigur)','Jane Eyre','en kvinne som arbeider i et stort hus og møter dets hemmeligheter','Hvilket arbeid har Jane Eyre hos familien på Thornfield?','Guvernante',['privatlærer','guvernante for Adèle'],'governess'],
  ['wuthering-heights','Stormfulle høyder','emily-bronte','Emily Brontë',768,'heathcliff','Heathcliff','Heathcliff','en mann hvis forhold til Catherine påvirker flere generasjoner','Hva heter kvinnen som står sentralt i Heathcliffs forhold i Stormfulle høyder?','Catherine Earnshaw',['Catherine'],'Catherine'],
  ['the-picture-of-dorian-gray','Bildet av Dorian Gray','oscar-wilde','Oscar Wilde',174,'dorian-gray-fictional','Dorian Gray','Dorian Gray','en ung mann som beholder utseendet mens et bilde forandres','Hva er det som eldes og forandres i stedet for Dorian Gray?','Portrettet',['et portrett','bildet','hans portrett'],'portrait'],
  ['the-importance-of-being-earnest','Hvem er Ernest?','oscar-wilde','Oscar Wilde',844,'jack-worthing','Jack Worthing','Worthing','en mann som bruker ulike navn i byen og på landet','Hvilket navn bruker Jack i London i Hvem er Ernest?','Ernest',[],'Ernest'],
  ['macbeth','Macbeth','william-shakespeare','William Shakespeare',1533,'macbeth-fictional','Macbeth (rollefigur)','Macbeth','en skotsk adelsmann som lar en profeti vekke maktbegjær','Hvilken konge blir drept i Macbeths slott?','Duncan',['Kong Duncan'],'Duncan'],
  ['hamlet','Hamlet','william-shakespeare','William Shakespeare',1524,'hamlet-fictional','Hamlet (rollefigur)','Hamlet','en prins som undersøker sin fars død','I hvilket land foregår Hamlet?','Danmark',['Denmark'],'Denmark'],
  ['romeo-and-juliet','Romeo og Julie','william-shakespeare','William Shakespeare',1513,'juliet-fictional','Julie Capulet','Juliet','en ung kvinne i en familiefeide som hindrer et kjærlighetsforhold','I hvilken by foregår Romeo og Julie?','Verona',[],'Verona'],
  ['othello','Othello','william-shakespeare','William Shakespeare',1531,'iago-fictional','Iago','Iago','en offiser som manipulerer Othello gjennom mistanke og løgner','Hva heter Othellos kone?','Desdemona',[],'Desdemona'],
  ['a-midsummer-night-s-dream','En midtsommernattsdrøm','william-shakespeare','William Shakespeare',1514,'puck-fictional','Puck','Puck','en ånd som skaper forviklinger mellom elskende','Hva heter alvenes dronning i En midtsommernattsdrøm?','Titania',[],'Titania'],
  ['the-tempest','Stormen','william-shakespeare','William Shakespeare',1540,'prospero-fictional','Prospero','Prospero','en avsatt hertug som styrer hendelser på en øy','Hva heter Prosperos datter i Stormen?','Miranda',[],'Miranda'],
  ['the-adventures-of-sherlock-holmes','Sherlock Holmes: eventyr','arthur-conan-doyle','Arthur Conan Doyle',1661,'sherlock-holmes','Sherlock Holmes','Sherlock Holmes','en detektiv som trekker slutninger fra små spor','Hvilken lege forteller om Holmes i Sherlock Holmes-fortellingene?','John Watson',['Dr Watson','Watson','Doktor Watson','Dr. Watson'],'Watson'],
  ['the-hound-of-the-baskervilles','Hunden fra Baskerville','arthur-conan-doyle','Arthur Conan Doyle',2852,'henry-baskerville','Henry Baskerville','Henry','en arving som må forholde seg til en fryktet familielegende','Hvilken detektiv undersøker mysteriet i Hunden fra Baskerville?','Sherlock Holmes',['Holmes'],'Holmes'],
  ['treasure-island','Skatten på sjørøverøya','robert-louis-stevenson','Robert Louis Stevenson',120,'jim-hawkins','Jim Hawkins','Jim','en ung gutt som følger et kart til en nedgravd skatt','Hva heter den enbeinte skipskokken i Skatten på sjørøverøya?','Long John Silver',['John Silver','Silver'],'Silver'],
  ['jekyll-and-hyde','Dr. Jekyll og Mr. Hyde','robert-louis-stevenson','Robert Louis Stevenson',43,'henry-jekyll','Henry Jekyll','Jekyll','en lege som skaper en annen side av seg selv gjennom et eksperiment','Hva heter Jekylls andre identitet?','Edward Hyde',['Mr Hyde','Hyde','Mr. Hyde'],'Hyde'],
  ['the-odyssey','Odysseen','homer','Homer',1727,'odysseus-fictional','Odyssevs','Ulysses','en helt som møter mange hindringer på hjemreisen fra krigen','Hva heter hjemøya til Odyssevs i Odysseen?','Ithaka',['Ithaca'],'Ithaca'],
  ['the-iliad','Iliaden','homer','Homer',6130,'achilles-fictional','Akilles','Achilles','en kriger hvis vrede setter preg på fortellingen om en beleiring','Hvilken by er beleiret i Iliaden?','Troja',['Troy','Ilion'],'Troy'],
  ['the-count-of-monte-cristo','Greven av Monte Cristo','alexandre-dumas','Alexandre Dumas',1184,'edmond-dantes','Edmond Dantès','Dantès','en sjømann som blir fengslet og senere planlegger hevn','Hva heter fangeøya og festningen der Edmond Dantès sitter fengslet?','Château d’If',["Chateau d'If",'Chateau dIf','If'],'If'],
  ['the-three-musketeers','De tre musketerer','alexandre-dumas','Alexandre Dumas',1257,'d-artagnan-fictional','d’Artagnan',"d’Artagnan",'en ung mann som slutter seg til tre musketerer','Hva heter de tre musketerene som blir d’Artagnans venner?','Athos, Porthos og Aramis',['Athos Porthos Aramis','Athos og Porthos og Aramis'],'Porthos'],
  ['crime-and-punishment','Forbrytelse og straff','fyodor-dostoevsky','Fjodor Dostojevskij',2554,'rodion-raskolnikov','Rodion Raskolnikov','Raskolnikov','en student som prøver å rettferdiggjøre drap og plages av skyld','I hvilken by foregår hovedhandlingen i Forbrytelse og straff?','St. Petersburg',['St Petersburg','Sankt Petersburg','Saint Petersburg','Petersburg'],'Petersburg'],
  ['war-and-peace','Krig og fred','leo-tolstoy','Lev Tolstoj',2600,'pierre-bezukhov','Pierre Bezukhov','Pierre','en arving hvis liv berøres av krig og søken etter mening','Hvilken fransk leder står sentralt i krigene som skildres i Krig og fred?','Napoleon Bonaparte',['Napoleon'],'Napoleon'],
  ['huckleberry-finn','Huckleberry Finn','mark-twain','Mark Twain',76,'huckleberry-finn-fictional','Huckleberry Finn (romanfigur)','Huckleberry','en gutt som reiser på en flåte med Jim','Hvilken elv er sentral i Huckleberry Finns flåtereise?','Mississippi',['Mississippielva','Mississippi-elva'],'Mississippi'],
  ['tom-sawyer','Tom Sawyer','mark-twain','Mark Twain',74,'tom-sawyer-fictional','Tom Sawyer (romanfigur)','Tom Sawyer','en gutt som gjør et arbeid andre ikke vil gjøre, til noe attraktivt','Hvilket arbeid får Tom andre gutter til å gjøre for ham i begynnelsen av Tom Sawyer?','Male et gjerde',['male gjerdet','hvitmale et gjerde','male stakittgjerdet'],'whitewash'],
  ['gullivers-travels','Gullivers reiser','jonathan-swift','Jonathan Swift',829,'lemuel-gulliver','Lemuel Gulliver','Gulliver','en reisende som møter samfunn med helt andre størrelsesforhold','Hva heter landet der Gulliver først møter svært små mennesker?','Lilliput',['Lilleputt','Lilleputtland'],'Lilliput'],
  ['a-modest-proposal','Et beskjedent forslag','jonathan-swift','Jonathan Swift',1080,'satire','Satire','children','et essay som bruker et grotesk forslag til å kritisere behandlingen av fattige','Hvilket land gjelder det groteske forslaget i Swifts Et beskjedent forslag?','Irland',['Ireland'],'Ireland'],
  ['uncle-toms-cabin','Onkel Toms hytte','harriet-beecher-stowe','Harriet Beecher Stowe',203,'uncle-tom-fictional','Onkel Tom','Tom','en mann hvis skjebne skildrer konsekvensene av slaveriet','Hvilket samfunnssystem står sentralt i Onkel Toms hytte?','Slaveri',['slaveriet'],'slave'],
  ['a-dolls-house','Et dukkehjem','henrik-ibsen','Henrik Ibsen',2542,'nora-helmer','Nora Helmer','Nora','en kvinne som utfordrer rollene hun har fått i ekteskapet','Hva heter Noras ektemann i Et dukkehjem?','Torvald Helmer',['Helmer','Torvald'],'Helmer'],
  ['hedda-gabler','Hedda Gabler','henrik-ibsen','Henrik Ibsen',4093,'hedda-gabler-fictional','Hedda Gabler (rollefigur)','Hedda','en kvinne som prøver å styre andre og reagerer på sine livsvilkår','Hva heter Heddas ektemann i Hedda Gabler?','Jørgen Tesman',['George Tesman','Tesman'],'Tesman'],
  ['an-enemy-of-the-people','En folkefiende','henrik-ibsen','Henrik Ibsen',2446,'thomas-stockmann','Thomas Stockmann','Stockmann','en lege som oppdager at byens viktige helsetilbud er forurenset','Hva er forurenset i En folkefiende, ifølge doktor Stockmann?','Vannet i badeanstalten',['badevannet','vannet','badet','vannforsyningen'],'water'],
];
const genres = {
  novel: ['Roman','En lengre fortelling i prosa.'],
  play: ['Skuespill','Et verk skrevet med roller og replikker for framføring.'],
  epic: ['Epos','En lengre fortelling på vers om helter og store begivenheter.'],
  collection: ['Novellesamling','Flere selvstendige korte fortellinger samlet i ett verk.'],
  essay: ['Essay','En resonnerende tekst som utforsker et emne.'],
  novella: ['Kortroman','En fortelling i prosa med mindre omfang enn en lang roman.'],
};
const contextualNotes = {
  11:['Fortellingen lar dagligdagse regler for språk og logikk møte en fantasiverden.','Alice følger den hvite kaninen før hun faller ned i hullet. Dyret setter den første reisen i gang.'],
  12:['En kjent hovedfigur møter en verden som endrer reglene for bevegelse og identitet.','Sjakkbrettet gir reisen struktur: Alice går gjennom landskapet som en bonde på vei mot å bli dronning.'],
  345:['En tilreisende prøver å forstå farene hos verten sin; flere stemmer forteller historien.','Harkers besøk på slottet i Transilvania innleder fortellingen. Brev, dagbøker og andre dokumenter bygger opp mysteriet.'],
  84:['Fortellingen undersøker ansvar for et eksperiment og konsekvensene for andre.','Victor Frankenstein skaper vesenet. Frankenstein er dermed navnet på skaperen, mens vesenet ikke får det samme personnavnet i teksten.'],
  1342:['Førsteinntrykk, økonomi og sosial rang påvirker hvordan personene vurderer hverandre.','Elizabeth gifter seg med Darcy etter at både fordommer og feilbedømmelser blir utfordret.'],
  161:['To søstre reagerer forskjellig når kjærlighet og økonomiske hensyn kolliderer.','Elinor og Marianne Dashwood er søstre. Deres ulike reaksjoner bærer mye av kontrasten mellom fornuft og følelse.'],
  158:['Hovedfiguren tror hun forstår andre bedre enn hun faktisk gjør.','Emma forsøker å koble andre i ekteskap. Feilbedømmelsene hennes gjør arbeidet som ekteskapsformidler til en kilde til forviklinger.'],
  105:['Et tidligere valg får ny betydning når to mennesker møtes igjen.','Anne møter igjen kaptein Frederick Wentworth. Deres tidligere forhold setter spørsmål om råd, valg og andre sjanser i sentrum.'],
  2701:['Reisen setter besettelse og fare opp mot fellesskapet om bord.','Pequod er hvalfangstskipet Ahab fører. Hans private hevnprosjekt former etter hvert hele skipets skjebne.'],
  98:['Personlige skjebner møter vold og politiske omveltninger under den franske revolusjonen.','London og Paris er de to byene i tittelen. Handlingen forbinder engelske liv med den franske revolusjonen.'],
  1400:['Hovedfiguren setter sosial framgang høyt og feiltolker hvem som hjelper ham.','Den rømte straffangen Magwitch er Pips velgjører. Avsløringen utfordrer Pips antakelser om respektabilitet og sosial rang.'],
  46:['En mann må møte følgene av et liv dominert av penger og avstand til andre.','Jacob Marley, Scrooges avdøde partner, kommer før de tre juleåndene og advarer ham om livsførselen hans.'],
  766:['Et menneske forteller sin egen livshistorie og ser tilbake på det som formet ham.','David blir forfatter. Det forbinder hans yrke med romanens form: han forteller selv sin livshistorie.'],
  730:['Et barns sårbarhet viser hvordan fattigdom og kriminalitet kan henge sammen.','Fagin leder gruppen som lærer gutter å stjele. Oliver møter gruppen etter at han flykter fra fattighuset.'],
  1260:['Fortelleren søker både selvstendighet og tilhørighet i et samfunn med tydelige klasseskiller.','Jane arbeider som guvernante for Adèle på Thornfield. Arbeidet gir henne adgang til huset, men ingen likestilt sosial posisjon der.'],
  768:['Konflikter og kjærlighet får konsekvenser som strekker seg over flere generasjoner.','Forholdet mellom Heathcliff og Catherine Earnshaw former mange av konfliktene og ettervirkningene i romanen.'],
  174:['Et ønske om å bevare ungdommen får konsekvenser for forholdet mellom ytre og indre liv.','Portrettet bærer sporene etter alder og handlinger mens Dorian beholder sitt unge utseende. Det skaper romanens sentrale skille mellom fasade og følger.'],
  844:['En komedie bruker dobbeltliv og misforståelser til å utfordre forventninger om respektabilitet.','Jack kaller seg Ernest i London. Navnet bidrar til misforståelser og knytter komediens handling til tittelen.'],
  1533:['Profetier, ambisjon og skyld driver en maktkamp framover.','Macbeth dreper kong Duncan mens kongen er gjest i slottet. Handlingen gjør lojalitet og gjestfrihet til svik.'],
  1524:['Et dødsfall ved hoffet fører til tvil om hvem man kan stole på.','Hamlet er prins av Danmark. Hoffet og maktkampen er lagt til dette riket, selv om skuespillet er skrevet av en engelsk forfatter.'],
  1513:['To unge menneskers forhold kolliderer med en vedvarende familiefeide.','Verona er byen der familiene Montague og Capulet ligger i konflikt. Familienes fiendskap rammer Romeo og Julie.'],
  1531:['Manipulasjon gjør mistanke sterkere enn kunnskap i et ekteskap.','Desdemona er Othellos kone. Iago utnytter forholdet ved å få Othello til å mistolke hennes handlinger.'],
  1514:['Et skogsmiljø lar menneskelige og overnaturlige konflikter gripe inn i hverandre.','Titania er alvenes dronning og Oberons partner. Konflikten mellom dem er en del av forviklingene i skogen.'],
  1540:['En familie i eksil får mulighet til å konfrontere dem som tok makten fra den.','Miranda er Prosperos datter. Hun vokser opp på øya der Prospero lever etter å ha blitt avsatt.'],
  1661:['Detektivens slutninger blir formidlet av en nær venn og observatør.','Doktor Watson forteller om Holmes i disse fortellingene. Leseren følger ofte undersøkelsen gjennom Watsons begrensede kunnskap.'],
  2852:['En gammel legende må undersøkes med observasjoner og spor.','Sherlock Holmes undersøker Baskerville-mysteriet sammen med Watson. Fortellingen setter en tilsynelatende overnaturlig trussel opp mot detektivarbeid.'],
  120:['Et skattejaktoppdrag blir farlig når lojaliteten om bord er usikker.','Long John Silver er den enbeinte skipskokken. Jim må etter hvert vurdere ham som både hjelper og farlig motstander.'],
  43:['Et eksperiment setter spørsmålet om en persons identitet på spissen.','Edward Hyde er Jekylls andre identitet. Avsløringen knytter de to skikkelsene til ett menneske, framfor to uavhengige personer.'],
  1727:['En lang hjemreise handler også om hvem som venter på den reisende.','Ithaka er Odyssevs hjemøy. Reisen mot den knytter eventyrene til Penelope, Telemakhos og gjenopprettelsen av hjemmet.'],
  6130:['Et heltedikt viser vrede og konflikter i en beleiringskrig.','Troja er den beleirede byen. Iliaden skildrer en avgrenset del av krigen, ikke hele historien om byens fall.'],
  1184:['Et justismord setter i gang en lang historie om fangenskap og hevn.','Château d’If er fengselet der Edmond Dantès blir holdt. Fangenskapet er avgjørende for hvordan han senere blir greven av Monte Cristo.'],
  1257:['En nykommer finner venner i et miljø preget av politiske intriger.','Athos, Porthos og Aramis er de tre musketerene. d’Artagnan blir deres venn, men er ikke selv en av de tre navnene tittelen viser til.'],
  2554:['Et drap og en teori om hvem som kan sette seg over loven blir fulgt av skyld og frykt.','Handlingen foregår i St. Petersburg. Raskolnikovs fattigdom, møter og flukt fra mistanke er forankret i bymiljøet.'],
  2600:['Privatliv og store felttog blir fortalt som deler av samme historiske erfaring.','Napoleon står sentralt i de franske felttogene som berører de russiske familiene i romanen. En historisk person inngår her i et litterært verk.'],
  76:['En reise lar to mennesker forsøke å unnslippe forventningene og lovene rundt dem.','Mississippi er elva Huck og Jim reiser på. Flåten gir dem et midlertidig rom utenfor samfunnene langs bredden.'],
  74:['En hverdagslig oppgave blir et eksempel på hvordan lyst og status kan snus.','Tom får andre til å hvitmale gjerdet ved å framstille oppgaven som noe spesielt og ettertraktet.'],
  829:['En reiseskildring snur størrelsesforholdene og lar vante skikker virke merkelige.','I Lilliput møter Gulliver svært små mennesker. Forskjellen i størrelse blir også et grep for å se konflikter og makt utenfra.'],
  1080:['En tilsynelatende økonomisk argumentasjon bruker et grotesk forslag som virkemiddel.','Essayet gjelder de fattige i Irland. Forslaget om barn som mat er satirisk og skal ikke leses som et praktisk råd fra forfatteren.'],
  203:['Et menneskes liv blir brukt til å vise konsekvensene av å bli behandlet som eiendom.','Slaveriet former Toms og flere andre figurers liv. Romanen undersøker systemets konsekvenser gjennom personer og familier.'],
  2542:['Ekteskap, gjeld og selvstendighet står i konflikt i et borgerlig hjem.','Torvald Helmer er Noras ektemann. Det blir avgjørende hvordan han reagerer når hennes skjulte handling kommer fram.'],
  4093:['Et nytt ekteskap og gamle bekjentskaper setter personlige valg under press.','Hedda er gift med Jørgen Tesman. Den engelske utgaven gjengir fornavnet hans som George.'],
  2446:['En varsler kommer i konflikt med dem som frykter de økonomiske følgene av sannheten.','Doktor Stockmann finner at vannet ved badeanstalten er forurenset. Byens økonomiske interesser gjør funnet til en politisk konflikt.'],
};
const plays = new Set([844,1533,1524,1513,1531,1514,1540,2542,4093,2446]);
const contextAnswerTypes={11:'animal',12:'game',345:'region',84:'person',1342:'person',161:'person',158:'profession',105:'person',2701:'ship',98:'city-list',1400:'person',46:'person',766:'profession',730:'person',1260:'profession',768:'person',174:'object',844:'person-name',1533:'person',1524:'country',1513:'city',1531:'person',1514:'person',1540:'person',1661:'person',2852:'person',120:'person',43:'person',1727:'island',6130:'city',1184:'place',1257:'person-list',2554:'city',2600:'person',76:'river',74:'activity',829:'fictional-place',1080:'country',203:'concept',2542:'person',4093:'person',2446:'substance'};
const baseline = JSON.parse(await readFile(new URL('../knowledge-build/base-foundation.json',import.meta.url),'utf8'));
const destination = new URL('../knowledge-build/culture-history.json',import.meta.url);
let prior = {};
try { prior = JSON.parse(await readFile(destination,'utf8')); } catch {}
const verify = process.argv.includes('--verify');
const patch = { collections:[],entities:[],relationships:[],targets:[],sources:[],timelines:[], snapshot: { retrievedAt: verify?new Date().toISOString():prior.snapshot?.retrievedAt || new Date().toISOString(), texts: prior.snapshot?.texts || [] } };
const entities = new Map();
const known = new Map(baseline.entities.map(e=>[`${e.type}:${e.label.toLowerCase()}`,e]));
const slug = s=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const source = (id,title,url)=> { if(!patch.sources.some(s=>s.id===id))patch.sources.push({id,title,url,license:'Kun faktiske opplysninger og egne sammendrag. Tekstutgavene lenkes; ingen fulltekst eller illustrasjoner publiseres.',retrievedAt:patch.snapshot.retrievedAt});return id; };
function entity(id,label,type,summary,collections,sourceId) {
  const existing = baseline.entities.find(e=>e.id===id) || known.get(`${type}:${label.toLowerCase()}`);
  id = existing?.id || id;
  if (!entities.has(id)) entities.set(id,{id,label:existing?.label||label,type:existing?.type||type,summary,collectionIds:[...new Set([...(existing?.collectionIds||[]),...collections])],sourceIds:[sourceId]});
  else { const e=entities.get(id);e.sourceIds=[...new Set([...e.sourceIds,sourceId])];e.collectionIds=[...new Set([...e.collectionIds,...collections])]; }
  return id;
}
function relation(from,to,type,context,sourceIds,year) { const id=`culture-${from}-${type}-${to}`;if(!patch.relationships.some(r=>r.id===id))patch.relationships.push({id,from,to,type,context,sourceIds,...(year===undefined?{}:{year})}); }
function target(id,entityId,collectionIds,prompt,answer,acceptedAnswers,explanation,sourceIds,context,followUp,kind='connections',extra={}) {
  if (baseline.targets.some(t=>t.prompt.toLowerCase()===prompt.toLowerCase()))return;
  patch.targets.push({id,entityId,collectionIds,prompt,answer,acceptedAnswers,explanation,sourceIds,context,followUp,kind,difficulty:3,significance:3,answerType:id.startsWith('culture-author-')?'person':id.startsWith('culture-work-')?'literary-work':'context-text',...extra});
}
for (const row of works) {
  const [wid,title,aid,author,pg,cid,character,marker,role,prompt,answer,aliases,evidence] = row;
  const url=`https://www.gutenberg.org/cache/epub/${pg}/pg${pg}.txt`;
  if (verify) {
    const response=await fetch(url);if(!response.ok)throw new Error(`${pg}: HTTP ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());const text=bytes.toString('utf8');
    if(!text.toLowerCase().includes(marker.toLowerCase())||!text.toLowerCase().includes(evidence.toLowerCase()))throw new Error(`${pg}: tekstbelegg mangler (${marker}, ${evidence})`);
    const header=text.slice(0,text.indexOf('*** START'));
    if(!header.includes('Author:'))throw new Error(`${pg}: mangler forfattermetadata`);
    const snapshot={id:pg,url,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,header:header.split(/\r?\n/).filter(l=>/^(Title|Author|Translator|Language):/.test(l)),checkedTerms:[marker,evidence]};
    patch.snapshot.texts=patch.snapshot.texts.filter(t=>t.id!==pg).concat(snapshot);
    console.log(`Kontrollert tekst ${pg}: ${title}`);
  } else if(!patch.snapshot.texts.some(t=>t.id===pg))throw new Error(`Kjør med --verify først: ${pg}`);
  const sid=source(`culture-text-${pg}`,`Primærtekst og utgavemetadata – ${title}`,url);
  const cols=['literature',...(['henrik-ibsen'].includes(aid)?['norwegian-voices']:[])];
  const book=entity(wid,title,'literary-work',`${title} er et verk av ${author}. Handlingen eller emnet omfatter ${role}.`,cols,sid);
  const writer=entity(aid,author,'person',`${author} har skrevet ${title}.`,cols,sid);
  const charType=cid==='satire'?'concept':'fictional-character';
  const person=entity(cid,character,charType,cid==='satire'?'Satire bruker blant annet ironi og overdrivelse til å kritisere menneskelig atferd eller samfunnsforhold.':`${character} er ${role} i ${title}.`,cols,sid);
  relation(writer,book,'author-of',`${author} har skrevet ${title}.`,[sid]);
  relation(book,person,cid==='satire'?'uses-device':'features-character',cid==='satire'?`${title} bruker satire: forslaget om å selge barn som mat stilles fram med en tilsynelatende saklig argumentasjon.`:`${title} skildrer ${character}, ${role}.`,[sid]);
  const g=plays.has(pg)?'play':[1727,6130].includes(pg)?'epic':pg===1661?'collection':pg===1080?'essay':[43,46].includes(pg)?'novella':'novel';
  const form=entity(`literary-form-${g}`,genres[g][0],'concept',genres[g][1],['literature'],sid);
  relation(book,form,'work-type',`${title} har formen ${genres[g][0].toLowerCase()}.`,[sid]);
  const header=patch.snapshot.texts.find(t=>t.id===pg).header;
  const originalTitle=header.find(l=>l.startsWith('Title:')).slice(6).trim();
  const originalAuthor=header.find(l=>l.startsWith('Author:')).slice(7).trim();
  const writerAliases=[originalAuthor,...(!aid.includes('bronte')?[author.split(' ').at(-1)]:[]),...(aid==='homer'?['Homeros']:[])];
  target(`culture-author-${book}`,book,cols,aid==='homer'?`Hvem tilskrives ${title} tradisjonelt?`:`Hvem skrev ${title}?`,author,[...new Set(writerAliases)].filter(a=>a!==author),`${aid==='homer'?'Utgaven tilskriver diktet Homer, slik den antikke tradisjonen gjør. Det innebærer ikke at vi har en sikkert dokumentert biografi for én historisk forfatter.':`Utgaven oppgir ${author} som forfatter.`} ${title} knytter forfatterskapet til ${role}.`,[sid],`Tenk på et verk med ${role}.`,`Knytt forfatter, verk og den konkrete situasjonen sammen.`, 'recall');
  const repeated=works.filter(w=>w[3]===author&&w[5]===cid).length>1;
  if(cid!=='satire')target(`culture-work-${cid}-${book}`,book,cols,`I hvilket verk av ${author} møter vi ${character}${repeated?`, ${role}`:''}?`,title,[...new Set([originalTitle,originalTitle.split(/[;:]/)[0]])].filter(a=>a!==title),`${character} er ${role} i ${title}.`,[sid],`Spørsmålet gjelder forbindelsen mellom en litterær figur og verket den opptrer i.`,`En litterær figur er en fiktiv person; den skal ikke blandes sammen med forfatterens biografi.`);
  target(`culture-context-${book}`,book,cols,prompt,answer,aliases,contextualNotes[pg][1],[sid],contextualNotes[pg][0],`Knytt opplysningen til både handlingen og verkets form.`,'connections',{answerType:contextAnswerTypes[pg]});
}
const history=['history'];
const historicalSource=id=>{const s=baseline.sources.find(s=>s.id===id);if(!s)throw new Error(`Ukjent grunnkilde: ${id}`);return source(id,s.title,s.url);};
const baseEntity=id=>{const e=baseline.entities.find(e=>e.id===id);if(!e)throw new Error(`Ukjent grunnenhet: ${id}`);return entity(id,e.label,e.type,e.summary,e.collectionIds,e.sourceIds[0]);};
const historicalTarget=(id,event,prompt,answer,aliases,explanation,sid,context,answerType,year)=>target(`culture-history-${id}`,event,history,prompt,answer,aliases,explanation,[sid],context,'Skill dokument, handling og virkning. En dato alene forklarer ikke hele hendelsen.','connections',{answerType,year,significance:4});

const magna=historicalSource('event-magna-carta-sealed');
const magnaEvent=baseEntity('magna-carta-sealed');
const magnaDocument=entity('magna-carta-document','Magna Carta','document','Avtale beseglet av kong Johan i 1215; senere utgaver fikk egne datoer.',history,magna);
const kingJohn=entity('john-of-england','Johan av England','person','Den engelske kongen som beseglet Magna Carta i 1215.',history,magna);
const runnymede=entity('runnymede','Runnymede','place','Stedet mellom Windsor og Staines der kong Johan og baronene kom til enighet i juni 1215.',history,magna);
relation(magnaEvent,magnaDocument,'concerns-document','Hendelsen gjelder beseglingen av Magna Carta i 1215.',[magna],1215);
relation(magnaEvent,kingJohn,'involves-person','Kong Johan beseglet avtalen med baronene.',[magna],1215);
relation(magnaEvent,runnymede,'took-place-in','Avtalen ble beseglet ved Runnymede.',[magna],1215);
historicalTarget('magna-person',magnaEvent,'Hvilken engelsk konge beseglet Magna Carta i 1215?','Johan',['John','Kong Johan','Johan uten land','Johan av England'],'Kong Johan beseglet avtalen ved Runnymede. Besegling, framfor en moderne håndskrevet signatur, er den presise handlingen kilden beskriver.',magna,'Baroner gjorde opprør mot kongens styring; avtalen inneholdt begrensninger på makten hans.','person',1215);
historicalTarget('magna-place',magnaEvent,'Hvor ble Magna Carta beseglet i 1215?','Runnymede',[],'Avtalen ble beseglet ved Runnymede mellom Windsor og Staines 15. juni 1215.',magna,'Et dokument oppsto som del av en konkret konflikt mellom konge og baroner.','place',1215);

const declaration=source('culture-declaration-primary','National Archives – uavhengighetserklæringen og dens tilblivelse','https://www.archives.gov/milestone-documents/declaration-of-independence');
const declarationEvent=baseEntity('us-declaration-of-independence-adopted');
const declarationDoc=entity('us-declaration-document','USAs uavhengighetserklæring','document','Erklæring vedtatt 4. juli 1776. Signeringen av pergamentutgaven begynte 2. august.',history,declaration);
const congress=entity('continental-congress','Kontinentalkongressen','organization','Kongressen som vedtok den amerikanske uavhengighetserklæringen i 1776.',history,declaration);
const jefferson=entity('thomas-jefferson','Thomas Jefferson','person','Skrev hovedutkastet til uavhengighetserklæringen; utkastet ble deretter endret av andre og Kongressen.',history,declaration);
relation(declarationEvent,declarationDoc,'concerns-document','Kontinentalkongressen vedtok erklæringen 4. juli 1776.',[declaration],1776);
relation(congress,declarationDoc,'adopted','Kontinentalkongressen vedtok erklæringen etter en revisjonsprosess.',[declaration],1776);
relation(jefferson,declarationDoc,'drafted','Jefferson skrev hovedutkastet for en komité med fem medlemmer; teksten ble endret før vedtak.',[declaration],1776);
historicalTarget('declaration-draft',declarationEvent,'Hvem skrev hovedutkastet til USAs uavhengighetserklæring?','Thomas Jefferson',['Jefferson'],'Komiteen ga Jefferson skriveoppgaven. Adams, Franklin og Kongressen gjorde endringer; han var derfor ikke alene om den vedtatte teksten.',declaration,'Et sentralt politisk dokument ble skrevet av en komité og revidert før vedtak.','person',1776);
historicalTarget('declaration-assembly',declarationEvent,'Hvilken forsamling vedtok USAs uavhengighetserklæring i 1776?','Kontinentalkongressen',['Den kontinentale kongressen','Continental Congress'],'Kontinentalkongressen vedtok teksten 4. juli 1776. Det er en annen handling enn signeringen av pergamentutgaven, som begynte i august.',declaration,'Skill mellom den som skriver et utkast, den som vedtar det, og dem som signerer.','organization',1776);

const dday=historicalSource('event-d-day-landings-in-normandy');
const ddayEvent=baseEntity('d-day-landings-in-normandy');
const normandy=entity('normandy','Normandie','place','Området i Frankrike der de allierte landgangene begynte 6. juni 1944.',history,dday);
const france=baseEntity('france');
const eisenhower=entity('dwight-d-eisenhower','Dwight D. Eisenhower','person','De alliertes øverste sjef for invasjonen av Normandie i 1944.',history,dday);
const overlord=entity('operation-overlord','Operasjon Overlord','military-operation','Den allierte invasjonen av Normandie, innledet av D-dagen.',history,dday);
relation(ddayEvent,normandy,'took-place-in','De allierte valgte Normandie som landgangsområde.',[dday],1944);
relation(normandy,france,'located-in','Museet omtaler landgangen som en etablering av et alliert fotfeste i Frankrike.',[dday]);
relation(ddayEvent,overlord,'part-of','D-dagen markerte starten på invasjonen med kodenavn Overlord.',[dday],1944);
relation(eisenhower,overlord,'commanded','Eisenhower var øverste allierte sjef med ansvar for planlegging og ledelse av invasjonen.',[dday],1944);
historicalTarget('dday-command',ddayEvent,'Hvem var de alliertes øverste sjef for invasjonen av Normandie i 1944?','Dwight D. Eisenhower',['Eisenhower','Dwight Eisenhower'],'Eisenhower ledet den samlede allierte styrken. Montgomery ledet landstyrkene, så titlene må holdes fra hverandre.',dday,'En stor invasjon krevde ledelse på tvers av fly-, land- og sjøstyrker.','person',1944);
historicalTarget('dday-operation',ddayEvent,'Hva var kodenavnet på den allierte invasjonen av Normandie?','Overlord',['Operasjon Overlord','Operation Overlord'],'Overlord var invasjonen av Normandie. D-dagen var starten på denne større operasjonen, ikke avslutningen på hele krigen.',dday,'Landgangen 6. juni 1944 inngikk i en større militær operasjon.','military-operation',1944);

const un=historicalSource('event-united-nations-begins');
const unCharterSource=source('culture-un-charter','FN – paktens undertegning og ikrafttredelse','https://www.un.org/en/about-us/un-charter/');
const unEvent=baseEntity('united-nations-begins');
const unOrg=entity('united-nations','De forente nasjoner','organization','Internasjonal organisasjon som trådte formelt i kraft 24. oktober 1945.',history,un);
const charter=entity('un-charter','FN-pakten','document','Undertegnet 26. juni 1945; trådte i kraft 24. oktober samme år.',history,unCharterSource);
relation(unEvent,unOrg,'established','FN kom formelt til eksistens 24. oktober 1945.',[un],1945);
relation(unOrg,charter,'founded-under','Organisasjonen bygger på FN-pakten.',[unCharterSource],1945);
relation(unEvent,charter,'concerns-document','Den formelle opprettelsen sammenfaller med FN-paktens ikrafttredelse.',[unCharterSource],1945);
historicalTarget('un-document',unEvent,'Hvilket dokument trådte i kraft da FN formelt ble opprettet 24. oktober 1945?','FN-pakten',['FNs pakt','United Nations Charter','Charter of the United Nations'],'FN-pakten ble undertegnet i juni, men trådte i kraft i oktober. Undertegning og ikrafttredelse er forskjellige milepæler.',unCharterSource,'Internasjonalt samarbeid bygger på både vedtatte dokumenter og formelle vilkår for at de skal gjelde.','document',1945);

const apollo=historicalSource('event-apollo-11-moon-landing');
const apolloEvent=baseEntity('apollo-11-moon-landing');
const mission=entity('apollo-11','Apollo 11','space-mission','NASA-oppdraget som førte mennesker til en bemannet landing på månen i 1969.',['history','science'],apollo);
const armstrong=entity('neil-armstrong','Neil Armstrong','person','Apollo 11s sjef og det første mennesket som gikk på månens overflate.',['history','science'],apollo);
const aldrin=entity('buzz-aldrin','Buzz Aldrin','person','Apollo 11s månelanderpilot og det andre mennesket på månens overflate.',['history','science'],apollo);
const collins=entity('michael-collins','Michael Collins','person','Pilot i kommandomodulen under Apollo 11; deltok i oppdraget uten å gå på månens overflate.',['history','science'],apollo);
relation(apolloEvent,mission,'part-of','Landingen var en del av Apollo 11-oppdraget.',[apollo],1969);
for(const [person,role] of [[armstrong,'sjef'],[aldrin,'månelanderpilot'],[collins,'kommandomodulpilot']])relation(person,mission,'crew-member',`Deltok i Apollo 11 som ${role}.`,[apollo],1969);
historicalTarget('apollo-orbit',apolloEvent,'Hvilket medlem av Apollo 11-besetningen var kommandomodulpilot og gikk ikke på månens overflate?','Michael Collins',['Collins'],'Michael Collins var kommandomodulpilot. Armstrong og Aldrin gikk på månens overflate; alle tre deltok i oppdraget.',apollo,'Et romoppdrag omfatter forskjellige roller. Å delta i månelandingen betyr ikke at alle gikk på overflaten.','person',1969);
historicalTarget('apollo-first',apolloEvent,'Hvilket Apollo 11-medlem gikk først på månens overflate?','Neil Armstrong',['Armstrong'],'Neil Armstrong gikk først, fulgt av Buzz Aldrin. Skill den første gåturen fra selve landingen og fra de tre besetningsmedlemmenes øvrige oppgaver.',apollo,'Rekkefølgen mellom to astronauter er en annen opplysning enn hvilket år oppdraget fant sted.','person',1969);

const counties=historicalSource('kartverket-reform');
relation(baseEntity('norwegian-county-reform-of-2024'),baseEntity('norway'),'took-place-in','Fylkesendringene gjaldt Norges administrative inndeling fra 1. januar 2024.',[counties],2024);

patch.entities=[...entities.values()];
patch.coverage={literaryWorks:works.length,historicalBaseEventsConnected:6,verification:'Forfattermetadata og tekstbelegg; kuraterte forbindelser kontrollert mot primærtekster. Historiske forbindelser bygger på arkiver, FN, NASA, Kartverket og National Army Museum. Ingen publiseringsår utledes av digital utgaves utgivelsesdato.',counts:Object.fromEntries(['entities','relationships','targets','sources','timelines'].map(k=>[k,patch[k].length]))};
const complete={...baseline};
for(const section of ['collections','entities','relationships','targets','sources','timelines'])complete[section]=[...new Map([...baseline[section],...patch[section]].map(row=>[row.id,row])).values()];
for(const key of ['entityCount','relationshipCount','targetCount'])delete complete[key];
const validation=validatePackage(complete);
if(!validation.valid)throw new Error(validation.errors.join('\n'));
const normalized=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9æøå]+/g,' ').trim();
for(const t of patch.targets){
  const context=` ${normalized(t.context)} `;
  for(const answer of [t.answer,...t.acceptedAnswers])if(context.includes(` ${normalized(answer)} `))throw new Error(`${t.id}: kontekst røper svaret ${answer}`);
}
await writeFile(destination,JSON.stringify(patch,null,2)+'\n');
console.log(JSON.stringify(patch.coverage,null,2));
