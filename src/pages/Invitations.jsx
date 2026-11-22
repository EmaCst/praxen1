import React,{useCallback,useEffect,useState} from 'react';
import {Copy,RefreshCw,Send,ShieldCheck,Trash2} from 'lucide-react';
import {qs} from '../api';
import {Button,Field,Panel,Empty,ErrorBanner,Modal,Pager,Table,Badge} from '../ui';

const statusLabel={pending:'Pendiente',accepted:'Aceptada',expired:'Vencida',revoked:'Revocada'};
const dateLabel=value=>value?new Date(value).toLocaleString('es-GT',{dateStyle:'medium',timeStyle:'short'}):'—';

export default function Invitations({call,currentUser,associationContext,associationList,notify}){
 const superadmin=currentUser?.role==='superadmin';
 const adminAssociations=associationContext?.associations||[];
 const availableAssociations=superadmin?associationList.filter(item=>item.isActive!==false):adminAssociations;
 const [associationId,setAssociationId]=useState('');
 const [status,setStatus]=useState('all');
 const [items,setItems]=useState([]);
 const [total,setTotal]=useState(0);
 const [page,setPage]=useState(0);
 const [loading,setLoading]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [modal,setModal]=useState(false);
 const [username,setUsername]=useState('');
 const [created,setCreated]=useState(null);
 const [refresh,setRefresh]=useState(0);

 useEffect(()=>{
  if(superadmin){if(!associationId&&availableAssociations.length===1)setAssociationId(String(availableAssociations[0].id));}
  else if(associationContext?.activeAssociationId)setAssociationId(String(associationContext.activeAssociationId));
 },[superadmin,associationContext?.activeAssociationId,availableAssociations,associationId]);

 const selectedAssociation=availableAssociations.find(item=>String(item.id)===String(associationId));
 const load=useCallback(async()=>{
  if(!associationId){setItems([]);setTotal(0);return;}
  setLoading(true);setError('');
  try{
   const query=qs({limit:25,offset:page*25,status:status==='all'?undefined:status});
   const result=await call('/api/admin/asociaciones/'+associationId+'/invitaciones'+query);
   setItems(result.invitaciones||[]);setTotal(result.total||0);
  }catch(e){setError(e.message||'No se pudieron cargar las invitaciones.');}
  finally{setLoading(false);}
 },[call,associationId,status,page,refresh]);
 useEffect(()=>{load();},[load]);

 async function createInvitation(event){
  event.preventDefault();if(!associationId||!username.trim())return;
  setBusy(true);setError('');
  try{
   const result=await call('/api/admin/asociaciones/'+associationId+'/invitaciones',{method:'POST',body:{username:username.trim()}});
   setCreated({token:result.token,invitation:result.invitacion});
   setUsername('');setModal(false);setStatus('all');setPage(0);setRefresh(v=>v+1);
   notify?.('Invitación creada. Copia el código y compártelo con el deportista.');
  }catch(e){setError(e.message||'No se pudo crear la invitación.');}
  finally{setBusy(false);}
 }
 async function revoke(item){
  if(!window.confirm('¿Revocar la invitación enviada a @'+item.username+'? El deportista ya no podrá aceptarla.'))return;
  setBusy(true);setError('');
  try{
   await call('/api/admin/asociaciones/'+associationId+'/invitaciones/'+item.id,{method:'DELETE'});
   setRefresh(v=>v+1);notify?.('Invitación revocada.');
  }catch(e){setError(e.message||'No se pudo revocar la invitación.');}
  finally{setBusy(false);}
 }
 async function copyToken(){
  if(!created?.token)return;
  try{await navigator.clipboard.writeText(created.token);notify?.('Código copiado.');}
  catch{setError('No se pudo copiar automáticamente. Selecciona y copia el código manualmente.');}
 }

 return <div className="invitations-page">
  <div className="page-title">
   <div><div className="overline">GESTIÓN INSTITUCIONAL</div><h1>Invitaciones</h1><p className="muted">Incorpora deportistas a una asociación y administra sus invitaciones.</p></div>
   <Button variant="primary" icon={Send} onClick={()=>{setUsername('');setError('');setModal(true);}} disabled={!associationId}>Invitar deportista</Button>
  </div>
  <ErrorBanner message={error}/>
  <Panel title="Asociación" subtitle="Las invitaciones siempre pertenecen a una asociación específica.">
   {superadmin?<Field label="Seleccionar asociación"><select value={associationId} onChange={e=>{setAssociationId(e.target.value);setPage(0);setCreated(null);}}><option value="">Selecciona una asociación…</option>{availableAssociations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    :<div className="invitation-association"><ShieldCheck size={18}/><strong>{selectedAssociation?.name||'Selecciona una asociación'}</strong></div>}
  </Panel>
  {created&&<Panel title="Invitación creada" subtitle="Este código se muestra una sola vez. Cópialo y compártelo con el deportista.">
   <div className="invitation-token"><code>{created.token}</code><Button icon={Copy} onClick={copyToken}>Copiar código</Button></div>
   <p className="muted">Cuenta: @{created.invitation?.username} · Vence: {dateLabel(created.invitation?.expiresAt)}</p>
   <button className="link-action" onClick={()=>setCreated(null)}>Cerrar y ocultar código</button>
  </Panel>}
  <Panel title="Invitaciones enviadas" subtitle={total+' registros'} action={<Button icon={RefreshCw} onClick={()=>setRefresh(v=>v+1)} loading={loading}>Actualizar</Button>}>
   <div className="toolbar invitation-toolbar">
    <Field label="Estado"><select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="all">Todos</option><option value="pending">Pendientes</option><option value="accepted">Aceptadas</option><option value="expired">Vencidas</option><option value="revoked">Revocadas</option></select></Field>
   </div>
   {loading?<div className="association-loading"><RefreshCw className="spin"/> Cargando invitaciones…</div>:<Table headers={['Deportista','Estado','Enviada','Vencimiento','Creada por','Acciones']} empty={!items.length}>
    {items.map(item=><tr key={item.id}>
     <td><strong>@{item.username}</strong></td>
     <td><Badge tone={item.status==='pending'?'success':item.status==='revoked'?'off':'light'}>{statusLabel[item.status]||item.status}</Badge></td>
     <td>{dateLabel(item.createdAt)}</td><td>{dateLabel(item.expiresAt)}</td>
     <td>{item.createdBy?.nombre||item.createdBy?.username||'—'}</td>
     <td>{item.status==='pending'?<button className="link-action danger-text" disabled={busy} onClick={()=>revoke(item)}><Trash2 size={14}/> Revocar</button>:<span className="muted">—</span>}</td>
    </tr>)}
   </Table>}
   <Pager total={total} page={page} size={25} onPage={setPage}/>
  </Panel>
  {modal&&<Modal title="Invitar deportista" onClose={()=>!busy&&setModal(false)}>
   <form className="stack" onSubmit={createInvitation}>
    <p className="muted">Se enviará una invitación a una cuenta de deportista ya registrada. La persona deberá iniciar sesión y aceptar el código.</p>
    <Field label="Nombre de usuario"><input required maxLength={32} autoComplete="off" value={username} onChange={e=>setUsername(e.target.value)} placeholder="usuario_deportista"/></Field>
    <ErrorBanner message={error}/>
    <Button type="submit" variant="primary" loading={busy} disabled={!username.trim()}>Crear invitación</Button>
   </form>
  </Modal>}
 </div>;
}
