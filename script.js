/* ================================================================
   CAZA INFLUENCERS · Analytics
   Campañas · Newsletters · Mis Influencers · Explorar
   ---------------------------------------------------------------
   ÍNDICE DE EFICIENCIA (campañas, 0–100):
     Percentil de cada campaña frente al resto en:
       CPC (invertido)      30%   coste de cada clic
       CTR                  25%   proporción de clics
       CPM (invertido)      15%   coste de cada mil impresiones
       Retención            15%   calidad del vídeo (si existe)
       Frecuencia óptima    15%   cercanía al rango ideal 1,2–1,8
     Nota: las campañas de Meta no registran tickets vendidos, por lo
     que el índice mide eficiencia de medios, no conversión final.

   ÍNDICE DE RENDIMIENTO (newsletters, 0–100):
     € por 1k envíos        35%   rentabilidad normalizada por volumen
     Ingresos absolutos     20%
     Open rate              15%
     Click-to-open (CTOR)   15%
     Attribution rate       15%
   ================================================================ */

let influencersData = [], campaignsData = [], myInfluencersRawData = [], newslettersData = [];
let processedMyInfluencers = [], processedMyCampaigns = [];
let charts = {};

/* ---------- DOM ---------- */
const mainContent = document.getElementById('mainContent');
const loader = document.getElementById('loader');
const tabs = document.querySelectorAll('.tab');
const exploreView = document.getElementById('explore-view');
const campaignView = document.getElementById('campaign-view');
const newsletterView = document.getElementById('newsletter-view');
const myInfluencersView = document.getElementById('my-influencers-view');
const campaignOverviewView = document.getElementById('campaign-overview-view');
const campaignDetailView = document.getElementById('campaign-detail-view');
const campaignSortFilter = document.getElementById('campaign-sort-filter');
const nlOverviewView = document.getElementById('newsletter-overview-view');
const nlDetailView = document.getElementById('newsletter-detail-view');
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
const fmtPct = (n,d=1) => ((n||0)*100).toFixed(d).replace('.',',')+'%';
const fmtK = n => n>=1000 ? (n/1000).toFixed(1).replace('.',',')+'k' : fmtNum(n);
const num = v => {
    if(v==null||v==='') return 0;
    if(typeof v==='number') return v;
    let s=String(v).trim();
    if(s.includes(',')) s=s.replace(/\./g,'').replace(',','.');
    return parseFloat(s)||0;
};
const truncate=(s,n)=>s.length>n?s.substring(0,n-1)+'…':s;
const MESES={ene:0,feb:1,mar:2,abr:3,may:4,jun:5,jul:6,ago:7,sep:8,oct:9,nov:10,dic:11};
function parseFechaES(s){
    if(!s)return null;
    const m=String(s).trim().toLowerCase().match(/(\d{1,2})\s+([a-zç]{3})\.?\s+(\d{4})/);
    if(!m)return null;
    const mes=MESES[m[2].substring(0,3)];
    if(mes===undefined)return null;
    return new Date(+m[3],mes,+m[1]);
}
// Percentil de v dentro de arr (0–100). higherBetter=false invierte.
function percentile(v, arr, higherBetter=true){
    const valid=arr.filter(x=>isFinite(x));
    if(!valid.length)return 50;
    const below=valid.filter(x=>higherBetter ? x<v : x>v).length;
    const equal=valid.filter(x=>x===v).length;
    return ((below + equal*0.5)/valid.length)*100;
}
const median=arr=>{const a=[...arr].filter(isFinite).sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0;};
const mean=arr=>{const a=arr.filter(isFinite);return a.length?a.reduce((s,v)=>s+v,0)/a.length:0;};
const q=(arr,p)=>{const a=[...arr].filter(isFinite).sort((x,y)=>x-y);if(!a.length)return 0;return a[Math.min(a.length-1,Math.floor(a.length*p))];};
const scoreClass=s=>s>=66?'s-high':(s>=40?'s-mid':'s-low');

/* ---------- Resolución universal de imágenes ----------
   Acepta indistintamente:
     · una URL absoluta (http/https)  → The Movie Database, CDN, etc.
     · un protocolo relativo (//...)   → se sirve tal cual
     · un nombre de fichero local      → se prefija con la carpeta indicada
   Devuelve null si no hay valor, para que el llamador use su fallback. */
