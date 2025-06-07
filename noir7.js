const counts={fate:[],d4:[],d6:[],d8:[],d10:[],d20:[],d100:[]};
const defaultColor='#ff0066';
const sidebar=document.getElementById('sidebar');
const paletteColors=['#ff0066','#33ccff','#aaff00','#ff6600','#cc33ff'];

function updateBadges(){
  document.querySelectorAll('.icon').forEach(i=>{
    i.querySelector('.badge').textContent=counts[i.dataset.type].length;
  });
}

function rollDie(t){
  switch(t){
    case 'fate':return ['\u2212','0','+'][Math.floor(Math.random()*3)];
    case 'd4':return Math.floor(Math.random()*4)+1;
    case 'd6':return Math.floor(Math.random()*6)+1;
    case 'd8':return Math.floor(Math.random()*8)+1;
    case 'd10':return Math.floor(Math.random()*10)+1;
    case 'd20':return Math.floor(Math.random()*20)+1;
    case 'd100':return Math.floor(Math.random()*100)+1;
  }
}

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
  }
  return row.querySelector('.dice-container');
}

function openDiePicker(die,type){
  let picker=document.getElementById('palette-picker');
  if(picker) picker.remove();
  picker=document.createElement('div');
  picker.id='palette-picker';
  picker.className='palette-picker';
  const index=parseInt(die.dataset.index);
  paletteColors.forEach(c=>{
    const b=document.createElement('button');
    b.style.background=c;
    b.addEventListener('click',()=>{
      counts[type][index]=c;
      die.style.color=c;
      picker.remove();
    });
    picker.appendChild(b);
  });
  document.body.appendChild(picker);
  const r=die.getBoundingClientRect();
  picker.style.left=`${r.right+5+window.scrollX}px`;
  picker.style.top=`${r.top+window.scrollY}px`;
}

document.addEventListener('click',e=>{
  const picker=document.getElementById('palette-picker');
  if(picker && !picker.contains(e.target) && !e.target.classList.contains('die')) picker.remove();
});

sidebar.addEventListener('contextmenu',e=>{
  e.preventDefault();
  const t=e.target.closest('.icon');
  if(t&&counts[t.dataset.type].length>0){
    counts[t.dataset.type].pop();
    const cont=document.getElementById('row-'+t.dataset.type)?.querySelector('.dice-container');
    if(cont&&cont.lastElementChild) cont.lastElementChild.remove();
    updateBadges();
  }
});

sidebar.addEventListener('click',e=>{
  const t=e.target.closest('.icon');
  if(!t) return;
  const type=t.dataset.type;
  const cont=getRow(type);
  const die=document.createElement('div');
  die.className='die';
  die.style.color=defaultColor;
  die.dataset.type=type;
  die.dataset.index=counts[type].length;
  die.addEventListener('click',ev=>{ev.stopPropagation();openDiePicker(die,type);});
  cont.appendChild(die);
  counts[type].push(defaultColor);
  updateBadges();
});

document.getElementById('roll').addEventListener('click',()=>{
  const hist=document.querySelector('#history span');
  let log='';
  Object.keys(counts).forEach(t=>{
    const cont=document.getElementById('row-'+t)?.querySelectorAll('.die');
    if(cont){
      cont.forEach(d=>{
        const v=rollDie(t);
        d.textContent=v;
        log+=v+' ';
      });
    }
  });
  hist.textContent=log+hist.textContent;
});

document.getElementById('clear').addEventListener('click',()=>{
  document.querySelector('#history span').textContent='';
});

updateBadges();
