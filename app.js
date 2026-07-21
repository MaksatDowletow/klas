const state = {
  route: "home",
  quizStep: 0,
  quiz: {
    age: "",
    gender: "",
    lookingFor: ""
  },
  currentConversation: 1,
  videoStream: null
};

const profiles = [
  {
    id: 1,
    name: "Mähriban",
    age: 43,
    city: "Türkmenabat",
    country: "Türkmenistan",
    interests: ["kitap", "syýahat", "klas duşuşygy"],
    bio: "Klasdaşlar bilen täzelikleri paýlaşmagy we duşuşyk meýilnamalaryny ara alyp maslahatlaşmagy halaýaryn.",
    avatar: "M",
    avatarClass: "avatar-a",
    lastActive: "Şu gün"
  },
  {
    id: 2,
    name: "Azat",
    age: 44,
    city: "Kerki",
    country: "Türkmenistan",
    interests: ["sport", "maşgala", "mekdep ýatlamalary"],
    bio: "27-nji mekdebiň uçurymlary bilen aragatnaşygy täzeden ýola goýmak isleýärin.",
    avatar: "A",
    avatarClass: "avatar-b",
    lastActive: "Düýn"
  },
  {
    id: 3,
    name: "Gülnar",
    age: 43,
    city: "Aşgabat",
    country: "Türkmenistan",
    interests: ["aýdym-saz", "syýahat", "suratlar"],
    bio: "Klas albomyndaky maglumatlary toplamak we duşuşyga taýýarlyk görmek gyzykly.",
    avatar: "G",
    avatarClass: "avatar-c",
    lastActive: "2 gün öň"
  },
  {
    id: 4,
    name: "Serdar",
    age: 44,
    city: "Kerki",
    country: "Türkmenistan",
    interests: ["tehnologiýa", "futbol", "duşuşyk"],
    bio: "Topar habarlaryny tertiplemek we köne dostlar bilen habarlaşmak üçin geldim.",
    avatar: "S",
    avatarClass: "avatar-d",
    lastActive: "Şu hepde"
  }
];

const conversations = [
  {
    id: 1,
    profileId: 1,
    messages: [
      { from: "them", text: "Salam, klas duşuşygy barada täzelik barmy?" },
      { from: "me", text: "Bar, topar habarynda paýlaşaryn." }
    ]
  },
  {
    id: 2,
    profileId: 2,
    messages: [
      { from: "them", text: "Kerki tarapdan kimler gatnaşjak?" },
      { from: "me", text: "Sanawy admin panelinde täzeläris." }
    ]
  }
];

const defaultGallery = [
  {
    id: 1,
    caption: "27-nji mekdep - uçurymlar ýatlamasy",
    author: "Admin",
    date: "2000",
    svg: "school"
  },
  {
    id: 2,
    caption: "Klas duşuşygy üçin taýýarlyk",
    author: "Mähriban",
    date: "2026",
    svg: "meeting"
  },
  {
    id: 3,
    caption: "Köne albomdan umumy surat ýeri",
    author: "Azat",
    date: "Arhiw",
    svg: "album"
  }
];

const quizSteps = [
  {
    title: "1-nji ädim: ýaş tassyklamasy",
    key: "age",
    question: "Sahypa diňe uly ýaşly klasdaşlar üçin. 18 ýaşyňyz doldumy?",
    options: ["Hawa, 18 ýaşdan uly", "Ýok"]
  },
  {
    title: "2-nji ädim: jyns",
    key: "gender",
    question: "Profilde haýsy jynsy görkezmek isleýärsiňiz?",
    options: ["Aýal", "Erkek", "Görkezmek islämok"]
  },
  {
    title: "3-nji ädim: aragatnaşyk maksady",
    key: "lookingFor",
    question: "Sahypada nähili aragatnaşyk gözleýärsiňiz?",
    options: ["Klasdaşlar bilen habarlaşmak", "Duşuşyk meýilleşdirmek", "Maglumat we surat alyşmak"]
  }
];

