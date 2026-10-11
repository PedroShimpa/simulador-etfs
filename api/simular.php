<?php
/**
 * Simulador de Renda Fixa & ETFs - Motor de Cálculo Financeiro Integrado com B3
 * Otimizado para Vercel Serverless & XAMPP Local
 * Projeto Open Source criado por Pedro Falconi
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$input = $_SERVER['REQUEST_METHOD'] === 'POST' ? json_decode(file_get_contents('php://input'), true) : $_GET;
if (!$input) {
    $input = $_GET;
}

$aporteInicial   = max(0, floatval($input['aporte_inicial'] ?? 10000));
$aporteMensal    = max(0, floatval($input['aporte_mensal'] ?? 1000));
$prazoMeses      = max(1, min(600, intval($input['prazo_meses'] ?? 120)));

$taxaSelicAnual  = max(0, floatval($input['taxa_selic'] ?? 13.75));
$taxaCdiAnual    = max(0, floatval($input['taxa_cdi'] ?? 13.65));
$taxaIpcaAnual   = max(0, floatval($input['taxa_ipca'] ?? 4.58));
$juroRealIpca    = max(0, floatval($input['juro_real_ipca'] ?? 6.62));
$percCdiCaixinha = max(50, min(200, floatval($input['perc_cdi_caixinha'] ?? 100.0)));

$taxaB3Anual     = 0.0020;
$taxaAdmEtfIpca  = 0.0020;
$taxaAdmEtfSelic = 0.0019;

// Lê cache da B3 em /tmp ou local
$cacheDir = sys_get_temp_dir();
$cacheB3File = rtrim($cacheDir, '/\\') . DIRECTORY_SEPARATOR . 'simulador_b3_cache.json';
$cotacoesB3 = [];
if (file_exists($cacheB3File)) {
    $cacheB3 = json_decode(@file_get_contents($cacheB3File), true);
    if ($cacheB3 && isset($cacheB3['etfs'])) {
        $cotacoesB3 = $cacheB3['etfs'];
    }
}

$precoCotaB5P211 = floatval($input['preco_b5p211'] ?? ($cotacoesB3['B5P211']['preco'] ?? 115.42));
$precoCotaImab11 = floatval($input['preco_imab11'] ?? ($cotacoesB3['IMAB11']['preco'] ?? 125.28));
$precoCotaLfts11 = floatval($input['preco_lfts11'] ?? ($cotacoesB3['LFTS11']['preco'] ?? 161.21));

function getAliquotaRegressivaIR($mesesDecorridos) {
    $dias = $mesesDecorridos * 30.4167;
    if ($dias <= 180) return 0.225;
    if ($dias <= 360) return 0.200;
    if ($dias <= 720) return 0.175;
    return 0.150;
}

function taxaAnualParaMensal($taxaAnualDecimal) {
    return pow(1 + $taxaAnualDecimal, 1 / 12) - 1;
}

function simularAtivo(
    $aporteInicial,
    $aporteMensal,
    $prazoMeses,
    $taxaAnualBruta,
    $tipoTributacao,
    $tipoAtivo,
    $taxaAdmAnual = 0.0,
    $taxaB3Anual = 0.0,
    $precoCotaB3 = 0.0
) {
    $taxaEfetivaAtivoAnual = max(0, $taxaAnualBruta - $taxaAdmAnual);
    $taxaMensal = taxaAnualParaMensal($taxaEfetivaAtivoAnual);
    $taxaB3Mensal = taxaAnualParaMensal($taxaB3Anual);

    $lotes = [];
    $cotasIniciais = ($precoCotaB3 > 0) ? floor($aporteInicial / $precoCotaB3) : 0;
    $cotasMensais = ($precoCotaB3 > 0) ? floor($aporteMensal / $precoCotaB3) : 0;
    $totalCotasEstimadas = $cotasIniciais + ($cotasMensais * $prazoMeses);

    if ($aporteInicial > 0) {
        $lotes[] = [
            'mes_aporte' => 0,
            'valor'      => $aporteInicial,
            'saldo_bruto'=> $aporteInicial,
            'custodia_acumulada' => 0.0
        ];
    }

    $historicoMeses = [];
    $totalAportado = $aporteInicial;

    for ($m = 1; $m <= $prazoMeses; $m++) {
        $saldoBrutoTotalMes = 0;
        $custodiaTotalMes = 0;

        foreach ($lotes as &$lote) {
            $rendimentoLote = $lote['saldo_bruto'] * $taxaMensal;
            $lote['saldo_bruto'] += $rendimentoLote;

            if ($taxaB3Anual > 0) {
                $baseCalculoB3 = $lote['saldo_bruto'];
                if ($tipoAtivo === 'tesouro_selic') {
                    $baseCalculoB3 = max(0, $lote['saldo_bruto'] - 10000);
                }
                $custodiaLote = $baseCalculoB3 * $taxaB3Mensal;
                $lote['custodia_acumulada'] += $custodiaLote;
                $custodiaTotalMes += $lote['custodia_acumulada'];
            }

            $saldoBrutoTotalMes += $lote['saldo_bruto'];
        }
        unset($lote);

        if ($aporteMensal > 0) {
            $lotes[] = [
                'mes_aporte' => $m,
                'valor'      => $aporteMensal,
                'saldo_bruto'=> $aporteMensal,
                'custodia_acumulada' => 0.0
            ];
            $saldoBrutoTotalMes += $aporteMensal;
            $totalAportado += $aporteMensal;
        }

        if ($m % 12 === 0 || $m === $prazoMeses || $prazoMeses <= 24) {
            $irEstimado = 0;
            $custodiaEstimada = 0;
            foreach ($lotes as $l) {
                $rendimentoLote = max(0, $l['saldo_bruto'] - $l['valor']);
                $mesesLote = $m - $l['mes_aporte'];
                $aliquota = ($tipoTributacao === 'etf_fixo_15') ? 0.15 : getAliquotaRegressivaIR($mesesLote);
                $irEstimado += $rendimentoLote * $aliquota;
                $custodiaEstimada += $l['custodia_acumulada'];
            }

            $saldoLiquidoMes = $saldoBrutoTotalMes - $irEstimado - $custodiaEstimada;

            $historicoMeses[] = [
                'mes'            => $m,
                'ano'            => round($m / 12, 1),
                'total_aportado' => round($totalAportado, 2),
                'saldo_bruto'    => round($saldoBrutoTotalMes, 2),
                'ir'             => round($irEstimado, 2),
                'custodia_b3'    => round($custodiaEstimada, 2),
                'saldo_liquido'  => round($saldoLiquidoMes, 2),
                'lucro_liquido'  => round($saldoLiquidoMes - $totalAportado, 2)
            ];
        }
    }

    $saldoBrutoFinal = 0;
    $irTotal = 0;
    $custodiaB3Total = 0;
    $rendimentoBrutoTotal = 0;

    foreach ($lotes as $l) {
        $saldoBrutoFinal += $l['saldo_bruto'];
        $rendimentoLote = max(0, $l['saldo_bruto'] - $l['valor']);
        $rendimentoBrutoTotal += $rendimentoLote;

        $mesesLote = $prazoMeses - $l['mes_aporte'];
        $aliquota = ($tipoTributacao === 'etf_fixo_15') ? 0.15 : getAliquotaRegressivaIR($mesesLote);
        $irTotal += $rendimentoLote * $aliquota;
        $custodiaB3Total += $l['custodia_acumulada'];
    }

    $saldoLiquidoFinal = $saldoBrutoFinal - $irTotal - $custodiaB3Total;
    $lucroLiquidoFinal = $saldoLiquidoFinal - $totalAportado;
    $rentabilidadeLiquidaPercentual = $totalAportado > 0 ? ($lucroLiquidoFinal / $totalAportado) * 100 : 0;
    $aliquotaMediaIr = $rendimentoBrutoTotal > 0 ? ($irTotal / $rendimentoBrutoTotal) * 100 : 15.0;

    return [
        'total_investido'       => round($totalAportado, 2),
        'saldo_bruto'           => round($saldoBrutoFinal, 2),
        'rendimento_bruto'      => round($rendimentoBrutoTotal, 2),
        'imposto_renda'         => round($irTotal, 2),
        'aliquota_media_ir'     => round($aliquotaMediaIr, 2),
        'custodia_b3'           => round($custodiaB3Total, 2),
        'saldo_liquido'         => round($saldoLiquidoFinal, 2),
        'lucro_liquido'         => round($lucroLiquidoFinal, 2),
        'rentabilidade_perc'    => round($rentabilidadeLiquidaPercentual, 2),
        'preco_cota_b3'         => $precoCotaB3,
        'cotas_estimadas'       => $totalCotasEstimadas,
        'historico'             => $historicoMeses
    ];
}

$taxaAnualCdb = ($taxaCdiAnual / 100) * ($percCdiCaixinha / 100);
$simulacaoCdb = simularAtivo($aporteInicial, $aporteMensal, $prazoMeses, $taxaAnualCdb, 'regressiva', 'cdb', 0.0, 0.0);

$taxaAnualTesouroSelic = ($taxaSelicAnual / 100) + 0.0001;
$simulacaoTesouroSelic = simularAtivo($aporteInicial, $aporteMensal, $prazoMeses, $taxaAnualTesouroSelic, 'regressiva', 'tesouro_selic', 0.0, $taxaB3Anual);

$taxaAnualTesouroIpca = (1 + ($taxaIpcaAnual / 100)) * (1 + ($juroRealIpca / 100)) - 1;
$simulacaoTesouroIpca = simularAtivo($aporteInicial, $aporteMensal, $prazoMeses, $taxaAnualTesouroIpca, 'regressiva', 'tesouro_ipca', 0.0, $taxaB3Anual);

$taxaAnualEtfIpca = (1 + ($taxaIpcaAnual / 100)) * (1 + ($juroRealIpca / 100)) - 1;
$simulacaoEtfIpca = simularAtivo($aporteInicial, $aporteMensal, $prazoMeses, $taxaAnualEtfIpca, 'etf_fixo_15', 'etf', $taxaAdmEtfIpca, 0.0, $precoCotaB5P211);

$taxaAnualEtfSelic = ($taxaSelicAnual / 100);
$simulacaoEtfSelic = simularAtivo($aporteInicial, $aporteMensal, $prazoMeses, $taxaAnualEtfSelic, 'etf_fixo_15', 'etf', $taxaAdmEtfSelic, 0.0, $precoCotaLfts11);

$inflacaoAcumuladaDecimal = pow(1 + ($taxaIpcaAnual / 100), $prazoMeses / 12) - 1;

function calcularPoderCompraReal($saldoLiquido, $inflacaoAcumuladaDecimal) {
    if ($inflacaoAcumuladaDecimal <= -1) return $saldoLiquido;
    return round($saldoLiquido / (1 + $inflacaoAcumuladaDecimal), 2);
}

$simulacaoCdb['poder_compra_real']          = calcularPoderCompraReal($simulacaoCdb['saldo_liquido'], $inflacaoAcumuladaDecimal);
$simulacaoTesouroSelic['poder_compra_real'] = calcularPoderCompraReal($simulacaoTesouroSelic['saldo_liquido'], $inflacaoAcumuladaDecimal);
$simulacaoTesouroIpca['poder_compra_real']  = calcularPoderCompraReal($simulacaoTesouroIpca['saldo_liquido'], $inflacaoAcumuladaDecimal);
$simulacaoEtfIpca['poder_compra_real']      = calcularPoderCompraReal($simulacaoEtfIpca['saldo_liquido'], $inflacaoAcumuladaDecimal);
$simulacaoEtfSelic['poder_compra_real']     = calcularPoderCompraReal($simulacaoEtfSelic['saldo_liquido'], $inflacaoAcumuladaDecimal);

$response = [
    'parametros' => [
        'aporte_inicial'     => $aporteInicial,
        'aporte_mensal'      => $aporteMensal,
        'prazo_meses'        => $prazoMeses,
        'prazo_anos'         => round($prazoMeses / 12, 1),
        'taxa_selic'         => $taxaSelicAnual,
        'taxa_cdi'           => $taxaCdiAnual,
        'taxa_ipca'          => $taxaIpcaAnual,
        'juro_real_ipca'     => $juroRealIpca,
        'perc_cdi_caixinha'  => $percCdiCaixinha,
        'inflacao_acumulada_perc' => round($inflacaoAcumuladaDecimal * 100, 2)
    ],
    'dados_b3_mercado' => $cotacoesB3,
    'resultados' => [
        'etf_ipca' => [
            'nome'        => 'ETF Renda Fixa IPCA (ex: B5P211 / IMAB11)',
            'ticker_b3'   => 'B5P211',
            'categoria'   => 'ETF de Renda Fixa (B3)',
            'descricao'   => 'Alíquota fixa de 15% de IR sem come-cotas e sem custódia B3 de 0,20% a.a.',
            'taxa_anual_bruta' => round($taxaAnualEtfIpca * 100, 2),
            'cota_b3'     => $precoCotaB5P211,
            'taxa_adm'    => '0,20% a.a.',
            'taxa_b3'     => '0,00%',
            'ir_regra'    => '15% fixo (sem come-cotas)',
            'dados'       => $simulacaoEtfIpca
        ],
        'tesouro_ipca' => [
            'nome'        => 'Tesouro IPCA+ (NTN-B Principal)',
            'categoria'   => 'Tesouro Direto (B3)',
            'descricao'   => 'Proteção contra inflação, porém sujeito a custódia B3 (0,20% a.a.) e IR regressivo.',
            'taxa_anual_bruta' => round($taxaAnualTesouroIpca * 100, 2),
            'taxa_adm'    => '0,00%',
            'taxa_b3'     => '0,20% a.a.',
            'ir_regra'    => 'Tabela Regressiva (22,5% a 15%)',
            'dados'       => $simulacaoTesouroIpca
        ],
        'etf_selic' => [
            'nome'        => 'ETF Pós-Fixado DI (ex: LFTS11)',
            'ticker_b3'   => 'LFTS11',
            'categoria'   => 'ETF de Renda Fixa (B3)',
            'descricao'   => 'Acompanha 100% Selic/CDI com alíquota única de 15% de IR e isento da taxa B3.',
            'taxa_anual_bruta' => round($taxaAnualEtfSelic * 100, 2),
            'cota_b3'     => $precoCotaLfts11,
            'taxa_adm'    => '0,19% a.a.',
            'taxa_b3'     => '0,00%',
            'ir_regra'    => '15% fixo (sem come-cotas)',
            'dados'       => $simulacaoEtfSelic
        ],
        'cdb_caixinha' => [
            'nome'        => 'CDB Caixinha (' . $percCdiCaixinha . '% do CDI)',
            'categoria'   => 'CDBs de Bancos Digitais',
            'descricao'   => 'Liquidez diária comum em Nubank, Inter, PicPay. IR regressivo apurado por lote.',
            'taxa_anual_bruta' => round($taxaAnualCdb * 100, 2),
            'taxa_adm'    => '0,00%',
            'taxa_b3'     => '0,00%',
            'ir_regra'    => 'Tabela Regressiva (22,5% a 15%)',
            'dados'       => $simulacaoCdb
        ],
        'tesouro_selic' => [
            'nome'        => 'Tesouro Selic (LFT)',
            'categoria'   => 'Tesouro Direto (B3)',
            'descricao'   => 'Pós-fixado soberano. Taxa B3 de 0,20% a.a. sobre o que exceder R$ 10.000.',
            'taxa_anual_bruta' => round($taxaAnualTesouroSelic * 100, 2),
            'taxa_adm'    => '0,00%',
            'taxa_b3'     => '0,20% a.a. (> R$ 10k)',
            'ir_regra'    => 'Tabela Regressiva (22,5% a 15%)',
            'dados'       => $simulacaoTesouroSelic
        ]
    ],
    'meta' => [
        'autor' => 'Pedro Falconi',
        'licenca' => 'MIT Open Source',
        'plataforma' => 'Otimizado para Vercel Serverless',
        'integracao' => 'BrasilAPI + B3 Market Data',
        'gerado_em' => date('d/m/Y H:i:s')
    ]
];

echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
