import React,{useEffect,useState} from 'react';
import {Activity,Clock3,Target,RefreshCw,UserRound,CalendarDays} from 'lucide-react';
import {qs} from '../api';
import {TYPES,num,date,duration,mode,exerciseNames} from '../lib';
import {Button,Panel,Empty,ErrorBanner,ExerciseCards,SparkLines,Badge,Table,Pager} from '../ui';

// Portal individual: todas las peticiones usan /api/resultados/me.
// La identidad del deportista se determina exclusivamente mediante el JWT validado por la API.
export default function MyResults({call,user,athleteId,refreshVersion}){
  const [summary,setSummary]=useState(null);
  const [latest,setLatest]=useState(null);
  const [series,setSeries]=useState([]);
  const [sessions,setSessions]=useState([]);
  const [total,setTotal]=useState(0);
  const [page,setPage]=useState(0);
  const [exercise,setExercise]=useState('aimlab');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(true);
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let alive=true;setLoading(true);setError('');
    const query=qs({exerciseType:exercise,limit:40});
    Promise.allSettled([
      call('/api/resultados/me/resumen'),
      call('/api/resultados/me/ultima'),
      call('/api/resultados/me/evolucion'+query),
      call('/api/resultados/me/sesiones'+qs({limit:20,offset:page*20}))
    ]).then(results=>{
      if(!alive)return;
      const [a,b,c,d]=results;
      if(a.status==='fulfilled')setSummary(a.value.summary);
      if(b.status==='fulfilled')setLatest(b.value.latest);
      if(c.status==='fulfilled')setSeries(c.value.evolution?.series||[]);
      else setSeries([]);
      if(d.status==='fulfilled'){setSessions(d.value.sesiones||[]);setTotal(d.value.total||0);}
      const failed=results.filter(r=>r.status==='rejected');
      if(failed.length)setError(failed.map(r=>r.reason?.message||'No se pudo cargar un apartado.').join(' · '));
    }).finally(()=>{if(alive)setLoading(false)});
    return()=>{alive=false};
  },[call,exercise,page,refreshVersion,reload]);
  const types=Object.entries(TYPES);
  const lastDuration=latest?.startedAt&&latest?.endedAt?(new Date(latest.endedAt)-new Date(latest.startedAt))/1000:null;
  return <>
    <div className="page-title">
      <div><div className="overline">MI ENTRENAMIENTO</div><h1>Hola, {user.nombre?.split(' ')[0]||user.username}</h1><p className="muted">Consulta tus resultados, sesiones y evolución personal de Praxen.</p></div>
      <Button icon={RefreshCw} disabled={loading} onClick={()=>setReload(x=>x+1)}>Actualizar</Button>
    </div>
    <ErrorBanner message={error}/>
    <div className="my-profile-strip">
      <div className="my-profile-avatar"><UserRound size={25}/></div>
      <div><strong>{user.nombre||user.username}</strong><span>@{user.username} · Deportista · Natación</span></div>
      <Badge tone="success">Mis resultados</Badge>
    </div>
    <div className="stats-grid three">
      <article className="stat-card"><div className="stat-top"><span>Sesiones registradas</span><Activity size={19}/></div><strong>{loading?'…':num(summary?.totalSessions)}</strong></article>
      <article className="stat-card"><div className="stat-top"><span>Duración media</span><Clock3 size={19}/></div><strong>{loading?'…':duration(summary?.averageDurationSeconds)}</strong></article>
      <article className="stat-card"><div className="stat-top"><span>Última sesión</span><CalendarDays size={19}/></div><strong className="last-session-value">{loading?'…':date(latest?.startedAt)}</strong></article>
    </div>
    <Panel title="Mis indicadores" subtitle="Cada modalidad conserva sus propias métricas"><ExerciseCards summary={summary}/></Panel>
    <Panel title="Mi evolución" subtitle="Cada punto representa una sesión personal registrada" action={
      <select aria-label="Seleccionar ejercicio" value={exercise} onChange={e=>setExercise(e.target.value)}>{types.map(([key,m])=><option key={key} value={key}>{m.short}</option>)}</select>
    }>
      {loading?<div className="skeleton-chart"/>:<SparkLines series={series}/>}
      {!loading&&series.length===0&&<p className="muted">Selecciona otro ejercicio si ya tienes sesiones de esa modalidad.</p>}
    </Panel>
    {latest&&<Panel title="Mi sesión más reciente" subtitle="Último entrenamiento guardado en Praxen">
      <div className="my-latest">
        <div><span>Fecha</span><strong>{date(latest.startedAt)}</strong></div>
        <div><span>Modalidad</span><strong>{mode(latest.mode)}</strong></div>
        <div><span>Ejercicios</span><strong>{exerciseNames(latest)}</strong></div>
        <div><span>Duración</span><strong>{duration(lastDuration)}</strong></div>
      </div>
    </Panel>}
    <Panel title="Mi historial" subtitle="Solo sesiones asociadas a tu cuenta">
      <Table headers={['Fecha','Modalidad','Ejercicios','Duración']} empty={!sessions.length}>
        {sessions.map(s=><tr key={s.sessionId}>
          <td>{date(s.startedAt)}</td><td><Badge>{mode(s.mode)}</Badge></td><td>{exerciseNames(s)}</td>
          <td>{duration((new Date(s.endedAt)-new Date(s.startedAt))/1000)}</td>
        </tr>)}
      </Table>
      <Pager page={page} size={20} total={total} onPage={setPage}/>
    </Panel>
    <p className="muted my-privacy"><Target size={15}/> Este panel muestra únicamente datos asociados a tu propia cuenta. Los entrenamientos son indicadores de práctica, no diagnósticos médicos.</p>
  </>;
}
