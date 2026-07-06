/* ================================================================
   CAZA INFLUENCERS — Dashboard Pro
   Módulos: Campañas · Newsletters (nuevo) · Mis Influencers · Explorar
   ================================================================ */

let influencersData = [], campaignsData = [], myInfluencersRawData = [], newslettersData = [];
let processedMyInfluencers = [], processedMyCampaigns = [];
let charts = {};

/* ---------- Referencias DOM ---------- */
const mainContent = document.getElementById('mainContent');
const loader = document.getElementById('loader');
const tabs = document.querySelectorAll('.tab');

const exploreView = document.getElementById('explore-view');
const campaignView = document.getElementById('campaign-view');
const newsletterView = document.getElementById('newsletter-view');
const myInfluencersView = document.getElementById('my-influencers-view');

const campaignOverviewView = document.getElementById('campaign-overview-view');
const campaignDetailView = document.getElementById('campaign-detail-view');
const campaignOverviewContent = document.getElementById('campaign-overview-content');
const campaignSortFilter = document.getElementById('campaign-sort-filter');

const nlOverviewView = document.getElementById('newsletter-overview-view');
const nlDetailView = document.getElementById('newsletter-detail-view');
const nlOverviewContent = document.getElementById('newsletter-overview-content');
const nlSortFilter = document.getElementById('nl-sort-filter');
const nlShowTests = document.getElementById('nl-show-tests');

const subTabInfluencers = document.getElementById('sub-tab-influencers');
const subTabCampaigns = document.getElementById('sub-tab-campaigns');
const myInfluencersGridView = document.getElementById('my-influencers-grid-view');
const myInfluencerDetailView = document.getElementById('my-influencer-detail-view');
const myCampaignsGridView = document.getElementById('my-campaigns-grid-view');
const myCampaignsDetailView = document.getElementById('my-campaigns-detail-view');
const myInfluencersSort = document.getElementById('my-influencers-sort');
const myInfluencersGrid = document.getElementById('my-influencers-grid');
const myCampaignsGrid = document.getElementById('my-campaigns-grid');

const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('results-container');
const detailContainer = document.getElementById('detail-container');

