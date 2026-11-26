const loginView = document.querySelector("[data-login]");
const studio = document.querySelector("[data-studio]");
const saveButton = document.querySelector("[data-save]");
const saveBottom = document.querySelector("[data-save-bottom]");
const saveBar = document.querySelector("[data-save-bar]");
const saveMessage = document.querySelector("[data-save-message]");
const logoutButton = document.querySelector("[data-logout]");
let portfolio;
let skillsDraft = [];
let knowledge = [];
let dirty = false;

const evalMetrics = [
  ["context_precision", "Context precision"],
  ["context_recall", "Context recall"],
  ["faithfulness", "Faithfulness"],
  ["answer_relevancy", "Answer relevancy"]
];
const evalScoreFormat = new Intl.NumberFormat(undefined, { style: "percent", maximumFractionDigits: 1 });
const evalRefresh = document.querySelector("[data-eval-refresh]");
const evalForm = document.querySelector("[data-eval-import]");
const evalImport = evalForm.querySelector("button");
const evalStatus = document.querySelector("[data-eval-status]");

function setDirty(value = true, message = "Unsaved changes") {
  dirty = value;
  saveBar.hidden = !value;
  saveMessage.textContent = message;
}

function request(path, options = {}) {
  return fetch(path, { ...options, headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) } })
    .then(async (response) => {
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw Object.assign(new Error(data.error || "Request failed."), { status: response.status });
      return data;
    });
}

function setEvalStatus(message, isError = false) {
  evalStatus.textContent = message;
  evalStatus.toggleAttribute("data-error", isError);
}

function renderEvalReport({ report, source, warning }, message) {
  const run = document.querySelector("[data-eval-run]");
  const results = document.querySelector("[data-eval-results]");
  results.hidden = !report;
  if (!report) {
    run.textContent = "Scores from the latest completed Evidently judge run.";
    setEvalStatus(warning || "No report yet. Run the RAG evaluation workflow or import dashboard.json.", Boolean(warning));
    return;
  }

  const date = new Date(report.judgedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  run.textContent = [
    `${report.cases.length} questions`,
    [report.provider, report.model].filter(Boolean).join("/"),
    report.chatMode && `${report.chatMode} mode`,
    report.commit && `Commit ${report.commit.slice(0, 7)}`,
    report.referencePdf,
    date,
    { local: "Local report", imported: "Imported report", automation: "GitHub Actions" }[source]
  ].filter(Boolean).join(" · ");

  const formatScore = (score) => score === null ? "—" : evalScoreFormat.format(score);
  const cards = evalMetrics.map(([key, label]) => {
    const { mean, scoredCases } = report.averages[key];
    const card = document.createElement("article");
    const heading = document.createElement("span");
    heading.textContent = label;
    const score = document.createElement("strong");
    score.textContent = formatScore(mean);
    const coverage = document.createElement("small");
    coverage.textContent = `${scoredCases}/${report.cases.length} scored`;
    card.append(heading, score, coverage);
    return card;
  });
  document.querySelector("[data-eval-metrics]").replaceChildren(...cards);

  const rows = report.cases.map(({ question, scores }) => {
    const row = document.createElement("tr");
    const name = document.createElement("th");
    name.scope = "row";
    name.textContent = question;
    row.append(name);
    for (const [key] of evalMetrics) {
      const cell = row.insertCell();
      cell.textContent = formatScore(scores[key]);
    }
    return row;
  });
  document.querySelector("[data-eval-cases]").replaceChildren(...rows);
  setEvalStatus(warning || message, Boolean(warning));
}

async function loadEvalReport(message = "") {
  evalRefresh.disabled = true;
  evalImport.disabled = true;
  setEvalStatus("Loading report…");
  try {
    renderEvalReport(await request("/api/admin/rag-eval", { cache: "no-store" }), message);
  } catch (error) {
    setEvalStatus(error.message, true);
  } finally {
    evalRefresh.disabled = false;
    evalImport.disabled = false;
  }
}

evalRefresh.addEventListener("click", () => loadEvalReport());
evalForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = new FormData(evalForm).get("report");
  if (!(file instanceof File) || !file.size) return;
  if (file.size > 256_000) {
    setEvalStatus("Choose a dashboard.json file smaller than 256 KB.", true);
    return;
  }
  evalRefresh.disabled = true;
  evalImport.disabled = true;
  setEvalStatus("Importing report…");
  try {
    await request("/api/admin/rag-eval", {
      method: "PUT",
      headers: { "X-Admin-Request": "1" },
      body: await file.text()
    });
    evalForm.reset();
    await loadEvalReport("Report imported.");
  } catch (error) {
    setEvalStatus(error.message, true);
  } finally {
    evalRefresh.disabled = false;
    evalImport.disabled = false;
  }
});

