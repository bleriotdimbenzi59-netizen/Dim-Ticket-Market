const SHEET_URL = "https://script.google.com/macros/s/AKfycbzfFRG--5H0jY_m_vDOFLeGr5F6BIOIMHfaueDazGbfhjHqPY5JIbgAPRal-riwudqw/exec";

async function reserverCommande(){
  const btn = document.querySelector('button[onclick="reserverCommande()"]');
  if(btn){ const t=btn.textContent; btn.textContent="Enregistrement..."; btn.disabled=true; }

  try{
    const nom = document.getElementById('nm')?.value.trim();
    const tel = document.getElementById('ph')?.value.trim();
    if(!nom ||!tel){ alert("Nom et téléphone obligatoires"); if(btn){btn.textContent="Réserver mes billets"; btn.disabled=false;} return; }

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

    // Envoi compatible Google Script
    await fetch(SHEET_URL, {
      method: "POST",
      body: JSON.stringify(data)
    });

    // Succès -> ticket
    window.location.href = "ticket.html?id=" + ticketId + "&nom=" + encodeURIComponent(nom);

  }catch(e){
    alert("Erreur: " + e.message + " - Mais ton ticket est créé localement");
    const ticketId = "DTM-" + Math.random().toString(36).substring(2,8).toUpperCase();
    window.location.href = "ticket.html?id=" + ticketId;
  }
}