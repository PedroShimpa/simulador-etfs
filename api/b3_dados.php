<?php
/**
 * Simulador de Renda Fixa & ETFs - Módulo Completo de Mercado B3 & Tesouro Direto
 * Otimizado para Vercel Serverless & XAMPP Local
 * Projeto Open Source criado por Pedro Falconi
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$cacheDir = sys_get_temp_dir();
$cacheFile = rtrim($cacheDir, '/\\') . DIRECTORY_SEPARATOR . 'simulador_b3_cache.json';
$cacheTime = 900; // 15 minutos

function obterCotacoesB3Etfs() {
    // Lista completa dos principais ETFs de Renda Fixa, Debêntures e Índices da B3
    $catalogoEtfs = [
        // Renda Fixa Inflação (IPCA)
        'B5P211' => [
            'symbol' => 'B5P211.SA',
            'nome_completo' => 'It Now IMA-B 5 P2 (Tesouro IPCA até 5 anos)',
            'categoria' => 'Renda Fixa IPCA',
            'indexador' => 'IMA-B 5 (Duration Curta)',
            'aliquota_ir' => '15% fixo (sem come-cotas)',
            'preco_padrao' => 115.42,
            'variacao_padrao' => 0.15
        ],
        'IMAB11' => [
            'symbol' => 'IMAB11.SA',
            'nome_completo' => 'It Now IMA-B Total (Cesta Ampla Tesouro IPCA)',
            'categoria' => 'Renda Fixa IPCA',
            'indexador' => 'IMA-B Geral',
            'aliquota_ir' => '15% fixo (sem come-cotas)',
            'preco_padrao' => 125.28,
            'variacao_padrao' => -0.06
        ],
        'IB5M11' => [
            'symbol' => 'IB5M11.SA',
            'nome_completo' => 'It Now IMA-B 5+ (Tesouro IPCA Longo > 5 anos)',
            'categoria' => 'Renda Fixa IPCA',
            'indexador' => 'IMA-B 5+ (Longo Prazo)',
            'aliquota_ir' => '15% fixo (sem come-cotas)',
            'preco_padrao' => 138.14,
            'variacao_padrao' => 0.54
        ],
        'KDIF11' => [
            'symbol' => 'KDIF11.SA',
            'nome_completo' => 'Kinea Infra Debêntures Incentivadas IPCA',
            'categoria' => 'Debêntures Incentivadas',
            'indexador' => 'IDA-IPCA Infraestrutura',
            'aliquota_ir' => 'Isento de IR (Pessoa Física)',
            'preco_padrao' => 120.00,
            'variacao_padrao' => 1.35
        ],
        'DEBB11' => [
            'symbol' => 'DEBB11.SA',
            'nome_completo' => 'BTG Pactual Debêntures DI / Crédito Privado',
            'categoria' => 'Crédito Privado / DI',
            'indexador' => 'IDA-DI',
            'aliquota_ir' => '15% fixo',
            'preco_padrao' => 17.22,
            'variacao_padrao' => 0.00
        ],

        // Renda Fixa Pós-Fixado (Selic / DI)
        'LFTS11' => [
            'symbol' => 'LFTS11.SA',
            'nome_completo' => 'Investo Teva Tesouro Selic (LFT Pós-Fixado)',
            'categoria' => 'Renda Fixa Pós-Fixado',
            'indexador' => '100% Taxa Selic',
            'aliquota_ir' => '15% fixo (sem come-cotas)',
            'preco_padrao' => 161.21,
            'variacao_padrao' => 0.05
        ],

        // Renda Fixa Prefixada
        'FIXA11' => [
            'symbol' => 'FIXA11.SA',
            'nome_completo' => 'BB ETF Renda Fixa Pré DI Futuro',
            'categoria' => 'Renda Fixa Prefixado',
            'indexador' => 'S&P/B3 Taxas DI Futuro',
            'aliquota_ir' => '15% fixo',
            'preco_padrao' => 20.88,
            'variacao_padrao' => 0.34
        ],
        'IRFM11' => [
            'symbol' => 'IRFM11.SA',
            'nome_completo' => 'It Now IRF-M (Títulos Públicos Prefixados LTN/NTN-F)',
            'categoria' => 'Renda Fixa Prefixado',
            'indexador' => 'IRF-M Geral',
            'aliquota_ir' => '15% fixo',
            'preco_padrao' => 109.85,
            'variacao_padrao' => 0.41
        ],

        // Renda Fixa Global (Dólar + Juros)
        'USDB11' => [
            'symbol' => 'USDB11.SA',
            'nome_completo' => 'Investo US T-Bills (Tesouro Americano Curto em BRL)',
            'categoria' => 'Renda Fixa Global',
            'indexador' => 'US Treasury Bills + USD',
            'aliquota_ir' => '15% fixo',
            'preco_padrao' => 93.40,
            'variacao_padrao' => -0.87
        ],

        // Renda Variável / Índices de Referência
        'BOVA11' => [
            'symbol' => 'BOVA11.SA',
            'nome_completo' => 'iShares Ibovespa Fundo de Índice',
            'categoria' => 'Ações Brasil',
            'indexador' => 'Índice Bovespa (IBOV)',
            'aliquota_ir' => '15% no ganho de capital',
            'preco_padrao' => 205.55,
            'variacao_padrao' => 1.22
        ],
        'SMAL11' => [
            'symbol' => 'SMAL11.SA',
            'nome_completo' => 'iShares Small Cap Fundo de Índice',
            'categoria' => 'Ações Small Caps',
            'indexador' => 'Índice Small Cap (SMLL)',
            'aliquota_ir' => '15% no ganho de capital',
            'preco_padrao' => 139.80,
            'variacao_padrao' => 4.03
        ],
        'IVVB11' => [
            'symbol' => 'IVVB11.SA',
            'nome_completo' => 'iShares S&P 500 Fundo de Índice',
            'categoria' => 'Ações Internacionais',
            'indexador' => 'S&P 500 em Reais',
            'aliquota_ir' => '15% no ganho de capital',
            'preco_padrao' => 439.25,
            'variacao_padrao' => -0.25
        ]
    ];

    $dados = [];

    foreach ($catalogoEtfs as $ticker => $info) {
        $precoAtual = $info['preco_padrao'];
        $variacaoPerc = $info['variacao_padrao'];
        $max52 = $precoAtual * 1.05;
        $min52 = $precoAtual * 0.85;
        $volume = 50000;

        $url = "https://query1.finance.yahoo.com/v8/finance/chart/{$info['symbol']}?interval=1d&range=1d";
        $ctx = stream_context_create([
            'http' => [
                'timeout' => 3,
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
            if ($meta && !empty($meta['regularMarketPrice'])) {
                $precoAtual = floatval($meta['regularMarketPrice']);
                $variacaoPerc = floatval($meta['regularMarketChangePercent'] ?? 0);
                $max52 = floatval($meta['fiftyTwoWeekHigh'] ?? $max52);
                $min52 = floatval($meta['fiftyTwoWeekLow'] ?? $min52);
                $volume = intval($meta['regularMarketVolume'] ?? $volume);
            }
        }

        $dados[$ticker] = [
            'ticker' => $ticker,
            'nome' => $info['nome_completo'],
            'categoria' => $info['categoria'],
            'indexador' => $info['indexador'],
            'aliquota_ir' => $info['aliquota_ir'],
            'preco' => round($precoAtual, 2),
            'variacao_perc' => round($variacaoPerc, 2),
            'max_52w' => round($max52, 2),
            'min_52w' => round($min52, 2),
            'volume' => $volume,
            'origem' => 'B3 (Brasil, Bolsa, Balcão)'
        ];
    }

    return $dados;
}

function obterTaxasOficiaisTesouroB3() {
    $url = "https://www.tesourotransparente.gov.br/ckan/dataset/df56aa42-484a-4a59-8184-7676580c81e3/resource/796d2059-14e9-44e3-80c9-2d9e30b405c1/download/precotaxatesourodireto.csv";
    
    $ctx = stream_context_create([
        'http' => [
            'timeout' => 5,
            'header'  => "Range: bytes=0-15000\r\nUser-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\r\n"
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

            if ($taxaCompra > 0 && count($resultado['titulos_detalhados']) < 12) {
                $resultado['titulos_detalhados'][] = [
                    'titulo' => $tipoTitulo . ' ' . substr($dataVencimento, -4),
                    'tipo' => $tipoTitulo,
                    'vencimento' => $dataVencimento,
                    'taxa_compra' => $taxaCompra,
                    'pu_compra' => $puCompra
                ];
            }
        }
    }

    // Fallback para títulos do Tesouro
    if (empty($resultado['titulos_detalhados'])) {
        $resultado['titulos_detalhados'] = [
            ['titulo' => 'Tesouro Selic 2027', 'tipo' => 'Tesouro Selic', 'vencimento' => '01/03/2027', 'taxa_compra' => 0.01, 'pu_compra' => 20067.61],
            ['titulo' => 'Tesouro Selic 2029', 'tipo' => 'Tesouro Selic', 'vencimento' => '01/03/2029', 'taxa_compra' => 0.05, 'pu_compra' => 20046.46],
            ['titulo' => 'Tesouro IPCA+ 2029', 'tipo' => 'Tesouro IPCA+', 'vencimento' => '15/05/2029', 'taxa_compra' => 6.62, 'pu_compra' => 4042.91],
            ['titulo' => 'Tesouro IPCA+ 2035', 'tipo' => 'Tesouro IPCA+', 'vencimento' => '15/05/2035', 'taxa_compra' => 6.65, 'pu_compra' => 4698.46],
            ['titulo' => 'Tesouro Prefixado 2028', 'tipo' => 'Tesouro Prefixado', 'vencimento' => '01/01/2028', 'taxa_compra' => 12.49, 'pu_compra' => 866.82],
            ['titulo' => 'Tesouro Prefixado 2031', 'tipo' => 'Tesouro Prefixado', 'vencimento' => '01/01/2031', 'taxa_compra' => 12.45, 'pu_compra' => 611.86]
        ];
    }

    return $resultado;
}

function carregarDadosB3Completos($cacheFile, $cacheTime) {
    if (file_exists($cacheFile) && !isset($_GET['refresh']) && (time() - filemtime($cacheFile) < $cacheTime)) {
        $dados = json_decode(@file_get_contents($cacheFile), true);
        if ($dados && isset($dados['etfs']) && count($dados['etfs']) >= 8) {
            $dados['cache'] = true;
            return $dados;
        }
    }

    $etfs = obterCotacoesB3Etfs();
    $tesouro = obterTaxasOficiaisTesouroB3();

    $consolidado = [
        'status' => 'sucesso',
        'origem' => 'B3 (Brasil, Bolsa, Balcão) & Tesouro Direto',
        'cache' => false,
        'atualizado_em' => date('d/m/Y H:i:s'),
        'total_etfs' => count($etfs),
        'etfs' => $etfs,
        'tesouro_b3' => $tesouro
    ];

    @file_put_contents($cacheFile, json_encode($consolidado, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    return $consolidado;
}

$resposta = carregarDadosB3Completos($cacheFile, $cacheTime);
echo json_encode($resposta, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
