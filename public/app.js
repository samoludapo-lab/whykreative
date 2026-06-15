const state = {
  projects: [],
  jobs: [],
  stats: {},
  services: [],
  pipeline: [],
  toolCatalog: {},
  connectors: [],
  costAssumptions: {},
  currentEstimate: null
};

const elements = {
  activeJobs: document.querySelector("#activeJobs"),
  awaitingReview: document.querySelector("#awaitingReview"),
  draftsCreated: document.querySelector("#draftsCreated"),
  queueDepth: document.querySelector("#queueDepth"),
  jobList: document.querySelector("#jobList"),
  workflowMap: document.querySelector("#workflowMap"),
  connectorGrid: document.querySelector("#connectorGrid"),
  costCard: document.querySelector("#costCard"),
  reviewGrid: document.querySelector("#reviewGrid"),
  serviceList: document.querySelector("#serviceList"),
  projectSelect: document.querySelector("#projectSelect"),
  jobForm: document.querySelector("#jobForm"),
  quickJobButton: document.querySelector("#quickJobButton"),
  jobTemplate: document.querySelector("#jobTemplate")
};

function setState(payload) {
  Object.assign(state, payload);
  render();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "content-type": "application/json" },
    ...options
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Request failed");
  }
  return response.json();
}

function statusClass(status) {
  return `status ${status}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(value) {
  return `$${Number(value || 0).toFixed(2)}`;
}

function renderMetrics() {
  elements.activeJobs.textContent = state.stats.activeJobs ?? 0;
  elements.awaitingReview.textContent = state.stats.awaitingReview ?? 0;
  elements.draftsCreated.textContent = state.stats.draftsCreated ?? 0;
  elements.queueDepth.textContent = state.stats.queueDepth ?? 0;
}

function renderProjects() {
  const selected = elements.projectSelect.value;
  elements.projectSelect.innerHTML = state.projects
    .map((project) => `<option value="${project.id}">${project.title}</option>`)
    .join("");
  if (selected) elements.projectSelect.value = selected;
}

function renderJobs() {
  elements.jobList.innerHTML = "";

  state.jobs.forEach((job) => {
    const node = elements.jobTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = job.title;
    node.querySelector("p").textContent = `${job.project.title} · ${job.project.format} · ${job.priority} priority`;

    const status = node.querySelector(".status");
    status.className = statusClass(job.status);
    status.textContent = job.statusLabel;

    const rail = node.querySelector(".pipeline-rail");
    rail.innerHTML = state.pipeline
      .map((step, index) => `<span class="pipeline-step ${index <= job.pipelineIndex ? "done" : ""}" title="${escapeHtml(step.label)}"></span>`)
      .join("");

    node.querySelector(".tool-strip").innerHTML = [
      job.workflow.assetProvider.name,
      job.workflow.sceneEngine.name,
      job.workflow.voiceProvider.name,
      job.workflow.videoProvider.name,
      job.workflow.assembly.name
    ].map((item) => `<span>${escapeHtml(item)}</span>`).join("");

    node.querySelector(".job-meta").innerHTML = [
      `Progress ${job.progress}%`,
      `Est. ${money(job.costEstimate.subtotal)}`,
      job.worker ? `Worker ${job.worker}` : "Waiting for worker",
      job.workflow.characterVoice,
      job.storageKey ? "MP4 stored in R2" : "No final MP4 yet",
      job.tiktokDraftId ? `TikTok ${job.tiktokDraftId}` : "TikTok draft pending"
    ].map((item) => `<span>${escapeHtml(item)}</span>`).join("");

    elements.jobList.append(node);
  });
}

function renderWorkflowMap() {
  const sampleJob = state.jobs[0];
  const stages = sampleJob?.workflow?.stages || state.pipeline.map((step) => ({ ...step, tool: "" }));

  elements.workflowMap.innerHTML = stages.map((stage, index) => `
    <article class="workflow-step ${sampleJob && index <= sampleJob.pipelineIndex ? "done" : ""}">
      <span>${index + 1}</span>
      <div>
        <strong>${escapeHtml(stage.label)}</strong>
        <p>${escapeHtml(stage.tool)}</p>
      </div>
    </article>
  `).join("");
}

function renderConnectors() {
  elements.connectorGrid.innerHTML = state.connectors.map((connector) => `
    <article class="connector-card ${connector.connected ? "connected" : ""}">
      <div>
        <span class="connector-category">${escapeHtml(connector.category)}</span>
        <h3>${escapeHtml(connector.name)}</h3>
        <p>${connector.connected ? `Connected via ${escapeHtml(connector.source)}${connector.last4 ? ` · ${escapeHtml(connector.last4)}` : ""}` : `Set ${escapeHtml(connector.env)}`}</p>
      </div>
      <form data-connector="${escapeHtml(connector.id)}">
        <input name="secret" type="password" placeholder="${escapeHtml(connector.env)}" autocomplete="off" />
        <div class="connector-actions">
          <button class="ghost-button" type="submit">${connector.connected ? "Update" : "Connect"}</button>
          <button class="text-button" type="button" data-disconnect="${escapeHtml(connector.id)}" ${connector.connected ? "" : "disabled"}>Disconnect</button>
        </div>
      </form>
    </article>
  `).join("");
}

function renderCostCard() {
  const estimate = state.currentEstimate;
  if (!estimate) {
    elements.costCard.innerHTML = `<p>Choose workflow settings to estimate this run.</p>`;
    return;
  }

  elements.costCard.innerHTML = `
    <div class="cost-total">
      <span>Estimated total</span>
      <strong>${money(estimate.subtotal)}</strong>
      <p>Expected range ${money(estimate.rangeLow)}-${money(estimate.rangeHigh)}</p>
    </div>
    <div class="cost-lines">
      ${estimate.lineItems.map((item) => `
        <div>
          <span>
            <strong>${escapeHtml(item.label)}</strong>
            <small>${escapeHtml(item.detail)}</small>
          </span>
          <b>${money(item.usd)}</b>
        </div>
      `).join("")}
    </div>
    <p class="cost-note">${escapeHtml(estimate.assumptions.note)}</p>
  `;
}

function renderReview() {
  const reviewJobs = state.jobs.filter((job) => ["awaiting_review", "approved", "uploading_to_tiktok", "draft_created"].includes(job.status));
  elements.reviewGrid.innerHTML = reviewJobs.map((job) => `
    <article class="review-card">
      <div class="video-thumb">${escapeHtml(job.project.title.slice(0, 1))}</div>
      <div class="review-body">
        <span class="${statusClass(job.status)}">${escapeHtml(job.statusLabel)}</span>
        <h3>${escapeHtml(job.title)}</h3>
        <p>${escapeHtml(job.workflow.characterVoice)} via ${escapeHtml(job.workflow.voiceProvider.name)} · est. ${money(job.costEstimate.subtotal)} · ${escapeHtml(job.storageKey || "Final MP4 is being prepared")}</p>
        <button class="ghost-button" type="button" data-approve="${job.id}" ${job.status !== "awaiting_review" ? "disabled" : ""}>
          ${job.status === "awaiting_review" ? "Approve to TikTok draft" : "Approval sent"}
        </button>
      </div>
    </article>
  `).join("");
}

function renderServices() {
  elements.serviceList.innerHTML = state.services.map((service) => `
    <article class="service-item">
      <div>
        <strong>${service.name}</strong>
        <p>${service.detail}</p>
      </div>
      <span class="service-status ${service.status}">${service.status}</span>
    </article>
  `).join("");
}

function render() {
  renderMetrics();
  renderProjects();
  renderJobs();
  renderWorkflowMap();
  renderConnectors();
  renderCostCard();
  renderReview();
  renderServices();
}

async function createJob(form) {
  const data = Object.fromEntries(new FormData(form));
  await api("/api/jobs", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

async function approveJob(jobId) {
  await api(`/api/jobs/${jobId}/approve`, { method: "POST" });
}

async function updateEstimate() {
  const data = Object.fromEntries(new FormData(elements.jobForm));
  const payload = await api("/api/estimate", {
    method: "POST",
    body: JSON.stringify(data)
  });
  state.currentEstimate = payload.estimate;
  renderCostCard();
}

async function connectProvider(form) {
  const connectorId = form.dataset.connector;
  const data = Object.fromEntries(new FormData(form));
  await api(`/api/connectors/${connectorId}`, {
    method: "POST",
    body: JSON.stringify(data)
  });
  form.reset();
}

async function disconnectProvider(connectorId) {
  await api(`/api/connectors/${connectorId}`, { method: "DELETE" });
}

elements.jobForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createJob(event.currentTarget);
});

elements.jobForm.addEventListener("input", () => {
  updateEstimate().catch(console.error);
});

elements.jobForm.addEventListener("change", () => {
  updateEstimate().catch(console.error);
});

elements.quickJobButton.addEventListener("click", async () => {
  await createJob(elements.jobForm);
});

elements.reviewGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-approve]");
  if (!button) return;
  button.disabled = true;
  await approveJob(button.dataset.approve);
});

elements.connectorGrid.addEventListener("submit", async (event) => {
  event.preventDefault();
  await connectProvider(event.target);
});

elements.connectorGrid.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-disconnect]");
  if (!button) return;
  await disconnectProvider(button.dataset.disconnect);
});

async function boot() {
  const payload = await api("/api/dashboard");
  setState(payload);
  await updateEstimate();

  const events = new EventSource("/api/events");
  events.addEventListener("dashboard", (event) => setState(JSON.parse(event.data)));
}

boot();
