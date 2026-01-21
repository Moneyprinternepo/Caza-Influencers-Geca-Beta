let influencersData = [], campaignsData = [], myInfluencersRawData = [];
let processedMyInfluencers = []; 
let processedMyCampaigns = [];
let charts = {};

// Referencias DOM
const mainContent = document.getElementById('mainContent');
const loader = document.getElementById('loader');
const tabs = document.querySelectorAll('.tab');

// Views
const exploreView = document.getElementById('explore-view');
const campaignView = document.getElementById('campaign-view');
const myInfluencersView = document.getElementById('my-influencers-view');

// Campaign Sub-views
const campaignOverviewView = document.getElementById('campaign-overview-view');
const campaignDetailView = document.getElementById('campaign-detail-view');
const campaignOverviewContent = document.getElementById('campaign-overview-content');
const campaignSortFilter = document.getElementById('campaign-sort-filter');

// My Influencers Sub-views & Elements
const subTabInfluencers = document.getElementById('sub-tab-influencers');
const subTabCampaigns = document.getElementById('sub-tab-campaigns');

const myInfluencersGridView = document.getElementById('my-influencers-grid-view');
const myInfluencerDetailView = document.getElementById('my-influencer-detail-view');
const myCampaignsGridView = document.getElementById('my-campaigns-grid-view');
const myCampaignsDetailView = document.getElementById('my-campaigns-detail-view');

const myInfluencersSort = document.getElementById('my-influencers-sort');
const myInfluencersGrid = document.getElementById('my-influencers-grid');
const myCampaignsGrid = document.getElementById('my-campaigns-grid');

// Explore Inputs
const searchBtn = document.getElementById('search-btn');
const resultsContainer = document.getElementById('results-container');
const detailContainer = document.getElementById('detail-container');

// 1. CARGA DE DATOS
function loadData() {
    loader.classList.remove('hidden'); 
    const noCache = `?t=${new Date().getTime()}`;
    
    const p1 = new Promise((resolve, reject) => { 
        Papa.parse(`data/influencers.csv${noCache}`, { download: true, header: true, dynamicTyping: true, skipEmptyLines: true, delimiter: ",", complete: ({ data }) => { influencersData = data; resolve(); }, error: err => reject(err) }); 
    });
    
    const p2 = new Promise((resolve, reject) => {
            Papa.parse(`data/campaigns.csv${noCache}`, { download: true, header: true, dynamicTyping: true, skipEmptyLines: true, delimiter: ",", complete: ({ data }) => {
                campaignsData = data.filter(r => r.Id != null).map(c => {
                    const budget = c.Spent||0;
                    const clicks = c['Link Clicks']||0;
                    const tickets = c['Tickets Sold']||0;
                    const impressions = c.Views||0;
                    const reach = c.Reach||0;
                    const ctr = c['Click Rate']||0;
                    const imageFile = c.imageFile || null;
                    const imageUrl = imageFile ? `images/${imageFile}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(c.Name)}&background=1f1f1f&color=fff&size=128`;
                    
                    let score = (tickets * 100) + (clicks * 2) + (ctr * 50) + (impressions * 0.01);
                    
                    const cpcCalc = clicks > 0 ? (budget/clicks) : 0;
                    if(clicks > 0 && cpcCalc < 0.5) score += 100;

                    return { 
                        id:c.Id, name:c.Name, type:c.Type, budget, 
                        impressions: impressions, reach: reach, clicks, 
                        interactions:c.Interactions||0, retention:c['Retention Rate']||0, 
                        clickRate: ctr, ticketsSold: tickets, 
                        views3s:c['3s Views']||0, imageUrl, 
                        daysActive: c['Days Active']||0, spentPerDay: c['Spent Per Day']||0, 
                        frequency: c.Frequency||0, reactions: c.Reactions||0, 
                        goal: c.Goal||'N/A', range: c.Range||'N/A', 
                        description: `Campaña orientada a ${c.Goal} en ${c.Range}`,
                        cpc: cpcCalc, 
                        cpa: tickets>0 ? (budget/tickets) : 0, 
                        cpm: impressions>0 ? (budget/impressions)*1000 : 0,
                        score: score
                    };
                }); resolve();
            }, error: err => reject(err) });
    });

    const p3 = new Promise((resolve, reject) => {
            Papa.parse(`data/misinflus.csv${noCache}`, { download: true, header: true, dynamicTyping: true, skipEmptyLines: true, delimiter: ",", complete: ({ data }) => {
                myInfluencersRawData = data; resolve();
            }, error: err => reject(err) });
    });

    Promise.all([p1, p2, p3]).then(() => { 
        processMyInfluencersData();
        initApp(); 
    }).catch(error => { 
        console.error(error);
        loader.classList.add('hidden'); 
        alert("Error cargando datos. Revisa la consola.");
    });
}

