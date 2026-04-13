/* =============================================
   TA08-G10 · calculadora.js
   Dades reals del dataclean.json ITB
   ============================================= */

'use strict';

let DATA = null;
let charts = {};

// ── Carrega JSON ──────────────────────────────
async function loadData() {
  try {
    const r = await fetch('data/dataclean.json');
    DATA = await r.json();
    boot();
  } catch (e) {
    document.body.innerHTML = `<p style="padding:2rem;font-family:monospace;color:red">
      Error carregant dataclean.json: ${e.message}</p>`;
  }
}

// ── Utilitats ─────────────────────────────────
const fmt = (n, d = 0) =>
  Number(n).toLocaleString('ca-ES', { minimumFractionDigits: d, maximumFractionDigits: d });

// Variabilitat ±5%
const jitter = v => v * (1 + (Math.random() * 0.10 - 0.05));

// ── Dades base del JSON ───────────────────────
const BASE = {
  // Energia solar (indicator-01 + daily_record)
  peakPV_kW:           9.22,
  installedCapacity_kWp: 30.94,
  dailyPV_kWh:         42.56,
  totalConsumption_kWh: 157.47,
  gridImport_kWh:      117.53,
  selfConsumptionRate: 93.844,  // %
  co2Avoided_t:        0.02,    // per dia
  revenue_eur:         0.31,    // per dia

  // Fuita d'aigua nocturna (indicator-02)
  leakMin_lh:   150,
  leakMax_lh:   190,
  leakAvg_lh:   170,
  leakHours:    4,   // 01:00–05:00

  // Infraestructura digital (indicator-03)
  digital_eur_month: 545.22,

  // Circularitat - recàrregues retoladors (indicator-04)
  refills_units: 140
};

// ── Factors estacionals (producció solar per mes) ──
// Espanyol mediterrani: alta primavera/estiu, baixa hivern
const SOLAR_FACTOR = {
  Gener: 0.40, Febrer: 0.55, Març: 0.75, Abril: 0.90,
  Maig:  1.10, Juny:   1.25, Juliol: 1.30, Agost: 1.20,
  Setembre: 1.00, Octubre: 0.80, Novembre: 0.55, Desembre: 0.38
};

// Consum total del centre per mes (alt hivern, baix estiu tancat)
const CONSUM_FACTOR = {
  Gener: 1.12, Febrer: 1.08, Març: 1.00, Abril: 0.92,
  Maig:  0.88, Juny:   0.85, Juliol: 0.42, Agost: 0.15,
  Setembre: 0.88, Octubre: 0.96, Novembre: 1.05, Desembre: 1.14
};

const MESOS = Object.keys(SOLAR_FACTOR);

// ── Projeccions ───────────────────────────────
// C1 – Producció solar anual projectada
function calcSolarAnual(anyFutur, milloraPct = 0) {
  const anyBase = 2025;
  const d = anyFutur - anyBase;
  // Degradació panells -0.5%/any, millora potencial (neteja, optimitzadors)
  const factor = Math.pow(0.995, d) * (1 + milloraPct / 100);
  return MESOS.map(mes => ({
    mes,
    produccio: Math.round(jitter(BASE.dailyPV_kWh * 30 * SOLAR_FACTOR[mes] * factor)),
    consum: Math.round(jitter(BASE.totalConsumption_kWh * 30 * CONSUM_FACTOR[mes]))
  }));
}

// C2 – Producció solar curs escolar (set–jun)
function calcSolarCurs(anyFutur, milloraPct = 0) {
  const tots = calcSolarAnual(anyFutur, milloraPct);
  const cursActiu = ['Setembre','Octubre','Novembre','Desembre','Gener','Febrer','Març','Abril','Maig','Juny'];
  return tots.filter(m => cursActiu.includes(m.mes));
}

