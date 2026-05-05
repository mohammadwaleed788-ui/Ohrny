// Anonymization helpers — hash names/emails/IDs into stable pseudonyms
// Real PII stays server-side; admin UI shows only pseudonyms + initials.

function fnvHash(str){
  let h = 0x811c9dc5;
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// Stable pseudonym like "Magenta Falcon 4c21"
const ADJ = ["Amber","Azure","Violet","Coral","Sable","Cobalt","Ivory","Jade","Crimson","Teal","Ochre","Indigo","Mauve","Saffron","Olive","Scarlet","Cerise","Slate","Bronze","Clover"];
const NOUN = ["Falcon","Fox","Lynx","Otter","Heron","Raven","Panther","Hare","Wolf","Stag","Lark","Moth","Eagle","Crane","Finch","Bison","Orca","Puma","Sable","Ibis"];

function pseudonym(id){
  const h = fnvHash(id || "x");
  return `${ADJ[h%ADJ.length]} ${NOUN[(h>>8)%NOUN.length]} ${(h&0xffff).toString(16).padStart(4,"0")}`;
}
function pseudoHandle(id){
  const h = fnvHash(id || "x");
  return "@u_" + (h&0xfffff).toString(16).padStart(5,"0");
}
function maskEmail(){
  return "•••••••@•••••.•••";
}
function maskIP(){
  return "•••.•••.•••.•••";
}
function maskId(id){
  if(!id) return "u_••••";
  return id.slice(0,4) + "…" + id.slice(-3);
}

// Global anonymity state
const ANON_DEFAULT = (()=>{
  try { return localStorage.getItem("ohrny.anon") !== "off"; } catch(e){ return true; }
})();

Object.assign(window, { pseudonym, pseudoHandle, maskEmail, maskIP, maskId, fnvHash, ANON_DEFAULT });
