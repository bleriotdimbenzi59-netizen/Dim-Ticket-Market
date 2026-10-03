const SHEET_URL = "https://script.google.com/macros/s/AKfycbw2eHLMpO6617-jwHj5xaSDzGSTFpEvYMTeNNwd6bDo8jHR6Z8y-_6FY_WRQUW_PYbp/exec";
function reserverTicket(nom, whatsapp, pays){
  if(!nom || !whatsapp){ alert("Remplis nom et whatsapp"); return; }
  const id = "DTM-" + Date.now();
  try{ fetch(SHEET_URL,{method:"POST",mode:"no-cors",body:JSON.stringify({nom,whatsapp,pays,id_forced:id})}); }catch(e){}
  location.href = "pay.html?id="+id+"&nom="+encodeURIComponent(nom);
}