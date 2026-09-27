/**
 * COMÉRCIO EM FIGURINHA — Backend em Google Apps Script
 * Recebe os cadastros do site, grava na planilha e salva a logo no Drive.
 * Também serve os dados para a tela admin.html (protegida por senha).
 *
 * COMO USAR — veja o passo a passo completo em LEIA-ME-GOOGLE-SHEETS.txt
 */

// ======== CONFIGURAÇÃO (edite estas 2 linhas) ========
const FOLDER_ID = 'COLE_AQUI_O_ID_DA_PASTA_DO_DRIVE';
const SENHA_ADMIN = 'COLE_AQUI_UMA_SENHA';
// ======================================================

const SHEET_NAME = 'Cadastros';
const COLUNAS = ['Data', 'Comercio', 'WhatsApp', 'Pacote', 'Valor', 'Frases', 'LogoUrl', 'LogoFileId'];

/**
 * Recebe o envio do formulário do site (chamado via fetch POST).
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const p = (e && e.parameter) || {};
    const sheet = getOrCreateSheet_();

    let logoUrl = '';
    let logoFileId = '';

    if (p.LogoBase64) {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const bytes = Utilities.base64Decode(p.LogoBase64);
      const nomeArquivo = (p.Comercio || 'logo') + ' - ' + (p.LogoName || 'logo.png');
      const blob = Utilities.newBlob(bytes, p.LogoType || 'image/png', nomeArquivo);
      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      logoFileId = file.getId();
      logoUrl = 'https://drive.google.com/thumbnail?id=' + logoFileId + '&sz=w800';
    }

    sheet.appendRow([
      new Date(),
      p.Comercio || '',
      p.WhatsApp || '',
      p.Pacote || '',
      p.Valor || '',
      p.Frases || '',
      logoUrl,
      logoFileId
    ]);

    return jsonOutput_({ ok: true });
  } catch (err) {
    return jsonOutput_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Serve os cadastros para a tela admin.html.
 * Chamado como GET .../exec?senha=SUA_SENHA
 */
function doGet(e) {
  const senha = (e && e.parameter && e.parameter.senha) || '';
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
      return obj;
    })
    .reverse(); // mais recentes primeiro

  return jsonOutput_({ ok: true, registros });
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
