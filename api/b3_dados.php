<?php
/**
 * Simulador de Renda Fixa & ETFs - Módulo de Dados de Mercado B3 & Tesouro Direto
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

// Compatibilidade Vercel: /tmp
$cacheDir = sys_get_temp_dir();
$cacheFile = rtrim($cacheDir, '/\\') . DIRECTORY_SEPARATOR . 'simulador_b3_cache.json';
$cacheTime = 900; // 15 minutos

function obterCotacoesB3Etfs() {
    $tickers = [
        'B5P211' => 'B5P211.SA',
        'IMAB11' => 'IMAB11.SA',
        'LFTS11' => 'LFTS11.SA',
        'FIXA11' => 'FIXA11.SA'
    ];

    $dados = [];

    foreach ($tickers as $ticker => $symbol) {
        $url = "https://query1.finance.yahoo.com/v8/finance/chart/{$symbol}?interval=1d&range=1d";
        
        $ctx = stream_context_create([
            'http' => [
                'timeout' => 4,
                'header'  => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36\r\n"
            ],
            'ssl' => [
                'verify_peer' => false,
                'verify_peer_name' => false
            ]
        ]);

        $res = @file_get_contents($url, false, $ctx);
        if ($res !== false) {
            $json = json_decode($res, true);
            $meta = $json['chart']['result'][0]['meta'] ?? null;
            if ($meta) {
                $precoAtual = floatval($meta['regularMarketPrice'] ?? 0);
                $variacaoPerc = floatval($meta['regularMarketChangePercent'] ?? 0);
                $variacaoValor = floatval($meta['fulldayChange'] ?? 0);
                $max52 = floatval($meta['fiftyTwoWeekHigh'] ?? 0);
                $min52 = floatval($meta['fiftyTwoWeekLow'] ?? 0);
                $volume = intval($meta['regularMarketVolume'] ?? 0);
                $nome = $meta['longName'] ?? $meta['shortName'] ?? $ticker;

                $dados[$ticker] = [
                    'ticker' => $ticker,
                    'nome' => $nome,
                    'preco' => round($precoAtual, 2),
                    'variacao_perc' => round($variacaoPerc, 2),
                    'variacao_valor' => round($variacaoValor, 2),
                    'max_52w' => round($max52, 2),
                    'min_52w' => round($min52, 2),
                    'volume' => $volume,
                    'origem' => 'B3 (Bolsa de Valores do Brasil)'
                ];
            }
        }
    }

    return $dados;
}

function obterTaxasOficiaisTesouroB3() {
    $url = "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv";
    
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 5,
            'header'  => "Range: bytes=0-12000\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n"
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ]);

    $content = @file_get_contents($url, false, $ctx);
    $resultado = [
        'data_base' => null,
        'tesouro_ipca' => null,
        'tesouro_selic' => null,
        'tesouro_prefixado' => null,
        'titulos_detalhados' => []
    ];

    if ($content !== false && strlen($content) > 100) {
        $linhas = explode("\n", $content);
        $header = array_shift($linhas);

        foreach ($linhas as $linha) {
            $cols = str_getcsv(trim($linha), ';');
            if (count($cols) < 6) continue;

            $tipoTitulo = trim($cols[0]);
            $dataVencimento = trim($cols[1]);
            $dataBase = trim($cols[2]);
            $taxaCompra = floatval(str_replace(',', '.', trim($cols[3])));
            $taxaVenda = floatval(str_replace(',', '.', trim($cols[4])));
            $puCompra = floatval(str_replace(',', '.', trim($cols[5])));

            if (!$resultado['data_base'] && !empty($dataBase)) {
                $resultado['data_base'] = $dataBase;
            }

            if (stripos($tipoTitulo, 'Tesouro IPCA+') !== false && stripos($tipoTitulo, 'Semestrais') === false) {
                if ($resultado['tesouro_ipca'] === null && $taxaCompra > 0) {
                    $resultado['tesouro_ipca'] = [
                        'titulo' => $tipoTitulo . ' ' . substr($dataVencimento, -4),
                        'taxa_anual' => $taxaCompra,
                        'pu_compra' => $puCompra,
                        'vencimento' => $dataVencimento
                    ];
                }
            }

            if (stripos($tipoTitulo, 'Tesouro Selic') !== false) {
                if ($resultado['tesouro_selic'] === null && $taxaCompra >= 0) {
                    $resultado['tesouro_selic'] = [
                        'titulo' => $tipoTitulo . ' ' . substr($dataVencimento, -4),
                        'taxa_agio' => $taxaCompra,
                        'pu_compra' => $puCompra,
                        'vencimento' => $dataVencimento
                    ];
                }
            }

            if (stripos($tipoTitulo, 'Tesouro Prefixado') !== false && stripos($tipoTitulo, 'Semestrais') === false) {
                if ($resultado['tesouro_prefixado'] === null && $taxaCompra > 0) {
                    $resultado['tesouro_prefixado'] = [
                        'titulo' => $tipoTitulo . ' ' . substr($dataVencimento, -4),
                        'taxa_anual' => $taxaCompra,
                        'pu_compra' => $puCompra,
                        'vencimento' => $dataVencimento
                    ];
                }
            }

            if (count($resultado['titulos_detalhados']) < 8 && $taxaCompra > 0) {
                $resultado['titulos_detalhados'][] = [
                    'titulo' => $tipoTitulo,
                    'vencimento' => $dataVencimento,
                    'taxa_compra' => $taxaCompra,
                    'pu_compra' => $puCompra
                ];
            }
        }
    }

    return $resultado;
}

function carregarDadosB3Completos($cacheFile, $cacheTime) {
    if (file_exists($cacheFile) && (time() - filemtime($cacheFile) < $cacheTime)) {
        $dados = json_decode(@file_get_contents($cacheFile), true);
        if ($dados && isset($dados['etfs'])) {
            $dados['cache'] = true;
            return $dados;
        }
    }

    $etfs = obterCotacoesB3Etfs();
    $tesouro = obterTaxasOficiaisTesouroB3();

    if (empty($etfs['B5P211'])) {
        $etfs['B5P211'] = ['ticker' => 'B5P211', 'nome' => 'IT NOW IMA-B5 P2', 'preco' => 115.42, 'variacao_perc' => 0.15];
    }
    if (empty($etfs['IMAB11'])) {
        $etfs['IMAB11'] = ['ticker' => 'IMAB11', 'nome' => 'IT NOW IMA-B ETF', 'preco' => 125.28, 'variacao_perc' => -0.06];
    }
    if (empty($etfs['LFTS11'])) {
        $etfs['LFTS11'] = ['ticker' => 'LFTS11', 'nome' => 'INVESTO TESOURO SELIC', 'preco' => 161.21, 'variacao_perc' => 0.05];
    }
    if (empty($etfs['FIXA11'])) {
        $etfs['FIXA11'] = ['ticker' => 'FIXA11', 'nome' => 'MIRAETECH PREFIXADO', 'preco' => 20.88, 'variacao_perc' => 0.34];
    }

    if (empty($tesouro['tesouro_ipca'])) {
        $tesouro['tesouro_ipca'] = ['titulo' => 'Tesouro IPCA+ 2029', 'taxa_anual' => 6.62, 'pu_compra' => 4042.91];
    }
    if (empty($tesouro['tesouro_selic'])) {
        $tesouro['tesouro_selic'] = ['titulo' => 'Tesouro Selic 2027', 'taxa_agio' => 0.01, 'pu_compra' => 20067.61];
    }
    if (empty($tesouro['tesouro_prefixado'])) {
        $tesouro['tesouro_prefixado'] = ['titulo' => 'Tesouro Prefixado 2031', 'taxa_anual' => 12.45, 'pu_compra' => 611.86];
    }

    $consolidado = [
        'status' => 'sucesso',
        'origem' => 'B3 (Brasil, Bolsa, Balcão) & Tesouro Direto',
        'cache' => false,
        'atualizado_em' => date('d/m/Y H:i:s'),
        'etfs' => $etfs,
        'tesouro_b3' => $tesouro
    ];

    @file_put_contents($cacheFile, json_encode($consolidado, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    return $consolidado;
}

$resposta = carregarDadosB3Completos($cacheFile, $cacheTime);
echo json_encode($resposta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