function field(label, value, onInput, options = {}) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const control = options.textarea ? document.createElement("textarea") : document.createElement("input");
  if (options.textarea) control.rows = options.rows || 4;
  else control.type = options.type || "text";
  control.value = value || "";
  control.addEventListener("input", () => { onInput(control.value); setDirty(); });
  wrapper.append(control);
  if (options.wide) wrapper.classList.add("wide");
  return wrapper;
}

function removeButton(onRemove) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "remove";
  button.textContent = "Remove";
  button.addEventListener("click", () => { onRemove(); setDirty(); renderRepeaters(); });
  return button;
}

function card(title) {
  const article = document.createElement("article");
  article.className = "editor-card";
  const heading = document.createElement("h3");
  heading.textContent = title;
  article.append(heading);
  return article;
}

function selectField(label, value, options, onChange) {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const select = document.createElement("select");
  options.forEach(([optionValue, optionLabel]) => {
    const option = document.createElement("option");
    option.value = optionValue;
    option.textContent = optionLabel;
    option.selected = optionValue === value;
    select.append(option);
  });
  select.addEventListener("change", () => { onChange(select.value); setDirty(); });
  wrapper.append(select);
  return wrapper;
}

function renderKnowledge() {
  const container = document.querySelector('[data-repeater="knowledge"]');
  container.replaceChildren();
  knowledge.forEach((item, index) => {
    const article = card(item.title || `Knowledge note ${index + 1}`);
    article.classList.add("knowledge-card");

    const sourceBadge = document.createElement("span");
    const sourceLabels = { web: "WEB SOURCE", document: "UPLOADED DOCUMENT", manual: "MANUAL NOTE" };
    sourceBadge.className = `source-badge ${item.sourceType || "manual"}`;
    sourceBadge.textContent = sourceLabels[item.sourceType] || sourceLabels.manual;
    article.querySelector("h3").after(sourceBadge);

    const remove = removeButton(() => knowledge.splice(index, 1));
    remove.addEventListener("click", renderKnowledge);
    article.append(remove);

    const grid = document.createElement("div");
    grid.className = "field-grid";
    grid.append(
      field("Title", item.title, (value) => { item.title = value; article.querySelector("h3").textContent = value || `Knowledge note ${index + 1}`; }),
      field("Category", item.category, (value) => { item.category = value; }),
      field("Content", item.content, (value) => { item.content = value; }, { textarea: true, rows: 8, wide: true })
    );
    if (item.sourceType === "document" && item.document) {
      const details = document.createElement("div");
      details.className = "document-details wide";
      const size = item.document.size < 1_000_000 ? `${Math.round(item.document.size / 1_000)} KB` : `${(item.document.size / 1_000_000).toFixed(1)} MB`;
      details.textContent = `${item.document.name} · ${size}${item.document.pageCount ? ` · ${item.document.pageCount} pages` : ""}`;
      grid.append(details);
    } else {
      grid.append(field("Source URL", item.sourceUrl, (value) => { item.sourceUrl = value; item.sourceType = value ? "web" : "manual"; }, { type: "url", wide: true }));
    }
    grid.append(
      field("Tags · comma separated", (item.tags || []).join(", "), (value) => { item.tags = value.split(",").map((tag) => tag.trim()).filter(Boolean); }),
      selectField("Visibility", item.visibility || "assistant_only", [["assistant_only", "Assistant only"], ["public", "Public"], ["private", "Private (excluded from retrieval)"]], (value) => { item.visibility = value; })
    );

    const enabled = document.createElement("label");
    enabled.className = "toggle-field wide";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = item.enabled !== false;
    checkbox.addEventListener("change", () => { item.enabled = checkbox.checked; setDirty(); });
    enabled.append(checkbox, document.createTextNode("Use this entry in chatbot retrieval"));
    grid.append(enabled);
    article.append(grid);
    container.append(article);
  });
}

