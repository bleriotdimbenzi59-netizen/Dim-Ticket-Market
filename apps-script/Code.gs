/* Dim Ticket Market : script Google Apps Script relié au Google Sheets.
   À coller dans Apps Script (Code.gs), puis : Déployer > Gérer les déploiements >
   Modifier (crayon) > Version : Nouvelle version > Déployer.
   ⚠ Remplacez A_REMPLACER ci-dessous par votre mot de passe admin. */

const SHEET_ID = '1AOu7uPbk-nsR2N4h9thlunYMtfRkJnvbPwFaTaG0qsI';
const TZ = 'Africa/Lubumbashi';
const CACHE_SECONDS = 60;
const ADMIN_KEY = 'A_REMPLACER';

function ss_() { return SpreadsheetApp.openById(SHEET_ID); }

function sortie_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function propre_(v, max) {
  let s = String(v === undefined || v === null ? '' : v).trim().slice(0, max || 200);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function norm_(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
}

function dateTexte_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'dd-MM-yyyy');
  return String(v || '').trim();
}

function dateObjet_(v) {
  if (v instanceof Date) return v;
  const m = String(v || '').trim().match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
  return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : null;
}

function nombreOuNull_(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return isFinite(n) && n >= 0 ? Math.floor(n) : null;
}

function lignes_(nomFeuille) {
  const f = ss_().getSheetByName(nomFeuille);
  if (!f) throw new Error('Feuille introuvable : ' + nomFeuille);
  const v = f.getDataRange().getValues();
  v.shift();
  return v;
}

/* EVENEMENTS : ID | Artiste | Date concert | Prix VIP | Prix Normal | Affiche | Statut
   | Places Normal (facultatif) | Places VIP (facultatif) */
function lireEvenements_() {
  return lignes_('EVENEMENTS')
    .filter(r => String(r[0]).trim() !== '')
    .map(r => ({
      id: String(r[0]).trim(),
      artiste: String(r[1]).trim(),
      date: dateTexte_(r[2]),
      prixVip: Number(r[3]) || 0,
      prixNormal: Number(r[4]) || 0,
      affiche: String(r[5]).trim(),
      statut: String(r[6]).trim() || 'Actif',
      placesNormal: nombreOuNull_(r[7]),
      placesVip: nombreOuNull_(r[8])
    }));
}

function lirePublicites_() {
  const aujourdhui = new Date();
  aujourdhui.setHours(0, 0, 0, 0);
  return lignes_('PUBLICITES')
    .filter(r => String(r[0]).trim() !== '')
    .filter(r => {
      const debut = dateObjet_(r[5]);
      const fin = dateObjet_(r[6]);
      return (!debut || aujourdhui >= debut) && (!fin || aujourdhui <= fin);
    })
    .map(r => ({
      id: String(r[0]).trim(),
      client: String(r[1]).trim(),
      image: String(r[2]).trim(),
      whatsapp: String(r[3]).trim(),
      emplacement: String(r[4]).trim()
    }));
}

/* ---------- COMMANDES : colonnes lues par leur NOM ---------- */
const ALIAS = {
  date: ['date'], code: ['code'], evenement: ['evenement'], nom: ['nom'],
  telephone: ['telephone'], email: ['email', 'e-mail'], adresse: ['adresse'],
  paiement: ['mode de paiement', 'paiement'], promo: ['code promo', 'code jeu-concours'],
  detail: ['nombre des billets', 'detail billets'],
  total: ['total'], statut: ['statut']
};
const TITRES = {
  date: 'Date', code: 'Code', evenement: 'Événement', nom: 'Nom',
  telephone: 'Téléphone', email: 'Email', adresse: 'Adresse',
  paiement: 'Mode de paiement', promo: 'Code promo', detail: 'Détail billets',
  total: 'Total', statut: 'Statut'
};

function colonnes_(f, creer) {
  const nb = Math.max(f.getLastColumn(), 1);
  const heads = f.getRange(1, 1, 1, nb).getValues()[0].map(norm_);
  const map = {};
  Object.keys(ALIAS).forEach(k => {
    for (const a of ALIAS[k]) {
      const i = heads.indexOf(a);
      if (i >= 0) { map[k] = i + 1; break; }
    }
  });
  if (creer) {
    let suivant = heads.some(h => h !== '') ? nb + 1 : 1;
    Object.keys(ALIAS).forEach(k => {
      if (!map[k]) {
        f.getRange(1, suivant).setValue(TITRES[k]);
        map[k] = suivant;
        suivant++;
      }
    });
  }
  return map;
}

