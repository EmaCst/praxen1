import React,{useCallback,useEffect,useState} from 'react';
import {RefreshCw,Search,Send,ShieldCheck,Trash2,UserRound} from 'lucide-react';
import {qs} from '../api';
import {Button,Field,Panel,Empty,ErrorBanner,Modal,Pager,Table,Badge} from '../ui';

const statusLabel={pending:'Pendiente',accepted:'Aceptada',declined:'Rechazada',expired:'Vencida',revoked:'Revocada'};
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
 const [searchText,setSearchText]=useState('');
 const [searchResults,setSearchResults]=useState([]);
 const [searchLoading,setSearchLoading]=useState(false);
 const [searchPerformed,setSearchPerformed]=useState(false);
 const [selectedAthlete,setSelectedAthlete]=useState(null);
 const [created,setCreated]=useState(null);
 const [refresh,setRefresh]=useState(0);

 useEffect(()=>{
  if(superadmin){if(!associationId&&availableAssociations.length===1)setAssociationId(String(availableAssociations[0].id));}
  else if(associationContext?.activeAssociationId)setAssociationId(String(associationContext.activeAssociationId));
 },[superadmin,associationContext?.activeAssociationId,availableAssociations,associationId]);

 const selectedAssociation=availableAssociations.find(item=>String(item.id)===String(associationId));

 useEffect(()=>{
  if(!modal||selectedAthlete){setSearchLoading(false);return;}
  const term=searchText.trim();
  if(!term){setSearchResults([]);setSearchPerformed(false);setSearchLoading(false);return;}
  const controller=new AbortController();
  setSearchLoading(false);
  setSearchPerformed(false);
  const timeout=setTimeout(async()=>{
   setSearchLoading(true);
   try{
    const result=await call('/api/admin/directorio/deportistas'+qs({search:term,limit:10}),{force:true,signal:controller.signal});
    if(!controller.signal.aborted){setSearchResults(result.deportistas||[]);setSearchPerformed(true);}
   }catch(e){
    if(!controller.signal.aborted&&e.name!=='AbortError')setError(e.message||'No se pudo buscar deportistas.');
   }finally{
    if(!controller.signal.aborted)setSearchLoading(false);
   }
  },400);
  return()=>{clearTimeout(timeout);controller.abort();};
 },[modal,searchText,selectedAthlete,call]);

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
  event.preventDefault();if(!associationId||!selectedAthlete?.username)return;
  setBusy(true);setError('');
  try{
   const result=await call('/api/admin/asociaciones/'+associationId+'/invitaciones',{method:'POST',body:{username:selectedAthlete.username}});
   setCreated(result.invitacion);
   setSearchText('');setSearchResults([]);setSelectedAthlete(null);setModal(false);setStatus('all');setPage(0);setRefresh(v=>v+1);
   notify?.('Invitación creada. Ya está disponible en la bandeja del deportista.');
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

 return <div className="invitations-page">
  <div className="page-title">
   <div><div className="overline">GESTIÓN INSTITUCIONAL</div><h1>Invitaciones</h1><p className="muted">Incorpora deportistas a una asociación y administra sus invitaciones.</p></div>
   <Button variant="primary" icon={Send} onClick={()=>{setSearchText('');setSearchResults([]);setSelectedAthlete(null);setSearchPerformed(false);setError('');setModal(true);}} disabled={!associationId}>Invitar deportista</Button>
  </div>
  <ErrorBanner message={error}/>
  <Panel title="Asociación" subtitle="Las invitaciones siempre pertenecen a una asociación específica.">
   {superadmin?<Field label="Seleccionar asociación"><select value={associationId} onChange={e=>{setAssociationId(e.target.value);setPage(0);setCreated(null);}}><option value="">Selecciona una asociación…</option>{availableAssociations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    :<div className="invitation-association"><ShieldCheck size={18}/><strong>{selectedAssociation?.name||'Selecciona una asociación'}</strong></div>}
  </Panel>
  {created&&<Panel title="Invitación creada" subtitle="La solicitud quedó guardada y el deportista puede responderla desde su cuenta.">
   <p><strong>@{created.username}</strong> · {created.association}</p>
   <p className="muted">Estado: Pendiente · Vence: {dateLabel(created.expiresAt)}</p>
   <button className="link-action" onClick={()=>setCreated(null)}>Cerrar</button>
  </Panel>}
  <Panel title="Invitaciones enviadas" subtitle={total+' registros'} action={<Button icon={RefreshCw} onClick={()=>setRefresh(v=>v+1)} loading={loading}>Actualizar</Button>}>
   <div className="toolbar invitation-toolbar">
    <Field label="Estado"><select value={status} onChange={e=>{setStatus(e.target.value);setPage(0);}}><option value="all">Todos</option><option value="pending">Pendientes</option><option value="accepted">Aceptadas</option><option value="declined">Rechazadas</option><option value="expired">Vencidas</option><option value="revoked">Revocadas</option></select></Field>
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
  {modal&&<Modal title="Invitar deportista" onClose={()=>{if(!busy){setModal(false);setSelectedAthlete(null);setSearchText('');}}}>
   <form className="stack" onSubmit={createInvitation}>
    <p className="muted">Busca por nombre o nombre de usuario. Selecciona al deportista y verifica su perfil antes de enviar la invitación.</p>
    {!selectedAthlete?<>
     <Field label="Buscar deportista">
      <div className="athlete-directory-search">
       <Search size={17}/>
       <input autoComplete="off" value={searchText} onChange={e=>{setSearchText(e.target.value);setSearchResults([]);setSearchPerformed(false);setError('');}} placeholder="Nombre o usuario…"/>
      </div>
     </Field>
     {searchLoading&&<div className="athlete-search-status"><RefreshCw className="spin" size={15}/> Buscando deportistas…</div>}
     {!searchLoading&&searchPerformed&&searchResults.length===0&&<div className="athlete-search-empty">No encontramos deportistas con ese nombre o usuario.</div>}
     {!searchLoading&&searchResults.length>0&&<div className="athlete-search-results" role="listbox" aria-label="Resultados de deportistas">
      {searchResults.map(athlete=><button type="button" className="athlete-search-result" key={athlete.id} onClick={()=>{setSelectedAthlete(athlete);setError('');}}>
       <span className="athlete-search-avatar"><UserRound size={17}/></span>
       <span className="athlete-search-copy"><strong>{athlete.nombre}</strong><small>@{athlete.username||'sin usuario'} · {athlete.federacion||'Sin federación registrada'}</small></span>
       <span className="athlete-search-action">Seleccionar</span>
      </button>)}
     </div>}
    </>:<>
     <div className="athlete-profile-confirm">
      <div className="athlete-profile-heading"><span className="athlete-search-avatar"><UserRound size={20}/></span><div><strong>{selectedAthlete.nombre}</strong><small>Perfil del deportista</small></div></div>
      <dl>
       <div><dt>Nombre de usuario</dt><dd>@{selectedAthlete.username||'No disponible'}</dd></div>
       <div><dt>Federación</dt><dd>{selectedAthlete.federacion||'No registrada'}</dd></div>
       <div><dt>Fecha de registro</dt><dd>{dateLabel(selectedAthlete.createdAt)}</dd></div>
      </dl>
      <p>Confirma que este sea el deportista correcto antes de continuar.</p>
     </div>
     <button type="button" className="link-action" onClick={()=>{setSelectedAthlete(null);}}>← Elegir otro deportista</button>
    </>}
    <ErrorBanner message={error}/>
    <Button type="submit" variant="primary" loading={busy} disabled={!selectedAthlete?.username}>Crear invitación</Button>
   </form>
  </Modal>}
 </div>;
}
