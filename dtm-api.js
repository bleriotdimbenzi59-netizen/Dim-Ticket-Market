/* Dim Ticket Market : connexion du site au Google Sheets (via Apps Script)
   À charger APRÈS le script principal : <script src="dtm-api.js"></script> */
(function(){
const API='https://script.google.com/macros/s/AKfycbzZEQMBTyCml06ysxzQy2AM0fsyjBFEsrJRdR-TPMwqOuM5s7taEnK82acYwb-1K2E/exec';
const MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const CLASSES=['p1','p2','p3','p4'];

function fdate(s){const m=String(s||'').match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);return m?(+m[1]+' '+MOIS[m[2]-1]+' '+m[3]):String(s||'')}
function urlOk(u){return /^https?:\/\//i.test(u||'')?String(u).replace(/'/g,'%27').replace(/"/g,'%22'):''}
function waHref(v){v=String(v||'').trim();if(/^https?:\/\//i.test(v))return v;const d=v.replace(/\D/g,'');return d?'https://wa.me/'+d:''}

/* ---------- 1) ÉVÉNEMENTS (feuille EVENEMENTS) ---------- */
function mapEvent(x,i){
  const t=[];
  if(x.prixNormal>0)t.push({k:'Standard',p:x.prixNormal,s:Infinity});
  if(x.prixVip>0)t.push({k:'VIP',p:x.prixVip,s:Infinity});
  if(/sold/i.test(x.statut))t.forEach(a=>{a.s=0});
  return {id:x.id,n:x.artiste,d:fdate(x.date),h:'',l:'',c:CLASSES[i%CLASSES.length],img:urlOk(x.affiche),tag:'',x:'',t:t};
}

const quand=e=>`<p class="inf">${ic.cal}${[e.d,e.h?'à '+e.h:''].filter(Boolean).join(' ')}</p>`;
const lieu=e=>e.l?`<p class="inf">${ic.pin}${e.l}</p>`:'';

list=function(){
  const r=EV.filter(e=>(cat==='Tout'||K[e.id]===cat)&&(e.n+' '+e.l).toLowerCase().includes(q.toLowerCase()));
  $('#list').innerHTML=r.map(e=>`<article class="card">${poster(e)}<div class="b"><h3 class="ti">${e.n}</h3>${quand(e)}${lieu(e)}<div class="row ft"><span>${out(e)?'<b class="bad">SOLD OUT</b>':'À partir de <b>'+usd(low(e))+'</b>'}</span><button class="btn" data-a="open" data-id="${e.id}"${out(e)?' disabled':''}>Acheter</button></div></div></article>`).join('')||'<p class="m">Aucun événement dans cette catégorie pour le moment.</p>';
};

ev=function(top=true){
  const e=cur,n=cnt();
  if(top)visite('evenement',e.id);
  (top?nav:draw)(`<button class="lnk" data-a="home">Retour aux événements</button><div class="card" style="margin-top:12px">${poster(e)}<div class="b"><p class="m">${[e.d,e.h?'à '+e.h:''].filter(Boolean).join(' ')}${e.l?'<br>'+e.l:''}</p>${e.x?'<p>'+e.x+'</p>':''}</div></div><h2>Choisissez vos billets</h2>`
  +(out(e)?'<p class="bad"><b>ÉVÉNEMENT SOLD OUT</b></p>':'')
  +e.t.map((x,i)=>`<div class="tk"><div><b>${x.k}</b> ${usd(x.p)}<br>${x.s>0?`<span class="m">${x.s===Infinity?'Illimité':x.s+' disponibles'}</span>`:'<b class="bad">SOLD OUT</b>'}</div><div class="st"><button data-a="dec" data-i="${i}" aria-label="Retirer un billet ${x.k}"${x.s<=0?' disabled':''}>−</button><output>${sel[i]||0}</output><button data-a="inc" data-i="${i}" aria-label="Ajouter un billet ${x.k}"${x.s<=0?' disabled':''}>+</button></div></div>`).join('')
  +`<div class="row"><span>${n} billet${n>1?'s':''} : <b>${usd(tot())}</b></span><button class="btn" data-a="pay"${n?'':' disabled'}>Continuer</button></div>`);
};

/* ---------- 2) PUBLICITÉS (feuille PUBLICITES) ---------- */
function renderAds(pubs){
  const box=document.getElementById('adcar');if(!box)return;
  box.querySelectorAll('[data-sheetad]').forEach(n=>n.remove());
  const slide=p=>{
    const img=urlOk(p.image);if(!img)return null;
    const href=waHref(p.whatsapp);
    const el=document.createElement(href?'a':'div');
    el.className='adsl';el.setAttribute('data-sheetad','1');
    el.setAttribute('aria-label','Publicité : '+(p.client||''));
    if(href){el.href=href;el.target='_blank';el.rel='noopener'}
    el.style.cssText="padding:0;background:#0f0f10 url('"+img+"') center/cover no-repeat";
    return el;
  };
  pubs.filter(p=>/top/i.test(p.emplacement)).reverse().forEach(p=>{const s=slide(p);if(s)box.insertBefore(s,box.firstChild)});
  pubs.filter(p=>!/top/i.test(p.emplacement)).forEach(p=>{const s=slide(p);if(s)box.appendChild(s)});
  const dots=document.getElementById('addots');
  if(dots)dots.innerHTML=Array.from(box.children).map((_,i)=>'<span'+(i?'':' class="on"')+'></span>').join('');
}

/* ---------- 3) VISITES (feuille VISITES) ---------- */
const vues={};
function visite(page,evenement){
  const cle=page+'|'+(evenement||'');if(vues[cle])return;vues[cle]=1;
  let ville='';
  try{ville=(Intl.DateTimeFormat().resolvedOptions().timeZone||'').split('/').pop().replace(/_/g,' ')}catch(e){}
  try{fetch(API,{method:'POST',keepalive:true,body:JSON.stringify({action:'visite',page:page,evenement:evenement||'',ville:ville})}).catch(()=>{})}catch(e){}
}
const checkoutOrigine=checkout;
checkout=function(){checkoutOrigine();if(cur)visite('reservation',cur.id)};

/* ---------- 4) COMMANDES (feuille COMMANDES) ---------- */
done=async function(c){
  const e=cur;
  nav('<div class="wait"><div class="spin"></div><p class="m">Envoi de votre demande…</p></div>');
  const billets=e.t.map((x,i)=>sel[i]?{type:x.k,qte:sel[i]}:null).filter(Boolean);
  let srv=null;
  try{
    const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),9000);
    const r=await fetch(API,{method:'POST',signal:ctl.signal,body:JSON.stringify({action:'commande',eventId:e.id,nom:c.nm,telephone:c.ph,adresse:c.ad,email:c.em,paiement:c.pm,promo:c.cd,billets:billets})});
    clearTimeout(to);srv=await r.json();
  }catch(err){srv=null}
  if(srv&&srv.ok===false&&/complet/i.test(srv.error||'')){
    nav('<p class="bad"><b>Cet événement est complet (SOLD OUT).</b></p><p>Désolé, il n’y a plus de billets disponibles.</p><button class="btn full" data-a="home">Retour aux événements</button>');
    return;
  }
  const serveurOk=!!(srv&&srv.ok);
  if(serveurOk){location.href='paiement.html?id='+encodeURIComponent(srv.code)+'&nom='+encodeURIComponent(c.nm)+'&montant='+encodeURIComponent(srv.total);return;}
  const id=serveurOk?srv.code:'DTM-'+new Date().toISOString().slice(2,10).replace(/-/g,'')+'-'+Array.from(crypto.getRandomValues(new Uint8Array(4)),b=>b.toString(16).padStart(2,'0')).join('').toUpperCase();
  const L=e.t.map((x,i)=>sel[i]?sel[i]+' x '+x.k+' ('+usd(x.p)+')':'').filter(Boolean),total=usd(serveurOk?srv.total:tot());
  const ou=[e.d,e.h,e.l].filter(Boolean).join(', ');
  const msg='Bonjour Dim Ticket Market, je souhaite réserver.\n\nRéservation : '+id+'\nÉvénement : '+e.n+(ou?' ('+ou+')':'')+'\nBillets :\n- '+L.join('\n- ')+'\nTotal : '+total+'\n\nNom : '+c.nm+'\nTéléphone : '+c.ph+'\nE-mail : '+(c.em||'non renseigné')+'\nAdresse : '+(c.ad||'non renseignée')+'\nCode promo : '+(c.cd||'aucun')+'\nMode de paiement souhaité : '+c.pm+'\nInfos sur les prochains événements : '+(c.mk?'oui':'non');
  lastMsg=msg;
  const url=waLink(msg);
  nav(`<p class="ok">Votre demande a bien été reçue.</p><h1>${id}</h1><p>Notre équipe vous contactera sur WhatsApp pour confirmer votre réservation et vous communiquer les modalités de paiement et de retrait.</p><div class="ticket"><h2>${e.n}</h2><p class="m">${ou}</p>${L.map(t=>`<p>${t}</p>`).join('')}<p><b>Total à payer : ${total}</b></p><p class="m">Adresse : ${esc(c.ad)}</p><p class="m">Mode de paiement : ${esc(c.pm)}</p></div><a class="btn full wa" href="${url}" target="_blank" rel="noopener">Réserver avec WhatsApp</a><button class="btn full wa" data-a="wabiz" style="margin-top:10px">Réserver avec WhatsApp Business</button><p class="m tiny" style="text-align:center;margin-top:10px">Aucun des deux ne s’ouvre ? <button class="lnk" data-a="copywa" style="padding:0;font-size:12px">Copier notre numéro</button> (<b>${WA_DISPLAY}</b>) et <button class="lnk" data-a="copymsg" style="padding:0;font-size:12px">copier votre message</button>, puis collez les deux dans WhatsApp.</p><button class="lnk" data-a="home">Retour aux événements</button>`);
};

/* ---------- Chargement au démarrage ---------- */
async function charger(){
  try{
    const r=await fetch(API);const d=await r.json();
    if(!d||!d.ok)return;
    if(d.evenements&&d.evenements.length){
      EV.splice(0,EV.length,...d.evenements.map(mapEvent));
      EV.forEach(e=>{K[e.id]='Concert'});
    }
    renderAds(d.publicites||[]);
    if(!cur){
      if(document.activeElement&&document.activeElement.id==='q')list();else home();
    }
  }catch(err){}
}
visite('accueil');
charger();
})();