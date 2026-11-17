const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const menuButton = document.querySelector(".menu-button");
const menu = document.querySelector("#site-menu");
const themeButton = document.querySelector("[data-theme-toggle]");
const chat = document.querySelector("[data-chat]");
const chatToggle = document.querySelector("[data-chat-toggle]");
const chatClose = document.querySelector("[data-chat-close]");
const form = chat.querySelector("[data-chat-form]");
const input = chat.querySelector("[data-chat-input]");
const messages = chat.querySelector("[data-messages]");
const suggestions = chat.querySelector("[data-suggestions]");
const modeLabel = chat.querySelector("[data-mode-label]");
const submitButton = form.querySelector("button");
const portraitPhoto = document.querySelector(".portrait-photo");
let history = [];
let currentLanguage = "en";
let chatMode = "checking";

const french = {
  skip: "Aller au contenu principal",
  languageLabel: "Langue",
  navAbout: "À propos",
  navExperience: "Expérience",
  navProjects: "Projets",
  navEducation: "Formation",
  navContact: "Contact",
  aboutLabel: "À propos",
  aboutTitle: "Je conçois des systèmes d’IA en production, fondés, évalués et prêts à évoluer.",
  aboutP1: "Je suis ingénieur en IA appliquée, spécialisé en RAG de production, systèmes agentiques et évaluation des LLM. Chez CIMA+, j’ai livré un agent de connaissances bilingue utilisé par plus de 700 employés et construit la recherche sur plus de 10 000 pages de documents d’ingénierie dans Azure.",
  aboutP2: "Je termine une maîtrise en génie logiciel à l’Université Concordia et je recherche un poste à temps plein en IA/ML après l’obtention de mon diplôme en décembre 2026.",
  experienceLabel: "Expérience",
  experienceTitle: "L’IA en production, conçue de bout en bout.",
  experienceDescription: "Je conçois des pipelines de recherche, des flux agentiques, des systèmes d’évaluation et une infrastructure infonuagique qui transforment les prototypes LLM en produits fiables.",
  cimaRole: "Stagiaire en intelligence artificielle",
  cimaDescription: "Livraison d’un agent RAG bilingue pour plus de 700 employés, réduisant de 60 % le temps de recherche manuelle de documents.",
  cimaDetail1: "Plus de 10 000 pages · MinerU · embeddings OpenAI · ChromaDB",
  cimaDetail2: "Routeur FastAPI · DistilBERT · ClearML · Datadog",
  jioRole: "Gestionnaire adjoint, cybersécurité",
  jioDescription: "Direction de la gestion des vulnérabilités sur plus de 40 000 serveurs et d’évaluations trimestrielles sur plus de 100 000 appareils.",
  jioDetail1: "Plus de 10 000 vulnérabilités exploitables atténuées",
  jioDetail2: "Conformité d’évaluation supérieure à 99 % · plus de 30 politiques CIS",
  jioDetail3: "Réduction de 70 % de l’exposition aux vulnérabilités zero-day",
  ibmRole: "Stagiaire",
  ibmDescription: "Création d’une plateforme de commerce électronique composée de cinq services avec Java, Spring Boot, Docker et Jenkins.",
  projectsLabel: "Projets",
  projectsTitle: "Projets sélectionnés de mon CV coop.",
  projectsDescription: "Projets universitaires en chaîne de blocs, ingénierie dorsale et logiciels quantitatifs. D’autres travaux sont disponibles sur <a href=\"https://github.com/sodhi-007\" target=\"_blank\" rel=\"noopener noreferrer\">GitHub</a>.",
  project1Title: "Identification de produits contrefaits",
  project1Description: "Portails de produits et d’utilisateurs appuyés par des contrats intelligents pour détecter les contrefaçons.",
  project1Tags: "Développement full-stack · Contrats intelligents · Sécurité",
  project2Title: "Portail d’information universitaire",
  project2Description: "Système d’information déployé qui tient les étudiants au courant des activités universitaires.",
  project2Tags: "Dorsal · Base de données · Déploiement",
  project3Title: "Gestionnaire quantitatif de portefeuille",
  project3Description: "Gestionnaire de portefeuille dans Jupyter utilisant une stratégie quantitative à momentum élevé.",
  project3Tags: "Modélisation financière · Analyse de données",
  project4Title: "Financement participatif sur chaîne de blocs",
  project4Description: "Plateforme décentralisée de financement participatif avec contrats intelligents Solidity déployés.",
  project4Tags: "DApps · Chaîne de blocs · Contrats intelligents",
  skillsLabel: "Compétences",
  skillsTitle: "Une pile compacte pour l’IA en production.",
  skillCloud: "Infonuagique et MLOps",
  skillEngineering: "Ingénierie",
  skillSecurity: "Sécurité",
  educationLabel: "Formation",
  educationTitle: "Des fondations en génie logiciel pour l’IA en production.",
  education1: "MIng, génie logiciel (coop) · moyenne 3,47 / 4,30",
  education2: "BTech, informatique · infonuagique et virtualisation · moyenne 7,87 / 10",
  certified: "Certifications",
  certifications: "Certified Ethical Hacker · Fondamentaux Azure",
  contactLabel: "Contact",
  contactTitle: "Construisons quelque chose d’utile.",
  contactDescription: "Postes en IA/ML, systèmes RAG, agents appliqués ou simplement une bonne conversation d’ingénierie.",
  chatLauncher: "Discuter avec Angad AI",
  chatWelcome: "Posez-moi des questions sur le travail RAG en production d’Angad, ses systèmes agentiques, sa pile IA, ses projets ou son expérience.",
  chatSuggestion1: "Qu’a construit Angad chez CIMA+?",
  chatSuggestion2: "Parlez-moi de ses projets",
  chatInputLabel: "Poser une question sur le CV d’Angad",
  chatPlaceholder: "Question sur Angad…",
  chatSend: "Envoyer la question"
};

