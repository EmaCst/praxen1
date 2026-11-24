import React,{useCallback,useEffect,useState} from 'react';
import {Building2,CheckCircle2,Clock3,RefreshCw,XCircle} from 'lucide-react';
import {Button,Panel,ErrorBanner,Badge} from '../ui';

const dateLabel=value=>value?new Date(value).toLocaleString('es-GT',{dateStyle:'medium',timeStyle:'short'}):'—';

export default function AthleteInvitations({call,refreshVersion,notify}){
 const [items,setItems]=useState([]);
 const [loading,setLoading]=useState(true);
 const [busyId,setBusyId]=useState(null);
 const [error,setError]=useState('');
 const [reload,setReload]=useState(0);

 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   const result=await call('/api/atletas/me/invitaciones',{force:true});
   setItems(result.invitaciones||[]);
  }catch(e){setError(e.message||'No se pudieron cargar tus invitaciones.');}
  finally{setLoading(false);}
 },[call,refreshVersion,reload]);

 useEffect(()=>{load();},[load]);

 async function respond(item,action){
  const verb=action==='accept'?'aceptar':'rechazar';
  if(action==='decline'&&!window.confirm('¿Deseas rechazar la invitación de '+item.association.name+'?'))return;
  setBusyId(item.id);setError('');
  try{
   const result=await call('/api/atletas/me/invitaciones/'+item.id,{method:'PATCH',body:{action}});
   setItems(current=>current.filter(invitation=>invitation.id!==item.id));
   notify?.(result.message||'Tu respuesta se registró correctamente.');
  }catch(e){setError(e.message||'No se pudo '+verb+' la invitación.');}
  finally{setBusyId(null);setReload(value=>value+1);}
 }

 return <Panel title="Invitaciones de asociaciones" subtitle="Revisa las solicitudes que las asociaciones te han enviado.">
  <ErrorBanner message={error}/>
  {loading?<div className="association-loading"><RefreshCw className="spin"/> Consultando invitaciones…</div>
   :!items.length?<div className="empty-state"><CheckCircle2 size={22}/><strong>No tienes invitaciones pendientes</strong><span>Cuando una asociación quiera incorporarte, aparecerá aquí.</span></div>
   :<div className="athlete-invitation-list">{items.map(item=><article className="athlete-invitation-card" key={item.id}>
    <div className="athlete-invitation-icon"><Building2 size={21}/></div>
    <div className="athlete-invitation-info"><strong>{item.association?.name||'Asociación'}</strong><span>Invitación de {item.invitedBy?.nombre||item.invitedBy?.username||'un administrador'}</span><small><Clock3 size={13}/> Vence {dateLabel(item.expiresAt)}</small></div>
    <Badge tone="success">Pendiente</Badge>
    <div className="athlete-invitation-actions">
     <Button variant="primary" icon={CheckCircle2} loading={busyId===item.id} disabled={busyId!==null} onClick={()=>respond(item,'accept')}>Aceptar</Button>
     <Button variant="ghost" icon={XCircle} disabled={busyId!==null} onClick={()=>respond(item,'decline')}>Rechazar</Button>
    </div>
   </article>)}</div>}
  <div className="panel-footer-actions"><Button variant="ghost" icon={RefreshCw} disabled={loading||busyId!==null} onClick={()=>setReload(value=>value+1)}>Actualizar invitaciones</Button></div>
 </Panel>;
}
