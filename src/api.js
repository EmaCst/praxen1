export const API_URL = import.meta.env.VITE_API_URL || 'https://api-praxen.onrender.com';
export class ApiError extends Error { constructor(status, message) { super(message); this.status=status; } }
export async function api(path, { token, onUnauthorized, ...options } = {}) {
  const { body, headers: customHeaders, ...requestOptions } = options;
  let response;
  try { response=await fetch(API_URL + path, { ...requestOptions, body:body===undefined?undefined:JSON.stringify(body), cache:'no-store', headers:{ Accept:'application/json', ...(body===undefined?{}:{'Content-Type':'application/json'}), ...(token?{Authorization:'Bearer '+token}:{}), ...customHeaders } }); }
  catch { throw new ApiError(0,'No pudimos conectar con la API. Comprueba tu conexión y el servicio de Render.'); }
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) { if(response.status===401 && onUnauthorized) onUnauthorized(); throw new ApiError(response.status,payload.message||'La solicitud no se pudo completar ('+response.status+').'); }
  return payload;
}
export const qs = params => { const result=new URLSearchParams(); Object.entries(params).forEach(([key,value])=>{if(value!==undefined&&value!==null&&value!=='')result.set(key,String(value));}); return result.toString()?'?'+result.toString():''; };
