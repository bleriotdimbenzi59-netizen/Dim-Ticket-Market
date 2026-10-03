const SHEET_URL = "https://script.google.com/macros/s/AKfycbzZEQMBTyCml06ysxzQy2AM0fsyjBFEsrJRdR-TPMwqOuM5s7taEnK82acYwb-1K2E/exec";

async function reserverTicket(nom, whatsapp, pays){
  const id = "DTM-" + Date.now();
  
  // 1. On redirige DIRECT, on n'attend pas la réponse
  const urlPay = `pay.html?id=${id}&nom=${encodeURIComponent(nom)}`;
  localStorage.setItem("dtm_last_id", id);

  // 2. On envoie au Sheet en arrière-plan (même si ça bloque, on est déjà parti)
  try{
    await fetch(SHEET_URL, {
      method: "POST",
      mode: "no-cors",
      headers: {"Content-Type": "text/plain"},
      body: JSON.stringify({nom, whatsapp, pays, id_forced: id})
    });
  } catch(e){ console.log("Sheet en arrière plan", e); }
  
  window.location.href = urlPay;
  return id;
}

// Pour pay.html - il lit l'id depuis l'URL ou localStorage
async function getCommande(id){
  try{
    const r = await fetch(`${SHEET_URL}?id=${id}`);
    const j = await r.json();
    if(j && !j.error) return j;
  } catch(e){}
  // fallback si Sheet pas encore dispo : on recrée depuis l'URL
  const urlParams = new URLSearchParams(window.location.search);
  return {
    id: id,
    nom: urlParams.get("nom") || "Client",
    statut: "en_attente"
  };
}