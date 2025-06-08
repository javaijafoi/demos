if(typeof window!=="undefined"){ 
  if('serviceWorker' in navigator){navigator.serviceWorker.register('script.js');}
  const form=document.getElementById('astro-form');
  const chartDiv=document.getElementById('chart');
  const results=document.getElementById('results');
  const credits=document.getElementById('credits');
  const signs=['\u00c1ries','Touro','G\u00eameos','C\u00e2ncer','Le\u00e3o','Virgem','Libra','Escorpi\u00e3o','Sagit\u00e1rio','Capric\u00f3rnio','Aqu\u00e1rio','Peixes'];
  form.addEventListener('submit',async e=>{
    e.preventDefault();
    const cidade=document.getElementById('cidade').value.trim();
    const uf=document.getElementById('uf').value;
    const data=document.getElementById('data').value;
    const hora=document.getElementById('hora').value;
    const fuso=parseInt(document.getElementById('fuso').value,10);
    if(!cidade||!uf){alert('Cidade e UF s\u00e3o obrigat\u00f3rias');return;}
    const t0=performance.now();
    try{
      const geo=await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(cidade+' '+uf+' brasil')}`);
      const j=await geo.json();
      if(!j[0])throw'Localiza\u00e7\u00e3o n\u00e3o encontrada';
      const lat=parseFloat(j[0].lat); const lon=parseFloat(j[0].lon);
      const dt=new Date(data+'T'+hora);
      dt.setMinutes(dt.getMinutes()+60*fuso);
      const lib=window['circular-natal-horoscope-js']||window.CNH||window;
      const origin=new lib.Origin({year:dt.getUTCFullYear(),month:dt.getUTCMonth(),date:dt.getUTCDate(),hour:dt.getUTCHours(),minute:dt.getUTCMinutes(),latitude:lat,longitude:lon});
      const horoscope=new lib.Horoscope({origin,houseSystem:'placidus',zodiac:'tropical',language:'en'});
      const bodies=['Sun','Moon','Mercury','Venus','Mars','Jupiter','Saturn','Uranus','Neptune','Pluto'];
      const planets={};
      bodies.forEach(b=>{const p=horoscope.CelestialBodies[b.toLowerCase()];planets[b]=[p.ChartPosition.Ecliptic.DecimalDegrees];});
      const cusps=horoscope.Houses.map(h=>h.ChartPosition.StartPosition.Ecliptic.DecimalDegrees);
      chartDiv.innerHTML='';
      const chart=new astrochart.Chart('chart',800,800).radix({planets,cusps});
      chart.addPointsOfInterest({As:[cusps[0]],Ic:[cusps[3]],Ds:[cusps[6]],Mc:[cusps[9]]});
      chart.aspects();
      results.innerHTML='';
      const row=(lab,deg)=>{const s=Math.floor(((deg%360)+360)/30)%12;const d=((deg%30)+30)%30;const tr=document.createElement('tr');tr.innerHTML=`<th>${lab}</th><td>${d.toFixed(2)}\u00b0 ${signs[s]}</td>`;results.appendChild(tr);};
      bodies.forEach(b=>row(b,planets[b][0]));
      row('Ascendente',horoscope.Angles.ascendant.ChartPosition.Ecliptic.DecimalDegrees);
      row('Meio-C\u00e9u',horoscope.Angles.midheaven.ChartPosition.Ecliptic.DecimalDegrees);
      credits.style.display='block';
      console.log('tempo:',(performance.now()-t0).toFixed(0),'ms');
    }catch(err){alert('Erro: '+err);}
  });
}else{
  const CACHE='astro-v1';
  self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(['astrologia.html','style.css','script.js'])));self.skipWaiting();});
  self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));});
  self.addEventListener('fetch',e=>{
    if(e.request.url.includes('nominatim.openstreetmap.org')){
      e.respondWith(caches.open(CACHE).then(c=>c.match(e.request).then(r=>r||fetch(e.request).then(res=>{c.put(e.request,res.clone());return res;}))));
    }else{
      e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
    }
  });
}
