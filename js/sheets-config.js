// ======================================================================
// CONFIGURAÇÃO DO SITE — Comércio em Figurinha
// Edite os 3 valores abaixo. Veja o passo a passo em LEIA-ME-GOOGLE-SHEETS.txt
// ======================================================================
window.SHEETS_CONFIG = {
  // Cole aqui a URL do Web App do Apps Script (termina em /exec)
  scriptUrl: 'https://script.google.com/macros/s/AKfycbxN-hqPL9f02WmAQsP7njoMVf3H2Hp-HD42T58oH5kf4JMlz-oR4Wtusg1psu9eo6-n/exec',

  // Link de checkout do produto na Kiwify (sem parâmetros — eles são adicionados pelo script)
  kiwifyCheckoutUrl: 'https://pay.kiwify.com.br/CISp2zn',

  // Cadastre os links reais de checkout para os DOIS novos produtos.
  // O link antigo acima cobra R$ 47,00 e não é usado pela nova página.
  kiwifyCheckoutProntoUrl: '', // produto de R$ 14,50
  kiwifyCheckoutPersonalizadoUrl: '', // produto de R$ 39,40

  // WhatsApp da equipe, exibido na tela de "obrigado" para dar segurança ao cliente
  whatsappSuporte: 'https://wa.me/+5518996961409',
};