function resolveImg(value, localDir='images'){
    const v=(value==null?'':String(value)).trim();
    if(!v) return null;
    if(/^(https?:)?\/\//i.test(v) || v.startsWith('data:')) return v;
    return `${localDir}/${v}`;
}
/* Escapa comillas simples para incrustar una URL dentro de un atributo style/onerror */
const escAttr=s=>String(s).replace(/'/g,"%27").replace(/"/g,'%22');

/* ================================================================
   CARGA
   ================================================================ */
function loadData(){
    loader.classList.remove('hidden');
    mainContent.querySelectorAll('.tabs, #campaign-view, #newsletter-view, #my-influencers-view, #explore-view').forEach(e=>e.classList.add('hidden'));
    const noCache=`?t=${Date.now()}`;
    const parseCSV=(path,delimiter)=>new Promise((res,rej)=>{
        Papa.parse(path+noCache,{download:true,header:true,dynamicTyping:false,skipEmptyLines:true,delimiter,complete:({data})=>res(data),error:rej});
    });
    Promise.all([
        parseCSV('data/influencers.csv',','),
        parseCSV('data/campaigns.csv',','),
        parseCSV('data/misinflus.csv',','),
        parseCSV('data/newsletters.csv',',')
    ]).then(([inf,camp,mis,nl])=>{
        influencersData=inf.map(r=>({...r,followers:num(r.followers),likesAvg:num(r.likesAvg),commentsAvg:num(r.commentsAvg)}));
        campaignsData=processCampaigns(camp);
        myInfluencersRawData=mis;
        newslettersData=processNewsletters(nl);
        processMyInfluencersData();
        initApp();
    }).catch(err=>{
        console.error(err);
        loader.classList.add('hidden');
        alert('Error cargando datos. Comprueba que los CSV estén en /data y que la app se sirva desde un servidor.');
    });
}

function initApp(){
    loader.classList.add('hidden');
    document.querySelector('.tabs').classList.remove('hidden');
    searchBtn.removeAttribute('disabled');
    document.querySelector('.tab[data-tab="campanas"]').click();
}

/* ================================================================
   CAMPAÑAS · procesamiento y scoring
   ================================================================ */
function processCampaigns(rows){
    const base=rows.filter(r=>r.Id!=null&&String(r.Id).trim()!=='').map(c=>{
        const budget=num(c.Spent),clicks=num(c['Link Clicks']),impressions=num(c.Views),reach=num(c.Reach);
        const ctr=num(c['Click Rate']),retention=num(c['Retention Rate']),frequency=num(c.Frequency);
        const imageFile=(c.imageFile||c.imageUrl||c.image||c.poster||'').trim();
        return {
            id:c.Id,name:c.Name,type:c.Type||'—',budget,impressions,reach,clicks,
            interactions:num(c.Interactions),retention,clickRate:ctr,
            views3s:num(c['3s Views']),
            imageUrl:resolveImg(imageFile),
            daysActive:num(c['Days Active']),spentPerDay:num(c['Spent Per Day']),
            frequency,reactions:num(c.Reactions),goal:c.Goal||'—',range:c.Range||'—',
            cpc:clicks>0?budget/clicks:Infinity,
            cpm:impressions>0?(budget/impressions)*1000:Infinity,
            reachPerEuro:budget>0?reach/budget:0
        };
    });
    // Índice de Eficiencia: percentiles ponderados
    const cpcs=base.map(c=>c.cpc), ctrs=base.map(c=>c.clickRate), cpms=base.map(c=>c.cpm);
    const rets=base.filter(c=>c.retention>0).map(c=>c.retention);
    base.forEach(c=>{
        const pCPC=percentile(c.cpc,cpcs,false);
        const pCTR=percentile(c.clickRate,ctrs,true);
        const pCPM=percentile(c.cpm,cpms,false);
        const hasRet=c.retention>0;
        const pRET=hasRet?percentile(c.retention,rets,true):null;
        // Frecuencia: 100 dentro de 1,2–1,8; decae linealmente fuera
        let pFREQ;
        if(c.frequency>=1.2&&c.frequency<=1.8)pFREQ=100;
        else if(c.frequency<1.2)pFREQ=Math.max(0,100-(1.2-c.frequency)*120);
        else pFREQ=Math.max(0,100-(c.frequency-1.8)*45);
        // Pesos; si no hay retención, su peso se reparte
        let score, parts;
        if(hasRet){
            score=pCPC*.30+pCTR*.25+pCPM*.15+pRET*.15+pFREQ*.15;
            parts=[{label:'CPC (coste por clic)',w:30,p:pCPC},{label:'CTR',w:25,p:pCTR},{label:'CPM',w:15,p:pCPM},{label:'Retención de vídeo',w:15,p:pRET},{label:'Frecuencia óptima',w:15,p:pFREQ}];
        }else{
            score=pCPC*.36+pCTR*.30+pCPM*.18+pFREQ*.16;
            parts=[{label:'CPC (coste por clic)',w:36,p:pCPC},{label:'CTR',w:30,p:pCTR},{label:'CPM',w:18,p:pCPM},{label:'Frecuencia óptima',w:16,p:pFREQ}];
        }
        c.score=Math.round(score);
        c.scoreParts=parts;
    });
    return base;
}

function campaignBenchmarks(){
    const all=campaignsData;
    const p75=q(all.map(c=>c.score),0.75);
    const top=all.filter(c=>c.score>=p75);
    const row=(name,desc,topArr,allArr,fmt,lowerBetter=false)=>{
        const t=median(topArr), a=mean(allArr.filter(isFinite));
        const diff=a!==0?((lowerBetter?(a-t):(t-a))/Math.abs(a))*100:0;
        return {name,desc,target:fmt(t),avg:fmt(a),diff};
    };
    return {
        n:top.length,total:all.length,
        rows:[
            row('Inversión diaria','€ por día de campaña',top.map(c=>c.spentPerDay),all.map(c=>c.spentPerDay),v=>fmtEUR2(v)+'/día'),
            row('Duración','días activos',top.map(c=>c.daysActive),all.map(c=>c.daysActive),v=>Math.round(v)+' días'),
            row('CPC objetivo','coste por clic',top.map(c=>c.cpc).filter(isFinite),all.map(c=>c.cpc).filter(isFinite),fmtEUR2,true),
            row('CTR objetivo','ratio de clics',top.map(c=>c.clickRate),all.map(c=>c.clickRate),v=>v.toFixed(2).replace('.',',')+'%'),
            row('CPM objetivo','coste por mil impresiones',top.map(c=>c.cpm).filter(isFinite),all.map(c=>c.cpm).filter(isFinite),fmtEUR2,true),
            row('Frecuencia','impactos por persona',top.map(c=>c.frequency),all.map(c=>c.frequency),v=>v.toFixed(2).replace('.',','),true)
        ]
    };
}

function showCampaignView(view,params={}){
    campaignOverviewView.classList.add('hidden');
    campaignDetailView.classList.add('hidden');
    if(view==='overview'){renderCampaignOverview();campaignOverviewView.classList.remove('hidden');}
    else{renderCampaignDetail(params.id);campaignDetailView.classList.remove('hidden');}
    window.scrollTo({top:0});
}

function benchTableHTML(bench){
    const head='<thead><tr><th>Métrica</th><th>Valor óptimo</th><th>Media actual</th><th>Diferencial</th></tr></thead>';
    const body='<tbody>'+bench.rows.map(r=>{
        const cls=r.diff>=8?'good':(r.diff<=-8?'bad':'neutral');
        const arrow=r.diff>=0?'+':'−';
        return `<tr><td class="metric-name">${r.name}<span>${r.desc}</span></td><td class="target">${r.target}</td><td>${r.avg}</td><td><span class="delta ${cls}">${arrow}${Math.abs(r.diff).toFixed(0)}%</span></td></tr>`;
    }).join('')+'</tbody>';
    return head+body;
}

function renderCampaignOverview(){
    if(!campaignsData.length)return;
    const all=campaignsData;
    const totalSpent=all.reduce((s,c)=>s+c.budget,0);
    const totalClicks=all.reduce((s,c)=>s+c.clicks,0);
    const totalImpr=all.reduce((s,c)=>s+c.impressions,0);
    const totalReach=all.reduce((s,c)=>s+c.reach,0);
    const wCTR=totalImpr>0?totalClicks/totalImpr*100:0;
    const wCPC=totalClicks>0?totalSpent/totalClicks:0;
    const wCPM=totalImpr>0?totalSpent/totalImpr*1000:0;

    document.getElementById('campaign-kpis').innerHTML=[
        {l:'Inversión total',v:fmtEUR(totalSpent),s:all.length+' campañas'},
        {l:'Impresiones',v:fmtK(totalImpr),s:'Alcance '+fmtK(totalReach)},
        {l:'Clics totales',v:fmtNum(totalClicks),s:''},
        {l:'CTR ponderado',v:wCTR.toFixed(2).replace('.',',')+'%',s:'clics / impresiones'},
        {l:'CPC medio',v:fmtEUR2(wCPC),s:'inversión / clics'},
        {l:'CPM medio',v:fmtEUR2(wCPM),s:'por mil impresiones'}
    ].map(k=>`<div class="kpi-cell"><span class="micro-label">${k.l}</span><div class="val">${k.v}</div><div class="sub">${k.s}</div></div>`).join('');

    const bench=campaignBenchmarks();
    document.getElementById('bench-note').innerText=`Basado en las ${bench.n} campañas top de ${bench.total}`;
    document.getElementById('bench-table').innerHTML=benchTableHTML(bench);

    const sortKey=campaignSortFilter.value;
    const labels={score:'Índice de Eficiencia',clickRate:'CTR (%)',cpc:'CPC (€)',cpm:'CPM (€)',retention:'Retención (%)',impressions:'Impresiones',reach:'Alcance',clicks:'Clics',budget:'Inversión (€)',frequency:'Frecuencia'};
    document.getElementById('campaign-chart-title').innerText=labels[sortKey]+' por campaña (orden cronológico)';
    document.getElementById('campaign-rank-sub').innerText='Ordenado por '+labels[sortKey];

    const chrono=[...all].sort((a,b)=>a.id-b.id);
    destroyCharts();
    Chart.defaults.font.family="'Inter',sans-serif";
    Chart.defaults.font.size=11;
    const cc=chartColors();
    charts.global=new Chart(document.getElementById('all-campaigns-chart'),{type:'bar',
        data:{labels:chrono.map(c=>truncate(c.name,16)),datasets:[{label:labels[sortKey],data:chrono.map(c=>isFinite(c[sortKey])?c[sortKey]:0),backgroundColor:'rgba(230,51,63,.55)',hoverBackgroundColor:'rgba(230,51,63,.85)',borderRadius:3,maxBarThickness:26}]},
        options:{responsive:true,maintainAspectRatio:false,
            scales:{x:{ticks:{color:cc.tick,maxRotation:60},grid:{display:false}},y:{ticks:{color:cc.tick},grid:{color:cc.grid},border:{display:false}}},
            plugins:{legend:{display:false}}}});

    const asc=(sortKey==='cpc'||sortKey==='cpm');
    const sorted=[...all].filter(c=>!asc||isFinite(c[sortKey])).sort((a,b)=>asc?a[sortKey]-b[sortKey]:(b[sortKey]||0)-(a[sortKey]||0));
    const disp=c=>{
        const v=c[sortKey];
        if(sortKey==='score')return null; // score badge already shown
        if(sortKey==='cpc'||sortKey==='cpm'||sortKey==='budget')return fmtEUR2(v);
        if(sortKey==='clickRate')return v.toFixed(2).replace('.',',')+'%';
        if(sortKey==='retention')return v.toFixed(1).replace('.',',')+'%';
        if(sortKey==='frequency')return v.toFixed(2).replace('.',',');
        return fmtK(v);
    };
    const featured=sorted.slice(0,3), rest=sorted.slice(3);
    const featHTML='<div class="featured-grid">'+featured.map((c,i)=>{
        const media=c.imageUrl
            ? `<div class="featured-media" style="background-image:url('${escAttr(c.imageUrl)}')"></div>`
            : `<div class="featured-media featured-media--empty">${(c.name||'?')[0]}</div>`;
        const extra=disp(c);
        return `<div class="featured-card rank-${i+1}" data-id="${c.id}">
            ${media}
            <div class="featured-shade"></div>
            <div class="featured-rank">Nº ${i+1}</div>
            <div class="featured-score"><span class="score-badge ${scoreClass(c.score)}">${c.score}</span></div>
            <div class="featured-body">
                <h3>${c.name}</h3>
                <div class="meta">${c.type} · ${c.goal} · ${c.daysActive} días · ${fmtEUR2(c.spentPerDay)}/día</div>
                <div class="featured-metrics">
                    <div class="fm"><div class="v">${c.clickRate.toFixed(2).replace('.',',')}%</div><div class="l">CTR</div></div>
                    <div class="fm"><div class="v">${isFinite(c.cpc)?fmtEUR2(c.cpc):'—'}</div><div class="l">CPC</div></div>
                    ${extra!==null?`<div class="fm"><div class="v">${extra}</div><div class="l">${labels[sortKey]}</div></div>`:''}
                </div>
            </div>
        </div>`;
    }).join('')+'</div>';
    document.getElementById('campaign-rank-list').innerHTML=rest.map((c,i)=>{
        const thumb=c.imageUrl
            ? `<div class="rank-thumb" style="background-image:url('${escAttr(c.imageUrl)}')"></div>`
            : `<div class="rank-thumb letter">${(c.name||'?')[0]}</div>`;
        const extra=disp(c);
        return `<div class="rank-row" data-id="${c.id}">
            <div class="rank-num">${String(i+4).padStart(2,'0')}</div>
            ${thumb}
            <div class="rank-main"><h4>${c.name}</h4><p>${c.type} · ${c.goal} · ${c.daysActive} días · ${fmtEUR2(c.spentPerDay)}/día</p></div>
            <div class="rank-metrics">
                <div class="rank-metric"><div class="v">${c.clickRate.toFixed(2).replace('.',',')}%</div><div class="l">CTR</div></div>
                <div class="rank-metric"><div class="v">${isFinite(c.cpc)?fmtEUR2(c.cpc):'—'}</div><div class="l">CPC</div></div>
                ${extra!==null?`<div class="rank-metric"><div class="v">${extra}</div><div class="l">${labels[sortKey]}</div></div>`:''}
                <div class="score-badge ${scoreClass(c.score)}">${c.score}</div>
            </div>
        </div>`;
    }).join('');
    // Insertar/actualizar el bloque destacado justo antes de la lista
    const prevFeat=document.getElementById('campaign-featured');
    if(prevFeat)prevFeat.remove();
    document.getElementById('campaign-rank-list').insertAdjacentHTML('beforebegin',`<div id="campaign-featured">${featHTML}</div>`);
    document.querySelectorAll('#campaign-featured .featured-card,#campaign-rank-list .rank-row').forEach(el=>el.onclick=()=>showCampaignView('detail',{id:el.dataset.id}));
}

function renderCampaignDetail(id){
    destroyCharts();
    const c=campaignsData.find(x=>x.id==id);if(!c)return;
    const all=campaignsData;
    const avgCTR=mean(all.map(x=>x.clickRate)), avgCPC=mean(all.map(x=>x.cpc).filter(isFinite)), avgCPM=mean(all.map(x=>x.cpm).filter(isFinite));
    const cmp=(v,avg,lowerBetter=false)=>{
        if(!isFinite(v)||avg===0)return '';
        let diff=(v-avg)/avg*100; if(lowerBetter)diff=-diff;
        const cls=diff>=5?'good':(diff<=-5?'bad':'neutral');
        return `<div class="cmp ${cls}">${diff>=0?'+':'−'}${Math.abs(diff).toFixed(0)}% vs media</div>`;
    };
    const st=c.score>=66?['good','Alto rendimiento']:(c.score>=40?['neutral','Rendimiento medio']:['bad','Bajo rendimiento']);

    campaignDetailView.innerHTML=`
    <div class="detail-head">
        <button class="btn" onclick="showCampaignView('overview')">← Volver al ranking</button>
    </div>
    <div class="detail-hero ${c.imageUrl?'has-img':'no-img'}">
        ${c.imageUrl?`<div class="detail-hero-media" style="background-image:url('${escAttr(c.imageUrl)}')"></div>`:''}
        <div class="detail-hero-shade"></div>
        <div class="detail-hero-body">
            <div>
                <h2>${c.name}</h2>
                <div class="meta">${c.type} · Objetivo: ${c.goal} · Segmento: ${c.range}</div>
            </div>
            <span class="status-chip ${st[0]}">${st[1]} · ${c.score}/100</span>
        </div>
    </div>
    <div class="detail-grid">
        <div>
            <div class="stat-grid">
                <div class="stat-card"><span class="micro-label">CTR</span><div class="val">${c.clickRate.toFixed(2).replace('.',',')}%</div>${cmp(c.clickRate,avgCTR)}</div>
                <div class="stat-card"><span class="micro-label">CPC</span><div class="val">${isFinite(c.cpc)?fmtEUR2(c.cpc):'—'}</div>${cmp(c.cpc,avgCPC,true)}</div>
                <div class="stat-card"><span class="micro-label">CPM</span><div class="val">${isFinite(c.cpm)?fmtEUR2(c.cpm):'—'}</div>${cmp(c.cpm,avgCPM,true)}</div>
                <div class="stat-card"><span class="micro-label">Frecuencia</span><div class="val">${c.frequency.toFixed(2).replace('.',',')}</div><div class="cmp ${c.frequency>=1.2&&c.frequency<=1.8?'good':(c.frequency>2.2?'bad':'neutral')}">${c.frequency>=1.2&&c.frequency<=1.8?'En rango óptimo (1,2–1,8)':(c.frequency>1.8?'Riesgo de fatiga':'Baja repetición')}</div></div>
            </div>
            <div class="chart-card" style="margin-bottom:0">
                <div class="chart-title">Embudo de medios</div>
                <div class="chart-body"><canvas id="funnel-chart"></canvas></div>
            </div>
        </div>
        <div>
            <div class="side-card">
                <h3>Inversión</h3>
                <div class="kv-row"><span>Total invertido</span><span>${fmtEUR2(c.budget)}</span></div>
                <div class="kv-row"><span>Días activos</span><span>${c.daysActive}</span></div>
                <div class="kv-row"><span>Inversión / día</span><span>${fmtEUR2(c.spentPerDay)}</span></div>
                <div class="kv-row"><span>Alcance por €</span><span>${fmtNum(c.reachPerEuro)}</span></div>
            </div>
            <div class="side-card">
                <h3>Desglose del índice</h3>
                ${c.scoreParts.map(p=>`<div class="score-bar-row"><div class="sb-head"><span>${p.label} · peso ${p.w}%</span><span>P${Math.round(p.p)}</span></div><div class="sb-track"><div class="sb-fill" style="width:${p.p}%"></div></div></div>`).join('')}
                <p style="font-size:.72rem;color:var(--text-3);margin-top:12px;line-height:1.5">Cada barra es el percentil de la campaña frente a las demás. El índice es la media ponderada. Mide eficiencia de medios; las campañas de Meta no registran ventas de tickets.</p>
            </div>
            <div class="side-card">
                <h3>Engagement</h3>
                <div class="kv-row"><span>Interacciones</span><span>${fmtNum(c.interactions)}</span></div>
                <div class="kv-row"><span>Reacciones</span><span>${fmtNum(c.reactions)}</span></div>
                <div class="kv-row"><span>Vistas 3s</span><span>${fmtNum(c.views3s)}</span></div>
                <div class="kv-row"><span>Retención</span><span>${c.retention?c.retention.toFixed(1).replace('.',',')+'%':'—'}</span></div>
            </div>
        </div>
    </div>`;
    const ccF=chartColors();
    charts.funnel=new Chart(document.getElementById('funnel-chart'),{type:'bar',
        data:{labels:['Impresiones','Alcance','Clics'],datasets:[{data:[c.impressions,c.reach,c.clicks],backgroundColor:['rgba(230,51,63,.35)','rgba(230,51,63,.6)','rgba(230,51,63,.9)'],borderRadius:4,maxBarThickness:34}]},
        options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
            scales:{x:{type:'logarithmic',ticks:{color:ccF.tick},grid:{color:ccF.grid},border:{display:false}},y:{ticks:{color:ccF.tick2},grid:{display:false}}}}});
}

/* ================================================================
   NEWSLETTERS
   ================================================================ */
function processNewsletters(rows){
    const base=rows.filter(r=>r.Id&&String(r.Id).trim()!=='').map(r=>{
        const recipients=num(r.Destinatarios),opens=num(r.Aperturas),clicks=num(r.Clicks);
        const uniqueClicks=num(r['DCh.']),tickets=num(r.tickets),revenue=num(r.precio);
        const openRate=num(r['Open rate']),ctr=num(r.CTR),attribution=num(r['Atribution Rate']);
        const subject=(r.Asunto||'').trim();
        const date=parseFechaES(r.Fecha);
        const cto=opens>0?clicks/opens:0;
        const revPerMille=recipients>0?(revenue/recipients)*1000:0;
        const revPerOpen=opens>0?revenue/opens:0;
        const isTest=/^test\b|sin asunto|smtp\+|no-reply|s\d{4,}_/i.test(subject)||recipients<700;
        return {id:r.Id,subject,date,dateStr:r.Fecha,recipients,opens,clicks,uniqueClicks,tickets,revenue,openRate,ctr,attribution,cto,revPerMille,revPerOpen,isTest};
    }).filter(n=>n.recipients>0);
    // Índice de Rendimiento (percentiles sobre envíos no-test)
    const ref=base.filter(n=>!n.isTest);
    const rpms=ref.map(n=>n.revPerMille),revs=ref.map(n=>n.revenue),ops=ref.map(n=>n.openRate),ctos=ref.map(n=>n.cto),atts=ref.map(n=>n.attribution);
    base.forEach(n=>{
        const parts=[
            {label:'€ por 1k envíos',w:35,p:percentile(n.revPerMille,rpms)},
            {label:'Ingresos absolutos',w:20,p:percentile(n.revenue,revs)},
            {label:'Open rate',w:15,p:percentile(n.openRate,ops)},
            {label:'Click-to-open',w:15,p:percentile(n.cto,ctos)},
            {label:'Attribution rate',w:15,p:percentile(n.attribution,atts)}
        ];
        n.score=Math.round(parts.reduce((s,x)=>s+x.p*x.w/100,0));
        n.scoreParts=parts;
    });
    return base;
}

function activeNewsletters(){return nlShowTests.checked?newslettersData:newslettersData.filter(n=>!n.isTest);}

function nlBenchmarks(list){
    const p75=q(list.map(n=>n.revPerMille),0.75);
    const top=list.filter(n=>n.revPerMille>=p75);
    const dowNames=['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
    const byDow={};
    list.forEach(n=>{if(n.date){const d=n.date.getDay();(byDow[d]=byDow[d]||[]).push(n.revPerMille);}});
    let bestDow='—',bestVal=-1;
    Object.entries(byDow).forEach(([d,a])=>{if(a.length>=3){const m=mean(a);if(m>bestVal){bestVal=m;bestDow=dowNames[d];}}});
    const row=(name,desc,topArr,allArr,fmt,lowerBetter=false)=>{
        const t=median(topArr),a=mean(allArr);
        const diff=a!==0?((lowerBetter?(a-t):(t-a))/Math.abs(a))*100:0;
        return {name,desc,target:fmt(t),avg:fmt(a),diff};
    };
    const rows=[
        row('Rentabilidad','€ por 1.000 envíos',top.map(n=>n.revPerMille),list.map(n=>n.revPerMille),fmtEUR2),
        row('Open rate','aperturas / envíos',top.map(n=>n.openRate),list.map(n=>n.openRate),v=>fmtPct(v)),
        row('Click-to-open','clics / aperturas',top.map(n=>n.cto),list.map(n=>n.cto),v=>fmtPct(v)),
        row('Attribution rate','tickets / clics únicos',top.map(n=>n.attribution),list.map(n=>n.attribution),v=>fmtPct(v)),
        row('Volumen de envío','destinatarios',top.map(n=>n.recipients),list.map(n=>n.recipients),fmtK)
    ];
    return {n:top.length,total:list.length,rows,bestDow,bestVal};
}

function showNewsletterView(view,params={}){
    nlOverviewView.classList.add('hidden');
    nlDetailView.classList.add('hidden');
    if(view==='overview'){renderNewsletterOverview();nlOverviewView.classList.remove('hidden');}
    else{renderNewsletterDetail(params.id);nlDetailView.classList.remove('hidden');}
    window.scrollTo({top:0});
}

function renderNewsletterOverview(){
    const list=activeNewsletters();
    if(!list.length)return;
    const sumRecip=list.reduce((s,n)=>s+n.recipients,0);
    const sumOpens=list.reduce((s,n)=>s+n.opens,0);
    const sumClicks=list.reduce((s,n)=>s+n.clicks,0);
    const sumTickets=list.reduce((s,n)=>s+n.tickets,0);
    const sumRev=list.reduce((s,n)=>s+n.revenue,0);

    document.getElementById('nl-kpis').innerHTML=[
        {l:'Envíos',v:list.length,s:fmtK(sumRecip)+' destinatarios'},
        {l:'Ingresos atribuidos',v:fmtEUR(sumRev),s:sumTickets.toLocaleString('es-ES')+' tickets'},
        {l:'€ / 1k envíos',v:fmtEUR2(sumRecip>0?sumRev/sumRecip*1000:0),s:'rentabilidad global'},
        {l:'Open rate',v:fmtPct(sumRecip>0?sumOpens/sumRecip:0),s:'ponderado'},
        {l:'Click-to-open',v:fmtPct(sumOpens>0?sumClicks/sumOpens:0),s:'clics / aperturas'},
        {l:'€ / ticket',v:fmtEUR2(sumTickets>0?sumRev/sumTickets:0),s:'precio medio'}
    ].map(k=>`<div class="kpi-cell"><span class="micro-label">${k.l}</span><div class="val">${k.v}</div><div class="sub">${k.s}</div></div>`).join('');

    const bench=nlBenchmarks(list);
    document.getElementById('nl-bench-note').innerText=`Top ${bench.n} de ${bench.total} envíos · Mejor día: ${bench.bestDow} (${fmtEUR2(bench.bestVal)}/1k)`;
    document.getElementById('nl-bench-table').innerHTML=benchTableHTML(bench);

    const chrono=[...list].filter(n=>n.date).sort((a,b)=>a.date-b.date);
    destroyCharts();
    Chart.defaults.font.family="'Inter',sans-serif";
    Chart.defaults.font.size=11;
    charts.nlTrend=new Chart(document.getElementById('nl-trend-chart'),{
        data:{labels:chrono.map(n=>n.date.toLocaleDateString('es-ES',{day:'2-digit',month:'short'})),
            datasets:[
                {type:'bar',label:'Ingresos (€)',data:chrono.map(n=>n.revenue),backgroundColor:'rgba(230,51,63,.5)',borderRadius:2,yAxisID:'y',maxBarThickness:14},
                {type:'line',label:'Open rate (%)',data:chrono.map(n=>n.openRate*100),borderColor:'#46a758',borderWidth:2,pointRadius:0,tension:.35,yAxisID:'y1'}
            ]},
        options:{responsive:true,maintainAspectRatio:false,interaction:{intersect:false,mode:'index'},
            scales:{x:{ticks:{color:chartColors().tick,maxTicksLimit:16},grid:{display:false}},
                y:{position:'left',ticks:{color:chartColors().tick},grid:{color:chartColors().grid},border:{display:false}},
                y1:{position:'right',ticks:{color:'#46a758'},grid:{display:false},border:{display:false}}},
            plugins:{legend:{labels:{color:chartColors().tick2,boxWidth:10,boxHeight:10}}}}});

    const key=nlSortFilter.value;
    const sorted=[...list].sort((a,b)=>(b[key]||0)-(a[key]||0));
    const nlFeat=sorted.slice(0,3), nlRest=sorted.slice(3);
    const grads=[
        "radial-gradient(ellipse at 25% 0%,rgba(230,51,63,.45),transparent 60%),linear-gradient(150deg,#26161a,#101014)",
        "radial-gradient(ellipse at 75% 0%,rgba(230,51,63,.3),transparent 55%),linear-gradient(150deg,#1e1518,#101014)",
        "radial-gradient(ellipse at 50% 100%,rgba(230,51,63,.25),transparent 55%),linear-gradient(150deg,#1a1416,#101014)"
    ];
    const featNL='<div class="featured-grid">'+nlFeat.map((n,i)=>`
        <div class="featured-card rank-${i+1}" data-id="${n.id}">
            <div class="featured-media" style="background-image:${grads[i]}"></div>
            <div class="featured-shade"></div>
            <div class="featured-rank">Nº ${i+1}</div>
            <div class="featured-score"><span class="score-badge ${scoreClass(n.score)}">${n.score}</span></div>
            <div class="featured-body">
                <h3 style="font-size:${i===0?'1.15rem':'1rem'}">${truncate(n.subject,64)}</h3>
                <div class="meta">${n.dateStr} · ${fmtK(n.recipients)} destinatarios</div>
                <div class="featured-metrics">
                    <div class="fm"><div class="v">${fmtEUR(n.revenue)}</div><div class="l">Ingresos</div></div>
                    <div class="fm"><div class="v">${fmtEUR2(n.revPerMille)}</div><div class="l">€/1k</div></div>
                    <div class="fm"><div class="v">${fmtPct(n.openRate)}</div><div class="l">Open</div></div>
                </div>
            </div>
        </div>`).join('')+'</div>';
    const prevNLFeat=document.getElementById('nl-featured');
    if(prevNLFeat)prevNLFeat.remove();
    document.getElementById('nl-rank-list').insertAdjacentHTML('beforebegin',`<div id="nl-featured">${featNL}</div>`);
    document.getElementById('nl-rank-list').innerHTML=nlRest.map((n,i)=>{
        return `<div class="rank-row" data-id="${n.id}">
            <div class="rank-num">${String(i+4).padStart(2,'0')}</div>
            <div class="rank-thumb letter">${(n.subject.replace(/[^\p{L}\p{N}]/gu,'')[0]||'N').toUpperCase()}</div>
            <div class="rank-main"><h4>${truncate(n.subject,70)}</h4><p>${n.dateStr} · ${fmtK(n.recipients)} destinatarios ${n.isTest?'· <span class="test-tag">test</span>':''}</p></div>
            <div class="rank-metrics">
                <div class="rank-metric"><div class="v">${fmtEUR(n.revenue)}</div><div class="l">Ingresos</div></div>
                <div class="rank-metric"><div class="v">${fmtEUR2(n.revPerMille)}</div><div class="l">€/1k</div></div>
                <div class="rank-metric"><div class="v">${fmtPct(n.openRate)}</div><div class="l">Open</div></div>
                <div class="score-badge ${scoreClass(n.score)}">${n.score}</div>
            </div>
        </div>`;
    }).join('');
    document.querySelectorAll('#nl-featured .featured-card,#nl-rank-list .rank-row').forEach(el=>el.onclick=()=>showNewsletterView('detail',{id:el.dataset.id}));
}

function renderNewsletterDetail(id){
    destroyCharts();
    const n=newslettersData.find(x=>x.id==id);if(!n)return;
    const list=activeNewsletters().length?activeNewsletters():newslettersData;
    const avgOpen=mean(list.map(x=>x.openRate)),avgCTO=mean(list.map(x=>x.cto)),avgRPM=mean(list.map(x=>x.revPerMille)),avgAtt=mean(list.map(x=>x.attribution));
    const cmp=(v,avg)=>{
        if(avg===0)return '';
        const diff=(v-avg)/avg*100;
        const cls=diff>=5?'good':(diff<=-5?'bad':'neutral');
        return `<div class="cmp ${cls}">${diff>=0?'+':'−'}${Math.abs(diff).toFixed(0)}% vs media</div>`;
    };
    const st=n.score>=66?['good','Alto rendimiento']:(n.score>=40?['neutral','Rendimiento medio']:['bad','Bajo rendimiento']);

    nlDetailView.innerHTML=`
    <div class="detail-head">
        <button class="btn" onclick="showNewsletterView('overview')">← Volver al ranking</button>
    </div>
    <div class="detail-hero nl-hero">
        <div class="detail-hero-body">
            <div>
                <h2 style="font-size:1.5rem">${n.subject}</h2>
                <div class="meta">${n.dateStr} · ${fmtNum(n.recipients)} destinatarios ${n.isTest?'· <span class="test-tag">envío test / técnico</span>':''}</div>
            </div>
            <span class="status-chip ${st[0]}">${st[1]} · ${n.score}/100</span>
        </div>
    </div>
    <div class="detail-grid">
        <div>
            <div class="stat-grid">
                <div class="stat-card"><span class="micro-label">Ingresos atribuidos</span><div class="val">${fmtEUR(n.revenue)}</div><div class="cmp">${n.tickets} tickets · ${fmtEUR2(n.tickets>0?n.revenue/n.tickets:0)}/ticket</div></div>
                <div class="stat-card"><span class="micro-label">€ / 1k envíos</span><div class="val">${fmtEUR2(n.revPerMille)}</div>${cmp(n.revPerMille,avgRPM)}</div>
                <div class="stat-card"><span class="micro-label">Open rate</span><div class="val">${fmtPct(n.openRate)}</div>${cmp(n.openRate,avgOpen)}</div>
                <div class="stat-card"><span class="micro-label">Click-to-open</span><div class="val">${fmtPct(n.cto)}</div>${cmp(n.cto,avgCTO)}</div>
            </div>
            <div class="chart-card" style="margin-bottom:0">
                <div class="chart-title">Embudo del envío</div>
                <div class="chart-body"><canvas id="nl-funnel-chart"></canvas></div>
            </div>
        </div>
        <div>
            <div class="side-card">
                <h3>Embudo</h3>
                <div class="kv-row"><span>Enviados</span><span>${fmtNum(n.recipients)}</span></div>
                <div class="kv-row"><span>Aperturas</span><span>${fmtNum(n.opens)}</span></div>
                <div class="kv-row"><span>Clics</span><span>${fmtNum(n.clicks)}</span></div>
                <div class="kv-row"><span>Clics únicos</span><span>${fmtNum(n.uniqueClicks)}</span></div>
                <div class="kv-row"><span>Tickets</span><span>${n.tickets}</span></div>
                <div class="kv-row"><span>Attribution rate</span><span>${fmtPct(n.attribution)}</span></div>
                <div class="kv-row"><span>€ por apertura</span><span>${fmtEUR2(n.revPerOpen)}</span></div>
            </div>
            <div class="side-card">
                <h3>Desglose del índice</h3>
                ${n.scoreParts.map(p=>`<div class="score-bar-row"><div class="sb-head"><span>${p.label} · peso ${p.w}%</span><span>P${Math.round(p.p)}</span></div><div class="sb-track"><div class="sb-fill" style="width:${p.p}%"></div></div></div>`).join('')}
                <p style="font-size:.72rem;color:var(--text-3);margin-top:12px;line-height:1.5">Percentil frente al resto de envíos válidos. El índice pondera rentabilidad por volumen sobre todo lo demás.</p>
            </div>
            <div class="side-card">
                <h3>Lectura</h3>
                <p style="font-size:.8rem;color:var(--text-2);line-height:1.6">${nlReading(n,avgOpen,avgCTO,avgRPM,avgAtt)}</p>
            </div>
        </div>
    </div>`;
    charts.nlFunnel=new Chart(document.getElementById('nl-funnel-chart'),{type:'bar',
        data:{labels:['Enviados','Aperturas','Clics','Tickets'],datasets:[{data:[n.recipients,n.opens,n.clicks,n.tickets],backgroundColor:['rgba(230,51,63,.25)','rgba(230,51,63,.45)','rgba(230,51,63,.7)','rgba(70,167,88,.8)'],borderRadius:4,maxBarThickness:34}]},
        options:{indexAxis:'y',responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
            scales:{x:{type:'logarithmic',ticks:{color:chartColors().tick},grid:{color:chartColors().grid},border:{display:false}},y:{ticks:{color:chartColors().tick2},grid:{display:false}}}}});
}

function nlReading(n,avgOpen,avgCTO,avgRPM,avgAtt){
    const parts=[];
    if(n.openRate>=avgOpen*1.1)parts.push('El asunto funciona por encima de la media: su estructura y tono son replicables.');
    else if(n.openRate<avgOpen*0.9)parts.push('El open rate está por debajo de la media: el asunto o el momento de envío no conectaron con la base.');
    if(n.cto>=avgCTO*1.1)parts.push('Quien abre, hace clic: el contenido y el CTA están bien resueltos.');
    else if(n.cto<avgCTO*0.9)parts.push('Se abre pero no se hace clic: conviene revisar la jerarquía del contenido y la posición del CTA.');
    if(n.revPerMille>=avgRPM*1.3)parts.push('Rentabilidad muy superior a la media: candidato a reenvío sobre no-abridores.');
    if(n.tickets===0)parts.push('No generó tickets atribuidos: su valor es de notoriedad, no de conversión.');
    if(n.attribution>1)parts.push('Attribution rate mayor que 1: hay más tickets que clics únicos, probablemente por compras diferidas o multi-dispositivo; interpretar con cautela.');
    return parts.length?parts.join(' '):'Rendimiento en línea con la media de la base en todas las dimensiones.';
}

/* ================================================================
   MIS INFLUENCERS
   ================================================================ */
function handleSubTabClick(sub){
    [myInfluencersGridView,myInfluencerDetailView,myCampaignsGridView,myCampaignsDetailView].forEach(v=>v.classList.add('hidden'));
    subTabInfluencers.classList.remove('active');subTabCampaigns.classList.remove('active');
    if(sub==='influencers'){subTabInfluencers.classList.add('active');myInfluencersGridView.classList.remove('hidden');renderMyInfluencersGrid();}
    else{subTabCampaigns.classList.add('active');myCampaignsGridView.classList.remove('hidden');renderMyCampaignsGrid();}
}

function processMyInfluencersData(){
    const gI={},gC={};
    myInfluencersRawData.forEach(row=>{
        const id=row['ID influencer'],title=row['Título Contenido'];
        if(!id||!title)return;
        const imp=num(row['Impresiones']),lk=num(row['Likes']),cm=num(row['Comentarios']),rc=num(row['Cuentas Alcanzadas']),sh=num(row['Veces compartidas']),men=num(row['Hombres']),wom=num(row['Mujeres']);
        if(!gI[id])gI[id]={id,name:row['Influencer'],platform:row['Plataforma'],image:resolveImg((row['Imagen']||row['imageUrl']||'').trim()),sumImpressions:0,sumLikes:0,sumComments:0,sumReach:0,sumShares:0,men:0,women:0,count:0,contents:[]};
        gI[id].sumImpressions+=imp;gI[id].sumLikes+=lk;gI[id].sumComments+=cm;gI[id].sumReach+=rc;gI[id].sumShares+=sh;gI[id].men+=men;gI[id].women+=wom;gI[id].count++;gI[id].contents.push(row);
        if(!gC[title])gC[title]={title,image:null,totalImpressions:0,totalReach:0,totalLikes:0,totalComments:0,contents:[]};
        if(!gC[title].image){const ci=resolveImg((row['Imagen']||row['imageUrl']||row['Portada']||'').trim());if(ci)gC[title].image=ci;}
        gC[title].totalImpressions+=imp;gC[title].totalReach+=rc;gC[title].totalLikes+=lk;gC[title].totalComments+=cm;gC[title].contents.push(row);
    });
    processedMyInfluencers=Object.values(gI).map(i=>{
        const engagement=i.sumLikes+i.sumComments+i.sumShares;
        return {...i,avgImpressions:i.sumImpressions/i.count,avgLikes:i.sumLikes/i.count,avgComments:i.sumComments/i.count,avgReach:i.sumReach/i.count,avgMen:Math.round(i.men/i.count),avgWomen:Math.round(i.women/i.count),engagementRate:i.sumImpressions>0?engagement/i.sumImpressions*100:0};
    });
    processedMyCampaigns=Object.values(gC);
}

function influAvatar(i,size){
    if(i.image)return `<img src="${escAttr(i.image)}" class="influ-avatar" style="width:${size}px;height:${size}px" alt="" onerror="this.outerHTML='<div class=\\'influ-avatar\\' style=\\'width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-weight:700\\'>${(i.name||'?')[0].toUpperCase()}</div>'">`;
    return `<div class="influ-avatar" style="width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;font-weight:700">${(i.name||'?')[0].toUpperCase()}</div>`;
}

function renderMyInfluencersGrid(){
    myInfluencersGrid.innerHTML='';
    if(!processedMyInfluencers.length){myInfluencersGrid.innerHTML='<p class="text-secondary">No hay datos.</p>';return;}
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
        const erCls=i.engagementRate>5?'good':(i.engagementRate>2?'neutral':'bad');
        const card=document.createElement('div');card.className='influ-card';
        card.innerHTML=`
        <div class="influ-card-head">
            ${influAvatar(i,52)}
            <div><h3>${i.name}</h3><span class="platform-tag">${i.platform}</span></div>
            <span class="count-chip">${i.count} contenido${i.count>1?'s':''}</span>
        </div>
        <div class="influ-stats">
            <div class="influ-stat"><div class="l">Impr. medias</div><div class="v">${fmtK(i.avgImpressions)}</div></div>
            <div class="influ-stat"><div class="l">Alcance medio</div><div class="v">${fmtK(i.avgReach)}</div></div>
            <div class="influ-stat"><div class="l">Likes medios</div><div class="v">${fmtK(i.avgLikes)}</div></div>
            <div class="influ-stat"><div class="l">Engagement</div><div class="v ${erCls}">${i.engagementRate.toFixed(1).replace('.',',')}%</div></div>
        </div>
        <div style="margin-top:14px">
            <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--text-3)"><span>H ${i.avgMen}%</span><span>M ${i.avgWomen}%</span></div>
            <div class="demo-bar"><div class="demo-fill" style="width:${i.avgMen}%;background:var(--blue)"></div><div class="demo-fill" style="width:${i.avgWomen}%;background:#c65b8f"></div></div>
        </div>`;
        card.onclick=()=>showMyInfluencerDetail(i.id);
        myInfluencersGrid.appendChild(card);
    });
}

