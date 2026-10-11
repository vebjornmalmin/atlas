export const APP_VERSION='0.10.0';
export const APP_CHECK_INTERVAL=5*60*1000;
export function createAppUpdateChecker({fetchVersion,getRegistration,version=APP_VERSION,now=Date.now,onStatus=()=>{},waitMs=30000}) {
 let last=0,inFlight=null;
 async function inspect() {
  onStatus({state:'checking'});
  try {
   const remote=await fetchVersion();
   if(!remote || typeof remote.version!=='string' || !/^\d+\.\d+\.\d+$/.test(remote.version))throw new Error('Ugyldig versjonsinformasjon.');
   const registration=getRegistration();
   if(registration){
    await registration.update();
    const worker=registration.installing;
    if(worker && !['installed','redundant'].includes(worker.state))await new Promise((resolve,reject)=>{
     let timer; const cleanup=()=>{clearTimeout(timer);worker.removeEventListener('statechange',changed);};
     const changed=()=>{if(['installed','redundant'].includes(worker.state)){cleanup();resolve();}};
     worker.addEventListener('statechange',changed);
     timer=setTimeout(()=>{cleanup();reject(new Error('Nedlastingen tar lengre tid. Prøv igjen.'));},waitMs);
     changed();
    });
   }
   const ready=Boolean(registration?.waiting);
   const result={state:ready?'ready':remote.version!==version?'pending':'current',checkedAt:now(),version:remote.version};
   onStatus(result); return result;
  }catch(error){const result={state:'failed',checkedAt:now(),message:error.message};onStatus(result);return result;}
 }
 return {check(manual=false){
  if(inFlight)return inFlight;
  if(!manual && last && now()-last<APP_CHECK_INTERVAL)return Promise.resolve(null);
  last=now();inFlight=inspect().finally(()=>{inFlight=null;});return inFlight;
 }};
}
