// DTM API - connecté à ton Google Sheet
const SHEET_URL = "https://script.google.com/macros/s/AKfycbzbOaB4Jb-3Dg-3D/exec"; // <-- REMPLACE par ton URL

async function reserverCommande(){
  const btn = document.querySelector('button[onclick="reserverCommande()"]');
  if(btn){ btn.textContent="Enregistrement..."; btn.disabled=true; }

  try{
    const nom = document.getElementById('nm')?.value.trim();
    const tel = document.getElementById('ph')?.value.trim();
    const email = document.getElementById('em')?.value.trim();
    const adresse = document.getElementById('ad')?.value.trim();
    const codepromo = document.getElementById('cd')?.value.trim();
    const paiement = document.querySelector('input[name="pm"]:checked')?.value || "Espèces";

    if(!nom ||!tel){ alert("Nom et téléphone obligatoires"); if(btn){btn.textContent="Réserver mes billets"; btn.disabled=false;} return; }

    // Billets
    const billets = (typeof sel!== 'undefined' && typeof cur!== 'undefined')?
      cur.t.map((x,i)=> sel[i]? `${x.k} x${sel[i]}` : null).filter(Boolean).join(', ')
      : "1 billet";

    const montant = (typeof tot === 'function')? tot() : 0;
    const evenement = (typeof cur!== 'undefined')? cur.n : "Événement DTM";

    // Génère ID ticket
    const ticketId = "DTM-" + Math.random().toString(36).substring(2,8).toUpperCase();

    // Envoie vers Google Sheet
    await fetch(SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        id: ticketId,
        nom: nom,
        telephone: tel,
        email: email,
        adresse: adresse,
        codepromo: codepromo,
        paiement: paiement,
        evenement: evenement,
        billets: billets,
        montant: montant,
        date: new Date().toISOString()
      })
    });

    // Redirige vers ticket
    window.location.href = "ticket.html?id=" + ticketId + "&nom=" + encodeURIComponent(nom);

  }catch(e){
    alert("Erreur: " + e.message);
    if(btn){btn.textContent="Réserver mes billets"; btn.disabled=false;}
  }
}