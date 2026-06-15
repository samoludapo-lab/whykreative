const state = {
  projects: [],
  jobs: [],
  stats: {},
  services: [],
  pipeline: []
};

const elements = {
  activeJobs: document.querySelector("#activeJobs"),
  awaitingReview: document.querySelector("#awaitingReview"),
  draftsCreated: document.querySelector("#draftsCreated"),
  queueDepth: document.querySelector("#queueDepth"),
  jobList: document.querySelector("#jobList"),
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
      .map((step, index) => `<span class="pipeline-step ${index <= job.pipelineIndex ? "done" : ""}" title="${step.label}"></span>`)
      .join("");

    node.querySelector(".job-meta").innerHTML = [
      `Progress ${job.progress}%`,
      job.worker ? `Worker ${job.worker}` : "Waiting for worker",
      job.storageKey ? "MP4 stored in R2" : "No final MP4 yet",
      job.tiktokDraftId ? `TikTok ${job.tiktokDraftId}` : "TikTok draft pending"
    ].map((item) => `<span>${item}</span>`).join("");

    elements.jobList.append(node);
  });
}

function renderReview() {
  const reviewJobs = state.jobs.filter((job) => ["awaiting_review", "approved", "uploading_to_tiktok", "draft_created"].includes(job.status));
  elements.reviewGrid.innerHTML = reviewJobs.map((job) => `
    <article class="review-card">
      <div class="video-thumb">${job.project.title.slice(0, 1)}</div>
      <div class="review-body">
        <span class="${statusClass(job.status)}">${job.statusLabel}</span>
        <h3>${job.title}</h3>
        <p>${job.storageKey || "Final MP4 is being prepared"}</p>
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

elements.jobForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createJob(event.currentTarget);
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

async function boot() {
  const payload = await api("/api/dashboard");
  setState(payload);

  const events = new EventSource("/api/events");
  events.addEventListener("dashboard", (event) => setState(JSON.parse(event.data)));
}

boot();