function renderExperience() {
  const container = document.querySelector('[data-repeater="experience"]');
  container.replaceChildren();
  portfolio.experience.forEach((item, index) => {
    const article = card(item.organization || `Role ${index + 1}`);
    article.append(removeButton(() => portfolio.experience.splice(index, 1)));
    const grid = document.createElement("div");
    grid.className = "field-grid";
    grid.append(
      field("Organization", item.organization, (value) => { item.organization = value; article.querySelector("h3").textContent = value || `Role ${index + 1}`; }),
      field("Role", item.role, (value) => { item.role = value; }), field("Location", item.location, (value) => { item.location = value; }),
      field("Dates", item.dates, (value) => { item.dates = value; }),
      field("Highlights · one per line", (item.highlights || []).join("\n"), (value) => { item.highlights = value.split("\n").map((line) => line.trim()).filter(Boolean); }, { textarea: true, rows: 7, wide: true })
    );
    article.append(grid); container.append(article);
  });
}

function renderProjects() {
  const container = document.querySelector('[data-repeater="projects"]');
  container.replaceChildren();
  portfolio.projects.forEach((item, index) => {
    const article = card(item.name || `Project ${index + 1}`);
    article.append(removeButton(() => portfolio.projects.splice(index, 1)));
    const grid = document.createElement("div"); grid.className = "field-grid";
    grid.append(field("Project name", item.name, (value) => { item.name = value; article.querySelector("h3").textContent = value || `Project ${index + 1}`; }),
      field("Dates", item.dates, (value) => { item.dates = value; }),
      field("Description", item.description, (value) => { item.description = value; }, { textarea: true, rows: 4, wide: true }),
      field("Website link (optional)", item.url, (value) => { item.url = value.trim(); }, { wide: true }),
      field("Technologies · comma separated", (item.stack || []).join(", "), (value) => { item.stack = value.split(",").map((part) => part.trim()).filter(Boolean); }, { wide: true }));
    article.append(grid); container.append(article);
  });
}

function renderSkills() {
  const container = document.querySelector('[data-repeater="skills"]');
  container.replaceChildren();
  skillsDraft.forEach((item, index) => {
    const article = card(item.name || `Category ${index + 1}`);
    article.append(removeButton(() => skillsDraft.splice(index, 1)));
    const grid = document.createElement("div"); grid.className = "field-grid";
    grid.append(field("Category", item.name, (value) => { item.name = value; article.querySelector("h3").textContent = value || `Category ${index + 1}`; }),
      field("Skills · comma separated", item.values.join(", "), (value) => { item.values = value.split(",").map((part) => part.trim()).filter(Boolean); }, { wide: true }));
    article.append(grid); container.append(article);
  });
}

function renderEducation() {
  const container = document.querySelector('[data-repeater="education"]');
  container.replaceChildren();
  portfolio.education.forEach((item, index) => {
    const article = card(item.institution || `Education ${index + 1}`);
    article.append(removeButton(() => portfolio.education.splice(index, 1)));
    const grid = document.createElement("div"); grid.className = "field-grid";
    grid.append(field("Institution", item.institution, (value) => { item.institution = value; article.querySelector("h3").textContent = value || `Education ${index + 1}`; }),
      field("Program", item.program, (value) => { item.program = value; }), field("Location", item.location, (value) => { item.location = value; }),
      field("Dates", item.dates, (value) => { item.dates = value; }), field("Grade", item.grade, (value) => { item.grade = value; }, { wide: true }));
    article.append(grid); container.append(article);
  });
}

function renderRepeaters() { renderExperience(); renderProjects(); renderSkills(); renderEducation(); renderKnowledge(); }

function renderSectionOrder() {
  const container = document.querySelector("[data-section-order]");
  container.replaceChildren();
  const hidden = new Set(portfolio.site.hiddenSections || []);
  portfolio.site.sectionOrder.forEach((section, index) => {
    const row = document.createElement("div"); row.className = "section-row";
    const name = document.createElement("strong"); name.textContent = section;
    const visibility = document.createElement("label"); const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = !hidden.has(section);
    checkbox.addEventListener("change", () => { checkbox.checked ? hidden.delete(section) : hidden.add(section); portfolio.site.hiddenSections = [...hidden]; setDirty(); });
    visibility.append(checkbox, document.createTextNode("Visible"));
    const controls = document.createElement("div"); controls.className = "move-buttons";
    [["↑", -1], ["↓", 1]].forEach(([symbol, offset]) => { const button = document.createElement("button"); button.type = "button"; button.textContent = symbol; button.disabled = index + offset < 0 || index + offset >= portfolio.site.sectionOrder.length; button.addEventListener("click", () => { const target = index + offset; [portfolio.site.sectionOrder[index], portfolio.site.sectionOrder[target]] = [portfolio.site.sectionOrder[target], portfolio.site.sectionOrder[index]]; setDirty(); renderSectionOrder(); }); controls.append(button); });
    row.append(name, visibility, controls); container.append(row);
  });
}

