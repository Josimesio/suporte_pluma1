/**
 * index_Principal - Navegação + Gráfico comparativo anual
 *
 * Navegação "à prova de pastas":
 * tenta localizar as páginas 2025/2026 em diferentes caminhos comuns
 * (raiz, pasta por ano, nomes com sufixo/underscore).
 *
 * Gráfico:
 *  - lê dados_sr_2025.csv e dados_sr_2026.csv (padrão do projeto)
 *  - calcula Abertos/Fechados e plota com valores em cima das barras
 */

// ---------- Navegação inteligente (corrige links quebrados) ----------
async function encontrarPrimeiroOk(candidatos) {
  for (const url of candidatos) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (r.ok) return url;
    } catch (_) {}
  }
  return null;
}

function candidatosPagina(ano, pagina) {
  // pagina: index | graficos | top-modulos | top-contatos
  const baseName = pagina; // já vem no formato correto
  const html1 = `${ano}/${baseName}.html`;
  const html2 = `${ano}/${baseName}.htm`;
  const html3 = `${baseName}-${ano}.html`;
  const html4 = `${baseName}_${ano}.html`;
  const html5 = `${baseName}${ano}.html`;
  const html6 = `${baseName}.html`; // fallback (caso esteja tudo na raiz)
  return [html1, html2, html3, html4, html5, html6].map(u => u.replace("//","/"));
}

async function irPara(ano, pagina) {
  const candidatos = candidatosPagina(ano, pagina);
  const ok = await encontrarPrimeiroOk(candidatos);
  if (ok) {
    window.location.href = ok;
  } else {
    alert(
      `Não encontrei a página "${pagina}" do ano ${ano}.\n\n` +
      `Caminhos testados:\n- ` + candidatos.join("\n- ")
    );
  }
}

// ---------- CSV + SLA básico de status ----------
function parseCSV(text) {
  const lines = String(text || "").split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) return [];

  const headerLine = lines[0].replace(/^\uFEFF/, "");
  const headers = headerLine.split(",").map(h => h.trim());

  const splitCSV = (line) => line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCSV(lines[i]);
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      const key = headers[j];
      obj[key] = (cols[j] || "").replace(/^"|"$/g, "").trim();
    }
    if (Object.values(obj).some(v => v && String(v).trim() !== "")) data.push(obj);
  }
  return data;
}

function contarAbertosFechados(rows) {
  let fechados = 0;
  (rows || []).forEach(r => {
    const st = (r["Status"] || "").toLowerCase();
    if (st.includes("closed") || st.includes("resolved")) fechados++;
  });
  return { abertos: (rows || []).length - fechados, fechados };
}

function msg(html, tipo="warning") {
  const el = document.getElementById("msgComparativo");
  if (!el) return;
  el.innerHTML = `<div class="alert alert-${tipo} py-2 mb-0">${html}</div>`;
}

// Plugin nativo para escrever valores em cima das barras
const plumaValueLabels = {
  id: "plumaValueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.fillStyle = "#111";

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;

      meta.data.forEach((bar, index) => {
        const value = dataset.data[index];
        if (value === null || value === undefined) return;
        ctx.fillText(String(value), bar.x, bar.y - 6);
      });
    });

    ctx.restore();
  }
};

async function carregarComparativo() {
  try {
    const [t25, t26] = await Promise.all([
      fetch("dados_sr_2025.csv", { cache: "no-store" }).then(r => {
        if (!r.ok) throw new Error("Não encontrei dados_sr_2025.csv na raiz do site.");
        return r.text();
      }),
      fetch("dados_sr_2026.csv", { cache: "no-store" }).then(r => {
        if (!r.ok) throw new Error("Não encontrei dados_sr_2026.csv na raiz do site.");
        return r.text();
      })
    ]);

    const d25 = parseCSV(t25);
    const d26 = parseCSV(t26);

    if (!d25.length || !d26.length) {
      msg("CSV carregou, mas veio vazio ou com cabeçalho inesperado.", "warning");
      return;
    }

    const c25 = contarAbertosFechados(d25);
    const c26 = contarAbertosFechados(d26);

    const canvas = document.getElementById("graficoComparativoAnos");
    if (!canvas) return;

    if (window.__plumaChartComparativo) window.__plumaChartComparativo.destroy();

    window.__plumaChartComparativo = new Chart(canvas, {
      type: "bar",
      data: {
        labels: ["Abertos", "Fechados"],
        datasets: [
          { label: "2025", data: [c25.abertos, c25.fechados] },
          { label: "2026", data: [c26.abertos, c26.fechados] }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top" } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      },
      plugins: [plumaValueLabels]
    });

    msg(
      `2025: <b>${c25.abertos}</b> abertos / <b>${c25.fechados}</b> fechados • ` +
      `2026: <b>${c26.abertos}</b> abertos / <b>${c26.fechados}</b> fechados`,
      "success"
    );
  } catch (e) {
    console.warn(e);
    msg(e.message, "warning");
  }
}

carregarComparativo();

// ---------- Atualização no header (index.html) ----------
function parseCSVSimples(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  if (!lines.length) return [];
  const headers = lines[0].replace(/^\uFEFF/, "").split(",").map(h => h.trim());
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (cols[idx] || "").replace(/^"|"$/g, "").trim());
    data.push(obj);
  }
  return data;
}

function extrairUltimoValorAtualizacao(dados) {
  if (!dados || !dados.length) return "";
  const normaliza = (s) => String(s || "")
    .trim().toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/_/g, " ");

  const nomesAceitos = ["gerado em", "atualizado em", "gerado_em", "atualizado_em"].map(normaliza);
  const chaves = Object.keys(dados[0] || {});
  const chave = chaves.find(k => nomesAceitos.includes(normaliza(k)));
  if (!chave) return "";

  for (let i = dados.length - 1; i >= 0; i--) {
    const v = dados[i][chave];
    if (v && String(v).trim()) return String(v).trim();
  }
  return "";
}

async function carregarAtualizacaoHeader() {
  const el = document.getElementById("atualizadoEm");
  if (!el) return;

  const tentativas = ["dados_sr.csv", "dados_sr_2026.csv", "dados_sr_2025.csv"];
  for (const arq of tentativas) {
    try {
      const resp = await fetch(arq, { cache: "no-store" });
      if (!resp.ok) continue;
      const txt = await resp.text();
      const dados = parseCSVSimples(txt);
      const v = extrairUltimoValorAtualizacao(dados);
      if (v) { el.textContent = v; return; }
    } catch (e) { /* ignora e tenta próximo */ }
  }
  el.textContent = "-";
}

document.addEventListener("DOMContentLoaded", carregarAtualizacaoHeader);