function initApp() { 
    loader.classList.add('hidden'); 
    mainContent.classList.remove('hidden'); 
    searchBtn.removeAttribute('disabled'); 
    document.querySelector('.tab[data-tab="campanas"]').click();
}

// 2. NAVEGACIÓN
function handleTabClick(e) { 
    tabs.forEach(t => t.classList.remove('active')); 
    e.target.classList.add('active'); 
    
    exploreView.classList.add('hidden'); 
    campaignView.classList.add('hidden'); 
    myInfluencersView.classList.add('hidden');

    const tabName = e.target.dataset.tab;

    if (tabName === 'explorar') { 
        exploreView.classList.remove('hidden'); 
        populateTagFilters(); 
        filterInfluencersData(); 
    } else if (tabName === 'campanas') { 
        campaignView.classList.remove('hidden'); 
        showCampaignView('overview'); 
    } else if (tabName === 'mis-influencers') {
        myInfluencersView.classList.remove('hidden');
        handleSubTabClick('influencers');
    }
}

function handleSubTabClick(subTab) {
    myInfluencersGridView.classList.add('hidden');
    myInfluencerDetailView.classList.add('hidden');
    myCampaignsGridView.classList.add('hidden');
    myCampaignsDetailView.classList.add('hidden');

    subTabInfluencers.classList.remove('active');
    subTabCampaigns.classList.remove('active');

    if (subTab === 'influencers') {
        subTabInfluencers.classList.add('active');
        myInfluencersGridView.classList.remove('hidden');
        renderMyInfluencersGrid();
    } else {
        subTabCampaigns.classList.add('active');
        myCampaignsGridView.classList.remove('hidden');
        renderMyCampaignsGrid();
    }
}

function showCampaignView(viewName, params = {}) { 
    campaignOverviewView.classList.add('hidden'); 
    campaignDetailView.classList.add('hidden'); 
    if (viewName === 'overview') { 
        renderCampaignOverview(); 
        campaignOverviewView.classList.remove('hidden'); 
    } else { 
        renderCampaignDetail(params.id); 
        campaignDetailView.classList.remove('hidden'); 
    } 
}

function destroyCharts() { for (const chartId in charts) { if (charts[chartId]) { charts[chartId].destroy(); delete charts[chartId]; } } }