/* ---------- Helpers ---------- */
const fmtEUR = n => (n||0).toLocaleString('es-ES',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const fmtEUR2 = n => (n||0).toLocaleString('es-ES',{style:'currency',currency:'EUR',minimumFractionDigits:2,maximumFractionDigits:2});
const fmtNum = n => Math.round(n||0).toLocaleString('es-ES');
const fmtPct = (n,d=1) => ((n||0)*100).toFixed(d)+'%';
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
// convierte "0,177988971" o números a float
const num = v => { if(v==null||v==='') return 0; if(typeof v==='number') return v; return parseFloat(String(v).replace(/\./g,'').replace(',','.'))||0; };

const MESES = {ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};
function parseFechaES(s){
    if(!s) return null;
    const m = String(s).trim().toLowerCase().match(/(\d{1,2})\s+([a-zç]{3})\.?\s+(\d{4})/);
    if(!m) return null;
    const mes = MESES[m[2].substring(0,3)];
    if(mes===undefined) return null;
    return new Date(parseInt(m[3]), mes, parseInt(m[1]));
}

/* ================================================================
   1. CARGA DE DATOS
   ================================================================ */
function loadData(){
    loader.classList.remove('hidden');
    mainContent.classList.add('hidden');
    const noCache = `?t=${Date.now()}`;

    const parseCSV = (path, delimiter) => new Promise((resolve,reject)=>{
        Papa.parse(path+noCache, {download:true, header:true, dynamicTyping:false, skipEmptyLines:true, delimiter,
            complete:({data})=>resolve(data), error:err=>reject(err)});
    });

    Promise.all([
        parseCSV('data/influencers.csv', ','),
        parseCSV('data/campaigns.csv', ','),
        parseCSV('data/misinflus.csv', ','),
        parseCSV('data/newsletters.csv', ';')
    ]).then(([inf, camp, mis, nl])=>{
        influencersData = inf.map(r=>({...r, followers:num(r.followers), likesAvg:num(r.likesAvg), commentsAvg:num(r.commentsAvg)}));
        campaignsData = processCampaigns(camp);
        myInfluencersRawData = mis;
        newslettersData = processNewsletters(nl);
        processMyInfluencersData();
        initApp();
    }).catch(err=>{
        console.error(err);
        loader.classList.add('hidden');
        mainContent.classList.remove('hidden');
        alert('Error cargando datos. Revisa que los CSV estén en /data y abras la app desde un servidor (no file://).');
    });
}

function processCampaigns(rows){
    return rows.filter(r=>r.Id!=null && r.Id!=='').map(c=>{
        const budget=num(c.Spent), clicks=num(c['Link Clicks']), tickets=num(c['Tickets Sold']);
        const impressions=num(c.Views), reach=num(c.Reach), ctr=num(c['Click Rate']);
        const imageFile=c.imageFile||null;
        const imageUrl=imageFile?`images/${imageFile}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(c.Name)}&background=1f1f1f&color=fff&size=128`;
        const cpc=clicks>0?budget/clicks:0;
        const cpa=tickets>0?budget/tickets:0;
        const cpm=impressions>0?(budget/impressions)*1000:0;
        let score=(tickets*100)+(clicks*2)+(ctr*50)+(impressions*0.01);
        if(clicks>0 && cpc<0.5) score+=100;
        return {id:c.Id, name:c.Name, type:c.Type, budget, impressions, reach, clicks,
            interactions:num(c.Interactions), retention:num(c['Retention Rate']), clickRate:ctr, ticketsSold:tickets,
            views3s:num(c['3s Views']), imageUrl, daysActive:num(c['Days Active']), spentPerDay:num(c['Spent Per Day']),
            frequency:num(c.Frequency), reactions:num(c.Reactions), goal:c.Goal||'N/A', range:c.Range||'N/A',
            description:`Campaña orientada a ${c.Goal||'rendimiento'} en ${c.Range||'—'}`, cpc, cpa, cpm, score};
    });
}

/* ================================================================
   2. NAVEGACIÓN
   ================================================================ */
function initApp(){
    loader.classList.add('hidden');
    mainContent.classList.remove('hidden');
    searchBtn.removeAttribute('disabled');
    document.querySelector('.tab[data-tab="campanas"]').click();
}

function handleTabClick(e){
    tabs.forEach(t=>t.classList.remove('active'));
    e.target.classList.add('active');
    [exploreView,campaignView,newsletterView,myInfluencersView].forEach(v=>v.classList.add('hidden'));
    const t=e.target.dataset.tab;
    if(t==='explorar'){exploreView.classList.remove('hidden');populateTagFilters();filterInfluencersData();}
    else if(t==='campanas'){campaignView.classList.remove('hidden');showCampaignView('overview');}
    else if(t==='newsletters'){newsletterView.classList.remove('hidden');showNewsletterView('overview');}
    else if(t==='mis-influencers'){myInfluencersView.classList.remove('hidden');handleSubTabClick('influencers');}
}

function destroyCharts(){for(const id in charts){if(charts[id]){charts[id].destroy();delete charts[id];}}}

/* ================================================================
   3. CAMPAÑAS
   ================================================================ */
function showCampaignView(view,params={}){
    campaignOverviewView.classList.add('hidden');
    campaignDetailView.classList.add('hidden');
    if(view==='overview'){renderCampaignOverview();campaignOverviewView.classList.remove('hidden');}
    else{renderCampaignDetail(params.id);campaignDetailView.classList.remove('hidden');}
}

function renderCampaignInsights(){
    const el=document.getElementById('campaign-insights');
    const valid=campaignsData.filter(c=>c.budget>0);
    if(!valid.length){el.innerHTML='';return;}

    // Mejor CPA (coste por ticket)
    const withTickets=valid.filter(c=>c.ticketsSold>0);
    const bestCPA=[...withTickets].sort((a,b)=>a.cpa-b.cpa)[0];
    // Eficiencia: coste/día vs tickets/día -> mejor coste por día recomendado
    const perDay=withTickets.filter(c=>c.daysActive>0).map(c=>({...c, ticketsPerDay:c.ticketsSold/c.daysActive, costPerTicketDay:c.spentPerDay/(c.ticketsSold/c.daysActive||1)}));
    const bestEff=[...perDay].sort((a,b)=>a.costPerTicketDay-b.costPerTicketDay)[0];
    // Coste/día recomendado: media ponderada del spentPerDay de las campañas top-quartile por CPA
    const rankedCPA=[...withTickets].sort((a,b)=>a.cpa-b.cpa);
    const topQuartile=rankedCPA.slice(0,Math.max(1,Math.ceil(rankedCPA.length*0.25)));
    const recSpendDay=topQuartile.reduce((s,c)=>s+c.spentPerDay,0)/topQuartile.length;
    const recDays=Math.round(topQuartile.reduce((s,c)=>s+c.daysActive,0)/topQuartile.length);
    // Peor: CPA más alto entre las que gastaron algo relevante
    const worst=[...withTickets].filter(c=>c.budget>50).sort((a,b)=>b.cpa-a.cpa)[0];
    // Frecuencia media -> alerta de saturación
    const avgFreq=valid.reduce((s,c)=>s+c.frequency,0)/valid.length;
    const saturated=valid.filter(c=>c.frequency>2).length;

    const cards=[];
    if(bestEff) cards.push({cls:'good',icon:'⚡',title:'Coste/día más rentable',headline:fmtEUR2(bestEff.spentPerDay)+'/día',detail:`<strong>${bestEff.name}</strong> logró ${fmtEUR2(bestEff.cpa)} por ticket. Tu punto dulce de inversión diaria.`});
    cards.push({cls:'good',icon:'🎯',title:'Presupuesto diario recomendado',headline:fmtEUR2(recSpendDay)+'/día',detail:`Media del 25% de campañas con mejor CPA, activas ~<strong>${recDays} días</strong>. Úsalo como base para nuevas campañas.`});
    if(bestCPA) cards.push({cls:'good',icon:'🏆',title:'Mejor conversión (CPA)',headline:fmtEUR2(bestCPA.cpa)+'/ticket',detail:`<strong>${bestCPA.name}</strong> — ${bestCPA.ticketsSold} tickets con ${fmtEUR(bestCPA.budget)} invertidos.`});
    if(worst) cards.push({cls:'bad',icon:'🚩',title:'Revisar / pausar',headline:fmtEUR2(worst.cpa)+'/ticket',detail:`<strong>${worst.name}</strong> tiene el CPA más alto (${fmtEUR(worst.budget)} gastados). Candidata a optimizar creatividad o segmentación.`});
    cards.push({cls:saturated>2?'warn':'good',icon:'📡',title:'Salud de frecuencia',headline:avgFreq.toFixed(2)+'x',detail:`${saturated} campaña(s) superan frecuencia 2x (riesgo de fatiga de audiencia). Ideal mantener entre 1,2–1,8x.`});

    el.innerHTML=cards.map(c=>`<div class="insight-card ${c.cls}"><div class="insight-icon">${c.icon}</div><div class="insight-title">${c.title}</div><div class="insight-headline">${c.headline}</div><div class="insight-detail">${c.detail}</div></div>`).join('');
}

function renderCampaignOverview(){
    if(!campaignsData.length) return;
    renderCampaignInsights();
    const count=campaignsData.length;
    const totalSpent=campaignsData.reduce((a,c)=>a+c.budget,0);
    const totalClicks=campaignsData.reduce((a,c)=>a+c.clicks,0);
    const avgCTR=campaignsData.reduce((a,c)=>a+c.clickRate,0)/count;
    const avgReach=campaignsData.reduce((a,c)=>a+c.reach,0)/count;
    const avgRet=campaignsData.reduce((a,c)=>a+c.retention,0)/count;
    const avgFreq=campaignsData.reduce((a,c)=>a+c.frequency,0)/count;

    document.getElementById('global-spent').innerText=fmtEUR(totalSpent);
    document.getElementById('global-ctr').innerText=avgCTR.toFixed(2)+'%';
    document.getElementById('global-reach').innerText=fmtNum(avgReach);
    document.getElementById('global-clicks').innerText=fmtNum(totalClicks);
    document.getElementById('global-retention').innerText=avgRet.toFixed(2)+'%';
    document.getElementById('global-frequency').innerText=avgFreq.toFixed(2);

    const sortKey=campaignSortFilter.value;
    const asc=(sortKey==='cpc'||sortKey==='cpm'||sortKey==='cpa'); // menor mejor
    const chrono=[...campaignsData].sort((a,b)=>a.id-b.id);
    const labels={score:'Puntuación',ticketsSold:'Tickets',impressions:'Impresiones',clickRate:'CTR (%)',reach:'Alcance',budget:'Inversión (€)',cpc:'CPC (€)',cpm:'CPM (€)',cpa:'CPA (€)',frequency:'Frecuencia'};

    destroyCharts();
    charts.global=new Chart(document.getElementById('all-campaigns-chart'),{type:'line',
        data:{labels:chrono.map(c=>c.name),datasets:[{label:labels[sortKey]||sortKey,data:chrono.map(c=>c[sortKey]),borderColor:'#ef4444',backgroundColor:'rgba(239,68,68,.2)',borderWidth:3,pointBackgroundColor:'#fff',tension:.3,fill:true}]},
        options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},scales:{x:{ticks:{color:'#aaa'}},y:{ticks:{color:'#aaa'},grid:{color:'#333'}}},plugins:{legend:{labels:{color:'#fff'}}}}});

    const sorted=[...campaignsData].filter(c=>!asc||c[sortKey]>0).sort((a,b)=>asc?a[sortKey]-b[sortKey]:(b[sortKey]||0)-(a[sortKey]||0));
    const podium=sorted.slice(0,3), rest=sorted.slice(3);
    const disp=(c,k)=>{
        if(k==='ticketsSold')return c.ticketsSold+' Tickets';
        if(k==='score')return c.score.toFixed(0)+' Pts';
        if(k==='reach')return (c.reach/1000).toFixed(1)+'k Alcance';
        if(k==='clickRate')return c.clickRate.toFixed(2)+'% CTR';
        if(k==='budget')return fmtEUR(c.budget)+' Inv.';
        if(k==='cpc')return fmtEUR2(c.cpc)+' CPC';
        if(k==='cpm')return fmtEUR2(c.cpm)+' CPM';
        if(k==='cpa')return fmtEUR2(c.cpa)+' CPA';
        if(k==='impressions')return (c.impressions/1000).toFixed(0)+'k Impr.';
        if(k==='frequency')return c.frequency.toFixed(2)+' Freq';
        return c[k];
    };
    const podiumHTML=`<div class="podium-container">${podium.map((c,i)=>`<div class="podium-item podium-item--${i+1}" data-id="${c.id}" style="background-image:url('${c.imageUrl}')"><div class="podium-rank">${i+1}</div><div class="podium-name">${c.name}</div><div class="podium-metric">${disp(c,sortKey)}</div></div>`).join('')}</div>`;
    const listHTML=rest.length?`<div><h3>Resto de campañas</h3>${rest.map(c=>`<div class="campaign-list-item" data-id="${c.id}"><img src="${c.imageUrl}" class="campaign-list-thumbnail" alt="${c.name}"><div class="info"><h4>${c.name}</h4><p class="text-secondary">${c.type||'—'} • ${c.goal}</p></div><div class="metric-group"><div class="metric-col"><span class="metric-val">${c.ticketsSold}</span><span class="metric-lbl">Tickets</span></div><div class="metric-col"><span class="metric-val">${fmtEUR2(c.cpa)}</span><span class="metric-lbl">CPA</span></div><div class="metric-col"><span class="metric-val">${disp(c,sortKey)}</span><span class="metric-lbl">${labels[sortKey]||'Valor'}</span></div></div></div>`).join('')}</div>`:'';
    campaignOverviewContent.innerHTML=podiumHTML+listHTML;
    document.querySelectorAll('.podium-item,.campaign-list-item').forEach(el=>el.onclick=()=>showCampaignView('detail',{id:el.dataset.id}));
}

