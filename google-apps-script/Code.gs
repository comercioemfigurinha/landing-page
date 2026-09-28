/**
 * COMÉRCIO EM FIGURINHA — Backend em Google Apps Script
 *
 * Fluxo completo:
 * 1) Site cria um "lead pendente" (nome, comércio, whatsapp, estilo) e recebe um UserId.
 * 2) Site redireciona pro checkout da Kiwify já com esse UserId (?s1=).
 * 3) Kiwify chama este script via webhook quando o pagamento muda de status.
 * 4) Depois de pagar, sucesso.html manda a logo + as frases, casando pelo UserId.
 * 5) admin.html lista tudo, e agora também edita status e apaga registros.
 *
 * COMO USAR — veja o passo a passo completo em LEIA-ME-GOOGLE-SHEETS.txt
 */

// ======== CONFIGURAÇÃO (edite estas linhas) ========
const FOLDER_ID = 'COLE_AQUI_O_ID_DA_PASTA_DO_DRIVE';
const SENHA_ADMIN = 'COLE_AQUI_UMA_SENHA';
const KIWIFY_WEBHOOK_TOKEN = 'COLE_AQUI_O_TOKEN_DO_WEBHOOK_DA_KIWIFY';
// ====================================================

const SHEET_NAME = 'Cadastros';
const LOG_SHEET_NAME = 'WebhookLogs';

// Ordem das colunas na planilha "Cadastros". Se mudar aqui, mude também em getOrCreateSheet_.
const COLUNAS = [
  'Data', 'UserId', 'Nome', 'Comercio', 'WhatsApp', 'Estilo',
  'StatusPagamento', 'FormaPagamento', 'DataPagamento', 'Valor',
  'Frases', 'LogoUrl', 'LogoFileId', 'StatusServico'
];

const VALOR_PADRAO = 'R$ 47,00';
const STATUS_SERVICO_PADRAO = 'A pagar';

/**
 * Ponto de entrada único para todos os POSTs: site, sucesso.html, admin e o webhook da Kiwify.
 * O parâmetro "acao" diferencia cada caso. Sem "acao" reconhecida => tenta tratar como webhook da Kiwify
 * (ela não permite escolhermos o formato do corpo, então esse é o fallback).
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const p = (e && e.parameter) || {};
    const acao = p.acao || '';

    switch (acao) {
      case 'criar_lead':
        return criarLead_(p);
      case 'finalizar':
        return finalizarPedido_(p);
      case 'admin_atualizar':
        return adminAtualizar_(p);
      case 'admin_excluir':
        return adminExcluir_(p);
      default:
        // Sem "acao" reconhecida: é o webhook da Kiwify chamando a URL "crua".
        return receberWebhookKiwify_(e);
    }
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * 1) Cria a linha "pendente" assim que a pessoa termina o mini-formulário no site,
 * antes de ir pro checkout da Kiwify.
 */
function criarLead_(p) {
  const sheet = getOrCreateSheet_();
  const userId = p.UserId || ('usr_' + Utilities.getUuid().replace(/-/g, '').slice(0, 12));

  sheet.appendRow([
    new Date(),
    userId,
    p.Nome || '',
    p.Comercio || '',
    p.WhatsApp || '',
    p.Estilo || '',
    'pendente',      // StatusPagamento
    '',              // FormaPagamento
    '',              // DataPagamento
    VALOR_PADRAO,
    '',              // Frases (vem depois)
    '',              // LogoUrl (vem depois)
    '',              // LogoFileId (vem depois)
    STATUS_SERVICO_PADRAO
  ]);

  return jsonOutput_({ ok: true, userId });
}

/**
 * 2) Chamado pelo sucesso.html depois do pagamento: grava a logo/foto e as frases finais.
 */
