/* =============================================
   TA08-G10 · calculadora.js (VERSIÓ FINAL)
   Integració Dashboard + 8 Càlculs Fase 3
   ============================================= */

'use strict';

let DATA = null;
let charts = {};

// Valors que s'ompliran dinàmicament des del JSON
let BASE = {
  peakPV_kW: 0,
  installedCapacity_kWp: 0,
  dailyPV_kWh: 0,
  totalConsumption_kWh: 0,
  selfConsumptionRate: 0,
  leakAvg_lh: 0,
  leakHours: 4, 
  digital_eur_month: 545.22, // Valor base de factures
  anual_consumibles_eur: 0,
  anual_neteja_eur: 0
};

const MESOS = ['Gener','Febrer','Març','Abril','Maig','Juny','Juliol','Agost','Setembre','Octubre','Novembre','Desembre'];

async function loadData() {
  try {
    const r = await fetch('data/dataclean_final.json');
    DATA = await r.json();
    
    // 1. Processar dades reals del JSON
    parseData();
    
    // 2. Iniciar interfície
    boot();
  } catch (e) {
    console.error("Error carregant dataclean_final.json:", e);
  }
}

function parseData() {
  // Electricitat: Mitjana de la planta solar
  const solar = DATA.planta_solar[0];
  BASE.peakPV_kW = solar.peak_power_kw;
  BASE.installedCapacity_kWp = solar.capacity_kwp;
  BASE.dailyPV_kWh = solar.pv_yield_kwh;
  BASE.totalConsumption_kWh = solar.consumption_kwh;
  BASE.selfConsumptionRate = (solar.self_consumption_kwh / solar.pv_yield_kwh) * 100;

  // Aigua: Mitjana de fuita nocturna (01:00 - 05:00)
  let leakSum = 0, count = 0;
  DATA.aigua.forEach(dia => {
    dia.hores.slice(1, 5).forEach(h => {
      leakSum += h.consum_l;
      count++;
    });
  });
  BASE.leakAvg_lh = Math.round(leakSum / count);

  // Consumibles i Neteja: Sumatori de costos del JSON
  BASE.anual_consumibles_eur = DATA.consumibles_oficina.reduce((acc, i) => acc + (i.cost_eur || 0), 0);
  BASE.anual_neteja_eur = DATA.neteja_higiene.reduce((acc, i) => acc + (i.cost || 0), 0);
}

// ── Càlculs de la Calculadora ─────────────────

function execCalc() {
  const millora = parseFloat(document.getElementById('inp-millora').value) || 0;
  const factorMillora = 1 - (millora / 100);
  const diesCurs = 304; // Setembre a Juny approx.

  // 1 i 2: Elèctric (Any i Curs)
  const elecAny = BASE.totalConsumption_kWh * 365 * factorMillora;
  const elecCurs = BASE.totalConsumption_kWh * diesCurs * factorMillora;

  // 3 i 4: Aigua (Any i Curs)
  // Nota: Considerem consum diari total = leakAvg * 24 per simplificar o basat en indicadors
  const consumAiguaDiari = BASE.leakAvg_lh * 24; 
  const aiguaAny = consumAiguaDiari * 365 * factorMillora;
  const aiguaCurs = consumAiguaDiari * diesCurs * factorMillora;

  // 5 i 6: Consumibles (Any i Curs)
  const consuAny = BASE.anual_consumibles_eur * factorMillora;
  const consuCurs = (BASE.anual_consumibles_eur * (10/12)) * factorMillora;

  // 7 i 8: Neteja (Any i Curs)
  const netejaAny = BASE.anual_neteja_eur * factorMillora;
  const netejaCurs = (BASE.anual_neteja_eur * (10/12)) * factorMillora;

  // Renderitzar a la graella
  renderResults({ elecAny, elecCurs, aiguaAny, aiguaCurs, consuAny, consuCurs, netejaAny, netejaCurs });
}

function renderResults(res) {
  const f = (v, u) => `${Math.round(v).toLocaleString('ca-ES')} ${u}`;
  
  document.getElementById('res-elec-any').textContent = f(res.elecAny, 'kWh');
  document.getElementById('res-elec-curs').textContent = f(res.elecCurs, 'kWh');
  document.getElementById('res-aigua-any').textContent = f(res.aiguaAny, 'L');
  document.getElementById('res-aigua-curs').textContent = f(res.aiguaCurs, 'L');
  document.getElementById('res-consu-any').textContent = f(res.consuAny, '€');
  document.getElementById('res-consu-curs').textContent = f(res.consuCurs, '€');
  document.getElementById('res-neteja-any').textContent = f(res.netejaAny, '€');
  document.getElementById('res-neteja-curs').textContent = f(res.netejaCurs, '€');
}

// ── UI i Gràfics ──────────────────────────────

function boot() {
  renderDashboard();
  initNav();
  document.getElementById('btn-calc').addEventListener('click', execCalc);
  execCalc(); // Càlcul inicial
}

function renderDashboard() {
  document.getElementById('d-peak').textContent = BASE.peakPV_kW;
  document.getElementById('d-selfcons').textContent = BASE.selfConsumptionRate.toFixed(1);
  document.getElementById('d-leak').textContent = BASE.leakAvg_lh;
  document.getElementById('d-leakday').textContent = (BASE.leakAvg_lh * 24 / 1000).toFixed(1);
  document.getElementById('d-leakyear').textContent = Math.round(BASE.leakAvg_lh * 4 * 365 / 1000);
  document.getElementById('d-refills').textContent = "140"; // Valor d'exemple o del JSON
  
  buildMainChart();
}

function buildMainChart() {
  const ctx = document.getElementById('chart-solar').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: MESOS.map(m => m.substring(0,3).toUpperCase()),
      datasets: [{
        label: 'Consum Estimat (kWh)',
        data: MESOS.map(() => BASE.totalConsumption_kWh * 30),
        backgroundColor: '#f5e642'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

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

document.addEventListener('DOMContentLoaded', loadData);