function renderCampaignDetail(id){
    destroyCharts();
    const c=campaignsData.find(x=>x.id==id); if(!c)return;
    const good=c.cpa>0&&c.cpa<2, cls=c.cpa===0?'neutral':(good?'good':(c.cpa<5?'neutral':'bad'));
    const statusText=c.cpa===0?'Sin conversión':(good?'Éxito':'Revisar'), statusCls=good?'':(c.cpa<5?'neutral':'bad');
    campaignDetailView.innerHTML=`<div class="campaign-header"><button class="btn btn-secondary" onclick="showCampaignView('overview')">← Volver al Ranking</button></div>
    <div class="campaign-detail-hero" style="background-image:url('${c.imageUrl}')"><div class="campaign-hero-content"><div class="campaign-hero-title"><h2>${c.name}</h2><p>${c.description}</p></div><div class="campaign-status-badge ${statusCls}">Estado: ${statusText}</div></div></div>
    <div class="campaign-detail-main-grid"><div><div class="kpi-grid">
    <div class="kpi-card-small"><div class="kpi-title">🎟️ Tickets Vendidos</div><div class="kpi-value">${c.ticketsSold}</div><div class="kpi-eval good">Conversión final</div></div>
    <div class="kpi-card-small"><div class="kpi-title">💸 Coste por Ticket (CPA)</div><div class="kpi-value">${fmtEUR2(c.cpa)}</div><div class="kpi-eval ${cls}">${cls==='good'?'Eficiente':(cls==='neutral'?'Ajustado':'Alto coste')}</div></div>
    <div class="kpi-card-small"><div class="kpi-title">🖱️ Clicks Totales</div><div class="kpi-value">${fmtNum(c.clicks)}</div><div class="kpi-eval neutral">CTR: ${c.clickRate.toFixed(2)}%</div></div>
    <div class="kpi-card-small"><div class="kpi-title">👁️ Visualizaciones</div><div class="kpi-value">${fmtNum(c.impressions)}</div><div class="kpi-eval">Alcance: ${fmtNum(c.reach)}</div></div>
    </div><div class="chart-wrapper"><canvas id="funnel-chart"></canvas></div></div>
    <div><div class="kpi-card-small" style="margin-bottom:20px"><div class="kpi-title">Inversión Total</div><div class="kpi-value" style="color:var(--primary)">${fmtEUR2(c.budget)}</div><div class="text-secondary" style="font-size:.8rem;margin-top:5px">${c.daysActive} días activos (${fmtEUR2(c.spentPerDay)}/día) · CPC ${fmtEUR2(c.cpc)} · CPM ${fmtEUR2(c.cpm)}</div></div>
    <h3 style="margin-bottom:15px;border-bottom:1px solid #333;padding-bottom:5px">Engagement</h3><div class="kpi-card-small"><div class="stat-row"><span>Reacciones</span><span>${c.reactions}</span></div><div class="stat-row" style="margin-top:10px"><span>Interacciones</span><span>${fmtNum(c.interactions)}</span></div><div class="stat-row" style="margin-top:10px"><span>Retención</span><span>${c.retention}%</span></div></div>
    <h3 style="margin-top:20px;margin-bottom:15px;border-bottom:1px solid #333;padding-bottom:5px">Segmentación</h3><div style="background:var(--bg-input);padding:15px;border-radius:10px"><p style="margin-bottom:5px"><strong>Objetivo:</strong> ${c.goal}</p><p><strong>Rango:</strong> ${c.range}</p></div></div></div>`;
    charts.funnel=new Chart(document.getElementById('funnel-chart'),{type:'bar',data:{labels:['Impresiones','Alcance','Clics','Tickets'],datasets:[{label:'Conversión',data:[c.impressions,c.reach,c.clicks,c.ticketsSold],backgroundColor:['#7f1d1d','#b91c1c','#ef4444','#22c55e']}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},title:{display:true,text:'Embudo de Conversión',color:'#aaa'}},scales:{x:{ticks:{color:'#aaa'},type:'logarithmic'},y:{ticks:{color:'#fff'}}}}});
}

/* ================================================================
   4. NEWSLETTERS  (NUEVO MÓDULO)
   ================================================================ */
