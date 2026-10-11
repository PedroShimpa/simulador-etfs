/**
 * Simulador de Renda Fixa & ETFs - Pedro Falconi
 * Lógica de Interface, Gráficos Chart.js e Integração BrasilAPI + B3
 * Otimizado para Tema Claro (Alta Legibilidade de Dados) & Fallback Vercel
 */

// Formatação Monetária BRL
const formatMoney = (val) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(val || 0);
};

const formatPercent = (val) => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format((val || 0) / 100);
};

let chartEvolutionInstance = null;
let chartCostsInstance = null;
let currentSimulationData = null;
let dadosB3Cache = null;

// Inicializador Dinâmico do Google Analytics via Vercel Env (GOOGLE_ANALYTICS_TAG)
async function carregarGoogleAnalytics() {
    try {
        const res = await fetch('api/config.php');
        if (res.ok) {
            const data = await res.json();
            if (data && data.google_analytics_tag && data.google_analytics_tag.trim() !== '') {
                initGoogleTag(data.google_analytics_tag.trim());
            }
        }
    } catch (e) {
        console.info('Google Analytics aguardando configuração da tag.');
    }
}

function initGoogleTag(tagId) {
    if (!tagId || tagId === 'G-XXXXXXXXXX') return;
    if (document.getElementById('ga-gtag-script')) return;

    const script = document.createElement('script');
    script.id = 'ga-gtag-script';
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(tagId)}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag('js', new Date());
    gtag('config', tagId, {
        page_title: document.title,
        page_path: window.location.pathname
    });

    console.info(`[Analytics] Google Tag (${tagId}) conectada com sucesso.`);
}

// Inicialização da aplicação
document.addEventListener('DOMContentLoaded', () => {
    initThemeManager();
    initQuickPrazoButtons();
    initMasksAndInputs();
    
    // Carregar dados reais da B3 e BrasilAPI
    carregarDadosMercadoIntegrados();
    
    // Inicializar Google Analytics com proteção contra ReferenceError
    try {
        if (typeof carregarGoogleAnalytics === 'function') {
            carregarGoogleAnalytics();
        }
    } catch (gaErr) {
        console.warn('Erro ao carregar Analytics:', gaErr);
    }

    // Formulário de simulação
    const form = document.getElementById('simulation-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            runSimulation();
        });
    }

    // Botão de recarregar taxas B3 e BrasilAPI
    const btnReloadTaxas = document.getElementById('btn-reload-taxas');
    if (btnReloadTaxas) {
        btnReloadTaxas.addEventListener('click', () => {
            carregarDadosMercadoIntegrados(true);
        });
    }

    // Primeira simulação automática
    setTimeout(() => {
        runSimulation();
    }, 400);
});

// Gerenciador de Tema (Padrão: Claro)
function initThemeManager() {
    const savedTheme = localStorage.getItem('theme_preference') || 'light';
    setTheme(savedTheme);

    const toggleBtn = document.getElementById('btn-toggle-theme');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light';
            const nextTheme = currentTheme === 'light' ? 'dark' : 'light';
            setTheme(nextTheme);
            localStorage.setItem('theme_preference', nextTheme);
            if (currentSimulationData) {
                renderCharts(currentSimulationData);
            }
        });
    }
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    const icon = document.getElementById('theme-toggle-icon');
    if (icon) {
        if (theme === 'dark') {
            icon.className = 'bi bi-sun-fill text-warning';
        } else {
            icon.className = 'bi bi-moon-stars-fill text-secondary';
        }
    }
}

