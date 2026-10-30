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
  // La API devuelve "period" para población y "startedAt"/"sessionId" para atleta individual.
  // Nunca agrupamos sesiones individuales por fecha: dos sesiones el mismo día son dos puntos.
  const chosen=(series||[]).map((serie,index)=>({
    ...serie,
    points:(serie.points||[]).filter(point=>Number.isFinite(point.value)).map((point,i)=>({
      ...point,
      chartDate:point.startedAt||point.period||point.date||'',
      chartKey:point.sessionId?String(point.sessionId):String(point.period||point.date||point.startedAt||i),
    })).filter(point=>point.chartDate)
      .sort((a,b)=>a.chartDate.localeCompare(b.chartDate)||a.chartKey.localeCompare(b.chartKey))
  })).filter(serie=>serie.points.length>0).slice(0,3);
  if(!chosen.length)return <Empty>Este ejercicio todavía no tiene sesiones con métricas numéricas registradas.</Empty>;
  const isIndividual=chosen.some(serie=>serie.points.some(p=>!!p.sessionId));
  // Orden temporal compartido. Para la población, cada período es un único punto.
  const timeline=[...new Map(chosen.flatMap(serie=>serie.points.map(p=>[
    isIndividual?(p.sessionId||p.chartDate):p.chartDate,
    {key:isIndividual?(p.sessionId||p.chartDate):p.chartDate,date:p.chartDate}
  ]))).values()].sort((a,b)=>a.date.localeCompare(b.date)||String(a.key).localeCompare(String(b.key)));
  const width=820,height=270,left=56,right=26,top=25,bottom=50;
  const numbers=chosen.flatMap(serie=>serie.points.map(p=>p.value));
  const min=Math.min(0,...numbers),max=Math.max(...numbers),range=Math.max(1,max-min);
  const x=key=>left+(timeline.length===1?(width-left-right)/2:(width-left-right)*Math.max(0,timeline.findIndex(t=>String(t.key)===String(key)))/(timeline.length-1));
  const y=value=>top+(height-top-bottom)-(value-min)*(height-top-bottom)/range;
  const keyFor=p=>isIndividual?(p.sessionId||p.chartDate):p.chartDate;
  const labelDate=value=>{
    if(!value)return 'Fecha no disponible';
    const parsed=new Date(value.length===10?value+'T12:00:00':value);
    return Number.isNaN(parsed.getTime())?value:parsed.toLocaleDateString('es-GT',{day:'numeric',month:'short',year:'numeric',...(value.includes('T')?{hour:'2-digit',minute:'2-digit'}:{})});
  };
  const val=(p,serie)=>num(p.value)+(serie.metric?.unit==='%'?'%':serie.metric?.unit?' '+serie.metric.unit:'');
  const tooltipPoint=(p,serie,color)=>setSelected({key:keyFor(p),date:p.chartDate,exercise:serie.exerciseType,metric:serie.metric?.label||'Indicador',text:val(p,serie),color,x:x(keyFor(p)),y:y(p.value)});
  const ticks=timeline.filter((_,i)=>i%Math.max(1,Math.ceil(timeline.length/6))===0);
  return <div className="chart" onPointerLeave={e=>{if(e.pointerType==='mouse')setSelected(null)}}>
    <div className="chart-stage">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={isIndividual?'Evolución individual por sesión':'Evolución de resultados por período'} preserveAspectRatio="xMidYMid meet">
        {[0,1,2,3,4].map(i=>{const yy=top+(height-top-bottom)*i/4;return <g key={i}>
          <line x1={left} x2={width-right} y1={yy} y2={yy} stroke="#e7edf5" strokeDasharray="4 6"/>
          <text x={left-10} y={yy+4} fill="#8293aa" fontSize="10" textAnchor="end">{num(max-range*i/4)}</text>
        </g>})}
        {ticks.map(t=><text key={String(t.key)} x={x(t.key)} y={height-12} textAnchor="middle" fill="#8293aa" fontSize="10">{String(t.date).slice(5,10)||String(t.date)}</text>)}
        {chosen.map((serie,i)=>{const color=TYPES[serie.exerciseType]?.color||['#597af1','#16ad99','#e5a050'][i];return <g key={serie.exerciseType||i}>
          {serie.points.length>1&&<polyline points={serie.points.map(p=>x(keyFor(p))+','+y(p.value)).join(' ')} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>}
          {serie.points.map((p,index)=><g key={p.chartKey+'-'+index}>
            <circle cx={x(keyFor(p))} cy={y(p.value)} r={selected?.key===keyFor(p)&&selected?.exercise===serie.exerciseType?6:4.5} fill="white" stroke={color} strokeWidth="2.5"/>
            <circle cx={x(keyFor(p))} cy={y(p.value)} r="18" className="trend-hit" fill="transparent" stroke="transparent"
              role="button" tabIndex={0} aria-label={`${TYPES[serie.exerciseType]?.short||serie.exerciseType}: ${labelDate(p.chartDate)}, ${serie.metric?.label||'Indicador'} ${val(p,serie)}`}
              onPointerEnter={()=>tooltipPoint(p,serie,color)} onFocus={()=>tooltipPoint(p,serie,color)}
              onClick={()=>tooltipPoint(p,serie,color)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();tooltipPoint(p,serie,color)}}}/>
          </g>)}
        </g>})}
      </svg>
      {selected&&<div className="trend-tooltip" style={{left:`${Math.max(12,Math.min(88,selected.x/width*100))}%`,top:`${Math.max(5,selected.y/height*100-20)}%`}}>
        <strong>{labelDate(selected.date)}</strong>
        <span style={{color:selected.color}}>{TYPES[selected.exercise]?.short||selected.exercise} · {selected.metric}: {selected.text}</span>
      </div>}
    </div>
    <div className="chart-legend">{chosen.map((serie,i)=><div key={i}><span className="legend-dot" style={{background:TYPES[serie.exerciseType]?.color||'#597af1'}}/>{TYPES[serie.exerciseType]?.short||serie.exerciseType} · {serie.metric?.label||'Indicador'} ({serie.metric?.unit||'sin unidad'})</div>)}</div>
    <p className="muted chart-note">{isIndividual?`${chosen.reduce((sum,s)=>sum+s.points.length,0)} sesión(es) graficada(s). Cada punto corresponde a una sesión real.`:'Cada punto representa un período agregado.'} Pasa el cursor o toca un punto para ver sus datos.</p>
  </div>;
}