function processNewsletters(rows){
    return rows.filter(r=>r.Id && String(r.Id).trim()!=='').map(r=>{
        const recipients=num(r.Destinatarios), opens=num(r.Aperturas), clicks=num(r.Clicks);
        const uniqueClicks=num(r['DCh.']), tickets=num(r.tickets), revenue=num(r.precio);
        const openRate=num(r['Open rate']), ctr=num(r.CTR), attribution=num(r['Atribution Rate']);
        const subject=(r.Asunto||'').trim();
        const date=parseFechaES(r.Fecha);
        // click-to-open rate
        const cto=opens>0?clicks/opens:0;
        // ingreso por mil envíos y por mil aperturas
        const revPerMille=recipients>0?(revenue/recipients)*1000:0;
        const revPerOpen=opens>0?revenue/opens:0;
        // conversión: tickets / clicks
        const clickToTicket=clicks>0?tickets/clicks:0;
        // detección de tests / envíos técnicos
        const isTest=/^test\b|sin asunto|smtp\+|no-reply|s\d{4,}_/i.test(subject) || recipients<700;

        // SCORE: prioriza ingreso real ponderado por eficiencia de embudo, penaliza open rates anómalos
        // normalizamos suavemente
        let score = revenue*1.0 + tickets*8 + (revPerMille*30) + (openRate*100) + (ctr*400) + (attribution*40);
        return {id:r.Id, subject, date, dateStr:r.Fecha, recipients, opens, clicks, uniqueClicks, tickets, revenue,
            openRate, ctr, attribution, cto, revPerMille, revPerOpen, clickToTicket, isTest, score};
    }).filter(n=>n.recipients>0);
}

function activeNewsletters(){
    return nlShowTests.checked ? newslettersData : newslettersData.filter(n=>!n.isTest);
}

function showNewsletterView(view,params={}){
    nlOverviewView.classList.add('hidden');
    nlDetailView.classList.add('hidden');
    if(view==='overview'){renderNewsletterOverview();nlOverviewView.classList.remove('hidden');}
    else{renderNewsletterDetail(params.id);nlDetailView.classList.remove('hidden');}
}

function renderNewsletterInsights(list){
    const el=document.getElementById('newsletter-insights');
    if(!list.length){el.innerHTML='';return;}

    // Mejor por ingreso/1k envíos (eficiencia real, independiente del volumen)
    const bestRPM=[...list].sort((a,b)=>b.revPerMille-a.revPerMille)[0];
    // Mejor CTOR (calidad del asunto vs contenido)
    const bestCTO=[...list].filter(n=>n.opens>200).sort((a,b)=>b.cto-a.cto)[0];
    // Peor open rate con volumen alto -> asunto a mejorar
    const worstOpen=[...list].filter(n=>n.recipients>20000).sort((a,b)=>a.openRate-b.openRate)[0];
    // Mejor día de la semana por ingreso medio
    const byDow={};
    list.forEach(n=>{if(n.date){const d=n.date.getDay();(byDow[d]=byDow[d]||[]).push(n.revPerMille);}});
    const dowNames=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    let bestDow=null,bestDowVal=-1;
    Object.entries(byDow).forEach(([d,arr])=>{const avg=arr.reduce((s,v)=>s+v,0)/arr.length;if(avg>bestDowVal){bestDowVal=avg;bestDow=d;}});
    // Detección emoji en asunto -> impacto en open rate
    const withEmoji=list.filter(n=>/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(n.subject));
    const noEmoji=list.filter(n=>!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(n.subject));
    const emojiOpen=withEmoji.length?withEmoji.reduce((s,n)=>s+n.openRate,0)/withEmoji.length:0;
    const plainOpen=noEmoji.length?noEmoji.reduce((s,n)=>s+n.openRate,0)/noEmoji.length:0;
    const emojiLift=plainOpen>0?((emojiOpen-plainOpen)/plainOpen*100):0;

    const cards=[];
    if(bestRPM) cards.push({cls:'good',icon:'💰',title:'Envío más rentable (por volumen)',headline:fmtEUR2(bestRPM.revPerMille)+' /1k',detail:`"<strong>${truncate(bestRPM.subject,42)}</strong>" generó ${fmtEUR(bestRPM.revenue)} con ${fmtNum(bestRPM.recipients)} envíos.`});
    if(bestDow!==null) cards.push({cls:'good',icon:'📅',title:'Mejor día para enviar',headline:dowNames[bestDow],detail:`Ingreso medio de <strong>${fmtEUR2(bestDowVal)}/1k envíos</strong>. Prioriza los envíos de mayor valor este día.`});
    if(bestCTO) cards.push({cls:'good',icon:'🎯',title:'Mejor Click-to-Open',headline:fmtPct(bestCTO.cto,1),detail:`"<strong>${truncate(bestCTO.subject,40)}</strong>" — el contenido conecta con quien abre. Replica su estructura.`});
    if(Math.abs(emojiLift)>3) cards.push({cls:emojiLift>0?'good':'warn',icon:'😀',title:'Impacto de emojis en asunto',headline:(emojiLift>0?'+':'')+emojiLift.toFixed(0)+'% aperturas',detail:`Los asuntos con emoji ${emojiLift>0?'suben':'bajan'} el open rate frente a los de texto plano (${fmtPct(emojiOpen)} vs ${fmtPct(plainOpen)}).`});
    if(worstOpen) cards.push({cls:'bad',icon:'📉',title:'Asunto a optimizar (alto volumen)',headline:fmtPct(worstOpen.openRate),detail:`"<strong>${truncate(worstOpen.subject,42)}</strong>" rinde por debajo pese a ${fmtNum(worstOpen.recipients)} envíos. Prueba A/B de asunto.`});

    el.innerHTML=cards.map(c=>`<div class="insight-card ${c.cls}"><div class="insight-icon">${c.icon}</div><div class="insight-title">${c.title}</div><div class="insight-headline">${c.headline}</div><div class="insight-detail">${c.detail}</div></div>`).join('');
}

function truncate(s,n){return s.length>n?s.substring(0,n-1)+'…':s;}

