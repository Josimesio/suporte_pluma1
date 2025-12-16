let dadosBrutos = [];
let chartServico, chartSeveridade, chartData, chartIssueType;

let indiceModulo = 0;
let listaModulos = [];
let timeoutRotacao = null;

// ===============================
// REGISTRO DO PLUGIN DE RÓTULOS
// ===============================
Chart.register(ChartDataLabels);

// ===============================
// ANIMAÇÃO VISUAL DE ATUALIZAÇÃO
// ===============================
function animarAtualizacao() {
    const kpiCards = document.querySelectorAll(".kpi-card");
    const graficoCards = document.querySelectorAll(".grafico-card");
    const tabelaCard = document.querySelector(".tabela-card");

    [...kpiCards, ...graficoCards, tabelaCard].forEach(el => {
        if (!el) return;
        el.classList.remove("animate-update");
        void el.offsetWidth; // reflow
        el.classList.add("animate-update");
    });
}

// ===============================
// ROTACIONAR MÓDULOS (10s / 15s em "Todos")
// ===============================
function agendarProximaRotacao() {
    const seletor = document.getElementById("filtroServico");
    if (!seletor || listaModulos.length === 0) return;

    const valor = listaModulos[indiceModulo];
    seletor.value = valor;
    atualizarDashboard();

    const delay = (valor === "") ? 150000 : 10000; // 15s em "Todos", 10s nos módulos
    indiceModulo = (indiceModulo + 1) % listaModulos.length;

    timeoutRotacao = setTimeout(agendarProximaRotacao, delay);
}

function iniciarRotacaoAutomatica() {
    const seletor = document.getElementById("filtroServico");
    if (!seletor) return;

    const valores = Array.from(seletor.options).map(o => o.value);
    const todos = ""; // valor da opção "Todos"
    const modulos = valores.filter(v => v !== "");

    // sequência: Todos -> módulo1 -> módulo2 -> ...
    listaModulos = [todos, ...modulos];

    if (listaModulos.length === 0) return;

    if (timeoutRotacao) clearTimeout(timeoutRotacao);
    indiceModulo = 0;
    agendarProximaRotacao();
}

// ===============================
// MODO TV / TELA CHEIA
// ===============================
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
    if (!document.fullscreenElement) {
        document.body.classList.remove("tv-mode");
        if (btn) btn.textContent = "🎬 Modo TV";
    } else {
        document.body.classList.add("tv-mode");
        if (btn) btn.textContent = "⏹ Sair Modo TV";
    }
});

// ===============================
// FUNÇÕES DE CONTAGEM E PARSE
// ===============================
function contarPorCampo(lista, campo) {
    const mapa = {};
    lista.forEach(item => {
        const valor = item[campo] || "Não informado";
        mapa[valor] = (mapa[valor] || 0) + 1;
    });
    return mapa;
}

function valoresUnicos(lista, campo) {
    return Array.from(new Set(
        lista.map(item => item[campo]).filter(v => v && v.trim() !== "")
    )).sort();
}

function parseCSV(texto) {
    const linhas = texto.split(/\r?\n/).filter(l => l.trim() !== "");
    const cabecalho = linhas[0].split(",");
    const dados = [];

    for (let i = 1; i < linhas.length; i++) {
        const cols = linhas[i].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
        const obj = {};
        for (let j = 0; j < cabecalho.length; j++) {
            obj[cabecalho[j].trim()] = (cols[j] || "").replace(/^"|"$/g, "").trim();
        }
        dados.push(obj);
    }
    return dados;
}

// ===============================
// FILTROS E BUSCA
// ===============================
function filtrarDados() {
    const servico = document.getElementById("filtroServico").value;
    const status = document.getElementById("filtroStatus").value;
    const severidade = document.getElementById("filtroSeveridade").value;

    return dadosBrutos.filter(item => {
        if (servico && item["Serviço"] !== servico) return false;
        if (status && item["Status"] !== status) return false;
        if (severidade && item["Severidade"] !== severidade) return false;
        return true;
    });
}