function $(selector) {
  return document.querySelector(selector);
}

function $all(selector) {
  return [...document.querySelectorAll(selector)];
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function load(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function track(eventName, payload = {}) {
  const events = load("klasdaslar.analytics", []);
  events.push({ eventName, payload, at: new Date().toISOString() });
  save("klasdaslar.analytics", events.slice(-100));
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  window.setTimeout(() => node.classList.remove("show"), 2600);
}

function route() {
  const hash = window.location.hash.replace("#", "") || "home";
  const homeAnchors = ["how", "safety", "faq"];
  const viewId = homeAnchors.includes(hash) ? "home" : hash;
  state.route = viewId;
  $all(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
  $(".nav")?.classList.remove("open");
  $(".menu-toggle")?.setAttribute("aria-expanded", "false");

  if (viewId === "quiz") renderQuiz();
  if (viewId === "profiles") renderProfiles();
  if (viewId === "gallery") renderGallery();
  if (viewId === "messages") renderConversations();
  if (viewId === "dashboard") renderDashboard();
  if (viewId === "admin") renderAdmin();
  if (viewId === "home") track("landing_view");

  if (homeAnchors.includes(hash)) {
    window.requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  if (!document.getElementById(hash) && !document.getElementById(viewId)) {
    window.location.hash = "home";
  }
}

function renderQuiz() {
  const step = quizSteps[state.quizStep];
  $("#quizBack").style.display = "";
  $("#quizNext").style.display = "";
  $("#quizTitle").textContent = step.title;
  $("#quizProgress").style.width = `${((state.quizStep + 1) / quizSteps.length) * 100}%`;
  $("#quizBack").disabled = state.quizStep === 0;
  $("#quizNext").textContent = state.quizStep === quizSteps.length - 1 ? "Netijäni gör" : "Dowam et";

  const selected = state.quiz[step.key];
  $("#quizStep").innerHTML = `
    <p>${step.question}</p>
    <div class="option-grid">
      ${step.options.map((option) => `
        <button class="option-card ${selected === option ? "selected" : ""}" type="button" data-value="${option}">
          <strong>${option}</strong>
        </button>
      `).join("")}
    </div>
  `;

  $all(".option-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.quiz[step.key] = button.dataset.value;
      renderQuiz();
    });
  });
}

function completeQuiz() {
  if (state.quiz.age === "Ýok") {
    toast("Bagyşlaň, sahypa diňe 18+ ulanyjylar üçin.");
    return;
  }
  save("klasdaslar.quiz", state.quiz);
  track("quiz_completed", state.quiz);
  $("#quizStep").innerHTML = `
    <div class="result-box">
      <h3>Netije taýýar</h3>
      <p>Siziň saýlawyňyz: ${state.quiz.gender || "görkezilmedi"} · ${state.quiz.lookingFor || "umumy aragatnaşyk"}.</p>
      <p>Anketalary görmek we chat başlatmak üçin hasap açyň.</p>
      <a class="primary-button" href="#signup">Hasaba alyşa geç</a>
    </div>
  `;
  $("#quizTitle").textContent = "Şahsylaşdyrylan netije";
  $("#quizBack").style.display = "none";
  $("#quizNext").style.display = "none";
}

function renderProfiles() {
  const city = $("#cityFilter")?.value || "";
  const interest = ($("#interestFilter")?.value || "").trim().toLowerCase();
  const grid = $("#profileGrid");
  if (!grid) return;

  const filtered = profiles.filter((profile) => {
    const cityOk = !city || profile.city === city;
    const interestOk = !interest || profile.interests.some((item) => item.toLowerCase().includes(interest));
    return cityOk && interestOk;
  });

  grid.innerHTML = filtered.length ? filtered.map(profileCard).join("") : `<div class="panel card"><h3>Netije ýok</h3><p>Süzgüçleri üýtgedip görüň.</p></div>`;
  $all("[data-message]").forEach((button) => button.addEventListener("click", () => startConversation(Number(button.dataset.message))));
  $all("[data-report]").forEach((button) => button.addEventListener("click", () => reportProfile(Number(button.dataset.report))));
  $all("[data-block]").forEach((button) => button.addEventListener("click", () => blockProfile(Number(button.dataset.block))));
}

function profileCard(profile) {
  return `
    <article class="profile-card panel">
      <header>
        <div class="avatar ${profile.avatarClass}">${profile.avatar}</div>
        <div>
          <h3>${profile.name}, ${profile.age}</h3>
          <span>${profile.city} · ${profile.lastActive}</span>
        </div>
      </header>
      <p>${profile.bio}</p>
      <p><strong>Gyzyklanmalar:</strong> ${profile.interests.join(", ")}</p>
      <div class="profile-actions">
        <button class="primary-button small" type="button" data-message="${profile.id}">Ýaz</button>
        <button class="ghost-button small" type="button" data-block="${profile.id}">Blokla</button>
        <button class="danger-button small" type="button" data-report="${profile.id}">Şikaýat</button>
      </div>
    </article>
  `;
}

function renderMockProfiles() {
  const node = $("#mockProfiles");
  if (!node) return;
  node.innerHTML = `
    <strong>Profil kartlary</strong>
    ${profiles.slice(0, 3).map((profile) => `
      <div class="profile-row">
        <div class="avatar ${profile.avatarClass}">${profile.avatar}</div>
        <div><strong>${profile.name}</strong><p>${profile.city} · ${profile.interests[0]}</p></div>
      </div>
    `).join("")}
  `;
}

function renderGallery() {
  const grid = $("#galleryGrid");
  if (!grid) return;
  const uploaded = load("klasdaslar.gallery", []);
  const items = [...uploaded, ...defaultGallery];
  grid.innerHTML = items.map((item) => `
    <article class="gallery-card panel">
      ${item.dataUrl ? `<img src="${item.dataUrl}" alt="${item.caption}">` : gallerySvg(item.svg)}
      <div>
        <strong>${item.caption}</strong>
        <p>${item.author} · ${item.date}</p>
      </div>
      <div class="profile-actions">
        <button class="ghost-button small" type="button" data-like-photo="${item.id}">Halan</button>
        <button class="danger-button small" type="button" data-report-photo="${item.id}">Şikaýat</button>
      </div>
    </article>
  `).join("");

  $all("[data-like-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      track("gallery_photo_liked", { id: button.dataset.likePhoto });
      toast("Surat halananlara goşuldy.");
    });
  });

  $all("[data-report-photo]").forEach((button) => {
    button.addEventListener("click", () => {
      const reports = load("klasdaslar.reports", []);
      reports.push({ id: Date.now(), profileId: 0, name: "Galereýa suraty", reason: `Surat #${button.dataset.reportPhoto} barlagy`, status: "Täze" });
      save("klasdaslar.reports", reports);
      track("gallery_photo_reported", { id: button.dataset.reportPhoto });
      toast("Surat boýunça şikaýat moderasiýa iberildi.");
    });
  });
}