function renderNewsletterOverview(){
    const list=activeNewsletters();
    document.getElementById('nl-count').innerText=list.length;
    if(!list.length){nlOverviewContent.innerHTML='<p class="text-secondary">No hay envíos que mostrar.</p>';return;}
    renderNewsletterInsights(list);

    const sumRecip=list.reduce((s,n)=>s+n.recipients,0);
    const sumOpens=list.reduce((s,n)=>s+n.opens,0);
    const sumClicks=list.reduce((s,n)=>s+n.clicks,0);
    const sumTickets=list.reduce((s,n)=>s+n.tickets,0);
    const sumRev=list.reduce((s,n)=>s+n.revenue,0);
    document.getElementById('nl-open').innerText=fmtPct(sumRecip>0?sumOpens/sumRecip:0);
    document.getElementById('nl-ctr').innerText=fmtPct(sumOpens>0?sumClicks/sumOpens:0,2)+' CTOR';
    document.getElementById('nl-tickets').innerText=fmtNum(sumTickets);
    document.getElementById('nl-revenue').innerText=fmtEUR(sumRev);
    document.getElementById('nl-rpm').innerText=fmtEUR2(sumRecip>0?(sumRev/sumRecip)*1000:0);

    // Gráfico tendencia temporal: ingresos por envío (orden cronológico)
    const chrono=[...list].filter(n=>n.date).sort((a,b)=>a.date-b.date);
    destroyCharts();
    charts.nlTrend=new Chart(document.getElementById('nl-trend-chart'),{
        data:{labels:chrono.map(n=>n.date.toLocaleDateString('es-ES',{day:'2-digit',month:'short'})),
            datasets:[
                {type:'bar',label:'Ingresos (€)',data:chrono.map(n=>n.revenue),backgroundColor:'rgba(239,68,68,.6)',yAxisID:'y'},
                {type:'line',label:'Open Rate',data:chrono.map(n=>n.openRate*100),borderColor:'#22c55e',backgroundColor:'transparent',tension:.3,yAxisID:'y1',pointRadius:2}
            ]},
        options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},
            scales:{x:{ticks:{color:'#aaa',maxTicksLimit:14}},y:{position:'left',ticks:{color:'#ef4444'},grid:{color:'#333'},title:{display:true,text:'€',color:'#ef4444'}},y1:{position:'right',ticks:{color:'#22c55e'},grid:{display:false},title:{display:true,text:'Open %',color:'#22c55e'}}},
            plugins:{legend:{labels:{color:'#fff'}}}}});

    // Ranking
    const key=nlSortFilter.value;
    const map={score:'score',revenue:'revenue',tickets:'tickets',revPerMille:'revPerMille',openRate:'openRate',ctr:'ctr',cto:'cto',attribution:'attribution',recipients:'recipients'};
    const sorted=[...list].sort((a,b)=>(b[map[key]]||0)-(a[map[key]]||0));
    const podium=sorted.slice(0,3), rest=sorted.slice(3);
    const badge=(n)=>{ // color por eficiencia (revPerMille)
        const v=n.revPerMille; const cls=v>60?'good':(v>25?'neutral':'bad');
        return `<span class="score-pill ${cls}">${fmtEUR2(v)}/1k</span>`;
    };
    const dispKey=(n)=>{
        if(key==='revenue')return fmtEUR(n.revenue);
        if(key==='tickets')return n.tickets+' tickets';
        if(key==='revPerMille')return fmtEUR2(n.revPerMille)+'/1k';
        if(key==='openRate')return fmtPct(n.openRate);
        if(key==='ctr')return fmtPct(n.ctr,2)+' CTR';
        if(key==='cto')return fmtPct(n.cto,1)+' CTOR';
        if(key==='attribution')return fmtPct(n.attribution,1);
        if(key==='recipients')return fmtNum(n.recipients);
        return n.score.toFixed(0)+' Pts';
    };
    const podiumHTML=`<div class="podium-container">${podium.map((n,i)=>`<div class="podium-item podium-item--${i+1}" data-id="${n.id}" style="background:linear-gradient(135deg,var(--bg-input),var(--bg-card))"><div class="podium-rank">${i+1}</div><div class="podium-name">${truncate(n.subject,34)}</div><div class="podium-metric">${dispKey(n)}</div></div>`).join('')}</div>`;
    const listHTML=rest.length?`<div><h3>Resto de envíos</h3>${rest.map(n=>`<div class="campaign-list-item" data-id="${n.id}"><div class="campaign-list-thumbnail" style="display:flex;align-items:center;justify-content:center;font-size:1.5rem">✉️</div><div class="info"><h4>${truncate(n.subject,60)}</h4><p class="text-secondary">${n.dateStr} • ${fmtNum(n.recipients)} envíos ${n.isTest?'• <span style="color:var(--warning)">TEST</span>':''}</p></div><div class="metric-group"><div class="metric-col"><span class="metric-val">${fmtEUR(n.revenue)}</span><span class="metric-lbl">Ingresos</span></div><div class="metric-col"><span class="metric-val">${n.tickets}</span><span class="metric-lbl">Tickets</span></div><div class="metric-col"><span class="metric-val">${badge(n)}</span><span class="metric-lbl">Eficiencia</span></div></div></div>`).join('')}</div>`:'';
    nlOverviewContent.innerHTML=podiumHTML+listHTML;
    document.querySelectorAll('#newsletter-overview-content .podium-item,#newsletter-overview-content .campaign-list-item').forEach(el=>el.onclick=()=>showNewsletterView('detail',{id:el.dataset.id}));
}

