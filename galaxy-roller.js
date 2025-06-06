const types=['fate','d4','d6','d8','d10','d20','d100'];
const counts={};
const defaults={};
const diceColors={};
const neon=['#ff0066','#33ccff','#aaff00','#ff6600','#cc33ff'];
const ring=document.getElementById('ring');
const picker=document.getElementById('picker');
let pressTimer,target,longPress;

// init state
types.forEach(t=>{counts[t]=0;defaults[t]='#ff0066';diceColors[t]=[]});

function updateBadges(){
  document.querySelectorAll('.icon').forEach(i=>{
    i.querySelector('.badge').textContent=counts[i.dataset.type];
  });
}

function updateChips(type){
  const container=document.querySelector(`.icon[data-type="${type}"] .chips`);
  container.innerHTML='';
  diceColors[type].forEach((c,i)=>{
    const s=document.createElement('span');
    s.className='chip';
    s.style.background=c;
    s.dataset.index=i;
    s.onclick=()=>{
      const input=document.createElement('input');
      input.type='color';
      input.value=c;
      input.style.position='absolute';
      input.style.left='-9999px';
      document.body.appendChild(input);
      input.oninput=()=>{diceColors[type][i]=input.value;s.style.background=input.value;};
      input.onchange=()=>input.remove();
      input.click();
    };
    container.appendChild(s);
  });
}

function rollDie(t){
  switch(t){
    case 'fate': return ['\u2212','0','+'][Math.floor(Math.random()*3)];
    case 'd4': return Math.floor(Math.random()*4)+1;
    case 'd6': return Math.floor(Math.random()*6)+1;
    case 'd8': return Math.floor(Math.random()*8)+1;
    case 'd10': return Math.floor(Math.random()*10)+1;
    case 'd20': return Math.floor(Math.random()*20)+1;
    case 'd100': return Math.floor(Math.random()*100)+1;
  }
}

function addDie(type){
  counts[type]++;
  diceColors[type].push(defaults[type]);
  updateBadges();
  updateChips(type);
}

function removeDie(type){
  if(counts[type]>0){
    counts[type]--;
    diceColors[type].pop();
    updateBadges();
    updateChips(type);
  }
}

function buildPicker(x,y,type){
  picker.innerHTML='';
  neon.forEach((c,i)=>{
    const b=document.createElement('button');
    b.style.background=c;
    b.style.transform=`rotate(${i*72}deg) translate(60px)`;
    b.onclick=()=>{defaults[type]=c;document.querySelector(`.icon[data-type="${type}"]`).style.setProperty('--c',c);document.querySelector(`.icon[data-type="${type}"]`).classList.add('active');picker.classList.remove('show')};
    picker.appendChild(b);
  });
  picker.style.left=`${x}px`;
  picker.style.top=`${y}px`;
  picker.classList.add('show');
}

ring.addEventListener('contextmenu',e=>{
  e.preventDefault();
  const t=e.target.closest('.icon');
  if(t)removeDie(t.dataset.type);
});

ring.addEventListener('click',e=>{
  const t=e.target.closest('.icon');
  if(t && !longPress) addDie(t.dataset.type);
});

ring.addEventListener('mousedown',e=>{
  const t=e.target.closest('.icon');
  if(!t) return;
  longPress=false;
  pressTimer=setTimeout(()=>{longPress=true;buildPicker(e.clientX,e.clientY,t.dataset.type)},400);
});

ring.addEventListener('mouseup',()=>clearTimeout(pressTimer));
ring.addEventListener('touchstart',e=>{
  const t=e.target.closest('.icon');
  if(!t) return;
  target=t;
  longPress=false;
  pressTimer=setTimeout(()=>{longPress=true;buildPicker(e.touches[0].clientX,e.touches[0].clientY,t.dataset.type)},400);
});
ring.addEventListener('touchend',e=>{
  clearTimeout(pressTimer);
  if(target && !longPress) addDie(target.dataset.type);
  target=null;
});
document.addEventListener('click',e=>{if(!picker.contains(e.target))picker.classList.remove('show')});

document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&document.activeElement.classList.contains('icon')){e.preventDefault();document.activeElement.click()}});

function getRow(type){
  let row=document.getElementById('row-'+type);
  if(!row){
    row=document.createElement('div');
    row.className='dice-row';
    row.id='row-'+type;
    const label=document.createElement('span');
    label.className='label';
    label.textContent=type;
    const cont=document.createElement('div');
    cont.className='dice-container';
    row.appendChild(label);
    row.appendChild(cont);
    document.getElementById('results').appendChild(row);
  }else{
    row.querySelector('.dice-container').innerHTML='';
  }
  return row.querySelector('.dice-container');
}

function roll(){
  const res=document.getElementById('results');
  res.innerHTML='';
  const hist=document.querySelector('#history span');
  let log='';
  types.forEach(t=>{
    if(counts[t]>0){
      const cont=getRow(t);
      diceColors[t].forEach(col=>{
        const v=rollDie(t);
        const d=document.createElement('div');
        d.className='die';
        d.style.color=col;
        d.textContent=v;
        cont.appendChild(d);
        log+=v+' ';
      });
    }
  });
  hist.textContent=log+hist.textContent;
}

document.getElementById('roll').addEventListener('click',roll);
document.getElementById('clear').addEventListener('click',()=>{document.querySelector('#history span').textContent=''});
updateBadges();
