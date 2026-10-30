import React,{useState,useEffect,useCallback,useMemo} from 'react';
import {LayoutDashboard,Users,GitCompareArrows,ShieldCheck,Layers,UserCog,LogOut,KeyRound,RefreshCw,Download,Search,Menu,X,ChevronRight,ChevronLeft,Activity,Clock3,Target,CalendarDays,AlertCircle,CheckCircle2,Plus,Trash2,Edit2,UserPlus,Volume2,ArrowUpRight,Eye,EyeOff} from 'lucide-react';
import {TYPES,num,date,duration,mode,exerciseNames,summaryReaction,metricMap,downloadCSV} from './lib';
const EMPTY='No hay información disponible para estos filtros.';
export function Button({children,variant='',icon:Icon,loading=false,...props}){return <button {...props} className={['button',variant,props.className].filter(Boolean).join(' ')} disabled={loading||props.disabled}>{loading?<RefreshCw size={16} className="spin"/>:Icon&&<Icon size={16}/>}<span>{children}</span></button>;}
export function Field({label,children,hint}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function Panel({title,action,children,subtitle,className=''}){return <section className={'panel '+className}><div className="panel-head"><div><h2>{title}</h2>{subtitle&&<p className="muted">{subtitle}</p>}</div>{action}</div>{children}</section>;}
export function Empty({children=EMPTY}){return <div className="empty-state"><Activity size={26}/><p>{children}</p></div>;}
export function ErrorBanner({message,onDismiss}){return message&&<div role="alert" className="notice error"><AlertCircle size={18}/><span>{message}</span>{onDismiss&&<button aria-label="Cerrar alerta" onClick={onDismiss}><X size={17}/></button>}</div>;}
export function Modal({title,children,onClose}){return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="Cerrar"><X size={20}/></button></div><div className="modal-content">{children}</div></section></div>;}
export function Pager({page,total,size,onPage}){const pages=Math.max(1,Math.ceil(total/size));return <div className="pager"><span>{total} resultados · Página {page+1} de {pages}</span><div><Button icon={ChevronLeft} disabled={page===0} onClick={()=>onPage(page-1)}>Anterior</Button><Button disabled={(page+1)*size>=total} onClick={()=>onPage(page+1)}>Siguiente <ChevronRight size={15}/></Button></div></div>;}
export function Table({headers,children,empty=false}){
  const rows=React.Children.map(children,row=>{
    if(!React.isValidElement(row)||row.type!=='tr')return row;
    const cells=React.Children.map(row.props.children,(cell,i)=>{
      if(!React.isValidElement(cell)||cell.type!=='td')return cell;
      return React.cloneElement(cell,{'data-label':headers[i]||''});
    });
    return React.cloneElement(row,{},cells);
  });
  return <div className="table-scroll"><table><thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{empty?<tr><td colSpan={headers.length}><Empty/></td></tr>:rows}</tbody></table></div>;
}
export function Badge({children,tone=''}){return <span className={'pill '+tone}>{children}</span>;}
export function SessionsTable({sessions=[],athletes=[],onOpen,withAthlete=false}){const names=new Map(athletes.map(a=>[Number(a.id),a.nombre]));return <Table headers={[...(withAthlete?['Atleta']:[]),'Fecha','Modalidad','Ejercicios','Duración','']} empty={!sessions.length}>{sessions.map(s=><tr key={s.sessionId}>{withAthlete&&<td className="strong">{names.get(Number(s.athleteId))||'Atleta #'+s.athleteId}</td>}<td>{date(s.startedAt)}</td><td><Badge>{mode(s.mode)}</Badge></td><td>{exerciseNames(s)}</td><td>{duration((new Date(s.endedAt)-new Date(s.startedAt))/1000)}</td><td><button className="link-action" onClick={()=>onOpen(s.sessionId)}>Ver detalle <ArrowUpRight size={15}/></button></td></tr>)}</Table>;}
export function ExerciseCards({summary}){return <div className="exercise-grid">{Object.entries(TYPES).map(([type,meta])=>{const ex=summary?.exercises?.find(e=>e.exerciseType===type);const first=ex?.metrics?.accuracyPercent||Object.values(ex?.metrics||{})[0];return <article className="exercise-card" key={type}><div className="ex-icon" style={{background:meta.color+'19'}}>{meta.icon}</div><div className="ex-info"><strong>{meta.label}</strong><small>{ex?.sessions??0} sesiones</small><span>{first?.label||'Sin métricas registradas'}</span></div><div className="ex-number">{Number.isFinite(first?.average)?num(first.average)+(first.unit==='%'?'%':''):'—'}</div>{first?.unit==='%'&&<div className="meter"><span style={{width:Math.max(0,Math.min(100,first.average))+'%',background:meta.color}}/></div>}</article>})}</div>;}
export function SparkLines({series=[]}){
  const [selected,setSelected]=useState(null);
  const chosen=series.filter(s=>s.points?.some(p=>Number.isFinite(p.value))).slice(0,3);
  const allPeriods=[...new Set(chosen.flatMap(s=>(s.points||[]).map(p=>p.period).filter(Boolean)))].sort();
  if(!chosen.length||!allPeriods.length)return <Empty>No hay puntos suficientes para graficar todavía.</Empty>;
  const width=820,height=260,left=53,right=25,top=24,bottom=47;
  const values=chosen.flatMap(s=>s.points.map(p=>p.value).filter(Number.isFinite));
  const min=Math.min(0,...values),max=Math.max(...values),range=Math.max(1,max-min);
  const x=period=>left+(allPeriods.length===1?(width-left-right)/2:(width-left-right)*allPeriods.indexOf(period)/(allPeriods.length-1));
  const y=value=>top+(height-top-bottom)-(value-min)*(height-top-bottom)/range;
  const labelPeriod=period=>{const parsed=new Date(period+'T12:00:00');return Number.isNaN(parsed.getTime())?period:parsed.toLocaleDateString('es-GT',{day:'numeric',month:'short',year:'numeric'});};
  const formatValue=(p,s)=>num(p.value)+(s.metric?.unit==='%'?'%':s.metric?.unit?' '+s.metric.unit:'');
  return <div className="chart" onPointerLeave={e=>{if(e.pointerType==='mouse')setSelected(null)}}>
    <div className="chart-stage">
      <svg role="img" aria-label="Evolución de resultados, selecciona o toca un punto para ver sus datos" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet">
        {[0,1,2,3,4].map(i=>{const v=max-range*i/4,yy=top+(height-top-bottom)*i/4;return <g key={i}><line x1={left} y1={yy} x2={width-right} y2={yy} stroke="#e7edf5" strokeDasharray="4 6"/><text x={left-10} y={yy+4} textAnchor="end" fontSize="10" fill="#8293aa">{num(v)}</text></g>})}
        {allPeriods.filter((_,i)=>i%Math.max(1,Math.ceil(allPeriods.length/6))===0).map(p=><text key={p} x={x(p)} y={height-11} textAnchor="middle" fontSize="10" fill="#8293aa">{p.slice(5,10)}</text>)}
        {chosen.map((s,i)=>{const points=(s.points||[]).filter(p=>Number.isFinite(p.value)&&allPeriods.includes(p.period)).sort((a,b)=>a.period.localeCompare(b.period));const color=TYPES[s.exerciseType]?.color||['#5f7fed','#13b8a1','#edac59'][i];return <g key={s.exerciseType||i}>
          {points.length>1&&<polyline points={points.map(p=>x(p.period)+','+y(p.value)).join(' ')} fill="none" stroke={color} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round"/>}
          {points.map((p,j)=>{const active=selected?.exercise===s.exerciseType&&selected?.period===p.period;return <g key={p.period+'-'+j}>
            <circle cx={x(p.period)} cy={y(p.value)} r={active?6:4.5} fill="white" stroke={color} strokeWidth="2.5"/>
            <circle className="trend-hit" cx={x(p.period)} cy={y(p.value)} r="17" fill="transparent" stroke="transparent" role="button" tabIndex={0} aria-label={`${TYPES[s.exerciseType]?.short||s.exerciseType} · ${labelPeriod(p.period)} · ${formatValue(p,s)}`}
              onPointerEnter={()=>setSelected({exercise:s.exerciseType,period:p.period,text:formatValue(p,s),title:TYPES[s.exerciseType]?.short||s.exerciseType,color,x:x(p.period),y:y(p.value)})}
              onFocus={()=>setSelected({exercise:s.exerciseType,period:p.period,text:formatValue(p,s),title:TYPES[s.exerciseType]?.short||s.exerciseType,color,x:x(p.period),y:y(p.value)})}
              onClick={()=>setSelected({exercise:s.exerciseType,period:p.period,text:formatValue(p,s),title:TYPES[s.exerciseType]?.short||s.exerciseType,color,x:x(p.period),y:y(p.value)})}
              onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.currentTarget.click();}}}/>
          </g>})}
        </g>})}
      </svg>
      {selected&&<div className="trend-tooltip" style={{left:`${Math.max(12,Math.min(88,selected.x/width*100))}%`,top:`${Math.max(5,(selected.y/height)*100-20)}%`}}>
        <strong>{labelPeriod(selected.period)}</strong><span style={{color:selected.color}}>{selected.title} · {selected.text}</span>
      </div>}
    </div>
    <div className="chart-legend">{chosen.map((s,i)=><div key={i}><span className="legend-dot" style={{background:TYPES[s.exerciseType]?.color||'#5f7fed'}}/>{TYPES[s.exerciseType]?.short||s.exerciseType} · {s.metric?.label||'Métrica'} ({s.metric?.unit||'sin unidad'})</div>)}</div>
    <p className="muted chart-note">Pasa el cursor o toca un punto para ver sus valores. Cada ejercicio conserva sus propias métricas y unidades.</p>
  </div>;
}
