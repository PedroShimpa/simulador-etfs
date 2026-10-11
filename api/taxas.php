<?php
/**
 * Simulador de Renda Fixa & ETFs - Integração BrasilAPI + B3 Market Data
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

// Compatibilidade Vercel: o sistema de arquivos do Lambda é read-only exceto /tmp
$cacheDir = sys_get_temp_dir();
$cacheFile = rtrim($cacheDir, '/\\') . DIRECTORY_SEPARATOR . 'simulador_taxas_cache.json';
$cacheTime = 1800; // 30 minutos

$taxasPadrao = [
    'selic' => 13.75,
    'cdi'   => 13.65,
    'ipca'  => 4.58,
    'origem' => 'fallback_padrao',
    'atualizado_em' => date('d/m/Y H:i:s')
];

function obterTaxasBrasilAPI($cacheFile, $cacheTime, $taxasPadrao) {
    if (file_exists($cacheFile) && !isset($_GET['refresh']) && (time() - filemtime($cacheFile) < $cacheTime)) {
        $dados = json_decode(@file_get_contents($cacheFile), true);
        if ($dados && isset($dados['selic'])) {
            $dados['cache'] = true;
            return $dados;
        }
    }

    $url = 'https://brasilapi.com.br/api/taxas/v1';
    $context = stream_context_create([
        'http' => [
            'timeout' => 4,
            'header'  => "User-Agent: SimuladorETFs-PedroFalconi/1.0\r\n"
        ],
        'ssl' => [
            'verify_peer' => false,
            'verify_peer_name' => false
        ]
    ]);

    $response = @file_get_contents($url, false, $context);

    if ($response !== false) {
        $apiData = json_decode($response, true);
        if (is_array($apiData)) {
            $resultado = [
                'origem' => 'brasilapi',
                'cache' => false,
                'atualizado_em' => date('d/m/Y H:i:s')
            ];

            foreach ($apiData as $item) {
                $nome = strtolower($item['nome'] ?? '');
                $valor = floatval($item['valor'] ?? 0);
                if ($nome === 'selic') $resultado['selic'] = $valor;
                if ($nome === 'cdi')   $resultado['cdi'] = $valor;
                if ($nome === 'ipca')  $resultado['ipca'] = $valor;
            }

            if (isset($resultado['selic']) && isset($resultado['cdi'])) {
                if (!isset($resultado['ipca'])) {
                    $resultado['ipca'] = $taxasPadrao['ipca'];
                }
                @file_put_contents($cacheFile, json_encode($resultado, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
                return $resultado;
            }
        }
    }

    if (file_exists($cacheFile)) {
        $dadosAntigos = json_decode(@file_get_contents($cacheFile), true);
        if ($dadosAntigos) return $dadosAntigos;
    }

    return $taxasPadrao;
}

$dadosTaxas = obterTaxasBrasilAPI($cacheFile, $cacheTime, $taxasPadrao);

if (isset($_GET['include_b3']) && file_exists(__DIR__ . '/b3_dados.php')) {
    ob_start();
    include __DIR__ . '/b3_dados.php';
    $conteudoB3 = ob_get_clean();
    $dadosB3 = json_decode($conteudoB3, true);
    if ($dadosB3) {
        $dadosTaxas['b3_market'] = $dadosB3;
    }
}

echo json_encode($dadosTaxas, JSON_UNESCAPED_UNICODE);