function gallerySvg(type) {
  const palettes = {
    school: ["#0f766e", "#f97316", "#f7f4ef"],
    meeting: ["#2563eb", "#14b8a6", "#fff7ed"],
    album: ["#7c3aed", "#db2777", "#fdf2f8"]
  };
  const [a, b, c] = palettes[type] || palettes.school;
  return `
    <svg class="gallery-svg" viewBox="0 0 640 420" role="img" aria-label="Original galereýa illustrasiýasy">
      <rect width="640" height="420" fill="${c}"></rect>
      <circle cx="112" cy="95" r="50" fill="${a}" opacity="0.9"></circle>
      <rect x="170" y="70" width="330" height="54" rx="12" fill="${a}" opacity="0.85"></rect>
      <rect x="72" y="185" width="496" height="150" rx="18" fill="${b}" opacity="0.86"></rect>
      <circle cx="180" cy="260" r="42" fill="#fff"></circle>
      <circle cx="310" cy="260" r="42" fill="#fff"></circle>
      <circle cx="440" cy="260" r="42" fill="#fff"></circle>
      <path d="M110 350 C190 300 255 390 330 342 C410 292 480 380 560 326" fill="none" stroke="${a}" stroke-width="16" stroke-linecap="round"></path>
    </svg>
  `;
}

