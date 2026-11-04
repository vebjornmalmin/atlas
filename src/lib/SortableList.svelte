<script>
  // Hold an item and drag it to a new place. The grip starts a drag at once; elsewhere a short
  // press does, so the page can still scroll. Arrow keys move the focused item.
  let {items=$bindable([]),disabled=false,label='Rekkefølge',startLabel='',endLabel='',row,itemClass=()=>''}=$props();
  let list=$state();
  let drag=$state(null);
  let pending=null;
  let announcement=$state('');

  function begin(event,index,element){
    pending=null;
    const rects=[...list.querySelectorAll(':scope > li')].map(li=>li.getBoundingClientRect());
    const gap=rects.length>1?rects[1].top-rects[0].bottom:8;
    drag={index,over:index,startY:event.clientY,dy:0,rects,gap,pointerId:event.pointerId};
    try{element.setPointerCapture(event.pointerId);}catch{/* The pointer may already be gone. */}
    navigator.vibrate?.(8);
  }
  function down(event,index){
    if(disabled||event.button>0)return;
    const element=event.currentTarget;
    if(event.pointerType==='mouse'||event.target.closest('.sort-grip')){event.preventDefault();begin(event,index,element);return;}
    const timer=setTimeout(()=>{if(pending?.timer===timer)begin(pending.event,index,element);},170);
    pending={timer,event,x:event.clientX,y:event.clientY};
  }
  function move(event){
    if(pending && Math.hypot(event.clientX-pending.x,event.clientY-pending.y)>8){clearTimeout(pending.timer);pending=null;}
    if(!drag||event.pointerId!==drag.pointerId)return;
    const {rects,index}=drag;
    const dy=Math.max(rects[0].top-rects[index].top-12,Math.min(rects.at(-1).bottom-rects[index].bottom+12,event.clientY-drag.startY));
    const middle=(rects[index].top+rects[index].bottom)/2+dy;
    let over=0;
    rects.forEach((r,i)=>{if(i!==index && (r.top+r.bottom)/2<middle)over++;});
    drag={...drag,dy,over};
    const edge=48;
    if(event.clientY<edge)window.scrollBy(0,-8);else if(event.clientY>window.innerHeight-edge)window.scrollBy(0,8);
  }
  function up(event){
    if(pending){clearTimeout(pending.timer);pending=null;}
    if(!drag||event.pointerId!==drag.pointerId)return;
    const {index,over}=drag;drag=null;
    if(event.type!=='pointercancel' && over!==index)place(index,over);
  }
  function place(from,to){
    const next=[...items];const [moved]=next.splice(from,1);next.splice(to,0,moved);items=next;
    announcement=`Flyttet til plass ${to+1} av ${next.length}.`;
  }
  function offset(i){
    if(!drag)return 0;
    const {index,over,rects,gap,dy}=drag;
    if(i===index)return dy;
    const size=rects[index].height+gap;
    if(index<over && i>index && i<=over)return -size;
    if(index>over && i<index && i>=over)return size;
    return 0;
  }
  function key(event,index){
    if(disabled)return;
    if(event.key==='ArrowUp'&&index>0){event.preventDefault();place(index,index-1);queueMicrotask(()=>list.children[index-1]?.focus());}
    if(event.key==='ArrowDown'&&index<items.length-1){event.preventDefault();place(index,index+1);queueMicrotask(()=>list.children[index+1]?.focus());}
  }
  $effect(()=>{
    if(!list)return;
    // Safari scrolls the page from touchmove; cancelling it while dragging keeps the item under the finger.
    const block=event=>{if(drag&&event.cancelable)event.preventDefault();};
    list.addEventListener('touchmove',block,{passive:false});
    return ()=>list?.removeEventListener('touchmove',block);
  });
</script>

{#if startLabel}<p class="sort-end">{startLabel}</p>{/if}
<ol class="sort-list" class:dragging={drag} bind:this={list} aria-label={label}>
  {#each items as item,i (item.id)}
    <li class="sort-item {itemClass(item,i)}" class:lifted={drag?.index===i} style:transform={drag?`translateY(${offset(i)}px)`:''}
      tabindex={disabled?-1:0} aria-roledescription="flyttbart element" aria-label={`${i+1}. ${item.label}`}
      onpointerdown={e=>down(e,i)} onpointermove={move} onpointerup={up} onpointercancel={up} onkeydown={e=>key(e,i)} oncontextmenu={e=>e.preventDefault()}>
      <span class="sort-index" aria-hidden="true">{i+1}</span>
      <span class="sort-body">{@render row(item,i)}</span>
      {#if !disabled}<span class="sort-grip" aria-hidden="true"><svg viewBox="0 0 12 18"><circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/><circle cx="3" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="3" cy="15" r="1.5"/><circle cx="9" cy="15" r="1.5"/></svg></span>{/if}
    </li>
  {/each}
</ol>
{#if endLabel}<p class="sort-end">{endLabel}</p>{/if}
<p class="sr-only" aria-live="polite">{announcement}</p>