// 3. LOGICA CAMPAÑAS (GLOBALES)
function renderCampaignOverview() {
    if (campaignsData.length === 0) return;
    
    const count = campaignsData.length;
    const totalSpent = campaignsData.reduce((acc, c) => acc + c.budget, 0);
    const totalClicks = campaignsData.reduce((acc, c) => acc + c.clicks, 0);
    const avgCTR = campaignsData.reduce((acc, c) => acc + c.clickRate, 0) / count;
    const avgReach = campaignsData.reduce((acc, c) => acc + c.reach, 0) / count;
    const avgRetention = campaignsData.reduce((acc, c) => acc + c.retention, 0) / count;
    const avgFrequency = campaignsData.reduce((acc, c) => acc + c.frequency, 0) / count;

    document.getElementById('global-spent').innerText = totalSpent.toLocaleString('es-ES', {style:'currency', currency:'EUR'});
    document.getElementById('global-ctr').innerText = avgCTR.toFixed(2) + '%';
    document.getElementById('global-reach').innerText = Math.round(avgReach).toLocaleString();
    document.getElementById('global-clicks').innerText = totalClicks.toLocaleString();
    document.getElementById('global-retention').innerText = avgRetention.toFixed(2) + '%';
    document.getElementById('global-frequency').innerText = avgFrequency.toFixed(2);

    const sortKey = campaignSortFilter.value;
    const chronologicalData = [...campaignsData].sort((a,b) => a.id - b.id);
    const kpiLabels = {'score':'Puntuación','ticketsSold':'Tickets','impressions':'Impresiones','clickRate':'CTR (%)','reach':'Alcance','budget':'Inversión (€)','cpc':'CPC (€)','cpm':'CPM (€)','frequency':'Frecuencia'};

    destroyCharts();
    const ctxGlobal = document.getElementById('all-campaigns-chart').getContext('2d');
    charts['global'] = new Chart(ctxGlobal, {
        type: 'line',
        data: {
            labels: chronologicalData.map(c => c.name),
            datasets: [{ 
                label: kpiLabels[sortKey] || sortKey, 
                data: chronologicalData.map(c => c[sortKey]), 
                borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.2)',
                borderWidth: 3, pointBackgroundColor: '#fff', tension: 0.3, fill: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            scales: { x: { ticks: {color: '#aaa'} }, y: { ticks: {color: '#aaa'}, grid: {color: '#333'} } },
            plugins: { legend: {labels:{color:'#fff'}} }
        }
    });

    let sortedData = [...campaignsData];
    if (sortKey === 'cpc' || sortKey === 'cpm' || sortKey === 'budget') {
        sortedData.sort((a,b) => (b[sortKey] || 0) - (a[sortKey] || 0));
    } else {
            sortedData.sort((a,b) => (b[sortKey] || 0) - (a[sortKey] || 0));
    }

    const podium = sortedData.slice(0, 3);
    const rest = sortedData.slice(3);
    const getMetricDisplay = (c, key) => { 
        if (key === 'ticketsSold') return c.ticketsSold + ' Tickets';
        if (key === 'score') return c.score.toFixed(0) + ' Pts';
        if (key === 'reach') return (c.reach/1000).toFixed(1) + 'k Alcance';
        if (key === 'clickRate') return c.clickRate.toFixed(2) + '% CTR';
        if (key === 'budget') return c.budget.toFixed(0) + '€ Inv.';
        if (key === 'cpc') return c.cpc.toFixed(2) + '€ CPC';
        if (key === 'cpm') return c.cpm.toFixed(2) + '€ CPM';
        if (key === 'impressions') return (c.impressions/1000).toFixed(0) + 'k Impr.';
        if (key === 'frequency') return c.frequency.toFixed(2) + ' Freq';
        return c[key]; 
    };

    const podiumHTML = `<div class="podium-container">${podium.map((c, i) => `
        <div class="podium-item podium-item--${i+1}" data-id="${c.id}" style="background-image: url('${c.imageUrl}');">
            <div class="podium-rank">${i+1}</div>
            <div class="podium-name">${c.name}</div>
            <div class="podium-metric">${getMetricDisplay(c, sortKey)}</div>
        </div>`).join('')}</div>`;

    const listHTML = rest.length > 0 ? `<div class="campaign-list-container">
        <h3>Resto de campañas</h3>
        ${rest.map(c => `<div class="campaign-list-item" data-id="${c.id}"><img src="${c.imageUrl}" alt="${c.name}" class="campaign-list-thumbnail"><div class="info"><h4>${c.name}</h4><p class="text-secondary">${c.type} • ${c.goal}</p></div><div class="metric-group"><div class="metric-col"><span class="metric-val">${c.ticketsSold}</span><span class="metric-lbl">Tickets</span></div><div class="metric-col"><span class="metric-val">${c.clicks}</span><span class="metric-lbl">Clics</span></div><div class="metric-col"><span class="metric-val">${c[sortKey] !== undefined && typeof c[sortKey] === 'number' ? c[sortKey].toLocaleString(undefined, {maximumFractionDigits:2}) : ''}</span><span class="metric-lbl">${kpiLabels[sortKey] || 'Valor'}</span></div></div></div>`).join('')}</div>` : '';

    campaignOverviewContent.innerHTML = podiumHTML + listHTML;
    document.querySelectorAll('.podium-item, .campaign-list-item').forEach(el => { el.onclick = () => showCampaignView('detail', { id: el.dataset.id }); });
}

function renderCampaignDetail(id) {
    destroyCharts();
    const c = campaignsData.find(c => c.id == id);
    if (!c) return;
    const isGoodCPA = c.cpa < 2.0; const cpaClass = isGoodCPA ? 'good' : (c.cpa < 5 ? 'neutral' : 'bad'); const statusText = isGoodCPA ? 'Éxito' : 'Revisar'; const statusClass = isGoodCPA ? '' : 'bad';
    campaignDetailView.innerHTML = `<div class="campaign-detail-container"><div class="campaign-header"><button class="btn btn-secondary" onclick="showCampaignView('overview')">← Volver al Ranking</button></div><div class="campaign-detail-hero" style="background-image: url('${c.imageUrl}');"><div class="campaign-hero-content"><div class="campaign-hero-title"><h2>${c.name}</h2><p>${c.description}</p></div><div class="campaign-status-badge ${statusClass}">Estado: ${statusText}</div></div></div><div class="campaign-detail-main-grid"><div class="charts-section"><div class="kpi-grid"><div class="kpi-card-small"><div class="kpi-title"><span class="icon">🎟️</span>Tickets Vendidos</div><div class="kpi-value">${c.ticketsSold}</div><div class="kpi-eval good">Conversión Final</div></div><div class="kpi-card-small"><div class="kpi-title"><span class="icon">💸</span>Coste por Ticket (CPA)</div><div class="kpi-value">${c.cpa.toFixed(2)}€</div><div class="kpi-eval ${cpaClass}">${cpaClass === 'good' ? 'Eficiente' : 'Alto coste'}</div></div><div class="kpi-card-small"><div class="kpi-title"><span class="icon">🖱️</span>Clicks Totales</div><div class="kpi-value">${c.clicks.toLocaleString()}</div><div class="kpi-eval neutral">CTR: ${c.clickRate.toFixed(2)}%</div></div><div class="kpi-card-small"><div class="kpi-title"><span class="icon">👁️</span>Visualizaciones</div><div class="kpi-value">${c.impressions.toLocaleString()}</div><div class="kpi-eval">Alcance: ${c.reach.toLocaleString()}</div></div></div><div class="chart-wrapper"><canvas id="funnel-chart"></canvas></div></div><div class="sidebar-section"><div class="kpi-card-small" style="margin-bottom:20px"><div class="kpi-title">Inversión Total</div><div class="kpi-value" style="color:var(--primary)">${c.budget.toLocaleString('es-ES',{style:'currency',currency:'EUR'})}</div><div class="text-secondary" style="font-size:0.8rem;margin-top:5px">${c.daysActive} días activos (${c.spentPerDay.toFixed(2)}€/día)</div></div><h3 style="color:var(--text);margin-bottom:15px;border-bottom:1px solid #333;padding-bottom:5px">Engagement</h3><div class="kpi-grid" style="grid-template-columns:1fr;"><div class="kpi-card-small"><div class="stat-row"><span>Reacciones</span> <span>${c.reactions}</span></div><div class="stat-row" style="margin-top:10px"><span>Comentarios</span> <span>${c.interactions - c.reactions}</span></div><div class="stat-row" style="margin-top:10px"><span>Retención</span> <span>${c.retention}%</span></div></div></div><h3 style="color:var(--text);margin-top:20px;margin-bottom:15px;border-bottom:1px solid #333;padding-bottom:5px">Segmentación</h3><div style="background:var(--bg-input);padding:15px;border-radius:10px;"><p style="margin-bottom:5px"><strong>Objetivo:</strong> ${c.goal}</p><p><strong>Rango:</strong> ${c.range}</p></div></div></div></div>`;
    const ctxFunnel = document.getElementById('funnel-chart').getContext('2d');
    charts['funnel'] = new Chart(ctxFunnel, {type: 'bar', data: {labels: ['Impresiones', 'Alcance', 'Clics', 'Tickets'],datasets: [{label: 'Conversión',data: [c.impressions, c.reach, c.clicks, c.ticketsSold],backgroundColor: ['#7f1d1d', '#b91c1c', '#ef4444', '#22c55e']}]}, options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: {display:false}, title: {display:true, text:'Embudo de Conversión', color:'#aaa'} }, scales: { x: {ticks:{color:'#aaa'}}, y: {ticks:{color:'#fff'}} }}});
}

