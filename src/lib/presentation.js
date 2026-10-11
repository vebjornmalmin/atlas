export function answerPresentation(target) {
  const answer=String(target?.answer || '');
  const year=/^-?\d{1,4}$/.test(answer) && /år|year|dato|date/i.test(target?.prompt || '');
  const extended=target?.answerFormat==='explanation' || answer.length>90 || (answer.includes(',') && answer.length>45);
  const names=/hvilke prisvinnere|hvilke personer/i.test(target?.prompt || '');
  return {extended,inputMode:year?'numeric':'text',label:year?'Årstall':names?'Navn på personene':extended?'Utfyllende svar':'Kort svar',placeholder:year?'Skriv årstallet':extended?'Skriv det du husker …':'Skriv svaret, eller tenk det gjennom'};
}
export function relatedContext(data,target,limit=3) {
  const entity=data?.entities.find(e=>e.id===target?.entityId);
  if(!entity)return [];
  return data.relationships.filter(r=>r.from===entity.id || r.to===entity.id).slice(0,limit).map(r=>({
    id:r.id,context:r.context,sourceIds:r.sourceIds,
    entityId:r.from===entity.id?r.to:r.from,
    label:data.entities.find(e=>e.id===(r.from===entity.id?r.to:r.from))?.label
  }));
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
