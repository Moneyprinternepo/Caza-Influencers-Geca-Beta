/* =====================================================================
   PLAN DE CARTELERA · funcionalidad de la pestaña "Cartelera"
   ---------------------------------------------------------------------
   Requiere en index.html (ya incluido):
     · el botón  <button class="tab" data-tab="cartelera">Cartelera</button>
     · la vista  <div id="plan-view" class="hidden"> … #pc-tree / #pc-main …
     · el bloque CSS "PLAN DE CARTELERA" dentro de <style>
     · la fuente Caveat en el <link> de Google Fonts
     · <script src="plan-cartelera.js"></script> después de script.js

   script.js la abre con  PlanCartelera.open()  y le pasa el CSV opcional
   data/cartelera.csv con  PlanCartelera.setData(filas).

   Expone:  window.PlanCartelera = { open, setData, reload, repoCount }
   ===================================================================== */
(function(){
'use strict';

/* ------------------------------------------------- 1. motor de planificación */

const DIAS=['lun','mar','mié','jue','vie','sáb','dom'];
const MES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const MESC=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function parseISO(s){const p=String(s).split('-').map(Number);return new Date(p[0],p[1]-1,p[2]);}
function iso(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function addD(d,n){return new Date(d.getFullYear(),d.getMonth(),d.getDate()+n);}
function monday(d){return addD(d,-((d.getDay()+6)%7));}
function same(a,b){return iso(a)===iso(b);}
function diff(a,b){return Math.round((parseISO(iso(b))-parseISO(iso(a)))/86400000);}
function fmt(d){return d.getDate()+' '+MESC[d.getMonth()];}
function fmtL(d){return DIAS[(d.getDay()+6)%7]+' '+d.getDate()+' '+MESC[d.getMonth()];}
function esc(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));}

const DUR2={1:4,2:4,3:5,4:6,5:7};
const DUR3={3:5,4:6,5:7};
const P={
  EVENTO:{n:'Evento con venta anticipada',base:100,nl:2,opc:false,vent:'evento',tipos:[0,1],larga:false},
  TENTPOLE:{n:'Tentpole premium',base:90,nl:2,opc:false,vent:'estreno',tipos:[1,2],larga:true},
  PREM_ALTO:{n:'Gran estreno premium',base:78,nl:2,opc:'refuerzo',vent:'estreno',tipos:[2],larga:true},
  PREM_MEDIO:{n:'Con potencial y premium',base:66,nl:1,opc:false,vent:'estreno',tipos:[2],larga:false},
  PREM_BAJO:{n:'Premium menor',base:50,nl:1,opc:'principal',vent:'estreno',tipos:[2],larga:false},
  FUERTE:{n:'Gran estreno',base:72,nl:1,opc:false,vent:'estreno',tipos:[2],larga:true},
  MEDIO:{n:'Estreno relevante',base:58,nl:1,opc:false,vent:'estreno',tipos:[2],larga:false},
  LIGERO:{n:'Estreno de paso',base:42,nl:1,opc:'principal',vent:'estreno',tipos:[2],larga:false},
  CATALOGO:{n:'Catálogo',base:20,nl:1,opc:'principal',vent:'estreno',tipos:[],larga:false}
};
function clasifica(f){
  const i=Number(f.imp);
  if(f.evento) return 'EVENTO';
  if(f.premium) return i>=5?'TENTPOLE':i===4?'PREM_ALTO':i===3?'PREM_MEDIO':'PREM_BAJO';
  return i>=5?'FUERTE':i===4?'MEDIO':i===3?'LIGERO':'CATALOGO';
}
const TIER={2:0,1:1,0:2,3:3};   // primero lo que no se puede mover, al final lo flexible

function planifica(films){
  const items=films.filter(f=>f.titulo&&f.fecha).map(f=>{
    const k=clasifica(f);
    return {...f,perfil:k,P:P[k],D:parseISO(f.fecha),score:P[k].base+Number(f.imp)*2,
            nl:[],sinNL:[],mencion:null,camp:[]};
  });
  if(!items.length) return {items:[],slots:[],camp:[],avisos:[],weeks:[]};

  /* ---- newsletters: martes y viernes, 2 por semana ---- */
  let a=items[0].D,b=items[0].D;
  items.forEach(i=>{if(i.D<a)a=i.D;if(i.D>b)b=i.D;});
  const slots=[];
  for(let m=monday(addD(a,-35));m<=monday(addD(b,35));m=addD(m,7)){
    slots.push({d:addD(m,1),wk:iso(m),tipo:null});
    slots.push({d:addD(m,4),wk:iso(m),tipo:null});
  }
  const at=d=>slots.find(s=>same(s.d,d));
  function cand(it,rol){
    const M=monday(it.D),out=[],add=d=>{const s=at(d);if(s)out.push(s);};
    if(it.P.vent==='evento'){
      if(rol==='principal')[-13,-10,-6,-20].forEach(o=>add(addD(M,o)));
      else [-20,-17,-10,-27].forEach(o=>add(addD(M,o)));
    }else if(rol==='principal'){
      [1,4,-3,-6,-10,-13].forEach(o=>{const d=addD(M,o);if(diff(d,it.D)>=0)add(d);});
    }else{
      [-6,-3,-13,-10].forEach(o=>add(addD(M,o)));
    }
    return out;
  }
  const orden=items.slice().sort((x,y)=>y.score-x.score||x.D-y.D);
  [['principal',0],['refuerzo',0],['principal',1],['refuerzo',1]].forEach(([rol,opc])=>{
    orden.forEach(it=>{
      if(rol==='refuerzo'&&it.P.nl<2) return;
      const esOpc=it.P.opc===true||it.P.opc===rol;
      if((esOpc?1:0)!==opc) return;
      if(opc&&it.P.base<=20) return;           // el catálogo va siempre en la genérica
      const c=cand(it,rol).filter(s=>!s.tipo);
      if(!c.length){it.sinNL.push(rol);return;}
      c[0].tipo='dedicada';c[0].film=it;c[0].rol=rol;it.nl.push(c[0]);
    });
  });
  const vivas=new Set();
  items.forEach(it=>{for(let m=monday(addD(it.D,-21));m<=monday(addD(it.D,21));m=addD(m,7))vivas.add(iso(m));});
  slots.forEach(s=>{
    if(s.tipo||!vivas.has(s.wk)) return;
    if(slots.some(x=>x.wk===s.wk&&x.tipo==='generica')) return;
    s.tipo='generica';
  });
  items.forEach(it=>{
    if(it.nl.length) return;
    const g=slots.filter(s=>s.tipo==='generica'&&diff(s.d,it.D)>=0).sort((x,y)=>y.d-x.d)[0];
    if(g){it.mencion=g;(g.men=g.men||[]).push(it);}
  });

  /* ---- campañas: una sola viva en todo momento ---- */
  const occ={};                                     // día ISO -> película dueña
  const reserva=(i,f,who)=>{for(let d=i;d<=f;d=addD(d,1))occ[iso(d)]=who;};
  const hueco=(i,f,who)=>{                          // libre, o ya de la misma película
    for(let d=i;d<=f;d=addD(d,1)){const o=occ[iso(d)];if(o&&o!==who)return false;}return true;};

  const deseos=[];
  items.forEach(it=>{
    const t=it.P.tipos.slice();
    const larga = it.larga==='si' ? true : it.larga==='no' ? false : (it.P.larga||Number(it.imp)>=5);
    if(larga&&t.includes(2)) t.push(3);
    t.forEach(tipo=>{
      // en los títulos de más peso, víspera y anticipación pesan como la campaña de estreno
      const sube=it.score>=78&&(tipo===0||tipo===1)?1:0;
      deseos.push({it,tipo,tier:TIER[tipo]-sube});
    });
  });
  deseos.sort((x,y)=>x.tier-y.tier||y.it.score-x.it.score||x.it.D-y.it.D);

  function ventana(it,tipo){
    const D=it.D,imp=Number(it.imp),out=[];
    if(tipo===0){ for(let off=-24;off<=-10;off++) for(let dur=7;dur>=3;dur--){
      const i=addD(D,off);if(diff(i,addD(D,-8))>=dur-1) out.push([i,dur]);}}
    if(tipo===1){ [[-3,3],[-2,2],[-3,2],[-4,2]].forEach(([o,dur])=>{
      const i=addD(D,o);if(diff(addD(i,dur-1),addD(D,-1))>=0) out.push([i,dur]);});}
    if(tipo===2){ const ideal=DUR2[imp]||4;
      for(let off=0;off<=12;off++) for(let dur=ideal;dur>=3;dur--) out.push([addD(D,off),dur]);}
    if(tipo===3){ const ideal=DUR3[imp]||5;   // entre uno y dos meses después del estreno
      for(let off=30;off<=60;off++) for(let dur=ideal;dur>=4;dur--) out.push([addD(D,off),dur]);}
    return out;
  }

  const camp=[],fuera=[];
  deseos.forEach(w=>{
    const opciones=ventana(w.it,w.tipo);
    let puesto=null;
    for(const [ini,dur] of opciones){
      const fin=addD(ini,dur-1), pre=addD(ini,-1);   // el día previo es de TikTok
      if(!hueco(pre,fin,w.it)) continue;
      puesto={ini,fin,dur,pre};break;
    }
    if(!puesto){fuera.push(w);return;}
    reserva(puesto.pre,puesto.fin,w.it);
    const primera=!camp.some(c=>c.film===w.it);
    camp.push({film:w.it,tipo:w.tipo,mIni:puesto.ini,mFin:puesto.fin,dur:puesto.dur,
      tkIni:puesto.pre,tkFin:puesto.fin,test:true,ideal:opciones[0][1],
      retraso: w.tipo===2?diff(w.it.D,puesto.ini):0});
  });
  camp.sort((x,y)=>x.tkIni-y.tkIni);
  camp.forEach((c,i)=>{
    c.test = !camp.slice(0,i).some(p=>p.film===c.film);
    if(!c.test) c.tkIni=c.mIni;          // ya hay vídeo ganador: los dos canales arrancan juntos
  });
  items.forEach(it=>it.camp=camp.filter(c=>c.film===it));

  /* ---- avisos ---- */
  const avisos=[];
  fuera.forEach(w=>{
    const t=w.tipo;
    const txt = t===2
      ? '<b>'+esc(w.it.titulo)+'</b> se queda sin campaña de estreno: los días siguientes al '+fmt(w.it.D)+' están ocupados por títulos de más peso. Súbele la importancia o recorta la campaña que la bloquea.'
      : '<b>'+esc(w.it.titulo)+'</b> se queda sin la campaña tipo '+t+' de '+(t===0?'anticipación':t===1?'víspera':'alargamiento')+
        ': no queda ningún hueco libre en su ventana ('+(t===0?'de tres a dos semanas antes':t===1?'los días previos al estreno':'entre uno y dos meses después')+'). '+(w.it.camp.length?'Mantiene el resto de su plan.':'Se queda solo con la newsletter.');
    avisos.push({t:'w',txt});
  });
  camp.filter(c=>c.tipo===2&&c.dur<c.ideal).forEach(c=>{
    avisos.push({t:'w',txt:'<b>'+esc(c.film.titulo)+'</b> se queda con '+c.dur+' días de campaña en vez de '+c.ideal+
      ': los días siguientes ya estaban ocupados por otra película.'});
  });
  camp.filter(c=>c.retraso>0).forEach(c=>{
    avisos.push({t:'w',txt:'<b>'+esc(c.film.titulo)+'</b> arranca anuncios el '+fmtL(c.mIni)+', '+c.retraso+
      ' días después del estreno, porque antes había otra campaña en el aire.'});
  });
  items.forEach(it=>{
    it.sinNL.forEach(rol=>{
      avisos.push({t:'w',txt:'<b>'+esc(it.titulo)+'</b> se queda sin newsletter '+rol+': las dos semanas previas al '+
        fmt(it.D)+' ya tienen sus dos envíos.'});
    });
  });
  if(!avisos.length) avisos.push({t:'o',txt:'Todo encaja: cada título tiene su envío y ninguna campaña pisa a otra.'});

  /* ---- semanas ---- */
  let d1=items[0].D,d2=items[0].D;
  const mk=d=>{if(d<d1)d1=d;if(d>d2)d2=d;};
  items.forEach(i=>mk(i.D));
  camp.forEach(c=>{mk(c.tkIni);mk(c.mFin);});
  slots.filter(s=>s.tipo).forEach(s=>mk(s.d));
  const weeks=[];
  for(let m=monday(d1);m<=monday(d2);m=addD(m,7))weeks.push(m);
  return {items,slots:slots.filter(s=>s.tipo),camp,avisos,weeks};
}

/* ------------------------------------------------- 2. garabato del árbol */

const RECETA={
  EVENTO:['2 newsletters antes','T0 de anticipación','T1 de víspera'],
  TENTPOLE:['2 newsletters dedicadas','T1 víspera + T2 estreno'],
  PREM_ALTO:['dedicada (+1 si hay hueco)','T2 en el estreno'],
  PREM_MEDIO:['1 newsletter dedicada','T2 en el estreno'],
  PREM_BAJO:['dedicada si hay hueco','T2 corto'],
  FUERTE:['1 newsletter dedicada','T2 en el estreno'],
  MEDIO:['1 newsletter dedicada','T2 en el estreno'],
  LIGERO:['dedicada si hay hueco','T2 corto'],
  CATALOGO:['bloque en la genérica','sin inversión en anuncios']
};
function haceT3(k,d){
  if(!P[k].tipos.includes(2)) return false;
  if(d.larga==='si') return true;
  if(d.larga==='no') return false;
  return P[k].larga||Number(d.imp)>=5;
}
function rnd(seed){let s=seed*7919%233280;return()=>{s=(s*9301+49297)%233280;return s/233280;};}
function smooth(p){
  let d='M'+p[0][0].toFixed(1)+','+p[0][1].toFixed(1);
  for(let i=1;i<p.length-1;i++){
    const mx=(p[i][0]+p[i+1][0])/2,my=(p[i][1]+p[i+1][1])/2;
    d+=' Q'+p[i][0].toFixed(1)+','+p[i][1].toFixed(1)+' '+mx.toFixed(1)+','+my.toFixed(1);
  }
  const l=p[p.length-1];
  return d+' L'+l[0].toFixed(1)+','+l[1].toFixed(1);
}
function wline(x1,y1,x2,y2,seed,n){
  const r=rnd(seed),p=[],N=n||4;
  for(let i=0;i<=N;i++){
    const t=i/N,j=(i===0||i===N)?0.9:2.4;
    p.push([x1+(x2-x1)*t+(r()-.5)*j, y1+(y2-y1)*t+(r()-.5)*j]);
  }
  return smooth(p);
}
function wloop(cx,cy,rx,ry,seed){
  const r=rnd(seed),p=[],start=-0.5;
  for(let a=0;a<=Math.PI*2.12;a+=Math.PI/11){
    const k=1+(r()-.5)*.10;
    p.push([cx+Math.cos(a+start)*rx*k, cy+Math.sin(a+start)*ry*k*1.02]);
  }
  return smooth(p);
}
function wbox(x,y,w,h,seed){
  const r=rnd(seed),j=()=>(r()-.5)*2.6;
  return smooth([[x+j(),y+j()],[x+w*.5+j(),y-1+j()],[x+w+j(),y+j()],[x+w+1+j(),y+h*.5+j()],
    [x+w+j(),y+h+j()],[x+w*.5+j(),y+h+1+j()],[x+j(),y+h+j()],[x-1+j(),y+h*.5+j()],[x+j(),y+j()]]);
}
let drawn=new Set(),seq=0,ctx={set:null,pfx:''};
function pieza(id,tipo,attrs,inner){
  id=ctx.pfx+id;
  const set=ctx.set||drawn, nuevo=!set.has(id);
  if(nuevo) set.add(id);
  const cls=(attrs.class||'')+(nuevo?(tipo==='path'?' pc-dr':' pc-fi'):'');
  const del=nuevo?' style="animation-delay:'+(seq++*45)+'ms"':'';
  let a='';for(const k in attrs){if(k!=='class')a+=' '+k+'="'+attrs[k]+'"';}
  return '<'+tipo+' class="'+cls+'"'+(tipo==='path'?' pathLength="1"':'')+a+del+'>'+(inner||'')+'</'+tipo+'>';
}
const HOJAS={EVENTO:'evento especial',TENTPOLE:'tentpole premium',PREM_ALTO:'gran estreno premium',
  PREM_MEDIO:'potencial + premium',PREM_BAJO:'premium menor',FUERTE:'gran estreno',
  MEDIO:'estreno relevante',LIGERO:'estreno de paso',CATALOGO:'catálogo'};

/* dibuja el esquema completo; la rama de la película va en rojo */
function arbolSVG(d,opts){
  opts=opts||{};
  ctx={set:opts.set||drawn,pfx:opts.pfx||''};
  if(opts.fresh) seq=0;
  d=d||{};
  const ev=d.evento, pr=d.premium, im=d.imp?Number(d.imp):null;
  const kAct=(ev===true)?'EVENTO':(ev===false&&pr!==null&&pr!==undefined&&im)?clasifica({evento:false,premium:pr,imp:im}):null;
  let o='';
  const X=28;
  const P_=(id,dd,cls)=>o+=pieza(id,'path',{d:dd,class:'pc-sk '+(cls||'')});
  const L=(id,x1,y1,x2,y2,cls)=>P_(id,wline(x1,y1,x2,y2,(x1+y1+id.length*7)|0),cls);
  const T=(id,x,y,t,cls,size)=>o+=pieza(id,'text',{x:x,y:y,class:'pc-tx '+(cls||''),style:size?'font-size:'+size+'px':''},esc(t));
  // estado de cada nodo: on / off / idle
  const st=(cond,known)=>!known?'idle':(cond?'on':'off');
  const anc=(t,size)=>t.length*(size||14)*0.385;          // ancho aproximado en Caveat
  const clsOf=e=>e==='on'?'':e==='off'?'f':'i';

  T('t-h',16,28,'tu película','big');
  L('t-u',14,36,124,38,'r');

  const evKnown=ev===true||ev===false;
  const e1=st(ev===true,evKnown), e2=st(ev===false,evKnown);
  const prKnown=ev===false&&(pr===true||pr===false);
  const p1=ev===true?'off':st(pr===true,prKnown), p2=ev===true?'off':st(pr===false,prKnown);
  const imKnown=!!im;

  // rama 1
  L('t-tk1',X,60,38,60,'');
  T('q1',44,64,'¿evento con venta anticipada?','q',15);
  L('t-tk2',X,82,50,82,clsOf(e1));
  T('a1',56,86,'sí → '+HOJAS.EVENTO,clsOf(e1)+(e1==='on'?' r':''));
  if(e1==='off') L('t-s1',52,81,60+anc('sí → '+HOJAS.EVENTO),82,'f');
  L('t-tk3',X,104,50,104,clsOf(e2));
  T('a2',56,108,'no ↓',clsOf(e2));

  // rama 2
  L('t-tk4',X,134,38,134,clsOf(e2));
  T('q2',44,138,'¿formatos premium?','q',15);
  L('t-tk5',X,156,50,156,clsOf(p1));
  T('a3',56,160,'sí ↓',clsOf(p1));
  if(p1==='off'&&ev===false) L('t-s2',52,155,52+anc('sí ↓')+10,156,'f');
  const grupo=(pfx,yq,on,pesos)=>{
    L(pfx+'-tk',44,yq-4,62,yq-4,clsOf(on));
    T(pfx+'-q',68,yq,'¿cuánto pesa?','q '+clsOf(on),14);
    L(pfx+'-v',66,yq+6,66,yq+8+pesos.length*22,clsOf(on));
    pesos.forEach((p,i)=>{
      const y=yq+22+i*22;
      const act=on==='on'&&imKnown&&p[0].split('-').map(Number).includes(im);
      const e=on!=='on'?on:(imKnown?(act?'on':'off'):'idle');
      L(pfx+'-t'+i,66,y-4,78,y-4,clsOf(e));
      const et=p[0]+' → '+HOJAS[p[1]], w=anc(et);
      T(pfx+'-l'+i,82,y,et,clsOf(e)+(act?' r':''));
      if(act){
        const rx=Math.min(w/2+9,(300-82)/2), cx=Math.min(82+w/2,300-rx);
        P_(pfx+'-c'+i,wloop(cx,y-5,rx,13,60+i*7),'r');
      }
    });
    return yq+22+pesos.length*22;
  };
  let y=grupo('g1',182,p1,[['5','TENTPOLE'],['4','PREM_ALTO'],['3','PREM_MEDIO'],['1-2','PREM_BAJO']]);
  L('t-tk6',X,y+8,50,y+8,clsOf(p2));
  T('a4',56,y+12,'no ↓',clsOf(p2));
  if(p2==='off'&&ev===false) L('t-s3',52,y+7,52+anc('no ↓')+10,y+8,'f');
  y=grupo('g2',y+38,p2,[['5','FUERTE'],['4','MEDIO'],['3','LIGERO'],['1-2','CATALOGO']]);
  L('t-trunk',X,42,X,y-14,'');

  // pregunta del T3
  const t3on=kAct&&P[kAct].tipos.includes(2);
  const lg=d.larga;
  y+=26;
  L('t-tk7',X,y-4,38,y-4,t3on?'':'i');
  T('q3',44,y,'¿alargar vida con un T3?','q '+(t3on?'':'i'),15);
  ['si','no','auto'].forEach((v,i)=>{
    const act=t3on&&lg===v;
    T('q3-'+v,52+i*52,y+22,v==='si'?'sí':v,act?'r':(t3on?'f':'i'),14);
    if(act) P_('q3c-'+v,wloop(60+i*52,y+17,20,13,71+i*5),'r');
  });
  y+=44;

  // receta de la hoja activa
  if(kAct){
    const lines=(RECETA[kAct]||[]).slice();
    if(haceT3(kAct,d)) lines.push('T3 para alargar vida');
    y+=14;
    P_('leaf-'+kAct,wbox(16,y-4,272,30+lines.length*20,41),'r');
    T('leafn-'+kAct,30,y+20,P[kAct].n.toLowerCase(),'',17);
    lines.forEach((l,i)=>{
      T('leafl-'+kAct+i,44,y+42+i*20,l,'s',14);
      L('leafd-'+kAct+i,30,y+37+i*20,38,y+37+i*20,'r');
    });
    y+=36+lines.length*20;
  }else{
    T('t-hint',20,y+8,'responde y marco tu rama en rojo','s',14);
    y+=20;
  }
  ctx={set:null,pfx:''};
  return {svg:o,h:Math.round(y+24)};
}
function pintaArbol(){
  const el=document.getElementById('pc-tree');
  if(!el) return;
  const r=arbolSVG(draft);
  el.setAttribute('viewBox','0 0 310 '+r.h);
  el.innerHTML=r.svg;
}
function verEsquema(){
  const r=arbolSVG(draft,{set:new Set(),pfx:'big-',fresh:true});
  sheet('Árbol de decisiones',
    '<p class="lead">El esquema completo. En rojo, la rama de la película que estás metiendo.</p>'+
    '<svg viewBox="0 0 310 '+r.h+'" class="pc-big" preserveAspectRatio="xMidYMin meet">'+r.svg+'</svg>');
}

/* ------------------------------------------------------- 3. estado y montaje */
const COLORES=['#e6333f','#5b8def','#3fb950','#a97bff','#e3a03c','#2ec7c9','#ff77aa','#9aa3b2'];
const LS='caza-cartelera';
let films=[],draft=null,step=0,vista='intro',tab='cal',PLAN=null,cargado=false;

const $=s=>document.querySelector(s);
const el=(id)=>document.getElementById(id);
function nuevo(){return {titulo:'',fecha:'',evento:null,premium:null,imp:null,larga:'auto'};}
function guarda(){try{localStorage.setItem(LS,JSON.stringify(films));}catch(e){}}
function recupera(){
  try{const v=JSON.parse(localStorage.getItem(LS)||'[]');if(Array.isArray(v)&&v.length)return v;}catch(e){}
  return null;
}
function hacerPlan(){
  PLAN=planifica(films);
  PLAN.items.forEach((it,i)=>it.color=COLORES[i%COLORES.length]);
  guarda();
  return PLAN;
}

/* ---- cartelera desde data/cartelera.csv ---- */
let repoFilms=[];
function deFilas(data){
  const si=v=>/^(1|s[ií]|si|true|x|y|yes)$/i.test(String(v||'').trim());
  return (data||[]).filter(r=>r&&(r.titulo||r.Titulo)&&(r.fecha||r.Fecha)).map(r=>{
    const t3=String(r.t3||r.T3||'auto').trim().toLowerCase();
    const ev=si(r.evento||r.Evento);
    return {titulo:String(r.titulo||r.Titulo).trim(),fecha:String(r.fecha||r.Fecha).trim(),
      evento:ev,premium:ev?false:si(r.premium||r.Premium),
      imp:ev?4:Math.max(1,Math.min(5,parseInt(r.peso||r.Peso||3,10)||3)),
      larga:ev?'no':(['si','sí','1','true'].indexOf(t3)>=0?'si':['no','0','false'].indexOf(t3)>=0?'no':'auto')};
  });
}
function releeCSV(){
  return new Promise(res=>{
    if(typeof Papa==='undefined') return res([]);
    Papa.parse('data/cartelera.csv?t='+Date.now(),{download:true,header:true,skipEmptyLines:true,
      complete:({data})=>res(deFilas(data)),error:()=>res([])});
  });
}

/* ---- panel modal ---- */
function sheet(titulo,html){
  let sh=el('pc-sheet');
  if(!sh){
    sh=document.createElement('div');
    sh.id='pc-sheet';sh.className='pc-sheet';sh.setAttribute('role','dialog');sh.setAttribute('aria-modal','true');
    sh.innerHTML='<div class="in"><button class="cl" id="pc-sheet-cl" aria-label="Cerrar">✕</button>'+
      '<h3 id="pc-sheet-t"></h3><div id="pc-sheet-b"></div></div>';
    document.body.appendChild(sh);
    sh.addEventListener('click',e=>{if(e.target===sh)cierra();});
    el('pc-sheet-cl').onclick=cierra;
    document.addEventListener('keydown',e=>{if(e.key==='Escape')cierra();});
  }
  el('pc-sheet-t').textContent=titulo;
  el('pc-sheet-b').innerHTML=html;
  sh.classList.remove('hidden');
  el('pc-sheet-cl').focus();
}
function cierra(){const sh=el('pc-sheet');if(sh)sh.classList.add('hidden');}

/* ---- glosario ---- */
const GLOSARIO=[
 ['Campañas de anuncios',[
  ['Anuncio tipo 0','T0','Campaña de anticipación: 7 días, entre tres y dos semanas antes del estreno.',
   'Solo para eventos con venta anticipada. Vende entradas cuando la película todavía no está en cartel.'],
  ['Anuncio tipo 1','T1','Campaña de víspera: los tres días anteriores al estreno.',
   'Solo para títulos de peso, casi siempre con formatos premium. Crea expectativa y llena el primer fin de semana.'],
  ['Anuncio tipo 2','T2','Campaña de estreno: arranca el mismo día del estreno y dura de 4 a 7 días según el peso.',
   'La más habitual y la que no debería faltarle a ningún estreno con inversión. Trae público mientras la película está caliente.'],
  ['Anuncio tipo 3','T3','Alargamiento de vida: de 4 a 7 días, entre uno y dos meses después del estreno.',
   'Solo si la película aguanta en cartel. Recupera ventas cuando la primera ola ya ha pasado. Es la última pregunta del cuestionario.']
 ]],
 ['Canales',[
  ['Anuncios de TikTok','TikTok','Siempre el primer canal. Subes varios vídeos y la plataforma reparte presupuesto entre ellos.',
   'Arranca un día antes que Meta en la primera campaña de cada película: ese día sirve para ver qué material funciona.'],
  ['Anuncios de Meta','Meta','Entra un día después, ya con el vídeo ganador de TikTok, y los dos canales siguen en paralelo.',
   'En las campañas siguientes de la misma película ya no hay test: TikTok y Meta arrancan el mismo día.'],
  ['Una campaña a la vez','regla fija','Nunca hay dos películas anunciándose al mismo tiempo, ni en TikTok ni en Meta.',
   'Cuando dos se pisan, la de menos peso se acorta, se retrasa o se cae. Siempre lo explica el aviso.']
 ]],
 ['Newsletters',[
  ['Newsletter dedicada','envío','Un correo entero para una sola película.',
   'Máximo dos envíos por semana, y solo martes y viernes. El martes rinde mejor, así que se reserva para lo más importante.'],
  ['Newsletter genérica','envío','El correo de cartelera de la semana, con varias películas.',
   'Ahí van los títulos que no dan para dedicada, como bloque destacado. En el calendario solo aparece cuando lleva uno de esos bloques.'],
  ['Envío de refuerzo','2ª dedicada','La segunda dedicada de una misma película, en otra semana.',
   'Solo para eventos y para los títulos más fuertes. Se manda antes de la dedicada principal.']
 ]],
 ['Cómo clasificamos',[
  ['Formatos premium','4DX · ScreenX','Salas de formato especial, de donde sale buena parte de la facturación.',
   'Contestar "sí" mueve la película a la rama alta del árbol: más newsletters y más campañas.'],
  ['Peso','1 a 5','Cuánto esperas de la película, del relleno de cartelera al título del trimestre.',
   'Decide cuántas newsletters lleva, cuántos días dura el tipo 2 y quién gana cuando dos títulos se pisan.'],
  ['Evento con venta anticipada','evento','Preestrenos, ópera, maratones, reestrenos especiales: se venden entradas mucho antes.',
   'Es la primera pregunta porque cambia todo el plan: dos newsletters con antelación, tipo 0 y tipo 1.']
 ]]
];
function verGlosario(){
  sheet('Glosario','<p class="lead">Los nombres que usa el plan y cuándo se usa cada cosa.</p>'+
    GLOSARIO.map(([sec,items])=>'<p class="pc-gsec">'+sec+'</p>'+items.map(([t,tg,df,wh])=>
      '<div class="pc-g"><div class="tm">'+t+'<br><span class="tg">'+tg+'</span></div>'+
      '<div class="df">'+df+'<span class="wh">'+wh+'</span></div></div>').join('')).join(''));
}

/* ---- preguntas ---- */
const S={
  titulo:{k:'titulo',q:'¿Qué película?',t:'text',ph:'Título'},
  fecha:{k:'fecha',q:'¿Cuándo estrena?',t:'date',sub:'Primer día en cartel.'},
  evento:{k:'evento',q:'¿Es un evento con venta anticipada?',t:'choice',opts:[
    {v:false,l:'No',s:'Estreno normal de cartelera'},
    {v:true,l:'Sí',s:'Preestreno, ópera, maratón, reestreno especial'}]},
  premium:{k:'premium',q:'¿Tendrá formatos premium?',t:'choice',opts:[
    {v:true,l:'Sí',s:'4DX, ScreenX, sala premium'},
    {v:false,l:'No',s:'Solo sala estándar'}]},
  imp:{k:'imp',q:'¿Cuánto peso tiene?',t:'choice',sub:'De relleno de cartelera a título del trimestre.',opts:[
    {v:5,l:'5',s:'Tentpole del trimestre'},{v:4,l:'4',s:'Estreno fuerte'},
    {v:3,l:'3',s:'Con potencial'},{v:2,l:'2',s:'Discreta'},{v:1,l:'1',s:'Relleno de cartelera'}]},
  larga:{k:'larga',q:'¿Querrás hacer un anuncio de tipo 3 para alargar la vida útil?',t:'choice',
    sub:'Sale entre uno y dos meses después del estreno, cuando la primera ola ya ha pasado.',opts:[
    {v:'si',l:'Sí',s:'La película aguantará semanas en cartel'},
    {v:'no',l:'No',s:'Se agota en su primer fin de semana'},
    {v:'auto',l:'Decide tú',s:'Solo si es un título de peso 4 o 5'}]}
};
function steps(d){
  const s=[S.titulo,S.fecha,S.evento];
  if(d&&d.evento===false){s.push(S.premium,S.imp);if(Number(d.imp)>=3)s.push(S.larga);}
  return s;
}

/* ---- render ---- */
function pinta(){
  const main=el('pc-main');
  if(!main) return;
  if(vista==='intro')vIntro(main);
  else if(vista==='ask')vAsk(main);
  else if(vista==='more')vMore(main);
  else if(vista==='list')vList(main);
  else if(vista==='plan')vPlan(main);
  const aside=el('pc-aside');
  if(aside) aside.style.display=(vista==='plan')?'none':'';
  const sh=el('pc-shell');
  if(sh) sh.style.gridTemplateColumns=(vista==='plan')?'1fr':'';
  pintaArbol();
}
function ir(v){vista=v;pinta();}
function prog(p){const b=el('pc-prog');if(b)b.style.width=(p*100)+'%';}

function cab(extra){
  return '<div class="section-head" style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:22px">'+
    '<div><div class="section-title">Plan de cartelera</div>'+
    '<div class="section-sub">Newsletters y campañas de TikTok y Meta, sin solapes</div></div>'+
    '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
    (extra||'')+
    '<button class="btn" id="pc-tree-btn">Esquema</button>'+
    '<button class="btn" id="pc-gloss-btn">Glosario</button></div></div>';
}
function bindCab(){
  if(el('pc-tree-btn'))el('pc-tree-btn').onclick=verEsquema;
  if(el('pc-gloss-btn'))el('pc-gloss-btn').onclick=verGlosario;
}

function vIntro(m){
  drawn=new Set();
  m.innerHTML=cab()+'<div class="pc-card">'+
    '<h2 class="pc-q">Organiza la cartelera en seis preguntas por película.</h2>'+
    '<p class="pc-sub">Tres si es un evento. El árbol de la izquierda se dibuja con cada respuesta y al final coloco '+
    'newsletters y campañas en el calendario, sin que dos campañas coincidan nunca.</p>'+
    '<div class="pc-row"><button class="btn btn-primary" id="pc-start">Empezar</button>'+
    (films.length?'<button class="btn" id="pc-see">Ver el plan de '+films.length+' '+(films.length===1?'película':'películas')+'</button>':'')+
    '</div><button class="pc-link" id="pc-demo">Probar con un ejemplo</button></div>';
  bindCab();
  el('pc-start').onclick=()=>{draft=nuevo();step=0;ir('ask');};
  if(el('pc-see'))el('pc-see').onclick=()=>{hacerPlan();ir('plan');};
  el('pc-demo').onclick=()=>{
    const v=n=>{const d=new Date();const o=(5-((d.getDay()+6)%7+1)+7)%7;return iso(addD(d,o+7*n));};
    films=[{titulo:'Comedia española',fecha:v(1),evento:false,premium:false,imp:2,larga:'auto'},
           {titulo:'Thriller en 4DX',fecha:v(2),evento:false,premium:true,imp:3,larga:'si'},
           {titulo:'Gran estreno de acción',fecha:v(3),evento:false,premium:true,imp:5,larga:'auto'},
           {titulo:'Preestreno con invitados',fecha:v(5),evento:true,premium:false,imp:4,larga:'no'}];
    hacerPlan();ir('plan');
  };
}

function vAsk(m){
  const st=steps(draft),s=st[step];
  let body='';
  if(s.t==='text'||s.t==='date'){
    body='<input class="pc-in" type="'+s.t+'" id="pc-f" value="'+(s.k==='titulo'?esc(draft.titulo):draft.fecha)+'" '+
      (s.ph?'placeholder="'+s.ph+'"':'')+'>'+
      '<div class="pc-row"><button class="btn btn-primary" id="pc-next">Continuar</button>'+
      '<button class="btn" id="pc-prev">Atrás</button></div>';
  }else{
    body='<div class="pc-opts">'+s.opts.map((op,i)=>'<button class="pc-opt'+(String(draft[s.k])===String(op.v)?' on':'')+
      '" data-v="'+i+'"><span class="k">'+op.l+'</span><span class="s">'+op.s+'</span></button>').join('')+'</div>'+
      '<div class="pc-row"><button class="btn" id="pc-prev">Atrás</button></div>';
  }
  m.innerHTML=cab()+'<div class="pc-card"><div class="pc-bar"><i id="pc-prog"></i></div>'+
    '<p class="pc-step">Película '+(films.length+1)+' · pregunta '+(step+1)+' de '+st.length+'</p>'+
    '<h2 class="pc-q">'+s.q+'</h2>'+(s.sub?'<p class="pc-sub">'+s.sub+'</p>':'<div style="height:12px"></div>')+
    body+'</div>';
  bindCab();
  prog(step/st.length);
  el('pc-prev').onclick=()=>{
    if(step>0){step--;pinta();}
    else{draft=null;ir(films.length?'more':'intro');}
  };
  if(s.t==='text'||s.t==='date'){
    const inp=el('pc-f'),btn=el('pc-next');
    const ok=()=>s.k==='titulo'?inp.value.trim().length>0:!!inp.value;
    const sync=()=>btn.disabled=!ok();
    inp.oninput=sync;sync();inp.focus();
    inp.onkeydown=e=>{if(e.key==='Enter'&&ok())btn.click();};
    btn.onclick=()=>{draft[s.k]=inp.value.trim();avanza();};
  }else{
    m.querySelectorAll('.pc-opt').forEach(b=>b.onclick=()=>{
      draft[s.k]=s.opts[Number(b.dataset.v)].v;
      m.querySelectorAll('.pc-opt').forEach(x=>x.classList.remove('on'));
      b.classList.add('on');
      pintaArbol();
      setTimeout(avanza,320);
    });
  }
}
function avanza(){
  const st=steps(draft);
  if(step+1>=st.length){
    const f={...draft};
    if(f.evento){f.premium=false;f.imp=4;f.larga='no';}
    films.push(f);draft=null;guarda();ir('more');
  }else{step++;pinta();}
}

function filas(){
  return '<div class="pc-list">'+films.map((f,i)=>'<div class="r">'+
    '<i class="sw" style="background:'+COLORES[i%COLORES.length]+'"></i><span>'+esc(f.titulo)+'</span>'+
    (f.evento?'<span class="pc-tag">evento</span>':'')+(f.premium?'<span class="pc-tag">premium</span>':'')+
    '<span class="d">'+fmt(parseISO(f.fecha))+(f.evento?'':' · peso '+f.imp)+'</span>'+
    '<button class="x" data-i="'+i+'" aria-label="Quitar">✕</button></div>').join('')+'</div>';
}
function bindFilas(m,re){
  el('pc-otra').onclick=()=>{draft=nuevo();step=0;ir('ask');};
  el('pc-ver').onclick=()=>{if(films.length){hacerPlan();ir('plan');}};
  m.querySelectorAll('.pc-list .x').forEach(b=>b.onclick=()=>{
    films.splice(Number(b.dataset.i),1);guarda();
    if(!films.length&&re==='more')ir('intro');else pinta();
  });
}
function vMore(m){
  m.innerHTML=cab()+'<div class="pc-card">'+
    '<p class="pc-step">'+films.length+' '+(films.length===1?'película':'películas')+' en la lista</p>'+
    '<h2 class="pc-q">'+esc(films[films.length-1].titulo)+' guardada.</h2>'+
    '<p class="pc-sub">Añade las que tengas entre manos y monto el calendario.</p>'+
    '<div class="pc-row"><button class="btn" id="pc-otra">Añadir otra</button>'+
    '<button class="btn btn-primary" id="pc-ver">Ver el plan</button></div>'+filas()+'</div>';
  bindCab();bindFilas(m,'more');
}
function vList(m){
  m.innerHTML=cab()+'<div class="pc-card"><h2 class="pc-q">Películas</h2>'+
    '<p class="pc-sub">Quita lo que se caiga del calendario o añade lo que falte. La lista se guarda en este navegador.</p>'+
    (films.length?filas():'<p class="pc-empty">Todavía no hay ninguna.</p>')+
    '<div class="pc-row"><button class="btn" id="pc-otra">Añadir película</button>'+
    '<button class="btn btn-primary" id="pc-ver" '+(films.length?'':'disabled')+'>Ver el plan</button></div>'+
    '<button class="pc-link" id="pc-recarga">'+(repoFilms.length
      ? 'Cargar las '+repoFilms.length+' películas de data/cartelera.csv'
      : 'Buscar cartelera en data/cartelera.csv')+'</button></div>';
  bindCab();bindFilas(m,'list');
  el('pc-recarga').onclick=()=>{
    const b=el('pc-recarga');b.textContent='Leyendo data/cartelera.csv…';
    releeCSV().then(rows=>{
      repoFilms=rows;
      if(rows.length){films=rows.map(f=>({...f}));hacerPlan();ir('plan');}
      else b.textContent='No he encontrado data/cartelera.csv (o está vacío)';
    });
  };
}

function vPlan(m){
  const warn=PLAN.avisos.filter(a=>a.t==='w').length;
  m.innerHTML=cab('<button class="btn" id="pc-edit">Películas</button>'+
      '<button class="btn" id="pc-csv1">CSV cartelera</button>'+
      '<button class="btn" id="pc-csv2">CSV plan</button>')+
    '<div class="pc-sub2">'+
    '<button data-t="cal" aria-selected="'+(tab==='cal')+'">Calendario</button>'+
    '<button data-t="det" aria-selected="'+(tab==='det')+'">Detalle</button>'+
    '<button data-t="av" aria-selected="'+(tab==='av')+'" class="'+(warn?'w':'')+'">Avisos'+(warn?' ('+warn+')':'')+'</button>'+
    '</div><div id="pc-pane"></div>';
  bindCab();
  el('pc-edit').onclick=()=>ir('list');
  el('pc-csv1').onclick=()=>copia(csvCartelera(),el('pc-csv1'));
  el('pc-csv2').onclick=()=>copia(csvPlan(),el('pc-csv2'));
  m.querySelectorAll('.pc-sub2 button').forEach(b=>b.onclick=()=>{tab=b.dataset.t;vPlan(m);});
  el('pc-pane').innerHTML=tab==='cal'?cal():tab==='det'?det():avi();
}

function cal(){
  const {weeks,camp,slots,items}=PLAN,hoy=new Date();
  let h='<div class="pc-films">'+items.map(it=>'<span class="f"><i style="background:'+it.color+'"></i>'+
    esc(it.titulo)+' <em>'+fmt(it.D)+' · '+it.P.n.toLowerCase()+'</em></span>').join('')+'</div>';
  let mesPrev=-1;
  weeks.forEach(M=>{
    const dom=addD(M,6),ju=addD(M,3);
    if(ju.getMonth()!==mesPrev){mesPrev=ju.getMonth();h+='<p class="pc-month">'+MES[mesPrev]+' '+ju.getFullYear()+'</p>';}
    const rel=items.filter(i=>i.D>=M&&i.D<=dom);
    const nls=slots.filter(s=>s.wk===iso(M)&&(s.tipo==='dedicada'||(s.men||[]).length)).sort((a,b)=>a.d-b.d);
    const tk=[],mt=[];
    camp.forEach(c=>{
      if(c.mFin>=M&&c.tkIni<=dom){
        const i=c.tkIni<M?M:c.tkIni,f=c.mFin>dom?dom:c.mFin;
        tk.push({c,col:diff(M,i)+1,span:diff(i,f)+1,cl:c.tkIni<M,cr:c.mFin>dom});
      }
      if(c.mFin>=M&&c.mIni<=dom){
        const i=c.mIni<M?M:c.mIni,f=c.mFin>dom?dom:c.mFin;
        mt.push({c,col:diff(M,i)+1,span:diff(i,f)+1,cl:c.mIni<M,cr:c.mFin>dom});
      }
    });
    const dia={};rel.forEach(it=>{const k=diff(M,it.D);(dia[k]=dia[k]||[]).push(it);});
    let pila=0;Object.values(dia).forEach(a=>pila=Math.max(pila,a.length));
    const nf=1+pila+(nls.length?1:0)+(tk.length?1:0)+(mt.length?1:0);
    h+='<div class="pc-wk">';
    for(let i=0;i<7;i++) h+='<div class="pc-col'+(i>=5?' we':'')+(i===0?' first':'')+
      '" style="grid-row:1 / span '+nf+';grid-column:'+(i+1)+'"></div>';
    for(let i=0;i<7;i++){
      const d=addD(M,i);
      h+='<div class="pc-dn'+(i>=5?' we':'')+(same(d,hoy)?' hoy':'')+'" style="grid-row:1;grid-column:'+(i+1)+
         '"><b>'+d.getDate()+'</b> '+DIAS[i]+'</div>';
    }
    Object.keys(dia).forEach(k=>dia[k].forEach((it,n)=>{
      h+='<div class="pc-est" style="--c:'+it.color+';grid-row:'+(2+n)+';grid-column:'+(Number(k)+1)+
         '"><span class="e">Estreno</span><span class="t">'+esc(it.titulo)+'</span></div>';
    }));
    let row=2+pila;
    nls.forEach(s=>{
      const c=diff(M,s.d)+1;
      h+= s.tipo==='dedicada'
        ?'<div class="pc-nl" style="--c:'+s.film.color+';grid-row:'+row+';grid-column:'+c+
         '" title="Newsletter dedicada a '+esc(s.film.titulo)+'"><span class="ch">Newsletter</span><span class="l">'+
         esc(s.film.titulo)+'</span></div>'
        :'<div class="pc-nl gen" style="grid-row:'+row+';grid-column:'+c+
         '" title="Bloque dentro de la newsletter genérica"><span class="ch">Genérica</span><span class="l">'+
         s.men.map(x=>esc(x.titulo)).join(', ')+'</span></div>';
    });
    if(nls.length)row++;
    if(tk.length){tk.forEach(s=>h+=barra(s,'tk','TikTok',row));row++;}
    if(mt.length)mt.forEach(s=>h+=barra(s,'meta','Meta',row));
    h+='</div>';
  });
  return h+'<div class="pc-lg">'+
    '<span><i style="border-left:3px solid var(--text);width:9px;height:18px;display:block"></i>Día de estreno</span>'+
    '<span><span class="ex t">TikTok</span>arranca un día antes con varios vídeos</span>'+
    '<span><span class="ex m">Meta</span>entra con el vídeo ganador</span>'+
    '<span>T0 anticipación · T1 víspera · T2 estreno · T3 alargar vida</span>'+
    '<span>Un color por película. Nunca hay dos campañas a la vez.</span></div>';
}
function barra(s,cls,canal,row){
  return '<div class="pc-cb '+cls+(s.cl?' cl':'')+(s.cr?' cr':'')+'" style="--c:'+s.c.film.color+
    ';grid-row:'+row+';grid-column:'+s.col+' / span '+s.span+'" title="'+canal+' · '+esc(s.c.film.titulo)+
    ' · tipo '+s.c.tipo+' · '+fmt(s.c.mIni)+' a '+fmt(s.c.mFin)+'"><span class="ch">'+canal+
    '</span><span class="l">'+esc(s.c.film.titulo)+'</span><span class="t">T'+s.c.tipo+'</span></div>';
}
function det(){
  const rows=[];
  PLAN.slots.forEach(s=>{if(s.tipo==='dedicada'||(s.men||[]).length)rows.push({d:s.d,nl:s});});
  PLAN.camp.forEach(c=>rows.push({d:c.tkIni,c:c}));
  rows.sort((a,b)=>a.d-b.d);
  const NOM={0:'anticipación',1:'víspera',2:'estreno en cartel',3:'alargamiento de vida'};
  const pt=c=>'<i class="sw" style="background:'+c+'"></i>';
  return rows.map(r=>{
    if(r.nl){
      const s=r.nl;
      if(s.tipo==='dedicada')
        return '<div class="pc-it"><span class="dt">'+fmtL(s.d)+'</span><span><b>'+pt(s.film.color)+
          'Newsletter dedicada · '+esc(s.film.titulo)+'</b><em>'+s.film.P.n+' · estreno '+fmt(s.film.D)+
          (s.rol==='refuerzo'?' · envío de refuerzo':'')+'</em></span></div>';
      return '<div class="pc-it"><span class="dt">'+fmtL(s.d)+'</span><span><b>'+pt(s.men[0].color)+
        'Bloque en la newsletter genérica · '+s.men.map(x=>esc(x.titulo)).join(', ')+'</b><em>Sin campaña de anuncios</em></span></div>';
    }
    const c=r.c;
    return '<div class="pc-it"><span class="dt">'+fmt(c.tkIni)+' – '+fmt(c.mFin)+'</span><span><b>'+pt(c.film.color)+
      esc(c.film.titulo)+' · campaña tipo '+c.tipo+', '+NOM[c.tipo]+'</b><em><b>TikTok</b> del '+iso(c.tkIni)+' al '+iso(c.tkFin)+
      (c.test?' — primer día solo TikTok, para ver qué vídeo funciona':'')+' · <b>Meta</b> del '+iso(c.mIni)+' al '+iso(c.mFin)+
      ' ('+c.dur+' días)</em></span></div>';
  }).join('')||'<p class="pc-empty">Nada que programar.</p>';
}
function avi(){return PLAN.avisos.map(a=>'<p class="pc-note '+a.t+'">'+a.txt+'</p>').join('');}

/* ---- CSV ---- */
function csvCartelera(){
  const r=[['titulo','fecha','premium','evento','peso','t3']];
  films.forEach(f=>r.push([f.titulo,f.fecha,f.premium?'si':'no',f.evento?'si':'no',f.imp,f.larga]));
  return r.map(x=>x.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(',')).join('\n');
}
function csvPlan(){
  const r=[['Inicio','Fin','Canal','Accion','Pelicula','Estreno']];
  PLAN.slots.forEach(s=>{
    if(s.tipo!=='dedicada'&&!(s.men||[]).length)return;
    r.push([iso(s.d),iso(s.d),'Newsletter',s.tipo==='dedicada'?'Dedicada':'Bloque en generica',
      s.tipo==='dedicada'?s.film.titulo:s.men.map(x=>x.titulo).join(' / '),
      s.tipo==='dedicada'?iso(s.film.D):'']);
  });
  PLAN.camp.forEach(c=>{
    r.push([iso(c.tkIni),iso(c.tkFin),'TikTok Ads','Tipo '+c.tipo,c.film.titulo,iso(c.film.D)]);
    r.push([iso(c.mIni),iso(c.mFin),'Meta Ads','Tipo '+c.tipo,c.film.titulo,iso(c.film.D)]);
  });
  return r.map(x=>x.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(';')).join('\n');
}
function copia(txt,btn){
  const o=btn.textContent,ok=()=>{btn.textContent='Copiado';setTimeout(()=>btn.textContent=o,1600);};
  if(navigator.clipboard&&navigator.clipboard.writeText)navigator.clipboard.writeText(txt).then(ok,()=>fb(txt,ok));
  else fb(txt,ok);
}
function fb(t,ok){const a=document.createElement('textarea');a.value=t;a.style.position='fixed';a.style.opacity=0;
  document.body.appendChild(a);a.select();try{document.execCommand('copy');ok();}catch(e){}a.remove();}

/* ------------------------------------------------------------ 4. integración */
let arrancado=false;

function open_(){
  if(!el('pc-main')) return;                 // la vista todavía no está en el DOM
  if(!arrancado){
    arrancado=true;
    const guardadas=recupera();
    if(guardadas&&guardadas.length){films=guardadas;hacerPlan();vista='plan';}
    else if(repoFilms.length){films=repoFilms.map(f=>({...f}));hacerPlan();vista='plan';}
    else vista='intro';
  }
  pinta();
}

window.PlanCartelera={
  /* la llama script.js al pulsar la pestaña */
  open:open_,
  /* la llama script.js al terminar de cargar los CSV */
  setData:function(filas){
    repoFilms=deFilas(filas);
    if(arrancado&&!recupera()&&repoFilms.length&&!films.length){
      films=repoFilms.map(f=>({...f}));hacerPlan();vista='plan';pinta();
    }
  },
  /* releer data/cartelera.csv a mano */
  reload:function(){return releeCSV().then(r=>{repoFilms=r;
    if(r.length){films=r.map(f=>({...f}));hacerPlan();vista='plan';pinta();}return r.length;});},
  repoCount:function(){return repoFilms.length;}
};

})();
