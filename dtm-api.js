const SHEET_URL = "https://script.google.com/macros/s/AKfycbwDtRo_nyLeuE9rSu3J2qfFGE-etCtvU8zb0t5X10EG3kx1_9ucdlfPMEkmErmoTHGt/exec";

function reserverTicket(nom, whatsapp, pays){
  if(!nom || !whatsapp){ alert("Remplis nom et whatsapp"); return; }
  const id = "DTM-" + Date.now();
  try {
    fetch(SHEET_URL, {method:"POST", mode:"no-cors", body: JSON.stringify({nom: nom, whatsapp: whatsapp, pays: pays, id_forced: id})});
  } catch(e){}
  location.href = "pay.html?id=" + id + "&nom=" + encodeURIComponent(nom);
}