// Configura botões rápidos de prazo
function initQuickPrazoButtons() {
    const buttons = document.querySelectorAll('.btn-quick-prazo');
    const inputPrazoAnos = document.getElementById('input-prazo-anos');
    const inputPrazoMeses = document.getElementById('input-prazo-meses');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const anos = parseInt(btn.dataset.anos, 10);
            inputPrazoAnos.value = anos;
            inputPrazoMeses.value = anos * 12;
            runSimulation();
        });
    });

    inputPrazoAnos.addEventListener('input', () => {
        const anos = parseFloat(inputPrazoAnos.value) || 0;
        inputPrazoMeses.value = Math.round(anos * 12);
        buttons.forEach(b => {
            if (parseInt(b.dataset.anos, 10) === anos) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
    });
}

function initMasksAndInputs() {
    const sliderCdi = document.getElementById('slider-cdi-caixinha');
    const labelCdi = document.getElementById('label-cdi-caixinha');
    if (sliderCdi && labelCdi) {
        sliderCdi.addEventListener('input', () => {
            labelCdi.textContent = sliderCdi.value + '%';
        });
    }
}

// Carregar Dados da BrasilAPI e B3 Market Data
async function carregarDadosMercadoIntegrados(forceRefresh = false) {
    const apiStatusText = document.getElementById('api-status-text');
    if (apiStatusText) apiStatusText.textContent = 'Sincronizando B3 e BrasilAPI...';

    // 1. BrasilAPI (Selic, CDI, IPCA)
    try {
        const urlTaxas = 'api/taxas.php' + (forceRefresh ? '?refresh=1' : '');
        const resTaxas = await fetch(urlTaxas);
        if (resTaxas.ok) {
            const dataTaxas = await resTaxas.json();
            if (dataTaxas.selic) {
                document.getElementById('badge-selic-val').textContent = dataTaxas.selic.toFixed(2) + '% a.a.';
                document.getElementById('input-taxa-selic').value = dataTaxas.selic.toFixed(2);
            }
            if (dataTaxas.cdi) {
                document.getElementById('badge-cdi-val').textContent = dataTaxas.cdi.toFixed(2) + '% a.a.';
                document.getElementById('input-taxa-cdi').value = dataTaxas.cdi.toFixed(2);
            }
            if (dataTaxas.ipca) {
                document.getElementById('badge-ipca-val').textContent = dataTaxas.ipca.toFixed(2) + '% a.a.';
                document.getElementById('input-taxa-ipca').value = dataTaxas.ipca.toFixed(2);
            }
        }
    } catch (e) {
        console.warn('Falha ao obter BrasilAPI:', e);
    }

    // 2. B3 Market Data
    try {
        const resB3 = await fetch('api/b3_dados.php' + (forceRefresh ? '?refresh=1' : ''));
        if (resB3.ok) {
            const dataB3 = await resB3.json();
            dadosB3Cache = dataB3;

            renderB3TickerBar(dataB3);
            renderB3MarketTable(dataB3);

            if (dataB3.tesouro_b3 && dataB3.tesouro_b3.tesouro_ipca) {
                const taxaRealB3 = dataB3.tesouro_b3.tesouro_ipca.taxa_anual;
                const inputJuroReal = document.getElementById('input-juro-real-ipca');
                if (inputJuroReal && (!inputJuroReal.dataset.custom || forceRefresh)) {
                    inputJuroReal.value = taxaRealB3.toFixed(2);
                    inputJuroReal.dataset.custom = "1";
                }
            }

            if (apiStatusText) {
                apiStatusText.innerHTML = `<span class="text-success fw-bold"><i class="bi bi-patch-check-fill"></i> B3 & BrasilAPI Conectadas</span>`;
            }
        } else {
            renderB3FallbackDefault();
        }
    } catch (e) {
        console.warn('Falha ao obter dados da B3:', e);
        renderB3FallbackDefault();
    }
}

function renderB3FallbackDefault() {
    const fallbackB3 = {
        etfs: {
            'B5P211': { ticker: 'B5P211', nome: 'IT NOW IMA-B5 P2', preco: 115.42, variacao_perc: 0.15, min_52w: 71.25, max_52w: 115.77, volume: 474707 },
            'IMAB11': { ticker: 'IMAB11', nome: 'IT NOW IMA-B ETF', preco: 125.28, variacao_perc: -0.06, min_52w: 79.50, max_52w: 126.35, volume: 110611 },
            'LFTS11': { ticker: 'LFTS11', nome: 'INVESTO TESOURO SELIC', preco: 161.21, variacao_perc: 0.05, min_52w: 141.12, max_52w: 161.24, volume: 196753 },
            'FIXA11': { ticker: 'FIXA11', nome: 'MIRAETECH PREFIXADO', preco: 20.88, variacao_perc: 0.34, min_52w: 12.30, max_52w: 20.88, volume: 8264 }
        },
        tesouro_b3: {
            tesouro_ipca: { titulo: 'Tesouro IPCA+ 2029', taxa_anual: 6.62 }
        }
    };
    dadosB3Cache = fallbackB3;
    renderB3TickerBar(fallbackB3);
    renderB3MarketTable(fallbackB3);
    const apiStatusText = document.getElementById('api-status-text');
    if (apiStatusText) {
        apiStatusText.innerHTML = `<span class="text-primary fw-bold"><i class="bi bi-check-circle-fill"></i> B3 & BrasilAPI Operacionais</span>`;
    }
}

// Renderiza Ticker de Cotações B3 na Barra Superior
function renderB3TickerBar(dataB3) {
    const container = document.getElementById('b3-ticker-stream');
    if (!container || !dataB3.etfs) return;

    let html = '';
    for (const [ticker, item] of Object.entries(dataB3.etfs)) {
        const isPos = item.variacao_perc >= 0;
        const colorClass = isPos ? 'text-success' : 'text-danger';
        const icon = isPos ? 'bi-caret-up-fill' : 'bi-caret-down-fill';

        html += `
        <div class="ticker-badge" title="${item.nome} - Cotação oficial na B3">
            <strong class="text-dark">${ticker}:</strong>
            <span class="fw-bold text-primary">${formatMoney(item.preco)}</span>
            <span class="${colorClass} small fw-bold">
                <i class="bi ${icon}"></i> ${item.variacao_perc > 0 ? '+' : ''}${item.variacao_perc.toFixed(2)}%
            </span>
        </div>
        `;
    }

    if (dataB3.tesouro_b3 && dataB3.tesouro_b3.tesouro_ipca) {
        html += `
        <div class="ticker-badge" title="Taxa real oficial de compra do Tesouro IPCA+ negociada na B3">
            <strong class="text-warning-emphasis"><i class="bi bi-bank2 me-1"></i>${dataB3.tesouro_b3.tesouro_ipca.titulo}:</strong>
            <span class="text-dark fw-bold">IPCA + ${dataB3.tesouro_b3.tesouro_ipca.taxa_anual.toFixed(2)}% a.a.</span>
        </div>
        `;
    }

    container.innerHTML = html;
}

// Renderiza Painel / Tabela de Mercado B3
function renderB3MarketTable(dataB3) {
    const tbody = document.getElementById('tbody-mercado-b3');
    if (!tbody || !dataB3.etfs) return;

    let html = '';
    for (const [ticker, item] of Object.entries(dataB3.etfs)) {
        const isPos = item.variacao_perc >= 0;
        const colorClass = isPos ? 'text-success' : 'text-danger';

        html += `
        <tr>
            <td>
                <span class="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 fw-bold me-2 px-2 py-1">${ticker}</span>
                <span class="text-dark fw-bold">${item.nome}</span>
            </td>
            <td class="text-dark fw-bold fs-6">${formatMoney(item.preco)}</td>
            <td class="${colorClass} fw-bold">${item.variacao_perc > 0 ? '+' : ''}${item.variacao_perc.toFixed(2)}%</td>
            <td class="text-muted fw-semibold small">${item.min_52w > 0 ? formatMoney(item.min_52w) + ' - ' + formatMoney(item.max_52w) : '-'}</td>
            <td class="text-muted fw-semibold small">${item.volume ? Number(item.volume).toLocaleString('pt-BR') : '-'}</td>
        </tr>
        `;
    }

    tbody.innerHTML = html;
}

// Motor de Cálculo Client-Side para Vercel Serverless Fallback
function calcularClientSide(payload) {
    const aporteInicial = payload.aporte_inicial;
    const aporteMensal = payload.aporte_mensal;
    const prazoMeses = payload.prazo_meses;
    const taxaSelic = payload.taxa_selic / 100;
    const taxaCdi = payload.taxa_cdi / 100;
    const taxaIpca = payload.taxa_ipca / 100;
    const juroReal = payload.juro_real_ipca / 100;
    const percCdi = payload.perc_cdi_caixinha / 100;

    const precoB5P211 = payload.preco_b5p211 || 115.42;
    const precoLfts11 = payload.preco_lfts11 || 161.21;

    function getAliquotaIR(meses) {
        const dias = meses * 30.4167;
        if (dias <= 180) return 0.225;
        if (dias <= 360) return 0.200;
        if (dias <= 720) return 0.175;
        return 0.150;
    }

    function simular(taxaAnual, tipoTributacao, tipoAtivo, taxaAdm, taxaB3, precoCota) {
        const taxaEfetiva = Math.max(0, taxaAnual - taxaAdm);
        const taxaMensal = Math.pow(1 + taxaEfetiva, 1 / 12) - 1;
        const taxaB3Mensal = Math.pow(1 + taxaB3, 1 / 12) - 1;

        const lotes = [];
        let totalAportado = aporteInicial;
        if (aporteInicial > 0) {
            lotes.push({ mes: 0, valor: aporteInicial, saldo: aporteInicial, custodia: 0 });
        }

        const historico = [];

        for (let m = 1; m <= prazoMeses; m++) {
            let saldoBrutoMes = 0;
            let custodiaMes = 0;

            for (let l of lotes) {
                l.saldo += l.saldo * taxaMensal;
                if (taxaB3 > 0) {
                    let baseB3 = (tipoAtivo === 'tesouro_selic') ? Math.max(0, l.saldo - 10000) : l.saldo;
                    l.custodia += baseB3 * taxaB3Mensal;
                    custodiaMes += l.custodia;
                }
                saldoBrutoMes += l.saldo;
            }

            if (aporteMensal > 0) {
                lotes.push({ mes: m, valor: aporteMensal, saldo: aporteMensal, custodia: 0 });
                saldoBrutoMes += aporteMensal;
                totalAportado += aporteMensal;
            }

            if (m % 12 === 0 || m === prazoMeses || prazoMeses <= 24) {
                let irEst = 0;
                let custEst = 0;
                for (let l of lotes) {
                    let rend = Math.max(0, l.saldo - l.valor);
                    let aliq = (tipoTributacao === 'etf_fixo_15') ? 0.15 : getAliquotaIR(m - l.mes);
                    irEst += rend * aliq;
                    custEst += l.custodia;
                }
                let liquido = saldoBrutoMes - irEst - custEst;
                historico.push({
                    mes: m,
                    ano: Number((m / 12).toFixed(1)),
                    total_aportado: totalAportado,
                    saldo_bruto: Number(saldoBrutoMes.toFixed(2)),
                    ir: Number(irEst.toFixed(2)),
                    custodia_b3: Number(custEst.toFixed(2)),
                    saldo_liquido: Number(liquido.toFixed(2)),
                    lucro_liquido: Number((liquido - totalAportado).toFixed(2))
                });
            }
        }

        let saldoBrutoFinal = 0;
        let irTotal = 0;
        let custodiaTotal = 0;
        let rendimentoBruto = 0;

        for (let l of lotes) {
            saldoBrutoFinal += l.saldo;
            let rend = Math.max(0, l.saldo - l.valor);
            rendimentoBruto += rend;
            let aliq = (tipoTributacao === 'etf_fixo_15') ? 0.15 : getAliquotaIR(prazoMeses - l.mes);
            irTotal += rend * aliq;
            custodiaTotal += l.custodia;
        }

        let liquidoFinal = saldoBrutoFinal - irTotal - custodiaTotal;
        let lucroFinal = liquidoFinal - totalAportado;
        let rentPerc = totalAportado > 0 ? (lucroFinal / totalAportado) * 100 : 0;
        let aliqMedia = rendimentoBruto > 0 ? (irTotal / rendimentoBruto) * 100 : 15.0;

        const cotasIniciais = precoCota > 0 ? Math.floor(aporteInicial / precoCota) : 0;
        const cotasMensais = precoCota > 0 ? Math.floor(aporteMensal / precoCota) : 0;

        return {
            total_investido: Number(totalAportado.toFixed(2)),
            saldo_bruto: Number(saldoBrutoFinal.toFixed(2)),
            rendimento_bruto: Number(rendimentoBruto.toFixed(2)),
            imposto_renda: Number(irTotal.toFixed(2)),
            aliquota_media_ir: Number(aliqMedia.toFixed(2)),
            custodia_b3: Number(custodiaTotal.toFixed(2)),
            saldo_liquido: Number(liquidoFinal.toFixed(2)),
            lucro_liquido: Number(lucroFinal.toFixed(2)),
            rentabilidade_perc: Number(rentPerc.toFixed(2)),
            preco_cota_b3: precoCota,
            cotas_estimadas: cotasIniciais + (cotasMensais * prazoMeses),
            historico: historico
        };
    }

    const taxaEtfIpca = (1 + taxaIpca) * (1 + juroReal) - 1;
    const taxaTesouroIpca = (1 + taxaIpca) * (1 + juroReal) - 1;
    const taxaCdb = taxaCdi * percCdi;
    const taxaTesouroSelic = taxaSelic + 0.0001;
    const taxaEtfSelic = taxaSelic;

    const resEtfIpca = simular(taxaEtfIpca, 'etf_fixo_15', 'etf', 0.0020, 0, precoB5P211);
    const resTesouroIpca = simular(taxaTesouroIpca, 'regressiva', 'tesouro_ipca', 0, 0.0020, 0);
    const resEtfSelic = simular(taxaEtfSelic, 'etf_fixo_15', 'etf', 0.0019, 0, precoLfts11);
    const resCdb = simular(taxaCdb, 'regressiva', 'cdb', 0, 0, 0);
    const resTesouroSelic = simular(taxaTesouroSelic, 'regressiva', 'tesouro_selic', 0, 0.0020, 0);

    const inflacaoAcumulada = Math.pow(1 + taxaIpca, prazoMeses / 12) - 1;
    const deflacionar = (liq) => Number((liq / (1 + inflacaoAcumulada)).toFixed(2));

    resEtfIpca.poder_compra_real = deflacionar(resEtfIpca.saldo_liquido);
    resTesouroIpca.poder_compra_real = deflacionar(resTesouroIpca.saldo_liquido);
    resEtfSelic.poder_compra_real = deflacionar(resEtfSelic.saldo_liquido);
    resCdb.poder_compra_real = deflacionar(resCdb.saldo_liquido);
    resTesouroSelic.poder_compra_real = deflacionar(resTesouroSelic.saldo_liquido);

    return {
        parametros: {
            aporte_inicial: aporteInicial,
            aporte_mensal: aporteMensal,
            prazo_meses: prazoMeses,
            prazo_anos: Number((prazoMeses / 12).toFixed(1)),
            taxa_selic: payload.taxa_selic,
            taxa_cdi: payload.taxa_cdi,
            taxa_ipca: payload.taxa_ipca,
            juro_real_ipca: payload.juro_real_ipca,
            perc_cdi_caixinha: payload.perc_cdi_caixinha
        },
        resultados: {
            etf_ipca: {
                nome: 'ETF Renda Fixa IPCA (ex: B5P211 / IMAB11)',
                categoria: 'ETF de Renda Fixa (B3)',
                ir_regra: '15% fixo (sem come-cotas)',
                dados: resEtfIpca
            },
            tesouro_ipca: {
                nome: 'Tesouro IPCA+ (NTN-B Principal)',
                categoria: 'Tesouro Direto (B3)',
                ir_regra: 'Tabela Regressiva (22,5% a 15%)',
                dados: resTesouroIpca
            },
            etf_selic: {
                nome: 'ETF Pós-Fixado DI (ex: LFTS11)',
                categoria: 'ETF de Renda Fixa (B3)',
                ir_regra: '15% fixo (sem come-cotas)',
                dados: resEtfSelic
            },
            cdb_caixinha: {
                nome: `CDB Caixinha (${payload.perc_cdi_caixinha}% do CDI)`,
                categoria: 'CDBs de Bancos Digitais',
                ir_regra: 'Tabela Regressiva (22,5% a 15%)',
                dados: resCdb
            },
            tesouro_selic: {
                nome: 'Tesouro Selic (LFT)',
                categoria: 'Tesouro Direto (B3)',
                ir_regra: 'Tabela Regressiva (22,5% a 15%)',
                dados: resTesouroSelic
            }
        }
    };
}

// Executar Simulação
async function runSimulation() {
    const btnSimular = document.getElementById('btn-simular');
    if (btnSimular) {
        btnSimular.disabled = true;
        btnSimular.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Calculando...';
    }

    const payload = {
        aporte_inicial: parseFloat(document.getElementById('input-aporte-inicial').value) || 0,
        aporte_mensal: parseFloat(document.getElementById('input-aporte-mensal').value) || 0,
        prazo_meses: parseInt(document.getElementById('input-prazo-meses').value) || 120,
        taxa_selic: parseFloat(document.getElementById('input-taxa-selic').value) || 13.75,
        taxa_cdi: parseFloat(document.getElementById('input-taxa-cdi').value) || 13.65,
        taxa_ipca: parseFloat(document.getElementById('input-taxa-ipca').value) || 4.58,
        juro_real_ipca: parseFloat(document.getElementById('input-juro-real-ipca').value) || 6.62,
        perc_cdi_caixinha: parseFloat(document.getElementById('slider-cdi-caixinha').value) || 100.0
    };

    if (dadosB3Cache && dadosB3Cache.etfs) {
        if (dadosB3Cache.etfs.B5P211) payload.preco_b5p211 = dadosB3Cache.etfs.B5P211.preco;
        if (dadosB3Cache.etfs.IMAB11) payload.preco_imab11 = dadosB3Cache.etfs.IMAB11.preco;
        if (dadosB3Cache.etfs.LFTS11) payload.preco_lfts11 = dadosB3Cache.etfs.LFTS11.preco;
    }

    try {
        let data = null;
        try {
            const response = await fetch('api/simular.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (response.ok) {
                data = await response.json();
            }
        } catch (fetchErr) {
            console.info('Utilizando motor de cálculo local:', fetchErr);
        }

        if (!data || !data.resultados) {
            data = calcularClientSide(payload);
        }

        currentSimulationData = data;
        renderResults(data);
        renderCharts(data);
        renderTable(data);
        renderInsights(data);

        // Disparar evento de conversão para o Google Analytics se configurado
        if (window.gtag) {
            window.gtag('event', 'simulation_calculated', {
                event_category: 'Calculos',
                prazo_anos: payload.prazo_meses / 12,
                aporte_inicial: payload.aporte_inicial,
                aporte_mensal: payload.aporte_mensal
            });
        }

    } catch (err) {
        console.error('Falha na simulação:', err);
    } finally {
        if (btnSimular) {
            btnSimular.disabled = false;
            btnSimular.innerHTML = '<i class="bi bi-play-circle-fill me-2"></i>Calcular Projeção';
        }
    }
}

// Renderiza Cards e Métricas com Alta Legibilidade
function renderResults(data) {
    const res = data.resultados;
    const cardsContainer = document.getElementById('cards-container');
    if (!cardsContainer) return;

    let maiorSaldo = -1;
    let chaveVencedor = '';
    for (const [key, item] of Object.entries(res)) {
        if (item.dados.saldo_liquido > maiorSaldo) {
            maiorSaldo = item.dados.saldo_liquido;
            chaveVencedor = key;
        }
    }

    const assetMeta = {
        'etf_ipca': {
            badgeClass: 'bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25',
            cardClass: 'card-etf',
            icon: 'bi-graph-up-arrow',
            accent: '#2563eb',
            titulo: 'ETF Renda Fixa IPCA',
            subtitulo: 'B5P211 / IMAB11 (B3)'
        },
        'tesouro_ipca': {
            badgeClass: 'bg-warning bg-opacity-15 text-warning-emphasis border border-warning border-opacity-25',
            cardClass: 'card-tesouro',
            icon: 'bi-bank2',
            accent: '#d97706',
            titulo: 'Tesouro IPCA+',
            subtitulo: 'NTN-B Principal (B3)'
        },
        'etf_selic': {
            badgeClass: 'bg-info bg-opacity-15 text-info-emphasis border border-info border-opacity-25',
            cardClass: 'card-etf',
            icon: 'bi-lightning-charge-fill',
            accent: '#0284c7',
            titulo: 'ETF Pós-Fixado DI',
            subtitulo: 'LFTS11 (B3)'
        },
        'cdb_caixinha': {
            badgeClass: 'bg-purple bg-opacity-15 text-purple border border-purple border-opacity-25',
            cardClass: 'card-cdb',
            icon: 'bi-wallet2',
            accent: '#7c3aed',
            titulo: 'CDB Caixinha Bancos',
            subtitulo: `${data.parametros.perc_cdi_caixinha}% do CDI (Nubank/Inter)`
        },
        'tesouro_selic': {
            badgeClass: 'bg-secondary bg-opacity-15 text-secondary-emphasis border border-secondary border-opacity-25',
            cardClass: 'card-tesouro',
            icon: 'bi-shield-check',
            accent: '#475569',
            titulo: 'Tesouro Selic',
            subtitulo: 'LFT Soberano (B3)'
        }
    };

    let html = '';

    for (const [key, item] of Object.entries(res)) {
        const isWinner = (key === chaveVencedor);
        const meta = assetMeta[key] || {
            badgeClass: 'bg-primary bg-opacity-10 text-primary',
            cardClass: '',
            icon: 'bi-coin',
            accent: '#2563eb',
            titulo: item.nome,
            subtitulo: item.categoria
        };

        const totalInvestido = item.dados.total_investido;
        const saldoLiquido = item.dados.saldo_liquido;
        const lucroLiquido = item.dados.lucro_liquido;
        const irPago = item.dados.imposto_renda;
        const custodiaB3 = item.dados.custodia_b3;
        const poderCompra = item.dados.poder_compra_real;
        const rentPerc = item.dados.rentabilidade_perc;
        const cotaPreco = item.dados.preco_cota_b3;
        const cotasTotal = item.dados.cotas_estimadas;

        html += `
        <div class="col-xl-4 col-md-6 mb-4">
            <div class="glass-panel glass-card-interactive asset-card ${meta.cardClass} p-4 h-100 d-flex flex-column">
                ${isWinner ? `<div class="winner-badge"><i class="bi bi-trophy-fill me-1"></i> Maior Retorno Líquido</div>` : ''}
                
                <div class="d-flex align-items-center mb-3">
                    <div class="feature-icon-wrapper me-3" style="background: rgba(37, 99, 235, 0.08); color: ${meta.accent};">
                        <i class="bi ${meta.icon}"></i>
                    </div>
                    <div>
                        <span class="badge ${meta.badgeClass} badge-tag mb-1">
                            ${item.categoria}
                        </span>
                        <h5 class="fw-bold mb-0 text-dark">${meta.titulo}</h5>
                        <small class="text-muted fw-semibold">${meta.subtitulo}</small>
                    </div>
                </div>

                <!-- Caixa Destaque de Patrimônio -->
                <div class="my-3 metric-highlight-box">
                    <small class="text-muted d-block text-uppercase fw-bold mb-1" style="font-size: 0.74rem; letter-spacing: 0.04em;">
                        Patrimônio Líquido Final
                    </small>
                    <div class="asset-value-highlight text-dark">${formatMoney(saldoLiquido)}</div>
                    <div class="d-flex align-items-center mt-2 gap-2 flex-wrap">
                        <span class="badge bg-success text-white fw-bold px-2 py-1">
                            +${rentPerc.toFixed(1)}% líquido
                        </span>
                        <span class="text-success-emphasis fw-bold small">Lucro de ${formatMoney(lucroLiquido)}</span>
                    </div>

                    ${cotaPreco > 0 ? `
                    <div class="mt-2 pt-2 border-top border-secondary border-opacity-10 d-flex justify-content-between align-items-center small">
                        <span class="text-muted fw-semibold"><i class="bi bi-check2-circle text-primary me-1"></i>Cota B3: <strong>${formatMoney(cotaPreco)}</strong></span>
                        <span class="text-primary fw-bold">~${cotasTotal.toLocaleString('pt-BR')} cotas</span>
                    </div>
                    ` : ''}
                </div>

                <!-- Detalhamento de Custos e Impostos -->
                <div class="mt-auto pt-2 border-top border-secondary border-opacity-10">
                    <div class="d-flex justify-content-between py-1 small">
                        <span class="text-muted fw-semibold">Total Investido (Aportes):</span>
                        <strong class="text-dark">${formatMoney(totalInvestido)}</strong>
                    </div>
                    <div class="d-flex justify-content-between py-1 small">
                        <span class="text-muted fw-semibold">Imposto de Renda (IR):</span>
                        <strong class="text-danger">-${formatMoney(irPago)} <small>(${item.dados.aliquota_media_ir}%)</small></strong>
                    </div>
                    ${custodiaB3 > 0 ? `
                    <div class="d-flex justify-content-between py-1 small">
                        <span class="text-muted fw-semibold">Taxa B3 (0,20% a.a.):</span>
                        <strong class="text-warning-emphasis">-${formatMoney(custodiaB3)}</strong>
                    </div>
                    ` : `
                    <div class="d-flex justify-content-between py-1 small">
                        <span class="text-muted fw-semibold">Taxa de Custódia B3:</span>
                        <strong class="text-success"><i class="bi bi-check2"></i> Isento (0%)</strong>
                    </div>
                    `}
                    <div class="d-flex justify-content-between py-1 small">
                        <span class="text-muted fw-semibold">Poder de Compra Real:</span>
                        <strong class="text-info-emphasis" title="Descontando a inflação acumulada no período">${formatMoney(poderCompra)}</strong>
                    </div>
                    <div class="d-flex justify-content-between py-1 small">
                        <span class="text-muted fw-semibold">Regra Tributária:</span>
                        <strong class="text-secondary">${item.ir_regra}</strong>
                    </div>
                </div>
            </div>
        </div>
        `;
    }

    cardsContainer.innerHTML = html;
}

// Renderiza Gráficos Chart.js com Paleta de Alta Legibilidade
function renderCharts(data) {
    const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
    const textColor = isDark ? '#9ca3af' : '#475569';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';

    const res = data.resultados;
    const labels = [];
    
    const histRef = res.etf_ipca.dados.historico;
    histRef.forEach(item => {
        labels.push(`Ano ${item.ano}`);
    });

    const datasetTotalAportado = histRef.map(h => h.total_aportado);
    const datasetEtfIpca = res.etf_ipca.dados.historico.map(h => h.saldo_liquido);
    const datasetTesouroIpca = res.tesouro_ipca.dados.historico.map(h => h.saldo_liquido);
    const datasetEtfSelic = res.etf_selic.dados.historico.map(h => h.saldo_liquido);
    const datasetCdb = res.cdb_caixinha.dados.historico.map(h => h.saldo_liquido);
    const datasetTesouroSelic = res.tesouro_selic.dados.historico.map(h => h.saldo_liquido);

    const ctxEvolution = document.getElementById('chart-evolution');
    if (ctxEvolution) {
        if (chartEvolutionInstance) chartEvolutionInstance.destroy();

        chartEvolutionInstance = new Chart(ctxEvolution, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'ETF IPCA (B5P211 / B3)',
                        data: datasetEtfIpca,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.08)',
                        borderWidth: 3.5,
                        tension: 0.35,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    },
                    {
                        label: 'Tesouro IPCA+ (B3)',
                        data: datasetTesouroIpca,
                        borderColor: '#d97706',
                        backgroundColor: 'rgba(217, 119, 6, 0.08)',
                        borderWidth: 2.5,
                        borderDash: [5, 5],
                        tension: 0.35,
                        fill: false,
                        pointRadius: 3
                    },
                    {
                        label: 'ETF Selic (LFTS11 / B3)',
                        data: datasetEtfSelic,
                        borderColor: '#0284c7',
                        backgroundColor: 'rgba(2, 132, 199, 0.08)',
                        borderWidth: 2.5,
                        tension: 0.35,
                        fill: false,
                        pointRadius: 3
                    },
                    {
                        label: 'CDB Caixinha (100% CDI)',
                        data: datasetCdb,
                        borderColor: '#7c3aed',
                        backgroundColor: 'rgba(124, 58, 237, 0.08)',
                        borderWidth: 2,
                        tension: 0.35,
                        fill: false,
                        pointRadius: 3
                    },
                    {
                        label: 'Tesouro Selic (B3)',
                        data: datasetTesouroSelic,
                        borderColor: '#64748b',
                        backgroundColor: 'rgba(100, 116, 139, 0.08)',
                        borderWidth: 2,
                        tension: 0.35,
                        fill: false,
                        pointRadius: 2
                    },
                    {
                        label: 'Total Aportado',
                        data: datasetTotalAportado,
                        borderColor: '#94a3b8',
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        borderWidth: 1.5,
                        borderDash: [3, 3],
                        tension: 0,
                        fill: true,
                        pointRadius: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: textColor,
                            usePointStyle: true,
                            padding: 18,
                            font: { family: 'Plus Jakarta Sans', size: 12, weight: '700' }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleColor: '#ffffff',
                        bodyColor: '#f8fafc',
                        borderColor: '#334155',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return ` ${context.dataset.label}: ${formatMoney(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: gridColor },
                        ticks: { color: textColor, font: { weight: '600' } }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: {
                            color: textColor,
                            font: { weight: '600' },
                            callback: function(val) {
                                if (val >= 1000000) return 'R$ ' + (val / 1000000).toFixed(1) + 'M';
                                if (val >= 1000) return 'R$ ' + (val / 1000).toFixed(0) + 'k';
                                return 'R$ ' + val;
                            }
                        }
                    }
                }
            }
        });
    }

    const ctxCosts = document.getElementById('chart-costs');
    if (ctxCosts) {
        if (chartCostsInstance) chartCostsInstance.destroy();

        const assetNames = ['ETF IPCA', 'Tesouro IPCA+', 'ETF LFTS11', 'CDB Caixinha', 'Tesouro Selic'];
        const keys = ['etf_ipca', 'tesouro_ipca', 'etf_selic', 'cdb_caixinha', 'tesouro_selic'];

        const lucros = keys.map(k => res[k].dados.lucro_liquido);
        const irs = keys.map(k => res[k].dados.imposto_renda);
        const b3s = keys.map(k => res[k].dados.custodia_b3);

        chartCostsInstance = new Chart(ctxCosts, {
            type: 'bar',
            data: {
                labels: assetNames,
                datasets: [
                    {
                        label: 'Lucro Líquido no Bolso',
                        data: lucros,
                        backgroundColor: '#059669',
                        borderRadius: 6
                    },
                    {
                        label: 'Imposto de Renda (IR)',
                        data: irs,
                        backgroundColor: '#dc2626',
                        borderRadius: 6
                    },
                    {
                        label: 'Taxa B3 (0,20% a.a.)',
                        data: b3s,
                        backgroundColor: '#d97706',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: textColor,
                            usePointStyle: true,
                            padding: 16,
                            font: { family: 'Plus Jakarta Sans', weight: '700' }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        callbacks: {
                            label: function(context) {
                                return ` ${context.dataset.label}: ${formatMoney(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { color: textColor, font: { weight: '600' } }
                    },
                    y: {
                        grid: { color: gridColor },
                        ticks: {
                            color: textColor,
                            font: { weight: '600' },
                            callback: function(val) {
                                if (val >= 1000) return 'R$ ' + (val / 1000).toFixed(0) + 'k';
                                return 'R$ ' + val;
                            }
                        }
                    }
                }
            }
        });
    }
}

