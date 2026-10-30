const KEY='praxen.analytics.session.v1';
function expiry(token){
  try{const fragment=token.split('.')[1];const normalized=fragment.replace(/-/g,'+').replace(/_/g,'/');const json=JSON.parse(atob(normalized));return typeof json.exp==='number'?json.exp*1000:0;}catch{return 0;}
}
export function saveSession(token,user){
  try{if(!token||!user||expiry(token)<=Date.now())return;localStorage.setItem(KEY,JSON.stringify({token,user}));}catch{}
}
export function readSession(){
  try{const raw=localStorage.getItem(KEY);if(!raw)return null;const value=JSON.parse(raw);
    if(!value?.token||!value?.user||expiry(value.token)<=Date.now()){clearSession();return null;}
    return value;
  }catch{clearSession();return null;}
}
export function clearSession(){try{localStorage.removeItem(KEY);}catch{}}
export function tokenExpiration(token){return expiry(token);}