// C3 – Fuita anual d'aigua projectada
function calcFuitaAnual(anyFutur, milloraPct = 0) {
  // Sense correcció: 170 L/h × 4h × 365 dies
  const baseAnual = BASE.leakAvg_lh * BASE.leakHours * 365;
  const reduccio  = 1 - (milloraPct / 100) * ((anyFutur - 2025) / 3);
  const litres    = Math.max(0, Math.round(baseAnual * reduccio));
  return { litres, m3: (litres / 1000).toFixed(1), cost: (litres / 1000 * 2.85).toFixed(2) };
}

// C4 – Fuita curs escolar (10 mesos)
function calcFuitaCurs(anyFutur, milloraPct = 0) {
  const base = BASE.leakAvg_lh * BASE.leakHours * 304; // ~304 dies curs
  const reduccio = 1 - (milloraPct / 100) * ((anyFutur - 2025) / 3);
  const litres   = Math.max(0, Math.round(base * reduccio));
  return { litres, m3: (litres / 1000).toFixed(1), cost: (litres / 1000 * 2.85).toFixed(2) };
}

// C5 – Cost infraestructura digital anual
function calcDigitalAnual(anyFutur, milloraPct = 0) {
  const delta = anyFutur - 2025;
  // Tendència: preus telecomunicacions cauen ~3%/any + estalvi per renegociació
  const factor = Math.pow(0.97, delta) * (1 - milloraPct / 100 * 0.5);
  const cost   = Math.max(0, BASE.digital_eur_month * 12 * factor);
  return { cost: cost.toFixed(2), costMes: (cost / 12).toFixed(2) };
}

// C6 – Cost infraestructura digital curs (10 mesos)
function calcDigitalCurs(anyFutur, milloraPct = 0) {
  const anual = parseFloat(calcDigitalAnual(anyFutur, milloraPct).cost);
  return { cost: (anual * 10 / 12).toFixed(2) };
}

// C7 – Estalvi per recàrregues de retoladors anual
function calcRecàrreguesAnual(anyFutur, expansioPct = 0) {
  const base         = BASE.refills_units;
  const expansio     = 1 + expansioPct / 100 * (anyFutur - 2024);
  const unitats      = Math.round(base * Math.min(expansio, 3));
  const estalvi_eur  = unitats * 1.80; // retolador nou ~3€ vs recàrrega ~1.20€
  const plasticEvitat_g = unitats * 12;
  return { unitats, estalvi_eur: estalvi_eur.toFixed(2), plasticEvitat_g };
}

// C8 – Recàrregues curs escolar (10 mesos)
function calcRecàrreguesCurs(anyFutur, expansioPct = 0) {
  const anual = calcRecàrreguesAnual(anyFutur, expansioPct);
  return {
    unitats:      Math.round(anual.unitats * 10 / 12),
    estalvi_eur:  (parseFloat(anual.estalvi_eur) * 10 / 12).toFixed(2),
    plasticEvitat_g: Math.round(anual.plasticEvitat_g * 10 / 12)
  };
}

// ── BOOT ──────────────────────────────────────
function boot() {
  initNav();
  renderDashboard();
  renderCalculadora();
  renderPla();
  renderTips();
  document.getElementById('btn-pdf').addEventListener('click', () => window.print());
}

// ── NAV ───────────────────────────────────────
function initNav() {
  document.querySelectorAll('nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.sec).classList.add('active');
    });
  });
}

// ── DASHBOARD ─────────────────────────────────
function renderDashboard() {
  // Stats from real JSON
  document.getElementById('d-peak').textContent     = BASE.peakPV_kW;
  document.getElementById('d-selfcons').textContent = BASE.selfConsumptionRate.toFixed(1);
  document.getElementById('d-leak').textContent     = BASE.leakAvg_lh;
  document.getElementById('d-leakday').textContent  = fmt(BASE.leakAvg_lh * 24 / 1000, 1);
  document.getElementById('d-digital').textContent  = fmt(BASE.digital_eur_month, 2);
  document.getElementById('d-refills').textContent  = BASE.refills_units;

  // Derived calcs shown on dashboard
  const leakAnual_m3 = (BASE.leakAvg_lh * BASE.leakHours * 365 / 1000).toFixed(0);
  const leakCost     = (leakAnual_m3 * 2.85).toFixed(0);
  document.getElementById('d-leakyear').textContent = leakAnual_m3;
  document.getElementById('d-leakcost').textContent = leakCost;

  const co2Year = (BASE.co2Avoided_t * 365).toFixed(1);
  document.getElementById('d-co2year').textContent = co2Year;

  // Gràfic 1: Solar producció vs consum estimat mensual
  buildChartSolarVsConsum();

  // Gràfic 2: Ús mòbil per sessions (dades socials del JSON)
  buildChartPhoneUsage();
}

