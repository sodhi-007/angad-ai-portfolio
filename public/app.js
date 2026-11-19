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
  aboutTitle: "Je conçois et j’évalue des systèmes d’IA pour la production.",
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
  projectWebsite: "Ouvrir le site",
  projectsTitle: "Projets sélectionnés de mon CV coop.",
  projectsDescription: "Projets universitaires en chaîne de blocs, ingénierie dorsale et logiciels quantitatifs. D’autres travaux sont disponibles sur <a href=\"https://github.com/sodhi-007\" target=\"_blank\" rel=\"noopener noreferrer\">GitHub</a>.",
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

// French versions of the text that renderPortfolio() pulls from data/portfolio.json.
// Keys must match the English text in the JSON exactly; anything missing falls back to English.
const frenchContent = new Map([
  ["Artificial Intelligence Intern", "Stagiaire en intelligence artificielle"],
  ["Deputy Manager, Cybersecurity", "Gestionnaire adjoint, cybersécurité"],
  ["Intern", "Stagiaire"],
  ["Angad shipped a bilingual English/French RAG agent for the internal sales network, used by 700+ employees and cutting manual document search time by 60%.", "Angad a livré un agent RAG bilingue anglais-français pour le réseau de vente interne, utilisé par plus de 700 employés, réduisant de 60 % le temps de recherche manuelle de documents."],
  ["He built ingestion and retrieval over 10,000+ pages using MinerU OCR, OpenAI embeddings, ChromaDB, and Azure Container Apps Jobs, with sub-3-second retrieval on 95% of queries.", "Il a construit l’ingestion et la recherche sur plus de 10 000 pages avec MinerU OCR, les embeddings OpenAI, ChromaDB et Azure Container Apps Jobs, avec une recherche en moins de 3 secondes pour 95 % des requêtes."],
  ["He fine-tuned a DistilBERT query router from Datadog logs, served it with FastAPI, and managed its MLOps lifecycle in ClearML.", "Il a affiné un routeur de requêtes DistilBERT à partir des journaux Datadog, l’a servi avec FastAPI et a géré son cycle de vie MLOps dans ClearML."],
  ["He deployed Open WebUI with LiteLLM, Redis, and Azure Container Apps for 50+ concurrent users with zero downtime over four months.", "Il a déployé Open WebUI avec LiteLLM, Redis et Azure Container Apps pour plus de 50 utilisateurs simultanés, sans aucune interruption pendant quatre mois."],
  ["He built an LLM-as-judge evaluation harness, prototyped AWS Strands agents, and created 10+ reusable Claude skills adopted team-wide.", "Il a conçu un banc d’évaluation LLM-as-judge, prototypé des agents AWS Strands et créé plus de 10 compétences Claude réutilisables adoptées par toute l’équipe."],
  ["Angad led vulnerability management for 40,000+ servers and mitigated 10,000+ exploitable vulnerabilities.", "Angad a dirigé la gestion des vulnérabilités de plus de 40 000 serveurs et atténué plus de 10 000 vulnérabilités exploitables."],
  ["He ran quarterly assessments across 100,000+ devices at 99%+ compliance.", "Il a mené des évaluations trimestrielles sur plus de 100 000 appareils avec une conformité supérieure à 99 %."],
  ["He authored 30+ CIS-based security policies and reduced zero-day threat exposure by 70% using virtual patching.", "Il a rédigé plus de 30 politiques de sécurité fondées sur CIS et réduit de 70 % l’exposition aux menaces zero-day grâce aux correctifs virtuels."],
  ["Angad built a five-service e-commerce platform in Java, Spring Boot, and Spring MVC.", "Angad a créé une plateforme de commerce électronique de cinq services avec Java, Spring Boot et Spring MVC."],
  ["He containerized services with Docker and automated CI/CD through Jenkins and Maven.", "Il a conteneurisé les services avec Docker et automatisé l’intégration et la livraison continues avec Jenkins et Maven."],
  ["He connected REST services with Spring Cloud, MySQL, MongoDB, and Spring Security.", "Il a relié les services REST avec Spring Cloud, MySQL, MongoDB et Spring Security."],
  ["University Information Hub", "Portail d’information universitaire"],
  ["Developed and deployed a Django information system that helps university students stay current with activities.", "Conception et déploiement d’un système d’information Django qui tient les étudiants au courant des activités universitaires."],
  ["Quantitative Portfolio Manager", "Gestionnaire quantitatif de portefeuille"],
  ["Designed a Python portfolio manager based on a high quantitative momentum investing strategy.", "Conception d’un gestionnaire de portefeuille en Python fondé sur une stratégie d’investissement quantitative à momentum élevé."],
  ["Blockchain Crowdfunding", "Financement participatif sur chaîne de blocs"],
  ["Built a decentralized crowdfunding platform and deployed Solidity-based smart contracts.", "Création d’une plateforme décentralisée de financement participatif et déploiement de contrats intelligents Solidity."],
  ["Angad AI Portfolio", "Portfolio Angad AI"],
  ["I built this portfolio with a chatbot that answers questions about my work using curated sources, and an owner portal for updating the site and its knowledge library.", "J’ai construit ce portfolio avec un robot conversationnel qui répond aux questions sur mon travail à partir de sources choisies, ainsi qu’un portail pour mettre à jour le site et sa bibliothèque de connaissances."],
  ["Project", "Projet"],
  ["Backend engineering", "Ingénierie dorsale"],
  ["Database management", "Gestion de bases de données"],
  ["Deployment", "Déploiement"],
  ["Financial modelling", "Modélisation financière"],
  ["Data analysis", "Analyse de données"],
  ["Smart contracts", "Contrats intelligents"],
  ["Blockchain", "Chaîne de blocs"],
  ["AI and LLM", "IA et LLM"],
  ["MLOps and cloud", "MLOps et infonuagique"],
  ["Programming", "Programmation"],
  ["Security", "Sécurité"],
  ["Agentic and multi-agent systems", "Systèmes agentiques et multi-agents"],
  ["DistilBERT fine-tuning", "Affinage de DistilBERT"],
  ["OpenAI embeddings", "Embeddings OpenAI"],
  ["REST APIs", "API REST"],
  ["CIS benchmarks", "Référentiels CIS"],
  ["Concordia University", "Université Concordia"],
  ["Master of Engineering, Software Engineering (Co-op)", "Maîtrise en ingénierie, génie logiciel (coop)"],
  ["Bachelor of Technology, Computer Science", "Baccalauréat en technologie, informatique"],
  ["CGPA 3.47 / 4.30", "Moyenne 3,47 / 4,30"],
  ["CGPA 7.87 / 10", "Moyenne 7,87 / 10"],
  ["Certified", "Certifié"]
]);