function bindSimpleFields() {
  document.querySelectorAll("[data-identity-field]").forEach((control) => { control.value = portfolio.identity[control.dataset.identityField] || ""; control.oninput = () => { portfolio.identity[control.dataset.identityField] = control.value; setDirty(); }; });
  document.querySelectorAll("[data-contact-field]").forEach((control) => { control.value = portfolio.contact[control.dataset.contactField] || ""; control.oninput = () => { portfolio.contact[control.dataset.contactField] = control.value; setDirty(); }; });
  document.querySelectorAll("[data-site-field]").forEach((control) => { control.value = portfolio.site[control.dataset.siteField] || (control.type === "color" ? "#9fdc72" : "compact"); control.oninput = () => { portfolio.site[control.dataset.siteField] = control.value; setDirty(); }; });
  document.querySelectorAll("[data-list-field]").forEach((control) => { control.value = (portfolio[control.dataset.listField] || []).join("\n"); control.oninput = () => { portfolio[control.dataset.listField] = control.value.split("\n").map((line) => line.trim()).filter(Boolean); setDirty(); }; });
  document.querySelector("[data-profile-preview]").src = portfolio.site.profileImage || "/profile.jpg";
}

function mount(data) {
  portfolio = data.portfolio;
  knowledge = data.knowledge || [];
  portfolio.site ||= { profileImage: "/profile.jpg", accent: "#9fdc72", layout: "compact", sectionOrder: ["about", "experience", "projects", "skills", "education", "contact"], hiddenSections: [] };
  skillsDraft = Object.entries(portfolio.skills || {}).map(([name, values]) => ({ name, values: [...values] }));
  document.querySelector("[data-rag-mode]").textContent = data.rag.mode === "embeddings" ? `Embeddings · ${data.rag.model}` : "Local ranked retrieval";
  document.querySelector("[data-rag-chunks]").textContent = data.rag.chunks;
  document.querySelector("[data-db-status]").textContent = data.storage?.connected ? `${data.storage.driver} · connected` : "Unavailable";
  document.querySelector("[data-ai-mode]").textContent = data.rag.mode === "embeddings" ? "OpenAI + evidence" : "No-key evidence mode";
  loginView.hidden = true; studio.hidden = false; saveButton.hidden = false; logoutButton.hidden = Boolean(data.localAccess);
  bindSimpleFields(); renderSectionOrder(); renderRepeaters(); setDirty(false);
}

async function loadStudio() {
  try {
    mount(await request("/api/admin/state"));
    void loadEvalReport();
  }
  catch (error) { if (error.status === 401) loginView.hidden = false; else { loginView.hidden = false; document.querySelector("[data-login-message]").textContent = error.message; } }
}

document.querySelector("[data-login-form]").addEventListener("submit", async (event) => {
  event.preventDefault(); const message = document.querySelector("[data-login-message]"); message.textContent = "Signing in…";
  try { await request("/api/admin/login", { method: "POST", body: JSON.stringify({ password: new FormData(event.currentTarget).get("password") }) }); message.textContent = ""; await loadStudio(); }
  catch (error) { message.textContent = error.message; }
});

document.querySelectorAll("[data-add]").forEach((button) => button.addEventListener("click", () => {
  const type = button.dataset.add;
  if (type === "experience") portfolio.experience.push({ organization: "New organization", role: "Role", location: "", dates: "", highlights: [] });
  if (type === "projects") portfolio.projects.push({ name: "New project", dates: "", description: "", stack: [] });
  if (type === "education") portfolio.education.push({ institution: "New institution", program: "", location: "", dates: "", grade: "" });
  if (type === "skills") skillsDraft.push({ name: "New category", values: [] });
  if (type === "knowledge") knowledge.push({ title: "New knowledge note", category: "General", content: "", sourceType: "manual", sourceUrl: "", tags: [], visibility: "assistant_only", enabled: true });
  setDirty(); renderRepeaters();
}));

