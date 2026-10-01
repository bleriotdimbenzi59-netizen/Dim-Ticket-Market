const EXEC_URL = "https://script.google.com/macros/s/AKfycbz1LFh2kk-aVFL8Nkz_tHXui4V20z-NgBUNb-DXMKz1WJ4WZgM98hL_WWW9Mlj24SGb/exec";

async function reserverCommande() {
  const id = "DTM-" + Math.random().toString(36).substr(2,8).toUpperCase();
  
  const data = {
    id: id,
    event: "Feti na Mabré — Concert de Makarabianko",
    billets: document.querySelector('[name=billets]').value,
    total: document.querySelector('[name=total]').value,
    nom: document.querySelector('[name=nom]').value,
    phone: document.querySelector('[name=phone]').value,
    email: document.querySelector('[name=email]').value,
    adresse: document.querySelector('[name=adresse]').value,
    promo: document.querySelector('[name=promo]').value,
    paiement: "Orange Money +243852862455",
    statut: "EN_ATTENTE"
  };

  await fetch(EXEC_URL, {method: "POST", mode: "no-cors", body: JSON.stringify(data)});
  
  // Redirige vers la page mémoire
  window.location.href = "ticket.html?id=" + id;
}