// 4. LOGICA MIS INFLUENCERS & CAMPAÑAS DE INFLUENCERS
function processMyInfluencersData() {
    // --- Agrupación 1: Por Influencer ---
    const groupedInflu = {};
    // --- Agrupación 2: Por Campaña (Título Contenido) ---
    const groupedCampaign = {};

    myInfluencersRawData.forEach(row => {
        const id = row['ID influencer'];
        const title = row['Título Contenido'];
        
        if (!id || !title) return;

        // Procesar Influencer
        if (!groupedInflu[id]) {
            groupedInflu[id] = {
                id: id,
                name: row['Influencer'],
                platform: row['Plataforma'], 
                image: row['Imagen'],
                sumImpressions: 0, sumLikes: 0, sumComments: 0, sumReach: 0, sumShares: 0,
                men: 0, women: 0,
                count: 0,
                contents: [] 
            };
        }
        groupedInflu[id].sumImpressions += (row['Impresiones'] || 0);
        groupedInflu[id].sumLikes += (row['Likes'] || 0);
        groupedInflu[id].sumComments += (row['Comentarios'] || 0);
        groupedInflu[id].sumReach += (row['Cuentas Alcanzadas'] || 0);
        groupedInflu[id].sumShares += (row['Veces compartidas'] || 0);
        groupedInflu[id].men += (row['Hombres'] || 0);
        groupedInflu[id].women += (row['Mujeres'] || 0);
        groupedInflu[id].count++;
        groupedInflu[id].contents.push(row);

        // Procesar Campaña
        if (!groupedCampaign[title]) {
            groupedCampaign[title] = {
                title: title,
                totalImpressions: 0,
                totalReach: 0,
                totalLikes: 0,
                totalComments: 0,
                contents: []
            };
        }
        groupedCampaign[title].totalImpressions += (row['Impresiones'] || 0);
        groupedCampaign[title].totalReach += (row['Cuentas Alcanzadas'] || 0);
        groupedCampaign[title].totalLikes += (row['Likes'] || 0);
        groupedCampaign[title].totalComments += (row['Comentarios'] || 0);
        groupedCampaign[title].contents.push(row);
    });

    // Convertir objeto Influencers a array y calcular promedios
    processedMyInfluencers = Object.values(groupedInflu).map(influ => {
        return {
            ...influ,
            avgImpressions: influ.sumImpressions / influ.count,
            avgLikes: influ.sumLikes / influ.count,
            avgComments: influ.sumComments / influ.count,
            avgReach: influ.sumReach / influ.count,
            avgMen: Math.round(influ.men / influ.count),
            avgWomen: Math.round(influ.women / influ.count)
        };
    });

    // Convertir objeto Campañas a array
    processedMyCampaigns = Object.values(groupedCampaign);
}