function renderNewsletterDetail(id){
    destroyCharts();
    const n=newslettersData.find(x=>x.id==id); if(!n)return;
    // benchmarks vs media del conjunto activo
    const list=activeNewsletters();
    const avgOpen=list.reduce((s,x)=>s+x.openRate,0)/list.length;
    const avgCTO=list.reduce((s,x)=>s+x.cto,0)/list.length;
    const avgRPM=list.reduce((s,x)=>s+x.revPerMille,0)/list.length;
    const cmp=(v,avg)=>{const diff=avg>0?(v-avg)/avg*100:0;const cls=diff>=5?'good':(diff<=-5?'bad':'neutral');return `<span class="${cls}">${diff>=0?'▲':'▼'} ${Math.abs(diff).toFixed(0)}% vs media</span>`;};
    const good=n.revPerMille>avgRPM, statusText=good?'Alto rendimiento':'Bajo rendimiento', statusCls=good?'':'bad';

    nlDetailView.innerHTML=`<div class="campaign-header"><button class="btn btn-secondary" onclick="showNewsletterView('overview')">← Volver al Ranking</button></div>
    <div class="campaign-detail-hero" style="height:auto;min-height:180px;background:linear-gradient(135deg,var(--primary-dark),var(--bg-card))"><div class="campaign-hero-content" style="align-items:flex-end"><div class="campaign-hero-title"><h2 style="font-size:1.8rem">${n.subject}</h2><p>${n.dateStr} · ${fmtNum(n.recipients)} destinatarios ${n.isTest?'· <span style="color:var(--warning)">Envío test/técnico</span>':''}</p></div><div class="campaign-status-badge ${statusCls}">${statusText}</div></div></div>
    <div class="campaign-detail-main-grid"><div><div class="kpi-grid">
    <div class="kpi-card-small"><div class="kpi-title">💰 Ingresos Atribuidos</div><div class="kpi-value">${fmtEUR(n.revenue)}</div><div class="kpi-eval good">${n.tickets} tickets</div></div>
    <div class="kpi-card-small"><div class="kpi-title">📈 Ingreso / 1k envíos</div><div class="kpi-value">${fmtEUR2(n.revPerMille)}</div><div class="kpi-eval">${cmp(n.revPerMille,avgRPM)}</div></div>
    <div class="kpi-card-small"><div class="kpi-title">📬 Open Rate</div><div class="kpi-value">${fmtPct(n.openRate)}</div><div class="kpi-eval">${cmp(n.openRate,avgOpen)}</div></div>
    <div class="kpi-card-small"><div class="kpi-title">🎯 Click-to-Open</div><div class="kpi-value">${fmtPct(n.cto,1)}</div><div class="kpi-eval">${cmp(n.cto,avgCTO)}</div></div>
    </div><div class="chart-wrapper"><canvas id="nl-funnel-chart"></canvas></div></div>
    <div><div class="kpi-card-small" style="margin-bottom:20px"><div class="kpi-title">Attribution Rate</div><div class="kpi-value" style="color:var(--primary)">${fmtPct(n.attribution,1)}</div><div class="text-secondary" style="font-size:.8rem;margin-top:5px">Ratio de tickets atribuidos sobre clics únicos</div></div>
    <h3 style="margin-bottom:15px;border-bottom:1px solid #333;padding-bottom:5px">Embudo</h3><div class="kpi-card-small"><div class="stat-row"><span>Enviados</span><span>${fmtNum(n.recipients)}</span></div><div class="stat-row" style="margin-top:10px"><span>Aperturas</span><span>${fmtNum(n.opens)} (${fmtPct(n.openRate)})</span></div><div class="stat-row" style="margin-top:10px"><span>Clics</span><span>${fmtNum(n.clicks)} (${fmtPct(n.ctr,2)})</span></div><div class="stat-row" style="margin-top:10px"><span>Clics únicos</span><span>${fmtNum(n.uniqueClicks)}</span></div><div class="stat-row" style="margin-top:10px"><span>Tickets</span><span>${n.tickets}</span></div><div class="stat-row" style="margin-top:10px"><span>Ingreso/apertura</span><span>${fmtEUR2(n.revPerOpen)}</span></div></div>
    <div style="background:var(--bg-input);padding:15px;border-radius:10px;margin-top:20px;font-size:.85rem;line-height:1.5">${nlRecommendation(n,avgOpen,avgCTO,avgRPM)}</div></div></div>`;
    charts.nlFunnel=new Chart(document.getElementById('nl-funnel-chart'),{type:'bar',data:{labels:['Enviados','Aperturas','Clics','Tickets'],datasets:[{label:'Embudo',data:[n.recipients,n.opens,n.clicks,n.tickets],backgroundColor:['#7f1d1d','#b91c1c','#ef4444','#22c55e']}]},options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false},title:{display:true,text:'Embudo del envío',color:'#aaa'}},scales:{x:{type:'logarithmic',ticks:{color:'#aaa'}},y:{ticks:{color:'#fff'}}}}});
}

function nlRecommendation(n,avgOpen,avgCTO,avgRPM){
    const tips=[];
    if(n.openRate<avgOpen*0.9) tips.push('📩 <strong>Open rate bajo:</strong> revisa el asunto y el nombre del remitente. Prueba un A/B con y sin emoji.');
    else tips.push('📩 <strong>Asunto sólido:</strong> el open rate supera la media. Reutiliza su tono.');
    if(n.cto<avgCTO*0.9) tips.push('🖱️ <strong>Contenido poco clicable:</strong> refuerza el CTA principal y sube el enlace above the fold.');
    if(n.revPerMille>avgRPM*1.2) tips.push('🚀 <strong>Envío muy rentable:</strong> plantéate reactivarlo con la audiencia que no abrió.');
    if(n.tickets===0) tips.push('⚠️ <strong>Sin conversión:</strong> este envío no generó tickets; útil solo como branding.');
    return '<strong style="color:var(--primary)">Recomendaciones</strong><br>'+tips.join('<br>');
}

/* ================================================================
   5. MIS INFLUENCERS
   ================================================================ */
function handleSubTabClick(sub){
    [myInfluencersGridView,myInfluencerDetailView,myCampaignsGridView,myCampaignsDetailView].forEach(v=>v.classList.add('hidden'));
    subTabInfluencers.classList.remove('active');subTabCampaigns.classList.remove('active');
    if(sub==='influencers'){subTabInfluencers.classList.add('active');myInfluencersGridView.classList.remove('hidden');renderMyInfluencersGrid();}
    else{subTabCampaigns.classList.add('active');myCampaignsGridView.classList.remove('hidden');renderMyCampaignsGrid();}
}

function processMyInfluencersData(){
    const gI={}, gC={};
    myInfluencersRawData.forEach(row=>{
        const id=row['ID influencer'], title=row['Título Contenido'];
        if(!id||!title)return;
        const imp=num(row['Impresiones']),lk=num(row['Likes']),cm=num(row['Comentarios']),rc=num(row['Cuentas Alcanzadas']),sh=num(row['Veces compartidas']),men=num(row['Hombres']),wom=num(row['Mujeres']);
        if(!gI[id])gI[id]={id,name:row['Influencer'],platform:row['Plataforma'],image:row['Imagen'],sumImpressions:0,sumLikes:0,sumComments:0,sumReach:0,sumShares:0,men:0,women:0,count:0,contents:[]};
        gI[id].sumImpressions+=imp;gI[id].sumLikes+=lk;gI[id].sumComments+=cm;gI[id].sumReach+=rc;gI[id].sumShares+=sh;gI[id].men+=men;gI[id].women+=wom;gI[id].count++;gI[id].contents.push(row);
        if(!gC[title])gC[title]={title,totalImpressions:0,totalReach:0,totalLikes:0,totalComments:0,contents:[]};
        gC[title].totalImpressions+=imp;gC[title].totalReach+=rc;gC[title].totalLikes+=lk;gC[title].totalComments+=cm;gC[title].contents.push(row);
    });
    processedMyInfluencers=Object.values(gI).map(i=>{
        const engagement=(i.sumLikes+i.sumComments+i.sumShares);
        const engRate=i.sumImpressions>0?(engagement/i.sumImpressions*100):0;
        return {...i,avgImpressions:i.sumImpressions/i.count,avgLikes:i.sumLikes/i.count,avgComments:i.sumComments/i.count,avgReach:i.sumReach/i.count,avgMen:Math.round(i.men/i.count),avgWomen:Math.round(i.women/i.count),engagementRate:engRate};
    });
    processedMyCampaigns=Object.values(gC);
}

