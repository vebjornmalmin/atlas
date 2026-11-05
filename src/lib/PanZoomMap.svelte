<script>
  // A map that moves like a phone map: drag to pan (with momentum), pinch or scroll to zoom,
  // double-tap to zoom in, and tap to choose. Callers can claim a drag (for drawing arrows).
  import {onMount} from 'svelte';
  import {parseBox,boxString,fitAspect,clampView,zoomAt,panBy} from './map-view.js';
  let {base,initial=null,view=$bindable(null),unit=$bindable(1),label='Kart',maxZoom=24,className='',onTap=null,onDragStart=null,onDragMove=null,onDragEnd=null,children,overlay=null,controls=true}=$props();

  let svg=$state();
  let size=$state({w:0,h:0});
  const baseBox=$derived(parseBox(base));
  const aspect=()=>size.w&&size.h?size.w/size.h:baseBox[2]/baseBox[3];
  let current=$state(null);
  const shown=$derived(current || fitAspect(initial || baseBox,aspect()));
  // Two pinch fingers or one dragging finger; nothing is stored once the gesture ends.
  const pointers=new Map();
  let gesture=null, animation=0, lastTap=null;

  function commit(next){current=clampView(next,baseBox,maxZoom);view=current;}
  function rect(){return svg.getBoundingClientRect();}
  function unitsPerPixel(){const r=rect();return Math.max(shown[2]/r.width,shown[3]/r.height);}
  export function toSvg(clientX,clientY){
    const r=rect(),scale=unitsPerPixel();
    return {x:shown[0]+(clientX-r.left-(r.width-shown[2]/scale)/2)*scale,y:shown[1]+(clientY-r.top-(r.height-shown[3]/scale)/2)*scale};
  }
  export function pixelSize(){return unitsPerPixel();}
  function stop(){cancelAnimationFrame(animation);animation=0;}
  /** Glide to a box, the way a map app flies to a search result. */
  export function flyTo(box,duration=650){
    stop();
    const from=[...shown],to=clampView(fitAspect(box,aspect()),baseBox,maxZoom);
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){commit(to);return;}
    const start=performance.now();
    const step=now=>{
      const t=Math.min(1,(now-start)/duration),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
      // Interpolate the zoom geometrically so the motion feels even at every scale.
      const w=from[2]*Math.pow(to[2]/from[2],e),h=w*(from[3]/from[2]);
      const cx=from[0]+from[2]/2+(to[0]+to[2]/2-from[0]-from[2]/2)*e,cy=from[1]+from[3]/2+(to[1]+to[3]/2-from[1]-from[3]/2)*e;
      commit([cx-w/2,cy-h/2,w,h]);
      if(t<1)animation=requestAnimationFrame(step);else animation=0;
    };
    animation=requestAnimationFrame(step);
  }
  export function zoomBy(factor){const c={x:shown[0]+shown[2]/2,y:shown[1]+shown[3]/2};animateZoom(factor,c);}
  export function reset(){flyTo(initial || baseBox);}
  function animateZoom(factor,p){
    const target=zoomAt(shown,factor,p.x,p.y);
    flyTo(target,280);
  }
  function centroid(){const list=[...pointers.values()];return {x:list.reduce((s,p)=>s+p.x,0)/list.length,y:list.reduce((s,p)=>s+p.y,0)/list.length};}
  function spread(){const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y)||1;}
  function startPinch(){
    const c=centroid();
    gesture={type:'pinch',startView:[...shown],startSpread:spread(),anchor:toSvg(c.x,c.y),moved:true};
  }
  function down(event){
    if(event.button>0)return;
    stop();
    svg.setPointerCapture?.(event.pointerId);
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===2){if(gesture?.type==='draw')onDragEnd?.(null,null,true);startPinch();return;}
    if(pointers.size>2)return;
    const point=toSvg(event.clientX,event.clientY);
    const element=document.elementFromPoint(event.clientX,event.clientY);
    if(onDragStart?.(point,element,event)){gesture={type:'draw',moved:false,x:event.clientX,y:event.clientY};event.preventDefault();return;}
    gesture={type:'pan',x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,t:performance.now(),vx:0,vy:0,moved:false};
  }
  function move(event){
    if(!pointers.has(event.pointerId)||!gesture)return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(gesture.type==='draw'){
      if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>4)gesture.moved=true;
      onDragMove?.(toSvg(event.clientX,event.clientY),document.elementFromPoint(event.clientX,event.clientY));return;
    }
    if(gesture.type==='pinch'&&pointers.size>=2){
      const c=centroid(),factor=spread()/gesture.startSpread;
      const w=gesture.startView[2]/factor,h=gesture.startView[3]/factor;
      // Keep the point between the fingers under the fingers while they move.
      const r=rect(),scale=Math.max(w/r.width,h/r.height);
      const x=gesture.anchor.x-(c.x-r.left-(r.width-w/scale)/2)*scale,y=gesture.anchor.y-(c.y-r.top-(r.height-h/scale)/2)*scale;
      commit([x,y,w,h]);return;
    }
    if(gesture.type==='pan'){
      const dx=event.clientX-gesture.lastX,dy=event.clientY-gesture.lastY,now=performance.now(),dt=Math.max(1,now-gesture.t);
      if(Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>6)gesture.moved=true;
      if(!gesture.moved)return;
      const scale=unitsPerPixel();
      commit(panBy(shown,dx*scale,dy*scale));
      gesture.vx=.8*dx/dt+.2*gesture.vx;gesture.vy=.8*dy/dt+.2*gesture.vy;
      gesture.lastX=event.clientX;gesture.lastY=event.clientY;gesture.t=now;
    }
  }
  function up(event){
    if(!pointers.has(event.pointerId))return;
    pointers.delete(event.pointerId);
    const g=gesture;
    if(g?.type==='pinch'){if(pointers.size===1){const [p]=[...pointers.values()];gesture={type:'pan',x:p.x,y:p.y,lastX:p.x,lastY:p.y,t:performance.now(),vx:0,vy:0,moved:true};}else if(!pointers.size)gesture=null;return;}
    if(pointers.size)return;
    gesture=null;
    if(!g)return;
    if(g.type==='draw'){onDragEnd?.(toSvg(event.clientX,event.clientY),document.elementFromPoint(event.clientX,event.clientY),event.type==='pointercancel');if(!g.moved)tap(event);return;}
    if(event.type==='pointercancel')return;
    if(!g.moved){tap(event);return;}
    // Momentum: keep gliding with the release speed and let friction stop it.
    let vx=g.vx,vy=g.vy;
    if(performance.now()-g.t>80||Math.hypot(vx,vy)<.15)return;
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    let last=performance.now();
    const glide=now=>{
      const dt=Math.min(32,now-last);last=now;
      const scale=unitsPerPixel();commit(panBy(shown,vx*dt*scale,vy*dt*scale));
      vx*=Math.pow(.94,dt/16);vy*=Math.pow(.94,dt/16);
      animation=Math.hypot(vx,vy)>.02?requestAnimationFrame(glide):0;
    };
    animation=requestAnimationFrame(glide);
  }
  function tap(event){
    const now=performance.now(),point=toSvg(event.clientX,event.clientY);
    const element=document.elementFromPoint(event.clientX,event.clientY);
    if(lastTap&&now-lastTap.t<320&&Math.hypot(event.clientX-lastTap.x,event.clientY-lastTap.y)<30){lastTap=null;animateZoom(2.2,point);return;}
    lastTap={t:now,x:event.clientX,y:event.clientY};
    const region=element?.closest?.('[data-region]')?.dataset.region || '';
    onTap?.({region,point,element});
  }
  function wheel(event){
    event.preventDefault();stop();
    const p=toSvg(event.clientX,event.clientY);
    // Trackpad pinch arrives as ctrl+wheel with small deltas; mouse wheels send larger steps.
    const factor=Math.exp(-event.deltaY*(event.ctrlKey?.012:.0022));
    commit(zoomAt(shown,factor,p.x,p.y));
  }
  function key(event){
    const step=unitsPerPixel()*60,moves={ArrowLeft:[step,0],ArrowRight:[-step,0],ArrowUp:[0,step],ArrowDown:[0,-step]};
    if(moves[event.key]&&event.target===svg){event.preventDefault();commit(panBy(shown,...moves[event.key]));}
    else if((event.key==='+'||event.key==='=')&&event.target===svg){event.preventDefault();zoomBy(1.6);}
    else if(event.key==='-'&&event.target===svg){event.preventDefault();zoomBy(1/1.6);}
  }
  onMount(()=>{
    const observer=new ResizeObserver(([entry])=>{const {width,height}=entry.contentRect;if(width&&height){size={w:width,h:height};if(current)commit(fitAspect(current,width/height));}});
    observer.observe(svg);
    svg.addEventListener('wheel',wheel,{passive:false});
    // iOS starts page gestures from touchmove; refuse them while a finger is on the map.
    const block=event=>{if(event.cancelable)event.preventDefault();};
    svg.addEventListener('touchmove',block,{passive:false});
    svg.addEventListener('gesturestart',block);
    // Measure before restoring a saved view: fitting it to the default aspect first would widen it,
    // and the map would open further out every time.
    const box=svg.getBoundingClientRect();
    if(box.width&&box.height)size={w:box.width,h:box.height};
    if(view && !current)current=clampView(fitAspect(view,aspect()),baseBox,maxZoom);
    return ()=>{observer.disconnect();stop();svg?.removeEventListener('wheel',wheel);svg?.removeEventListener('touchmove',block);svg?.removeEventListener('gesturestart',block);};
  });
  $effect(()=>{unit=size.w&&size.h?Math.max(shown[2]/size.w,shown[3]/size.h):shown[2]/360;});
  const zoomed=$derived(shown[2]<Math.max(baseBox[2],baseBox[3]*aspect())*.98);
</script>

<div class="pz-map {className}">
  <svg bind:this={svg} viewBox={boxString(shown)} role="application" aria-label={label} tabindex="0"
    onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up} onkeydown={key}>
    {@render children?.()}
  </svg>
  {#if overlay}{@render overlay()}{/if}
  {#if controls}<div class="pz-controls" aria-label="Kartkontroller">
    <button type="button" aria-label="Zoom inn" onclick={()=>zoomBy(2)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12"/></svg></button>
    <button type="button" aria-label="Zoom ut" onclick={()=>zoomBy(.5)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h12"/></svg></button>
    {#if zoomed}<button type="button" class="pz-reset" aria-label="Vis hele kartet" onclick={reset}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 8V3h5M17 8V3h-5M3 12v5h5M17 12v5h-5"/></svg></button>{/if}
  </div>{/if}
</div>

<style>
  .pz-controls button svg{width:18px;height:18px;margin:auto}
  .pz-controls button svg path{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;vector-effect:none}
</style>
