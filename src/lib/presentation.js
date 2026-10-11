export function answerPresentation(target) {
  const answer=String(target?.answer || '');
  const year=/^-?\d{1,4}$/.test(answer) && /år|year|dato|date/i.test(target?.prompt || '');
  const extended=target?.answerFormat==='explanation' || answer.length>90 || (answer.includes(',') && answer.length>45);
  const names=/hvilke prisvinnere|hvilke personer/i.test(target?.prompt || '');
  return {extended,inputMode:year?'numeric':'text',label:year?'Årstall':names?'Navn på personene':extended?'Utfyllende svar':'Kort svar',placeholder:year?'Skriv årstallet':extended?'Skriv det du husker …':'Skriv svaret, eller tenk det gjennom'};
}
export function relatedContext(data,target,limit=3,options={}) {
  const entity=data?.entities.find(e=>e.id===target?.entityId);
  if(!entity)return [];
  const {targets=[],reviews=[],pendingIds=[]}=options;
  const practiced=new Set(reviews.map(r=>targets.find(t=>t.id===r.targetId)?.entityId).filter(Boolean));
  const pending=targets.filter(t=>pendingIds.includes(t.id));
  const rows=data.relationships.filter(r=>r.from===entity.id || r.to===entity.id)
    .map(r=>({id:r.id,context:r.context,sourceIds:r.sourceIds,entityId:r.from===entity.id?r.to:r.from,
      label:data.entities.find(e=>e.id===(r.from===entity.id?r.to:r.from))?.label,
      ...(options.targets?{practiced:practiced.has(r.from===entity.id?r.to:r.from),evidenceStatus:r.evidenceStatus||'documented'}:{})}));
  const safe=rows.filter(r=>!pending.some(t=>{
    const text=r.context.toLocaleLowerCase('nb');
    return [t.answer,...(t.acceptedAnswers||[])].some(a=>String(a||'').length>=4 && text.includes(String(a).toLocaleLowerCase('nb')));
  }));
  return safe.sort((a,b)=>Number(Boolean(b.practiced))-Number(Boolean(a.practiced))).slice(0,limit);
}
export function contextualExplanation(data,target,targets,reviews,pendingIds=[]) {
  const refs=(target?.claimIds||[]).map(id=>data.claims?.find(c=>c.id===id)).filter(Boolean);
  return {
    explanation:target?.explanation||'',
    uncertainty:[...new Set(refs.filter(c=>c.evidenceStatus!=='documented').map(c=>c.evidenceStatus==='disputed'?'Denne opplysningen er omstridt.':'Denne opplysningen er usikker.'))],
    connections:relatedContext(data,target,3,{targets,reviews,pendingIds})
  };
}

export function questionSupport(target) {
  const context=target?.context || '';
  if(context.includes('FNs statistiske geografiske inndeling')) return 'Bruk FNs geografiske inndeling.';
  if(context.includes('prisåret, ikke nødvendigvis året arbeidet begynte')) return 'Oppgi prisåret, ikke oppdagelsesåret.';
  if(context.includes('Nobelprisåret er ikke nødvendigvis oppdagelsesåret')) return 'Prisåret kan være senere enn oppdagelsen.';
  if(context.startsWith('Skille mellom kommune og fylke:')) return 'Bruk dagens fylkesinndeling.';
  if(/^(Knytt |Hent fram |Bruk forbindelser |Spørsmålet gjelder forbindelsen mellom )/.test(context)) return '';
  return context;
}