const frenchMonths = { January: "janvier", February: "février", March: "mars", April: "avril", May: "mai", June: "juin", July: "juillet", August: "août", September: "septembre", October: "octobre", November: "novembre", December: "décembre" };

function toFrench(text) {
  const value = String(text ?? "");
  if (frenchContent.has(value)) return frenchContent.get(value);
  return value
    .replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\b/g, (month) => frenchMonths[month])
    .replace(/\(expected\)/g, "(prévu)");
}

// Renders English text now and registers its French version for setLanguage().
const bilingualText = new WeakMap();
function setBilingual(element, english, frenchText = toFrench(english)) {
  bilingualText.set(element, { en: english, fr: frenchText });
  element.dataset.i18nPair = "";
  element.textContent = currentLanguage === "fr" ? frenchText : english;
  return element;
}

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
  document.querySelectorAll("[data-i18n-pair]").forEach((element) => {
    const pair = bilingualText.get(element);
    if (pair) element.textContent = currentLanguage === "fr" ? pair.fr : pair.en;
  });
  document.querySelectorAll("[data-language]").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.language === currentLanguage)));
  const labels = interfaceText[currentLanguage];
  menu.setAttribute("aria-label", currentLanguage === "fr" ? "Navigation principale" : "Main navigation");
  menuButton.setAttribute("aria-label", menu.hidden ? labels.menuOpen : labels.menuClose);
  themeButton.setAttribute("aria-label", labels.theme);
  chatClose.setAttribute("aria-label", labels.chatClose);
  chat.setAttribute("aria-label", labels.chatLabel);
  document.title = currentLanguage === "fr" ? "Angad Singh Sodhi · Ingénieur en IA appliquée" : "Angad Singh Sodhi · Applied AI Engineer";
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

