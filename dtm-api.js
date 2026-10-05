/* Dim Ticket Market : connexion du site au Google Sheets (Apps Script)
   À charger APRÈS le script principal : <script src="dtm-api.js?v=3"></script> */
(function(){
if(window.__DTM_API__)return;
window.__DTM_API__=1;

const API="https://script.google.com/macros/s/AKfycbw2eHLMpO6617-jwHj5xaSDzGSTFpEvYMTeNNwd6bDo8jHR6Z8y-_6FY_WRQUW_PYbp/exec";
const MOIS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
const CLASSES=['p1','p2','p3','p4'];
const g=id=>document.getElementById(id);
const existe=n=>{try{return typeof eval(n)!=='undefined'}catch(e){return false}};

/* ---------- « Mes billets » : commandes gardées sur cet appareil ---------- */
function memoriser(c){
  try{
    const l=JSON.parse(localStorage.getItem('dtm_mes_billets')||'[]').filter(x=>x.code!==c.code);
    c.ajoute=Date.now();l.unshift(c);
    localStorage.setItem('dtm_mes_billets',JSON.stringify(l.slice(0,50)));
  }catch(e){}
}

/* ---------- Visites (lancé en premier, jamais bloquant) ---------- */
const vues={};
function visite(page,evenement){
  try{
    const cle=page+'|'+(evenement||'');if(vues[cle])return;vues[cle]=1;
    let ville='';
    try{ville=(Intl.DateTimeFormat().resolvedOptions().timeZone||'').split('/').pop().replace(/_/g,' ')}catch(e){}
    fetch(API,{method:'POST',keepalive:true,body:JSON.stringify({action:'visite',page:page,evenement:evenement||'',ville:ville})}).catch(()=>{});
  }catch(e){}
}
visite('accueil');

/* ---------- Page de réservation : visite "reservation" ---------- */
try{
  if(existe('checkout')&&typeof window.checkout==='function'){
    const origine=window.checkout;
    window.checkout=function(){const r=origine.apply(this,arguments);try{if(cur)visite('reservation',cur.id)}catch(e){}return r};
  }
  if(existe('ev')&&typeof window.ev==='function'){
    const origineEv=window.ev;
    window.ev=function(top){const r=origineEv.apply(this,arguments);try{if(top!==false&&cur)visite('evenement',cur.id)}catch(e){}return r};
  }
}catch(e){}

/* ---------- Commande : on intercepte le bouton "Réserver mes billets" ---------- */
document.addEventListener('click',function(e){
  const b=e.target&&e.target.closest?e.target.closest('[data-a="confirm"]'):null;
  if(!b)return;
  if(!(existe('cur')&&existe('sel')&&cur&&cur.t))return; // données absentes : le site garde son fonctionnement normal
  e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
  commander(b);
},true);

async function commander(btn){
  const val=id=>g(id)?g(id).value.trim():'';
  const err=m=>{const x=g('err');if(x)x.textContent=m};
  try{
    const nm=val('nm'),ph=val('ph'),ad=val('ad'),cd=val('cd').toUpperCase(),em=val('em');
    if(!nm||!ph)return err('Renseignez votre nom et votre téléphone.');
    if(!/^\+?[\d\s]{8,16}$/.test(ph))return err('Le numéro de téléphone n’est pas valide. Exemple : +243 970 000 000.');
    if(cd&&!/^[A-Z0-9]{2,4}-?[A-Z0-9]{2,4}$/.test(cd))return err('Le code jeu-concours ressemble à DTM-XXX, ou laissez-le vide.');
    if(!g('c1')||!g('c1').checked)return err('Cochez la réception des informations de réservation sur WhatsApp pour continuer.');
    const pmEl=document.querySelector('input[name=pm]:checked');
    const pm=pmEl?pmEl.value:'';
    const mk=g('c2')?g('c2').checked:false;
    const billets=cur.t.map((x,i)=>sel[i]?{type:x.k,qte:sel[i]}:null).filter(Boolean);
    if(!billets.length)return err('Choisissez au moins un billet.');
    err('');

    const texte=btn.textContent;
    btn.disabled=true;btn.textContent='Envoi en cours…';
    let srv=null,panne=false;
    try{
      const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),15000);
      const r=await fetch(API,{method:'POST',signal:ctl.signal,body:JSON.stringify({action:'commande',eventId:cur.id,nom:nm,telephone:ph,adresse:ad||'Non renseignée',email:em,paiement:pm,promo:cd,billets:billets})});
      clearTimeout(to);
      srv=await r.json();
    }catch(x){panne=true}
    btn.disabled=false;btn.textContent=texte;

    if(srv&&srv.ok){
      memoriser({code:srv.code,nom:nm,evenement:cur.n,date:cur.d,total:srv.total});
      location.href='paiement.html?id='+encodeURIComponent(srv.code)+'&nom='+encodeURIComponent(nm)+'&montant='+encodeURIComponent(srv.total);
      return;
    }
    if(srv&&srv.error){return err(srv.error)}
    // Serveur injoignable : on garde l'ancien parcours (message WhatsApp)
    if(panne&&typeof window.done==='function'){
      window.done({nm:nm,ph:ph,em:em,ad:ad,cd:cd,mk:mk,pm:pm});
      return;
    }
    err('Impossible d’enregistrer votre commande pour le moment. Vérifiez votre connexion et réessayez.');
  }catch(x){
    err('Erreur technique : '+(x&&x.message?x.message:x));
  }
}

