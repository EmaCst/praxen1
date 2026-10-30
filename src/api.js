const CACHE_TTL=45_000;
const cache=new Map();
const inFlight=new Map();
export function clearApiCache(){cache.clear();inFlight.clear();}
export function invalidateApiCache(){cache.clear();}
export const API_URL=import.meta.env.VITE_API_URL||'https://api-praxen.onrender.com';
export class ApiError extends Error{constructor(status,message){super(message);this.status=status;}}
export async function api(path,{token,onUnauthorized,skipLogout=false,force=false,...options}={}){
  const {body,headers:customHeaders,...requestOptions}=options;
  const method=(requestOptions.method||'GET').toUpperCase();
  const cacheable=method==='GET'&&!!token&&!force;
  const key=token+'|'+path;
  if(cacheable){
    const hit=cache.get(key);
    if(hit&&Date.now()-hit.timestamp<CACHE_TTL)return hit.payload;
    if(inFlight.has(key))return inFlight.get(key);
  }
  const execute=async()=>{
    let response;
    try{response=await fetch(API_URL+path,{...requestOptions,method,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',headers:{Accept:'application/json',...(body===undefined?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{}),...customHeaders}});}
    catch{throw new ApiError(0,'No pudimos conectar con la API. Comprueba tu conexión y Render.');}
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      if(response.status===401&&token&&!skipLogout&&onUnauthorized)onUnauthorized();
      throw new ApiError(response.status,payload.message||'La solicitud no se pudo completar ('+response.status+').');
    }
    if(method!=='GET')invalidateApiCache();
    else if(token)cache.set(key,{payload,timestamp:Date.now()});
    return payload;
  };
  if(!cacheable)return execute();
  const promise=execute().finally(()=>inFlight.delete(key));
  inFlight.set(key,promise);
  return promise;
}
export const qs=params=>{const values=new URLSearchParams();Object.entries(params).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=='')values.set(k,String(v));});return values.toString()?'?'+values.toString():'';};
