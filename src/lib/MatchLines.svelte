<script>
  // Draw a line from an item on one side to its partner on the other, or tap one and then the other.
  import {onMount,tick} from 'svelte';
  let {pairs,choices,draft=$bindable({}),revealed=false}=$props();
  let board=$state();
  let selected=$state(null); // {side:'left'|'right', id}
  let pull=$state(null);     // a line following the finger: {side,id,x,y}
  let layout=$state(0);
  let points=$state({});

  const leftOf=choiceId=>Object.keys(draft).find(key=>draft[key]===choiceId);
  function connect(leftId,rightId){
    const next={...draft};
    for(const key of Object.keys(next))if(next[key]===rightId)delete next[key];
    next[leftId]=rightId;draft=next;selected=null;
  }
  function choose(side,id){
    if(revealed)return;
    if(selected && selected.side!==side){side==='left'?connect(id,selected.id):connect(selected.id,id);return;}
    if(selected?.side===side && selected.id===id){selected=null;return;}
    // Picking an item that is already connected loosens it so it can be drawn again.
    if(side==='left' && draft[id]){const next={...draft};delete next[id];draft=next;}
    if(side==='right' && leftOf(id)){const next={...draft};delete next[leftOf(id)];draft=next;}
    selected={side,id};
  }
  function itemAt(x,y){
    const element=document.elementFromPoint(x,y)?.closest('[data-match]');
    return element?{side:element.dataset.side,id:element.dataset.match}:null;
  }
  function down(event,side,id){
    if(revealed||event.button>0)return;
    const start={side,id,x0:event.clientX,y0:event.clientY,moved:false};
    const move=e=>{
      if(!start.moved && Math.hypot(e.clientX-start.x0,e.clientY-start.y0)<8)return;
      start.moved=true;e.preventDefault();
      const r=board.getBoundingClientRect();pull={side,id,x:e.clientX-r.left,y:e.clientY-r.top};
    };
    const end=e=>{
      window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);
      board.removeEventListener('touchmove',block);
      if(!start.moved){pull=null;choose(side,id);return;}
      pull=null;
      const target=e.type==='pointerup'?itemAt(e.clientX,e.clientY):null;
      if(target && target.side!==side){selected=null;side==='left'?connect(id,target.id):connect(target.id,id);}
    };
    const block=e=>{if(start.moved&&e.cancelable)e.preventDefault();};
    board.addEventListener('touchmove',block,{passive:false});
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
  }
  function measure(){
    if(!board)return;
    const r=board.getBoundingClientRect(),next={};
    for(const el of board.querySelectorAll('[data-match]')){
      const b=el.getBoundingClientRect();
      next[`${el.dataset.side}:${el.dataset.match}`]={x:el.dataset.side==='left'?b.right-r.left:b.left-r.left,y:b.top-r.top+b.height/2};
    }
    points=next;
  }
  $effect(()=>{draft;revealed;layout;void tick().then(measure);});
  onMount(()=>{const observer=new ResizeObserver(()=>layout++);observer.observe(board);return ()=>observer.disconnect();});
  const curve=(a,b)=>{const mid=(a.x+b.x)/2;return `M${a.x} ${a.y}C${mid} ${a.y} ${mid} ${b.y} ${b.x} ${b.y}`;};
</script>

<div class="match-board" bind:this={board}>
  <svg class="match-lines" aria-hidden="true">
    {#each pairs as pair}{@const a=points[`left:${pair.id}`]}{@const b=draft[pair.id] && points[`right:${draft[pair.id]}`]}
      {#if a && b}<path d={curve(a,b)} class:right={revealed && draft[pair.id]===pair.id} class:wrong={revealed && draft[pair.id]!==pair.id} />{/if}
    {/each}
    {#if revealed}{#each pairs.filter(p=>draft[p.id]!==p.id) as pair}{@const a=points[`left:${pair.id}`]}{@const b=points[`right:${pair.id}`]}{#if a && b}<path class="missed" d={curve(a,b)} />{/if}{/each}{/if}
    {#if pull}{@const a=points[`${pull.side}:${pull.id}`]}{#if a}<path class="pulling" d={pull.side==='left'?curve(a,pull):curve(pull,a)} /><circle cx={pull.x} cy={pull.y} r="6" />{/if}{/if}
  </svg>
  <div class="match-column" role="group" aria-label="Spørsmål">
    {#each pairs as pair}
      <button type="button" class="match-item left" data-match={pair.id} data-side="left" aria-pressed={selected?.side==='left'&&selected.id===pair.id}
        class:linked={draft[pair.id]} disabled={revealed} onpointerdown={e=>down(e,'left',pair.id)} onclick={e=>{if(e.detail===0)choose('left',pair.id);}}>
        <span>{pair.label}</span><i class="match-dot" aria-hidden="true"></i>
      </button>
    {/each}
  </div>
  <div class="match-column" role="group" aria-label="Svar">
    {#each choices as choice}
      <button type="button" class="match-item right" data-match={choice.id} data-side="right" aria-pressed={selected?.side==='right'&&selected.id===choice.id}
        class:linked={leftOf(choice.id)} disabled={revealed} onpointerdown={e=>down(e,'right',choice.id)} onclick={e=>{if(e.detail===0)choose('right',choice.id);}}>
        <i class="match-dot" aria-hidden="true"></i><span>{choice.answer}</span>
      </button>
    {/each}
  </div>
</div>
<p class="muted map-note">{revealed?'Grønt er riktig, rødt er feil, stiplet viser det riktige paret.':selected?'Trykk på partneren på den andre siden.':'Dra en linje fra et element til partneren, eller trykk på begge.'}</p>
