const counts={fate:0,d4:0,d6:0,d8:0,d10:0,d20:0,d100:0};
const colors={fate:'#ff0066',d4:'#ff0066',d6:'#ff0066',d8:'#ff0066',d10:'#ff0066',d20:'#ff0066',d100:'#ff0066'};
const neon=['#ff0066','#33ccff','#aaff00','#ff6600','#cc33ff'];
const sidebar=document.getElementById('sidebar');
const picker=document.getElementById('picker');
let pressTimer,target,longPress;
function updateBadges(){document.querySelectorAll('.icon').forEach(i=>i.querySelector('.badge').textContent=counts[i.dataset.type])}
function rollDie(t){switch(t){case 'fate':return ['\u2212','0','+'][Math.floor(Math.random()*3)];case 'd4':return Math.floor(Math.random()*4)+1;case 'd6':return Math.floor(Math.random()*6)+1;case 'd8':return Math.floor(Math.random()*8)+1;case 'd10':return Math.floor(Math.random()*10)+1;case 'd20':return Math.floor(Math.random()*20)+1;case 'd100':return Math.floor(Math.random()*100)+1}}
function addDie(type){counts[type]++;updateBadges()}
function removeDie(type){if(counts[type]>0){counts[type]--;updateBadges()}}
function buildPicker(x,y,type){picker.innerHTML='';neon.forEach((c,i)=>{const b=document.createElement('button');b.style.background=c;b.style.transform=`rotate(${i*72}deg) translate(60px)`;b.style.setProperty('--i',i);b.onclick=()=>{colors[type]=c;document.querySelector(`.icon[data-type="${type}"]`).style.setProperty('--c',c);document.querySelector(`.icon[data-type="${type}"]`).classList.add('active');picker.classList.remove('show')};picker.appendChild(b)});picker.style.left=`${x}px`;picker.style.top=`${y}px`;picker.classList.add('show')}
sidebar.addEventListener('contextmenu',e=>{e.preventDefault();const t=e.target.closest('.icon');if(t)removeDie(t.dataset.type)});
sidebar.addEventListener('click',e=>{const t=e.target.closest('.icon');if(t&&!longPress)addDie(t.dataset.type)});
sidebar.addEventListener('mousedown',e=>{const t=e.target.closest('.icon');if(!t)return;longPress=false;pressTimer=setTimeout(()=>{longPress=true;if(counts[t.dataset.type]>0)buildPicker(e.clientX,e.clientY,t.dataset.type)},400)});
sidebar.addEventListener('mouseup',()=>clearTimeout(pressTimer));
sidebar.addEventListener('touchstart',e=>{const t=e.target.closest('.icon');if(!t)return;target=t;longPress=false;pressTimer=setTimeout(()=>{longPress=true;if(counts[t.dataset.type]>0)buildPicker(e.touches[0].clientX,e.touches[0].clientY,t.dataset.type)},400)});
sidebar.addEventListener('touchend',e=>{clearTimeout(pressTimer);if(target&&!longPress)addDie(target.dataset.type);target=null});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&document.activeElement.classList.contains('icon')){e.preventDefault();document.activeElement.click()}});
document.addEventListener('click',e=>{if(!picker.contains(e.target))picker.classList.remove('show')});
function roll(){const res=document.getElementById('results');const hist=document.querySelector('#history span');res.innerHTML='';let log='';Object.keys(counts).forEach(t=>{for(let i=0;i<counts[t];i++){const v=rollDie(t);const d=document.createElement('div');d.className='die';d.style.color=colors[t];d.textContent=v;res.appendChild(d);log+=v+' '}});hist.textContent=log+hist.textContent}
document.getElementById('roll').addEventListener('click',roll);document.getElementById('clear').addEventListener('click',()=>{document.querySelector('#history span').textContent=''});updateBadges();