function finalizarPedido_(p) {
  const sheet = getOrCreateSheet_();
  const linha = encontrarLinhaPorUserId_(sheet, p.UserId);
  if (!linha) return jsonOutput_({ ok: false, error: 'pedido_nao_encontrado' });

  const col = nome => COLUNAS.indexOf(nome) + 1;

  if (p.LogoBase64) {
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const bytes = Utilities.base64Decode(p.LogoBase64);
    const nomeArquivo = (p.Comercio || p.UserId || 'logo') + ' - ' + (p.LogoName || 'logo.png');
    const blob = Utilities.newBlob(bytes, p.LogoType || 'image/png', nomeArquivo);
    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    const logoFileId = file.getId();
    const logoUrl = 'https://drive.google.com/thumbnail?id=' + logoFileId + '&sz=w800';
    sheet.getRange(linha, col('LogoUrl')).setValue(logoUrl);
    sheet.getRange(linha, col('LogoFileId')).setValue(logoFileId);
  }

  if (p.Frases) {
    sheet.getRange(linha, col('Frases')).setValue(p.Frases);
  }

  // Se o pagamento já tiver sido confirmado pelo webhook, avança o status operacional.
  const statusAtual = sheet.getRange(linha, col('StatusServico')).getValue();
  if (statusAtual === 'Pago' || statusAtual === STATUS_SERVICO_PADRAO) {
    sheet.getRange(linha, col('StatusServico')).setValue('Em aprovação');
  }

  return jsonOutput_({ ok: true });
}

/**
 * 3) Recebe o webhook da Kiwify. Como o formato exato do payload pode variar,
 * SEMPRE gravamos o corpo bruto em WebhookLogs (pra depurar) e tentamos extrair
 * os campos mais prováveis. Ajuste extrairDadosWebhook_ se os nomes vierem diferentes.
 */
function receberWebhookKiwify_(e) {
  const corpoBruto = (e && e.postData && e.postData.contents) || '';
  registrarLogWebhook_(corpoBruto);

  let dados;
  try {
    dados = JSON.parse(corpoBruto);
  } catch (err) {
    return jsonOutput_({ ok: false, error: 'payload_invalido' });
  }

  // Validação simples do token, se a Kiwify enviar no corpo ou na query string.
  const tokenRecebido = (e.parameter && e.parameter.token) || dados.token || dados.webhook_token || '';
  if (KIWIFY_WEBHOOK_TOKEN && !String(KIWIFY_WEBHOOK_TOKEN).includes('COLE_') && tokenRecebido !== KIWIFY_WEBHOOK_TOKEN) {
    return jsonOutput_({ ok: false, error: 'token_invalido' });
  }

  const info = extrairDadosWebhook_(dados);
  if (!info.userId) {
    // Sem UserId não dá pra casar com nenhuma linha — mas já ficou salvo em WebhookLogs.
    return jsonOutput_({ ok: true, aviso: 'sem_user_id' });
  }

  const sheet = getOrCreateSheet_();
  const linha = encontrarLinhaPorUserId_(sheet, info.userId);
  if (!linha) return jsonOutput_({ ok: true, aviso: 'usuario_nao_encontrado' });

  const col = nome => COLUNAS.indexOf(nome) + 1;
  sheet.getRange(linha, col('StatusPagamento')).setValue(info.statusPagamento);
  if (info.formaPagamento) sheet.getRange(linha, col('FormaPagamento')).setValue(info.formaPagamento);
  if (info.statusPagamento === 'pago') {
    sheet.getRange(linha, col('DataPagamento')).setValue(new Date());
    sheet.getRange(linha, col('StatusServico')).setValue('Pago');
  } else if (info.statusPagamento === 'recusado' || info.statusPagamento === 'reembolsado') {
    sheet.getRange(linha, col('StatusServico')).setValue(info.statusPagamento === 'reembolsado' ? 'Reembolsado' : 'Recusado');
  }

  return jsonOutput_({ ok: true });
}

/**
 * Tenta ler os campos do payload da Kiwify em algumas variações conhecidas de nome.
 * IMPORTANTE: confirme com um teste real (veja a aba WebhookLogs) se os nomes batem;
 * ajuste esta função se precisar.
 */
function extrairDadosWebhook_(dados) {
  const evento = dados.webhook_event_type || dados.event || dados.order_status || '';
  const tracking = dados.TrackingParameters || dados.tracking_parameters || {};
  const userId = tracking.s1 || dados.s1 || '';
  const formaPagamento = dados.payment_method || dados.Payment_method || '';

  let statusPagamento = 'pendente';
  const status = String(dados.order_status || evento || '').toLowerCase();
  if (status.includes('paid') || status.includes('aprovada') || status.includes('approved')) statusPagamento = 'pago';
  else if (status.includes('refused') || status.includes('recusada')) statusPagamento = 'recusado';
  else if (status.includes('refunded') || status.includes('reembolsada')) statusPagamento = 'reembolsado';

  return { userId, statusPagamento, formaPagamento };
}

function registrarLogWebhook_(corpoBruto) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(LOG_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(LOG_SHEET_NAME);
    sheet.appendRow(['Data', 'PayloadBruto']);
  }
  sheet.appendRow([new Date(), corpoBruto]);
}