function aplicarBusca(dados) {
    const campoBusca = document.getElementById("buscaTabela");
    if (!campoBusca) return dados;

    const termo = campoBusca.value.trim().toLowerCase();
    if (!termo) return dados;

    return dados.filter(d => {
        return [
            d["Número SR"],
            d["Serviço"],
            d["Issue Type"],
            d["Status"],
            d["Contato Primário"]
        ].some(campo => (campo || "").toLowerCase().includes(termo));
    });
}

// ===============================
// KPIs
// ===============================
function atualizarKPIs(dados) {
    const total = dados.length;

    // "Fechados" com base no Status
    const fechados = dados.filter(d => {
        const st = (d["Status"] || "").toLowerCase();
        return st.includes("closed") || st.includes("close requested") || st.includes("resolved");
    }).length;

    document.getElementById("kpiTotal").innerText = total;
    document.getElementById("kpiAbertos").innerText = total - fechados;
    document.getElementById("kpiFechados").innerText = fechados;

    const porServico = contarPorCampo(dados, "Serviço");
    let topModulo = "-";
    let max = 0;

    for (const [serv, qtd] of Object.entries(porServico)) {
        if (qtd > max) {
            max = qtd;
            topModulo = serv;
        }
    }
    document.getElementById("kpiTopModulo").innerText = topModulo;
}

// ===============================
// OPÇÕES DE ANIMAÇÃO GRÁFICOS
// ===============================
function chartAnimOptions(extra = {}) {
    return {
        responsive: true,
        animation: {
            duration: 800,
            easing: "easeOutQuart"
        },
        ...extra
    };
}

// ===============================
// GRÁFICO: SRs por Serviço (BARRAS)
// ===============================
function atualizarGraficoPorServico(dados) {
    const contagem = contarPorCampo(dados, "Serviço");
    const labels = Object.keys(contagem);
    const valores = Object.values(contagem);

    if (chartServico) chartServico.destroy();

    chartServico = new Chart(document.getElementById("graficoPorServico"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: "#006E51",
                borderRadius: 4
            }]
        },
        options: chartAnimOptions({
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: "#000",
                    anchor: "end",
                    align: "top",
                    font: { weight: "bold", size: 10 }
                }
            },
            scales: {
                x: { ticks: { autoSkip: true, maxRotation: 45, minRotation: 0 } },
                y: { beginAtZero: true, precision: 0 }
            }
        })
    });
}

// ===============================
// GRÁFICO: SRs por Severidade (PIZZA)
// ===============================
function atualizarGraficoPorSeveridade(dados) {
    const contagem = contarPorCampo(dados, "Severidade");
    const labels = Object.keys(contagem);
    const valores = Object.values(contagem);

    if (chartSeveridade) chartSeveridade.destroy();

    chartSeveridade = new Chart(document.getElementById("graficoPorSeveridade"), {
        type: "pie",
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: ["#006E51", "#F2C700", "#003F35", "#77C29B", "#AAAAAA"]
            }]
        },
        options: chartAnimOptions({
            plugins: {
                legend: { position: "bottom" },
                datalabels: {
                    color: "#000",
                    formatter: (v) => v,
                    font: { weight: "bold", size: 10 }
                }
            }
        })
    });
}