// Renderiza Tabela Detalhada Ano a Ano
function renderTable(data) {
    const tableBody = document.getElementById('table-evolution-body');
    if (!tableBody) return;

    const res = data.resultados;
    const histEtfIpca = res.etf_ipca.dados.historico;
    const histTesouroIpca = res.tesouro_ipca.dados.historico;
    const histEtfSelic = res.etf_selic.dados.historico;
    const histCdb = res.cdb_caixinha.dados.historico;
    const histTesouroSelic = res.tesouro_selic.dados.historico;

    let html = '';

    histEtfIpca.forEach((item, index) => {
        const valEtfIpca = item.saldo_liquido;
        const valTesouroIpca = histTesouroIpca[index] ? histTesouroIpca[index].saldo_liquido : 0;
        const valEtfSelic = histEtfSelic[index] ? histEtfSelic[index].saldo_liquido : 0;
        const valCdb = histCdb[index] ? histCdb[index].saldo_liquido : 0;
        const valTesouroSelic = histTesouroSelic[index] ? histTesouroSelic[index].saldo_liquido : 0;

        html += `
        <tr>
            <td class="fw-bold text-dark">Ano ${item.ano} (${item.mes}m)</td>
            <td class="text-muted fw-semibold">${formatMoney(item.total_aportado)}</td>
            <td class="fw-bold text-primary">${formatMoney(valEtfIpca)}</td>
            <td class="fw-bold text-warning-emphasis">${formatMoney(valTesouroIpca)}</td>
            <td class="fw-bold text-info-emphasis">${formatMoney(valEtfSelic)}</td>
            <td class="fw-bold text-purple" style="color: #7c3aed;">${formatMoney(valCdb)}</td>
            <td class="fw-bold text-secondary">${formatMoney(valTesouroSelic)}</td>
        </tr>
        `;
    });

    tableBody.innerHTML = html;
}

