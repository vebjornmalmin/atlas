// Difficulty describes the knowledge required, not the number of answer choices.
const assessment=(difficulty,learningStage,family,difficultyReason)=>({difficulty,learningStage,difficultyFamily:family,difficultyReason,difficultyPolicy:'2026-10-11'});
export function assessDifficulty(target) {
 const id=target.baseId || target.id.replace(/:recognition$/,'');
 const collections=target.collectionIds || [];
 if(target.mode==='matching')return assessment(3,'details','matching','Krever tre riktige koblinger mellom kjente navn eller steder.');
 if(target.mode==='arrows')return assessment(5,'connections','historical-direction','Krever både geografisk retning og et presist historisk årstall.');
 if(target.mode==='timeline' || target.kind==='before-after' || /^president-before-/.test(id)) return assessment(5,'connections','sequence','Krever at du kjenner flere personer eller hendelser og den nøyaktige rekkefølgen.');
 if(id.startsWith('foundation:'))return assessment(1,'foundation','introduction','Et overblikk med ett tydelig kjennetegn eller en bred tidsperiode.');
 if(id.startsWith('president-start-'))return assessment(4,'details','presidential-year','Krever et bestemt tiltredelsesår blant mange presidentperioder.');
 if(id.startsWith('nobel-year-'))return assessment(5,'connections','award-year','Krever et bestemt prisår, som kan være langt senere enn oppdagelsen.');
 if(target.answerType==='person-list' || target.answerType==='city-list' || id.startsWith('norway-split-'))return assessment(5,'connections','complete-list','Krever flere riktige navn samtidig; ett manglende navn gjør svaret ufullstendig.');
 if(id.startsWith('nobel-people-'))return assessment(4,'details','award-person','Krever at du kjenner både bidraget og den konkrete prisvinneren.');
 if(/^(nobel-contribution-|science-contribution-)/.test(id))return assessment(4,'details','scientific-contribution','Krever forkunnskap om et faglig bidrag og hvem som står bak det.');
 if(id.startsWith('nobel-category-'))return assessment(3,'details','award-category','Krever kjennskap til personens fag og den bestemte pristildelingen.');
 if(/^(art-date-|year-)/.test(id))return assessment(4,'details','exact-year','Krever et konkret årstall, ikke bare kjennskap til verket eller hendelsen.');
 if(/^(art-purpose-|art-place-)/.test(id))return assessment(4,'details','art-background','Krever kunnskap om kunsthistorisk bakgrunn eller fagbegreper.');
 if(/^(artist-|art-title-)/.test(id))return assessment(2,'foundation','art-recognition','Ett navn knyttes til et synlig kunstverk.');
 if(id.startsWith('geo-region-'))return assessment(4,'details','statistical-region','Krever kjennskap til FNs særskilte geografiske inndeling.');
 if(id.startsWith('geo-capital-'))return assessment(3,'details','world-capital','Ett land og én hovedstad, men utvalget omfatter også mindre kjente steder.');
 if(id.startsWith('capital-'))return assessment(2,'foundation','introductory-capital','Ett land og én hovedstad i det innledende utvalget.');
 if(id.startsWith('geo-municipality-'))return assessment(3,'details','municipality-county','Krever norsk lokalkunnskap og skillet mellom kommune og fylke.');
 if(['geo-norway-levels','geo-oslo-two-levels','norway-county-count-2024'].includes(id))return assessment(3,'details','administration','Krever kjennskap til norsk forvaltning og gjeldende fylkesinndeling.');
 if(/^(culture-author-|author-)/.test(id))return assessment(3,'details','author-work','Krever at du har møtt forfatteren og verket før.');
 if(id.startsWith('culture-work-'))return assessment(3,'details','character-work','Krever kjennskap til en fortelling; personbeskrivelsen gir støtte.');
 if(id.startsWith('culture-context-'))return assessment(4,'details','literary-detail','Krever kjennskap til handlingen eller personer inne i et bestemt verk.');
 if(id.startsWith('culture-history-'))return assessment(4,'details','historical-detail','Krever kunnskap om konkrete aktører, dokumenter eller steder rundt hendelsen.');
 if(id==='fosse-language')return assessment(2,'foundation','language','Ett kjennetegn ved en sentral norsk forfatter.');
 if(['map','outline'].includes(target.mode))return assessment(target.mode==='map'?3:4,'details','geographic-shape','Krever at du kjenner plassering eller grenser uten stedsnavn på kartet.');
 // Unknown future families are not silently treated as beginner material.
 return assessment(Math.max(3,target.difficulty || 3),target.kind==='connections'?'connections':/^-?\d{3,4}$/.test(String(target.answer))?'details':target.learningStage || 'details','unreviewed','Nytt innhold må vurderes før det brukes som grunnlag.');
}
export function assessTargets(targets) {return targets.map(target=>({...target,...assessDifficulty(target)}));}
