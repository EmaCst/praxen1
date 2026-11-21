import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {Building2,Plus,Search,RefreshCw,Edit3,Power,Users,UserPlus,UserMinus,CheckCircle2,Globe2,ShieldCheck,ChevronRight,ArrowLeft,Layers3} from 'lucide-react';
import {qs} from '../api';
import {Button,Field,Panel,Empty,ErrorBanner,Modal,Badge,Table} from '../ui';

const slugify=value=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
const messageFor=error=>error?.message||'No se pudo completar la operación.';

export default function Associations({call,currentUser,notify,onContextUpdated}){
  const superadmin=currentUser?.role==='superadmin';
  const [associations,setAssociations]=useState([]);
  const [context,setContext]=useState(null);
  const [selected,setSelected]=useState(null);
  const [administrators,setAdministrators]=useState([]);
  const [availableAdmins,setAvailableAdmins]=useState([]);
  const [pendingAdminIds,setPendingAdminIds]=useState([]);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(true);
  const [detailLoading,setDetailLoading]=useState(false);
  const [error,setError]=useState('');
  const [modal,setModal]=useState(null);
  const [name,setName]=useState('');
  const [slug,setSlug]=useState('');
  const [slugTouched,setSlugTouched]=useState(false);
  const [adminId,setAdminId]=useState('');
  const [busy,setBusy]=useState(false);
  const [refresh,setRefresh]=useState(0);

  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{
      const [list,ctx]=await Promise.all([
        call('/api/admin/asociaciones'),
        call('/api/admin/contexto-asociacion').catch(()=>null)
      ]);
      setAssociations(list.asociaciones||[]);
      setContext(ctx);
      if(ctx?.activeAssociationId){
        const active=(list.asociaciones||[]).find(item=>Number(item.id)===Number(ctx.activeAssociationId));
        if(active&&!selected)setSelected(active);
      }
    }catch(e){setError(messageFor(e));}
    finally{setLoading(false);}
  },[call,refresh]);
  useEffect(()=>{load();},[load]);

  const loadAdministrators=useCallback(async association=>{
    if(!association||!superadmin)return;
    setDetailLoading(true);setError('');
    try{
      const result=await call('/api/admin/asociaciones/'+association.id+'/administradores');
      setAdministrators(result.administradores||[]);
    }catch(e){setError(messageFor(e));setAdministrators([]);}
    finally{setDetailLoading(false);}
  },[call,superadmin]);
  useEffect(()=>{if(selected&&superadmin)loadAdministrators(selected);},[selected?.id,superadmin,refresh]);

  async function openAssociation(item){
    setSelected(item);
    setAdministrators([]);
    if(superadmin)await loadAdministrators(item);
  }
  function startCreate(){setName('');setSlug('');setSlugTouched(false);setModal({type:'create'});}
  function startEdit(item){setName(item.name);setSlug(item.slug);setSlugTouched(true);setModal({type:'edit',item});}
  async function saveAssociation(event){
    event.preventDefault();setBusy(true);setError('');
    try{
      const body={name:name.trim(),slug:(slugTouched?slug:slugify(name)).trim()};
      if(modal.type==='create')await call('/api/admin/asociaciones',{method:'POST',body});
      else await call('/api/admin/asociaciones/'+modal.item.id,{method:'PATCH',body});
      setModal(null);await load();notify(modal.type==='create'?'Asociación creada correctamente.':'Asociación actualizada.');
    }catch(e){setError(messageFor(e));}
    finally{setBusy(false);}
  }
  async function toggleAssociation(item){
    const action=item.isActive?'desactivar':'activar';
    if(!window.confirm('¿Deseas '+action+' la asociación '+item.name+'?'))return;
    setBusy(true);setError('');
    try{
      await call('/api/admin/asociaciones/'+item.id+'/estado',{method:'PATCH',body:{isActive:!item.isActive}});
      await load();
      if(selected?.id===item.id)setSelected({...item,isActive:!item.isActive});
      notify('Estado de la asociación actualizado.');
    }catch(e){setError(messageFor(e));}
    finally{setBusy(false);}
  }
  async function loadAvailableAdmins(){
    try{
      const [result,requests]=await Promise.all([
        call('/api/admin/administradores'+qs({limit:100,offset:0})),
        call('/api/admin/asociaciones/'+selected.id+'/solicitudes-administrador'+qs({status:'pending',limit:100}))
      ]);
      setAvailableAdmins((result.administradores||[]).filter(item=>item.role==='admin'&&item.isActive!==false));
      setPendingAdminIds((requests.solicitudes||[]).map(item=>Number(item.target?.id)));
    }catch(e){setError(messageFor(e));}
  }
  async function startAssign(){
    setAdminId('');setModal({type:'assign'});
    await loadAvailableAdmins();
  }
  async function assignAdmin(event){
    event.preventDefault();if(!adminId||!selected)return;
    setBusy(true);setError('');
    try{
      const hasActiveAdmins=administrators.some(item=>item.membershipActive&&item.isActive!==false);
      const endpoint=hasActiveAdmins?'/solicitudes-administrador':'/administradores';
      await call('/api/admin/asociaciones/'+selected.id+endpoint,{method:'POST',body:{userId:Number(adminId)}});
      setModal(null);await loadAdministrators(selected);
      notify(hasActiveAdmins?'Solicitud enviada a los administradores de '+selected.name+'.':'Primer administrador asignado a '+selected.name+'.');
    }catch(e){setError(messageFor(e));}
    finally{setBusy(false);}
  }
  async function revokeAdmin(item){
    if(!window.confirm('¿Revocar el acceso de '+item.nombre+' a '+selected.name+'? Su cuenta no será eliminada.'))return;
    setBusy(true);setError('');
    try{
      await call('/api/admin/asociaciones/'+selected.id+'/administradores/'+item.id,{method:'DELETE'});
      await loadAdministrators(selected);notify('Membresía revocada. La cuenta se conserva.');
    }catch(e){setError(messageFor(e));}
    finally{setBusy(false);}
  }
  async function selectContext(event){
    const associationId=Number(event.target.value);if(!associationId)return;
    setBusy(true);setError('');
    try{
      const result=await call('/api/admin/contexto-asociacion',{method:'PUT',body:{associationId}});
      setContext({...context,activeAssociationId:associationId,requiresSelection:false});
      onContextUpdated?.(associationId,result.activeAssociation?.name);
      notify('Ahora estás trabajando en '+(result.activeAssociation?.name||'la asociación seleccionada')+'.');
      setRefresh(value=>value+1);
    }catch(e){setError(messageFor(e));}
    finally{setBusy(false);}
  }

  const filtered=useMemo(()=>associations.filter(item=>(item.name+' '+item.slug).toLowerCase().includes(search.toLowerCase())),[associations,search]);
  const activeCount=associations.filter(item=>item.isActive!==false).length;
  const currentAssociation=associations.find(item=>Number(item.id)===Number(context?.activeAssociationId));
  const activeAdminCount=administrators.filter(item=>item.membershipActive&&item.isActive!==false).length;
  const assignedIds=new Set(administrators.filter(item=>item.membershipActive&&item.isActive!==false).map(item=>Number(item.id)));
  const candidates=availableAdmins.filter(item=>!assignedIds.has(Number(item.id))&&!pendingAdminIds.includes(Number(item.id)));

  if(selected&&superadmin){
    return <div className="association-page">
      <div className="page-title association-title">
        <div><div className="overline">ADMINISTRACIÓN INSTITUCIONAL</div><h1>{selected.name}</h1><p className="muted">Gestiona las cuentas administrativas que tienen acceso a esta asociación.</p></div>
        <Button onClick={()=>{setSelected(null);setError('')}}> <ArrowLeft size={16}/> Volver a asociaciones</Button>
      </div>
      <ErrorBanner message={error}/>
      <div className="association-detail-strip">
        <div className="association-detail-icon"><Building2 size={23}/></div>
        <div><strong>{selected.name}</strong><span>/{selected.slug} · ID #{selected.id}</span></div>
        <Badge tone={selected.isActive===false?'off':'success'}>{selected.isActive===false?'Inactiva':'Activa'}</Badge>
        <div className="association-strip-actions"><Button onClick={()=>startEdit(selected)} icon={Edit3}>Editar</Button><Button variant={selected.isActive===false?'primary':'danger'} onClick={()=>toggleAssociation(selected)} icon={Power}>{selected.isActive===false?'Activar':'Desactivar'}</Button></div>
      </div>
      <Panel title="Administradores asignados" subtitle={administrators.length+' cuentas vinculadas'} action={<Button variant="primary" icon={UserPlus} onClick={startAssign} disabled={detailLoading||selected.isActive===false}>{activeAdminCount===0?"Asignar primer administrador":"Solicitar administrador"}</Button>}>
        {detailLoading?<div className="association-loading"><RefreshCw className="spin"/> Cargando administradores…</div>:<Table headers={['Cuenta','Usuario','Estado de membresía','Estado de cuenta','Acciones']} empty={!administrators.length}>
          {administrators.map(item=><tr key={item.id}><td><strong>{item.nombre}</strong></td><td>@{item.username}</td><td><Badge tone={item.membershipActive?'success':'off'}>{item.membershipActive?'Asignado':'Revocado'}</Badge></td><td><Badge tone={item.isActive?'success':'off'}>{item.isActive?'Activa':'Inactiva'}</Badge></td><td>{item.membershipActive?<button className="link-action danger-text" onClick={()=>revokeAdmin(item)}><UserMinus size={14}/> Revocar acceso</button>:<span className="muted">Sin acceso</span>}</td></tr>)}
        </Table>}
      </Panel>
      <Panel title="Consideraciones" subtitle="La gestión respeta las reglas de seguridad de la API.">
        <div className="association-info-grid"><div><ShieldCheck size={19}/><strong>Roles protegidos</strong><span>Solo se asignan cuentas con rol Administrador. No se promueven deportistas ni superadministradores.</span></div><div><Users size={19}/><strong>Cuenta independiente</strong><span>Revocar una membresía no elimina la cuenta ni sus asignaciones en otras asociaciones.</span></div><div><CheckCircle2 size={19}/><strong>Auditoría</strong><span>Las asignaciones y revocaciones quedan registradas por la API.</span></div></div>
      </Panel>
      {modal&&<Modal title={modal.type==='edit'?'Editar asociación':activeAdminCount===0?'Asignar primer administrador':'Solicitar incorporación de administrador'} onClose={()=>!busy&&setModal(null)}>
        {modal.type==='edit'?<form className="stack" onSubmit={saveAssociation}><Field label="Nombre de la asociación"><input required minLength={2} maxLength={160} value={name} onChange={e=>{setName(e.target.value);if(!slugTouched)setSlug(slugify(e.target.value));}}/></Field><Field label="Identificador (slug)"><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} value={slug} onChange={e=>{setSlugTouched(true);setSlug(e.target.value);}}/><small>Solo minúsculas, números y guiones.</small></Field><ErrorBanner message={error}/><Button type="submit" variant="primary" loading={busy}>Guardar cambios</Button></form>:<form className="stack" onSubmit={assignAdmin}><Field label="Cuenta de administrador"><select required value={adminId} onChange={e=>setAdminId(e.target.value)}><option value="">Selecciona una cuenta…</option>{candidates.map(item=><option key={item.id} value={item.id}>{item.nombre} · @{item.username}</option>)}</select></Field>{!candidates.length&&<p className="muted">No hay administradores activos disponibles para asignar.</p>}<ErrorBanner message={error}/><Button type="submit" variant="primary" loading={busy} disabled={!adminId||!candidates.length}>{activeAdminCount===0?"Asignar primer administrador":"Enviar solicitud de incorporación"}</Button></form>}
      </Modal>}
    </div>;
  }

  return <div className="association-page">
    <div className="page-title association-title">
      <div><div className="overline">{superadmin?'CONTROL GLOBAL':'ESPACIO INSTITUCIONAL'}</div><h1>Asociaciones</h1><p className="muted">{superadmin?'Administra las instituciones y delega el acceso de sus administradores.':'Consulta tus asociaciones y selecciona el espacio de trabajo activo.'}</p></div>
      {superadmin&&<Button variant="primary" icon={Plus} onClick={startCreate}>Nueva asociación</Button>}
    </div>
    <ErrorBanner message={error}/>
    {!superadmin&&context?.associations?.length>1&&<div className="association-context">
      <div><span className="context-eyebrow">ASOCIACIÓN ACTIVA</span><strong>{currentAssociation?.name||'Selecciona tu espacio de trabajo'}</strong><small>Los datos y operaciones del panel se limitarán a esta asociación.</small></div>
      <Field label="Cambiar asociación"><select value={context.activeAssociationId||''} onChange={selectContext} disabled={busy}><option value="">Seleccionar…</option>{context.associations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    </div>}
    <div className="association-stats">
      <div><span><Building2 size={17}/> Asociaciones</span><strong>{loading?'—':associations.length}</strong></div>
      <div><span><CheckCircle2 size={17}/> Activas</span><strong>{loading?'—':activeCount}</strong></div>
      <div><span><Globe2 size={17}/> Alcance</span><strong>{superadmin?'Global':'Asignado'}</strong></div>
    </div>
    <Panel title="Directorio de asociaciones" subtitle={superadmin?'Todas las asociaciones registradas en Praxen.':'Asociaciones a las que tu cuenta tiene acceso.'} action={<Button icon={RefreshCw} onClick={()=>setRefresh(value=>value+1)} loading={loading}>Actualizar</Button>}>
      <div className="toolbar"><div className="search-input"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar asociación…"/></div></div>
      {loading?<div className="association-loading"><RefreshCw className="spin"/> Cargando asociaciones…</div>:<div className="association-grid">
        {filtered.map(item=><article className="association-card" key={item.id}>
          <div className="association-card-top"><div className="association-card-icon"><Building2 size={21}/></div><Badge tone={item.isActive===false?'off':'success'}>{item.isActive===false?'Inactiva':'Activa'}</Badge></div>
          <h3>{item.name}</h3><p>/{item.slug}</p><div className="association-card-meta"><span>ID #{item.id}</span>{item.isCurrent&&<Badge tone="light">Actual</Badge>}</div>
          {superadmin?<div className="association-card-actions"><Button onClick={()=>openAssociation(item)} icon={Users}>Administradores</Button><button className="icon-button" title="Editar asociación" onClick={()=>startEdit(item)}><Edit3 size={17}/></button><button className="icon-button" title={item.isActive===false?'Activar':'Desactivar'} onClick={()=>toggleAssociation(item)}><Power size={17}/></button></div>:<div className="association-card-actions"><span className="muted">{item.isCurrent?'Espacio actual':'Acceso disponible'}</span>{item.isCurrent&&<Badge tone="success">En uso</Badge>}</div>}
        </article>)}
        {!filtered.length&&<div className="association-empty"><Empty>{search?'No encontramos asociaciones con esa búsqueda.':'Todavía no hay asociaciones disponibles para esta cuenta.'}</Empty></div>}
      </div>}
    </Panel>
    {modal&&<Modal title="Nueva asociación" onClose={()=>!busy&&setModal(null)}><form className="stack" onSubmit={saveAssociation}><Field label="Nombre de la asociación"><input required minLength={2} maxLength={160} autoFocus value={name} onChange={e=>{setName(e.target.value);if(!slugTouched)setSlug(slugify(e.target.value));}} placeholder="Ej. Asociación Nacional de Natación"/></Field><Field label="Identificador (slug)"><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={80} value={slug} onChange={e=>{setSlugTouched(true);setSlug(e.target.value);}} placeholder="asociacion-nacional-natacion"/><small>Se genera a partir del nombre y puedes ajustarlo.</small></Field><ErrorBanner message={error}/><Button type="submit" variant="primary" loading={busy}>Crear asociación</Button></form></Modal>}
  </div>;
}
