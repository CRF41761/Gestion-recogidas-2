<?php
// Configura la hoja de cálculo de Google Sheets
$sheet_url = "https://script.google.com/macros/s/AKfycbwYExZW0aDk6fdl5FDPQo2h9dzC-bgdDSfQINfo6EA-n52YII9k84aQfgV1zoh16N4cig/exec";

// Usa cURL para obtener los datos de Google Sheets
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, $sheet_url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
$response = curl_exec($ch);
curl_close($ch);

// Verifica si los datos fueron obtenidos correctamente
if ($response) {
    header('Content-Type: application/json');
    echo $response; // Devuelve el JSON al cliente
} else {
    http_response_code(500); // Error interno del servidor
    echo json_encode(["error" => "No se pudieron obtener los datos de las especies"]);
}
?>