function showMyInfluencerDetail(id){
    const i=processedMyInfluencers.find(x=>x.id==id);if(!i)return;
    myInfluencersView.classList.remove('hidden');
    [myInfluencersGridView,myCampaignsGridView,myCampaignsDetailView].forEach(v=>v.classList.add('hidden'));
    myInfluencerDetailView.classList.remove('hidden');
    myInfluencerDetailView.innerHTML=`
    <div class="detail-head"><button class="btn" onclick="handleSubTabClick('influencers')">← Volver a influencers</button></div>
    <div class="detail-head">
        <div style="display:flex;gap:18px;align-items:center">
            ${influAvatar(i,72)}
            <div class="title-block">
                <h2>${i.name}</h2>
                <p>${i.platform} · ${i.count} contenidos publicados · Engagement ${i.engagementRate.toFixed(1).replace('.',',')}%</p>
            </div>
        </div>
    </div>
    <div class="kpi-strip" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi-cell"><span class="micro-label">Impr. medias</span><div class="val">${fmtK(i.avgImpressions)}</div></div>
        <div class="kpi-cell"><span class="micro-label">Alcance medio</span><div class="val">${fmtK(i.avgReach)}</div></div>
        <div class="kpi-cell"><span class="micro-label">Likes medios</span><div class="val">${fmtK(i.avgLikes)}</div></div>
        <div class="kpi-cell"><span class="micro-label">Comentarios medios</span><div class="val">${fmtK(i.avgComments)}</div></div>
    </div>
    <div class="table-card"><div class="table-scroll"><table class="data-table">
        <thead><tr><th>Contenido</th><th class="th-left">Plataforma</th><th>Impresiones</th><th>Alcance</th><th>Likes</th><th>Comentarios</th><th>Compartidos</th></tr></thead>
        <tbody>${i.contents.map(c=>`<tr><td>${c['Título Contenido']}</td><td class="td-left"><span class="platform-tag" style="margin:0">${c['Plataforma']}</span></td><td>${fmtNum(num(c['Impresiones']))}</td><td>${fmtNum(num(c['Cuentas Alcanzadas']))}</td><td>${fmtNum(num(c['Likes']))}</td><td>${fmtNum(num(c['Comentarios']))}</td><td>${fmtNum(num(c['Veces compartidas']))}</td></tr>`).join('')}</tbody>
    </table></div></div>`;
}