function startConversation(profileId) {
  let conversation = conversations.find((item) => item.profileId === profileId);
  if (!conversation) {
    conversation = { id: conversations.length + 1, profileId, messages: [{ from: "me", text: "Salam!" }] };
    conversations.push(conversation);
  }
  state.currentConversation = conversation.id;
  track("profile_viewed", { profileId });
  window.location.hash = "messages";
}

function reportProfile(profileId) {
  const profile = profiles.find((item) => item.id === profileId);
  const reports = load("klasdaslar.reports", []);
  reports.push({ id: Date.now(), profileId, name: profile?.name || "Näbelli", reason: "Profil barlagy soraldy", status: "Täze" });
  save("klasdaslar.reports", reports);
  track("report_submitted", { profileId });
  toast("Şikaýat moderasiýa nobatyna goşuldy.");
}

function blockProfile(profileId) {
  const blocked = load("klasdaslar.blocked", []);
  if (!blocked.includes(profileId)) blocked.push(profileId);
  save("klasdaslar.blocked", blocked);
  track("user_blocked", { profileId });
  toast("Ulanyjy bloklanan sanawa goşuldy.");
}

function renderConversations() {
  const list = $("#conversationList");
  const messages = $("#chatMessages");
  const header = $("#chatHeader");
  if (!list || !messages || !header) return;

  list.innerHTML = conversations.map((conversation) => {
    const profile = profiles.find((item) => item.id === conversation.profileId);
    return `
      <button class="conversation-button ${conversation.id === state.currentConversation ? "active" : ""}" type="button" data-conversation="${conversation.id}">
        <span class="avatar ${profile.avatarClass}">${profile.avatar}</span>
        <span><strong>${profile.name}</strong><br><small>${conversation.messages.at(-1).text}</small></span>
      </button>
    `;
  }).join("");

  $all("[data-conversation]").forEach((button) => {
    button.addEventListener("click", () => {
      state.currentConversation = Number(button.dataset.conversation);
      renderConversations();
    });
  });

  const active = conversations.find((item) => item.id === state.currentConversation) || conversations[0];
  const profile = profiles.find((item) => item.id === active.profileId);
  header.innerHTML = `
    <span>${profile.name} bilen söhbet</span>
    <span class="chat-tools">
      <button class="ghost-button small" type="button" id="startVideoCall">Wideoçat</button>
      <button class="ghost-button small" type="button" id="stopVideoCall">Ýap</button>
      <button class="danger-button small" type="button" data-report="${profile.id}">Şikaýat</button>
    </span>
  `;
  messages.innerHTML = active.messages.map((message) => `<p class="chat-bubble ${message.from === "me" ? "outgoing" : "incoming"}">${message.text}</p>`).join("");
  messages.scrollTop = messages.scrollHeight;
  header.querySelector("[data-report]")?.addEventListener("click", () => reportProfile(profile.id));
  $("#startVideoCall")?.addEventListener("click", startVideoCall);
  $("#stopVideoCall")?.addEventListener("click", stopVideoCall);
}

function renderDashboard() {
  const user = load("klasdaslar.user", null);
  const profile = load("klasdaslar.profile", null);
  const reports = load("klasdaslar.reports", []);
  $("#welcomeTitle").textContent = user ? `Hoş geldiňiz, ${user.email}` : "Demo kabinet";
  $("#profileStatus").textContent = profile ? "Işjeň" : "Taslama";
  $("#reportCount").textContent = reports.length;
  $("#activityLog").innerHTML = load("klasdaslar.analytics", []).slice(-6).reverse().map((event) => `<li>${event.eventName} · ${new Date(event.at).toLocaleString("tk-TM")}</li>`).join("") || "<li>Hereket ýok.</li>";
}