async function save() {
  portfolio.skills = Object.fromEntries(skillsDraft.filter((item) => item.name.trim()).map((item) => [item.name.trim(), item.values]));
  saveButton.disabled = true; saveBottom.disabled = true; saveMessage.textContent = "Saving and rebuilding retrieval index…";
  try {
    const portfolioData = await request("/api/admin/portfolio", { method: "PUT", headers: { "X-Admin-Request": "1" }, body: JSON.stringify({ portfolio }) });
    portfolio = portfolioData.portfolio;
    const knowledgeData = await request("/api/admin/knowledge", { method: "PUT", headers: { "X-Admin-Request": "1" }, body: JSON.stringify({ items: knowledge }) });
    knowledge = knowledgeData.knowledge;
    document.querySelector("[data-rag-chunks]").textContent = knowledgeData.rag.chunks;
    renderKnowledge();
    setDirty(false);
    saveMessage.textContent = "Saved";
  }
  catch (error) { setDirty(true, error.message); }
  finally { saveButton.disabled = false; saveBottom.disabled = false; }
}
saveButton.addEventListener("click", save); saveBottom.addEventListener("click", save);

logoutButton.addEventListener("click", async () => { await request("/api/admin/logout", { method: "POST", headers: { "X-Admin-Request": "1" }, body: "{}" }); location.reload(); });

async function imageDataUrl(file) {
  const bitmap = await createImageBitmap(file); const max = 1200; const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas"); canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", .88));
  return await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });
}

document.querySelector("[data-profile-file]").addEventListener("change", async (event) => {
  const file = event.target.files[0]; if (!file) return; const preview = document.querySelector("[data-profile-preview]");
  try { saveMessage.textContent = "Preparing portrait…"; saveBar.hidden = false; const dataUrl = await imageDataUrl(file); preview.src = dataUrl; const data = await request("/api/admin/profile", { method: "POST", headers: { "X-Admin-Request": "1" }, body: JSON.stringify({ dataUrl }) }); portfolio.site.profileImage = data.profileImage; preview.src = data.profileImage; setDirty(false); saveMessage.textContent = "Portrait updated and index rebuilt"; setTimeout(() => { if (!dirty) saveBar.hidden = true; }, 1800); }
  catch (error) { setDirty(true, error.message); }
});

async function fileBase64(file) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

document.querySelector("[data-document-upload]").addEventListener("submit", async (event) => {
  event.preventDefault();
  // event.currentTarget is null once the handler awaits, so keep a reference to the form.
  const form = event.currentTarget;
  const formData = new FormData(form);
  const file = formData.get("document");
  const message = document.querySelector("[data-upload-message]");
  const submit = form.querySelector('button[type="submit"]');
  if (!(file instanceof File) || !file.size) return;
  if (file.size > 8_000_000) { message.textContent = "Documents must be smaller than 8 MB."; return; }
  submit.disabled = true;
  message.textContent = "Extracting text and indexing the document…";
  try {
    const data = await request("/api/admin/knowledge/upload", {
      method: "POST",
      headers: { "X-Admin-Request": "1" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        base64: await fileBase64(file),
        title: formData.get("title"),
        category: formData.get("category"),
        tags: String(formData.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean),
        visibility: formData.get("visibility")
      })
    });
    knowledge = data.knowledge;
    document.querySelector("[data-rag-chunks]").textContent = data.rag.chunks;
    renderKnowledge();
    form.reset();
    form.elements.category.value = "Documents";
    message.textContent = `Uploaded “${data.item.document.name}” and added ${data.item.title} to retrieval.`;
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

document.querySelector("[data-web-import]").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const message = document.querySelector("[data-import-message]");
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  message.textContent = "Reading and indexing the trusted page…";
  try {
    const data = await request("/api/admin/knowledge/import-url", {
      method: "POST",
      headers: { "X-Admin-Request": "1" },
      body: JSON.stringify({
        url: formData.get("url"),
        title: formData.get("title"),
        category: formData.get("category"),
        tags: String(formData.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean)
      })
    });
    knowledge = data.knowledge;
    document.querySelector("[data-rag-chunks]").textContent = data.rag.chunks;
    renderKnowledge();
    form.reset();
    message.textContent = `Imported “${data.item.title}” and rebuilt the chatbot index.`;
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

window.addEventListener("beforeunload", (event) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } });
loadStudio();