// --- RENDERIZADO SUB-PESTAÑA: INFLUENCERS ---
function renderMyInfluencersGrid() {
    myInfluencersGrid.innerHTML = '';
    if (processedMyInfluencers.length === 0) { myInfluencersGrid.innerHTML = '<p>No hay datos.</p>'; return; }

    // Ordenar
    const sortKey = myInfluencersSort.value;
    const sortedList = [...processedMyInfluencers].sort((a,b) => {
        if (sortKey === 'name') return a.name.localeCompare(b.name);
        if (sortKey === 'count') return b.count - a.count;
        if (sortKey === 'engagement') return (b.avgLikes+b.avgComments) - (a.avgLikes+a.avgComments);
        // Mapeo para promedios
        if (sortKey === 'impressions') return b.avgImpressions - a.avgImpressions;
        if (sortKey === 'reach') return b.avgReach - a.avgReach;
        return 0;
    });

    sortedList.forEach(influ => {
        const imageUrl = influ.image ? `images/${influ.image}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(influ.name)}&background=random`;

        const card = document.createElement('div');
        card.className = 'my-influencer-card';
        card.innerHTML = `
            <div class="my-influencer-header" style="position:relative">
                <img src="${imageUrl}" class="my-influencer-avatar" alt="${influ.name}">
                <div>
                    <h3 style="margin:0">${influ.name}</h3>
                    <span class="tag" style="background:#333;padding:2px 8px;border-radius:4px;font-size:0.8rem">${influ.platform}</span>
                </div>
                <div class="content-badge">${influ.count} Contenidos</div>
            </div>
            <div class="my-influencer-stats">
                <div class="stat-row"><span>Prom. Impr</span> <span>${Math.round(influ.avgImpressions).toLocaleString()}</span></div>
                <div class="stat-row"><span>Prom. Alcance</span> <span>${Math.round(influ.avgReach).toLocaleString()}</span></div>
                <div class="stat-row"><span>Prom. Likes</span> <span>${Math.round(influ.avgLikes).toLocaleString()}</span></div>
                <div class="stat-row"><span>Prom. Comm</span> <span>${Math.round(influ.avgComments).toLocaleString()}</span></div>
            </div>
            <div style="padding: 0 20px 20px 20px;">
                <p style="font-size:0.8rem;color:#aaa;margin-bottom:5px">Audiencia Media: Hombres ${influ.avgMen}% / Mujeres ${influ.avgWomen}%</p>
                <div class="demographics-bar">
                    <div class="demographics-fill" style="width:${influ.avgMen}%;background:#3b82f6"></div>
                    <div class="demographics-fill" style="width:${influ.avgWomen}%;background:#ec4899"></div>
                </div>
            </div>
        `;
        // Click evento para ir al detalle
        card.onclick = () => showMyInfluencerDetail(influ.id);
        myInfluencersGrid.appendChild(card);
    });
}

