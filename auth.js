
(() => {
  "use strict";

  const client = window.supabaseClient;

  if (!client) {
    console.error("Flexi Rent: Supabase is not connected.");
    return;
  }

  const loginButton = document.getElementById("loginButton");
  const signupButton = document.getElementById("signupButton");

  if (!loginButton || !signupButton) {
    console.error("Flexi Rent: Account buttons not found.");
    return;
  }

  // Create the account popup.
  const modal = document.createElement("div");
  modal.id = "authModal";
  modal.className = "auth-backdrop";
  modal.hidden = true;

  modal.innerHTML = `
    <div class="auth-panel" role="dialog"
         aria-modal="true" aria-labelledby="authTitle">
      <button class="auth-close" type="button"
              aria-label="Close">×</button>
      <h2 id="authTitle">Welcome to Flexi Rent</h2>
      <p id="authSubtitle">Sign in to your account.</p>

      <form id="authForm">
        <label for="authEmail">Email address</label>
        <input id="authEmail" type="email"
               autocomplete="email" required>

        <label for="authPassword">Password</label>
        <input id="authPassword" type="password"
               autocomplete="current-password"
               minlength="6" required>

        <p id="authMessage" role="status"
           aria-live="polite"></p>

        <button id="authSubmit" type="submit">
          Log In
        </button>
      </form>

      <button id="authSwitch" type="button">
        Need an account? Sign Up
      </button>
    </div>
  `;

  document.body.appendChild(modal);

  // Add styles without changing styles.css.
  const style = document.createElement("style");
  style.textContent = `
    .auth-backdrop[hidden] { display: none !important; }
    .auth-backdrop {
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(0,0,0,.82);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 18px;
    }
    .auth-panel {
      background: #181b21;
      color: white;
      width: 100%;
      max-width: 420px;
      padding: 28px;
      border-radius: 18px;
      border: 1px solid #343941;
      position: relative;
      box-shadow: 0 20px 70px rgba(0,0,0,.5);
    }
    .auth-panel h2 {
      font-size: 26px;
      margin: 0 0 8px;
    }
    .auth-panel p {
      color: #b9bec6;
      margin-bottom: 20px;
    }
    .auth-panel label {
      display: block;
      margin: 14px 0 7px;
      font-size: 14px;
    }
    .auth-panel input {
      display: block;
      width: 100%;
      box-sizing: border-box;
      padding: 13px;
      background: #0d1014;
      color: white;
      border: 1px solid #444b55;
      border-radius: 9px;
      font-size: 16px;
    }
    #authSubmit {
      width: 100%;
      margin-top: 18px;
      padding: 14px;
      border: 0;
      border-radius: 9px;
      background: #ff633f;
      color: #111;
      font-size: 16px;
      font-weight: 800;
      cursor: pointer;
    }
    #authSubmit:disabled { opacity: .6; }
    #authSwitch {
      background: none;
      border: none;
      color: #ff866a;
      margin-top: 17px;
      cursor: pointer;
      font-size: 14px;
    }
    .auth-close {
      position: absolute;
      top: 12px;
      right: 17px;
      border: 0;
      background: none;
      color: white;
      font-size: 30px;
      cursor: pointer;
    }
    #authMessage {
      font-size: 14px;
      line-height: 1.5;
    }
  `;
  document.head.appendChild(style);

  const form = document.getElementById("authForm");
  const title = document.getElementById("authTitle");
  const subtitle = document.getElementById("authSubtitle");
  const message = document.getElementById("authMessage");
  const submit = document.getElementById("authSubmit");
  const switchButton = document.getElementById("authSwitch");
  const password = document.getElementById("authPassword");

  let mode = "login";
  let currentUser = null;

  function setMode(nextMode) {
    mode = nextMode;
    form.reset();
    message.textContent = "";
    title.textContent =
      mode === "signup" ? "Create your account" : "Welcome back";
    subtitle.textContent =
      mode === "signup"
        ? "Join Flexi Rent to rent or list your ride."
        : "Log in to your Flexi Rent account.";
    submit.textContent =
      mode === "signup" ? "Create Account" : "Log In";
    switchButton.textContent =
      mode === "signup"
        ? "Already have an account? Log In"
        : "Need an account? Sign Up";
    password.autocomplete =
      mode === "signup" ? "new-password" : "current-password";
  }

  function openModal(nextMode) {
    setMode(nextMode);
    modal.hidden = false;
    document.getElementById("authEmail").focus();
  }

  function closeModal() {
    modal.hidden = true;
  }

  function updateHeader() {
    if (currentUser) {
      loginButton.textContent = "Log Out";
      signupButton.textContent = "My Account";
    } else {
      loginButton.textContent = "Log In";
      signupButton.textContent = "Sign Up";
    }
  }

  loginButton.addEventListener("click", async () => {
    if (currentUser) {
      const { error } = await client.auth.signOut();
      if (error) {
        alert(error.message);
        return;
      }
      currentUser = null;
      updateHeader();
    } else {
      openModal("login");
    }
  });

  signupButton.addEventListener("click", () => {
    if (currentUser) {
      alert("Signed in as " + currentUser.email);
    } else {
      openModal("signup");
    }
  });

  modal.querySelector(".auth-close")
    .addEventListener("click", closeModal);

  modal.addEventListener("click", event => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  switchButton.addEventListener("click", () => {
    setMode(mode === "login" ? "signup" : "login");
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();

    const email = document.getElementById("authEmail").value.trim();
    const pass = password.value;

    submit.disabled = true;
    message.textContent = "Please wait...";

    try {
      if (mode === "signup") {
        const { data, error } = await client.auth.signUp({
          email,
          password: pass,
          options: {
            emailRedirectTo: window.location.origin
          }
        });

        if (error) throw error;

        if (data.session) {
          currentUser = data.user;
          updateHeader();
          closeModal();
        } else {
          message.textContent =
            "Check your email for a confirmation link, then log in.";
        }
      } else {
        const { data, error } =
          await client.auth.signInWithPassword({
            email,
            password: pass
          });

        if (error) throw error;

        currentUser = data.user;
        updateHeader();
        closeModal();
      }
    } catch (error) {
      message.textContent = error.message ||
        "Something went wrong. Please try again.";
    } finally {
      submit.disabled = false;
    }
  });

  client.auth.onAuthStateChange((_event, session) => {
    currentUser = session?.user || null;
    updateHeader();
  });

  client.auth.getUser().then(({ data, error }) => {
    if (!error) {
      currentUser = data.user;
      updateHeader();
    }
  });
})();