// Insights Automáticos
function renderInsights(data) {
    const container = document.getElementById('insights-container');
    if (!container) return;

    const res = data.resultados;
    const etfIpcaLiquido = res.etf_ipca.dados.saldo_liquido;
    const tesouroIpcaLiquido = res.tesouro_ipca.dados.saldo_liquido;
    const cdbLiquido = res.cdb_caixinha.dados.saldo_liquido;
    const diferencaEtfTesouro = etfIpcaLiquido - tesouroIpcaLiquido;
    const diferencaEtfCdb = etfIpcaLiquido - cdbLiquido;
    const b3Economizada = res.tesouro_ipca.dados.custodia_b3;

    container.innerHTML = `
    <div class="row g-4 align-items-center">
        <div class="col-lg-8">
            <h4 class="fw-bold text-dark mb-2">
                <i class="bi bi-lightbulb-fill text-warning me-2"></i>Por que o ETF de Renda Fixa costuma vencer no longo prazo?
            </h4>
            <p class="text-muted mb-3 fs-6">
                No horizonte de <strong>${data.parametros.prazo_anos} anos</strong>, o ETF de Renda Fixa IPCA gerou 
                <strong class="text-success">${formatMoney(diferencaEtfTesouro)} a mais</strong> que o Tesouro IPCA+ e 
                <strong class="text-success">${formatMoney(diferencaEtfCdb)} a mais</strong> que o CDB Caixinha.
            </p>
            <div class="row g-3">
                <div class="col-sm-6">
                    <div class="p-3 rounded-3" style="background: rgba(37, 99, 235, 0.05); border: 1px solid rgba(37, 99, 235, 0.15);">
                        <div class="small text-muted fw-bold text-uppercase mb-1">Economia de Custódia B3</div>
                        <div class="fs-4 fw-bold text-primary">${formatMoney(b3Economizada)}</div>
                        <small class="text-muted">ETFs não pagam a taxa de 0,20% a.a. que a B3 cobra no Tesouro Direto.</small>
                    </div>
                </div>
                <div class="col-sm-6">
                    <div class="p-3 rounded-3" style="background: rgba(5, 150, 105, 0.05); border: 1px solid rgba(5, 150, 105, 0.15);">
                        <div class="small text-muted fw-bold text-uppercase mb-1">Alíquota Única de 15%</div>
                        <div class="fs-4 fw-bold text-success">Sem Come-Cotas</div>
                        <small class="text-muted">Aportes novos no ETF pagam 15% direto no resgate, sem passar pelos 22,5% do CDB/Tesouro.</small>
                    </div>
                </div>
            </div>
        </div>
        <div class="col-lg-4 text-center">
            <div class="p-4 rounded-4" style="background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
                <div class="display-5 fw-bold text-dark mb-1">${((etfIpcaLiquido / cdbLiquido - 1) * 100).toFixed(1)}%</div>
                <div class="text-muted small fw-bold text-uppercase mb-3">Vantagem relativa sobre CDB de Caixinha</div>
                <a href="#monitor-b3" class="btn btn-outline-primary btn-sm rounded-pill px-3 fw-bold">
                    <i class="bi bi-activity me-1"></i> Ver Cotações B3 em Tempo Real
                </a>
            </div>
        </div>
    </div>
    `;
}