function showMyInfluencerDetail(id) {
    const influ = processedMyInfluencers.find(i => i.id == id);
    if (!influ) return;
    
    myInfluencersGridView.classList.add('hidden');
    myInfluencerDetailView.classList.remove('hidden');

    const imageUrl = influ.image ? `images/${influ.image}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(influ.name)}&background=random`;
    
    myInfluencerDetailView.innerHTML = `
        <div class="campaign-header">
            <button class="btn btn-secondary" onclick="handleSubTabClick('influencers')">← Volver a Influencers</button>
        </div>
        <div style="display:flex; gap:20px; align-items:center; background:var(--bg-card); padding:20px; border-radius:10px; border:1px solid var(--border); margin-bottom:20px">
            <img src="${imageUrl}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid var(--primary)">
            <div>
                <h2 style="font-size:2rem; margin:0">${influ.name}</h2>
                <p class="text-secondary">${influ.platform} • ${influ.count} Contenidos Publicados</p>
                <div style="display:flex; gap:15px; margin-top:10px">
                    <span class="tag" style="background:#333; padding:5px 10px; border-radius:5px">👁️ ${Math.round(influ.avgImpressions).toLocaleString()} Prom. Impresiones</span>
                    <span class="tag" style="background:#333; padding:5px 10px; border-radius:5px">❤️ ${Math.round(influ.avgLikes).toLocaleString()} Prom. Likes</span>
                </div>
            </div>
        </div>
        
        <h3 style="margin-bottom:15px; color:var(--primary)">Desglose de Contenidos</h3>
        <div style="overflow-x:auto;">
            <table class="content-table">
                <thead>
                    <tr>
                        <th>Título Contenido</th>
                        <th>Plataforma</th>
                        <th>Impresiones</th>
                        <th>Alcance</th>
                        <th>Likes</th>
                        <th>Comentarios</th>
                        <th>Compartidos</th>
                    </tr>
                </thead>
                <tbody>
                    ${influ.contents.map(c => `
                        <tr>
                            <td>${c['Título Contenido']}</td>
                            <td>${c['Plataforma']}</td>
                            <td>${(c['Impresiones']||0).toLocaleString()}</td>
                            <td>${(c['Cuentas Alcanzadas']||0).toLocaleString()}</td>
                            <td>${(c['Likes']||0).toLocaleString()}</td>
                            <td>${(c['Comentarios']||0).toLocaleString()}</td>
                            <td>${(c['Veces compartidas']||0).toLocaleString()}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// --- RENDERIZADO SUB-PESTAÑA: CAMPAÑAS DE INFLUENCERS ---
function renderMyCampaignsGrid() {
    myCampaignsGrid.innerHTML = '';
    if (processedMyCampaigns.length === 0) { myCampaignsGrid.innerHTML = '<p>No hay datos de campañas.</p>'; return; }

    processedMyCampaigns.forEach(camp => {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.innerHTML = `
            <h3>${camp.title}</h3>
            <p class="text-secondary" style="margin-bottom:10px">${camp.contents.length} Contenidos / Influencers</p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:0.9rem">
                <div><strong>${camp.totalImpressions.toLocaleString()}</strong> <br><span class="text-secondary">Impresiones</span></div>
                <div><strong>${camp.totalLikes.toLocaleString()}</strong> <br><span class="text-secondary">Likes</span></div>
            </div>
            <div style="margin-top:10px; text-align:right">
                <span style="color:var(--primary); font-weight:bold; font-size:0.8rem">VER DETALLES →</span>
            </div>
        `;
        card.onclick = () => renderMyCampaignDetail(camp.title);
        myCampaignsGrid.appendChild(card);
    });
}

function renderMyCampaignDetail(title, sortBy = 'likes') {
    const camp = processedMyCampaigns.find(c => c.title === title);
    if (!camp) return;

    myCampaignsGridView.classList.add('hidden');
    myCampaignsDetailView.classList.remove('hidden');

    // Ordenar contenidos
    let sortedContents = [...camp.contents];
    if (sortBy === 'likes') sortedContents.sort((a,b) => b['Likes'] - a['Likes']);
    else if (sortBy === 'impressions') sortedContents.sort((a,b) => b['Impresiones'] - a['Impresiones']);
    else if (sortBy === 'men') sortedContents.sort((a,b) => b['Hombres'] - a['Hombres']);
    else if (sortBy === 'women') sortedContents.sort((a,b) => b['Mujeres'] - a['Mujeres']);

    myCampaignsDetailView.innerHTML = `
        <div class="campaign-header">
            <div style="display:flex; gap:10px; align-items:center">
                    <button class="btn btn-secondary" id="back-to-camp-grid">← Volver</button>
                    <h2 style="color:var(--primary); margin:0">${camp.title}</h2>
            </div>
            <div style="display:flex; gap:10px; align-items:center">
                    <label class="text-secondary">Ordenar por:</label>
                    <select id="campaign-detail-sort" style="width:150px">
                    <option value="likes" ${sortBy==='likes'?'selected':''}>Mayor Likes</option>
                    <option value="impressions" ${sortBy==='impressions'?'selected':''}>Mayor Visualizaciones</option>
                    <option value="men" ${sortBy==='men'?'selected':''}>% Hombres</option>
                    <option value="women" ${sortBy==='women'?'selected':''}>% Mujeres</option>
                    </select>
            </div>
        </div>
        
        <div class="global-dashboard" style="margin-bottom:20px; grid-template-columns:repeat(4,1fr)">
            <div class="global-kpi-card" style="padding:15px">
                <span class="label">Total Impresiones</span><span class="value">${camp.totalImpressions.toLocaleString()}</span>
            </div>
                <div class="global-kpi-card" style="padding:15px">
                <span class="label">Total Alcance</span><span class="value">${camp.totalReach.toLocaleString()}</span>
            </div>
                <div class="global-kpi-card" style="padding:15px">
                <span class="label">Total Likes</span><span class="value">${camp.totalLikes.toLocaleString()}</span>
            </div>
                <div class="global-kpi-card" style="padding:15px">
                <span class="label">Nº Influencers</span><span class="value">${camp.contents.length}</span>
            </div>
        </div>

        <h3 style="margin-bottom:15px;">Contenidos Asociados</h3>
        <div style="overflow-x:auto;">
            <table class="content-table">
                <thead>
                    <tr>
                        <th>Influencer</th>
                        <th>Plataforma</th>
                        <th>Impresiones</th>
                        <th>Likes</th>
                        <th>% Hombres</th>
                        <th>% Mujeres</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedContents.map(c => `
                        <tr>
                            <td style="font-weight:bold; color:var(--primary)">${c['Influencer']}</td>
                            <td>${c['Plataforma']}</td>
                            <td>${(c['Impresiones']||0).toLocaleString()}</td>
                            <td>${(c['Likes']||0).toLocaleString()}</td>
                            <td>${c['Hombres']}%</td>
                            <td>${c['Mujeres']}%</td>
                            <td><button class="btn btn-secondary" style="padding:2px 8px; font-size:0.8rem" onclick="showMyInfluencerDetail(${c['ID influencer']})">Ver ficha</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    // Eventos internos
    document.getElementById('back-to-camp-grid').onclick = () => handleSubTabClick('campaigns');
    document.getElementById('campaign-detail-sort').onchange = (e) => renderMyCampaignDetail(title, e.target.value);
}

// 5. LOGICA EXPLORAR
let filteredInfluencers = []; 
function populateTagFilters(){
    const t1=document.getElementById('tag1-filter'),t2=document.getElementById('tag2-filter');
    if(t1.options.length > 1) return;
    const n=influencersData.flatMap(i=>(!i.niche||typeof i.niche!=='string')?[]:i.niche.split('|').map(s=>s.trim()));
    [...new Set(n.filter(Boolean))].sort().forEach(tag=>{t1.appendChild(new Option(tag,tag));t2.appendChild(new Option(tag,tag))})
}
function filterInfluencersData(){
    loader.classList.remove('hidden'); resultsContainer.classList.add('hidden');
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
            if(term&&!i.name.toLowerCase().includes(term)&&!n.some(s=>s.toLowerCase().includes(term)))return false;
            return true
        });
        displayInfluencerResults();loader.classList.add('hidden');resultsContainer.classList.remove('hidden')
    },300)
}
function displayInfluencerResults(){
    resultsContainer.innerHTML='';
    if(filteredInfluencers.length===0){resultsContainer.innerHTML='<p>No se encontraron influencers.</p>';return}
    filteredInfluencers.forEach(i=>{
        const impactRaw = ((i.likesAvg||0)+(i.commentsAvg||0)*1.5)/(i.followers||1)*100;
        const impact = impactRaw > 100 ? 100 : impactRaw.toFixed(2);
        const card=document.createElement('div'); card.className='result-card';
        card.innerHTML=`<h3>${i.name}</h3><p class="text-secondary">${i.platform}</p><p>👥 ${(i.followers||0).toLocaleString()}</p><p>❤️ ${(i.likesAvg||0).toLocaleString()}</p><p class="text-impact">⚡ Engagement: ${impact}%</p>`;
        card.addEventListener('click',()=>{displayInfluencerDetail(i)});
        resultsContainer.appendChild(card)
    })
}
function displayInfluencerDetail(i){
    destroyCharts(); resultsContainer.classList.add('hidden'); detailContainer.classList.remove('hidden');
    const n=(typeof i.niche==='string')?i.niche.split('|').map(s=>s.trim()).filter(Boolean):[];
    detailContainer.innerHTML=`<div style="display:flex;align-items:center;gap:20px;margin-bottom:20px"><img src="https://ui-avatars.com/api/?name=${encodeURIComponent(i.name)}&background=ef4444&color=fff&size=120" style="border-radius:50%" alt="${i.name}"><div><h2>${i.name}</h2><p class="text-secondary">${i.platform}</p></div></div><div style="margin-bottom:20px">${n.map(t=>`<span style="background:#333;padding:5px 10px;border-radius:15px;margin-right:5px;font-size:0.8rem">${t}</span>`).join('')}</div><button class="back-btn btn btn-secondary" id="back-explore-btn">← Volver</button><div style="margin-top:20px;height:300px"><canvas id="influencer-chart"></canvas></div>`;
    document.getElementById('back-explore-btn').onclick=()=>{detailContainer.classList.add('hidden');resultsContainer.classList.remove('hidden')};
    new Chart(document.getElementById('influencer-chart'),{type:'bar',data:{labels:['Seguidores','Likes Avg','Comentarios Avg'],datasets:[{label:'Métricas',data:[i.followers,i.likesAvg,i.commentsAvg],backgroundColor:['#ef4444','#f59e0b','#3b82f6']}]},options:{responsive:true,maintainAspectRatio:false,scales:{y:{type:'logarithmic'}}}});
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => { 
    tabs.forEach(t => t.addEventListener('click', handleTabClick)); 
    
    // Eventos Sub Pestañas
    subTabInfluencers.addEventListener('click', () => handleSubTabClick('influencers'));
    subTabCampaigns.addEventListener('click', () => handleSubTabClick('campaigns'));

    searchBtn.onclick = filterInfluencersData; 
    campaignSortFilter.onchange = renderCampaignOverview; 
    document.getElementById('reload-data-btn').onclick = loadData;
    myInfluencersSort.onchange = renderMyInfluencersGrid; 
    loadData(); 
});