const ACCOUNT_KEY = "barangayCareAccounts";
const SESSION_KEY = "barangayCareSession";

function getAccounts() {
  const saved = JSON.parse(localStorage.getItem(ACCOUNT_KEY) || "[]");
  const defaults = [
    { username: "admin", password: "Admin123!", fullName: "Administrator", role: "admin" },
    { username: "resident", password: "User123!", fullName: "Demo Resident", role: "resident" }
  ];
  defaults.forEach(account => {
    if (!saved.some(item => item.username.toLowerCase() === account.username)) saved.push(account);
  });
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(saved));
  return saved;
}
function setMessage(element, message, isError = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("error", isError);
}
document.addEventListener("DOMContentLoaded", () => {
  getAccounts();
  document.querySelectorAll("[data-toggle-password]").forEach(button => {
    button.addEventListener("click", () => {
      const input = document.getElementById(button.dataset.togglePassword);
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "password" ? "Show" : "Hide";
    });
  });

  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", event => {
    event.preventDefault();
    const username = loginForm.username.value.trim();
    const password = loginForm.password.value;
    const account = getAccounts().find(item => item.username.toLowerCase() === username.toLowerCase() && item.password === password);
    if (!account) {
      setMessage(document.getElementById("loginMessage"), "Incorrect username or password. Please try again.", true);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username: account.username, fullName: account.fullName, role: account.role }));
    window.location.href = account.role === "admin" ? "admin.html" : "resident.html";
  });

  const registerForm = document.getElementById("registerForm");
  if (registerForm) registerForm.addEventListener("submit", event => {
    event.preventDefault();
    const username = registerForm.username.value.trim();
    const password = registerForm.password.value;
    const fullName = registerForm.fullName.value.trim();
    const message = document.getElementById("registerMessage");
    const accounts = getAccounts();
    if (username.length < 3) return setMessage(message, "Username must be at least 3 characters.", true);
    if (accounts.some(item => item.username.toLowerCase() === username.toLowerCase())) return setMessage(message, "That username is already taken.", true);
    const account = { username, password, fullName, role: "resident" };
    accounts.push(account);
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify(accounts));
    localStorage.setItem(SESSION_KEY, JSON.stringify({ username, fullName, role: "resident" }));
    window.location.href = "resident.html";
  });
});