const interfaceText = {
  en: { menuOpen: "Open navigation", menuClose: "Close navigation", theme: "Toggle light and dark theme", chatClose: "Close chatbot", chatLabel: "Ask questions about Angad's résumé", checking: "Checking retrieval…", aiMode: "Live AI · retrieved evidence", localMode: "Local ranked retrieval", error: "Unable to answer right now." },
  fr: { menuOpen: "Ouvrir la navigation", menuClose: "Fermer la navigation", theme: "Basculer entre les thèmes clair et sombre", chatClose: "Fermer le robot conversationnel", chatLabel: "Poser des questions sur le CV d’Angad", checking: "Recherche en cours…", aiMode: "IA en direct · preuves récupérées", localMode: "Recherche locale classée", error: "Impossible de répondre pour le moment." }
};

const textOriginals = new WeakMap();
const htmlOriginals = new WeakMap();
const placeholderOriginals = new WeakMap();
const ariaOriginals = new WeakMap();
document.querySelectorAll("[data-i18n]").forEach((element) => textOriginals.set(element, element.textContent));
document.querySelectorAll("[data-i18n-html]").forEach((element) => htmlOriginals.set(element, element.innerHTML));
document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => placeholderOriginals.set(element, element.getAttribute("placeholder")));
document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => ariaOriginals.set(element, element.getAttribute("aria-label")));

function updateModeLabel() {
  const labels = interfaceText[currentLanguage];
  modeLabel.textContent = chatMode === "ai" ? labels.aiMode : chatMode === "local" ? labels.localMode : labels.checking;
}

function setLanguage(language) {
  currentLanguage = language === "fr" ? "fr" : "en";
  document.documentElement.lang = currentLanguage;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    element.textContent = currentLanguage === "fr" && french[key] ? french[key] : textOriginals.get(element);
  });
  document.querySelectorAll("[data-i18n-html]").forEach((element) => {
    const key = element.dataset.i18nHtml;
    element.innerHTML = currentLanguage === "fr" && french[key] ? french[key] : htmlOriginals.get(element);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    element.setAttribute("placeholder", currentLanguage === "fr" && french[key] ? french[key] : placeholderOriginals.get(element));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    element.setAttribute("aria-label", currentLanguage === "fr" && french[key] ? french[key] : ariaOriginals.get(element));
  });
  document.querySelectorAll("[data-language]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.language === currentLanguage)));
  const labels = interfaceText[currentLanguage];
  menu.setAttribute("aria-label", currentLanguage === "fr" ? "Navigation principale" : "Main navigation");
  menuButton.setAttribute("aria-label", menu.hidden ? labels.menuOpen : labels.menuClose);
  themeButton.setAttribute("aria-label", labels.theme);
  chatClose.setAttribute("aria-label", labels.chatClose);
  chat.setAttribute("aria-label", labels.chatLabel);
  document.title = currentLanguage === "fr" ? "Angad Singh Sodhi — Ingénieur en IA appliquée" : "Angad Singh Sodhi — Applied AI Engineer";
  updateModeLabel();
  localStorage.setItem("portfolio-language", currentLanguage);
}