function trouverCommande_(code, creer) {
  const f = ss_().getSheetByName('COMMANDES');
  const col = colonnes_(f, creer);
  if (!col.code) return null;
  const n = Math.max(f.getLastRow() - 1, 1);
  const codes = f.getRange(2, col.code, n, 1).getValues();
  for (let i = 0; i < codes.length; i++) {
    if (String(codes[i][0]).trim() === String(code).trim()) {
      return { feuille: f, col: col, ligne: i + 2 };
    }
  }
  return null;
}

function valeur_(c, cle) {
  if (!c.col[cle]) return '';
  return c.feuille.getRange(c.ligne, c.col[cle]).getValue();
}

/* « 2x Standard, 1x VIP » -> ['Standard', 'Standard', 'VIP'] */
function listeBillets_(detail) {
  const out = [];
  const re = /(\d+)\s*x\s*(vvip|vip|standard)/gi;
  let m;
  while ((m = re.exec(String(detail || ''))) !== null) {
    const type = typeBillet_(m[2]);
    const label = type === 'vvip' ? 'VVIP' : (type === 'vip' ? 'VIP' : 'Standard');
    for (let i = 0; i < Number(m[1]) && out.length < 100; i++) out.push(label);
  }
  return out;
}

function statutCommande_(code) {
  const c = trouverCommande_(code, false);
  if (!c) return { ok: true, statut: 'Non trouvé' };
  const detail = String(valeur_(c, 'detail'));
  return {
    ok: true,
    id: String(valeur_(c, 'code')),
    statut: valeur_(c, 'statut') || 'En attente',
    nom: String(valeur_(c, 'nom')).split(' ')[0],
    evenement: valeur_(c, 'evenement'),
    total: valeur_(c, 'total'),
    detail: detail,
    billets: listeBillets_(detail)
  };
}

function preuveEnvoyee_(code) {
  const c = trouverCommande_(code, true);
  if (!c) return { ok: false, error: 'Commande non trouvée' };
  const actuel = String(valeur_(c, 'statut') || 'En attente');
  if (/pay/i.test(actuel)) return { ok: true, statut: actuel };
  c.feuille.getRange(c.ligne, c.col.statut).setValue('Preuve envoyée');
  return { ok: true, statut: 'Preuve envoyée' };
}

/* ---------- Réception des appels du site ---------- */
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    if (p.id) return sortie_(statutCommande_(p.id));

    const cache = CacheService.getScriptCache();
    let out = cache.get('donnees');
    if (!out) {
      out = JSON.stringify({
        ok: true,
        evenements: lireEvenements_(),
        publicites: lirePublicites_(),
        stock: stockTous_()
      });
      cache.put('donnees', out, CACHE_SECONDS);
    }
    return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return sortie_({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.action === 'commande') return sortie_(enregistrerCommande_(d));
    if (d.action === 'visite') return sortie_(enregistrerVisite_(d));
    if (d.action === 'preuve_envoyee') return sortie_(preuveEnvoyee_(d.id));
    if (d.action === 'liste' || d.action === 'payer') {
      if (!cleOk_(d.key)) {
        Utilities.sleep(1000);
        return sortie_({ ok: false, error: 'Mot de passe incorrect' });
      }
      return sortie_(d.action === 'liste' ? listeCommandes_() : marquerPaye_(d.id));
    }
    return sortie_({ ok: false, error: 'Action inconnue' });
  } catch (err) {
    return sortie_({ ok: false, error: String(err) });
  }
}

function genererCode_(codesExistants) {
  const lettres = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let essai = 0; essai < 50; essai++) {
    let c = 'DTM-';
    for (let i = 0; i < 6; i++) c += lettres.charAt(Math.floor(Math.random() * lettres.length));
    if (!codesExistants[c]) return c;
  }
  throw new Error('Impossible de générer un code unique');
}

/* ---------- Événements du site : prix et nombre de places ----------
   places : nombre total de billets en vente par type (absent = illimité). */