function renderAdmin() {
  const reports = load("klasdaslar.reports", []);
  $("#adminReportCount").textContent = reports.length;
  $("#reportQueue").innerHTML = reports.length ? reports.map((report) => `
    <div class="report-item">
      <span><strong>${report.name}</strong><br>${report.reason}</span>
      <button class="ghost-button small" type="button" data-close-report="${report.id}">Çöz</button>
    </div>
  `).join("") : "<p>Şikaýat ýok.</p>";

  $all("[data-close-report]").forEach((button) => {
    button.addEventListener("click", () => {
      const rest = load("klasdaslar.reports", []).filter((report) => report.id !== Number(button.dataset.closeReport));
      save("klasdaslar.reports", rest);
      renderAdmin();
      toast("Şikaýat çözüldi.");
    });
  });
}

async function startVideoCall() {
  const panel = $("#videoCallPanel");
  const localVideo = $("#localVideo");
  const remoteVideo = $("#remoteVideo");
  const status = $("#videoStatus");
  if (!navigator.mediaDevices?.getUserMedia) {
    toast("Bu brauzer kamera/mikrofon wideoçatyny goldamaýar.");
    return;
  }

  try {
    state.videoStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localVideo.srcObject = state.videoStream;
    remoteVideo.muted = true;
    remoteVideo.srcObject = state.videoStream;
    panel.classList.add("active");
    status.textContent = "Demo wideoçat başlady. Hakyky köp ulanyjyly wideoçat üçin WebRTC signaling server gerek.";
    track("video_call_started", { conversationId: state.currentConversation });
  } catch (error) {
    status.textContent = "Kamera ýa-da mikrofon rugsady berilmedi.";
    toast("Wideoçat üçin kamera/mikrofon rugsady gerek.");
  }
}

function stopVideoCall() {
  if (state.videoStream) {
    state.videoStream.getTracks().forEach((trackItem) => trackItem.stop());
    state.videoStream = null;
  }
  if ($("#localVideo")) $("#localVideo").srcObject = null;
  if ($("#remoteVideo")) $("#remoteVideo").srcObject = null;
  $("#videoCallPanel")?.classList.remove("active");
  track("video_call_stopped", { conversationId: state.currentConversation });
}

function googleAuth(mode) {
  const email = window.prompt("Gmail salgyňyzy ýazyň", "klasdas@example.com");
  if (!email) return;
  if (!email.toLowerCase().endsWith("@gmail.com")) {
    toast("Registrasiýa üçin Gmail salgy gerek.");
    return;
  }
  save("klasdaslar.user", {
    email,
    verified: true,
    provider: "google",
    displayName: email.split("@")[0]
  });
  track(mode === "signup" ? "google_signup_completed" : "google_login_completed", { email });
  toast("Gmail bilen giriş demo görnüşinde ýerine ýetirildi.");
  window.location.hash = mode === "signup" ? "edit-profile" : "dashboard";
}