document.querySelector("[data-year]").textContent = new Date().getFullYear();
function updatePortrait() {
  const loaded = portraitPhoto.complete && portraitPhoto.naturalWidth > 0;
  portraitPhoto.hidden = !loaded;
  portraitPhoto.parentElement.classList.toggle("has-photo", loaded);
}
portraitPhoto.addEventListener("load", updatePortrait);
portraitPhoto.addEventListener("error", updatePortrait);
updatePortrait();
document.querySelectorAll("[data-language]").forEach((button) => button.addEventListener("click", () => setLanguage(button.dataset.language)));
setLanguage(localStorage.getItem("portfolio-language"));

function setMenu(open) {
  menu.hidden = !open;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? interfaceText[currentLanguage].menuClose : interfaceText[currentLanguage].menuOpen);
  document.body.classList.toggle("menu-open", open);
}

menuButton.addEventListener("click", () => setMenu(menu.hidden));
menu.addEventListener("click", (event) => { if (event.target.closest("a")) setMenu(false); });

const savedTheme = localStorage.getItem("portfolio-theme");
if (savedTheme === "light") document.documentElement.dataset.theme = "light";
themeButton.textContent = document.documentElement.dataset.theme === "light" ? "☀" : "☾";
themeButton.addEventListener("click", () => {
  const light = document.documentElement.dataset.theme !== "light";
  document.documentElement.dataset.theme = light ? "light" : "dark";
  themeButton.textContent = light ? "☀" : "☾";
  themeButton.setAttribute("aria-label", interfaceText[currentLanguage].theme);
  localStorage.setItem("portfolio-theme", light ? "light" : "dark");
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      observer.unobserve(entry.target);
    }
  });
}, { threshold: .12 });
document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function projectVisual(index) {
  const variants = ["visual-chain", "visual-hub", "visual-chart", "visual-crowd"];
  const visual = makeElement("div", `project-visual ${variants[index % variants.length]}`);
  visual.setAttribute("aria-hidden", "true");
  if (index % 4 === 0) for (let count = 0; count < 3; count += 1) visual.append(makeElement("i"));
  if (index % 4 === 1) { visual.append(makeElement("b", "", "django"), makeElement("i")); }
  if (index % 4 === 2) for (let count = 0; count < 5; count += 1) visual.append(makeElement("i"));
  if (index % 4 === 3) visual.append(makeElement("b", "", "◎"), makeElement("span", "", "BUILD"));
  return visual;
}

