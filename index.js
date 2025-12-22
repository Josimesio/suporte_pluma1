/* index.js - Página: index.html */

(function () {
  "use strict";

  // ===== UI: status/erro (anti tela branca)
  const statusBox = document.getElementById("statusBox");
  const uploadBox = document.getElementById("uploadBox");
  const fileInput  = document.getElementById("fileInput");

  function setStatus(tipo, html) {
    if (!statusBox) return;
    statusBox.className = `alert alert-${tipo} py-2 mb-0`;
    statusBox.innerHTML = html;
  }

  function showUpload(mostrar) {
    if (!uploadBox) return;
    uploadBox.classList.toggle("d-none", !mostrar);
  }

  window.addEventListener("error", (e) => {
    setStatus("danger", `Erro no JavaScript: <b>${e.message || "desconhecido"}</b>`);
    showUpload(true);
  });

  // ===== CSV Parser
  function parseCSV(texto) {
    const linhas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
    if (!linhas.length) return [];

    const cabecalho = linhas[0].split(",").map(h => h.trim());
    if (cabecalho[0]) cabecalho[0] = cabecalho[0].replace(/^\uFEFF/, "");

    const dados = [];
    for (let i = 1; i < linhas.length; i++) {
      const cols = linhas[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      const obj = {};
      for (let j = 0; j < cabecalho.length; j++) {
        obj[cabecalho[j]] = (cols[j] || "").replace(/^"|"$/g, "").trim();
      }
      if (Object.values(obj).some(v => String(v || "").trim() !== "")) dados.push(obj);
    }
    return dados;
  }

  function contarPorCampo(lista, campo) {
    const mapa = {};
    (lista || []).forEach(item => {
      const v = (item[campo] || "").trim() || "Não informado";
      mapa[v] = (mapa[v] || 0) + 1;
    });
    return mapa;
  }

  function valoresUnicos(lista, campo) {
    return Array.from(new Set(
      (lista || []).map(item => (item[campo] || "").trim()).filter(v => v !== "")
    )).sort((a,b)=>a.localeCompare(b, "pt-BR"));
  }

  // ===== Atualizado em: coluna "Gerado em" (padrão do dados_sr.csv)
  function atualizarHeaderAtualizadoEm(dados) {
    const el = document.getElementById("atualizadoEm");
    if (!el || !dados || !dados.length) {
      if (el) el.textContent = "-";
      return;
    }

    const normaliza = (s) =>
      String(s || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ")
        .replace(/_/g, " ");

    const nomesAceitos = [
      "gerado em",
      "atualizado em",
      "gerado_em",
      "atualizado_em"
    ].map(normaliza);

    const chaves = Object.keys(dados[0] || {});
    const chaveEncontrada = chaves.find(k => nomesAceitos.includes(normaliza(k)));

    if (!chaveEncontrada) {
      el.textContent = "-";
      return;
    }

    let ultimo = "";
    for (const r of dados) {
      const v = String(r[chaveEncontrada] || "").trim();
      if (v) ultimo = v;
    }
    el.textContent = ultimo || "-";
  }

  // ===== Estado
  let dadosBrutos = [];

  // ===== Filtros
  function preencherSelect(id, valores) {
    const sel = document.getElementById(id);
    if (!sel) return;

    const atual = sel.value;
    sel.innerHTML = `<option value="">Todos</option>`;
    (valores || []).forEach(v => {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
    if (atual) sel.value = atual;
  }

  function preencherFiltros() {
    preencherSelect("filtroServico", valoresUnicos(dadosBrutos, "Serviço"));
    preencherSelect("filtroStatus", valoresUnicos(dadosBrutos, "Status"));
    preencherSelect("filtroSeveridade", valoresUnicos(dadosBrutos, "Severidade"));
  }

  function filtrarDados() {
    const servico = document.getElementById("filtroServico")?.value || "";
    const status = document.getElementById("filtroStatus")?.value || "";
    const severidade = document.getElementById("filtroSeveridade")?.value || "";

    return (dadosBrutos || []).filter(item => {
      if (servico && item["Serviço"] !== servico) return false;
      if (status && item["Status"] !== status) return false;
      if (severidade && item["Severidade"] !== severidade) return false;
      return true;
    });
  }

  function aplicarBusca(dados) {
    const termo = (document.getElementById("buscaTabela")?.value || "").trim().toLowerCase();
    if (!termo) return dados;

    return (dados || []).filter(d => {
      const campos = [
        d["Número SR"],
        d["Serviço"],
        d["Issue Type"],
        d["Status"],
        d["Severidade"],
        d["Contato Primário"]
      ];
      return campos.some(c => String(c || "").toLowerCase().includes(termo));
    });
  }

  // ===== KPIs
  function atualizarKPIs(dados) {
    const totalEl = document.getElementById("kpiTotal");
    const abertosEl = document.getElementById("kpiAbertos");
    const fechadosEl = document.getElementById("kpiFechados");
    const topModuloEl = document.getElementById("kpiTopModulo");

    if (!totalEl || !abertosEl || !fechadosEl || !topModuloEl) return;

    const total = (dados || []).length;

    const fechados = (dados || []).filter(d => {
      const st = String(d["Status"] || "").toLowerCase();
      return st.includes("closed") || st.includes("close requested") || st.includes("resolved") || st.includes("fechado");
    }).length;

    totalEl.textContent = String(total);
    abertosEl.textContent = String(total - fechados);
    fechadosEl.textContent = String(fechados);

    const porServico = contarPorCampo(dados, "Serviço");
    let top = "-";
    let max = 0;
    for (const [k, v] of Object.entries(porServico)) {
      if (v > max) { max = v; top = k; }
    }
    topModuloEl.textContent = top;
  }

  // ===== Tabela
  function atualizarTabela(dados) {
    const tb = document.getElementById("tabelaSRs");
    if (!tb) return;

    tb.innerHTML = "";
    (dados || []).forEach(d => {
      const tr = document.createElement("tr");
      const cols = ["Número SR","Serviço","Issue Type","Status","Severidade","Criado_dt","Atualizado_dt","Contato Primário"];
      cols.forEach(c => {
        const td = document.createElement("td");
        td.textContent = d[c] || "";
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  }

  function atualizarPagina() {
    let dados = filtrarDados();
    dados = aplicarBusca(dados);
    atualizarKPIs(dados);
    atualizarTabela(dados);
  }

  // ===== Modo TV
  function toggleTvMode() {
    const btn = document.getElementById("btnTvMode");
    const emTelaCheia = !!document.fullscreenElement;

    if (!emTelaCheia) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      document.body.classList.add("tv-mode");
      if (btn) btn.textContent = "⏹ Sair Modo TV";
    } else {
      document.exitFullscreen?.();
      document.body.classList.remove("tv-mode");
      if (btn) btn.textContent = "🎬 Modo TV";
    }
  }

  document.addEventListener("fullscreenchange", () => {
    const btn = document.getElementById("btnTvMode");
    if (!btn) return;

    if (!document.fullscreenElement) {
      document.body.classList.remove("tv-mode");
      btn.textContent = "🎬 Modo TV";
    } else {
      document.body.classList.add("tv-mode");
      btn.textContent = "⏹ Sair Modo TV";
    }
  });

  // ===== Carregar dados (web + fallback)
  async function carregarDadosViaFetch() {
    const csvUrl = new URL("dados_sr.csv", document.baseURI).href;
    const resp = await fetch(csvUrl, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status} ao buscar ${csvUrl}`);
    return parseCSV(await resp.text());
  }

  async function iniciar() {
    document.getElementById("btnTvMode")?.addEventListener("click", toggleTvMode);
    document.getElementById("filtroServico")?.addEventListener("change", atualizarPagina);
    document.getElementById("filtroStatus")?.addEventListener("change", atualizarPagina);
    document.getElementById("filtroSeveridade")?.addEventListener("change", atualizarPagina);
    document.getElementById("buscaTabela")?.addEventListener("input", atualizarPagina);

    fileInput?.addEventListener("change", async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      const texto = await file.text();
      dadosBrutos = parseCSV(texto);
      atualizarHeaderAtualizadoEm(dadosBrutos);
      preencherFiltros();
      atualizarPagina();
      setStatus("success", `Dados carregados via arquivo: <b>${file.name}</b>`);
      showUpload(false);
    });

    try {
      setStatus("info", `Carregando dados... (tentando <b>dados_sr.csv</b>)`);
      dadosBrutos = await carregarDadosViaFetch();
      atualizarHeaderAtualizadoEm(dadosBrutos);
      preencherFiltros();
      atualizarPagina();
      setStatus("success", `Dados carregados com sucesso: <b>${dadosBrutos.length}</b> registros.`);
      showUpload(false);
    } catch (err) {
      console.error(err);
      setStatus(
        "danger",
        `Falha ao carregar <b>dados_sr.csv</b> via web. Motivo: <b>${err.message}</b><br>` +
        `<span class="small">Se estiver em <b>GitHub Pages</b>, confira se o arquivo existe no repositório com o nome exato. Se abriu por <b>file://</b>, selecione o CSV abaixo.</span>`
      );
      showUpload(true);
    }
  }

  iniciar();
})();