function buildChartSolarVsConsum() {
  const solar  = MESOS.map(m => Math.round(BASE.dailyPV_kWh * 30 * SOLAR_FACTOR[m]));
  const consum = MESOS.map(m => Math.round(BASE.totalConsumption_kWh * 30 * CONSUM_FACTOR[m]));

  const ctx = document.getElementById('chart-solar').getContext('2d');
  if (charts.solar) charts.solar.destroy();
  charts.solar = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: MESOS.map(m => m.substring(0, 3).toUpperCase()),
      datasets: [
        {
          label: 'Producció FV (kWh)',
          data: solar,
          backgroundColor: '#f5e642cc',
          borderColor: '#0f0f0f',
          borderWidth: 1,
          borderRadius: 0
        },
        {
          label: 'Consum centre (kWh)',
          data: consum,
          backgroundColor: '#0f0f0f22',
          borderColor: '#0f0f0f',
          borderWidth: 1,
          borderRadius: 0,
          type: 'line',
          tension: 0.4,
          fill: false,
          pointBackgroundColor: '#0f0f0f',
          pointRadius: 4
        }
      ]
    },
    options: chartOpts('kWh')
  });
}

function buildChartPhoneUsage() {
  const sessions = DATA.data_details.social.sessions_data;
  // Agrupa per grup i calcula mitjana
  const grups = ['ASIXc1A', 'ASIXc1B', 'ASIXc1C'];
  const avgByGroup = grups.map(g => {
    const gs = sessions.filter(s => s.group === g);
    const avg = gs.reduce((a, s) => a + s.usage_percent, 0) / gs.length;
    return parseFloat(avg.toFixed(1));
  });

  // Dades per sessió del grup ASIXc1A per mostrar evolució
  const sessionsA = sessions.filter(s => s.group === 'ASIXc1A')
                            .sort((a, b) => a.date.localeCompare(b.date));
  const labelsA   = sessionsA.map(s => s.date.substring(5)); // MM-DD
  const dataA     = sessionsA.map(s => s.usage_percent);

  const ctx = document.getElementById('chart-phone').getContext('2d');
  if (charts.phone) charts.phone.destroy();
  charts.phone = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labelsA,
      datasets: [
        {
          label: 'ASIXc1A ús mòbil (%)',
          data: dataA,
          borderColor: '#0f0f0f',
          backgroundColor: 'rgba(15,15,15,0.05)',
          tension: 0.3,
          fill: true,
          pointBackgroundColor: dataA.map(v => v > 20 ? '#e63946' : '#2a9d8f'),
          pointRadius: 5,
          borderWidth: 2
        },
        {
          label: 'Llindar acceptable (10%)',
          data: Array(labelsA.length).fill(10),
          borderColor: '#2a9d8f',
          borderDash: [6, 3],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        },
        {
          label: 'Llindar tolerable (20%)',
          data: Array(labelsA.length).fill(20),
          borderColor: '#e63946',
          borderDash: [6, 3],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: chartOpts('%')
  });

  // Mostrar mitjanes
  document.getElementById('avg-A').textContent = avgByGroup[0] + '%';
  document.getElementById('avg-B').textContent = avgByGroup[1] + '%';
  document.getElementById('avg-C').textContent = avgByGroup[2] + '%';
}