const CATALOGUE = {
  'fally-ipupa': { nom: 'Fally Ipupa en Live', prix: { standard: 10, vip: 25, vvip: 50 }, places: { standard: 400, vip: 80, vvip: 20 } },
  'makarabianko': { nom: 'Feti na Mabré - Concert de Makarabianko', prix: { standard: 1.5, vip: 5 }, places: { standard: 500, vip: 100 } },
  'leadership-conference': { nom: 'Le Leadership au service du développement', prix: { standard: 10 }, places: {} },
  'gala-prestige': { nom: 'Gala Prestige', prix: { standard: 20 }, places: { standard: 100 } },
  'bleriot-humour': { nom: 'Blériot en spectacle', prix: { standard: 10, vip: 50 }, places: { standard: 300, vip: 50 } }
};

function trouverEvenement_(id) {
  id = String(id || '').trim();
  const s = lireEvenements_().filter(x => x.id === id)[0];
  if (s) {
    const places = {};
    if (s.placesNormal !== null) places.standard = s.placesNormal;
    if (s.placesVip !== null) { places.vip = s.placesVip; places.vvip = s.placesVip; }
    return { id: id, nom: s.artiste, statut: s.statut, prix: { standard: s.prixNormal, vip: s.prixVip, vvip: s.prixVip }, places: places };
  }
  const c = CATALOGUE[id];
  if (c) return { id: id, nom: c.nom, statut: 'Actif', prix: c.prix, places: c.places || {} };
  return null;
}

function typeBillet_(t) {
  t = String(t || '').toLowerCase();
  if (/vvip/.test(t)) return 'vvip';
  if (/vip/.test(t)) return 'vip';
  return 'standard';
}

/* Billets déjà réservés, par événement (clé : id ou nom normalisé).
   Toutes les commandes comptent, sauf celles dont le statut contient « annul ». */
function vendus_() {
  const f = ss_().getSheetByName('COMMANDES');
  const col = colonnes_(f, false);
  const out = {};
  const n = f.getLastRow() - 1;
  if (n < 1 || !col.evenement || !col.detail) return out;
  const v = f.getRange(2, 1, n, f.getLastColumn()).getValues();
  v.forEach(r => {
    if (col.statut && /annul/i.test(String(r[col.statut - 1]))) return;
    const cle = norm_(r[col.evenement - 1]);
    if (!cle) return;
    const t = out[cle] || (out[cle] = { standard: 0, vip: 0, vvip: 0 });
    listeBillets_(r[col.detail - 1]).forEach(b => { t[typeBillet_(b)]++; });
  });
  return out;
}

function restants_(ev, vendus) {
  const a = vendus[norm_(ev.id)] || {};
  const b = vendus[norm_(ev.nom)] || {};
  const out = {};
  ['standard', 'vip', 'vvip'].forEach(k => {
    if (!(Number(ev.prix[k]) > 0)) return;
    const p = ev.places[k];
    out[k] = (p === undefined || p === null) ? null : Math.max(0, p - (a[k] || 0) - (b[k] || 0));
  });
  return out;
}

function stockTous_() {
  const vendus = vendus_();
  const ids = Object.keys(CATALOGUE).concat(lireEvenements_().map(e => e.id));
  const out = {};
  ids.forEach(id => { const ev = trouverEvenement_(id); if (ev) out[id] = restants_(ev, vendus); });
  return out;
}