// Picks the card graphic from the project's main technology so it always matches the project.
function projectVisual(item) {
  const tech = String(item.stack?.[0] || "").toLowerCase();
  const visual = makeElement("div", "project-visual");
  visual.setAttribute("aria-hidden", "true");
  if (tech === "django") {
    visual.classList.add("visual-hub");
    visual.append(makeElement("b", "", "django"), makeElement("i"));
  } else if (["python", "jupyter", "data analysis"].includes(tech)) {
    visual.classList.add("visual-chart");
    for (let count = 0; count < 5; count += 1) visual.append(makeElement("i"));
  } else if (["solidity", "blockchain", "smart contracts"].includes(tech)) {
    visual.classList.add("visual-crowd");
    visual.append(makeElement("b", "", "◎"), makeElement("span", "", "ETH"));
  } else if (["rag", "llm", "ai"].includes(tech)) {
    visual.classList.add("visual-hub");
    visual.append(makeElement("b", "", "Angad AI"), makeElement("i"));
  } else {
    visual.classList.add("visual-chain");
    for (let count = 0; count < 3; count += 1) visual.append(makeElement("i"));
  }
  return visual;
}

function projectLink(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  let url;
  try { url = new URL(value, document.baseURI); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const label = "Open website";
  const link = makeElement("a", "project-link", currentLanguage === "fr" ? french.projectWebsite : label);
  link.href = url.href;
  link.dataset.i18n = "projectWebsite";
  textOriginals.set(link, label);
  return link;
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
    side.append(setBilingual(makeElement("span"), item.dates || ""), makeElement("h3", "", item.organization || ""), setBilingual(makeElement("p"), item.role || ""));
    const body = makeElement("div", "experience-body");
    const highlights = item.highlights || [];
    if (highlights[0]) body.append(setBilingual(makeElement("p"), highlights[0]));
    const list = makeElement("ul");
    highlights.slice(1).forEach((highlight) => list.append(setBilingual(makeElement("li"), highlight)));
    body.append(list); article.append(side, body); experienceList.append(article);
  });

  const projectGrid = document.querySelector(".project-grid");
  projectGrid.replaceChildren();
  (data.projects || []).forEach((item, index) => {
    const article = makeElement("article", "project-card reveal visible");
    const content = makeElement("div", "project-content");
    const number = String(index + 1).padStart(2, "0");
    const tech = item.stack?.[0] || "Project";
    const stack = item.stack || [];
    content.append(
      setBilingual(makeElement("span"), `${number} · ${tech}`, `${number} · ${toFrench(tech)}`),
      setBilingual(makeElement("h3"), item.name || ""),
      setBilingual(makeElement("p"), item.description || ""),
      setBilingual(makeElement("small"), stack.join(" · "), stack.map(toFrench).join(" · "))
    );
    const link = projectLink(item.url);
    if (link) content.append(link);
    article.append(projectVisual(item), content); projectGrid.append(article);
  });

  const skillLines = document.querySelector(".skill-lines");
  skillLines.replaceChildren();
  Object.entries(data.skills || {}).forEach(([category, values]) => {
    const row = makeElement("p");
    row.append(setBilingual(makeElement("b"), category), setBilingual(makeElement("span"), values.join(" · "), values.map(toFrench).join(" · ")));
    skillLines.append(row);
  });

  const educationList = document.querySelector(".education-list");
  educationList.replaceChildren();
  (data.education || []).forEach((item) => {
    const article = makeElement("article"); const details = makeElement("div");
    const program = item.program || "";
    const grade = item.grade || "";
    details.append(
      setBilingual(makeElement("h3"), item.institution || ""),
      setBilingual(makeElement("p"), `${program}${grade ? ` · ${grade}` : ""}`, `${toFrench(program)}${grade ? ` · ${toFrench(grade)}` : ""}`)
    );
    article.append(setBilingual(makeElement("span"), item.dates || ""), details); educationList.append(article);
  });
  if ((data.certifications || []).length) {
    const article = makeElement("article"); const details = makeElement("div");
    details.append(makeElement("h3", "", "Certifications"), setBilingual(makeElement("p"), data.certifications.join(" · "), data.certifications.map(toFrench).join(" · ")));
    article.append(setBilingual(makeElement("span"), "Certified"), details); educationList.append(article);
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

function chatDisplayText(text) {
  return String(text ?? "").replace(/[ \t]*\u2014[ \t]*/g, " – ");
}

function renderMarkdownLinks(text) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return `<a href="${trimmed}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    if (/^mailto:/i.test(trimmed)) return `<a href="${trimmed}">${label}</a>`;
    return match;
  });
}

function appendMessage(role, content, temporary = false, sources = []) {
  const wrapper = document.createElement("div");
  wrapper.className = `message ${role === "user" ? "user-message" : "assistant-message"}${temporary ? " typing" : ""}`;
  const avatar = document.createElement("span");
  avatar.textContent = role === "user" ? "YOU" : "AI";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  const paragraph = document.createElement("p");
  if (temporary) paragraph.innerHTML = "<span>·</span><span>·</span><span>·</span>";
  else if (role === "assistant") paragraph.innerHTML = renderMarkdownLinks(chatDisplayText(content));
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
        link.textContent = chatDisplayText(source.title || new URL(source.sourceUrl).hostname);
        sourceList.append(link);
      } else {
        const documentSource = document.createElement("span");
        documentSource.textContent = chatDisplayText(source.documentName);
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
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      typing.remove();
      const wrapper = appendMessage("assistant", "");
      const paragraph = wrapper.querySelector(".message-bubble p");
      let fullText = "";
      let sources = [];
      let mode = "ai";
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            if (parsed.error) {
              throw new Error(parsed.error);
            } else if (parsed.token) {
              fullText += parsed.token;
              paragraph.innerHTML = renderMarkdownLinks(chatDisplayText(fullText));
              messages.scrollTop = messages.scrollHeight;
            } else if (parsed.sources) {
              sources = parsed.sources;
              mode = parsed.mode || "ai";
            }
          } catch { /* skip malformed lines */ }
        }
      }
      const cited = [...new Map((sources || []).filter((s) => /^https:\/\//i.test(s.sourceUrl || "") || s.documentName)
        .map((s) => [s.sourceUrl || s.documentName || s.title, s])).values()];
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
            link.textContent = chatDisplayText(source.title || new URL(source.sourceUrl).hostname);
            sourceList.append(link);
          } else {
            const span = document.createElement("span");
            span.textContent = chatDisplayText(source.documentName);
            sourceList.append(span);
          }
        });
        wrapper.querySelector(".message-bubble").append(sourceList);
      }
      history = [...history, { role: "user", content: message }, { role: "assistant", content: fullText }].slice(-8);
      chatMode = mode === "ai" ? "ai" : "local";
      updateModeLabel();
    } else {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to answer right now.");
      typing.remove();
      appendMessage("assistant", data.answer, false, data.sources || []);
      history = [...history, { role: "user", content: message }, { role: "assistant", content: data.answer }].slice(-8);
      chatMode = data.mode === "ai" ? "ai" : "local";
      updateModeLabel();
    }
  } catch (error) {
    typing.remove();
    appendMessage("assistant", error.message || interfaceText[currentLanguage].error);
  } finally {
    submitButton.disabled = false;
    input.focus();
  }
}

form.addEventListener("submit", (event) => { event.preventDefault(); sendMessage(input.value); });
suggestions.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || submitButton.disabled) return;
  sendMessage(button.textContent);
  // A used suggestion would just repeat the same answer, so retire it.
  button.hidden = true;
  if (![...suggestions.querySelectorAll("button")].some((chip) => !chip.hidden)) suggestions.hidden = true;
});
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
