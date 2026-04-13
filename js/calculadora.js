/* =============================================
   TA08-G10 · calculadora.js (FASE 3)
   Càlculs basats en dataclean_final.json
   ============================================= */

'use strict';

let DATA = null;
let charts = {};

// Valors base extrets del JSON
let BASE = {
  diari_elec_kwh: 0,
  diari_aigua_l: 0,
  anual_consumibles_eur: 0,
  anual_neteja_eur: 0
};

// Factors d'estacionalitat i tendència
const FACTORS = {
  hivern: 1.25, // +25% electricitat/gas a l'hivern
  estiu: 1.40,  // +40% aigua a l'estiu (reg/neteja fons)
  escolar: 304, // dies de curs (setembre a juny)
  anual: 365
};

async function loadData() {
  try {
    const r = await fetch('data/dataclean_final.json');
    DATA = await r.json();
    
    // 1. Extreure dades del JSON final
    // Electricitat (mitjana de la planta solar)
    BASE.diari_elec_kwh = DATA.planta_solar[0].consumption_kwh;
    
    // Aigua (sumatori d'un dia tipus de l'array aigua)
    BASE.diari_aigua_l = DATA.aigua[0].hores.reduce((acc, h) => acc + h.consum_l, 0);
    
    // Consumibles (suma total de la secció)
    BASE.anual_consumibles_eur = DATA.consumibles_oficina.reduce((acc, i) => acc + i.cost, 0);
    
    // Neteja (suma total de la secció)
    BASE.anual_neteja_eur = DATA.neteja_higiene.reduce((acc, i) => acc + i.cost, 0);

    boot();
  } catch (e) {
    console.error("Error carregant dades:", e);
  }
}

function execCalc() {
  const any = parseInt(document.getElementById('sel-any').value);
  const millora = parseFloat(document.getElementById('inp-millora').value) || 0;
  const factorMillora = 1 - (millora / 100);

  // --- ELS 8 CÀLCULS REQUERITS ---
  
  // 1. Consum elèctric pròxim any (amb tendència +2% per digitalització si no hi ha millora)
  const elecAnual = BASE.diari_elec_kwh * FACTORS.anual * 1.02 * factorMillora;
  
  // 2. Consum elèctric curs (Set-Jun)
  const elecCurs = BASE.diari_elec_kwh * FACTORS.escolar * 1.02 * factorMillora;

  // 3. Consum aigua pròxim any
  const aiguaAnual = BASE.diari_aigua_l * FACTORS.anual * factorMillora;

  // 4. Consum aigua període curs
  const aiguaCurs = BASE.diari_aigua_l * FACTORS.escolar * factorMillora;

  // 5. Consumibles oficina pròxim any
  const consuAnual = BASE.anual_consumibles_eur * factorMillora;

  // 6. Consumibles oficina període curs (10/12 parts)
  const consuCurs = (BASE.anual_consumibles_eur * (10/12)) * factorMillora;

  // 7. Productes neteja pròxim any
  const netejaAnual = BASE.anual_neteja_eur * factorMillora;

  // 8. Productes neteja període curs
  const netejaCurs = (BASE.anual_neteja_eur * (10/12)) * factorMillora;

  // Renderitzar resultats a la UI
  renderResults({
    elecAnual, elecCurs, aiguaAnual, aiguaCurs,
    consuAnual, consuCurs, netejaAnual, netejaCurs
  });
}

function renderResults(res) {
  const fmt = (v, u) => `${Math.round(v).toLocaleString('ca-ES')} ${u}`;
  
  document.getElementById('res-elec-any').textContent = fmt(res.elecAnual, 'kWh');
  document.getElementById('res-elec-curs').textContent = fmt(res.elecCurs, 'kWh');
  
  document.getElementById('res-aigua-any').textContent = fmt(res.aiguaAnual, 'L');
  document.getElementById('res-aigua-curs').textContent = fmt(res.aiguaCurs, 'L');
  
  document.getElementById('res-consu-any').textContent = fmt(res.consuAnual, '€');
  document.getElementById('res-consu-curs').textContent = fmt(res.consuCurs, '€');
  
  document.getElementById('res-neteja-any').textContent = fmt(res.netejaAnual, '€');
  document.getElementById('res-neteja-curs').textContent = fmt(res.netejaCurs, '€');
}

function boot() {
  document.getElementById('btn-calc').addEventListener('click', execCalc);
  execCalc(); // Càlcul inicial
}

document.addEventListener('DOMContentLoaded', loadData);