// ── CALCULADORA ───────────────────────────────
function renderCalculadora() {
  const selAny = document.getElementById('sel-any');
  [2025, 2026, 2027, 2028].forEach(a => {
    const o = document.createElement('option');
    o.value = a; o.textContent = a;
    if (a === 2026) o.selected = true;
    selAny.appendChild(o);
  });

  document.getElementById('btn-calc').addEventListener('click', execCalc);
  execCalc();
}

function execCalc() {
  const any     = parseInt(document.getElementById('sel-any').value);
  const periode = document.getElementById('sel-periode').value;
  const millora = parseFloat(document.getElementById('inp-millora').value) || 0;
  const expansio = parseFloat(document.getElementById('inp-expansio').value) || 0;
  const esAny    = (periode === 'any');

  // Executar els 8 càlculs
  const solarData   = esAny ? calcSolarAnual(any, millora) : calcSolarCurs(any, millora);
  const fuita       = esAny ? calcFuitaAnual(any, millora) : calcFuitaCurs(any, millora);
  const digital     = esAny ? calcDigitalAnual(any, millora) : calcDigitalCurs(any, millora);
  const recarregues = esAny ? calcRecàrreguesAnual(any, expansio) : calcRecàrreguesCurs(any, expansio);

  const totalSolar  = solarData.reduce((s, m) => s + m.produccio, 0);
  const totalConsum = solarData.reduce((s, m) => s + m.consum, 0);
  const cobertura   = Math.min(100, (totalSolar / totalConsum * 100)).toFixed(1);
  const co2Evitat   = (totalSolar * 0.233 / 1000).toFixed(2); // tones

  const periodeLabel = esAny ? `Any ${any}` : `Curs ${any - 1}–${any}`;
  document.getElementById('calc-label').textContent = periodeLabel;

  // Resultats tiles
  set('r-solar-prod', fmt(totalSolar) + ' kWh');
  set('r-solar-cob',  cobertura + '%');
  set('r-solar-co2',  co2Evitat + ' t CO₂');

  set('r-fuita-l',    fmt(fuita.litres) + ' L');
  set('r-fuita-m3',   fuita.m3 + ' m³');
  set('r-fuita-cost', fuita.cost + ' €');

  set('r-dig-cost',   digital.cost + ' €');
  if (digital.costMes) set('r-dig-mes', digital.costMes + ' €/mes');

  set('r-ref-u',      fmt(recarregues.unitats) + ' u.');
  set('r-ref-eur',    recarregues.estalvi_eur + ' €');
  set('r-ref-pl',     recarregues.plasticEvitat_g + ' g');

  // Estalvi total
  const estalviTotal = (
    parseFloat(recarregues.estalvi_eur) +
    parseFloat(fuita.cost) * (millora / 100)
  ).toFixed(2);

  // Gràfic solar mensual
  buildChartCalc(solarData, esAny);

  // Estalvi box
  if (millora > 0) {
    const litresEstalviats = (BASE.leakAvg_lh * BASE.leakHours *
      (esAny ? 365 : 304) / 1000 * (millora / 100)).toFixed(0);
    const eurEstalviats = (litresEstalviats * 2.85).toFixed(2);
    document.getElementById('sb-litres').textContent = fmt(litresEstalviats) + ' m³';
    document.getElementById('sb-euros').textContent  = eurEstalviats + ' €';
    document.getElementById('sb-any').textContent    = `any ${any}`;
    document.getElementById('saving-box').classList.add('visible');
  } else {
    document.getElementById('saving-box').classList.remove('visible');
  }
}

function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function buildChartCalc(solarData, esAny) {
  const ctx = document.getElementById('chart-calc').getContext('2d');
  if (charts.calc) charts.calc.destroy();
  charts.calc = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: solarData.map(m => m.mes.substring(0, 3).toUpperCase()),
      datasets: [
        {
          label: 'Producció FV (kWh)',
          data: solarData.map(m => m.produccio),
          backgroundColor: '#f5e642',
          borderColor: '#0f0f0f',
          borderWidth: 1,
          borderRadius: 0,
          order: 2
        },
        {
          label: 'Consum centre (kWh)',
          data: solarData.map(m => m.consum),
          type: 'line',
          borderColor: '#e63946',
          backgroundColor: 'transparent',
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: '#e63946',
          pointRadius: 4,
          order: 1
        }
      ]
    },
    options: chartOpts('kWh')
  });
}