function enregistrerCommande_(d) {
  const nom = propre_(d.nom, 100);
  const tel = propre_(d.telephone, 30);
  const adresse = propre_(d.adresse, 200) || 'Non renseignée';
  const paiement = propre_(d.paiement, 50);
  if (!nom || !tel || !paiement) {
    return { ok: false, error: 'Nom, téléphone et mode de paiement sont obligatoires' };
  }

  const ev = trouverEvenement_(d.eventId);
  if (!ev) return { ok: false, error: 'Événement introuvable' };
  if (/sold/i.test(ev.statut)) return { ok: false, error: 'Cet événement est complet (Sold Out)' };

  let total = 0;
  const detail = [];
  const demande = { standard: 0, vip: 0, vvip: 0 };
  (d.billets || []).forEach(b => {
    const qte = Math.floor(Number(b.qte));
    if (!(qte >= 1 && qte <= 20)) return;
    const type = typeBillet_(b.type);
    const prix = Number(ev.prix[type]);
    if (!(prix > 0)) return;
    total += qte * prix;
    demande[type] += qte;
    detail.push(qte + 'x ' + (type === 'vvip' ? 'VVIP' : (type === 'vip' ? 'VIP' : 'Standard')));
  });
  if (total <= 0) return { ok: false, error: 'Aucun billet valide' };

  const verrou = LockService.getScriptLock();
  verrou.waitLock(15000);
  try {
    // Vérification des places restantes (sous verrou : deux clients ne peuvent pas prendre la dernière place)
    const reste = restants_(ev, vendus_());
    for (const k of ['standard', 'vip', 'vvip']) {
      if (!demande[k] || reste[k] === null || reste[k] === undefined) continue;
      if (demande[k] > reste[k]) {
        const label = k === 'vvip' ? 'VVIP' : (k === 'vip' ? 'VIP' : 'Standard');
        return { ok: false, error: reste[k] > 0
          ? 'Il ne reste que ' + reste[k] + ' billet' + (reste[k] > 1 ? 's' : '') + ' ' + label + ' pour cet événement.'
          : 'Plus de billets ' + label + ' disponibles pour cet événement.' };
      }
    }

    const f = ss_().getSheetByName('COMMANDES');
    const col = colonnes_(f, true);
    const n = Math.max(f.getLastRow() - 1, 1);
    const codes = {};
    f.getRange(2, col.code, n, 1).getValues().forEach(r => { if (r[0]) codes[String(r[0]).trim()] = true; });
    const code = genererCode_(codes);

    const ligne = new Array(f.getLastColumn()).fill('');
    const mettre = (k, v) => { ligne[col[k] - 1] = v; };
    mettre('date', Utilities.formatDate(new Date(), TZ, 'dd/MM/yyyy HH:mm:ss'));
    mettre('code', code);
    mettre('evenement', ev.nom);
    mettre('nom', nom);
    mettre('telephone', tel);
    mettre('email', propre_(d.email, 100));
    mettre('adresse', adresse);
    mettre('paiement', paiement);
    mettre('promo', propre_(d.promo, 20));
    mettre('detail', detail.join(', '));
    mettre('total', total);
    mettre('statut', 'En attente');
    f.appendRow(ligne);
    CacheService.getScriptCache().remove('donnees'); // places restantes à jour sur le site
    return { ok: true, code: code, total: total };
  } finally {
    verrou.releaseLock();
  }
}

function enregistrerVisite_(d) {
  ss_().getSheetByName('VISITES').appendRow([
    new Date(), propre_(d.page, 100), propre_(d.evenement, 100), propre_(d.ville, 60)
  ]);
  return { ok: true };
}

/* ---------- Administration (protégée par ADMIN_KEY) ---------- */
function cleOk_(k) {
  if (ADMIN_KEY === 'A_REMPLACER') return false; // mot de passe pas encore configuré
  return String(k || '') !== '' && String(k) === ADMIN_KEY;
}

function listeCommandes_() {
  const f = ss_().getSheetByName('COMMANDES');
  const col = colonnes_(f, true);
  const n = f.getLastRow() - 1;
  if (n < 1) return { ok: true, commandes: [] };
  const v = f.getRange(2, 1, n, f.getLastColumn()).getValues();
  const g = (r, k) => (col[k] ? r[col[k] - 1] : '');
  const fmt = x => (x instanceof Date ? Utilities.formatDate(x, TZ, 'dd/MM/yyyy HH:mm') : String(x || ''));
  const commandes = v
    .filter(r => String(g(r, 'code')).trim() !== '')
    .map(r => ({
      id: String(g(r, 'code')).trim(),
      nom: String(g(r, 'nom')),
      tel: String(g(r, 'telephone')),
      evenement: String(g(r, 'evenement')),
      total: g(r, 'total'),
      paiement: String(g(r, 'paiement')),
      statut: String(g(r, 'statut') || 'En attente'),
      date: fmt(g(r, 'date'))
    }));
  return { ok: true, commandes: commandes };
}

function marquerPaye_(code) {
  const c = trouverCommande_(code, true);
  if (!c) return { ok: false, error: 'Commande non trouvée' };
  c.feuille.getRange(c.ligne, c.col.statut).setValue('Payé');
  return { ok: true, statut: 'Payé' };
}
