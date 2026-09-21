const marketing=document.querySelector('#marketing'),mascote=document.querySelector('#mascote');
const total=document.querySelector('#total'),summaryName=document.querySelector('#summaryName'),saving=document.querySelector('#saving');
const pacoteField=document.querySelector('#pacoteField'),valorField=document.querySelector('#valorField'),form=document.querySelector('#leadForm');
const whatsapp=document.querySelector('#whatsapp'),steps=[...document.querySelectorAll('.form-step')],nextBtn=document.querySelector('#nextBtn'),backBtn=document.querySelector('#backBtn');
const progressFill=document.querySelector('#progressFill'),stepLabel=document.querySelector('#stepLabel'),fileInput=document.querySelector('#logoUpload'),fileName=document.querySelector('#fileName');
let current=0;
const defaults=['Muito Obrigado.','Já vamos te atender.','PIX recebido!','Só um momento...','Pedido recebido!','Volte sempre!','Boa noite!','Saiu para entrega!','Obrigado pela preferência.'];
const money=v=>v.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
function updatePackage(){let price=39.90,items=['Atendimento'];document.querySelector('#marketingCard').classList.toggle('selected',marketing.checked);document.querySelector('#mascoteCard').classList.toggle('selected',mascote.checked);if(marketing.checked){price+=25;items.push('Marketing')}if(mascote.checked){price+=29.90;items.push('Criação de mascote')}if(marketing.checked&&mascote.checked){price=79.90;saving.hidden=false}else saving.hidden=true;total.textContent=money(price);summaryName.textContent=items.join(' + ');pacoteField.value=items.join(' + ');valorField.value=money(price)}
marketing.addEventListener('change',updatePackage);mascote.addEventListener('change',updatePackage);
document.querySelector('#phrasesList').innerHTML=defaults.map((x,i)=>`<label class="phrase-row"><b>${i+1}</b><input name="frase_${i+1}" value="${x}" aria-label="Frase ${i+1}"><span>✎</span></label>`).join('');
function syncPhrases(){document.querySelector('#frasesField').value=[...document.querySelectorAll('.phrase-row input')].map((x,i)=>`${i+1} - ${x.value}`).join('\n')}
function showStep(){steps.forEach((s,i)=>s.classList.toggle('active',i===current));progressFill.style.width=`${(current+1)/steps.length*100}%`;stepLabel.textContent=`${current+1} de ${steps.length}`;backBtn.hidden=current===0;nextBtn.hidden=current===steps.length-1;if(current===3)review()}
function validStep(){const fields=[...steps[current].querySelectorAll('input[required]')];for(const f of fields){if(!f.checkValidity()){f.reportValidity();return false}}return true}
nextBtn.addEventListener('click',()=>{if(!validStep())return;syncPhrases();current=Math.min(current+1,steps.length-1);showStep();document.querySelector('#montar').scrollIntoView({behavior:'smooth',block:'start'})});
backBtn.addEventListener('click',()=>{current=Math.max(0,current-1);showStep()});
whatsapp.addEventListener('input',e=>{let v=e.target.value.replace(/\D/g,'').slice(0,11);if(v.length>10)v=v.replace(/(\d{2})(\d{5})(\d{0,4})/,'($1) $2-$3');else if(v.length>6)v=v.replace(/(\d{2})(\d{4})(\d{0,4})/,'($1) $2-$3');else if(v.length>2)v=v.replace(/(\d{2})(\d+)/,'($1) $2');e.target.value=v});
fileInput.addEventListener('change',()=>fileName.textContent=fileInput.files[0]?.name||'PNG, JPG ou WEBP');
function review(){syncPhrases();document.querySelector('#reviewCard').innerHTML=`<div><small>Comércio</small><b>${form.Comercio.value}</b></div><div><small>WhatsApp</small><b>${form.WhatsApp.value}</b></div><div><small>Pacote</small><b>${pacoteField.value}</b></div><div><small>Valor</small><b>${valorField.value}</b></div><div class="wide"><small>Logo</small><b>${fileInput.files[0]?.name||'Imagem selecionada'}</b></div><div class="wide"><small>Frases</small><b>9 frases prontas para personalização</b></div>`}
form.addEventListener('submit',e=>{syncPhrases();if(!form.checkValidity()){e.preventDefault();return}const btn=form.querySelector('.submit');btn.innerHTML='Enviando...';btn.disabled=true});
document.querySelector('#year').textContent=new Date().getFullYear();updatePackage();showStep();
