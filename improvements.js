/* Local-first upgrades. Existing weights remain in pounds internally. */
const clone = x => JSON.parse(JSON.stringify(x));
const safe = x => String(x ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
S.sessions ||= [];
S.unit ||= 'lb';
S.schemaVersion=2;
// Recover full details still present in legacy daily logs without duplicating history.
Object.entries(S.logs).forEach(([date,l])=>{
  if(!l.finished)return;
  l.id ||= crypto.randomUUID();
  if(!S.sessions.some(s=>s.id===l.id))S.sessions.push({...clone(l),date});
  const h=S.history.find(h=>h.date===date&&h.routine===l.routine&&!h.id);if(h)h.id=l.id;
});
const unitWeight = w => w === '' || w == null ? '' : Math.round(Number(w)*(S.unit==='kg'?0.45359237:1)*10)/10;
const storedWeight = w => w === '' ? '' : Number(w)/(S.unit==='kg'?0.45359237:1);
let storageFailed=false;
save = function(){
  if(loadIssue){toast('No se pudo leer tu registro anterior. Descárgalo desde el aviso antes de continuar.');return;}
  try {
    const previous=localStorage.getItem('fitcoach');
    if(previous) localStorage.setItem('fitcoach-recovery',previous);
    localStorage.setItem('fitcoach',JSON.stringify(S));
    storageFailed=false;
    queueFolderBackup();
  } catch(e){ storageFailed=true; toast('No se pudo guardar. Exporta un respaldo antes de cerrar.'); }
};
const oldGetLog=getTodayLog;
let activeDay=todayKey();
getTodayLog=function(){
  // Keep a workout attached to the day it started, even after midnight.
  if(document.getElementById('woView').classList.contains('show') && S.logs[activeDay]) return S.logs[activeDay];
  activeDay=todayKey();
  const log=oldGetLog();
  log.id ||= crypto.randomUUID();
  return log;
};
function archiveCurrent(){
  const log=getTodayLog();
  if(log.exercises.some(e=>e.done || e.sets.some(s=>s.done||s.w!==''||s.r!=='')) || log.finished){
    if(!S.sessions.some(x=>x.id===log.id)) S.sessions.push({...clone(log),date:activeDay,archived:true});
  }
}
function replaceToday(routine,exercises){
  archiveCurrent();
  S.logs[todayKey()]={id:crypto.randomUUID(),routine,exercises:clone(exercises),finished:false};
  save(); nav('hoy');
}
useGenerated=function(){if(generated)replaceToday('Rutina del Coach',generated);};
function applyPlan(){
  const r=S.week[new Date().getDay()]||'Descanso';
  replaceToday(r,r==='Descanso'?[]:buildExercises(r));
  toast('Plan aplicado. La sesión anterior se conserva.');
}
function setUnit(u){S.unit=u;save();renderToday();renderProgress();}
setWeight=function(i,j,v){
  if(v!=='' && (!Number.isFinite(Number(v))||Number(v)<0||Number(v)>5000)){toast('Revisa el peso');return;}
  getTodayLog().exercises[i].sets[j].w=storedWeight(v);save();
};
function setSeries(i,j,key,value){
  const n=Number(value);
  if(value!=='' && (!Number.isFinite(n)||n<(key==='effort'?1:0)||n>(key==='effort'?10:200)||(key==='r'&&!Number.isInteger(n)))){toast('Revisa el valor');return;}
  getTodayLog().exercises[i].sets[j][key]=value===''?'':n;save();
}
toggleEx=function(i){const e=getTodayLog().exercises[i];e.done=!e.done;e.sets.forEach(s=>s.done=e.done);save();renderToday();};
function previousExercise(name){
  return [...S.sessions].sort((a,b)=>(b.finishedAt||0)-(a.finishedAt||0)||b.date.localeCompare(a.date)).flatMap(x=>x.exercises||[]).find(e=>e.n===name && (e.done||e.sets.some(s=>s.done))) || null;
}
function adviceFor(e){
  const prior=previousExercise(e.n);
  if(!prior)return 'Registra repeticiones y esfuerzo (1–10) para personalizar la próxima sesión.';
  const sets=prior.sets.filter(s=>s.done||prior.done), target=Number((e.r.match(/\d+/g)||[]).slice(-1)[0]);
  if(!sets.length || sets.some(s=>!s.r||!s.effort))return 'Completa repeticiones y esfuerzo para comparar con la sesión anterior.';
  const effort=Math.max(...sets.map(s=>s.effort));
  if(effort>=9)return 'La última sesión exigió mucho esfuerzo. Revisa recuperación y considera mantener o reducir la carga.';
  if(target && sets.every(s=>s.r>=target) && effort<=7)return 'Completaste las repeticiones con margen. Puedes considerar el siguiente incremento pequeño disponible.';
  return 'Mantén la carga como referencia y busca completar las repeticiones con técnica controlada.';
}
const oldRenderToday=renderToday;
renderToday=function(){
  oldRenderToday();
  const log=getTodayLog(), cards=document.querySelectorAll('#todayCard .ex');
  cards.forEach((card,i)=>{
    const e=log.exercises[i];
    if(e.cat!=='pesas'||e.warmup)return;
    const rows=card.querySelector('.log-row');
    const old=rows?.previousElementSibling;
    if(old?.textContent.includes('Última vez'))old.remove();
    if(rows)rows.remove();
    const prior=previousExercise(e.n), lw=lastWeights(e.n);
    const container=document.createElement('div');
    container.innerHTML=`<p class="note">${safe(adviceFor(e))}</p><div class="series-grid"><b>Serie</b><b>${S.unit}</b><b>Reps</b><b>Esfuerzo</b>${e.sets.map((s,j)=>{
      const p=prior?.sets[j], last=p?.w ?? lw?.sets[j];
      return `<span>${j+1}<small style="display:block">${last!=null&&last!==''?safe(unitWeight(last))+' '+S.unit:''}${p?.r?' × '+p.r:''}</small></span>
      <input aria-label="Peso serie ${j+1}" type="number" min="0" step="0.1" value="${unitWeight(s.w)}" placeholder="${unitWeight(last)}" onchange="setWeight(${i},${j},this.value)">
      <input aria-label="Repeticiones serie ${j+1}" type="number" min="0" max="200" value="${s.r||''}" onchange="setSeries(${i},${j},'r',this.value)">
      <input aria-label="Esfuerzo serie ${j+1}" type="number" min="1" max="10" value="${s.effort||''}" onchange="setSeries(${i},${j},'effort',this.value)">`;
    }).join('')}</div>`;
    card.append(container);
  });
  const end=document.createElement('div');
  end.innerHTML='<button class="btn ghost" style="margin-top:12px" onclick="applyPlan()">Aplicar el plan actualizado</button><p class="note">Conserva la sesión actual en el historial antes de cambiar.</p>';
  if(!log.finished && log.exercises.some(e=>e.done||e.sets.some(s=>s.done))){
    const btn=document.createElement('button');btn.className='btn';btn.textContent='Finalizar y ver resumen';btn.onclick=finishWorkout;end.prepend(btn);
  }
  document.getElementById('todayCard').append(end);
};
finishWorkout=function(){
  const l=getTodayLog();if(l.finished){toast('Este entreno ya está registrado');return;}
  const sets=l.exercises.filter(e=>!e.warmup).reduce((n,e)=>n+e.sets.filter(s=>s.done||e.done).length,0);
  if(!sets){toast('Completa al menos una serie');return;}
  l.finished=true;l.finishedAt=Date.now();l.id ||= crypto.randomUUID();
  const date=activeDay;
  const minutes=l.startedAt?Math.max(1,Math.round((Date.now()-l.startedAt)/60000)):null;
  const snapshot={...clone(l),date,sets,minutes};
  S.sessions.push(snapshot);
  S.history.unshift({id:l.id,date,routine:l.routine,sets,minutes});
  l.exercises.filter(e=>e.cat==='pesas'&&!e.warmup).forEach(e=>{
    const completed=e.sets.filter(s=>s.done||e.done);
    const weights=completed.map(s=>Number(s.w)).filter(w=>w>0);
    if(weights.length)(S.weights[e.n] ||= []).push({id:l.id,d:date,sets:weights});
  });
  save();renderToday();showSummary(snapshot);
};
function showSummary(session){
  const modal=document.getElementById('sessionModal');
  document.getElementById('sessionContent').innerHTML=`<h2>${safe(session.routine)}</h2><p class="note">${safe(session.date)} · ${session.finished?'Completado':'Sesión conservada'}${session.minutes?' · '+session.minutes+' min':''}</p>${(session.exercises||[]).map(e=>`<div class="ex"><b>${safe(e.n)}</b><p class="note">${e.sets.map((s,j)=>`S${j+1}: ${s.done||e.done?'✓':'pendiente'} ${s.w!==''?unitWeight(s.w)+' '+S.unit:''}${s.r?' × '+s.r:''}${s.effort?' · esfuerzo '+s.effort+'/10':''}`).join('<br>')}</p></div>`).join('')}`;
  modal.classList.add('show');
}
const oldStartWO=startWO;
startWO=function(){const l=getTodayLog();l.startedAt ||= Date.now();save();oldStartWO();};
const oldRenderWO=renderWO;
renderWO=function(){
  oldRenderWO();if(woRest>0)return;
  const e=getTodayLog().exercises[woIdx], input=document.getElementById('woW');
  if(!e||!input)return;
  const j=e.sets.filter(s=>s.done).length,s=e.sets[j];
  input.value=unitWeight(s.w);input.placeholder=S.unit;input.step='0.1';input.min='0';input.setAttribute('aria-label','Peso en '+S.unit);
  const prior=previousExercise(e.n)?.sets[j];
  const extra=document.createElement('div');
  extra.innerHTML=`<p class="note" style="text-align:center">${prior?`Anterior: ${unitWeight(prior.w)} ${S.unit} × ${prior.r||'—'}. `:''}${safe(adviceFor(e))}</p><div class="row"><label>Repeticiones<input id="woReps" type="number" min="0" max="200" value="${s.r||''}" oninput="setSeries(${woIdx},${j},'r',this.value)"></label><label>Esfuerzo (1–10)<input id="woEffort" type="number" min="1" max="10" value="${s.effort||''}" oninput="setSeries(${woIdx},${j},'effort',this.value)"></label></div>`;
  input.parentElement.after(extra);
  document.querySelectorAll('#woBody .wo-meta').forEach(el=>{if(el.textContent.includes('Última vez'))el.textContent='Última vez: '+(lastWeights(e.n)?.sets||[]).map(unitWeight).join(' · ')+' '+S.unit;});
};
woSaveW=function(v){const e=getTodayLog().exercises[woIdx];setWeight(woIdx,e.sets.filter(s=>s.done).length,v);};
woSetDone=function(){
  const e=getTodayLog().exercises[woIdx],j=e.sets.findIndex(s=>!s.done);if(j<0)return;
  const inp=document.getElementById('woW');
  if(inp && !inp.checkValidity()){inp.reportValidity();return;}
  for(const id of ['woReps','woEffort']){const el=document.getElementById(id);if(el&&!el.checkValidity()){el.reportValidity();return;}}
  woSaveW(inp?.value||'');e.sets[j].done=true;e.done=e.sets.every(s=>s.done);save();
  woStartRest(e.done?()=>woNext():null);
};
let restDeadline=0,restAfter=null;
stopWoRest=function(){clearInterval(woRestInt);woRestInt=null;woRest=0;restAfter=null;};
function completeRest(){const next=restAfter;stopWoRest();if(navigator.vibrate)navigator.vibrate([200,100,200]);if(next)next();else renderWO();}
function tickRest(){woRest=Math.max(0,Math.ceil((restDeadline-Date.now())/1000));if(!woRest)completeRest();else{const el=document.querySelector('.wo-timer');if(el)el.textContent=fmt(woRest);}}
woStartRest=function(after){stopWoRest();restAfter=after;restDeadline=Date.now()+woRestSecs()*1000;woRest=woRestSecs();renderWO();const skip=document.querySelector('#woBody button');if(skip)skip.onclick=completeRest;woRestInt=setInterval(tickRest,250);};
let timerDeadline=0;
toggleTimer=function(){
  const b=document.getElementById('timerBtn');
  if(tRun){tLeft=Math.max(0,Math.ceil((timerDeadline-Date.now())/1000));clearInterval(tInt);tRun=false;b.textContent='▶ Reanudar';return;}
  if(tLeft<=0)tLeft=tSec;tRun=true;timerDeadline=Date.now()+tLeft*1000;b.textContent='⏸ Pausar';
  tInt=setInterval(tickTimer,250);
};
function tickTimer(){tLeft=Math.max(0,Math.ceil((timerDeadline-Date.now())/1000));upTimer();if(tLeft===0){clearInterval(tInt);tRun=false;document.getElementById('timerBtn').textContent='▶ Iniciar';toast('Descanso terminado');if(navigator.vibrate)navigator.vibrate(200);}}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(tRun)tickTimer();if(woRestInt)tickRest();}});
function estimateExercise(e){
  if(e.cat==='cardio'){
    const match=e.r.match(/(\d+)(?:\s*[-–]\s*(\d+))?\s*min/i);
    return match?(Number(match[1])+Number(match[2]||match[1]))/2:8;
  }
  const reps=Number((e.r.match(/\d+/g)||['10']).slice(-1)[0]);
  const seconds=/seg|sec|\bs\b/.test(e.r)?Number(e.r.match(/\d+/)?.[0]||40):reps*4;
  return e.base*seconds/60+Math.max(0,e.base-1)*woRestSecs()/60+1;
}
generateRoutine=function(){
  let r=S.week[new Date().getDay()];
  if(gFocus==='pesas'){
    const keys=Object.keys(LIB.pesas);
    r=keys.sort((a,b)=>{
      const last=k=>S.history.find(h=>h.routine===k)?.date||'';
      return last(a).localeCompare(last(b));
    })[0];
  }else if(gFocus==='cardio')r='Cardio quema-grasa';else if(gFocus==='peso')r='Peso corporal (casa)';else if(gFocus==='core')r='Core/Abdomen';
  if(!r||r==='Descanso')r='Full body fuerza';
  const pool=buildExercises(r);let used=0;generated=[];
  pool.forEach(source=>{
    const e=clone(source);
    while(e.base>1 && used+estimateExercise(e)>gDur){e.base--;e.sets.pop();}
    const minutes=estimateExercise(e);
    if(used+minutes<=gDur){generated.push(e);used+=minutes;}
  });
  document.getElementById('previewCard').style.display='block';
  document.getElementById('previewList').innerHTML=`<p class="coach-msg">Estimación: ${Math.ceil(used)} de ${gDur} min disponibles. Incluye ejecución, descansos y cambios de ejercicio. Ajusta según tu ritmo.</p>${generated.map(e=>`<div class="ex"><b>${safe(e.n)}</b><p class="note">${e.base} series · ${safe(e.r)} · ~${Math.ceil(estimateExercise(e))} min</p>${e.cat==='pesas'?'<p class="note">'+safe(adviceFor(e))+'</p>':''}</div>`).join('')}${!generated.length?'<p>Sin ejercicios compatibles. Revisa tu equipo y preferencias.</p>':''}`;
  document.getElementById('previewCard').scrollIntoView({behavior:'smooth'});
};
evalToday=function(){
  const l=getTodayLog(),minutes=l.exercises.reduce((n,e)=>n+estimateExercise(e),0);
  document.getElementById('evalBox').innerHTML=`<div class="coach-msg"><b>${safe(GOALS[S.goal].label)}</b> · ~${Math.ceil(minutes)} min<br>Revisión orientativa basada en tu registro, sin puntuación universal.</div>${l.exercises.filter(e=>e.cat==='pesas').map(e=>`<p class="note"><b>${safe(e.n)}:</b> ${safe(adviceFor(e))}</p>`).join('')}`;
};
let calendarOffset=0;
function weekStart(date){const d=new Date(date);d.setHours(0,0,0,0);d.setDate(d.getDate()-(d.getDay()+6)%7);return d;}
const oldRenderProgress=renderProgress;
renderProgress=function(){
  oldRenderProgress();
  const start=weekStart(new Date()),prev=new Date(start);prev.setDate(prev.getDate()-7);
  const wk=S.history.filter(h=>h.date>=todayKey(start)&&h.date<=todayKey());
  const pw=S.history.filter(h=>h.date>=todayKey(prev)&&h.date<todayKey(start));
  document.getElementById('stWeek').textContent=wk.length;
  const sum=a=>a.reduce((n,h)=>n+(h.sets||0),0);
  document.getElementById('weeklyComparison').textContent=`Esta semana: ${wk.length} entrenos y ${sum(wk)} series. Semana anterior: ${pw.length} entrenos y ${sum(pw)} series.`;
  const hist=document.getElementById('histList');hist.innerHTML='';
  const sessions=[...S.sessions].reverse();
  const known=new Set(sessions.map(s=>s.id));
  [...sessions,...S.history.filter(h=>!known.has(h.id))].forEach(s=>{
    const row=document.createElement('button');row.className='btn ghost';row.style.marginBottom='8px';
    row.textContent=`${s.date} · ${s.routine} · ${s.finished||!s.exercises?'Completado':'Conservado'}`;
    row.onclick=()=>s.exercises?showSummary(s):toast('Registro antiguo: '+s.sets+' series. Sin detalle por serie.');hist.append(row);
  });
  renderCalendar();
};
function renderCalendar(){
  const month=new Date();month.setDate(1);month.setMonth(month.getMonth()+calendarOffset);
  document.getElementById('calendarTitle').textContent=month.toLocaleDateString('es',{month:'long',year:'numeric'});
  const grid=document.getElementById('calendarGrid');grid.innerHTML='';
  ['L','M','X','J','V','S','D'].forEach(d=>{const el=document.createElement('b');el.textContent=d;grid.append(el);});
  for(let i=0;i<(month.getDay()+6)%7;i++)grid.append(document.createElement('span'));
  const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
  for(let d=1;d<=count;d++){
    const key=todayKey(new Date(month.getFullYear(),month.getMonth(),d)), found=S.history.filter(h=>h.date===key);
    const b=document.createElement('button');b.className='chip'+(found.length?' on':'');b.textContent=d;b.setAttribute('aria-label',key+': '+found.length+' entrenos');
    b.onclick=()=>{const s=S.sessions.find(x=>x.date===key&&x.finished);if(s)showSummary(s);else toast(found.length?found.map(x=>x.routine).join(', '):'Sin entrenamientos registrados');};grid.append(b);
  }
}
renderWeightChart=function(){
  const list=(S.weights[document.getElementById('wExSel').value]||[]).slice(-20),box=document.getElementById('wChart');
  if(!list.length){box.textContent='Sin registros todavía';return;}
  const vals=list.map(x=>unitWeight(Math.max(...x.sets))),top=Math.max(...vals,1);
  box.innerHTML='<div style="display:flex;gap:5px;align-items:end;overflow-x:auto;height:170px">'+list.map((x,i)=>`<div style="flex:1;min-width:32px;text-align:center"><small>${vals[i]}</small><div style="height:${Math.max(3,vals[i]/top*105)}px;background:var(--accent);border-radius:5px"></div><small>${x.d.slice(5)}</small></div>`).join('')+`</div><p class="note">Máximo por sesión (${S.unit}). La carga se interpreta junto con repeticiones y esfuerzo.</p>`;
};
function validState(d){
  if(!d||!GOALS[d.goal]||!d.week||!d.logs||!Array.isArray(d.history)||!d.weights)return false;
  const text=JSON.stringify(d);if(text.length>20000000)return false;
  const safeTree=x=>typeof x==='string'?!/[<>"'`\\]/.test(x):Array.isArray(x)?x.every(safeTree):x&&typeof x==='object'?Object.entries(x).every(([k,v])=>!['__proto__','constructor','prototype'].includes(k)&&safeTree(k)&&safeTree(v)):true;
  if(!safeTree(d))return false;
  if(d.unit&&!['lb','kg'].includes(d.unit))return false;
  if(d.favorites&&!Array.isArray(d.favorites)||d.avoid&&!Array.isArray(d.avoid))return false;
  if(d.custom&&!Object.values(d.custom).every(a=>Array.isArray(a)&&a.every(e=>e&&typeof e.n==='string'&&typeof e.r==='string'&&Number.isInteger(e.s)&&e.s>0&&e.s<=12)))return false;
  if(!d.history.every(h=>h&&/^\d{4}-\d{2}-\d{2}$/.test(h.date)&&typeof h.routine==='string'))return false;
  if(!Object.values(d.weights).every(list=>Array.isArray(list)&&list.every(w=>w&&typeof w.d==='string'&&Array.isArray(w.sets)&&w.sets.every(n=>Number.isFinite(n)&&n>0))))return false;
  const exOK=e=>e&&typeof e.n==='string'&&!/[<>"'`\\]/.test(e.n)&&typeof e.r==='string'&&!/[<>"'`\\]/.test(e.r)&&Number.isInteger(e.base)&&e.base>0&&e.base<=12&&['pesas','cardio','peso'].includes(e.cat)&&Array.isArray(e.sets)&&e.sets.length===e.base&&e.sets.every(s=>s&&['w','r','effort'].every(k=>s[k]==null||s[k]===''||Number.isFinite(Number(s[k]))&&Number(s[k])>=0));
  return Object.values(d.logs).every(l=>typeof l.routine==='string'&&!/[<>"'`\\]/.test(l.routine)&&Array.isArray(l.exercises)&&l.exercises.every(exOK)) && (!d.sessions||Array.isArray(d.sessions)&&d.sessions.every(s=>Array.isArray(s.exercises)&&s.exercises.every(exOK)));
}
importData=function(){
  const input=document.createElement('input');input.type='file';input.accept='.json';
  input.onchange=async()=>{try{
    const f=input.files[0];if(!f)return;
    if(f.size>20000000)throw Error();const d=JSON.parse(await f.text());
    if(!validState(d))throw Error();
    if(!confirm('¿Restaurar este respaldo? Se descargará una copia de tus datos actuales antes de reemplazarlos.'))return;
    if(loadIssue)downloadUnreadable();else exportData();S=migrate(d);loadIssue=false;S.sessions||=[];S.unit||='lb';S.schemaVersion=2;save();document.getElementById('recoveryWarning')?.remove();nav('hoy');
  }catch(e){toast('Respaldo no válido. Tus datos siguen intactos.');}};input.click();
};
let backupFolder=null, backupTimeout=null, backupBusy=false;
function backupDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('fitness-backup',1);r.onupgradeneeded=()=>r.result.createObjectStore('settings');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
async function enableBackup(){
  if(!window.showDirectoryPicker){toast('Este navegador no permite respaldo a carpeta. Usa Exportar respaldo.');return;}
  try{
    const folder=await showDirectoryPicker({mode:'readwrite',id:'fitness-backups'});
    backupFolder=folder;const db=await backupDB();const tx=db.transaction('settings','readwrite');tx.objectStore('settings').put(folder,'folder');
    await writeFolderBackup();
  }catch(e){if(e.name!=='AbortError')toast('No se pudo habilitar el respaldo');}
}
async function writeFolderBackup(){
  if(!backupFolder||backupBusy||loadIssue)return;
  const status=document.getElementById('backupStatus');
  try{
    if(await backupFolder.queryPermission({mode:'readwrite'})!=='granted'){status.textContent='Vuelve a elegir la carpeta para autorizar los respaldos.';return;}
    backupBusy=true;
    const file=await backupFolder.getFileHandle('mi-coach-'+todayKey()+'.json',{create:true});const writable=await file.createWritable();await writable.write(JSON.stringify(S,null,2));await writable.close();
    status.textContent='Respaldo automático guardado: '+new Date().toLocaleTimeString();
  }catch(e){status.textContent='No se pudo guardar en la carpeta. Exporta un respaldo manual.';}finally{backupBusy=false;}
}
function queueFolderBackup(){clearTimeout(backupTimeout);if(backupFolder)backupTimeout=setTimeout(writeFolderBackup,1500);}
function disableBackup(){backupFolder=null;clearTimeout(backupTimeout);backupDB().then(db=>db.transaction('settings','readwrite').objectStore('settings').delete('folder'));document.getElementById('backupStatus').textContent='Respaldo automático desactivado';}
resetAll=function(){if(confirm('¿Borrar todos los datos de este navegador? Se exportará un respaldo primero.')){if(loadIssue)downloadUnreadable();else exportData();disableBackup();loadIssue=false;S=seed();S.sessions=[];S.unit='lb';S.schemaVersion=2;save();document.getElementById('recoveryWarning')?.remove();nav('hoy');}};
function downloadUnreadable(){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([localStorage.getItem('fitcoach')||''],{type:'application/json'}));a.download='mi-coach-recuperar.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);}
async function restoreBackupFolder(){try{const db=await backupDB();const req=db.transaction('settings').objectStore('settings').get('folder');req.onsuccess=()=>{backupFolder=req.result||null;if(backupFolder)writeFolderBackup();};}catch(e){}}
const style=document.createElement('style');style.textContent='.series-grid{display:grid;grid-template-columns:40px repeat(3,minmax(0,1fr));gap:7px;align-items:center;margin-top:12px;font-size:11px}.series-grid input{padding:9px 4px;min-width:0;text-align:center}.calendar-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;text-align:center}.calendar-grid button{padding:9px 0}.wo-sets{flex-wrap:wrap}button:focus-visible{outline:3px solid var(--accent2);outline-offset:3px}';document.head.append(style);
document.getElementById('v-semana').insertAdjacentHTML('beforeend',`<div class="card"><h2>Unidades de peso</h2><select aria-label="Unidades de peso" onchange="setUnit(this.value)"><option value="lb" ${S.unit==='lb'?'selected':''}>Libras (lb)</option><option value="kg" ${S.unit==='kg'?'selected':''}>Kilogramos (kg)</option></select><p class="note">Cambiar de unidad convierte la visualización y conserva tus registros.</p></div>`);
document.getElementById('v-progreso').insertAdjacentHTML('afterbegin','<div class="card"><h2>Comparación semanal</h2><p id="weeklyComparison" class="note"></p></div><div class="card"><div class="row"><button class="btn ghost sm" onclick="calendarOffset--;renderCalendar()" aria-label="Mes anterior">←</button><h2 id="calendarTitle"></h2><button class="btn ghost sm" onclick="calendarOffset++;renderCalendar()" aria-label="Mes siguiente">→</button></div><div id="calendarGrid" class="calendar-grid"></div></div>');
document.getElementById('v-progreso').insertAdjacentHTML('beforeend','<div class="card"><h2>Respaldo automático</h2><p class="note">Guarda una copia diaria en la carpeta que elijas mientras usas la aplicación. Puedes elegir una carpeta sincronizada con tu nube. Compatible con navegadores que permiten acceso a carpetas; en los demás, usa exportar.</p><button class="btn ghost" onclick="enableBackup()">Elegir carpeta de respaldo</button><button class="btn ghost" onclick="disableBackup()">Desactivar</button><p class="note" id="backupStatus">Sin carpeta configurada.</p></div><div class="card"><h2>Instalar en el teléfono</h2><p class="note">Abre la aplicación desde una dirección HTTPS. En iPhone: Compartir → Añadir a pantalla de inicio. En Android: menú → Instalar aplicación. Tras la primera carga podrás usarla sin conexión; las fotos se guardan al abrirlas.</p><p class="note">Para pasar tus registros del navegador a la aplicación instalada, exporta un respaldo y luego impórtalo allí.</p></div>');
document.body.insertAdjacentHTML('beforeend','<div id="sessionModal" class="modal" role="dialog" aria-modal="true" aria-label="Resumen de entrenamiento"><div class="sheet"><button class="xclose" aria-label="Cerrar resumen" onclick="document.getElementById(\'sessionModal\').classList.remove(\'show\')">✕</button><div id="sessionContent"></div></div></div>');
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('sessionModal').classList.remove('show');});
if(loadIssue)document.querySelector('main').insertAdjacentHTML('afterbegin','<div class="card" id="recoveryWarning"><h2>No pudimos leer tus datos</h2><p class="note">El archivo anterior sigue intacto. Descárgalo para recuperarlo o importa un respaldo desde Progreso. Los cambios nuevos no se guardarán hasta resolverlo.</p><button class="btn" onclick="downloadUnreadable()">Descargar datos originales</button></div>');
restoreBackupFolder();
if('serviceWorker' in navigator && location.protocol!=='file:')navigator.serviceWorker.register('./sw.js').catch(()=>toast('No se pudo preparar el modo sin conexión'));
// Extend the existing language selector for the new screens.
EN_RULES.unshift(
 ['Registra repeticiones y esfuerzo (1–10) para personalizar la próxima sesión.','Record reps and effort (1–10) to personalize the next session.'],
 ['Completa repeticiones y esfuerzo para comparar con la sesión anterior.','Record reps and effort to compare with the previous session.'],
 ['La última sesión exigió mucho esfuerzo. Revisa recuperación y considera mantener o reducir la carga.','Your last session required high effort. Review recovery and consider maintaining or reducing the load.'],
 ['Completaste las repeticiones con margen. Puedes considerar el siguiente incremento pequeño disponible.','You completed the reps with room to spare. Consider the next small available weight increment.'],
 ['Mantén la carga como referencia y busca completar las repeticiones con técnica controlada.','Use the previous load as a reference and aim to complete the reps with controlled technique.'],
 ['Conserva la sesión actual en el historial antes de cambiar.','Keeps the current session in your history before switching.'],
 ['Aplicar el plan actualizado','Apply updated plan'],['Finalizar y ver resumen','Finish and view summary'],
 ['Comparación semanal','Weekly comparison'],['Semana anterior','Previous week'],['Esta semana:','This week:'],
 ['entrenos y','workouts and'],['Sin entrenamientos registrados','No workouts recorded'],
 ['Esfuerzo (1–10)','Effort (1–10)'],['Esfuerzo','Effort'],['esfuerzo','effort'],['Repeticiones','Reps'],
 ['Unidades de peso','Weight units'],['Libras (lb)','Pounds (lb)'],['Kilogramos (kg)','Kilograms (kg)'],
 ['Cambiar de unidad convierte la visualización y conserva tus registros.','Changing units converts the display and preserves your records.'],
 ['Respaldo automático','Automatic backup'],['Elegir carpeta de respaldo','Choose backup folder'],
 ['Guarda una copia diaria en la carpeta que elijas mientras usas la aplicación. Puedes elegir una carpeta sincronizada con tu nube. Compatible con navegadores que permiten acceso a carpetas; en los demás, usa exportar.','Saves a daily copy in your chosen folder while you use the app. You can choose a cloud-synced folder. Requires a browser with folder access; otherwise use export.'],
 ['Sin carpeta configurada.','No folder configured.'],['Desactivar','Disable'],
 ['Instalar en el teléfono','Install on your phone'],
 ['Abre la aplicación desde una dirección HTTPS. En iPhone: Compartir → Añadir a pantalla de inicio. En Android: menú → Instalar aplicación. Tras la primera carga podrás usarla sin conexión; las fotos se guardan al abrirlas.','Open the app from an HTTPS address. On iPhone: Share → Add to Home Screen. On Android: menu → Install app. After the first load, the app works offline; photos are cached when opened.'],
 ['Para pasar tus registros del navegador a la aplicación instalada, exporta un respaldo y luego impórtalo allí.','To move your records from the browser to the installed app, export a backup and import it there.'],
 ['Incluye ejecución, descansos y cambios de ejercicio. Ajusta según tu ritmo.','Includes exercise time, rests and transitions. Adjust for your pace.'],
 ['Revisión orientativa basada en tu registro, sin puntuación universal.','An indicative review based on your records, without a universal score.'],
 ['Máximo por sesión','Maximum per session'],['La carga se interpreta junto con repeticiones y esfuerzo.','Interpret load together with reps and effort.'],
 ['Completado','Completed'],['Conservado','Saved'],['Sesión conservada','Saved session'],['pendiente','pending'],
 ['Estimación:','Estimate:'],['min disponibles','min available'],['Anterior:','Previous:']
);