// ── PLA DE REDUCCIÓ ───────────────────────────
function renderPla() {
  buildChartProjection();
}

function buildChartProjection() {
  const anys = [2025, 2026, 2027, 2028];

  // Fuita sense correcció vs amb pla -30%
  const fuitaBase = anys.map(a => BASE.leakAvg_lh * BASE.leakHours * 365 / 1000);
  const fuitaPla  = [
    BASE.leakAvg_lh * BASE.leakHours * 365 / 1000,
    BASE.leakAvg_lh * BASE.leakHours * 365 / 1000 * 0.80,
    BASE.leakAvg_lh * BASE.leakHours * 365 / 1000 * 0.60,
    BASE.leakAvg_lh * BASE.leakHours * 365 / 1000 * 0.30
  ];

  // Producció solar amb pla d'optimització
  const solarBase = anys.map(a => Math.round(BASE.dailyPV_kWh * 365 * Math.pow(0.995, a - 2025)));
  const solarPla  = anys.map(a => Math.round(BASE.dailyPV_kWh * 365 * Math.pow(0.995, a - 2025) * (1 + 0.10 * (a - 2025))));

  const ctx = document.getElementById('chart-proj').getContext('2d');
  if (charts.proj) charts.proj.destroy();
  charts.proj = new Chart(ctx, {
    type: 'line',
    data: {
      labels: anys,
      datasets: [
        { label: 'Fuita SENSE pla (m³/any)', data: fuitaBase, borderColor: '#e63946', borderWidth: 2, borderDash: [6, 3], tension: 0.2, pointRadius: 5, fill: false },
        { label: 'Fuita AMB pla (m³/any)', data: fuitaPla, borderColor: '#1d6fa4', backgroundColor: 'rgba(29,111,164,0.08)', borderWidth: 2.5, tension: 0.3, fill: true, pointBackgroundColor: '#1d6fa4', pointRadius: 5 },
        { label: 'Solar SENSE opt. (kWh)', data: solarBase, borderColor: '#ccc', borderWidth: 1.5, borderDash: [4, 4], tension: 0.2, pointRadius: 4, fill: false },
        { label: 'Solar AMB opt. (kWh)', data: solarPla, borderColor: '#c8bb1a', backgroundColor: 'rgba(200,187,26,0.08)', borderWidth: 2.5, tension: 0.3, fill: true, pointBackgroundColor: '#c8bb1a', pointRadius: 5 }
      ]
    },
    options: chartOpts('')
  });
}

// ── TIPS ──────────────────────────────────────
function renderTips() {
  // Renderitzat en HTML, res dinàmic
}

// ── CHART OPTIONS COMMON ──────────────────────
function chartOpts(unit) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: '#3a3a3a',
          font: { family: 'IBM Plex Mono', size: 10 },
          boxWidth: 12
        }
      },
      tooltip: {
        backgroundColor: '#0f0f0f',
        titleFont: { family: 'IBM Plex Mono', size: 11 },
        bodyFont: { family: 'IBM Plex Mono', size: 11 },
        callbacks: {
          label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('ca-ES')} ${unit}`
        }
      }
    },
    scales: {
      x: {
        ticks: { color: '#888', font: { family: 'IBM Plex Mono', size: 9 } },
        grid: { color: 'rgba(0,0,0,0.06)' }
      },
      y: {
        ticks: { color: '#888', font: { family: 'IBM Plex Mono', size: 9 } },
        grid: { color: 'rgba(0,0,0,0.06)' }
      }
    }
  };
}

// ── INIT ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadData);