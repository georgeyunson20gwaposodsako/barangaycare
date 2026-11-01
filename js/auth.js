const SESSION_KEY = "barangayCareSession";
const API_URL = "api";

async function api(action, body) {
  const res = await fetch(`${API_URL}?action=${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(body || {}) });
  const json = await res.json().catch(() => ({ error: "The server did not answer correctly. Is the BarangayCare server running (start.bat)? Open this site at http://localhost:3000." }));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}
function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", isError);
}
function startSession(user) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  window.location.href = user.role === "admin" ? "admin.html" : "resident.html";
}
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-toggle-password]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "password" ? "Show" : "Hide";
    });
  });

  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const res = await api("login", { username: loginForm.username.value.trim(), password: loginForm.password.value });
      startSession(res.user);
    } catch (err) { setMessage(document.getElementById("loginMessage"), err.message, true); }
  });

  const registerForm = document.getElementById("registerForm");
  if (registerForm) registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    try {
      const res = await api("register", { username: registerForm.username.value.trim(), password: registerForm.password.value, fullName: registerForm.fullName.value.trim() });
      startSession(res.user);
    } catch (err) { setMessage(document.getElementById("registerMessage"), err.message, true); }
  });
});
