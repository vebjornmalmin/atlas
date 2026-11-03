<script>
  import {onMount,tick} from 'svelte';
  import {openFeedbackDatabase,feedbackRecord,feedbackText,saveFeedback,listFeedback,captureFeedbackScreen} from './feedback.js';
  let {context}= $props();
  let db;
  let opened=$state(false),capturing=$state(false),comment=$state(''),screenshot=$state(''),failure=$state(''),message=$state('');
  let capturedContext=$state.raw(null),reports=$state.raw([]),selected=$state.raw(null);
  let fallback=$state('');
  let dialog=$state();
  let returnFocus,returnScroll;
  let lastFocus;
  onMount(()=>{
    const focused=event=>{if(!event.target.closest('[data-feedback-ui]'))lastFocus=event.target;};
    document.addEventListener('focusin',focused);
    return ()=>{document.removeEventListener('focusin',focused);db?.close();};
  });
  async function database(){return db || (db=await openFeedbackDatabase());}
  async function open(){
    returnFocus=lastFocus;returnScroll={x:scrollX,y:scrollY};
    failure='';message='';fallback='';selected=null;comment='';capturing=true;
    capturedContext={...context(),createdAt:new Date().toISOString(),screenText:document.getElementById('main-view')?.innerText.slice(0,16000),viewport:{width:innerWidth,height:innerHeight,scrollY},language:navigator.language};
    try{screenshot=await captureFeedbackScreen();}catch(error){screenshot='';failure=`Kunne ikke lage skjermbilde: ${error.message}. Du kan legge ved et skjermbilde selv.`;}
    finally{capturing=false;opened=true;await tick();dialog?.showModal();}
    try{reports=await listFeedback(await database());}catch(error){failure=error.message;}
  }
  async function save(){
    failure='';message='';
    try{
      const report=feedbackRecord(comment,capturedContext,screenshot);
      await saveFeedback(await database(),report);reports=await listFeedback(db);selected=report;
      message='Lagret på denne enheten. Ingenting er sendt.';
    }catch(error){failure=error.message;}
  }
  async function copyText(){
    const text=feedbackText(selected);
    try{await navigator.clipboard.writeText(text);message='Tekst og kontekst er kopiert. Lim det inn i chatten og legg ved skjermbildet.';}
    catch{fallback=text;message='Marker og kopier teksten nedenfor.';}
  }
  function imageBlob(){const bytes=Uint8Array.from(atob(selected.screenshot.split(',')[1]),c=>c.charCodeAt(0));return new Blob([bytes],{type:'image/png'});}
  async function copyImage(){
    try{await navigator.clipboard.write([new ClipboardItem({'image/png':imageBlob()})]);message='Skjermbildet er kopiert. Lim det inn i chatten.';}
    catch{message='Denne nettleseren støtter ikke kopiering av bilder. Bruk «Last ned skjermbilde» eller «Del rapport».';}
  }
  function download(blob,name){const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  async function share(){
    const files=[new File([imageBlob()],`atlas-${selected.id}.png`,{type:'image/png'}),new File([feedbackText(selected)],'atlas-tilbakemelding.txt',{type:'text/plain'})];
    if(navigator.canShare?.({files})){
      try{await navigator.share({files,title:'Tilbakemelding til Atlas'});}catch(error){if(error.name!=='AbortError')failure=error.message;}
    }else download(new Blob([JSON.stringify(selected,null,2)],{type:'application/json'}),`atlas-${selected.id}.json`);
  }
  async function upload(event){
    const file=event.currentTarget.files?.[0];if(!file)return;
    if(!file.type.startsWith('image/') || file.size>10000000){failure='Velg et bilde under 10 MB.';return;}
    try{
      const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');
      const factor=Math.min(1,Math.sqrt(2500000/(bitmap.width*bitmap.height)));canvas.width=Math.round(bitmap.width*factor);canvas.height=Math.round(bitmap.height*factor);
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();screenshot=canvas.toDataURL('image/png');failure='';
    }catch(error){failure=error.message;}
  }
  function close(){dialog?.close();opened=false;returnFocus?.focus({preventScroll:true});if(returnScroll)window.scrollTo(returnScroll.x,returnScroll.y);}
</script>
<button class="feedback-trigger" data-feedback-ui data-html2canvas-ignore disabled={capturing} onclick={open}>{capturing?'Tar skjermbilde …':'Gi tilbakemelding'}</button>
{#if opened}
<dialog bind:this={dialog} class="feedback-dialog" data-feedback-ui data-html2canvas-ignore oncancel={event=>{event.preventDefault();close();}} aria-labelledby="feedback-title">
  <div class="row"><h2 id="feedback-title">Tilbakemelding</h2><button class="quiet" aria-label="Lukk tilbakemelding" onclick={close}>×</button></div>
  <p class="muted">Lagres med skjermbilde. Ingenting sendes før du deler det.</p>
  {#if failure}<p class="error" role="alert">{failure}</p>{/if}
  {#if message}<p role="status">{message}</p>{/if}
  {#if selected}
    <p>{selected.comment}</p><p class="muted">{new Date(selected.createdAt).toLocaleString('nb-NO')}</p>
    <img class="feedback-preview" src={selected.screenshot} alt="Lagret skjermbilde av appen da tilbakemeldingen ble opprettet">
    <div class="stack">
      <button class="primary" onclick={copyText}>Kopier tekst og kontekst</button>
      <button class="secondary" onclick={copyImage}>Kopier skjermbilde</button>
      <button class="secondary" onclick={()=>download(imageBlob(),`atlas-${selected.id}.png`)}>Last ned skjermbilde</button>
      <button class="secondary" onclick={()=>download(new Blob([JSON.stringify(selected,null,2)],{type:'application/json'}),`atlas-${selected.id}.json`)}>Last ned hele rapporten</button>
      <button class="secondary" onclick={share}>Del rapport</button>
      <details><summary>Se lagret kontekst</summary><pre class="feedback-context">{JSON.stringify(selected.context,null,2)}</pre></details>
      {#if fallback}<label>Tekst til kopiering<textarea class="textarea" readonly value={fallback} rows="10"></textarea></label>{/if}
      <button class="quiet" onclick={()=>{selected=null;message='';fallback='';}}>← Tilbake</button>
    </div>
  {:else}
    {#if screenshot}<img class="feedback-preview" src={screenshot} alt="Skjermbildet som lagres sammen med kommentaren">{/if}
    <label class="field">Hva vil du forbedre?<textarea class="textarea" bind:value={comment} maxlength="5000" rows="4" placeholder="Beskriv det du la merke til …"></textarea></label>
    {#if !screenshot}<label class="field">Legg ved skjermbilde<input type="file" accept="image/*" onchange={upload}></label>{/if}
    <button class="primary" disabled={!comment.trim() || !screenshot} onclick={save}>Lagre tilbakemelding</button>
    <h3>Lagrede tilbakemeldinger ({reports.length})</h3>
    {#each reports as report}<button class="entity-row" onclick={()=>{selected=report;message='';fallback='';}}><span>{report.comment.slice(0,100)}<small class="muted">{new Date(report.createdAt).toLocaleString('nb-NO')}</small></span><span>↗</span></button>{/each}
    {#if !reports.length}<p class="muted">Ingen lagrede tilbakemeldinger ennå.</p>{/if}
  {/if}
<button class="secondary" onclick={close}>Fortsett der du var</button>
</dialog>
{/if}
<style>
:global(html.quiz-active) .feedback-trigger{position:fixed;top:calc(8px + env(safe-area-inset-top));bottom:auto;box-shadow:none;padding:8px 10px;font-size:11px;}
.feedback-trigger{position:absolute;right:max(16px,calc((100vw - 480px)/2 + 16px));top:calc(26px + env(safe-area-inset-top));bottom:auto;z-index:25;padding:8px 12px;min-height:40px;border:1px solid var(--line);border-radius:24px;background:var(--surface,#f4f3ed);color:var(--muted,#71766a);box-shadow:none;font-size:12px;}
.feedback-dialog{box-sizing:border-box;width:calc(100vw - 24px);max-width:456px;max-height:calc(100dvh - 32px);border:1px solid var(--line);border-radius:20px;padding:20px;background:var(--surface,#f4f3ed);color:var(--ink,#263c2d);overflow:auto;}
.feedback-dialog::backdrop{background:#0008;}
.feedback-dialog h2{margin:0;}.feedback-dialog .row{justify-content:space-between;}.feedback-preview{display:block;width:auto;max-width:100%;max-height:260px;margin:12px auto;border:1px solid var(--line);border-radius:8px;}.feedback-dialog button{margin-top:8px;}.feedback-context{white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;}.feedback-dialog .entity-row{width:100%;text-align:left;}.feedback-dialog small{display:block;}
</style>
