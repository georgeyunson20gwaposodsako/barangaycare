const SESSION_KEY = "barangayCareSession";
const ACCOUNT_KEY = "barangayCareAccounts";
const RESIDENTS_KEY = "barangayCareResidents";
const APPOINTMENTS_KEY = "barangayCareAppointments";
const EMERGENCIES_KEY = "barangayCareEmergencies";
const THEME_KEY = "barangayCareDarkMode";

function readData(key) { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } }
function saveData(key, data) { localStorage.setItem(key, JSON.stringify(data)); }
function getSession() { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch { return null; } }
function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" }[char])); }
function displayDate(value) { if (!value) return "—"; const date = new Date(value + "T00:00:00"); return Number.isNaN(date.getTime()) ? escapeHTML(value) : date.toLocaleDateString(undefined, { month:"short", day:"numeric", year:"numeric" }); }
function todayString() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function badge(status) { const safe = escapeHTML(status); const cls = String(status).toLowerCase().replace(/\s+/g,"-"); return `<span class="status-pill status-${cls}">${safe}</span>`; }
function notice(element, message, error=false) { if(!element)return; element.textContent=message; element.classList.toggle("error",error); }
function ensureSeedData() {
  if (!localStorage.getItem(RESIDENTS_KEY)) saveData(RESIDENTS_KEY, [
    {id:1,name:"Alex Santos",age:28,contact:"09XX-XXX-1001",address:"Purok 1"},
    {id:2,name:"Jamie Reyes",age:35,contact:"09XX-XXX-1002",address:"Purok 2"},
    {id:3,name:"Taylor Cruz",age:22,contact:"09XX-XXX-1003",address:"Purok 3"}
  ]);
  if (!localStorage.getItem(APPOINTMENTS_KEY)) saveData(APPOINTMENTS_KEY, [
    {id:1,queue:1,username:"resident",resident:"Demo Resident",service:"General consultation",date:todayString(),status:"Approved",notes:""},
    {id:2,queue:2,username:"resident",resident:"Demo Resident",service:"Health monitoring",date:todayString(),status:"Pending",notes:""}
  ]);
  if (!localStorage.getItem(EMERGENCIES_KEY)) saveData(EMERGENCIES_KEY, [
    {id:1,username:"admin",reporter:"Sample Reporter",type:"Accident or injury",location:"Purok 2",priority:"Normal",details:"Sample record for demonstration.",status:"Recorded",date:new Date().toISOString()}
  ]);
}
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
  tbody.innerHTML=list.map(r=>`<tr><td><span class="table-name">${escapeHTML(r.name)}</span><span class="table-sub">Resident ID: ${r.id}</span></td><td>${escapeHTML(r.age)}</td><td>${escapeHTML(r.contact||"—")}</td><td>${escapeHTML(r.address)}</td><td><button class="btn btn-soft btn-small" data-delete-resident="${r.id}">Remove</button></td></tr>`).join("")||'<tr><td colspan="5">No resident records found.</td></tr>';
}
function renderAppointments(filter="") {
  const tbody=document.getElementById("appointmentTable");if(!tbody)return;
  const s=getSession(), admin=s.role==="admin";
  const list=readData(APPOINTMENTS_KEY).filter(a=>(admin||a.username===s.username)&&`${a.resident} ${a.service} ${a.date} ${a.status}`.toLowerCase().includes(filter.toLowerCase())).sort((a,b)=>a.queue-b.queue);
  const actionHead=document.getElementById("appointmentActionHeader");if(actionHead)actionHead.textContent=admin?"Update status":"Action";
  tbody.innerHTML=list.map(a=>`<tr><td><span class="table-name">#${a.queue}</span></td><td>${escapeHTML(a.resident)}</td><td>${escapeHTML(a.service)}</td><td>${displayDate(a.date)}</td><td>${badge(a.status)}</td><td>${admin?`<select class="status-select" data-appointment-status="${a.id}" aria-label="Update appointment status"><option ${a.status==="Pending"?"selected":""}>Pending</option><option ${a.status==="Approved"?"selected":""}>Approved</option><option ${a.status==="Completed"?"selected":""}>Completed</option><option ${a.status==="Rejected"?"selected":""}>Rejected</option></select>`:`<span class="muted">—</span>`}</td></tr>`).join("")||`<tr><td colspan="6">No appointment requests found.</td></tr>`;
  const panel=document.getElementById("appointmentRequestPanel");if(panel)panel.classList.toggle("hidden",admin);
  const title=document.getElementById("appointmentPageTitle");if(title)title.textContent=admin?"Appointment management":"Appointments & queue";
  const desc=document.getElementById("appointmentPageDesc");if(desc)desc.textContent=admin?"Review appointment requests and organize the health-center queue.":"Request a visit and check the status of your appointments.";
  const tableTitle=document.getElementById("appointmentTableTitle");if(tableTitle)tableTitle.textContent=admin?"All appointment requests":"My appointment requests";
}
function renderEmergencies(filter="") {
  const tbody=document.getElementById("emergencyTable");if(!tbody)return;
  const s=getSession(),admin=s.role==="admin";
  const list=readData(EMERGENCIES_KEY).filter(e=>(admin||e.username===s.username)&&`${e.reporter} ${e.type} ${e.location} ${e.priority} ${e.status}`.toLowerCase().includes(filter.toLowerCase())).sort((a,b)=>b.id-a.id);
  tbody.innerHTML=list.map(e=>`<tr><td><span class="table-name">${escapeHTML(e.reporter)}</span><span class="table-sub">${new Date(e.date).toLocaleDateString()}</span></td><td>${escapeHTML(e.type)}<span class="table-sub">${escapeHTML(e.details)}</span></td><td>${escapeHTML(e.location)}</td><td>${badge(e.priority)}</td><td>${badge(e.status)}</td><td>${admin?`<select class="status-select" data-emergency-status="${e.id}" aria-label="Update incident status"><option ${e.status==="Recorded"?"selected":""}>Recorded</option><option ${e.status==="In progress"?"selected":""}>In progress</option><option ${e.status==="Resolved"?"selected":""}>Resolved</option></select>`:"—"}</td></tr>`).join("")||'<tr><td colspan="6">No emergency reports found.</td></tr>';
}
function initForms() {
  const residentForm=document.getElementById("residentForm");
  if(residentForm)residentForm.addEventListener("submit",e=>{e.preventDefault();const data=new FormData(residentForm),rows=readData(RESIDENTS_KEY);rows.push({id:Date.now(),name:data.get("name").trim(),age:data.get("age"),contact:data.get("contact").trim(),address:data.get("address").trim()});saveData(RESIDENTS_KEY,rows);residentForm.reset();notice(document.getElementById("residentMessage"),"Resident profile added.");renderResidents(document.getElementById("residentSearch")?.value||"");renderDashboard();});
  const open=document.getElementById("openResidentForm"),close=document.getElementById("closeResidentForm"),box=document.getElementById("residentFormPanel");
  if(open&&box)open.addEventListener("click",()=>box.classList.toggle("hidden"));if(close&&box)close.addEventListener("click",()=>box.classList.add("hidden"));
  const appointmentForm=document.getElementById("appointmentForm");
  if(appointmentForm){
    const date=document.getElementById("appointmentDate");if(date)date.min=todayString();
    const resident=document.getElementById("appointmentResident"),s=getSession();
    if(resident&&s.role==="resident")resident.value=s.fullName||s.username;
    appointmentForm.addEventListener("submit",e=>{e.preventDefault();const data=new FormData(appointmentForm),dateValue=data.get("date");if(dateValue<todayString())return notice(document.getElementById("appointmentMessage"),"Please choose today or a future date.",true);
      const rows=readData(APPOINTMENTS_KEY);rows.push({id:Date.now(),queue:rows.length?Math.max(...rows.map(a=>Number(a.queue)||0))+1:1,username:s.username,resident:data.get("resident").trim(),service:data.get("service"),date:dateValue,status:"Pending",notes:data.get("notes").trim()});saveData(APPOINTMENTS_KEY,rows);appointmentForm.reset();if(resident&&s.role==="resident")resident.value=s.fullName||s.username;if(date)date.min=todayString();notice(document.getElementById("appointmentMessage"),"Appointment request submitted. Your queue number is "+rows[rows.length-1].queue+".");renderAppointments(document.getElementById("appointmentSearch")?.value||"");renderDashboard();});
  }
  const emergencyForm=document.getElementById("emergencyForm");
  if(emergencyForm){const reporter=document.getElementById("emergencyReporter"),s=getSession();if(reporter&&s.role==="resident")reporter.value=s.fullName||s.username;
    emergencyForm.addEventListener("submit",e=>{e.preventDefault();const data=new FormData(emergencyForm),rows=readData(EMERGENCIES_KEY);rows.push({id:Date.now(),username:s.username,reporter:data.get("reporter").trim(),type:data.get("type"),location:data.get("location").trim(),priority:data.get("priority"),details:data.get("details").trim(),status:"Recorded",date:new Date().toISOString()});saveData(EMERGENCIES_KEY,rows);emergencyForm.reset();if(reporter&&s.role==="resident")reporter.value=s.fullName||s.username;notice(document.getElementById("emergencyMessage"),"Incident recorded in the demo system.");renderEmergencies(document.getElementById("emergencySearch")?.value||"");renderDashboard();});
  }
  const profileForm=document.getElementById("profileForm");
  if(profileForm){const s=getSession();document.getElementById("profileName").textContent=s.fullName;document.getElementById("profileUsername").textContent="@"+s.username;document.getElementById("profileFullName").value=s.fullName;document.getElementById("profileUsernameInput").value=s.username;
    profileForm.addEventListener("submit",e=>{e.preventDefault();const name=document.getElementById("profileFullName").value.trim();if(!name)return;const session=getSession();session.fullName=name;localStorage.setItem(SESSION_KEY,JSON.stringify(session));const accounts=readData(ACCOUNT_KEY);const account=accounts.find(a=>a.username===session.username);if(account){account.fullName=name;saveData(ACCOUNT_KEY,accounts);}applyUserInfo();document.getElementById("profileName").textContent=name;notice(document.getElementById("profileMessage"),"Profile updated.");});
  }
}
function initSearches(){
  const bindings=[["residentSearch",renderResidents],["appointmentSearch",renderAppointments],["emergencySearch",renderEmergencies]];
  bindings.forEach(([id,fn])=>{const el=document.getElementById(id);if(el)el.addEventListener("input",()=>fn(el.value));});
}
function initActions(){
  document.addEventListener("click",e=>{const logout=e.target.closest("[data-logout]");if(logout){localStorage.removeItem(SESSION_KEY);window.location.href="index.html";return;}
    const remove=e.target.closest("[data-delete-resident]");if(remove&&confirm("Remove this demo resident profile?")){saveData(RESIDENTS_KEY,readData(RESIDENTS_KEY).filter(r=>String(r.id)!==remove.dataset.deleteResident));renderResidents(document.getElementById("residentSearch")?.value||"");renderDashboard();}
  });
  document.addEventListener("change",e=>{const appointment=e.target.closest("[data-appointment-status]");if(appointment){const rows=readData(APPOINTMENTS_KEY),item=rows.find(a=>String(a.id)===appointment.dataset.appointmentStatus);if(item){item.status=appointment.value;saveData(APPOINTMENTS_KEY,rows);renderAppointments(document.getElementById("appointmentSearch")?.value||"");renderDashboard();}}
    const emergency=e.target.closest("[data-emergency-status]");if(emergency){const rows=readData(EMERGENCIES_KEY),item=rows.find(a=>String(a.id)===emergency.dataset.emergencyStatus);if(item){item.status=emergency.value;saveData(EMERGENCIES_KEY,rows);renderEmergencies(document.getElementById("emergencySearch")?.value||"");renderDashboard();}}
  });
}
function initSettings(){
  const toggle=document.getElementById("darkModeToggle");const apply=()=>document.body.classList.toggle("dark-mode",localStorage.getItem(THEME_KEY)==="true");apply();
  if(toggle){toggle.checked=localStorage.getItem(THEME_KEY)==="true";toggle.addEventListener("change",()=>{localStorage.setItem(THEME_KEY,String(toggle.checked));apply();});}
  const s=getSession(),account=document.getElementById("settingsAccount");if(account&&s)account.textContent=`Signed in as ${s.fullName} (@${s.username}) · ${s.role==="admin"?"Administrator":"Resident"}`;
  const link=document.getElementById("settingsProfileLink");if(link&&s?.role==="admin")link.style.display="none";
}
document.addEventListener("DOMContentLoaded",()=>{
  if(!document.body.classList.contains("app-page"))return;
  if(!initSessionGuard())return;
  ensureSeedData();commonSidebar();applyUserInfo();initForms();initSearches();initActions();initSettings();renderDashboard();renderResidents();renderAppointments();renderEmergencies();
});