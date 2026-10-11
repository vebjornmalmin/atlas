export const FEEDBACK_VERSION = 1;
export function openFeedbackDatabase(name = 'atlas-feedback') {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(name,1);
    request.onupgradeneeded=()=>request.result.createObjectStore('reports',{keyPath:'id'});
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(request.result);};
  });
}
export function feedbackRecord(comment,context,screenshot,now=new Date()) {
  if(!comment.trim())throw new Error('Skriv en tilbakemelding først.');
  if(comment.length>5000)throw new Error('Tilbakemeldingen må være kortere enn 5000 tegn.');
  if(!/^data:image\/png;base64,/.test(screenshot))throw new Error('Skjermbildet mangler. Prøv å ta det på nytt.');
  return {format:'atlas-feedback',version:FEEDBACK_VERSION,id:crypto.randomUUID(),createdAt:now.toISOString(),comment:comment.trim(),context:JSON.parse(JSON.stringify(context)),screenshot};
}
export function feedbackText(report) {
  const {screenshot,...text}=report;
  return `Tilbakemelding til Atlas\n\n${report.comment}\n\nSkjermbilde: atlas-${report.id}.png\n\nKontekst:\n${JSON.stringify(text,null,2)}`;
}
export function saveFeedback(db,record) {
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('reports','readwrite');
    tx.objectStore('reports').put(record);
    tx.oncomplete=()=>resolve(record);
    tx.onabort=()=>reject(tx.error || new Error('Tilbakemeldingen kunne ikke lagres.'));
  });
}
export function listFeedback(db) {
  return new Promise((resolve,reject)=>{
    const request=db.transaction('reports').objectStore('reports').getAll();
    request.onerror=()=>reject(request.error);
    request.onsuccess=()=>resolve(request.result.sort((a,b)=>b.createdAt.localeCompare(a.createdAt)));
  });
}
export async function captureFeedbackScreen() {
  const {default:html2canvas}=await import('html2canvas');
  const scale=Math.min(2,window.devicePixelRatio || 1,Math.sqrt(2500000/(innerWidth*innerHeight)));
  const canvas=await html2canvas(document.body,{
    width:innerWidth,height:innerHeight,x:scrollX,y:scrollY,windowWidth:innerWidth,windowHeight:innerHeight,
    scrollX,scrollY,scale,logging:false,useCORS:false,allowTaint:false,
    backgroundColor:getComputedStyle(document.documentElement).backgroundColor,
    ignoreElements:element=>element.hasAttribute('data-feedback-ui'),
    onclone:document=>{
      const freeze=document.createElement('style');freeze.textContent='*,*::before,*::after{animation:none!important;transition:none!important}';document.head.appendChild(freeze);
      const originalsList=[...window.document.querySelectorAll('svg')];
      const clones=[...document.querySelectorAll('svg')];
      for(const [svgIndex,svg] of clones.entries()) {
        const original=originalsList[svgIndex];
        if(!original)continue;
        const nodes=[svg,...svg.querySelectorAll('*')];
        const originals=[original,...original.querySelectorAll('*')];
        nodes.forEach((node,index)=>{
          const styles=window.getComputedStyle(originals[index]);
          for(const key of ['fill','stroke','stroke-width','opacity'])node.setAttribute(key,styles.getPropertyValue(key));
        });
        const image=document.createElement('img');
        const bounds=original.getBoundingClientRect();
        svg.setAttribute('xmlns','http://www.w3.org/2000/svg');
        svg.setAttribute('width',String(bounds.width));svg.setAttribute('height',String(bounds.height));
        image.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(new XMLSerializer().serializeToString(svg));
        image.width=bounds.width;image.height=bounds.height;image.style.cssText=`display:block;width:${bounds.width}px;height:${bounds.height}px;`; 
        svg.replaceWith(image);
      }
    }
  });
  return canvas.toDataURL('image/png');
}