function renderMyInfluencersGrid(){
    myInfluencersGrid.innerHTML='';
    if(!processedMyInfluencers.length){myInfluencersGrid.innerHTML='<p>No hay datos.</p>';return;}
    const k=myInfluencersSort.value;
    const sorted=[...processedMyInfluencers].sort((a,b)=>{
        if(k==='name')return a.name.localeCompare(b.name);
        if(k==='count')return b.count-a.count;
        if(k==='engagement')return (b.avgLikes+b.avgComments)-(a.avgLikes+a.avgComments);
        if(k==='engagementRate')return b.engagementRate-a.engagementRate;
        if(k==='impressions')return b.avgImpressions-a.avgImpressions;
        if(k==='reach')return b.avgReach-a.avgReach;
        return 0;
    });
    sorted.forEach(i=>{
        const img=i.image?`images/${i.image}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(i.name)}&background=random`;
        const erCls=i.engagementRate>5?'good':(i.engagementRate>2?'neutral':'bad');
        const card=document.createElement('div');card.className='my-influencer-card';
        card.innerHTML=`<div class="my-influencer-header"><img src="${img}" class="my-influencer-avatar" alt="${i.name}"><div><h3 style="margin:0">${i.name}</h3><span style="background:#333;padding:2px 8px;border-radius:4px;font-size:.8rem">${i.platform}</span></div><div class="content-badge">${i.count} Contenidos</div></div>
        <div class="my-influencer-stats"><div class="stat-row"><span>Prom. Impr</span><span>${fmtNum(i.avgImpressions)}</span></div><div class="stat-row"><span>Prom. Alcance</span><span>${fmtNum(i.avgReach)}</span></div><div class="stat-row"><span>Prom. Likes</span><span>${fmtNum(i.avgLikes)}</span></div><div class="stat-row"><span>Eng. Rate</span><span class="${erCls}">${i.engagementRate.toFixed(1)}%</span></div></div>
        <div style="padding:0 20px 20px"><p style="font-size:.8rem;color:#aaa;margin-bottom:5px">Audiencia: H ${i.avgMen}% / M ${i.avgWomen}%</p><div class="demographics-bar"><div class="demographics-fill" style="width:${i.avgMen}%;background:#3b82f6"></div><div class="demographics-fill" style="width:${i.avgWomen}%;background:#ec4899"></div></div></div>`;
        card.onclick=()=>showMyInfluencerDetail(i.id);
        myInfluencersGrid.appendChild(card);
    });
}