function renderMyCampaignsGrid(){
    myCampaignsGrid.innerHTML='';
    if(!processedMyCampaigns.length){myCampaignsGrid.innerHTML='<p class="text-secondary">No hay datos.</p>';return;}
    processedMyCampaigns.forEach(camp=>{
        const card=document.createElement('div');card.className='influ-card influ-card--media';
        const media=camp.image
            ? `<div class="card-media" style="background-image:url('${escAttr(camp.image)}')"></div>`
            : `<div class="card-media card-media--empty">${(camp.title||'?')[0]}</div>`;
        card.innerHTML=`
        ${media}
        <div class="influ-card-inner">
        <div class="influ-card-head" style="margin-bottom:12px">
            <div><h3>${camp.title}</h3><span class="platform-tag">${camp.contents.length} contenidos</span></div>
        </div>
        <div class="influ-stats">
            <div class="influ-stat"><div class="l">Impresiones</div><div class="v">${fmtK(camp.totalImpressions)}</div></div>
            <div class="influ-stat"><div class="l">Alcance</div><div class="v">${fmtK(camp.totalReach)}</div></div>
            <div class="influ-stat"><div class="l">Likes</div><div class="v">${fmtK(camp.totalLikes)}</div></div>
            <div class="influ-stat"><div class="l">Comentarios</div><div class="v">${fmtK(camp.totalComments)}</div></div>
        </div>
        </div>`;
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
    myCampaignsDetailView.innerHTML=`
    <div class="detail-head">
        <div style="display:flex;gap:12px;align-items:center">
            <button class="btn" id="back-to-camp-grid">← Volver</button>
            <div class="title-block"><h2 style="font-size:1.2rem">${camp.title}</h2></div>
        </div>
        <div class="control-row">
            <label>Ordenar por</label>
            <select id="campaign-detail-sort" style="width:170px">
                <option value="likes" ${sortBy==='likes'?'selected':''}>Likes</option>
                <option value="impressions" ${sortBy==='impressions'?'selected':''}>Impresiones</option>
            </select>
        </div>
    </div>
    <div class="kpi-strip" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi-cell"><span class="micro-label">Impresiones</span><div class="val">${fmtK(camp.totalImpressions)}</div></div>
        <div class="kpi-cell"><span class="micro-label">Alcance</span><div class="val">${fmtK(camp.totalReach)}</div></div>
        <div class="kpi-cell"><span class="micro-label">Likes</span><div class="val">${fmtK(camp.totalLikes)}</div></div>
        <div class="kpi-cell"><span class="micro-label">Influencers</span><div class="val">${camp.contents.length}</div></div>
    </div>
    <div class="table-card"><div class="table-scroll"><table class="data-table">
        <thead><tr><th>Influencer</th><th class="th-left">Plataforma</th><th>Impresiones</th><th>Likes</th><th>Comentarios</th><th></th></tr></thead>
        <tbody>${cs.map(c=>`<tr><td style="font-weight:600">${c['Influencer']}</td><td class="td-left"><span class="platform-tag" style="margin:0">${c['Plataforma']}</span></td><td>${fmtNum(num(c['Impresiones']))}</td><td>${fmtNum(num(c['Likes']))}</td><td>${fmtNum(num(c['Comentarios']))}</td><td style="text-align:right"><button class="btn" style="padding:4px 10px;font-size:.75rem" onclick="showMyInfluencerDetail('${c['ID influencer']}')">Ver ficha</button></td></tr>`).join('')}</tbody>
    </table></div></div>`;
    document.getElementById('back-to-camp-grid').onclick=()=>handleSubTabClick('campaigns');
    document.getElementById('campaign-detail-sort').onchange=e=>renderMyCampaignDetail(title,e.target.value);
}

/* ================================================================
   EXPLORAR
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
    },200);
}
function displayInfluencerResults(){
    resultsContainer.innerHTML='';
    if(!filteredInfluencers.length){resultsContainer.innerHTML='<p class="text-secondary">No se encontraron influencers con esos filtros.</p>';return;}
    filteredInfluencers.forEach(i=>{
        const raw=((i.likesAvg||0)+(i.commentsAvg||0)*1.5)/(i.followers||1)*100;
        const impact=Math.min(100,raw);
        const erCls=impact>5?'good':(impact>2?'neutral':'bad');
        const av=resolveImg((i.image||i.imageUrl||i.avatar||'').trim());
        const avatarHTML=av
            ? `<img src="${escAttr(av)}" class="influ-avatar" alt="" onerror="this.outerHTML='<div class=\\'influ-avatar\\' style=\\'display:flex;align-items:center;justify-content:center;font-weight:700\\'>${(i.name||'?')[0].toUpperCase()}</div>'">`
            : `<div class="influ-avatar" style="display:flex;align-items:center;justify-content:center;font-weight:700">${(i.name||'?')[0].toUpperCase()}</div>`;
        const card=document.createElement('div');card.className='influ-card';
        card.innerHTML=`
        <div class="influ-card-head" style="margin-bottom:12px">
            ${avatarHTML}
            <div><h3>${i.name}</h3><span class="platform-tag">${i.platform}</span></div>
        </div>
        <div class="influ-stats">
            <div class="influ-stat"><div class="l">Seguidores</div><div class="v">${fmtK(i.followers)}</div></div>
            <div class="influ-stat"><div class="l">Likes medios</div><div class="v">${fmtK(i.likesAvg)}</div></div>
            <div class="influ-stat"><div class="l">Comentarios</div><div class="v">${fmtK(i.commentsAvg)}</div></div>
            <div class="influ-stat"><div class="l">Engagement</div><div class="v ${erCls}">${impact.toFixed(2).replace('.',',')}%</div></div>
        </div>`;
        card.addEventListener('click',()=>displayInfluencerDetail(i));
        resultsContainer.appendChild(card);
    });
}
function displayInfluencerDetail(i){
    destroyCharts();resultsContainer.classList.add('hidden');detailContainer.classList.remove('hidden');
    const n=(typeof i.niche==='string')?i.niche.split('|').map(s=>s.trim()).filter(Boolean):[];
    detailContainer.innerHTML=`
    <div class="detail-head"><button class="btn" id="back-explore-btn">← Volver a resultados</button></div>
    <div class="detail-head">
        <div style="display:flex;gap:18px;align-items:center">
            <div class="influ-avatar" style="width:72px;height:72px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.4rem">${(i.name||'?')[0].toUpperCase()}</div>
            <div class="title-block"><h2>${i.name}</h2><p>${i.platform}</p></div>
        </div>
    </div>
    <div style="margin-bottom:20px">${n.map(t=>`<span class="platform-tag" style="margin-right:6px">${t}</span>`).join('')}</div>
    <div class="chart-card"><div class="chart-title">Métricas (escala logarítmica)</div><div class="chart-body"><canvas id="influencer-chart"></canvas></div></div>`;
    document.getElementById('back-explore-btn').onclick=()=>{detailContainer.classList.add('hidden');resultsContainer.classList.remove('hidden');};
    charts.influencer=new Chart(document.getElementById('influencer-chart'),{type:'bar',
        data:{labels:['Seguidores','Likes medios','Comentarios medios'],datasets:[{data:[i.followers,i.likesAvg,i.commentsAvg],backgroundColor:['rgba(230,51,63,.7)','rgba(91,141,239,.7)','rgba(70,167,88,.7)'],borderRadius:4,maxBarThickness:44}]},
        options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
            scales:{y:{type:'logarithmic',ticks:{color:chartColors().tick},grid:{color:chartColors().grid},border:{display:false}},x:{ticks:{color:chartColors().tick2},grid:{display:false}}}}});
}

/* ================================================================
   NAVEGACIÓN E INIT
   ================================================================ */
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

document.addEventListener('DOMContentLoaded',()=>{
    initTheme();
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

/* ================================================================
   TEMA (claro / oscuro)
   ================================================================ */
function applyTheme(mode){
    const root=document.documentElement;
    root.setAttribute('data-theme',mode);
    try{localStorage.setItem('caza-theme',mode);}catch(e){}
    const btn=document.getElementById('theme-toggle');
    if(btn){
        const dark=mode==='dark';
        btn.setAttribute('aria-label',dark?'Cambiar a modo claro':'Cambiar a modo oscuro');
        btn.querySelector('.tt-icon').textContent=dark?'☀':'☾';
        btn.querySelector('.tt-label').textContent=dark?'Claro':'Oscuro';
    }
    // Reactualiza colores de los gráficos activos según el tema
    refreshActiveView();
}
function initTheme(){
    let saved='dark';
    try{saved=localStorage.getItem('caza-theme')||(window.matchMedia&&window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');}catch(e){}
    const btn=document.getElementById('theme-toggle');
    if(btn)btn.addEventListener('click',()=>{
        const cur=document.documentElement.getAttribute('data-theme')||'dark';
        applyTheme(cur==='dark'?'light':'dark');
    });
    applyTheme(saved);
}
/* Color de rejilla/ejes de Chart.js según tema (lee variables CSS vivas) */
function chartColors(){
    const cs=getComputedStyle(document.documentElement);
    return {
        grid:cs.getPropertyValue('--chart-grid').trim()||'#1e222a',
        tick:cs.getPropertyValue('--chart-tick').trim()||'#5f6672',
        tick2:cs.getPropertyValue('--text-2').trim()||'#9aa1ad'
    };
}
/* Vuelve a pintar la vista activa (para que los gráficos tomen el color del tema) */
function refreshActiveView(){
    const active=document.querySelector('.tab.active');
    if(!active)return;
    const t=active.dataset.tab;
    if(t==='campanas'&&!campaignOverviewView.classList.contains('hidden'))renderCampaignOverview();
    else if(t==='newsletters'&&!nlOverviewView.classList.contains('hidden'))renderNewsletterOverview();
}