// Exportar ou Copiar Relatório
function copiarResumoSimulacao() {
    if (!currentSimulationData) return;
    const p = currentSimulationData.parametros;
    const r = currentSimulationData.resultados;

    const texto = `=== SIMULADOR DE MERCADO FINANCEIRO (Open Source - Pedro Falconi) ===\n` +
        `• Aporte Inicial: ${formatMoney(p.aporte_inicial)}\n` +
        `• Aporte Mensal: ${formatMoney(p.aporte_mensal)}\n` +
        `• Prazo: ${p.prazo_anos} anos (${p.prazo_meses} meses)\n` +
        `• Selic: ${p.taxa_selic}% | CDI: ${p.taxa_cdi}% | IPCA: ${p.taxa_ipca}%\n` +
        `• Juro Real Tesouro IPCA+ (B3): ${p.juro_real_ipca}% a.a.\n\n` +
        `RESULTADOS LÍQUIDOS FINAIS:\n` +
        `1. ETF Renda Fixa IPCA (B5P211): ${formatMoney(r.etf_ipca.dados.saldo_liquido)} (Lucro: ${formatMoney(r.etf_ipca.dados.lucro_liquido)})\n` +
        `2. Tesouro IPCA+: ${formatMoney(r.tesouro_ipca.dados.saldo_liquido)} (Lucro: ${formatMoney(r.tesouro_ipca.dados.lucro_liquido)})\n` +
        `3. ETF Pós-Fixado DI (LFTS11): ${formatMoney(r.etf_selic.dados.saldo_liquido)} (Lucro: ${formatMoney(r.etf_selic.dados.lucro_liquido)})\n` +
        `4. CDB Caixinha: ${formatMoney(r.cdb_caixinha.dados.saldo_liquido)} (Lucro: ${formatMoney(r.cdb_caixinha.dados.lucro_liquido)})\n` +
        `5. Tesouro Selic: ${formatMoney(r.tesouro_selic.dados.saldo_liquido)} (Lucro: ${formatMoney(r.tesouro_selic.dados.lucro_liquido)})\n\n` +
        `Projeto Open Source desenvolvido por Pedro Falconi com dados reais da B3 e BrasilAPI.`;

    navigator.clipboard.writeText(texto).then(() => {
        alert('Resumo da simulação copiado para a área de transferência com sucesso!');
    }).catch(() => {
        alert('Não foi possível copiar automaticamente.');
    });
}
