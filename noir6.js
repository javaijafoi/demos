const counts={fate:0,d4:0,d6:0,d8:0,d10:0,d20:0,d100:0};
const colors={fate:'#ff0066',d4:'#ff0066',d6:'#ff0066',d8:'#ff0066',d10:'#ff0066',d20:'#ff0066',d100:'#ff0066'};
const sidebar=document.getElementById('sidebar');
let pressTimer,target,longPress;
function updateBadges(){document.querySelectorAll('.icon').forEach(i=>i.querySelector('.badge').textContent=counts[i.dataset.type])}
function applyColors(){document.querySelectorAll('.icon').forEach(i=>{const t=i.dataset.type;i.style.setProperty('--c',colors[t]);const p=i.querySelector('.palette');if(p)p.style.background=colors[t]})}
function rollDie(t){switch(t){case 'fate':return ['\u2212','0','+'][Math.floor(Math.random()*3)];case 'd4':return Math.floor(Math.random()*4)+1;case 'd6':return Math.floor(Math.random()*6)+1;case 'd8':return Math.floor(Math.random()*8)+1;case 'd10':return Math.floor(Math.random()*10)+1;case 'd20':return Math.floor(Math.random()*20)+1;case 'd100':return Math.floor(Math.random()*100)+1}}
function addDie(type){counts[type]++;updateBadges()}
function removeDie(type){if(counts[type]>0){counts[type]--;updateBadges()}}
function openColorPicker(type){
  const input=document.createElement('input');
  input.type='color';
  input.value=colors[type];
  input.style.position='absolute';
  input.style.left='-9999px';
  document.body.appendChild(input);
  input.addEventListener('input',()=>{
    colors[type]=input.value;
    const icon=document.querySelector(`.icon[data-type="${type}"]`);
    icon.style.setProperty('--c',input.value);
    icon.classList.add('active');
    const pal=icon.querySelector('.palette');
    if(pal) pal.style.background=input.value;
  });
  input.addEventListener('change',()=>input.remove());
  input.click();
}
sidebar.addEventListener('contextmenu',e=>{e.preventDefault();const t=e.target.closest('.icon');if(t)removeDie(t.dataset.type)});
sidebar.addEventListener('click',e=>{
  if(e.target.classList.contains('palette')){
    openColorPicker(e.target.parentElement.dataset.type);
    e.stopPropagation();
    return;
  }
  const t=e.target.closest('.icon');
  if(t&&!longPress)addDie(t.dataset.type)
});
sidebar.addEventListener('mousedown',e=>{const t=e.target.closest('.icon');if(!t||e.target.classList.contains('palette'))return;longPress=false;pressTimer=setTimeout(()=>{longPress=true;openColorPicker(t.dataset.type)},400)});
sidebar.addEventListener('mouseup',()=>clearTimeout(pressTimer));
sidebar.addEventListener('touchstart',e=>{const t=e.target.closest('.icon');if(!t||e.target.classList.contains('palette'))return;target=t;longPress=false;pressTimer=setTimeout(()=>{longPress=true;openColorPicker(t.dataset.type)},400)});
sidebar.addEventListener('touchend',e=>{clearTimeout(pressTimer);if(target&&!longPress)addDie(target.dataset.type);target=null});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&document.activeElement.classList.contains('icon')){e.preventDefault();document.activeElement.click()}});
function getRow(type){let row=document.getElementById('row-'+type);if(!row){row=document.createElement('div');row.className='dice-row';row.id='row-'+type;const label=document.createElement('span');label.className='label';label.textContent=type;const cont=document.createElement('div');cont.className='dice-container';row.appendChild(label);row.appendChild(cont);document.getElementById('results').appendChild(row);}else{row.querySelector('.dice-container').innerHTML='';}return row.querySelector('.dice-container');}
function roll(){
  const res=document.getElementById('results');
  res.innerHTML='';
  const hist=document.querySelector('#history span');
  let log='';
  Object.keys(counts).forEach(t=>{
    if(counts[t]>0){
      const cont=getRow(t);
      for(let i=0;i<counts[t];i++){
        const v=rollDie(t);
        const d=document.createElement('div');
        d.className='die';
        d.style.color=colors[t];
        d.textContent=v;
        cont.appendChild(d);
        log+=v+' ';
      }
    }
  });
  hist.textContent=log+hist.textContent;
}
document.getElementById('roll').addEventListener('click',roll);
document.getElementById('clear').addEventListener('click',()=>{document.querySelector('#history span').textContent=''});
updateBadges();
applyColors();