function renderPortfolio(data) {
  const site = data.site || {};
  const identity = data.identity || {};
  document.documentElement.style.setProperty("--accent", site.accent || "#9fdc72");
  document.documentElement.dataset.layout = site.layout || "compact";
  if (site.profileImage) portraitPhoto.src = site.profileImage;
  portraitPhoto.alt = `Portrait of ${identity.name || "Angad Singh Sodhi"}`;

  const aboutParagraphs = document.querySelectorAll(".about-copy p");
  const summary = identity.summary || "";
  const availability = identity.availability || "";
  if (aboutParagraphs[0]) { textOriginals.set(aboutParagraphs[0], summary); if (currentLanguage === "en") aboutParagraphs[0].textContent = summary; }
  if (aboutParagraphs[1]) { textOriginals.set(aboutParagraphs[1], availability); if (currentLanguage === "en") aboutParagraphs[1].textContent = availability; }

  const experienceList = document.querySelector(".experience-list");
  experienceList.replaceChildren();
  (data.experience || []).forEach((item) => {
    const article = makeElement("article", "experience-card reveal visible");
    const side = makeElement("div", "experience-side");
    side.append(makeElement("span", "", item.dates || ""), makeElement("h3", "", item.organization || ""), makeElement("p", "", item.role || ""));
    const body = makeElement("div", "experience-body");
    const highlights = item.highlights || [];
    if (highlights[0]) body.append(makeElement("p", "", highlights[0]));
    const list = makeElement("ul");
    highlights.slice(1).forEach((highlight) => list.append(makeElement("li", "", highlight)));
    body.append(list); article.append(side, body); experienceList.append(article);
  });

  const projectGrid = document.querySelector(".project-grid");
  projectGrid.replaceChildren();
  (data.projects || []).forEach((item, index) => {
    const article = makeElement("article", "project-card reveal visible");
    const content = makeElement("div", "project-content");
    content.append(makeElement("span", "", `${String(index + 1).padStart(2, "0")} · ${(item.stack || ["Project"])[0]}`), makeElement("h3", "", item.name || ""), makeElement("p", "", item.description || ""), makeElement("small", "", (item.stack || []).join(" · ")));
    article.append(projectVisual(index), content); projectGrid.append(article);
  });

  const skillLines = document.querySelector(".skill-lines");
  skillLines.replaceChildren();
  Object.entries(data.skills || {}).forEach(([category, values]) => { const row = makeElement("p"); row.append(makeElement("b", "", category), makeElement("span", "", values.join(" · "))); skillLines.append(row); });

  const educationList = document.querySelector(".education-list");
  educationList.replaceChildren();
  (data.education || []).forEach((item) => {
    const article = makeElement("article"); const details = makeElement("div");
    details.append(makeElement("h3", "", item.institution || ""), makeElement("p", "", `${item.program || ""}${item.grade ? ` · ${item.grade}` : ""}`));
    article.append(makeElement("span", "", item.dates || ""), details); educationList.append(article);
  });
  if ((data.certifications || []).length) {
    const article = makeElement("article"); const details = makeElement("div");
    details.append(makeElement("h3", "", "Certifications"), makeElement("p", "", data.certifications.join(" · ")));
    article.append(makeElement("span", "", "Certified"), details); educationList.append(article);
  }

  const contact = data.contact || {};
  const email = document.querySelector(".email-link");
  email.href = `mailto:${contact.email || ""}`; email.firstChild.textContent = `${contact.email || ""} `;
  const socialLinks = document.querySelectorAll(".social-links a");
  if (socialLinks[0]) socialLinks[0].href = contact.linkedin || "#";
  if (socialLinks[1]) socialLinks[1].href = contact.github || "#";

  const sectionIds = ["about", "experience", "projects", "skills", "education", "contact"];
  const order = site.sectionOrder || sectionIds;
  const hidden = new Set(site.hiddenSections || []);
  const main = document.querySelector("main");
  order.forEach((id) => { const section = document.getElementById(id); if (section) { section.hidden = hidden.has(id); main.append(section); } });
  sectionIds.forEach((id) => { const link = menu.querySelector(`a[href="#${id}"]`); if (link) link.hidden = hidden.has(id); });
}

