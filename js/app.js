const SESSION_KEY = "barangayCareSession";
const RESIDENTS_KEY = "residents";
const APPOINTMENTS_KEY = "appointments";
const EMERGENCIES_KEY = "emergencies";
const THEME_KEY = "barangayCareDarkMode";
const API_URL = "api";

// Data now lives in the SQLite database. "cache" holds what the server sent us for this user.
const cache = {};
let syncQueue = Promise.resolve();
async function api(action, body) {
  const res = await fetch(`${API_URL}?action=${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => ({ error: "The server did not answer correctly. Is the BarangayCare server running (start.bat)?" }));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}
function readData(key) { return JSON.parse(JSON.stringify(cache[key] || [])); }
function saveData(key, data) {
  cache[key] = data;
  syncQueue = syncQueue.then(() => api("save", { key, rows: data })).then(res => { cache[key] = res.rows; })
    .catch(err => { alert("Could not save to the database: " + err.message); });
  return syncQueue;
}
function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } }
function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[char])); }
function displayDate(value) { if (!value) return "—"; const date = new Date(value + "T00:00:00"); return Number.isNaN(date.getTime()) ? escapeHTML(value) : date.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" }); }
function todayString() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function badge(status) { const safe = escapeHTML(status); const cls = String(status).toLowerCase().replace(/\s+/g,"-"); return `<span class="status-pill status-${cls}">${safe}</span>`; }
function notice(element, message, error=false) { if(!element)return; element.textContent=message; element.classList.toggle("error",error); }
function commonSidebar() {
  const session = getSession();
  const admin = session?.role === "admin";
  const el = document.getElementById("sharedSidebar");
  if (!el) return;
  const home = admin ? "admin.html" : "resident.html";
  const links = admin
    ? [["▦","Overview","admin.html"],["♧","Resident profiles","residents.html"],["▣","Appointments & queue","appointments.html"],["＋","Emergency response","emergencies.html"]]
    : [["▦","My dashboard","resident.html"],["♧","My profile","profile.html"],["▣","Appointments & queue","appointments.html"],["＋","Emergency reports","emergencies.html"]];
  const current = location.pathname.split("/").pop() || "index.html";
  el.innerHTML = `<a class="brand" href="${home}"><span class="brand-icon">✚</span><span>Barangay<span class="brand-light">Care</span><small>${admin?"ADMIN CONSOLE":"RESIDENT PORTAL"}</small></span></a><div class="side-label">${admin?"WORKSPACE":"MY SERVICES"}</div>${links.map(([icon,label,url])=>`<a class="side-link ${current===url?"active":""}" href="${url}">${icon} <span>${label}</span></a>`).join("")}<div class="side-label">SYSTEM</div><a class="side-link ${current==="settings.html"?"active":""}" href="settings.html">⚙ <span>Settings</span></a><div class="sidebar-bottom"><div class="mini-user"><div class="user-avatar">${escapeHTML((session?.fullName||"U").charAt(0).toUpperCase())}</div><div><strong>${escapeHTML(session?.fullName||"User")}</strong><small>${admin?"Administrator":"Resident account"}</small></div></div><button class="side-link logout-btn" data-logout>↪ <span>Sign out</span></button></div>`;
}
function setupTopbarActions() {
  const s=getSession(); const host=document.querySelector('.topbar-right'); if(!host || host.querySelector('.bc-account-actions')) return;
  host.querySelector('.top-user')?.remove(); const box=document.createElement('div'); box.className='bc-account-actions';
  box.innerHTML=`${s?.role==='resident'?`<div class="bc-notify-wrap"><button class="bc-icon-btn" id="bcBell" aria-label="Notifications" title="Notifications">♧<span id="bcUnread" class="bc-unread hidden">0</span></button><div id="bcNotifications" class="bc-popover hidden"><div class="bc-pop-head"><strong>Notifications</strong><button id="bcMarkRead" type="button">Mark all read</button></div><div id="bcNotificationList" class="bc-notification-list"><p class="muted">No notifications yet.</p></div></div></div>`:''}<div class="bc-profile-wrap"><button class="bc-profile-btn" id="bcProfileToggle"><span class="user-avatar" data-initial>${escapeHTML((s?.fullName||'U').charAt(0).toUpperCase())}</span><span>${escapeHTML(s?.fullName||'Account')}</span><span>▾</span></button><div id="bcProfileMenu" class="bc-profile-menu hidden"><a href="profile.html">My Profile</a><button type="button" data-logout>Sign Out</button></div></div>`;
  host.appendChild(box);
  document.getElementById('bcBell')?.addEventListener('click',()=>{document.getElementById('bcNotifications').classList.toggle('hidden');document.getElementById('bcProfileMenu')?.classList.add('hidden');});
  document.getElementById('bcProfileToggle')?.addEventListener('click',()=>{document.getElementById('bcProfileMenu').classList.toggle('hidden');document.getElementById('bcNotifications')?.classList.add('hidden');});
  document.getElementById('bcMarkRead')?.addEventListener('click',async()=>{try{await api('read-notifications');await refreshNotifications();}catch(e){console.error(e);}});
  document.addEventListener('click',e=>{if(!e.target.closest('.bc-account-actions')){document.getElementById('bcProfileMenu')?.classList.add('hidden');document.getElementById('bcNotifications')?.classList.add('hidden');}});
}
let lastTurnNotification=0; let notificationFirstLoad=true; let bcAudioContext=null;
document.addEventListener('click',()=>{try{const C=window.AudioContext||window.webkitAudioContext;if(C&&!bcAudioContext)bcAudioContext=new C();if(bcAudioContext?.state==='suspended')bcAudioContext.resume();}catch(e){}},{once:true});
function playTurnSound() {
    try {
        const C = window.AudioContext || window.webkitAudioContext;
        if (!C) return;

        const c = bcAudioContext || (bcAudioContext = new C());

        if (c.state === "suspended") {
            c.resume();
        }

        const notes = [
            { frequency: 880, delay: 0 },
            { frequency: 1174.66, delay: 0.14 }
        ];

        notes.forEach(note => {
            const oscillator = c.createOscillator();
            const gain = c.createGain();

            oscillator.type = "sine";
            oscillator.frequency.value = note.frequency;

            oscillator.connect(gain);
            gain.connect(c.destination);

            const start = c.currentTime + note.delay;

            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.15, start + 0.03);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.30);

            oscillator.start(start);
            oscillator.stop(start + 0.32);
        });

    } catch (error) {
        console.error("Notification sound error:", error);
    }
}
async function refreshNotifications(){if(getSession()?.role!=='resident')return;try{const out=await api('notifications');const items=out.notifications||[],unread=items.filter(n=>!n.read);const count=document.getElementById('bcUnread');if(count){count.textContent=unread.length;count.classList.toggle('hidden',!unread.length);}const list=document.getElementById('bcNotificationList');if(list)list.innerHTML=items.length?items.map(n=>`<article class="bc-notification ${n.read?'':'unread'}"><strong>${escapeHTML(n.title)}</strong><p>${escapeHTML(n.message)}</p><small>${escapeHTML(n.createdAt||'')}</small></article>`).join(''):'<p class="muted">No notifications yet.</p>';if(notificationFirstLoad){lastTurnNotification=Math.max(0,...items.map(n=>n.id));notificationFirstLoad=false;}else{const turn=items.find(n=>n.kind==='turn'&&n.id>lastTurnNotification);if(turn){lastTurnNotification=turn.id;playTurnSound();if('vibrate'in navigator)navigator.vibrate([250,120,250]);}}}catch(e){console.error('Notification refresh failed',e);}}
function applyUserInfo() {
  const s = getSession(); if (!s) return;
  const name = s.fullName || s.username;
  ["sideUserName","topUserName","welcomeName"].forEach(id => { const el=document.getElementById(id); if(el)el.textContent=name; });
  ["sideInitial","topInitial","profileInitial"].forEach(id => { const el=document.getElementById(id); if(el)el.textContent=name.charAt(0).toUpperCase(); });
  document.querySelectorAll("[data-user-name]").forEach(el=>el.textContent=name);
  document.querySelectorAll("[data-initial]").forEach(el=>el.textContent=name.charAt(0).toUpperCase());
  document.querySelectorAll("[data-today]").forEach(el=>el.textContent=new Date().toLocaleDateString(undefined,{weekday:"short",month:"short",day:"numeric",year:"numeric"}));
}
function initSessionGuard() {
  const s = getSession(); const required = document.body.dataset.requiredRole;
  if (!s) { window.location.href="login.html"; return false; }
  if (required==="admin" && s.role!=="admin") { window.location.href="resident.html"; return false; }
  if (required==="resident" && s.role!=="resident") { window.location.href="admin.html"; return false; }
  if (required==="any" && !["admin","resident"].includes(s.role)) { window.location.href="login.html"; return false; }
  return true;
}
function renderDashboard() {
  const s=getSession(), residents=readData(RESIDENTS_KEY), appointments=readData(APPOINTMENTS_KEY), emergencies=readData(EMERGENCIES_KEY);
  const isAdmin=s.role==="admin";
  const myAppointments=appointments.filter(a=>a.username===s.username);
  const myEmergencies=emergencies.filter(e=>e.username===s.username);
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  if(isAdmin){
    set("residentCount",residents.length);set("appointmentCount",appointments.length);
    set("queueCount",appointments.filter(a=>["Pending","Approved"].includes(a.status)).length);set("emergencyCount",emergencies.length);
    const tbody=document.getElementById("recentAppointments");
    if(tbody)tbody.innerHTML=appointments.slice().sort((a,b)=>b.id-a.id).slice(0,5).map(a=>`<tr><td><span class="table-name">${escapeHTML(a.resident)}</span><span class="table-sub">Queue #${a.queue}</span></td><td>${escapeHTML(a.service)}</td><td>${displayDate(a.date)}</td><td>${badge(a.status)}</td></tr>`).join("")||'<tr><td colspan="4">No appointments recorded.</td></tr>';
  } else {
    set("myAppointmentCount",myAppointments.length);set("myUpcomingCount",myAppointments.filter(a=>["Pending","Approved"].includes(a.status)).length);set("myEmergencyCount",myEmergencies.length);
    const tbody=document.getElementById("myRecentAppointments");
    if(tbody)tbody.innerHTML=myAppointments.slice().sort((a,b)=>b.id-a.id).slice(0,5).map(a=>`<tr><td>${escapeHTML(a.service)}</td><td>${displayDate(a.date)}</td><td>#${a.queue}</td><td>${badge(a.status)}</td></tr>`).join("")||'<tr><td colspan="4">No appointments yet. Request one to get started.</td></tr>';
  }
}
function renderResidents(filter="") {
  const tbody=document.getElementById("residentTable");if(!tbody)return;
  const list=readData(RESIDENTS_KEY).filter(r=>`${r.name} ${r.address} ${r.contact}`.toLowerCase().includes(filter.toLowerCase()));
  const count=document.getElementById("residentTableCount");if(count)count.textContent=`${list.length} record${list.length===1?"":"s"}`;
  tbody.innerHTML=list.map(r=>`<tr><td><span class="table-name">${escapeHTML(r.name)}</span><span class="table-sub">${r.username?"Has account: @"+escapeHTML(r.username):"Added by admin"}</span></td><td>${escapeHTML(r.age||"—")}</td><td>${escapeHTML(r.contact||"—")}</td><td>${escapeHTML(r.address||"—")}</td><td><button class="btn btn-soft btn-small" data-edit-resident="${r.id}">Edit</button> <button class="btn btn-soft btn-small" data-delete-resident="${r.id}">Remove</button></td></tr>`).join("")||'<tr><td colspan="5">No resident records found.</td></tr>';
}
function renderAppointments(filter="") {
  const tbody=document.getElementById("appointmentTable");if(!tbody)return;
  const session=getSession();
  if(session?.role==='admin'&&!document.getElementById('bcCallNext')){const intro=document.querySelector('.page-intro');if(intro){const b=document.createElement('button');b.id='bcCallNext';b.className='btn btn-primary';b.type='button';b.textContent='Call Next Resident';const feedback=document.createElement('p');feedback.id='bcCallFeedback';feedback.className='form-message';intro.appendChild(b);intro.appendChild(feedback);b.addEventListener('click',async()=>{b.disabled=true;try{const r=await api('call-next');const feedback=document.getElementById('bcCallFeedback');if(feedback)feedback.textContent=`Now calling ${r.resident} — ticket #${r.queue} (${r.service}).`;await reloadData();}catch(e){alert(e.message);}finally{b.disabled=false;}});}}
  const s=getSession(), admin=s.role==="admin";
  const list=readData(APPOINTMENTS_KEY).filter(a=>(admin||a.username===s.username)&&`${a.resident} ${a.service} ${a.date} ${a.status}`.toLowerCase().includes(filter.toLowerCase())).sort((a,b)=>a.queue-b.queue);
  const actionHead=document.getElementById("appointmentActionHeader");if(actionHead)actionHead.textContent=admin?"Update status":"Action";
  tbody.innerHTML=list.map(a=>`<tr><td><span class="table-name">#${a.queue}</span></td><td>${escapeHTML(a.resident)}</td><td>${escapeHTML(a.service)}</td><td>${displayDate(a.date)}</td><td>${badge(a.status)}</td><td>${admin?`<select class="status-select" data-appointment-status="${a.id}" aria-label="Update appointment status"><option ${a.status==="Pending"?"selected":""}>Pending</option><option ${a.status==="Approved"?"selected":""}>Approved</option><option ${a.status==="Completed"?"selected":""}>Completed</option><option ${a.status==="Rejected"?"selected":""}>Rejected</option><option ${a.status==="Cancelled"?"selected":""}>Cancelled</option></select> <button class="btn btn-soft btn-small" data-delete-appointment="${a.id}">Delete</button>`:(a.status==="Pending"?`<button class="btn btn-soft btn-small" data-edit-appointment="${a.id}">Edit</button> <button class="btn btn-soft btn-small" data-cancel-appointment="${a.id}">Cancel</button>`:(a.status==="Approved"?`<button class="btn btn-soft btn-small" data-cancel-appointment="${a.id}">Cancel</button>`:`<span class="muted">—</span>`))}</td></tr>`).join("")||`<tr><td colspan="6">No appointment requests found.</td></tr>`;
  const panel=document.getElementById("appointmentRequestPanel");if(panel)panel.classList.toggle("hidden",admin);
  const title=document.getElementById("appointmentPageTitle");if(title)title.textContent=admin?"Appointment management":"Appointments & queue";
  const desc=document.getElementById("appointmentPageDesc");if(desc)desc.textContent=admin?"Review appointment requests and organize the health-center queue.":"Request a visit and check the status of your appointments.";
  const tableTitle=document.getElementById("appointmentTableTitle");if(tableTitle)tableTitle.textContent=admin?"All appointment requests":"My appointment requests";
}
function renderEmergencies(filter="") {
  const tbody=document.getElementById("emergencyTable");if(!tbody)return;
  const s=getSession(),admin=s.role==="admin";
  const list=readData(EMERGENCIES_KEY).filter(e=>(admin||e.username===s.username)&&`${e.reporter} ${e.type} ${e.location} ${e.priority} ${e.status}`.toLowerCase().includes(filter.toLowerCase())).sort((a,b)=>b.id-a.id);
  tbody.innerHTML=list.map(e=>`<tr><td><span class="table-name">${escapeHTML(e.reporter)}</span><span class="table-sub">${new Date(e.date).toLocaleDateString()}</span></td><td>${escapeHTML(e.type)}<span class="table-sub">${escapeHTML(e.details)}</span></td><td>${escapeHTML(e.location)}</td><td>${badge(e.priority)}</td><td>${badge(e.status)}</td><td>${admin?`<select class="status-select" data-emergency-status="${e.id}" aria-label="Update incident status"><option ${e.status==="Recorded"?"selected":""}>Recorded</option><option ${e.status==="In progress"?"selected":""}>In progress</option><option ${e.status==="Resolved"?"selected":""}>Resolved</option></select> <button class="btn btn-soft btn-small" data-delete-emergency="${e.id}">Delete</button>`:"—"}</td></tr>`).join("")||'<tr><td colspan="6">No emergency reports found.</td></tr>';
}
function resetResidentForm() {
  const f=document.getElementById("residentForm");if(!f)return;
  f.reset();f.elements["id"].value="";
  const t=document.getElementById("residentFormTitle");if(t)t.textContent="Add resident profile";
  const b=document.getElementById("residentSubmit");if(b)b.textContent="Save resident";
}
function resetAppointmentForm() {
  const f=document.getElementById("appointmentForm");if(!f)return;
  const s=getSession(),resident=document.getElementById("appointmentResident");
  f.reset();f.elements["id"].value="";
  if(resident&&s.role==="resident")resident.value=s.fullName||s.username;
  const t=document.getElementById("appointmentFormTitle");if(t)t.textContent="Request a health-center appointment";
  const b=document.getElementById("appointmentSubmit");if(b)b.textContent="Submit request";
  const c=document.getElementById("appointmentCancelEdit");if(c)c.classList.add("hidden");
}
function initForms() {
  const residentForm=document.getElementById("residentForm");
  if(residentForm)residentForm.addEventListener("submit",e=>{e.preventDefault();const data=new FormData(residentForm),rows=readData(RESIDENTS_KEY),editId=data.get("id");
    const values={name:data.get("name").trim(),age:data.get("age"),contact:data.get("contact").trim(),address:data.get("address").trim()};
    if(editId){const item=rows.find(r=>String(r.id)===editId);if(item){Object.assign(item,values);
      }
      saveData(RESIDENTS_KEY,rows);resetResidentForm();notice(document.getElementById("residentMessage"),"Resident profile updated.");}
    else{rows.push({id:Date.now(),...values});saveData(RESIDENTS_KEY,rows);resetResidentForm();notice(document.getElementById("residentMessage"),"Resident profile added.");}
    renderResidents(document.getElementById("residentSearch")?.value||"");renderDashboard();});
  const open=document.getElementById("openResidentForm"),close=document.getElementById("closeResidentForm"),box=document.getElementById("residentFormPanel");
  if(open&&box)open.addEventListener("click",()=>{resetResidentForm();box.classList.remove("hidden");});if(close&&box)close.addEventListener("click",()=>{resetResidentForm();box.classList.add("hidden");});
  const appointmentForm=document.getElementById("appointmentForm");
  if(appointmentForm){
    const date=document.getElementById("appointmentDate");if(date)date.min=todayString();
    const resident=document.getElementById("appointmentResident"),s=getSession();
    if(resident&&s.role==="resident")resident.value=s.fullName||s.username;
    const cancelEdit=document.getElementById("appointmentCancelEdit");if(cancelEdit)cancelEdit.addEventListener("click",()=>{resetAppointmentForm();if(date)date.min=todayString();notice(document.getElementById("appointmentMessage"),"");});
    appointmentForm.addEventListener("submit",async e=>{e.preventDefault();const data=new FormData(appointmentForm),dateValue=data.get("date"),msg=document.getElementById("appointmentMessage"),editId=data.get("id");
      if(dateValue<todayString()&&!editId)return notice(msg,"Please choose today or a future date.",true);
      const rows=readData(APPOINTMENTS_KEY);
      if(editId){const item=rows.find(a=>String(a.id)===editId&&a.username===s.username);
        if(!item||item.status!=="Pending")return notice(msg,"Only your pending requests can be changed.",true);
        if(dateValue<todayString()&&dateValue!==item.date)return notice(msg,"Please choose today or a future date.",true);
        item.service=data.get("service");item.date=dateValue;item.notes=data.get("notes").trim();saveData(APPOINTMENTS_KEY,rows);
        resetAppointmentForm();if(date)date.min=todayString();notice(msg,"Appointment request updated.");
      } else {
        const newId=Date.now();rows.push({id:newId,queue:0,username:s.username,resident:data.get("resident").trim(),service:data.get("service"),date:dateValue,status:"Pending",notes:data.get("notes").trim()});await saveData(APPOINTMENTS_KEY,rows);const created=readData(APPOINTMENTS_KEY).find(a=>a.id===newId);
        resetAppointmentForm();if(date)date.min=todayString();notice(msg,created?"Appointment request submitted. Your ticket number will be assigned after approval.":"Appointment request submitted.");
      }
      renderAppointments(document.getElementById("appointmentSearch")?.value||"");renderDashboard();});
  }
  const emergencyForm=document.getElementById("emergencyForm");
  if(emergencyForm){const reporter=document.getElementById("emergencyReporter"),s=getSession();if(reporter&&s.role==="resident")reporter.value=s.fullName||s.username;
    emergencyForm.addEventListener("submit",e=>{e.preventDefault();const data=new FormData(emergencyForm),rows=readData(EMERGENCIES_KEY);rows.push({id:Date.now(),username:s.username,reporter:data.get("reporter").trim(),type:data.get("type"),location:data.get("location").trim(),priority:data.get("priority"),details:data.get("details").trim(),status:"Recorded",date:new Date().toISOString()});saveData(EMERGENCIES_KEY,rows);emergencyForm.reset();if(reporter&&s.role==="resident")reporter.value=s.fullName||s.username;notice(document.getElementById("emergencyMessage"),"Incident recorded successfully.");renderEmergencies(document.getElementById("emergencySearch")?.value||"");renderDashboard();});
  }
  const profileForm=document.getElementById("profileForm");
  if(profileForm){const s=getSession();
    const r=readData(RESIDENTS_KEY).find(x=>x.username===s.username)||{};
    document.getElementById("profileName").textContent=s.fullName;document.getElementById("profileUsername").textContent="@"+s.username;document.getElementById("profileFullName").value=s.fullName;document.getElementById("profileUsernameInput").value=s.username;
    document.getElementById("profileAge").value=r.age||"";document.getElementById("profileContact").value=r.contact||"";document.getElementById("profileAddress").value=r.address||"";
    profileForm.addEventListener("submit",e=>{e.preventDefault();const name=document.getElementById("profileFullName").value.trim();if(!name)return;
      const session=getSession();session.fullName=name;localStorage.setItem(SESSION_KEY,JSON.stringify(session));
      const rows=readData(RESIDENTS_KEY);let rec=rows.find(x=>x.username===session.username);if(!rec){rec={id:Date.now(),username:session.username};rows.push(rec);}
      rec.name=name;rec.age=document.getElementById("profileAge").value;rec.contact=document.getElementById("profileContact").value.trim();rec.address=document.getElementById("profileAddress").value.trim();saveData(RESIDENTS_KEY,rows);
      applyUserInfo();document.getElementById("profileName").textContent=name;notice(document.getElementById("profileMessage"),"Profile updated.");});
  }
}
function initSearches(){
  const bindings=[["residentSearch",renderResidents],["appointmentSearch",renderAppointments],["emergencySearch",renderEmergencies]];
  bindings.forEach(([id,fn])=>{const el=document.getElementById(id);if(el)el.addEventListener("input",()=>fn(el.value));});
}
function initActions(){
  document.addEventListener("click",e=>{const logout=e.target.closest("[data-logout]");if(logout){api("logout").catch(()=>{}).finally(()=>{localStorage.removeItem(SESSION_KEY);window.location.href="index.html";});return;}
    const editRes=e.target.closest("[data-edit-resident]");if(editRes){const r=readData(RESIDENTS_KEY).find(x=>String(x.id)===editRes.dataset.editResident),f=document.getElementById("residentForm");
      if(r&&f){f.elements["id"].value=r.id;f.elements["name"].value=r.name||"";f.elements["age"].value=r.age||"";f.elements["contact"].value=r.contact||"";f.elements["address"].value=r.address||"";
        document.getElementById("residentFormTitle").textContent="Edit resident profile";document.getElementById("residentSubmit").textContent="Save changes";notice(document.getElementById("residentMessage"),"");
        const box=document.getElementById("residentFormPanel");box.classList.remove("hidden");box.scrollIntoView({behavior:"smooth"});}return;}
    const editAp=e.target.closest("[data-edit-appointment]");if(editAp){const s=getSession(),a=readData(APPOINTMENTS_KEY).find(x=>String(x.id)===editAp.dataset.editAppointment&&x.username===s.username),f=document.getElementById("appointmentForm");
      if(a&&f){f.elements["id"].value=a.id;f.elements["resident"].value=a.resident;f.elements["service"].value=a.service;f.elements["date"].value=a.date;f.elements["notes"].value=a.notes||"";
        const d=document.getElementById("appointmentDate");if(d)d.min=a.date<todayString()?a.date:todayString();
        document.getElementById("appointmentFormTitle").textContent="Edit your appointment request";document.getElementById("appointmentSubmit").textContent="Save changes";document.getElementById("appointmentCancelEdit").classList.remove("hidden");notice(document.getElementById("appointmentMessage"),"");
        document.getElementById("appointmentRequestPanel").scrollIntoView({behavior:"smooth"});}return;}
    const cancelAp=e.target.closest("[data-cancel-appointment]");if(cancelAp){if(!confirm("Cancel this appointment request?"))return;const s=getSession(),rows=readData(APPOINTMENTS_KEY),item=rows.find(x=>String(x.id)===cancelAp.dataset.cancelAppointment&&x.username===s.username);
      if(item&&["Pending","Approved"].includes(item.status)){item.status="Cancelled";saveData(APPOINTMENTS_KEY,rows);renderAppointments(document.getElementById("appointmentSearch")?.value||"");renderDashboard();}return;}
    const delAp=e.target.closest("[data-delete-appointment]");if(delAp){if(getSession()?.role==="admin"&&confirm("Delete this appointment record? This cannot be undone.")){saveData(APPOINTMENTS_KEY,readData(APPOINTMENTS_KEY).filter(x=>String(x.id)!==delAp.dataset.deleteAppointment));renderAppointments(document.getElementById("appointmentSearch")?.value||"");renderDashboard();}return;}
    const delEm=e.target.closest("[data-delete-emergency]");if(delEm){if(getSession()?.role==="admin"&&confirm("Delete this emergency report? This cannot be undone.")){saveData(EMERGENCIES_KEY,readData(EMERGENCIES_KEY).filter(x=>String(x.id)!==delEm.dataset.deleteEmergency));renderEmergencies(document.getElementById("emergencySearch")?.value||"");renderDashboard();}return;}
    const remove=e.target.closest("[data-delete-resident]");if(remove&&confirm("Remove this resident profile?")){saveData(RESIDENTS_KEY,readData(RESIDENTS_KEY).filter(r=>String(r.id)!==remove.dataset.deleteResident));renderResidents(document.getElementById("residentSearch")?.value||"");renderDashboard();}
  });
  document.addEventListener("change",e=>{const appointment=e.target.closest("[data-appointment-status]");if(appointment){const rows=readData(APPOINTMENTS_KEY),item=rows.find(a=>String(a.id)===appointment.dataset.appointmentStatus);if(item){item.status=appointment.value;saveData(APPOINTMENTS_KEY,rows);renderAppointments(document.getElementById("appointmentSearch")?.value||"");renderDashboard();}}
    const emergency=e.target.closest("[data-emergency-status]");if(emergency){const rows=readData(EMERGENCIES_KEY),item=rows.find(a=>String(a.id)===emergency.dataset.emergencyStatus);if(item){item.status=emergency.value;saveData(EMERGENCIES_KEY,rows);renderEmergencies(document.getElementById("emergencySearch")?.value||"");renderDashboard();}}
  });
}
async function reloadData(){const all=await api('load');Object.assign(cache,all.data);renderDashboard();renderAppointments(document.getElementById('appointmentSearch')?.value||'');}
function initSettings(){
  const toggle=document.getElementById("darkModeToggle");const apply=()=>document.body.classList.toggle("dark-mode",localStorage.getItem(THEME_KEY)==="true");apply();
  if(toggle){toggle.checked=localStorage.getItem(THEME_KEY)==="true";toggle.addEventListener("change",()=>{localStorage.setItem(THEME_KEY,String(toggle.checked));apply();});}
  const s=getSession(),account=document.getElementById("settingsAccount");if(account&&s)account.textContent=`Signed in as ${s.fullName} (@${s.username}) · ${s.role==="admin"?"Administrator":"Resident"}`;
  const link=document.getElementById("settingsProfileLink");if(link&&s?.role==="admin")link.style.display="none";
}
document.addEventListener("DOMContentLoaded",async()=>{
  if(!document.body.classList.contains("app-page"))return;
  try {
    const me=await api("me");
    localStorage.setItem(SESSION_KEY,JSON.stringify(me.user));
    if(!initSessionGuard())return;
    const all=await api("load");Object.assign(cache,all.data);
  } catch(err) {
    localStorage.removeItem(SESSION_KEY);
    if(/Not signed in/.test(err.message)){window.location.href="login.html";}
    else{document.body.insertAdjacentHTML("afterbegin",`<div style="padding:14px;background:#ffe8e5;color:#c64c43;font:600 13px sans-serif">${escapeHTML(err.message)} Open this site at http://localhost:3000, not by double-clicking the file.</div>`);}
    return;
  }
  commonSidebar();setupTopbarActions();applyUserInfo();initForms();initSearches();initActions();initSettings();renderDashboard();renderResidents();renderAppointments();renderEmergencies();await refreshNotifications();
  if(getSession()?.role==='resident')setInterval(async()=>{await reloadData();await refreshNotifications();},5000);
  if(getSession()?.role==='admin')setInterval(reloadData,7000);
});
