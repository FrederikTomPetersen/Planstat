document.addEventListener('DOMContentLoaded', function() {
  if (typeof DASHBOARD_DATA === 'undefined') {
    console.error('DASHBOARD_DATA findes ikke. Tjek at dashboard_data.js er indlæst.');
    const meta = document.getElementById('metaText');
    if (meta) {
      meta.innerHTML = '<strong>Fejl:</strong> dashboard_data.js er ikke indlæst.';
    }
    return;
  }

  const data = DASHBOARD_DATA;

  if (!data.kommune_summary || data.kommune_summary.length === 0) {
    console.error('kommune_summary er tom eller mangler.', data);
    const meta = document.getElementById('metaText');
    if (meta) {
      meta.innerHTML = '<strong>Fejl:</strong> Der er ingen kommunedata i dashboard_data.js.';
    }
    return;
  }

  if (typeof Plotly === 'undefined') {
    console.error('Plotly er ikke indlæst. Tjek internetforbindelse eller CDN-link.');
    const meta = document.getElementById('metaText');
    if (meta) {
      meta.innerHTML = '<strong>Fejl:</strong> Plotly er ikke indlæst.';
    }
    return;
  }

  const fmtInt = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 0 });
  const fmtPct = new Intl.NumberFormat('da-DK', { style: 'percent', maximumFractionDigits: 1 });
  const fmtNum = new Intl.NumberFormat('da-DK', { maximumFractionDigits: 1 });

  function safeNumber(x) {
    if (x === null || x === undefined || Number.isNaN(Number(x))) return null;
    return Number(x);
  }

  function formatInt(x) {
    const v = safeNumber(x);
    return v === null ? 'Ikke angivet' : fmtInt.format(v);
  }

  function formatPct(x) {
    const v = safeNumber(x);
    return v === null ? 'Ikke angivet' : fmtPct.format(v);
  }

  function formatHa(x) {
    const v = safeNumber(x);
    return v === null ? 'Ikke angivet' : fmtNum.format(v) + ' ha';
  }

  function cleanLabel(x, maxLen = 34) {
    if (!x) return 'Ikke angivet';
    return String(x).length > maxLen ? String(x).slice(0, maxLen - 1) + '…' : String(x);
  }

  function initSelect() {
    const select = document.getElementById('kommuneSelect');

    if (!select) {
      console.error('Elementet kommuneSelect findes ikke i HTML.');
      return;
    }

    data.kommune_summary
      .sort((a, b) => String(a.kommunenavn).localeCompare(String(b.kommunenavn), 'da'))
      .forEach(row => {
        const option = document.createElement('option');
        option.value = row.kommunekode;
        option.textContent = row.kommunenavn;
        select.appendChild(option);
      });

    select.addEventListener('change', function() {
      updateDashboard(select.value);
    });

    select.value = data.kommune_summary[0].kommunekode;
    updateDashboard(select.value);
  }

  function getSummary(kommunekode) {
    return data.kommune_summary.find(d => d.kommunekode === kommunekode);
  }

  function updateMeta(summary) {
    document.getElementById('metaText').innerHTML =
      '<strong>Senest genereret:</strong> ' + data.metadata.opdateret +
      '<br><strong>Hele landet:</strong> ' + formatInt(data.metadata.antal_planer_dk) +
      ' vedtagne lokalplaner' +
      '<br><strong>Valgt kommune:</strong> ' + summary.kommunenavn +
      ' (' + summary.kommunekode + ')';
  }

  function updateKpis(summary) {
    document.getElementById('kpiAntal').textContent = formatInt(summary.antal_planer);
    document.getElementById('kpiAntalSub').textContent =
      'Hele landet: ' + formatInt(data.metadata.antal_planer_dk) + ' planer';

    document.getElementById('kpiAndel').textContent = formatPct(summary.andel_af_land);
    document.getElementById('kpiAndelSub').textContent =
      'Kommunens andel af alle vedtagne lokalplaner i datasættet';

    document.getElementById('kpiAreal').textContent = formatHa(summary.median_areal_ha);
    document.getElementById('kpiArealSub').textContent =
      'Median. Hele landet: ' + formatHa(data.metadata.dk_median_areal);

    document.getElementById('kpiAnvendelse').textContent =
      cleanLabel(summary.top_anvendelse, 22);
    document.getElementById('kpiAnvendelseSub').textContent =
      'Hele landet: ' + cleanLabel(data.metadata.dk_top_anvendelse, 60);
  }

  function plotAnvendelse(kommunekode, summary) {
    const dkRows = data.anvendelse_data.filter(d => d.kommunekode === 'DK');
    const kommuneRows = data.anvendelse_data.filter(d => d.kommunekode === kommunekode);

    const allCats = Array.from(new Set([
      ...dkRows.map(d => d.anvendelse),
      ...kommuneRows.map(d => d.anvendelse)
    ]));

    const kommuneLookup = Object.fromEntries(
      kommuneRows.map(d => [d.anvendelse, d.andel])
    );

    const dkLookup = Object.fromEntries(
      dkRows.map(d => [d.anvendelse, d.andel])
    );

    const rows = allCats
      .map(cat => ({
        anvendelse: cat,
        kommune: kommuneLookup[cat] || 0,
        dk: dkLookup[cat] || 0,
        total: Math.max(kommuneLookup[cat] || 0, dkLookup[cat] || 0)
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 12)
      .reverse();

    const traceKommune = {
      x: rows.map(d => d.kommune),
      y: rows.map(d => d.anvendelse),
      name: summary.kommunenavn,
      type: 'bar',
      orientation: 'h',
      marker: { color: '#005a8d' },
      hovertemplate: '%{y}<br>' + summary.kommunenavn + ': %{x:.1%}<extra></extra>'
    };

    const traceDk = {
      x: rows.map(d => d.dk),
      y: rows.map(d => d.anvendelse),
      name: 'Hele landet',
      type: 'bar',
      orientation: 'h',
      marker: { color: '#b7c7d6' },
      hovertemplate: '%{y}<br>Hele landet: %{x:.1%}<extra></extra>'
    };

    const layout = {
      margin: { l: 150, r: 20, t: 10, b: 40 },
      barmode: 'group',
      xaxis: {
        tickformat: '.0%',
        title: '',
        gridcolor: '#e5e8ed'
      },
      yaxis: {
        title: '',
        automargin: true
      },
      legend: {
        orientation: 'h',
        y: -0.18
      },
      font: { family: 'Arial, sans-serif' },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white'
    };

    Plotly.react('plotAnvendelse', [traceKommune, traceDk], layout, {
      displayModeBar: false,
      responsive: true
    });
  }

  function plotTid(kommunekode, summary) {
    const kommuneRows = data.aar_data
      .filter(d => d.kommunekode === kommunekode)
      .sort((a, b) => a['år'] - b['år']);

    const dkRows = data.aar_data
      .filter(d => d.kommunekode === 'DK')
      .sort((a, b) => a['år'] - b['år']);

    const maxDk = Math.max(...dkRows.map(d => Number(d.antal || 0)));
    const dkIndex = dkRows.map(d => maxDk > 0 ? Number(d.antal || 0) / maxDk : 0);

    const traceKommune = {
      x: kommuneRows.map(d => d['år']),
      y: kommuneRows.map(d => d.antal),
      type: 'bar',
      name: summary.kommunenavn,
      marker: { color: '#005a8d' },
      yaxis: 'y',
      hovertemplate: 'År %{x}<br>' + summary.kommunenavn + ': %{y} planer<extra></extra>'
    };

    const traceDk = {
      x: dkRows.map(d => d['år']),
      y: dkIndex,
      type: 'scatter',
      mode: 'lines',
      name: 'Hele landet, indekseret',
      line: { color: '#c46a00', width: 3 },
      yaxis: 'y2',
      hovertemplate: 'År %{x}<br>Landstendens, indeks: %{y:.2f}<extra></extra>'
    };

    const layout = {
      margin: { l: 50, r: 50, t: 10, b: 45 },
      xaxis: {
        title: '',
        gridcolor: '#e5e8ed'
      },
      yaxis: {
        title: 'Kommune',
        gridcolor: '#e5e8ed',
        rangemode: 'tozero'
      },
      yaxis2: {
        title: 'Landstendens',
        overlaying: 'y',
        side: 'right',
        rangemode: 'tozero',
        tickformat: '.0%'
      },
      legend: {
        orientation: 'h',
        y: -0.18
      },
      font: { family: 'Arial, sans-serif' },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white'
    };

    Plotly.react('plotTid', [traceKommune, traceDk], layout, {
      displayModeBar: false,
      responsive: true
    });
  }

  function plotTopkommuner(selectedKommune) {
    const rows = [...data.topkommuner].reverse();

    const colors = rows.map(d =>
      d.kommunekode === selectedKommune ? '#c46a00' : '#005a8d'
    );

    const trace = {
      x: rows.map(d => d.antal_planer),
      y: rows.map(d => d.kommunenavn),
      type: 'bar',
      orientation: 'h',
      marker: { color: colors },
      hovertemplate: '%{y}<br>%{x} planer<extra></extra>'
    };

    const layout = {
      margin: { l: 150, r: 20, t: 10, b: 40 },
      xaxis: {
        title: 'Antal vedtagne lokalplaner',
        gridcolor: '#e5e8ed'
      },
      yaxis: {
        title: '',
        automargin: true
      },
      font: { family: 'Arial, sans-serif' },
      paper_bgcolor: 'white',
      plot_bgcolor: 'white'
    };

    Plotly.react('plotTopkommuner', [trace], layout, {
      displayModeBar: false,
      responsive: true
    });
  }

  function updateDashboard(kommunekode) {
    const summary = getSummary(kommunekode);
    if (!summary) return;

    updateMeta(summary);
    updateKpis(summary);
    plotAnvendelse(kommunekode, summary);
    plotTid(kommunekode, summary);
    plotTopkommuner(kommunekode);
  }

  initSelect();

  window.addEventListener('resize', function() {
    Plotly.Plots.resize(document.getElementById('plotAnvendelse'));
    Plotly.Plots.resize(document.getElementById('plotTid'));
    Plotly.Plots.resize(document.getElementById('plotTopkommuner'));
  });
});
