const SHEET_URL = "https://script.google.com/macros/s/AKfycbxJnT1gK2X8N2FaTwWegzfkynLYG_hpxa6hXPNyS17TNMufrEpspNkXs-yPSEsiVLb6/exec";

async function reserverCommande(){
  const nom = document.getElementById('nm')?.value.trim();
  const tel = document.getElementById('ph')?.value.trim();
  if(!nom ||!tel){ alert("Nom et téléphone obligatoires"); return; }

  const ticketId = "DTM-" + Math.random().toString(36).substring(2,8).toUpperCase();
  const evenement = window.cur? cur.n : "Evenement";
  const billets = window.sel && window.cur? cur.t.map((x,i)=> sel[i]? `${x.k} x${sel[i]}`:null).filter(Boolean).join(', ') : "1 billet";
  const montant = typeof tot==='function'? tot() : 0;

  const data = {
    id: ticketId,
    nom: nom,
    telephone: tel,
    email: document.getElementById('em')?.value || "",
    adresse: document.getElementById('ad')?.value || "",
    paiement: document.querySelector('input[name="pm"]:checked')?.value || "Especes",
    evenement: evenement,
    billets: billets,
    montant: montant
  };

  // Envoi sans vérification (no-cors) = plus d'erreur Load failed
  try{
    fetch(SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify(data)
    });
  }catch(e){}

  // On redirige direct, pas besoin d'attendre Google
  window.location.href = "paiement.html?id=" + ticketId + "&nom=" + encodeURIComponent(nom) + "&montant=" + montant;
}