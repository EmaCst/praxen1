import React,{useCallback,useEffect,useMemo,useState} from 'react';
import {ShieldCheck,CheckCircle2,XCircle,Clock3,RefreshCw,Building2,History,Send} from 'lucide-react';
import {qs} from '../api';
import {Button,Field,Panel,Empty,ErrorBanner,Badge,Table} from '../ui';

const labels={
  admin_created:'Cuenta administrativa creada',
  association_admin_account_deactivated:'Cuenta administrativa desactivada',
  association_admin_account_reactivated:'Cuenta administrativa reactivada',
  association_admin_assigned_initial:'Asignación del primer administrador',
  association_admin_request_created:'Solicitud de incorporación creada',
  association_admin_request_approved:'Solicitud aprobada',
  association_admin_request_rejected:'Solicitud rechazada',
  association_admin_revoked:'Acceso de administrador revocado',
};
const statusLabel={pending:'Pendiente',approved:'Aprobada',rejected:'Rechazada'};
const formatDate=value=>value?new Date(value).toLocaleString('es-GT',{dateStyle:'medium',timeStyle:'short'}):'—';

export default function AdminRequests({call,currentUser,associationContext,associationList,scopeAssociationId,notify}){
  const superadmin=currentUser?.role==='superadmin';
  const availableAssociations=superadmin?associationList:(associationContext?.associations||[]);
  const [associationId,setAssociationId]=useState('');
  const [requests,setRequests]=useState([]);
  const [audit,setAudit]=useState([]);
  const [admins,setAdmins]=useState([]);
  const [candidates,setCandidates]=useState([]);
  const [candidateId,setCandidateId]=useState('');
  const [loading,setLoading]=useState(false);
  const [busyId,setBusyId]=useState(null);
  const [error,setError]=useState('');
  const [refresh,setRefresh]=useState(0);

  useEffect(()=>{
    if(superadmin){
      const preferred=scopeAssociationId||availableAssociations.find(item=>item.isActive!==false)?.id||'';
      setAssociationId(String(preferred||''));
    }else{
      setAssociationId(String(associationContext?.activeAssociationId||(associationContext?.associations?.length===1?associationContext.associations[0].id:'')));
    }
  },[superadmin,scopeAssociationId,associationContext?.activeAssociationId,availableAssociations]);

  const selectedAssociation=useMemo(()=>availableAssociations.find(item=>Number(item.id)===Number(associationId)),[availableAssociations,associationId]);
  const load=useCallback(async()=>{
    if(!associationId)return;
    setLoading(true);setError('');
    try{
      const [requestData,auditData]=await Promise.all([
        call('/api/admin/asociaciones/'+associationId+'/solicitudes-administrador'+qs({limit:50})),
        call('/api/admin/asociaciones/'+associationId+'/auditoria-administradores'+qs({limit:50}))
      ]);
      setRequests(requestData.solicitudes||[]);
      setAudit(auditData.eventos||[]);
      if(superadmin){
        const [adminData,accountData]=await Promise.all([
          call('/api/admin/asociaciones/'+associationId+'/administradores'),
          call('/api/admin/administradores'+qs({limit:100,offset:0}))
        ]);
        const rows=adminData.administradores||[];
        setAdmins(rows);
        const assigned=new Set(rows.filter(item=>item.membershipActive&&item.isActive!==false).map(item=>Number(item.id)));
        const pending=new Set((requestData.solicitudes||[]).filter(item=>item.status==='pending').map(item=>Number(item.target?.id)));
        setCandidates((accountData.administradores||[]).filter(item=>item.role==='admin'&&item.isActive!==false&&!assigned.has(Number(item.id))&&!pending.has(Number(item.id))));
      }else{
        setAdmins([]);
        setCandidates([]);
      }
    }catch(e){setError(e.message||'No se pudo cargar la información de solicitudes.');}
    finally{setLoading(false);}
  },[call,associationId,superadmin,refresh]);
  useEffect(()=>{load();},[load]);

  async function submitRequest(event){
    event.preventDefault();
    if(!associationId||!candidateId)return;
    setBusyId('create');setError('');
    try{
      const activeAdmins=admins.filter(item=>item.membershipActive&&item.isActive!==false).length;
      if(activeAdmins===0){
        await call('/api/admin/asociaciones/'+associationId+'/administradores',{method:'POST',body:{userId:Number(candidateId)}});
        notify?.('Primer administrador asignado correctamente.');
      }else{
        await call('/api/admin/asociaciones/'+associationId+'/solicitudes-administrador',{method:'POST',body:{userId:Number(candidateId)}});
        notify?.('Solicitud enviada a los administradores de la asociación.');
      }
      setCandidateId('');
      setRefresh(value=>value+1);
    }catch(e){setError(e.message||'No se pudo enviar la solicitud.');}
    finally{setBusyId(null);}
  }

  async function decide(request,decision){
    const action=decision==='approved'?'aprobar':'rechazar';
    if(!window.confirm('¿Deseas '+action+' la incorporación de '+(request.target?.nombre||request.target?.username||'esta cuenta')+'?'))return;
    setBusyId(request.id);setError('');
    try{
      await call('/api/admin/asociaciones/'+associationId+'/solicitudes-administrador/'+request.id,{method:'PATCH',body:{decision}});
      notify?.(decision==='approved'?'Solicitud aprobada. El administrador ya tiene acceso.':'Solicitud rechazada.');
      setRefresh(value=>value+1);
    }catch(e){setError(e.message||'No se pudo resolver la solicitud.');}
    finally{setBusyId(null);}
  }

  const pending=requests.filter(item=>item.status==='pending');
  const activeAdmins=admins.filter(item=>item.membershipActive&&item.isActive!==false).length;

  return <div className="admin-requests-page">
    <div className="page-title"><div><div className="overline">CONTROL DE ACCESO</div><h1>Solicitudes de administradores</h1><p className="muted">Revisa las incorporaciones propuestas y consulta el historial de acciones administrativas.</p></div></div>
    <ErrorBanner message={error}/>
    {superadmin&&<Panel title="Asociación" subtitle="Selecciona dónde deseas gestionar las solicitudes.">
      <Field label="Asociación"><select value={associationId} onChange={event=>setAssociationId(event.target.value)}><option value="">Seleccionar asociación…</option>{availableAssociations.filter(item=>item.isActive!==false).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    </Panel>}
    {associationId&&selectedAssociation&&<>
      <div className="association-detail-strip"><div className="association-detail-icon"><Building2 size={22}/></div><div><strong>{selectedAssociation.name}</strong><span>{activeAdmins} administrador(es) activo(s)</span></div><Badge tone="light">{superadmin?'Gestión global':'Tu asociación'}</Badge></div>
      {superadmin&&<Panel title={activeAdmins===0?'Asignar primer administrador':'Solicitar incorporación'} subtitle={activeAdmins===0?'La asociación no tiene administradores activos. La asignación inicial se realizará directamente.':'La solicitud quedará pendiente hasta que un administrador actual la apruebe.'}>
        <form className="stack" onSubmit={submitRequest}>
          <Field label="Cuenta de administrador"><select required value={candidateId} onChange={event=>setCandidateId(event.target.value)}><option value="">Seleccionar cuenta…</option>{candidates.map(item=><option key={item.id} value={item.id}>{item.nombre} · @{item.username}</option>)}</select></Field>
          <Button type="submit" variant="primary" loading={busyId==='create'} disabled={loading||!candidateId} icon={Send}>{activeAdmins===0?'Asignar primer administrador':'Enviar solicitud'}</Button>
        </form>
      </Panel>}
      <Panel title="Solicitudes pendientes" subtitle={pending.length+' pendiente(s)'} action={<Button icon={RefreshCw} onClick={()=>setRefresh(value=>value+1)} loading={loading}>Actualizar</Button>}>
        {loading?<div className="association-loading"><RefreshCw className="spin"/> Cargando…</div>:<Table headers={['Cuenta propuesta','Solicitada por','Fecha','Estado','Decisión']} empty={!pending.length}>
          {pending.map(item=><tr key={item.id}><td><strong>{item.target?.nombre||'Cuenta'}</strong><div className="muted">@{item.target?.username||'—'}</div></td><td>{item.requestedBy?.nombre||'Superadmin'}</td><td>{formatDate(item.createdAt)}</td><td><Badge tone="warning"><Clock3 size={13}/> Pendiente</Badge></td><td>{!superadmin?<div className="request-actions"><button className="link-action" disabled={busyId===item.id} onClick={()=>decide(item,'approved')}><CheckCircle2 size={14}/> Aprobar</button><button className="link-action danger-text" disabled={busyId===item.id} onClick={()=>decide(item,'rejected')}><XCircle size={14}/> Rechazar</button></div>:<span className="muted">En espera de decisión</span>}</td></tr>)}
        </Table>}
      </Panel>
      <Panel title="Historial de auditoría" subtitle="Registro cronológico de solicitudes, asignaciones y revocaciones.">
        {loading?<div className="association-loading"><RefreshCw className="spin"/> Cargando…</div>:<Table headers={['Fecha','Acción','Actor','Cuenta afectada']} empty={!audit.length}>
          {audit.map(item=><tr key={item.id}><td>{formatDate(item.createdAt)}</td><td>{labels[item.action]||item.action}</td><td>{item.actor?.nombre||'#'+item.actorUserId}</td><td>{item.target?.nombre||'#'+item.targetUserId}</td></tr>)}
        </Table>}
      </Panel>
    </>}
    {!associationId&&!superadmin&&<Empty>Selecciona una asociación para revisar sus solicitudes.</Empty>}
    {!associationId&&superadmin&&<Empty>Selecciona una asociación para comenzar.</Empty>}
  </div>;
}
