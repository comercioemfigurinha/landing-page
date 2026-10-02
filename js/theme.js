// Temas da landing page: lê ?tema=nome e aplica cores/textos de temas.csv
(function(){
var CSV_URL='temas.csv',JS_URL='temas.js';try{var SRC=document.currentScript.src;CSV_URL=new URL('../temas.csv',SRC).href;JS_URL=new URL('../temas.js',SRC).href}catch(e){}
var COLS=['tema','cor_principal','cor_secundaria','cor_texto','cor_fundo','cor_suave','eyebrow','titulo','subtitulo','btn_hero','btn_topo','titulo_form','ph_nome','ph_comercio','img_logo','img_mascote','img_ex1','img_ex2','img_ex3','img_ex4'];
function parse(t){
  t=t.replace(/^\ufeff/,'');var rows=[],r=[],f='',q=false;
  for(var i=0;i<t.length;i++){var c=t[i];
    if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}
    else if(c=='"')q=true;
    else if(c==','){r.push(f);f=''}
    else if(c=='\n'||c=='\r'){if(c=='\r'&&t[i+1]=='\n')i++;r.push(f);f='';rows.push(r);r=[]}
    else f+=c}
  if(f!==''||r.length){r.push(f);rows.push(r)}
  var head=rows.shift()||[];
  return rows.filter(function(x){return x.some(function(v){return v!==''})}).map(function(x){var o={};head.forEach(function(h,i){o[h.trim()]=x[i]||''});return o});
}
function toCSV(list){
  var esc=function(v){return '"'+String(v==null?'':v).replace(/"/g,'""')+'"'};
  return [COLS.join(',')].concat(list.map(function(o){return COLS.map(function(c){return esc(o[c])}).join(',')})).join('\r\n')+'\r\n';
}
function slug(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}
function esc(s){return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function apply(o){
  var s=document.documentElement.style;
  function v(k,x){if(x)s.setProperty(k,x)}
  v('--orange',o.cor_principal);v('--orange2',o.cor_secundaria);v('--ink',o.cor_texto);v('--cream',o.cor_fundo);v('--soft',o.cor_suave);
  var st=document.getElementById('tema-css');
  if(!st){st=document.createElement('style');st.id='tema-css';document.head.appendChild(st)}
  st.textContent=`:root{--line:color-mix(in srgb,var(--orange) 16%,#fff);--muted:color-mix(in srgb,var(--ink) 62%,#fff);--shadow:0 20px 50px color-mix(in srgb,var(--ink) 12%,transparent);--sh:color-mix(in srgb,var(--orange) 30%,transparent);--shs:color-mix(in srgb,var(--ink) 8%,transparent)}
.hero{background:radial-gradient(circle at 85% 10%,var(--soft,#ffe5d0) 0,transparent 28%),linear-gradient(135deg,#fff 40%,var(--cream))!important}
.benefits article>span,.phrase-row b{background:var(--soft,#fff1e8)}
.btn.primary,.submit,.price-single{box-shadow:0 12px 30px var(--sh)}
.phone-card{box-shadow:0 30px 80px color-mix(in srgb,var(--ink) 25%,transparent)}
.package,.style-card,.lead-box,.form-step,.post-form{box-shadow:0 12px 40px var(--shs)}
.package.selected{box-shadow:0 12px 35px var(--sh)}
.fields input:focus,.fields textarea:focus{box-shadow:0 0 0 3px var(--sh)}
.examples-toggle{background:var(--orange);box-shadow:0 0 15px var(--sh)}
.loading-spin{border-color:var(--soft);border-top-color:var(--orange)}
.wizard-progress{background:var(--line)}
.summary span{color:var(--soft)}.total strong{color:var(--orange2)}
.complete{background:linear-gradient(135deg,var(--orange),var(--orange2))}.complete h2 b{color:var(--ink)}
footer{background:color-mix(in srgb,var(--ink) 75%,#000)}footer p{color:var(--soft)}
.upload-box{background:var(--cream);border-color:var(--line)}.review-card div{background:var(--cream)}
#cefLoading{background:color-mix(in srgb,var(--ink) 55%,transparent)}`;
  function T(sel,x){var e=document.querySelector(sel);if(e&&x)e.textContent=x}
  T('.hero .eyebrow',o.eyebrow);T('.hero-copy > p',o.subtitulo);T('.hero .btn.primary',o.btn_hero);T('.top-cta',o.btn_topo);T('.builder-intro h2',o.titulo_form);
  if(o.titulo){var h=document.querySelector('.hero h1');if(h)h.innerHTML=esc(o.titulo).replace(/\*(.+?)\*/g,'<span>$1</span>')}
  var n=document.querySelector('input[name=Nome]'),c=document.querySelector('input[name=Comercio]');
  if(n&&o.ph_nome)n.placeholder=o.ph_nome;if(c&&o.ph_comercio)c.placeholder=o.ph_comercio;
  [['img_logo','#logoCard img'],['img_mascote','#mascoteCard img'],['img_ex1','#examplesStrip figure:nth-child(1) img'],['img_ex2','#examplesStrip figure:nth-child(2) img'],['img_ex3','#examplesStrip figure:nth-child(3) img'],['img_ex4','#examplesStrip figure:nth-child(4) img']].forEach(function(p){
    if(!(p[0] in o))return;var e=document.querySelector(p[1]);if(!e)return;
    if(!e.dataset.def)e.dataset.def=e.getAttribute('src');
    var u=o[p[0]]||e.dataset.def;if(e.getAttribute('src')!==u)e.src=u;});
  var m=document.querySelector('meta[name=theme-color]');if(m&&o.cor_principal)m.content=o.cor_principal;
}
// Lê os temas do site: temas.csv (http/https) ou, abrindo direto do disco (file://), temas.js
function loadSite(){
  return fetch(CSV_URL,{cache:'no-cache'}).then(function(r){if(!r.ok)throw 0;return r.text()}).then(function(t){return {l:parse(t),via:'temas.csv'}})
  .catch(function(){return new Promise(function(res,rej){var s=document.createElement('script');s.src=JS_URL+'?v='+Date.now();
    s.onload=function(){res({l:parse(window.CEF_TEMAS_CSV||''),via:'temas.js'})};s.onerror=function(){rej(new Error('sem temas'))};document.head.appendChild(s)})});
}
window.CEFTheme={csvUrl:CSV_URL,jsUrl:JS_URL,loadSite:function(){return loadSite().then(function(x){return x.l})},COLS:COLS,parse:parse,toCSV:toCSV,apply:apply,slug:slug};
window.addEventListener('message',function(e){if(e.data&&e.data.cefTema)apply(e.data.cefTema)});
var nome=slug(new URLSearchParams(location.search).get('tema'));
if(!nome||window.CEF_EDITOR)return;
var root=document.documentElement,hide=document.createElement('style');
hide.textContent='html.tema-loading body{visibility:hidden}';document.head.appendChild(hide);
root.classList.add('tema-loading');
var done=function(){root.classList.remove('tema-loading')};
setTimeout(done,1500);
var ready=new Promise(function(r){document.readyState==='loading'?document.addEventListener('DOMContentLoaded',r):r()});
function acha(l){return (l||[]).filter(function(x){return slug(x.tema)===nome})[0]}
var info={};
var dados=loadSite().then(function(x){info.via=x.via;info.total=x.l.length;return acha(x.l)}).catch(function(){info.erro=1});
Promise.all([dados,ready]).then(function(a){if(a[0])apply(a[0]);else info.naoachou=1}).catch(function(){}).then(function(){
  done();
  if(new URLSearchParams(location.search).get('debug')){var d=document.createElement('div');d.style.cssText='position:fixed;left:8px;right:8px;bottom:8px;z-index:99999;background:#111;color:#fff;font:13px/1.4 system-ui;padding:10px 12px;border-radius:10px';
    d.textContent='Tema "'+nome+'": '+(info.erro?'não consegui ler temas.csv nem temas.js':info.naoachou?'NÃO está nos temas do site':'aplicado')+(info.via?' | lido de '+info.via+' ('+info.total+' tema(s))':'')+' | '+CSV_URL;
    document.body.appendChild(d)}});
})();
