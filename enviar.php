<?php
// Comércio em Figurinha — recebimento do formulário
// Requer hospedagem com PHP e função mail() habilitada.

declare(strict_types=1);

const DESTINO = 'comercioemfigurinhas@gmail.com';
const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB

function falhar(string $mensagem, int $status = 400): never {
    http_response_code($status);
    $safe = htmlspecialchars($mensagem, ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Não foi possível enviar</title><style>body{font-family:Arial,sans-serif;background:#fff7f0;color:#2b160b;display:grid;place-items:center;min-height:100vh;margin:0}.box{max-width:560px;padding:32px;border:1px solid #ffd4b3;border-radius:22px;box-shadow:0 12px 40px #0001}.btn{display:inline-block;margin-top:16px;background:#ff6a00;color:#fff;padding:13px 20px;border-radius:12px;text-decoration:none;font-weight:700}</style></head><body><div class="box"><h1>Ops, não conseguimos enviar.</h1><p>'.$safe.'</p><a class="btn" href="javascript:history.back()">Voltar e tentar novamente</a></div></body></html>';
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') falhar('Acesse o formulário pelo site.', 405);
if (!empty($_POST['website'] ?? '')) { header('Location: sucesso.html'); exit; }

function campo(string $nome): string {
    return trim((string)($_POST[$nome] ?? ''));
}
function h(string $v): string { return htmlspecialchars($v, ENT_QUOTES, 'UTF-8'); }

$comercio = campo('Comercio');
$whatsapp = campo('WhatsApp');
$pacote = campo('Pacote');
$valor = campo('Valor');
$frases = campo('Frases');

if ($comercio === '' || $whatsapp === '' || $pacote === '' || $valor === '') falhar('Preencha os campos obrigatórios antes de enviar.');
if (!preg_match('/\d{10,11}/', preg_replace('/\D/', '', $whatsapp))) falhar('Confira o número do WhatsApp informado.');

if (!isset($_FILES['logo']) || $_FILES['logo']['error'] !== UPLOAD_ERR_OK) falhar('Selecione a logo do comércio para continuar.');
$logo = $_FILES['logo'];
if ($logo['size'] > MAX_LOGO_BYTES) falhar('A logo deve ter no máximo 5 MB.');

$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime = $finfo->file($logo['tmp_name']);
$permitidos = ['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'];
if (!isset($permitidos[$mime])) falhar('Envie a logo em PNG, JPG ou WEBP.');

$boundary = '=_ComercioEmFigurinha_' . bin2hex(random_bytes(12));
$assunto = 'Novo pedido pelo site - ' . $comercio;
$assuntoCod = '=?UTF-8?B?'.base64_encode($assunto).'?=';

$frasesHtml = '';
foreach (preg_split('/\R/', $frases) as $linha) {
    if (trim($linha) !== '') $frasesHtml .= '<li style="margin:0 0 7px">'.h($linha).'</li>';
}

$html = '<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#2b160b">'
.'<div style="max-width:680px;margin:24px auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #eee">'
.'<div style="background:#ff6a00;color:#fff;padding:24px 28px"><div style="font-size:13px;font-weight:bold;letter-spacing:1px">COMÉRCIO EM FIGURINHA</div><h1 style="margin:8px 0 0;font-size:25px">Novo contato pelo site</h1></div>'
.'<div style="padding:28px"><table role="presentation" style="width:100%;border-collapse:collapse">'
.'<tr><td style="padding:9px 0;color:#777">Comércio</td><td style="padding:9px 0;font-weight:bold">'.h($comercio).'</td></tr>'
.'<tr><td style="padding:9px 0;color:#777">WhatsApp</td><td style="padding:9px 0;font-weight:bold">'.h($whatsapp).'</td></tr>'
.'<tr><td style="padding:9px 0;color:#777">Pacote</td><td style="padding:9px 0;font-weight:bold">'.h($pacote).'</td></tr>'
.'<tr><td style="padding:9px 0;color:#777">Valor</td><td style="padding:9px 0;font-weight:bold;font-size:20px;color:#ff6a00">'.h($valor).'</td></tr>'
.'</table><hr style="border:0;border-top:1px solid #eee;margin:20px 0"><h2 style="font-size:18px">Frases escolhidas</h2><ol style="padding-left:24px">'.$frasesHtml.'</ol>'
.'<p style="margin-top:24px;padding:14px;background:#fff7f0;border-radius:10px"><b>Logo:</b> anexada a este e-mail como '.h(basename((string)$logo['name'])).'.</p>'
.'</div></div></body></html>';

$headers = [];
$headers[] = 'MIME-Version: 1.0';
$headers[] = 'From: Comercio em Figurinha <'.DESTINO.'>';
$headers[] = 'Reply-To: '.DESTINO;
$headers[] = 'Content-Type: multipart/mixed; boundary="'.$boundary.'"';

$body = '--'.$boundary."\r\n";
$body .= "Content-Type: text/html; charset=UTF-8\r\n";
$body .= "Content-Transfer-Encoding: base64\r\n\r\n";
$body .= chunk_split(base64_encode($html))."\r\n";

$arquivo = file_get_contents($logo['tmp_name']);
$nomeSeguro = 'logo-'.$permitidos[$mime];
$body .= '--'.$boundary."\r\n";
$body .= 'Content-Type: '.$mime.'; name="'.$nomeSeguro."\"\r\n";
$body .= "Content-Transfer-Encoding: base64\r\n";
$body .= 'Content-Disposition: attachment; filename="'.$nomeSeguro."\"\r\n\r\n";
$body .= chunk_split(base64_encode($arquivo))."\r\n";
$body .= '--'.$boundary."--\r\n";

$enviado = mail(DESTINO, $assuntoCod, $body, implode("\r\n", $headers));
if (!$enviado) falhar('O servidor não conseguiu enviar o e-mail. Verifique se a função mail() está habilitada na sua hospedagem ou configure SMTP.', 500);

header('Location: sucesso.html', true, 303);
exit;