async function loadPortfolio() {
  try {
    const response = await fetch("/api/portfolio", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    renderPortfolio(data.portfolio);
  } catch { /* The static HTML remains a complete fallback. */ }
}

loadPortfolio();

function setChat(open) {
  chat.hidden = !open;
  chatToggle.setAttribute("aria-expanded", String(open));
  if (open) setTimeout(() => input.focus(), 0);
}
chatToggle.addEventListener("click", () => setChat(chat.hidden));
chatClose.addEventListener("click", () => setChat(false));
document.addEventListener("keydown", (event) => { if (event.key === "Escape") { setChat(false); setMenu(false); } });

function appendMessage(role, content, temporary = false, sources = []) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role === "user" ? "user-message" : "assistant-message"}${temporary ? " typing" : ""}`;
  const avatar = document.createElement("span");
  avatar.textContent = role === "user" ? "YOU" : "AI";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  const paragraph = document.createElement("p");
  if (temporary) paragraph.innerHTML = "<span>·</span><span>·</span><span>·</span>";
  else paragraph.textContent = content;
  bubble.append(paragraph);
  const cited = [...new Map((sources || []).filter((source) => /^https:\/\//i.test(source.sourceUrl || "") || source.documentName)
    .map((source) => [source.sourceUrl || source.documentName || source.title, source])).values()];
  if (cited.length) {
    const sourceList = document.createElement("div");
    sourceList.className = "message-sources";
    sourceList.append(document.createTextNode("Sources: "));
    cited.slice(0, 3).forEach((source) => {
      if (/^https:\/\//i.test(source.sourceUrl || "")) {
        const link = document.createElement("a");
        link.href = source.sourceUrl;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = source.title || new URL(source.sourceUrl).hostname;
        sourceList.append(link);
      } else {
        const documentSource = document.createElement("span");
        documentSource.textContent = source.documentName;
        sourceList.append(documentSource);
      }
    });
    bubble.append(sourceList);
  }
  wrapper.append(avatar, bubble);
  messages.append(wrapper);
  messages.scrollTop = messages.scrollHeight;
  return wrapper;
}

async function sendMessage(question) {
  const message = question.trim();
  if (!message || submitButton.disabled) return;
  appendMessage("user", message);
  input.value = "";
  submitButton.disabled = true;
  const typing = appendMessage("assistant", "", true);
  try {
    const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, history, language: currentLanguage }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to answer right now.");
    typing.remove();
    appendMessage("assistant", data.answer, false, data.sources || []);
    history = [...history, { role: "user", content: message }, { role: "assistant", content: data.answer }].slice(-8);
    chatMode = data.mode === "ai" ? "ai" : "local";
    updateModeLabel();
  } catch (error) {
    typing.remove();
    appendMessage("assistant", error.message || interfaceText[currentLanguage].error);
  } finally {
    submitButton.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (event) => { event.preventDefault(); sendMessage(input.value); });
suggestions.addEventListener("click", (event) => { const button = event.target.closest("button"); if (button) sendMessage(button.textContent); });
fetch("/api/health").then((response) => response.json()).then((data) => { chatMode = data.chatMode === "ai" ? "ai" : "local"; updateModeLabel(); }).catch(() => { chatMode = "local"; updateModeLabel(); });

function createNetwork() {
  const canvas = document.querySelector("#network-canvas");
  const context = canvas.getContext("2d");
  const density = .00015;
  const linkDistance = 140;
  const cursorInfluence = 160;
  const cellSize = 90;
  const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
  let width = window.innerWidth;
  let height = window.innerHeight;
  let points = [];
  let frame;
  let hidden = false;
  let lastScrollY = window.scrollY;
  let scrollVelocity = 0;
  const pointer = { x: -9999, y: -9999, active: false };

  function random(min, max) { return Math.random() * (max - min) + min; }
  function makePoint() {
    return { x: Math.random() * width, y: Math.random() * height, vx: random(-.25, .25), vy: random(-.25, .25), radius: random(1.2, 2.2), baseSpeed: random(.15, .35) };
  }
  function cellKey(x, y) { return `${(x / cellSize) | 0},${(y / cellSize) | 0}`; }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.scale(pixelRatio, pixelRatio);
    const target = Math.floor(width * height * density);
    if (target > points.length) {
      for (let index = points.length; index < target; index += 1) points.push(makePoint());
    } else if (target < points.length) points.length = target;
  }

  function draw() {
    if (hidden) return;
    context.clearRect(0, 0, width, height);
    const light = document.documentElement.dataset.theme === "light";
    scrollVelocity *= .9;
    const grid = new Map();

    for (const point of points) {
      if (!reduceMotion) {
        point.vy += scrollVelocity * .0005;
        point.vx *= .995;
        point.vy *= .995;
        point.x += point.vx + point.baseSpeed * .6;
        point.y += point.vy + point.baseSpeed * .2;
      }
      if (point.x > width + 20) point.x = -20;
      else if (point.x < -20) point.x = width + 20;
      if (point.y > height + 20) point.y = -20;
      else if (point.y < -20) point.y = height + 20;

      if (pointer.active && !reduceMotion) {
        const dx = point.x - pointer.x;
        const dy = point.y - pointer.y;
        const distance = Math.hypot(dx, dy);
        if (distance < cursorInfluence) {
          const force = (cursorInfluence - distance) / cursorInfluence;
          point.vx += (dx / distance || 0) * force * .05;
          point.vy += (dy / distance || 0) * force * .05;
        }
      }

      const key = cellKey(point.x, point.y);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(point);
    }

    context.lineWidth = 1;
    for (const [key, bucket] of grid) {
      const [cellX, cellY] = key.split(",").map(Number);
      const neighbors = [];
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
          const neighborKey = `${cellX + offsetX},${cellY + offsetY}`;
          if (grid.has(neighborKey)) neighbors.push(...grid.get(neighborKey));
        }
      }

      for (const point of bucket) {
        let alpha = .6;
        let glowFactor = 0;
        if (pointer.active) {
          const cursorDistance = Math.hypot(point.x - pointer.x, point.y - pointer.y);
          if (cursorDistance < cursorInfluence) {
            alpha = 1 - (cursorDistance / cursorInfluence) * .7;
            glowFactor = 1 - cursorDistance / cursorInfluence;
          }
        }

        if (glowFactor > .05) {
          context.save();
          context.shadowBlur = 12 * glowFactor + 3;
          context.shadowColor = light ? `rgba(30,30,30,${.4 + glowFactor * .5})` : `rgba(255,255,255,${.4 + glowFactor * .5})`;
          context.fillStyle = light ? `rgba(45,45,45,${alpha})` : `rgba(200,200,200,${alpha})`;
          context.beginPath(); context.arc(point.x, point.y, point.radius + glowFactor * .8, 0, Math.PI * 2); context.fill();
          context.restore();
        } else {
          context.fillStyle = light ? `rgba(55,55,55,${alpha})` : `rgba(167,167,167,${alpha})`;
          context.beginPath(); context.arc(point.x, point.y, point.radius, 0, Math.PI * 2); context.fill();
        }

        for (const other of neighbors) {
          if (point === other) continue;
          const dx = point.x - other.x;
          const dy = point.y - other.y;
          const distanceSquared = dx * dx + dy * dy;
          if (distanceSquared >= linkDistance * linkDistance) continue;
          const distance = Math.sqrt(distanceSquared);
          let opacity = 1 - distance / linkDistance;
          let lineGlow = 0;
          if (pointer.active) {
            const middleX = (point.x + other.x) / 2;
            const middleY = (point.y + other.y) / 2;
            const cursorDistance = Math.hypot(middleX - pointer.x, middleY - pointer.y);
            if (cursorDistance < cursorInfluence) {
              const boost = .4 * (1 - cursorDistance / cursorInfluence);
              opacity = Math.min(1, opacity + boost);
              lineGlow = 1 - cursorDistance / cursorInfluence;
            }
          }

          context.strokeStyle = light ? `rgba(55,55,55,${opacity * .5})` : `rgba(167,167,167,${opacity * .5})`;
          if (lineGlow > .05) {
            context.save();
            context.shadowBlur = 18 * lineGlow + 2;
            context.shadowColor = light ? `rgba(25,25,25,${.25 + lineGlow * .45})` : `rgba(255,255,255,${.25 + lineGlow * .45})`;
            context.lineWidth = 1.2 + lineGlow * .6;
            context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(other.x, other.y); context.stroke();
            context.restore();
          } else {
            context.beginPath(); context.moveTo(point.x, point.y); context.lineTo(other.x, other.y); context.stroke();
          }
        }
      }
    }

    if (!reduceMotion) frame = requestAnimationFrame(draw);
  }

  function updatePointer(event) {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.active = true;
  }

  resize();
  draw();
  window.addEventListener("resize", () => { resize(); if (reduceMotion) draw(); }, { passive: true });
  window.addEventListener("pointermove", updatePointer, { passive: true });
  window.addEventListener("pointerleave", () => { pointer.active = false; }, { passive: true });
  window.addEventListener("touchend", () => { pointer.active = false; }, { passive: true });
  window.addEventListener("blur", () => { pointer.active = false; });
  window.addEventListener("scroll", () => {
    const currentScrollY = window.scrollY;
    scrollVelocity = currentScrollY - lastScrollY;
    lastScrollY = currentScrollY;
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    hidden = document.hidden;
    if (hidden) cancelAnimationFrame(frame);
    else if (!reduceMotion) frame = requestAnimationFrame(draw);
  });
}

createNetwork();
