/* Praxen Analytics — consumimos exclusivamente los contratos administrativos de API-Praxen. */
(() => {
  'use strict';
  const API = 'https://api-praxen.onrender.com';
  const TYPES = {
    aimlab: { label:'Coordinación de manos', short:'Manos', icon:'✋', color:'#4878eb' },
    feet_targets: { label:'Coordinación de pies', short:'Pies', icon:'👣', color:'#0ab8a3' },
    running_direction_change: { label:'Cambios de dirección', short:'Dirección', icon:'↗', color:'#edac59' },
  };
  const METRIC_LABELS = {
    hits:'Aciertos', misses:'Fallos', score:'Puntuación', attemptsCount:'Intentos',
    targetsHit:'Objetivos acertados', targetsMissed:'Objetivos fallados', targetsReached:'Objetivos alcanzados',
    averageReactionSeconds:'Tiempo promedio de reacción (s)', averageReactionTimeSeconds:'Tiempo promedio de reacción (s)',
    reactionTimeSeconds:'Tiempo de reacción (s)', averageResponseTimeSeconds:'Tiempo promedio de respuesta (s)',
    completionTimeSeconds:'Tiempo de finalización (s)', totalTravelledMeters:'Distancia recorrida (m)',
    totalDistanceMeters:'Distancia total (m)', averageSpeedMetersPerSecond:'Velocidad promedio (m/s)',
    accuracyPercent:'Precisión (%)'
  };
  const metricLabel = key => METRIC_LABELS[key] || key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/^./,c=>c.toUpperCase());
  const modeLabel = mode => ({individual:'Individual',circuit:'Circuito',custom:'Personalizado'})[mode] || mode || '—';
  const $ = id => document.getElementById(id);
  const state = { token:null, user:null, view:'dashboard', filters:{}, athletePage:0, athleteTotal:0, detailPage:0, detailTotal:0, adminPage:0, adminTotal:0, selected:null, athleteCache:[], recent:[], summary:null, serial:0, groups:[], groupReady:false, groupAnalyticsReady:false, selectedGroup:null, groupMembers:[], users:[], userPage:0, userTotal:0, resetTarget:null };
  const number = n => typeof n === 'number' && Number.isFinite(n) ? new Intl.NumberFormat('es-GT',{ maximumFractionDigits:1 }).format(n) : '—';
  const reactionKeys=['averageReactionSeconds','averageReactionTimeSeconds','reactionTimeSeconds','averageResponseTimeSeconds'];
  const formatMetric=(key,value)=>typeof value==='number'&&Number.isFinite(value)?new Intl.NumberFormat('es-GT',{maximumFractionDigits:/^(hits|misses|targetsHit|targetsMissed|targetsReached|attemptsCount|sets|score)$/.test(key)?0:2}).format(value):'—';
  const reactionMetrics=summary=>(summary?.exercises||[]).filter(e=>!$('exercise').value||e.exerciseType===$('exercise').value).map(e=>{
    const key=reactionKeys.find(k=>typeof e.metrics?.[k]?.average==='number'&&Number.isFinite(e.metrics[k].average));
    return key?{type:e.exerciseType,key,metric:e.metrics[key]}:null;
  }).filter(Boolean);
  const date = d => d ? new Date(d).toLocaleDateString('es-GT',{ day:'2-digit',month:'short',year:'numeric' }) : '—';
  const duration = n => typeof n === 'number' && Number.isFinite(n) ? `${Math.floor(n/60)}m ${String(Math.round(n%60)).padStart(2,'0')}s` : '—';
  const txt = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fullName = a => a?.nombre || `Atleta #${a?.id ?? '?'}`;
  const qs = obj => { const p = new URLSearchParams(); for (const [k,v] of Object.entries(obj)) if(v !== '' && v !== null && v !== undefined) p.set(k,String(v)); const q=p.toString(); return q?'?'+q:''; };
  class ApiError extends Error { constructor(status,message){ super(message);this.status=status; } }
  async function request(path,opts={}) {
    const headers = { Accept:'application/json', ...(opts.body?{'Content-Type':'application/json'}:{}), ...(state.token?{Authorization:`Bearer ${state.token}`}:{}) };
    let response;
    try { response=await fetch(API+path,{ ...opts, headers,cache:'no-store' }); }
    catch { throw new ApiError(0,'No se pudo conectar con la API. Verifica Render y la configuración CORS.'); }
    let body; try { body=await response.json(); } catch { body={}; }
    if (!response.ok) {
      if(response.status===401 && state.token) logout('La sesión caducó. Inicia sesión nuevamente.');
      throw new ApiError(response.status,body.message||`La API respondió HTTP ${response.status}.`);
    }
    return body;
  }
  function notice(message,kind='warning') { const n=$('notice');n.textContent=message;n.classList.remove('hidden');n.style.background=kind==='error'?'#fff0f2':'#fff8e6';n.style.color=kind==='error'?'#a63b4b':'#926e21'; }
  function clearNotice(){ $('notice').classList.add('hidden'); }
  function canManageGroups(){return state.user?.role==='superadmin';}
  function canManageAdmins(){return state.user?.role==='superadmin'&&state.user?.permissions?.includes('admins:manage');}
  function show(view){if((view==='administrators'||view==='users')&&!canManageAdmins())return;state.view=view;document.querySelectorAll('.view').forEach(el=>el.classList.toggle('hidden',el.id!==view));document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===view));$('breadcrumb-current').textContent=({dashboard:'Resumen general',athletes:'Atletas',detail:'Perfil del atleta',compare:'Comparar resultados',administrators:'Administradores',groups:'Grupos',users:'Gestión de usuarios'})[view];clearNotice();window.scrollTo(0,0);}
  function logout(message=''){state.token=null;state.user=null;state.serial++;$('app-view').classList.add('hidden');$('login-view').classList.remove('hidden');$('password').value='';$('login-error').textContent=message;$('login-error').classList.toggle('hidden',!message);}
  async function login(event){event.preventDefault();const button=$('login-button');button.disabled=true;$('login-error').classList.add('hidden');try{
      const payload=await request('/api/auth/login',{ method:'POST',body:JSON.stringify({username:$('username').value.trim(),password:$('password').value}) });
      if(!['admin','superadmin'].includes(payload.user?.role) || !payload.user.permissions?.includes('results:all:read') || !payload.token) throw new ApiError(403,'Solo las cuentas administradoras pueden acceder a este panel.');
      state.token=payload.token;
      const verified=await request('/api/auth/me');const user=verified.user||verified;
      if(!['admin','superadmin'].includes(user.role) || !user.permissions?.includes('results:all:read')) throw new ApiError(403,'La cuenta no tiene permisos administrativos activos.');
      state.user=user;$('side-user').textContent=user.nombre||user.username;$('user-initials').textContent=(user.nombre||'AD').split(/\s+/).slice(0,2).map(s=>s[0]).join('').toUpperCase();$('admin-nav').classList.toggle('hidden',!canManageAdmins());$('users-nav').classList.toggle('hidden',!canManageAdmins());$('mobile-admin-nav').classList.toggle('hidden',!canManageAdmins());$('login-view').classList.add('hidden');$('app-view').classList.remove('hidden');$('password').value='';show('dashboard');await Promise.all([loadFilters(),loadGroups(),loadAthletes()]);await loadDashboard();
    }catch(err){state.token=null;$('login-error').textContent=err.message;$('login-error').classList.remove('hidden');}finally{button.disabled=false;}}
  function filters(){return { ...(state.groupAnalyticsReady&&$('group-filter').value?{groupId:$('group-filter').value}:{}),federacion:$('federation').value,exerciseType:$('exercise').value,from:$('date-from').value,to:$('date-to').value};}
  async function loadFilters(){try{const data=await request('/api/admin/federaciones');const entries=Array.isArray(data.federaciones)?data.federaciones:[];for(const id of ['federation','athlete-federation']){const sel=$(id),old=sel.value;sel.querySelectorAll('option:not(:first-child)').forEach(o=>o.remove());entries.forEach(f=>{const opt=document.createElement('option');opt.value=f.nombre;opt.textContent=`${f.nombre} (${f.totalAtletas})`;sel.append(opt)});sel.value=old;}}catch(e){notice(e.message,'error');}}
  function renderSummary(summary){state.summary=summary;renderReactionKpi(summary);$('count-athletes').textContent=number(summary.athleteCount);$('count-sessions').textContent=number(summary.totalSessions);$('count-duration').textContent=duration(summary.averageDurationSeconds);const ex=$('exercise').value?summary.exercises.find(x=>x.exerciseType===$('exercise').value):null;const acc=ex?.metrics?.accuracyPercent?.average;$('count-precision').textContent=typeof acc==='number'?`${number(acc)}%`:'Por ejercicio';$('exercise-cards').innerHTML=Object.entries(TYPES).map(([type,meta])=>{
    const item=summary.exercises.find(e=>e.exerciseType===type),acc=item?.metrics?.accuracyPercent?.average,firstMetric=item?.metrics?.accuracyPercent||Object.values(item?.metrics||{})[0];const value=typeof firstMetric?.average==='number'?`${number(firstMetric.average)}${firstMetric.unit==='%'?'%':''}`:'—';const bar=firstMetric?.unit==='%'?`<div class="bar"><i style="width:${Math.max(0,Math.min(100,firstMetric.average))}%;background:${meta.color}"></i></div>`:'';
    return `<div class="exercise-row"><div class="ex-emoji">${meta.icon}</div><div class="ex-body"><strong>${meta.label}</strong><small>${item?.sessions??0} sesiones · ${txt(firstMetric?.label||'Sin métricas')}</small>${bar}</div><span class="ex-value">${value}</span></div>`;}).join('');}
  function plot(id,points,unit='',color='#4779ec'){
    const target=$(id);if(!points?.length){target.innerHTML='<div class="empty">Todavía no hay datos para esta gráfica.</div>';return;}
    const data=points.filter(p=>typeof p.value==='number'&&Number.isFinite(p.value)).slice(-12);if(!data.length){target.innerHTML='<div class="empty">No hay valores numéricos en este período.</div>';return;}
    const w=590,h=240,L=45,R=15,T=18,B=35,plotW=w-L-R,plotH=h-T-B,values=data.map(p=>p.value),minimum=Math.min(0,...values),maximum=Math.max(...values),range=Math.max(1,maximum-minimum),X=i=>L+(data.length===1?plotW/2:plotW*i/(data.length-1)),Y=v=>T+plotH-(v-minimum)*plotH/range;
    let svg=`<svg role="img" aria-label="Serie temporal de ${data.length} puntos" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">`;
    for(let i=0;i<=4;i++){const y=T+plotH*i/4;svg+=`<line x1="${L}" y1="${y}" x2="${w-R}" y2="${y}" stroke="#ebf0f6" stroke-dasharray="4 5"/><text x="${L-9}" y="${y+4}" text-anchor="end" fill="#a3b0bc" font-size="10">${number(maximum-range*i/4)}</text>`;}
    const coordinates=data.map((p,i)=>`${X(i)},${Y(p.value)}`).join(' ');svg+=`<polyline points="${coordinates}" fill="none" stroke="${color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
    data.forEach((p,i)=>{const label=p.period||date(p.startedAt);svg+=`<circle cx="${X(i)}" cy="${Y(p.value)}" r="5" fill="white" stroke="${color}" stroke-width="2.5"/><circle class="trend-hit" cx="${X(i)}" cy="${Y(p.value)}" r="14" fill="transparent" data-date="${txt(p.startedAt||p.period||'')}" data-exercise="Resultado" data-value="${txt(number(p.value)+(unit==='%'?'%':unit?' '+unit:''))}" data-color="${color}" tabindex="0" role="button" aria-label="${txt(label+': '+number(p.value)+' '+unit)}"/>`;if(i===0||i===data.length-1||i%Math.max(1,Math.ceil(data.length/5))===0)svg+=`<text x="${X(i)}" y="${h-8}" font-size="10" text-anchor="middle" fill="#a2b0be">${txt(label)}</text>`;});target.innerHTML=svg+'</svg>'; attachTrendTooltip(target,w,h);
  }
  function plotMultiple(id,series){
    const target=$(id), available=series.filter(s=>s.points?.some(p=>Number.isFinite(p.value)));
    if(!available.length){target.innerHTML='<div class="empty">Todavía no hay datos para esta gráfica.</div>';return;}
    const allDates=[...new Set(available.flatMap(s=>s.points.map(p=>p.period).filter(Boolean)))].sort();
    if(!allDates.length){target.innerHTML='<div class="empty">No hay fechas disponibles.</div>';return;}
    const w=590,h=240,L=45,R=16,T=18,B=39,pw=w-L-R,ph=h-T-B;
    const values=available.flatMap(s=>s.points.map(p=>p.value).filter(Number.isFinite));
    const minimum=Math.min(0,...values),maximum=Math.max(...values),range=Math.max(1,maximum-minimum);
    const X=date=>L+(allDates.length===1?pw/2:pw*allDates.indexOf(date)/(allDates.length-1));
    const Y=value=>T+ph-(value-minimum)*ph/range;
    let svg='<svg role="img" aria-label="Evolución del rendimiento por fecha" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">';
    for(let i=0;i<=4;i++){const y=T+ph*i/4;svg+='<line x1="'+L+'" y1="'+y+'" x2="'+(w-R)+'" y2="'+y+'" stroke="#ebf0f6" stroke-dasharray="4 5"/><text x="'+(L-9)+'" y="'+(y+4)+'" text-anchor="end" fill="#a3b0bc" font-size="10">'+number(maximum-range*i/4)+'</text>';}
    for(const dateKey of allDates){const x=X(dateKey);svg+='<text x="'+x+'" y="'+(h-8)+'" font-size="10" text-anchor="middle" fill="#a2b0be">'+txt(dateKey.slice(8,10)+'/'+dateKey.slice(5,7))+'</text>';}
    for(const serie of available){
      const meta=TYPES[serie.exerciseType],color=meta?.color||'#4779ec',unit=serie.metric?.unit||'';
      const points=serie.points.filter(p=>Number.isFinite(p.value)&&allDates.includes(p.period)).sort((a,b)=>a.period.localeCompare(b.period));
      if(points.length>1)svg+='<polyline points="'+points.map(p=>X(p.period)+','+Y(p.value)).join(' ')+'" fill="none" stroke="'+color+'" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
      for(const p of points){
        const x=X(p.period),y=Y(p.value),label=(meta?.short||serie.exerciseType)+' · '+p.period+': '+number(p.value)+(unit==='%'?'%':unit?' '+unit:'');
        svg+='<circle cx="'+x+'" cy="'+y+'" r="5" fill="white" stroke="'+color+'" stroke-width="2.5"/>';
        svg+='<circle class="trend-hit" data-date="'+txt(p.period)+'" data-exercise="'+txt(meta?.short||serie.exerciseType)+'" data-value="'+txt(number(p.value)+(unit==='%'?'%':unit?' '+unit:''))+'" data-color="'+color+'" cx="'+x+'" cy="'+y+'" r="14" fill="transparent" stroke="transparent" tabindex="0" role="button" aria-label="'+txt(label)+'"/>';
      }
    }
    target.innerHTML=svg+'</svg>';
    attachTrendTooltip(target,w,h);
  }
  function attachTrendTooltip(target,w,h){
    target.insertAdjacentHTML('beforeend','<div class="trend-tooltip" hidden><strong></strong><span></span></div>');
    const tooltip=target.querySelector('.trend-tooltip');
    const showPoint=point=>{
      const bounds=target.querySelector('svg').getBoundingClientRect();
      const x=Number(point.getAttribute('cx'))/w*bounds.width;
      const y=Number(point.getAttribute('cy'))/h*bounds.height;
      const [year,month,day]=point.dataset.date.slice(0,10).split('-').map(Number);
      tooltip.querySelector('strong').textContent=new Date(year,month-1,day).toLocaleDateString('es-GT',{day:'numeric',month:'short',year:'numeric'});
      const value=tooltip.querySelector('span');
      value.textContent=point.dataset.exercise+' · '+point.dataset.value;
      value.style.color=point.dataset.color;
      tooltip.hidden=false;
      tooltip.style.left=Math.max(8,Math.min(bounds.width-tooltip.offsetWidth-8,x-tooltip.offsetWidth/2))+'px';
      tooltip.style.top=Math.max(4,y-tooltip.offsetHeight-15)+'px';
    };
    target.querySelectorAll('.trend-hit').forEach(point=>{
      point.addEventListener('pointerenter',()=>showPoint(point));
      point.addEventListener('focus',()=>showPoint(point));
      point.addEventListener('click',()=>showPoint(point));
      point.addEventListener('pointerleave',()=>{tooltip.hidden=true;});
      point.addEventListener('blur',()=>{tooltip.hidden=true;});
    });
    target.addEventListener('pointerleave',()=>{tooltip.hidden=true;});
  }

  function renderReactionKpi(summary){
    const target=$('reaction-kpi'),metrics=reactionMetrics(summary);
    if(!metrics.length){target.classList.add('hidden');target.innerHTML='';return;}
    target.classList.remove('hidden');
    target.innerHTML='<div class="reaction-icon">◷</div><div class="reaction-copy"><strong>Tiempo medio de reacción</strong><p>Por ejercicio, sin mezclar modalidades. Menor tiempo indica una respuesta más rápida.</p></div><div class="reaction-values">'+metrics.map(m=>'<span><small>'+txt(TYPES[m.type]?.short||m.type)+'</small><b>'+formatMetric(m.key,m.metric.average)+' s</b></span>').join('')+'</div>';
  }
  async function loadGroups(){
    try{
      const data=await request('/api/admin/grupos?limit=100');
      if(!Array.isArray(data.grupos))throw new Error('Respuesta de grupos no reconocida.');
      state.groups=data.grupos;state.groupReady=true;state.groupAnalyticsReady=data.supportsAnalyticsFilter===true;
      $('groups-status').classList.add('hidden');$('new-group-trigger').classList.toggle('hidden',!canManageGroups());
      const sel=$('group-filter'),old=sel.value;
      sel.innerHTML='<option value="">Todos los grupos</option>'+state.groups.map(g=>'<option value="'+txt(g.id)+'">'+txt(g.nombre)+'</option>').join('');
      sel.disabled=!state.groupAnalyticsReady;sel.value=state.groupAnalyticsReady&&state.groups.some(g=>String(g.id)===old)?old:'';sel.title=state.groupAnalyticsReady?'Filtrar resultados por grupo':'Pendiente: la API debe admitir groupId en las consultas de resultados.';
      renderGroups();
    }catch(e){
      state.groupReady=false;state.groupAnalyticsReady=false;state.groups=[];$('group-filter').disabled=true;$('group-filter').innerHTML='<option value="">Grupos no disponibles</option>';
      $('groups-count').textContent='—';$('new-group-trigger').classList.add('hidden');
      $('groups-list').innerHTML='<div class="empty">El listado de grupos estará disponible cuando la API habilite su administración.</div>';
      $('groups-status').classList.remove('hidden');$('groups-status').textContent='La interfaz de grupos está preparada, pero la API todavía no ofrece este servicio. Ningún filtro por grupo se aplicará hasta que esté disponible.';
    }
  }
  function renderGroups(){
    const term=$('group-search').value.trim().toLowerCase();
    const matches=state.groups.filter(g=>(g.nombre+' '+(g.descripcion||'')).toLowerCase().includes(term));
    $('groups-count').textContent=number(state.groups.length);
    $('groups-list').innerHTML=matches.map(g=>'<button type="button" class="group-tile" data-open-group="'+txt(g.id)+'"><div class="group-tile-head"><span class="group-tile-icon">◫</span><span class="account-badge">Natación</span></div><h3>'+txt(g.nombre)+'</h3><p>'+txt(g.descripcion||'Sin descripción')+'</p><div class="group-tile-footer"><span>'+txt(g.totalUsuarios??g.totalAtletas??'—')+' integrantes</span><b>Ver integrantes →</b></div></button>').join('')||'<div class="empty">No se encontraron grupos.</div>';
  }
  async function openGroup(id){
    const group=state.groups.find(g=>String(g.id)===String(id));if(!group)return;
    state.selectedGroup=group;
    $('group-detail-name').textContent=group.nombre;$('group-detail-description').textContent=group.descripcion||'Sin descripción';
    $('group-detail').classList.remove('hidden');$('group-edit').classList.toggle('hidden',!canManageGroups());$('group-delete').classList.toggle('hidden',!canManageGroups());$('group-add-user').classList.toggle('hidden',!canManageGroups());
    $('group-members').innerHTML='<tr><td colspan="4" class="empty">Cargando integrantes…</td></tr>';
    try{
      const data=await request('/api/admin/grupos/'+encodeURIComponent(id)+'/usuarios');
      state.groupMembers=Array.isArray(data.usuarios)?data.usuarios:[];
      renderGroupMembers();
    }catch(e){$('group-members').innerHTML='<tr><td colspan="4" class="empty">'+txt(e.message)+'</td></tr>';}
    $('group-detail').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function renderGroupMembers(){
    const term=$('group-user-search').value.trim().toLowerCase();
    const rows=state.groupMembers.filter(u=>(u.nombre+' '+(u.username||'')).toLowerCase().includes(term));
    $('group-members').innerHTML=rows.map(u=>'<tr><td><strong>'+txt(u.nombre)+'</strong></td><td>@'+txt(u.username||'—')+'</td><td>'+date(u.assignedAt||u.assigned_at)+'</td><td>'+(canManageGroups()?'<button class="link-button" data-unassign="'+txt(u.id)+'">Quitar</button>':'—')+'</td></tr>').join('')||'<tr><td colspan="4" class="empty">No hay deportistas que coincidan.</td></tr>';
  }
  async function groupMutation(path,opts){
    try{await request(path,opts);await loadGroups();if(state.selectedGroup){const id=state.selectedGroup.id;if(state.groups.some(g=>String(g.id)===String(id)))await openGroup(id);else{$('group-detail').classList.add('hidden');state.selectedGroup=null;}}notice('Cambios guardados correctamente.');return true;}
    catch(e){notice(e.message,'error');return false;}
  }
  async function saveGroup(event){
    event.preventDefault();if(!canManageGroups()||!state.groupReady)return;
    const nombre=$('group-name').value.trim(),descripcion=$('group-description').value.trim();
    if(nombre.length<2){notice('Indica un nombre de grupo de al menos 2 caracteres.','error');return;}
    const editing=$('group-form').dataset.editing,button=$('group-save');button.disabled=true;
    const ok=await groupMutation('/api/admin/grupos'+(editing?'/'+encodeURIComponent(editing):''),{method:editing?'PATCH':'POST',body:JSON.stringify({nombre,descripcion})});
    button.disabled=false;if(ok)$('group-dialog').close();
  }
  async function loadUsers(){
    if(!canManageAdmins())return;
    try{
      const data=await request('/api/admin/usuarios'+qs({limit:25,offset:state.userPage*25,search:$('users-search').value.trim(),role:$('users-role').value}));
      if(!Array.isArray(data.usuarios))throw new Error('Respuesta de usuarios no reconocida.');
      state.users=data.usuarios;state.userTotal=data.total??data.usuarios.length;
      $('users-status').classList.add('hidden');$('users-total').textContent=state.userTotal+' cuentas';
      $('users-body').innerHTML=state.users.map(u=>'<tr><td><strong>'+txt(u.nombre)+'</strong><div class="status-note">@'+txt(u.username)+'</div></td><td><span class="account-badge">'+txt(({athlete:'Deportista',admin:'Administrador',superadmin:'Super Admin'})[u.role]||u.role)+'</span></td><td><span class="status-chip '+(u.isActive===false?'off':'')+'">'+(u.isActive===false?'Inactivo':'Activo')+'</span></td><td>'+(u.role!=='superadmin'&&u.id!==state.user.id?'<button class="link-button" data-reset-user="'+txt(u.id)+'">Restablecer contraseña</button>':'<span class="status-note">Cuenta protegida</span>')+'</td></tr>').join('')||'<tr><td colspan="4" class="empty">No se encontraron cuentas.</td></tr>';
      $('users-prev').disabled=state.userPage===0;$('users-next').disabled=(state.userPage+1)*25>=state.userTotal;
    }catch(e){$('users-status').classList.remove('hidden');$('users-status').textContent='La gestión de usuarios requiere los endpoints administrativos del backend. No se han modificado cuentas.';$('users-body').innerHTML='<tr><td colspan="4" class="empty">Gestión de usuarios pendiente de API.</td></tr>';$('users-total').textContent='—';}
  }
  function openReset(id){
    const user=state.users.find(u=>String(u.id)===String(id));
    if(!canManageAdmins()||!user||user.role==='superadmin'||user.id===state.user.id)return;
    state.resetTarget=user;$('reset-target').textContent='Cuenta: '+user.nombre+' (@'+user.username+')';$('reset-admin-password').value='';$('reset-form-error').classList.add('hidden');$('reset-dialog').showModal();
  }
  async function resetPassword(event){
    event.preventDefault();if(!state.resetTarget||!canManageAdmins())return;
    const button=$('reset-submit');button.disabled=true;
    try{
      await request('/api/admin/usuarios/'+encodeURIComponent(state.resetTarget.id)+'/restablecer-password',{method:'POST',body:JSON.stringify({adminPassword:$('reset-admin-password').value})});
      $('reset-dialog').close();$('reset-admin-password').value='';notice('Contraseña restablecida. El usuario deberá cambiar la contraseña temporal al ingresar.');
    }catch(e){$('reset-form-error').textContent=e.message;$('reset-form-error').classList.remove('hidden');}finally{button.disabled=false;}
  }
  async function changeOwnPassword(event){
    event.preventDefault();const currentPassword=$('current-password').value,newPassword=$('next-password').value,confirm=$('confirm-password').value;
    if(newPassword!==confirm||newPassword===currentPassword||newPassword==='praxen01'){$('password-form-error').textContent='Verifica la confirmación y utiliza una contraseña nueva distinta de la actual y de praxen01.';$('password-form-error').classList.remove('hidden');return;}
    const button=$('password-save');button.disabled=true;
    try{
      await request('/api/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword,newPassword})});
      $('password-dialog').close();$('password-change-form').reset();logout('Contraseña actualizada. Inicia sesión nuevamente.');
    }catch(e){$('password-form-error').textContent=e.message;$('password-form-error').classList.remove('hidden');}finally{button.disabled=false;}
  }

  function typeList(session){return Object.entries({aimlab:'exercises',feet_targets:'footExercises',running_direction_change:'runningExercises'}).filter(([type,key])=>session[key]?.some(x=>x.exerciseType===type)).map(([type])=>TYPES[type].short).join(', ')||'—';}
  function renderSessions(id,list,withAthlete=false){$(id).innerHTML=list.length?list.map(s=>`<tr>${withAthlete?`<td><strong>${txt(state.athleteCache.find(a=>a.id===s.athleteId)?.nombre||`#${s.athleteId}`)}</strong></td>`:''}<td>${date(s.startedAt)}</td><td>${txt(modeLabel(s.mode))}</td><td>${typeList(s)}</td><td>${duration((new Date(s.endedAt)-new Date(s.startedAt))/1000)}</td><td><button class="link-button" data-session="${txt(s.sessionId)}">Ver detalle →</button></td></tr>`).join(''):'<tr><td colspan="6" class="empty">No hay sesiones para mostrar.</td></tr>';}
  async function loadDashboard(){const serial=++state.serial;const query=qs(filters());$('count-sessions').textContent='…';try{
    const [summary,latest]=await Promise.all([request('/api/admin/resultados/resumen'+query),request('/api/admin/resultados/sesiones'+qs({...filters(),limit:20,offset:0}))]);if(serial!==state.serial)return;
    renderSummary(summary.summary);state.recent=latest.sesiones||[];renderSessions('recent-body',state.recent,true);await loadTrend(false,serial);
  }catch(e){if(serial!==state.serial)return;notice(e.message,'error');$('count-sessions').textContent='—';}}
  async function loadTrend(individual=false,serial=state.serial){
    try{
      const selected=individual?$('detail-type').value:($('exercise').value||$('trend-type').value);
      const query={...(individual?{athleteId:state.selected?.id}:filters()),exerciseType:selected,limit:12,period:individual?'month':'day'};
      const data=await request('/api/admin/resultados/evolucion'+qs(query));
      if(serial!==state.serial)return;
      const series=data.evolution?.series||[];
      if(individual){
        const serie=series.find(s=>s.exerciseType===selected);
        plot('detail-chart',serie?.points,serie?.metric?.unit||'',TYPES[selected].color);
        $('detail-chart-caption').textContent=serie?serie.metric.label+' · '+(serie.metric.unit||'sin unidad')+' · por sesión':'Sin métricas disponibles para este ejercicio';
      }else{
        const visible=selected?series.filter(s=>s.exerciseType===selected):series;
        plotMultiple('trend',visible);
        $('trend-caption').textContent=visible.length?visible.map(s=>(TYPES[s.exerciseType]?.short||s.exerciseType)+': '+(s.metric?.label||'Indicador')+' ('+(s.metric?.unit||'sin unidad')+')').join(' · ')+' · por fecha':'Sin métricas disponibles';
      }
    }catch(e){if(serial===state.serial)notice(e.message,'error');}
  }
  async function loadAthletes(){const search=$('athlete-search').value.trim(),federacion=$('athlete-federation').value;const query={limit:50,offset:state.athletePage*50,federacion,...(search.length>=2?{search}:{})};try{const data=await request('/api/admin/atletas'+qs(query));state.athleteTotal=data.total||0;state.athleteCache=data.atletas||[];$('athletes-body').innerHTML=state.athleteCache.length?state.athleteCache.map(a=>`<tr data-athlete="${a.id}" tabindex="0" role="button" aria-label="Ver perfil de ${txt(fullName(a))}"><td><span class="initial">${txt((a.nombre||'?')[0])}</span><strong>${txt(fullName(a))}</strong></td><td>${txt(a.federacion||'Sin declarar')}</td><td>${date(a.createdAt)}</td><td><button class="link-button" data-athlete="${a.id}">Ver perfil →</button></td></tr>`).join(''):'<tr><td colspan="4" class="empty">No se encontraron atletas.</td></tr>';$('athletes-count').textContent=`${data.total} atletas · página ${state.athletePage+1}`;$('athletes-prev').disabled=state.athletePage===0;$('athletes-next').disabled=(state.athletePage+1)*50>=state.athleteTotal;fillCompareOptions();}catch(e){notice(e.message,'error');}}
  function fillCompareOptions(){for(const id of ['compare-a','compare-b']){const el=$(id),old=el.value;el.innerHTML=state.athleteCache.map(a=>`<option value="${a.id}">${txt(a.nombre)}</option>`).join('');if(old&&state.athleteCache.some(a=>String(a.id)===old))el.value=old;}if($('compare-b').options.length>1&&$('compare-b').value===$('compare-a').value)$('compare-b').selectedIndex=1;}
  async function openAthlete(id){let athlete=state.athleteCache.find(a=>String(a.id)===String(id));if(!athlete){const found=await request('/api/admin/atletas'+qs({athleteId:id,limit:1}));athlete=found.atletas?.[0];}if(!athlete)return;state.selected=athlete;state.detailPage=0;$('detail-name').textContent=athlete.nombre;$('detail-federation').textContent=`Federación declarada: ${athlete.federacion||'Sin declarar'}`;show('detail');await loadDetail();}
  async function loadDetail(){if(!state.selected)return;const athleteId=state.selected.id,serial=++state.serial;try{const [summary,list]=await Promise.all([request('/api/admin/resultados/resumen'+qs({athleteId})),request('/api/admin/resultados/sesiones'+qs({athleteId,limit:20,offset:state.detailPage*20}))]);if(serial!==state.serial)return;const s=summary.summary;const items=[['Sesiones',s.totalSessions],['Precisión','Según ejercicio'],['Tiempo promedio',duration(s.averageDurationSeconds)]];$('detail-stats').innerHTML=items.map(([label,value])=>`<div class="stat card"><div class="stat-head">${label}</div><div class="stat-value small-value">${value}</div></div>`).join('');const old=state.summary;renderSummary(s);$('detail-exercises').innerHTML=$('exercise-cards').innerHTML;if(old)renderSummary(old);state.detailTotal=list.total||0;renderSessions('detail-sessions',list.sesiones||[]);$('detail-total').textContent=`${list.total} sesiones · página ${state.detailPage+1}`;$('detail-prev').disabled=state.detailPage===0;$('detail-next').disabled=(state.detailPage+1)*20>=state.detailTotal;await loadTrend(true,serial);}catch(e){if(serial===state.serial)notice(e.message,'error');}}
  function metricRows(a,b){const A=new Map(a.exercises?.flatMap(e=>Object.entries(e.metrics||{}).map(([key,m])=>[e.exerciseType+':'+key,m]))||[]),B=new Map(b.exercises?.flatMap(e=>Object.entries(e.metrics||{}).map(([key,m])=>[e.exerciseType+':'+key,m]))||[]);return [...A].filter(([key])=>B.has(key)).map(([key,m])=>({key,label:m.label,unit:m.unit||'',a:m.average,b:B.get(key).average,direction:m.direction}));}
  async function loadCompare(){const a=$('compare-a').value,b=$('compare-b').value,type=$('compare-type').value;if(!a||!b){$('comparison-metrics').innerHTML='<div class="empty">Selecciona dos atletas del directorio.</div>';$('comparison-chart').innerHTML='';return;}if(a===b){$('comparison-metrics').innerHTML='<div class="empty">Selecciona dos atletas distintos.</div>';$('comparison-chart').innerHTML='';return;}try{const [ra,rb]=await Promise.all([request('/api/admin/resultados/resumen'+qs({athleteId:a,exerciseType:type})),request('/api/admin/resultados/resumen'+qs({athleteId:b,exerciseType:type}))]);const rows=metricRows(ra.summary,rb.summary);$('comparison-metrics').innerHTML=`<div class="compare-metric"><span>Sesiones del ejercicio</span><div class="compare-vals"><strong>${ra.summary.totalSessions}</strong><strong>${rb.summary.totalSessions}</strong></div></div>`+rows.map(r=>`<div class="compare-metric"><span>${txt(r.label)} (${txt(r.unit)})</span><div class="compare-vals"><strong>${number(r.a)}</strong><strong>${number(r.b)}</strong></div></div>`).join('')+(rows.length?'':'<div class="empty">Sin métricas en común para comparar.</div>');const first=rows.find(r=>r.unit==='%')||rows[0];if(!first){$('comparison-chart').innerHTML='<div class="empty">Sin valores comparables.</div>';return;}const max=Math.max(first.a,first.b,1);$('comparison-chart').innerHTML=`<div style="width:100%;padding:20px"><p style="font-size:12px;color:#8c9aaa">${txt(first.label)} (${txt(first.unit)})</p>${[[a,first.a,'#4878eb'],[b,first.b,'#0ab8a3']].map(([id,v,c])=>`<div style="margin:23px 0"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px"><strong>${txt(state.athleteCache.find(x=>String(x.id)===id)?.nombre||id)}</strong><b>${number(v)}</b></div><div class="bar" style="height:18px"><i style="background:${c};width:${Math.max(0,v/max*100)}%"></i></div></div>`).join('')}</div>`;}catch(e){notice(e.message,'error');}}
  async function openSession(id){try{const query=state.view==='detail'?qs({athleteId:state.selected.id}):qs(filters());const data=await request('/api/admin/resultados/sesiones/'+encodeURIComponent(id)+query);const s=data.session;const groups=[['Manos',s.exercises],['Pies',s.footExercises],['Dirección',s.runningExercises]];$('session-detail').innerHTML=`<div class="detail-row"><span>ID</span><strong>${txt(s.sessionId)}</strong></div><div class="detail-row"><span>Atleta</span><strong>#${txt(s.athleteId)}</strong></div><div class="detail-row"><span>Inicio</span><strong>${date(s.startedAt)}</strong></div><div class="detail-row"><span>Duración</span><strong>${duration((new Date(s.endedAt)-new Date(s.startedAt))/1000)}</strong></div>`+groups.filter(([,entries])=>entries?.length).map(([label,entries])=>`<div class="detail-group"><h3>${label}</h3>${entries.map((e,i)=>`<p><b>Registro ${i+1}</b></p>${Object.entries(e.metrics||{}).filter(([,v])=>typeof v==='number'||typeof v==='string').map(([k,v])=>`<div class="detail-row"><span>${txt(metricLabel(k))}</span><strong>${txt(v)}</strong></div>`).join('')}`).join('')}</div>`).join('');$('session-dialog').showModal();}catch(e){notice(e.message,'error');}}
  async function loadAdministrators(){
    if(!canManageAdmins())return;
    try{
      const data=await request('/api/admin/administradores'+qs({limit:25,offset:state.adminPage*25}));
      state.adminTotal=data.total||0;
      $('admins-body').innerHTML=(data.administradores||[]).map(a=>{
        const privileged=a.role==='superadmin',self=a.id===state.user.id;
        const change=privileged||self?'—':`<button class="link-button" data-admin-state="${a.id}" data-active="${!a.isActive}">${a.isActive?'Desactivar':'Reactivar'}</button>`;
        return `<tr><td><strong>${txt(a.nombre)}</strong><div style="font-size:10px;color:#a1adba">@${txt(a.username)}</div></td><td>${privileged?'Superadministrador':'Administrador'}</td><td><span class="status-chip ${a.isActive?'':'off'}">${a.isActive?'Activo':'Inactivo'}</span></td><td>${change}</td></tr>`;
      }).join('')||'<tr><td colspan="4" class="empty">No hay administradores.</td></tr>';
      $('admins-total').textContent=`${state.adminTotal} cuentas · página ${state.adminPage+1}`;
      $('admins-prev').disabled=state.adminPage===0;$('admins-next').disabled=(state.adminPage+1)*25>=state.adminTotal;
    }catch(e){notice(e.message,'error');}
  }
  async function loadAudit(){if(!canManageAdmins())return;try{
    const data=await request('/api/admin/administradores/auditoria?limit=50');
    const labels={admin_created:'Administrador creado',admin_deactivated:'Administrador desactivado',admin_reactivated:'Administrador reactivado',superadmin_bootstrap:'Superadministrador aprovisionado'};
    $('audit-body').innerHTML=(data.eventos||[]).map(e=>`<tr><td>${date(e.createdAt)}</td><td>${txt(labels[e.action]||e.action)}</td><td>#${txt(e.actorUserId)}</td><td>#${txt(e.targetUserId)}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">Todavía no hay eventos.</td></tr>';
  }catch(e){notice(e.message,'error');}}
  async function createAdministrator(event){event.preventDefault();if(!canManageAdmins())return;
    const button=$('admin-create-button');button.disabled=true;
    try{
      const payload={nombre:$('new-admin-name').value.trim(),username:$('new-admin-username').value.trim(),password:$('new-admin-password').value};
      await request('/api/admin/administradores',{method:'POST',body:JSON.stringify(payload)});
      $('admin-create').reset();await Promise.all([loadAdministrators(),loadAudit()]);notice('Administrador creado correctamente. Comparte su contraseña inicial mediante un canal seguro.');
    }catch(e){notice(e.message,'error');}finally{button.disabled=false;}
  }
  async function toggleAdministrator(button){if(!canManageAdmins())return;
    const id=Number(button.dataset.adminState),isActive=button.dataset.active==='true';
    if(!Number.isSafeInteger(id)||id<1)return;
    if(!window.confirm(`¿Seguro que deseas ${isActive?'reactivar':'desactivar'} esta cuenta administrativa?`))return;
    button.disabled=true;
    try{await request('/api/admin/administradores/'+id+'/estado',{method:'PATCH',body:JSON.stringify({isActive})});await Promise.all([loadAdministrators(),loadAudit()]);notice(`Cuenta ${isActive?'reactivada':'desactivada'} correctamente.`);}catch(e){notice(e.message,'error');button.disabled=false;}
  }
  function exportVisible(){const rows=[['Atleta ID','Fecha','Modo','Ejercicios','Duración (segundos)'],...state.recent.map(s=>[s.athleteId,s.startedAt,s.mode,typeList(s),(new Date(s.endedAt)-new Date(s.startedAt))/1000])];const csv='\ufeff'+rows.map(row=>row.map(value=>'"'+String(value??'').replaceAll('"','""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='praxen-actividad-reciente.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('El CSV incluye las 20 sesiones visibles más recientes; no es una exportación completa del historial.');}
  $('login-form').addEventListener('submit',login);$('toggle-password').addEventListener('click',()=>{$('password').type=$('password').type==='password'?'text':'password';});$('logout').addEventListener('click',()=>logout());$('mobile-logout').addEventListener('click',()=>logout());$('dialog-close').addEventListener('click',()=>$('session-dialog').close());$('export').textContent='⇩ Exportar vista CSV';$('export').addEventListener('click',exportVisible);
  document.addEventListener('click',async e=>{const nav=e.target.closest('[data-view]');if(nav){const v=nav.dataset.view;show(v);if(v==='athletes')await loadAthletes();if(v==='groups')await loadGroups();if(v==='users'&&canManageAdmins())await loadUsers();if(v==='compare')await loadCompare();if(v==='administrators'&&canManageAdmins())await Promise.all([loadAdministrators(),loadAudit()]);return;}const close=e.target.closest('[data-close-dialog]');if(close){$(close.dataset.closeDialog).close();return;}const openGroupEl=e.target.closest('[data-open-group]');if(openGroupEl){await openGroup(openGroupEl.dataset.openGroup);return;}const resetUser=e.target.closest('[data-reset-user]');if(resetUser){openReset(resetUser.dataset.resetUser);return;}const unassign=e.target.closest('[data-unassign]');if(unassign&&state.selectedGroup&&canManageGroups()){if(window.confirm('¿Quitar a este deportista del grupo?'))await groupMutation('/api/admin/grupos/'+encodeURIComponent(state.selectedGroup.id)+'/usuarios/'+encodeURIComponent(unassign.dataset.unassign),{method:'DELETE'});return;}const assign=e.target.closest('[data-assign-user]');if(assign&&state.selectedGroup&&canManageGroups()){const ok=await groupMutation('/api/admin/grupos/'+encodeURIComponent(state.selectedGroup.id)+'/usuarios',{method:'POST',body:JSON.stringify({userId:Number(assign.dataset.assignUser)})});if(ok)$('assignment-dialog').close();return;}const admin=e.target.closest('[data-admin-state]');if(admin){await toggleAdministrator(admin);return;}const athlete=e.target.closest('[data-athlete]');if(athlete){await openAthlete(athlete.dataset.athlete);return;}const session=e.target.closest('[data-session]');if(session)await openSession(session.dataset.session);});
  $('athletes-body').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr[data-athlete]')){e.preventDefault();openAthlete(e.target.dataset.athlete);}});
  $('admin-create').addEventListener('submit',createAdministrator);$('refresh-audit').addEventListener('click',loadAudit);$('admins-prev').addEventListener('click',()=>{state.adminPage=Math.max(0,state.adminPage-1);loadAdministrators()});$('admins-next').addEventListener('click',()=>{state.adminPage++;loadAdministrators()});
  ['group-filter','federation','exercise','date-from','date-to'].forEach(id=>$(id).addEventListener('change',()=>{if($('date-from').value&&$('date-to').value&&$('date-to').value<$('date-from').value){notice('La fecha final debe ser igual o posterior a la inicial.');return;}loadDashboard();}));$('clear-filters').addEventListener('click',()=>{['group-filter','federation','exercise','date-from','date-to'].forEach(id=>$(id).value='');loadDashboard();});$('trend-type').addEventListener('change',()=>loadTrend());$('detail-type').addEventListener('change',()=>loadTrend(true));

  $('open-password').addEventListener('click',()=>{$('password-form-error').classList.add('hidden');$('password-dialog').showModal();});
  $('mobile-account').addEventListener('click',()=>{$('password-form-error').classList.add('hidden');$('password-dialog').showModal();});
  $('password-change-form').addEventListener('submit',changeOwnPassword);
  $('reset-form').addEventListener('submit',resetPassword);
  $('new-group-trigger').addEventListener('click',()=>{$('group-form').reset();delete $('group-form').dataset.editing;$('group-dialog-title').textContent='Nuevo grupo';$('group-dialog').showModal();});
  $('group-form').addEventListener('submit',saveGroup);
  $('group-search').addEventListener('input',renderGroups);
  $('group-user-search').addEventListener('input',renderGroupMembers);
  $('group-detail-close').addEventListener('click',()=>{$('group-detail').classList.add('hidden');state.selectedGroup=null;});
  $('group-edit').addEventListener('click',()=>{if(!state.selectedGroup||!canManageGroups())return;$('group-form').dataset.editing=state.selectedGroup.id;$('group-name').value=state.selectedGroup.nombre;$('group-description').value=state.selectedGroup.descripcion||'';$('group-dialog-title').textContent='Editar grupo';$('group-dialog').showModal();});
  $('group-delete').addEventListener('click',async()=>{if(!state.selectedGroup||!canManageGroups()||!window.confirm('¿Eliminar este grupo? No se eliminarán las cuentas ni sus sesiones.'))return;await groupMutation('/api/admin/grupos/'+encodeURIComponent(state.selectedGroup.id),{method:'DELETE'});});
  $('group-add-user').addEventListener('click',async()=>{if(!canManageGroups()||!state.selectedGroup)return;$('assignment-search').value='';$('assignment-dialog').showModal();await findAssignments();});
  async function findAssignments(){
    const target=$('assignment-options');target.innerHTML='<div class="empty">Buscando deportistas…</div>';
    try{
      const data=await request('/api/admin/usuarios'+qs({search:$('assignment-search').value.trim(),role:'athlete',limit:50}));
      const rows=(data.usuarios||[]).filter(u=>!state.groupMembers.some(m=>String(m.id)===String(u.id)));
      target.innerHTML=rows.map(u=>'<div class="assignment-choice"><div><strong>'+txt(u.nombre)+'</strong><small>@'+txt(u.username)+'</small></div><button class="btn" data-assign-user="'+txt(u.id)+'">Agregar</button></div>').join('')||'<div class="empty">No hay deportistas disponibles.</div>';
    }catch(e){target.innerHTML='<div class="empty">'+txt(e.message)+'</div>';}
  }
  let assignmentTimer;$('assignment-search').addEventListener('input',()=>{clearTimeout(assignmentTimer);assignmentTimer=setTimeout(findAssignments,300);});
  let usersTimer;$('users-search').addEventListener('input',()=>{clearTimeout(usersTimer);usersTimer=setTimeout(()=>{state.userPage=0;loadUsers();},300);});
  $('users-role').addEventListener('change',()=>{state.userPage=0;loadUsers();});
  $('users-prev').addEventListener('click',()=>{state.userPage=Math.max(0,state.userPage-1);loadUsers();});
  $('users-next').addEventListener('click',()=>{state.userPage++;loadUsers();});
  let searchTimer;$('athlete-search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(()=>{state.athletePage=0;loadAthletes()},300)});$('athlete-federation').addEventListener('change',()=>{state.athletePage=0;loadAthletes()});$('athletes-prev').addEventListener('click',()=>{state.athletePage=Math.max(0,state.athletePage-1);loadAthletes()});$('athletes-next').addEventListener('click',()=>{state.athletePage++;loadAthletes()});$('detail-prev').addEventListener('click',()=>{state.detailPage=Math.max(0,state.detailPage-1);loadDetail()});$('detail-next').addEventListener('click',()=>{state.detailPage++;loadDetail()});['compare-a','compare-b','compare-type'].forEach(id=>$(id).addEventListener('change',loadCompare));$('date-today').textContent=new Date().toLocaleDateString('es-GT',{day:'numeric',month:'short',year:'numeric'});
})();
