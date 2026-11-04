import React,{useEffect,useState} from 'react';
import {HelpCircle,X,ChevronLeft,ChevronRight,Check} from 'lucide-react';

const guide={
  dashboard:{title:'Resumen general',steps:[
    ['Indicadores','Las tarjetas superiores resumen atletas, sesiones, duración y precisión. Los valores provienen de los entrenamientos registrados.'],
    ['Filtros','Elige grupo, federación, ejercicio o fechas para analizar solamente los resultados que te interesan. Usa Limpiar para volver a la vista general.'],
    ['Gráfica de evolución','Cambia entre Semanas y Meses. Pasa el cursor o toca un punto para ver su valor y fecha. Los ejercicios mantienen sus métricas separadas.'],
    ['Actividad reciente','Consulta las últimas sesiones filtradas. Ver detalle muestra las métricas de una sesión; Exportar CSV descarga las sesiones visibles.']
  ]},
  athletes:{title:'Directorio de atletas',steps:[
    ['Buscar deportistas','Utiliza la barra de búsqueda o el filtro de federación para localizar un atleta.'],
    ['Abrir perfil','Toca cualquier parte de la fila del atleta o el botón Ver perfil para acceder a sus resultados.'],
    ['Páginas','Los botones Anterior y Siguiente permiten recorrer los deportistas registrados.']
  ]},
  detail:{title:'Perfil de atleta',steps:[
    ['Indicadores personales','Revisa el número de sesiones, duración media y los resultados de cada ejercicio.'],
    ['Evolución individual','Selecciona Manos, Pies o Dirección. Cada punto representa una sesión real; tócalo para ver la medición.'],
    ['Historial','Consulta las sesiones del atleta, navega entre páginas y utiliza Ver detalle para ver un entrenamiento específico.']
  ]},
  compare:{title:'Comparar atletas',steps:[
    ['Seleccionar deportistas','Elige dos atletas diferentes de los desplegables.'],
    ['Elegir ejercicio','Selecciona Manos, Pies o Dirección para comparar la misma modalidad.'],
    ['Interpretar resultados','Pulsa Comparar para ver métricas compartidas. Recuerda que algunos indicadores mejoran al bajar, como el tiempo de reacción.']
  ]},
  groups:{title:'Grupos de entrenamiento',steps:[
    ['Encontrar un grupo','Busca por nombre y selecciona una tarjeta para consultar sus integrantes.'],
    ['Ver integrantes','Dentro del grupo puedes revisar los atletas asignados. Un deportista puede formar parte de varios grupos.'],
    ['Administrar grupos','Si eres Super Admin, puedes crear, editar, eliminar grupos y agregar o retirar integrantes. Eliminar un grupo no elimina sesiones de los atletas.']
  ]},
  users:{title:'Gestión de usuarios',steps:[
    ['Consultar cuentas','Busca usuarios por nombre y filtra por rol para revisar las cuentas registradas.'],
    ['Estado y permisos','Los roles distinguen deportistas, administradores y Super Admin. Las opciones de gestión dependen de tus permisos.'],
    ['Restablecer contraseñas','El Super Admin puede restablecer el acceso de cuentas permitidas, confirmando su propia contraseña. El usuario tendrá que cambiar la clave temporal al entrar.']
  ]},
  administrators:{title:'Administradores',steps:[
    ['Cuentas administrativas','Revisa los administradores activos e inactivos. Las cuentas protegidas no pueden desactivarse desde esta vista.'],
    ['Crear administrador','Completa nombre, usuario y contraseña inicial. Comunica las credenciales por un canal seguro.'],
    ['Auditoría','El registro muestra operaciones administrativas recientes para facilitar el seguimiento de cambios.']
  ]},
  athlete:{title:'Mis resultados',steps:[
    ['Tu información','Esta pantalla muestra solamente tus resultados. No puedes consultar la información de otros deportistas.'],
    ['Indicadores','Consulta cuántas sesiones has realizado, su duración media y los resultados de Manos, Pies y Dirección.'],
    ['Mi evolución','Elige un ejercicio para ver cómo cambian tus mediciones. Toca cada punto para consultar la fecha y el valor registrado.'],
    ['Sesiones','Revisa tu última sesión y el historial de entrenamientos. Pulsa Actualizar para consultar los datos más recientes.']
  ]}
};

export default function Tutorial({view='dashboard',role='admin'}){
  const [open,setOpen]=useState(false);
  const [step,setStep]=useState(0);
  const context=role==='athlete'?'athlete':view;
  const current=guide[context]||guide.dashboard;
  const count=current.steps.length;
  useEffect(()=>{setStep(0)},[context]);
  useEffect(()=>{
    if(!open)return;
    function onKeyDown(event){if(event.key==='Escape')setOpen(false);}
    document.addEventListener('keydown',onKeyDown);
    return()=>document.removeEventListener('keydown',onKeyDown);
  },[open]);
  function show(){setStep(0);setOpen(true);}
  return <>
    <button type="button" className="tutorial-launch" onClick={show} title="Tutorial de esta sección" aria-label="Abrir tutorial de esta sección"><HelpCircle size={18}/><span>Ayuda</span></button>
    {open&&<div className="tutorial-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
      <section className="tutorial-card" role="dialog" aria-modal="true" aria-labelledby="tutorial-heading" aria-describedby="tutorial-description">
        <div className="tutorial-header"><div className="tutorial-icon"><HelpCircle size={21}/></div><div><p>GUÍA RÁPIDA · PRAXEN</p><h2 id="tutorial-heading">{current.title}</h2></div><button className="tutorial-close" aria-label="Cerrar tutorial" onClick={()=>setOpen(false)}><X size={19}/></button></div>
        <div className="tutorial-body">
          <div className="tutorial-progress" aria-label={`Paso ${step+1} de ${count}`}>{current.steps.map((_,index)=><span key={index} className={index<=step?'active':''}/>)}</div>
          <p className="tutorial-counter">Paso {step+1} de {count}</p>
          <h3>{current.steps[step][0]}</h3><p id="tutorial-description">{current.steps[step][1]}</p>
        </div>
        <div className="tutorial-actions"><button type="button" className="tutorial-back" onClick={()=>setStep(x=>Math.max(0,x-1))} disabled={step===0}><ChevronLeft size={16}/> Anterior</button><button type="button" className="tutorial-next" onClick={()=>{if(step===count-1)setOpen(false);else setStep(x=>x+1)}}>{step===count-1?<>Entendido <Check size={16}/></>:<>Siguiente <ChevronRight size={16}/></>}</button></div>
      </section>
    </div>}
  </>;
}
