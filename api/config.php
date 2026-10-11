<?php
/**
 * Simulador de Renda Fixa & ETFs - Endpoint de Configurações Públicas
 * Lê variáveis de ambiente (Vercel Env / System Env)
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

$gaTag = getenv('GOOGLE_ANALYTICS_TAG')
    ?: ($_ENV['GOOGLE_ANALYTICS_TAG']
    ?? ($_SERVER['GOOGLE_ANALYTICS_TAG'] ?? ''));

// Limpar espaços acidentais
$gaTag = trim($gaTag);

echo json_encode([
    'google_analytics_tag' => $gaTag,
    'ambiente' => getenv('VERCEL') ? 'vercel' : 'local',
    'status' => 'ok'
], JSON_UNESCAPED_UNICODE);