// ===============================
// GRÁFICO: SRs por Data de Criação (LINHA)
// ===============================
function atualizarGraficoPorData(dados) {
    const mapa = {};

    dados.forEach(d => {
        const dt = d["Criado_dt"];
        if (!dt) return;
        const data = new Date(dt);
        if (isNaN(data)) return;
        const chave = data.toISOString().slice(0, 10);
        mapa[chave] = (mapa[chave] || 0) + 1;
    });

    const labels = Object.keys(mapa).sort();
    const valores = labels.map(l => mapa[l]);

    if (chartData) chartData.destroy();

    chartData = new Chart(document.getElementById("graficoPorData"), {
        type: "line",
        data: {
            labels,
            datasets: [{
                data: valores,
                borderColor: "#003F35",
                backgroundColor: "#003F3533",
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: chartAnimOptions({
            plugins: {
                legend: { display: false },
                datalabels: {
                    align: "top",
                    anchor: "end",
                    color: "#000",
                    font: { weight: "bold", size: 10 }
                }
            },
            scales: {
                y: { beginAtZero: true, precision: 0 }
            }
        })
    });
}

// ===============================
// GRÁFICO: SRs por Tipo de Ocorrência (BARRAS HORIZONTAIS)
// ===============================
function atualizarGraficoPorIssueType(dados) {
    const contagem = contarPorCampo(dados, "Issue Type");
    const labels = Object.keys(contagem);
    const valores = Object.values(contagem);

    if (chartIssueType) chartIssueType.destroy();

    chartIssueType = new Chart(document.getElementById("graficoPorIssueType"), {
        type: "bar",
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: "#F2C700",
                borderRadius: 4
            }]
        },
        options: chartAnimOptions({
            indexAxis: "y",
            plugins: {
                legend: { display: false },
                datalabels: {
                    color: "#000",
                    align: "right",
                    anchor: "end",
                    font: { weight: "bold", size: 10 }
                }
            },
            scales: {
                x: { beginAtZero: true, precision: 0 }
            }
        })
    });
}

// ===============================
// TABELA
// ===============================
function atualizarTabela(dados) {
    const tb = document.getElementById("tabelaSRs");
    tb.innerHTML = "";

    dados.forEach(d => {
        const tr = document.createElement("tr");

        [
            "Número SR",
            "Serviço",
            "Issue Type",
            "Status",
            "Severidade",
            "Criado_dt",
            "Atualizado_dt",
            "Contato Primário"
        ].forEach(campo => {
            const td = document.createElement("td");
            td.textContent = d[campo] || "";
            tr.appendChild(td);
        });

        tb.appendChild(tr);
    });
}

// ===============================
// ATUALIZAÇÃO GERAL
// ===============================
function atualizarDashboard() {
    let filtrados = filtrarDados();
    filtrados = aplicarBusca(filtrados);

    atualizarKPIs(filtrados);
    atualizarGraficoPorServico(filtrados);
    atualizarGraficoPorSeveridade(filtrados);
    atualizarGraficoPorData(filtrados);
    atualizarGraficoPorIssueType(filtrados);
    atualizarTabela(filtrados);

    animarAtualizacao();
}

// ===============================
// INICIALIZAÇÃO
// ===============================
function preencherFiltros() {
    const servicos = valoresUnicos(dadosBrutos, "Serviço");
    const status = valoresUnicos(dadosBrutos, "Status");
    const severidades = valoresUnicos(dadosBrutos, "Severidade");

    const selServico = document.getElementById("filtroServico");
    const selStatus = document.getElementById("filtroStatus");
    const selSeveridade = document.getElementById("filtroSeveridade");

    servicos.forEach(v => selServico.innerHTML += `<option value="${v}">${v}</option>`);
    status.forEach(v => selStatus.innerHTML += `<option value="${v}">${v}</option>`);
    severidades.forEach(v => selSeveridade.innerHTML += `<option value="${v}">${v}</option>`);
}

async function carregarDados() {
    const resp = await fetch("dados_sr.csv");
    const texto = await resp.text();

    dadosBrutos = parseCSV(texto);

    preencherFiltros();
    atualizarDashboard();
    iniciarRotacaoAutomatica();

    document.getElementById("filtroServico").addEventListener("change", atualizarDashboard);
    document.getElementById("filtroStatus").addEventListener("change", atualizarDashboard);
    document.getElementById("filtroSeveridade").addEventListener("change", atualizarDashboard);
    document.getElementById("buscaTabela").addEventListener("input", atualizarDashboard);

    const btnTv = document.getElementById("btnTvMode");
    if (btnTv) btnTv.addEventListener("click", toggleTvMode);
}

carregarDados();