/**
 * 4) admin.html: listar tudo (GET, como já era) ou alterar/apagar (POST, novo).
 */
function doGet(e) {
  const p = (e && e.parameter) || {};

  // Usado pelo sucesso.html quando o cliente abre a página em outro aparelho/navegador
  // e o localStorage não tem o pedido salvo: localiza pelo WhatsApp, sem exigir senha,
  // mas devolve só os campos mínimos necessários (nunca a lista inteira).
  if (p.acao === 'buscar_por_whatsapp') {
    return buscarPorWhatsapp_(p.whatsapp || '');
  }

  const senha = p.senha || '';
  if (senha !== SENHA_ADMIN) {
    return jsonOutput_({ ok: false, error: 'senha_invalida' });
  }

  const sheet = getOrCreateSheet_();
  const valores = sheet.getDataRange().getValues();
  const header = valores.shift();

  const registros = valores
    .filter(row => row.join('') !== '')
    .map(row => {
      const obj = {};
      header.forEach((h, i) => { obj[h] = row[i]; });
      obj.Data = obj.Data ? new Date(obj.Data).toLocaleString('pt-BR') : '';
      obj.DataPagamento = obj.DataPagamento ? new Date(obj.DataPagamento).toLocaleString('pt-BR') : '';
      return obj;
    })
    .reverse(); // mais recentes primeiro

  return jsonOutput_({ ok: true, registros });
}

function buscarPorWhatsapp_(whatsapp) {
  const digitos = String(whatsapp || '').replace(/\D/g, '');
  if (!digitos) return jsonOutput_({ ok: false, error: 'whatsapp_invalido' });

  const sheet = getOrCreateSheet_();
  const dados = sheet.getDataRange().getValues();
  const header = dados.shift();
  const colWhats = header.indexOf('WhatsApp');

  // Percorre de trás pra frente pra pegar o pedido mais recente daquele WhatsApp.
  for (let i = dados.length - 1; i >= 0; i--) {
    const linha = dados[i];
    const digitosLinha = String(linha[colWhats] || '').replace(/\D/g, '');
    if (digitosLinha && digitosLinha === digitos) {
      const obj = {};
      header.forEach((h, idx) => { obj[h] = linha[idx]; });
      return jsonOutput_({
        ok: true,
        pedido: {
          UserId: obj.UserId, Nome: obj.Nome, Comercio: obj.Comercio,
          Estilo: obj.Estilo, StatusServico: obj.StatusServico
        }
      });
    }
  }
  return jsonOutput_({ ok: false, error: 'nao_encontrado' });
}

function adminAtualizar_(p) {
  if (p.senha !== SENHA_ADMIN) return jsonOutput_({ ok: false, error: 'senha_invalida' });
  const sheet = getOrCreateSheet_();
  const linha = encontrarLinhaPorUserId_(sheet, p.UserId);
  if (!linha) return jsonOutput_({ ok: false, error: 'pedido_nao_encontrado' });

  const col = nome => COLUNAS.indexOf(nome) + 1;
  // Campos que o admin pode editar diretamente.
  ['Nome', 'Comercio', 'WhatsApp', 'Estilo', 'StatusServico', 'Frases'].forEach(campo => {
    if (Object.prototype.hasOwnProperty.call(p, campo)) {
      sheet.getRange(linha, col(campo)).setValue(p[campo]);
    }
  });

  return jsonOutput_({ ok: true });
}

function adminExcluir_(p) {
  if (p.senha !== SENHA_ADMIN) return jsonOutput_({ ok: false, error: 'senha_invalida' });
  const sheet = getOrCreateSheet_();
  const linha = encontrarLinhaPorUserId_(sheet, p.UserId);
  if (!linha) return jsonOutput_({ ok: false, error: 'pedido_nao_encontrado' });
  sheet.deleteRow(linha);
  return jsonOutput_({ ok: true });
}

function encontrarLinhaPorUserId_(sheet, userId) {
  if (!userId) return null;
  const dados = sheet.getDataRange().getValues();
  const colUserId = COLUNAS.indexOf('UserId');
  for (let i = 1; i < dados.length; i++) {
    if (dados[i][colUserId] === userId) return i + 1; // +1 porque getRange é 1-based
  }
  return null;
}

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(COLUNAS);
  }
  return sheet;
}

function jsonOutput_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