function showMyInfluencerDetail(id){
    const i=processedMyInfluencers.find(x=>x.id==id);if(!i)return;
    // asegurar vista correcta si venimos de otra sub-tab
    myInfluencersView.classList.remove('hidden');
    [myInfluencersGridView,myCampaignsGridView,myCampaignsDetailView].forEach(v=>v.classList.add('hidden'));
    myInfluencerDetailView.classList.remove('hidden');
    const img=i.image?`images/${i.image}`:`https://ui-avatars.com/api/?name=${encodeURIComponent(i.name)}&background=random`;
    myInfluencerDetailView.innerHTML=`<div class="campaign-header"><button class="btn btn-secondary" onclick="handleSubTabClick('influencers')">← Volver a Influencers</button></div>
    <div style="display:flex;gap:20px;align-items:center;background:var(--bg-card);padding:20px;border-radius:10px;border:1px solid var(--border);margin-bottom:20px;flex-wrap:wrap"><img src="${img}" style="width:100px;height:100px;border-radius:50%;object-fit:cover;border:3px solid var(--primary)"><div><h2 style="font-size:2rem;margin:0">${i.name}</h2><p class="text-secondary">${i.platform} • ${i.count} Contenidos</p><div style="display:flex;gap:15px;margin-top:10px;flex-wrap:wrap"><span style="background:#333;padding:5px 10px;border-radius:5px">👁️ ${fmtNum(i.avgImpressions)} Prom. Impr</span><span style="background:#333;padding:5px 10px;border-radius:5px">❤️ ${fmtNum(i.avgLikes)} Prom. Likes</span><span style="background:#333;padding:5px 10px;border-radius:5px">⚡ ${i.engagementRate.toFixed(1)}% Eng.</span></div></div></div>
    <h3 style="margin-bottom:15px;color:var(--primary)">Desglose de Contenidos</h3><div style="overflow-x:auto"><table class="content-table"><thead><tr><th>Título</th><th>Plataforma</th><th>Impresiones</th><th>Alcance</th><th>Likes</th><th>Comentarios</th><th>Compartidos</th></tr></thead><tbody>${i.contents.map(c=>`<tr><td>${c['Título Contenido']}</td><td>${c['Plataforma']}</td><td>${fmtNum(num(c['Impresiones']))}</td><td>${fmtNum(num(c['Cuentas Alcanzadas']))}</td><td>${fmtNum(num(c['Likes']))}</td><td>${fmtNum(num(c['Comentarios']))}</td><td>${fmtNum(num(c['Veces compartidas']))}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderMyCampaignsGrid(){
    myCampaignsGrid.innerHTML='';
    if(!processedMyCampaigns.length){myCampaignsGrid.innerHTML='<p>No hay datos.</p>';return;}
    processedMyCampaigns.forEach(camp=>{
        const card=document.createElement('div');card.className='result-card';
        card.innerHTML=`<h3>${camp.title}</h3><p class="text-secondary" style="margin-bottom:10px">${camp.contents.length} Contenidos / Influencers</p><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;font-size:.9rem"><div><strong>${fmtNum(camp.totalImpressions)}</strong><br><span class="text-secondary">Impresiones</span></div><div><strong>${fmtNum(camp.totalLikes)}</strong><br><span class="text-secondary">Likes</span></div></div><div style="margin-top:10px;text-align:right"><span style="color:var(--primary);font-weight:bold;font-size:.8rem">VER DETALLES →</span></div>`;
        card.onclick=()=>renderMyCampaignDetail(camp.title);
        myCampaignsGrid.appendChild(card);
    });
}

function renderMyCampaignDetail(title,sortBy='likes'){
    const camp=processedMyCampaigns.find(c=>c.title===title);if(!camp)return;
    [myInfluencersGridView,myInfluencerDetailView,myCampaignsGridView].forEach(v=>v.classList.add('hidden'));
    myCampaignsDetailView.classList.remove('hidden');
    let cs=[...camp.contents];
    if(sortBy==='likes')cs.sort((a,b)=>num(b['Likes'])-num(a['Likes']));
    else if(sortBy==='impressions')cs.sort((a,b)=>num(b['Impresiones'])-num(a['Impresiones']));
    else if(sortBy==='men')cs.sort((a,b)=>num(b['Hombres'])-num(a['Hombres']));
    else if(sortBy==='women')cs.sort((a,b)=>num(b['Mujeres'])-num(a['Mujeres']));
    myCampaignsDetailView.innerHTML=`<div class="campaign-header"><div style="display:flex;gap:10px;align-items:center"><button class="btn btn-secondary" id="back-to-camp-grid">← Volver</button><h2 style="color:var(--primary);margin:0">${camp.title}</h2></div><div style="display:flex;gap:10px;align-items:center"><label class="text-secondary">Ordenar por:</label><select id="campaign-detail-sort" style="width:180px"><option value="likes" ${sortBy==='likes'?'selected':''}>Mayor Likes</option><option value="impressions" ${sortBy==='impressions'?'selected':''}>Mayor Visualizaciones</option><option value="men" ${sortBy==='men'?'selected':''}>% Hombres</option><option value="women" ${sortBy==='women'?'selected':''}>% Mujeres</option></select></div></div>
    <div class="global-dashboard" style="margin-bottom:20px;grid-template-columns:repeat(4,1fr)"><div class="global-kpi-card" style="padding:15px"><span class="label">Total Impresiones</span><span class="value">${fmtNum(camp.totalImpressions)}</span></div><div class="global-kpi-card" style="padding:15px"><span class="label">Total Alcance</span><span class="value">${fmtNum(camp.totalReach)}</span></div><div class="global-kpi-card" style="padding:15px"><span class="label">Total Likes</span><span class="value">${fmtNum(camp.totalLikes)}</span></div><div class="global-kpi-card" style="padding:15px"><span class="label">Nº Influencers</span><span class="value">${camp.contents.length}</span></div></div>
    <h3 style="margin-bottom:15px">Contenidos Asociados</h3><div style="overflow-x:auto"><table class="content-table"><thead><tr><th>Influencer</th><th>Plataforma</th><th>Impresiones</th><th>Likes</th><th>% H</th><th>% M</th><th>Acción</th></tr></thead><tbody>${cs.map(c=>`<tr><td style="font-weight:bold;color:var(--primary)">${c['Influencer']}</td><td>${c['Plataforma']}</td><td>${fmtNum(num(c['Impresiones']))}</td><td>${fmtNum(num(c['Likes']))}</td><td>${c['Hombres']}%</td><td>${c['Mujeres']}%</td><td><button class="btn btn-secondary" style="padding:2px 8px;font-size:.8rem" onclick="showMyInfluencerDetail('${c['ID influencer']}')">Ver ficha</button></td></tr>`).join('')}</tbody></table></div>`;
    document.getElementById('back-to-camp-grid').onclick=()=>handleSubTabClick('campaigns');
    document.getElementById('campaign-detail-sort').onchange=e=>renderMyCampaignDetail(title,e.target.value);
}

/* ================================================================
   6. EXPLORAR
   ================================================================ */
let filteredInfluencers=[];
function populateTagFilters(){
    const t1=document.getElementById('tag1-filter'),t2=document.getElementById('tag2-filter');
    if(t1.options.length>1)return;
    const n=influencersData.flatMap(i=>(!i.niche||typeof i.niche!=='string')?[]:i.niche.split('|').map(s=>s.trim()));
    [...new Set(n.filter(Boolean))].sort().forEach(tag=>{t1.appendChild(new Option(tag,tag));t2.appendChild(new Option(tag,tag));});
}
function filterInfluencersData(){
    loader.classList.remove('hidden');resultsContainer.classList.add('hidden');
    setTimeout(()=>{
        const p=document.getElementById('platform-filter').value,f=document.getElementById('followers-filter').value,t1=document.getElementById('tag1-filter').value,t2=document.getElementById('tag2-filter').value,term=document.getElementById('search-input').value.toLowerCase();
        filteredInfluencers=influencersData.filter(i=>{
            const n=(typeof i.niche==='string')?i.niche.split('|').map(s=>s.trim()):[];
            if(p!=='Todos'&&i.platform!==p)return false;
            if(f==='<100K'&&i.followers>=1e5)return false;
            if(f==='100K-500K'&&(i.followers<1e5||i.followers>5e5))return false;
            if(f==='>500K'&&i.followers<=5e5)return false;
            if(t1!=='Todos'&&!n.includes(t1))return false;
            if(t2!=='Todos'&&!n.includes(t2))return false;
            if(term&&!(i.name||'').toLowerCase().includes(term)&&!n.some(s=>s.toLowerCase().includes(term)))return false;
            return true;
        });
        displayInfluencerResults();loader.classList.add('hidden');resultsContainer.classList.remove('hidden');
    },300);
}
function displayInfluencerResults(){
    resultsContainer.innerHTML='';
    if(!filteredInfluencers.length){resultsContainer.innerHTML='<p>No se encontraron influencers.</p>';return;}
    filteredInfluencers.forEach(i=>{
        const raw=((i.likesAvg||0)+(i.commentsAvg||0)*1.5)/(i.followers||1)*100;
        const impact=raw>100?100:raw.toFixed(2);
        const card=document.createElement('div');card.className='result-card';
        card.innerHTML=`<h3>${i.name}</h3><p class="text-secondary">${i.platform}</p><p>👥 ${fmtNum(i.followers)}</p><p>❤️ ${fmtNum(i.likesAvg)}</p><p class="text-impact">⚡ Engagement: ${impact}%</p>`;
        card.addEventListener('click',()=>displayInfluencerDetail(i));
        resultsContainer.appendChild(card);
    });
}
function displayInfluencerDetail(i){
    destroyCharts();resultsContainer.classList.add('hidden');detailContainer.classList.remove('hidden');
    const n=(typeof i.niche==='string')?i.niche.split('|').map(s=>s.trim()).filter(Boolean):[];
    detailContainer.innerHTML=`<div style="display:flex;align-items:center;gap:20px;margin-bottom:20px"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(i.name)}&background=ef4444&color=fff&size=120" style="border-radius:50%" alt="${i.name}"><div><h2>${i.name}</h2><p class="text-secondary">${i.platform}</p></div></div><div style="margin-bottom:20px">${n.map(t=>`<span style="background:#333;padding:5px 10px;border-radius:15px;margin-right:5px;font-size:.8rem">${t}</span>`).join('')}</div><button class="btn btn-secondary" id="back-explore-btn">← Volver</button><div style="margin-top:20px;height:300px"><canvas id="influencer-chart"></canvas></div>`;
    document.getElementById('back-explore-btn').onclick=()=>{detailContainer.classList.add('hidden');resultsContainer.classList.remove('hidden');};
    charts.influencer=new Chart(document.getElementById('influencer-chart'),{type:'bar',data:{labels:['Seguidores','Likes Avg','Comentarios Avg'],datasets:[{label:'Métricas',data:[i.followers,i.likesAvg,i.commentsAvg],backgroundColor:['#ef4444','#f59e0b','#3b82f6']}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{type:'logarithmic'}}}});
}

/* ================================================================
   7. INIT
   ================================================================ */
document.addEventListener('DOMContentLoaded',()=>{
    tabs.forEach(t=>t.addEventListener('click',handleTabClick));
    subTabInfluencers.addEventListener('click',()=>handleSubTabClick('influencers'));
    subTabCampaigns.addEventListener('click',()=>handleSubTabClick('campaigns'));
    searchBtn.onclick=filterInfluencersData;
    campaignSortFilter.onchange=renderCampaignOverview;
    nlSortFilter.onchange=renderNewsletterOverview;
    nlShowTests.onchange=renderNewsletterOverview;
    document.getElementById('reload-data-btn').onclick=loadData;
    myInfluencersSort.onchange=renderMyInfluencersGrid;
    loadData();
});