/* ---------- Événements et publicités venant du Sheets ---------- */
function fdate(s){const m=String(s||'').match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);return m?(+m[1]+' '+MOIS[m[2]-1]+' '+m[3]):String(s||'')}
function urlOk(u){return /^https?:\/\//i.test(u||'')?String(u).replace(/'/g,'%27').replace(/"/g,'%22'):''}
function waHref(v){v=String(v||'').trim();if(/^https?:\/\//i.test(v))return v;const d=v.replace(/\D/g,'');return d?'https://wa.me/'+d:''}

function mapEvent(x,i){
  const t=[];
  if(x.prixNormal>0)t.push({k:'Standard',p:x.prixNormal,s:Infinity});
  if(x.prixVip>0)t.push({k:'VIP',p:x.prixVip,s:Infinity});
  if(/sold/i.test(x.statut))t.forEach(a=>{a.s=0});
  return {id:x.id,n:x.artiste,d:fdate(x.date),h:'',l:'',c:CLASSES[i%CLASSES.length],img:urlOk(x.affiche),tag:'',x:'',t:t};
}

function installerAffichage(){
  // Pour les événements du Sheets (sans lieu ni heure) : on n'affiche que ce qui existe
  const quand=e=>`<p class="inf">${ic.cal}${[e.d,e.h?'à '+e.h:''].filter(Boolean).join(' ')}</p>`;
  const lieu=e=>e.l?`<p class="inf">${ic.pin}${e.l}</p>`:'';
  window.list=function(){
    const r=EV.filter(e=>(cat==='Tout'||K[e.id]===cat)&&(e.n+' '+e.l).toLowerCase().includes(q.toLowerCase()));
    $('#list').innerHTML=r.map(e=>`<article class="card">${poster(e)}<div class="b"><h3 class="ti">${e.n}</h3>${quand(e)}${lieu(e)}<div class="row ft"><span>${out(e)?'<b class="bad">SOLD OUT</b>':'À partir de <b>'+usd(low(e))+'</b>'}</span><button class="btn" data-a="open" data-id="${e.id}"${out(e)?' disabled':''}>Acheter</button></div></div></article>`).join('')||'<p class="m">Aucun événement dans cette catégorie pour le moment.</p>';
  };
  const origineEv=window.ev;
  window.ev=function(top=true){
    const e=cur,n=cnt();
    if(top)visite('evenement',e.id);
    (top?nav:draw)(`<button class="lnk" data-a="home">Retour aux événements</button><div class="card" style="margin-top:12px">${poster(e)}<div class="b"><p class="m">${[e.d,e.h?'à '+e.h:''].filter(Boolean).join(' ')}${e.l?'<br>'+e.l:''}</p>${e.x?'<p>'+e.x+'</p>':''}</div></div><h2>Choisissez vos billets</h2>`
    +(out(e)?'<p class="bad"><b>ÉVÉNEMENT SOLD OUT</b></p>':'')
    +e.t.map((x,i)=>`<div class="tk"><div><b>${x.k}</b> ${usd(x.p)}<br>${x.s>0?`<span class="m">${x.s===Infinity?'Illimité':x.s+' disponibles'}</span>`:'<b class="bad">SOLD OUT</b>'}</div><div class="st"><button data-a="dec" data-i="${i}" aria-label="Retirer un billet ${x.k}"${x.s<=0?' disabled':''}>−</button><output>${sel[i]||0}</output><button data-a="inc" data-i="${i}" aria-label="Ajouter un billet ${x.k}"${x.s<=0?' disabled':''}>+</button></div></div>`).join('')
    +`<div class="row"><span>${n} billet${n>1?'s':''} : <b>${usd(tot())}</b></span><button class="btn" data-a="pay"${n?'':' disabled'}>Continuer</button></div>`);
  };
}

function renderAds(pubs){
  const box=g('adcar');if(!box)return;
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
  const dots=g('addots');
  if(dots)dots.innerHTML=Array.from(box.children).map((_,i)=>'<span'+(i?'':' class="on"')+'></span>').join('');
}

function appliquerStock(stock){
  if(!stock||!existe('EV'))return;
  EV.forEach(e=>{
    const r=stock[e.id];if(!r)return;
    e.t.forEach(x=>{
      const k=/vvip/i.test(x.k)?'vvip':(/vip/i.test(x.k)?'vip':'standard');
      if(k in r)x.s=(r[k]===null?Infinity:Math.max(0,Number(r[k])||0));
    });
  });
}

async function charger(){
  try{
    const r=await fetch(API);const d=await r.json();
    if(!d||!d.ok)return;
    if(d.publicites&&d.publicites.length)renderAds(d.publicites);
    let change=false;
    if(d.evenements&&d.evenements.length&&existe('EV')&&existe('K')&&existe('ic')){
      EV.splice(0,EV.length,...d.evenements.map(mapEvent));
      EV.forEach(e=>{K[e.id]='Concert'});
      installerAffichage();
      change=true;
    }
    if(d.stock){appliquerStock(d.stock);change=true}
    if(change&&!cur){
      if(document.activeElement&&document.activeElement.id==='q')window.list();else window.home();
    }
  }catch(err){}
}
charger();
})();