function initForms() {
  $("#signupForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!String(data.email).toLowerCase().endsWith("@gmail.com")) {
      toast("Hasaba alyş diňe Gmail salgy bilen amala aşýar.");
      return;
    }
    save("klasdaslar.user", { email: data.email, verified: true });
    track("signup_completed", { email: data.email });
    toast("Hasap döredildi we email tassyklanyldy.");
    window.location.hash = "edit-profile";
  });

  $("#loginForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (!String(data.email).toLowerCase().endsWith("@gmail.com")) {
      toast("Giriş üçin Gmail salgy ulanyň.");
      return;
    }
    save("klasdaslar.user", { email: data.email, verified: true });
    toast("Giriş ýerine ýetirildi.");
    window.location.hash = "dashboard";
  });

  $("#forgotForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    toast("Demo dikeldiş habary taýýarlandy.");
  });

  $("#profileForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    save("klasdaslar.profile", data);
    track("profile_created", { city: data.city });
    toast("Profil saklandy.");
    window.location.hash = "dashboard";
  });

  $("#messageForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = event.currentTarget.message;
    const text = input.value.trim();
    if (!text) return;
    const active = conversations.find((item) => item.id === state.currentConversation);
    active.messages.push({ from: "me", text });
    input.value = "";
    track("message_sent", { conversationId: active.id });
    renderConversations();
  });

  $("#galleryUploadForm")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const file = $("#galleryFile")?.files?.[0];
    const caption = new FormData(event.currentTarget).get("caption") || "Klasdaşlaryň umumy suraty";
    if (!file) {
      toast("Galereýa goşmak üçin surat saýlaň.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast("Diňe JPG, PNG ýa-da WebP surat kabul edilýär.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast("Demo galereýa üçin surat 2 MB-dan uly bolmaly däl.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const gallery = load("klasdaslar.gallery", []);
      gallery.unshift({
        id: Date.now(),
        caption,
        author: load("klasdaslar.user", { email: "Demo ulanyjy" }).email,
        date: new Date().toLocaleDateString("tk-TM"),
        dataUrl: reader.result
      });
      save("klasdaslar.gallery", gallery.slice(0, 12));
      track("gallery_photo_uploaded", { caption });
      event.currentTarget.reset();
      renderGallery();
      toast("Surat galereýa goşuldy.");
    };
    reader.readAsDataURL(file);
  });
}

function initControls() {
  $(".menu-toggle")?.addEventListener("click", (event) => {
    const nav = $(".nav");
    const open = !nav.classList.contains("open");
    nav.classList.toggle("open", open);
    event.currentTarget.setAttribute("aria-expanded", String(open));
  });

  $("#quizBack")?.addEventListener("click", () => {
    if (state.quizStep > 0) {
      state.quizStep -= 1;
      renderQuiz();
    }
  });

  $("#quizNext")?.addEventListener("click", () => {
    const step = quizSteps[state.quizStep];
    if (!state.quiz[step.key]) {
      toast("Dowam etmek üçin bir jogap saýlaň.");
      return;
    }
    track("quiz_step_completed", { step: state.quizStep + 1, value: state.quiz[step.key] });
    if (state.quizStep === quizSteps.length - 1) completeQuiz();
    else {
      state.quizStep += 1;
      renderQuiz();
    }
  });

  $("#applyFilters")?.addEventListener("click", () => {
    track("profile_filter_used");
    renderProfiles();
  });

  $("#deleteAccount")?.addEventListener("click", () => {
    track("account_deleted");
    toast("Hasaby pozmak haýyşy demo žurnala goşuldy.");
  });

  $("#googleSignup")?.addEventListener("click", () => googleAuth("signup"));
  $("#googleLogin")?.addEventListener("click", () => googleAuth("login"));

  $("#acceptCookies")?.addEventListener("click", () => setCookieConsent("accepted"));
  $("#rejectCookies")?.addEventListener("click", () => setCookieConsent("rejected"));

  $("#languageSelect")?.addEventListener("change", (event) => {
    toast(`${event.target.value.toUpperCase()} dil görnüşi demo ýagdaýda.`);
  });
}

function setCookieConsent(value) {
  save("klasdaslar.cookieConsent", value);
  track(value === "accepted" ? "cookie_consent_accepted" : "cookie_consent_rejected");
  $("#cookieConsent").classList.remove("show");
}

function initCookieConsent() {
  if (!load("klasdaslar.cookieConsent", null)) {
    $("#cookieConsent").classList.add("show");
  }
}

window.addEventListener("hashchange", route);
document.addEventListener("DOMContentLoaded", () => {
  renderMockProfiles();
  initForms();
  initControls();
  initCookieConsent();
  route();
});
