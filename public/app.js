const postForm = document.querySelector("#postForm");
const postModal = document.querySelector("#postModal");
const postModalTitle = document.querySelector("#postModalTitle");
const closePostModal = document.querySelector("#closePostModal");
const schedulePostBtn = document.querySelector("#schedulePostBtn");
const deleteFromEditorBtn = document.querySelector("#deleteFromEditorBtn");
const saveDraftBtn = document.querySelector("#saveDraftBtn");
const tagsBtn = document.querySelector("#tagsBtn");
const templatesBtn = document.querySelector("#templatesBtn");
const aiAssistantBtn = document.querySelector("#aiAssistantBtn");
const previewToggleBtn = document.querySelector("#previewToggleBtn");
const composerDrawer = document.querySelector("#composerDrawer");
const uploadDrop = document.querySelector("#uploadDrop");
const imageUrlField = document.querySelector("#imageUrlField");
const uploadLimitText = document.querySelector("#uploadLimitText");
const pageIdSelect = document.querySelector("#pageIdSelect");
const previewEmpty = document.querySelector("#previewEmpty");
const livePreview = document.querySelector("#livePreview");
const paywallModal = document.querySelector("#paywallModal");
const closePaywallModal = document.querySelector("#closePaywallModal");
const mockPayBtn = document.querySelector("#mockPayBtn");
const proSignupForm = document.querySelector("#proSignupForm");
const deleteModal = document.querySelector("#deleteModal");
const deleteCopy = document.querySelector("#deleteCopy");
const confirmDeleteBtn = document.querySelector("#confirmDeleteBtn");
const cancelDeleteBtn = document.querySelector("#cancelDeleteBtn");
const upgradeBtn = document.querySelector("#upgradeBtn");
const planTitle = document.querySelector("#planTitle");
const planText = document.querySelector("#planText");
const postList = document.querySelector("#postList");
const postTemplate = document.querySelector("#postTemplate");
const refreshBtn = document.querySelector("#refreshBtn");
const importBtn = document.querySelector("#importBtn");
const sampleBtn = document.querySelector("#sampleBtn");
const downloadSampleBtn = document.querySelector("#downloadSampleBtn");
const csvInput = document.querySelector("#csvInput");
const csvDropzone = document.querySelector("#csvDropzone");
const csvFileInput = document.querySelector("#csvFileInput");
const csvPreview = document.querySelector("#csvPreview");
const statusFilter = document.querySelector("#statusFilter");
const viewButtons = [...document.querySelectorAll("[data-view]")];
const navLinks = [...document.querySelectorAll("nav a[href^='#']")];
const prevMonthBtn = document.querySelector("#prevMonthBtn");
const nextMonthBtn = document.querySelector("#nextMonthBtn");
const currentMonthLabel = document.querySelector("#currentMonthLabel");
const setupCard = document.querySelector(".setupCard");
const setupDone = document.querySelector("#setupDone");
const setupProgress = document.querySelector("#setupProgress");
const dismissSetup = document.querySelector("#dismissSetup");
const setupItems = [...document.querySelectorAll(".setupItem")];
const summaryText = document.querySelector("#summaryText");
const monthGrid = document.querySelector("#monthGrid");
const totalCount = document.querySelector("#totalCount");
const scheduledCount = document.querySelector("#scheduledCount");
const publishedCount = document.querySelector("#publishedCount");
const publishedMetricLabel = document.querySelector("#publishedMetricLabel");
const failedCount = document.querySelector("#failedCount");
const channelList = document.querySelector("#channelList");
const channelModal = document.querySelector("#channelModal");
const channelOptions = document.querySelector("#channelOptions");
const closeChannelModal = document.querySelector("#closeChannelModal");
const connectForm = document.querySelector("#connectForm");
const connectTitle = document.querySelector("#connectTitle");
const connectCopy = document.querySelector("#connectCopy");
const backToChannels = document.querySelector("#backToChannels");
const previewCaption = document.querySelector("#previewCaption");
const previewMedia = document.querySelector("#previewMedia");
const formMessage = document.querySelector("#formMessage");
const modeDot = document.querySelector("#modeDot");
const modeTitle = document.querySelector("#modeTitle");
const modeText = document.querySelector("#modeText");
const mockBanner = document.querySelector("#mockBanner");
const loginModal = document.querySelector("#loginModal");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const runSchedulerBtn = document.querySelector("#runSchedulerBtn");
const mediaFileInput = document.querySelector("#mediaFileInput");

let posts = [];
let currentView = "month";
let calendarDate = new Date();
let appConfig = {};
let selectedChannelType = "facebook";
let currentDrawer = "";
let editingPostId = "";
let pendingDeleteId = "";
let postPopover = null;

const storageKeys = {
  channels: "facebookScheduler.channels",
  setupDismissed: "facebookScheduler.setupDismissed",
  importedPlan: "facebookScheduler.importedPlan",
  trialStartedAt: "facebookScheduler.trialStartedAt",
  proPlan: "facebookScheduler.proPlan"
};

const statusLabels = {
  draft: "Bản nháp",
  scheduled: "Đã lên lịch",
  publishing: "Đang đăng",
  mock_published: "Đã giả lập đăng",
  published: "Đã đăng",
  failed: "Lỗi"
};

const channelTypes = [
  {
    id: "facebook",
    name: "Facebook",
    detail: "Page hoặc Group",
    color: "#1769ff",
    mark: "f",
    enabled: true,
    copy: "Nhập Page ID để app ghi nhớ kênh. Token thật sẽ cấu hình bằng biến môi trường khi đăng thật."
  },
  {
    id: "instagram",
    name: "Instagram",
    detail: "Business, Creator hoặc Personal",
    color: "#e9007f",
    mark: "◎",
    enabled: false,
    copy: "Instagram sẽ dùng cùng Meta App sau khi bạn mở rộng quyền API."
  },
  {
    id: "threads",
    name: "Threads",
    detail: "Hồ sơ",
    color: "#050505",
    mark: "@",
    enabled: false,
    copy: "Threads để trong roadmap sau MVP."
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    detail: "Page hoặc hồ sơ",
    color: "#2f6fad",
    mark: "in",
    enabled: false,
    copy: "LinkedIn cần OAuth/app riêng, chưa bật trong MVP."
  },
  {
    id: "youtube",
    name: "YouTube",
    detail: "Kênh",
    color: "#ff1010",
    mark: "▶",
    enabled: false,
    copy: "YouTube phù hợp cho video queue ở phase sau."
  },
  {
    id: "tiktok",
    name: "TikTok",
    detail: "Tài khoản Business",
    color: "#050505",
    mark: "♪",
    enabled: false,
    copy: "TikTok cần flow upload video riêng."
  },
  {
    id: "pinterest",
    name: "Pinterest",
    detail: "Board",
    color: "#e60023",
    mark: "p",
    enabled: false,
    copy: "Pinterest sẽ cần board mapping riêng."
  },
  {
    id: "mastodon",
    name: "Mastodon",
    detail: "Profile",
    color: "#6658f6",
    mark: "m",
    enabled: false,
    copy: "Mastodon có thể nối bằng instance URL và access token."
  },
  {
    id: "bluesky",
    name: "Bluesky",
    detail: "Profile",
    color: "#1d8cf8",
    mark: "b",
    enabled: false,
    copy: "Bluesky dùng AT Protocol, để sau khi xong Facebook."
  }
];

const templates = [
  {
    title: "Bán hàng nhẹ nhàng",
    body: "Hôm nay bên mình có một gợi ý nhỏ cho bạn:\n\n[Điểm nổi bật]\n[Giá trị khách nhận được]\n\nInbox page để được tư vấn nhanh nhé."
  },
  {
    title: "Thông báo lịch",
    body: "Lịch mới đã sẵn sàng.\n\nBạn có thể đặt trước khung giờ phù hợp trong hôm nay. Đội ngũ sẽ phản hồi từng tin nhắn sớm nhất có thể."
  },
  {
    title: "Storytelling",
    body: "Có một điều tụi mình nhận ra sau khi làm việc với khách hàng:\n\n[Insight]\n\nVì vậy, bài này dành cho những ai đang cần [kết quả mong muốn]."
  }
];

const defaultMediaLimits = {
  image: { maxBytes: 5 * 1024 * 1024, label: "5MB", types: ["jpg", "jpeg", "png", "webp"] },
  video: { maxBytes: 50 * 1024 * 1024, label: "50MB", types: ["mp4", "mov", "webm"] }
};

const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/quicktime", "video/webm"]);
const videoExtensions = new Set([".mp4", ".mov", ".webm"]);

function toLocalInputValue(date = new Date()) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function ensureTrial() {
  if (!localStorage.getItem(storageKeys.trialStartedAt)) {
    localStorage.setItem(storageKeys.trialStartedAt, new Date().toISOString());
  }
}

function getPlanState() {
  ensureTrial();
  let proPlan = null;
  try {
    proPlan = JSON.parse(localStorage.getItem(storageKeys.proPlan) || "null");
  } catch {
    proPlan = null;
  }
  const paidUntil = proPlan?.paidUntil ? new Date(proPlan.paidUntil) : null;
  const paid = Boolean(paidUntil && paidUntil.getTime() > Date.now());
  const started = new Date(localStorage.getItem(storageKeys.trialStartedAt));
  const elapsedDays = Math.floor((Date.now() - started.getTime()) / 86_400_000);
  const remainingDays = Math.max(0, 7 - elapsedDays);
  return {
    paid,
    paidUntil,
    proPlan,
    expired: !paid && remainingDays <= 0,
    remainingDays
  };
}

function renderPlan() {
  const plan = getPlanState();
  if (plan.paid) {
    planTitle.textContent = "Gói Pro";
    planText.textContent = `Có hiệu lực đến ${formatDate(plan.paidUntil)}.`;
    upgradeBtn.textContent = "Gia hạn 20.000đ";
    upgradeBtn.disabled = false;
    return;
  }

  planTitle.textContent = plan.expired ? "Dùng thử đã hết" : "Dùng thử";
  planText.textContent = plan.expired
    ? "Nâng cấp 20.000đ/tháng để tiếp tục đăng tự động."
    : `Còn ${plan.remainingDays} ngày dùng thử miễn phí.`;
  upgradeBtn.textContent = "20.000đ/tháng";
  upgradeBtn.disabled = false;
}

function formatDate(value) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatShortTime(value) {
  return new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value >= 1024 * 1024) return `${Math.round(value / 1024 / 1024)}MB`;
  if (value >= 1024) return `${Math.round(value / 1024)}KB`;
  return `${value}B`;
}

function mediaLimits() {
  const configured = appConfig.mediaLimits || {};
  return {
    image: {
      ...defaultMediaLimits.image,
      ...(configured.image || {}),
      maxBytes: Number(configured.image?.maxBytes || appConfig.uploadMaxBytes || defaultMediaLimits.image.maxBytes)
    },
    video: {
      ...defaultMediaLimits.video,
      ...(configured.video || {}),
      maxBytes: Number(configured.video?.maxBytes || defaultMediaLimits.video.maxBytes)
    }
  };
}

function mediaKindFromFile(file) {
  if (!file) return "";
  if (imageTypes.has(file.type)) return "image";
  if (videoTypes.has(file.type)) return "video";
  return "";
}

function extensionFromUrl(value) {
  try {
    return new URL(value, window.location.origin).pathname.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
  } catch {
    return "";
  }
}

function isVideoMediaUrl(value) {
  return videoExtensions.has(extensionFromUrl(value));
}

function updateMediaLimitText() {
  if (!uploadLimitText) return;
  const limits = mediaLimits();
  uploadLimitText.textContent = `Ảnh ${formatBytes(limits.image.maxBytes)}, video ${formatBytes(limits.video.maxBytes)}`;
}

function readCookie(name) {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) || "";
}

async function request(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const method = String(options.method || "GET").toUpperCase();
  const csrfToken = readCookie("ps_csrf");
  const headers = isFormData ? { ...(options.headers || {}) } : { "content-type": "application/json", ...(options.headers || {}) };
  if (csrfToken && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    headers["x-csrf-token"] = csrfToken;
  }
  const response = await fetch(path, {
    credentials: "same-origin",
    headers,
    ...options
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (response.status === 401) showLoginModal();
  if (!response.ok) {
    const error = new Error(data.error || data || "Request failed");
    if (data?.code) error.code = data.code;
    throw error;
  }
  return data;
}

function userFacingError(error, fallback = "Thao tác thất bại.") {
  if (error?.code === "SUPABASE_INVALID_API_KEY") {
    return "Supabase key đang sai nên chưa nhập CSV được. Cần cập nhật lại SUPABASE_SERVICE_ROLE_KEY bằng service_role/secret key của đúng project Supabase rồi deploy lại.";
  }
  if (error?.code === "SUPABASE_STORAGE_ERROR") {
    return "Supabase đang lỗi cấu hình. Kiểm tra SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, schema và storage bucket.";
  }
  return error?.message || fallback;
}

function showLoginModal(message = "") {
  if (!loginModal) return;
  loginMessage.textContent = message;
  loginMessage.className = message ? "formMessage error" : "formMessage";
  loginModal.hidden = false;
  document.body.classList.add("modalOpen");
}

function hideLoginModal() {
  loginModal.hidden = true;
  document.body.classList.remove("modalOpen");
}

async function loadConfig() {
  const config = await request("/api/config");
  appConfig = config;
  modeDot.style.background = config.dryRun ? "#9b6615" : "#207a52";
  modeTitle.textContent = config.dryRun ? "Dry-run" : "Production";
  modeText.textContent = config.dryRun
    ? "Dry-run: không gọi Facebook."
    : `Production: đang gọi Graph API thật qua ${config.graphVersion}${config.defaultPageId ? ` vào Page ${config.defaultPageId}` : ""}`;
  mockBanner.hidden = false;
  mockBanner.classList.toggle("production", !config.dryRun);
  mockBanner.querySelector("strong").textContent = config.dryRun ? "Dry-run mode." : "Production mode.";
  mockBanner.querySelector("span").textContent = config.dryRun
    ? "Bài đến giờ chỉ đổi trạng thái trong hệ thống, không gọi Facebook."
    : "Bài đến giờ sẽ gọi Facebook Graph API thật bằng token server-side.";
  runSchedulerBtn.hidden = !config.auth?.authenticated;
  publishedMetricLabel.textContent = config.dryRun ? "Đã giả lập đăng" : "Đã đăng thật";
  updateMediaLimitText();
  renderPageSelect(postForm.pageId?.value || "");
  renderChannels();
  renderSetup();
  renderPlan();
  if (!config.auth?.authenticated) showLoginModal();
}

async function loadPosts() {
  if (!appConfig.auth?.authenticated) return;
  posts = await request("/api/posts");
  renderPosts();
}

function renderPosts() {
  const filter = statusFilter.value;
  const visible = posts.filter((post) => filter === "all" || post.status === filter);
  renderMetrics();
  renderMonthGrid(visible);
  renderSetup();
  monthGrid.hidden = currentView !== "month";
  postList.hidden = currentView !== "queue";
  postList.replaceChildren();
  summaryText.textContent = `${posts.length} bài trong hệ thống, ${visible.length} bài đang hiển thị.`;

  if (!visible.length) {
    const empty = document.createElement("p");
    empty.className = "meta";
    empty.textContent = "Chưa có bài nào khớp bộ lọc.";
    postList.append(empty);
    return;
  }

  for (const post of visible) {
    const node = postTemplate.content.firstElementChild.cloneNode(true);
    const date = new Date(post.scheduledAt);
    const badge = node.querySelector(".badge");
    badge.textContent = statusLabels[post.status] || post.status;
    badge.classList.add(post.status);
    node.querySelector(".day").textContent = date.getDate();
    node.querySelector(".month").textContent = `Thg ${date.getMonth() + 1}`;
    node.querySelector("time").textContent = formatTime(post.scheduledAt);
    node.querySelector(".caption").textContent = post.caption;
    node.querySelector(".meta").textContent = [
      post.pageId ? `Page: ${post.pageId}` : "Chưa có Page ID",
      post.imageUrl ? `Media: ${post.imageUrl}` : "Không có media",
      post.format ? `Format: ${post.format}` : "",
      post.tags ? `Tags: ${post.tags}` : ""
    ].filter(Boolean).join(" | ");
    node.querySelector(".error").textContent = [
      post.error || "",
      post.dataWarning ? `Cảnh báo dữ liệu: ${post.dataWarning}` : ""
    ].join(" | ");
    node.addEventListener("dblclick", () => openEditPost(post.id));
    const actions = node.querySelector(".cardActions");
    const editButton = document.createElement("button");
    editButton.className = "editBtn";
    editButton.type = "button";
    editButton.textContent = "Sửa";
    editButton.addEventListener("click", () => openEditPost(post.id));
    actions.prepend(editButton);
    if (post.status === "failed") {
      const retryButton = document.createElement("button");
      retryButton.className = "retryBtn";
      retryButton.type = "button";
      retryButton.textContent = "Retry";
      retryButton.addEventListener("click", async () => {
        await request(`/api/posts/${post.id}/retry`, { method: "POST" });
        await loadPosts();
      });
      actions.prepend(retryButton);
    }
    node.querySelector(".deleteBtn").addEventListener("click", () => openDeleteModal(post.id));
    postList.append(node);
  }
}

function getChannels() {
  try {
    return JSON.parse(localStorage.getItem(storageKeys.channels) || "[]");
  } catch {
    return [];
  }
}

function saveChannels(channels) {
  localStorage.setItem(storageKeys.channels, JSON.stringify(channels));
}

function hasConnectedChannel() {
  return Boolean(appConfig.defaultPageId);
}

function getChannelMeta(type) {
  return channelTypes.find((item) => item.id === type) || channelTypes[0];
}

function renderChannels() {
  const configured = appConfig.defaultPageId
    ? [{ type: "facebook", name: "Facebook Page", handle: appConfig.defaultPageId, source: "env" }]
    : [];
  const visibleChannels = configured;
  channelList.replaceChildren();

  if (!visibleChannels.length) {
    const empty = document.createElement("button");
    empty.type = "button";
    empty.className = "channel emptyChannel";
    empty.setAttribute("data-open-channel-modal", "");
    const avatar = document.createElement("span");
    avatar.className = "avatar ghostAvatar";
    avatar.textContent = "+";
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = "Chưa kết nối Page thật";
    const detail = document.createElement("small");
    detail.textContent = "Kết nối Facebook Page để đăng tự động.";
    body.append(title, detail);
    empty.append(avatar, body);
    empty.addEventListener("click", openChannelModal);
    channelList.append(empty);
    return;
  }

  visibleChannels.forEach((channel, index) => {
    const meta = getChannelMeta(channel.type);
    const item = document.createElement("div");
    item.className = "channel active";
    const avatar = document.createElement("span");
    avatar.className = "avatar";
    avatar.style.background = meta.color;
    avatar.textContent = meta.mark;
    const body = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = channel.name || meta.name;
    const detail = document.createElement("small");
    detail.textContent = channel.source === "env"
      ? `Page thật: ${channel.handle}`
      : `Demo channel: ${channel.handle || meta.detail}`;
    body.append(title, detail);
    item.append(avatar, body);
    if (channel.source !== "env") {
      const remove = document.createElement("button");
      remove.className = "removeChannel";
      remove.type = "button";
      remove.title = "Gỡ kênh";
      remove.textContent = "×";
      remove.addEventListener("click", (event) => {
        event.stopPropagation();
        const current = getChannels();
        current.splice(index - configured.length, 1);
        saveChannels(current);
        renderChannels();
        renderSetup();
      });
      item.append(remove);
    }
    channelList.append(item);
  });

  const add = document.createElement("button");
  add.type = "button";
  add.className = "channel muted emptyChannel";
  const addAvatar = document.createElement("span");
  addAvatar.className = "avatar ghostAvatar";
  addAvatar.textContent = "+";
  const addBody = document.createElement("div");
  const addTitle = document.createElement("strong");
  addTitle.textContent = "Thêm kênh";
  const addDetail = document.createElement("small");
  addDetail.textContent = "Kết nối kênh khác";
  addBody.append(addTitle, addDetail);
  add.append(addAvatar, addBody);
  add.addEventListener("click", openChannelModal);
  channelList.append(add);
}

function renderPageSelect(selectedValue = "") {
  if (!pageIdSelect) return;
  const currentValue = String(selectedValue || "").trim();
  pageIdSelect.replaceChildren();

  const pageName = appConfig.defaultPageName || "Facebook Page đã kết nối";
  if (appConfig.defaultPageId) {
    const option = document.createElement("option");
    option.value = appConfig.defaultPageId;
    option.textContent = `${pageName} (${appConfig.defaultPageId})`;
    pageIdSelect.append(option);
  } else {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Chưa cấu hình Page trong server";
    pageIdSelect.append(option);
  }

  if (currentValue && currentValue !== appConfig.defaultPageId) {
    const custom = document.createElement("option");
    custom.value = currentValue;
    custom.textContent = `Page đã lưu (${currentValue})`;
    pageIdSelect.append(custom);
  }

  pageIdSelect.value = currentValue || appConfig.defaultPageId || "";
}

function renderSetup() {
  if (localStorage.getItem(storageKeys.setupDismissed) === "true") {
    setupCard.hidden = true;
    return;
  }

  const completed = {
    account: true,
    channel: hasConnectedChannel(),
    idea: localStorage.getItem(storageKeys.importedPlan) === "true" || posts.length > 0,
    post: posts.some((post) => ["mock_published", "published"].includes(post.status)) || posts.length > 0
  };
  const done = Object.values(completed).filter(Boolean).length;
  setupDone.textContent = done;
  setupProgress.style.width = `${(done / 4) * 100}%`;
  setupItems.forEach((item) => {
    const step = item.dataset.step;
    item.classList.toggle("done", completed[step]);
  });
}

function canCreatePost() {
  const plan = getPlanState();
  if (!plan.expired) return true;
  openPaywallModal();
  return false;
}

function renderMetrics() {
  totalCount.textContent = posts.length;
  scheduledCount.textContent = posts.filter((post) => post.status === "scheduled").length;
  publishedCount.textContent = posts.filter((post) => ["mock_published", "published"].includes(post.status)).length;
  failedCount.textContent = posts.filter((post) => post.status === "failed").length;
}

function closePostPopover() {
  postPopover?.remove();
  postPopover = null;
}

function showPostPopover(post, anchor) {
  closePostPopover();
  const rect = anchor.getBoundingClientRect();
  const popover = document.createElement("div");
  popover.className = "calendarPopover";
  popover.style.left = `${Math.min(rect.left, window.innerWidth - 340)}px`;
  popover.style.top = `${Math.max(16, Math.min(rect.bottom + 8, window.innerHeight - 440))}px`;

  const status = document.createElement("span");
  status.className = `badge ${post.status}`;
  status.textContent = statusLabels[post.status] || post.status;
  const title = document.createElement("strong");
  title.textContent = post.caption || "(Chưa có nội dung)";
  const time = document.createElement("small");
  time.textContent = formatTime(post.scheduledAt);
  const meta = document.createElement("p");
  meta.textContent = [
    post.pageId ? `Page ID: ${post.pageId}` : "Chưa có Page ID",
    post.imageUrl ? "Có media" : "Không có media"
  ].join(" | ");
  popover.append(status, title, time, meta);

  const problems = [];
  if (post.error) problems.push(post.error);
  if (post.dataWarning && post.dataWarning !== post.error) problems.push(`Cảnh báo dữ liệu: ${post.dataWarning}`);
  const problem = problems.join(" | ");
  if (problem) {
    const error = document.createElement("p");
    error.className = "popoverError";
    error.textContent = problem;
    popover.append(error);
  }

  const actions = document.createElement("div");
  actions.className = "popoverActions";
  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "ghost";
  edit.textContent = "Sửa";
  edit.addEventListener("click", () => {
    closePostPopover();
    openEditPost(post.id);
  });
  actions.append(edit);
  if (post.status === "failed") {
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Retry";
    retry.addEventListener("click", async () => {
      await request(`/api/posts/${post.id}/retry`, { method: "POST" });
      closePostPopover();
      await loadPosts();
    });
    actions.append(retry);
  }
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "dangerGhost";
  remove.textContent = "Xóa";
  remove.addEventListener("click", () => {
    closePostPopover();
    openDeleteModal(post.id);
  });
  actions.append(remove);
  popover.append(actions);

  document.body.append(popover);
  postPopover = popover;
}

function openPostModalForDate(date) {
  openPostModal();
  if (postModal.hidden) return;
  const scheduled = new Date(date);
  scheduled.setHours(9, 0, 0, 0);
  if (scheduled <= new Date()) {
    scheduled.setTime(Date.now() + 60 * 60 * 1000);
  }
  postForm.scheduledAt.value = toLocalInputValue(scheduled);
}

function renderMonthGrid(items) {
  const now = calendarDate;
  const year = now.getFullYear();
  const month = now.getMonth();
  currentMonthLabel.textContent = `Tháng ${month + 1}, ${year}`;
  const first = new Date(year, month, 1);
  const start = new Date(first);
  const mondayOffset = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - mondayOffset);

  const weekdayLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  monthGrid.replaceChildren();

  for (const label of weekdayLabels) {
    const cell = document.createElement("div");
    cell.className = "monthCell header";
    cell.textContent = label;
    monthGrid.append(cell);
  }

  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const cell = document.createElement("div");
    cell.className = "monthCell";
    if (date.getMonth() !== month) cell.classList.add("outside");
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();
    if (isToday) cell.classList.add("today");

    const dateNum = document.createElement("span");
    dateNum.className = "dateNum";
    dateNum.textContent = date.getDate();
    cell.append(dateNum);
    if (isToday) {
      const todayLabel = document.createElement("span");
      todayLabel.className = "todayLabel";
      todayLabel.textContent = "Hôm nay";
      cell.append(todayLabel);
    }

    const allDayItems = items
      .filter((post) => {
        const scheduled = new Date(post.scheduledAt);
        return scheduled.toDateString() === date.toDateString();
      });
    if (isToday && allDayItems.some((post) => post.status === "failed")) cell.classList.add("hasError");
    const dayItems = allDayItems.slice(0, 2);

    for (const post of dayItems) {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = `monthDot ${post.status}`;
      dot.textContent = `${formatShortTime(post.scheduledAt)} ${post.caption}`;
      dot.addEventListener("click", (event) => {
        event.stopPropagation();
        showPostPopover(post, dot);
      });
      cell.append(dot);
    }
    if (allDayItems.length > dayItems.length) {
      const more = document.createElement("button");
      more.type = "button";
      more.className = "monthMore";
      more.textContent = `+${allDayItems.length - dayItems.length} bài nữa`;
      more.addEventListener("click", () => {
        currentView = "queue";
        viewButtons.forEach((item) => item.classList.toggle("selected", item.dataset.view === currentView));
        renderPosts();
      });
      cell.append(more);
    }
    if (!allDayItems.length && date.getMonth() === month) {
      cell.title = "Nhấp đúp để tạo bài ngày này";
      cell.addEventListener("dblclick", () => openPostModalForDate(date));
    }

    monthGrid.append(cell);
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);

  const headers = rows.shift()?.map((header) => header.trim()) || [];
  return rows.map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]))
  );
}

function csvSampleText() {
  return [
    "caption,scheduledAt,pageId,imageUrl,status",
    "\"Bài mở đầu chiến dịch tháng này\",\"2026-05-12T09:00\",\"123456789\",\"https://example.com/post-1.jpg\",\"scheduled\"",
    "\"Nhắc khách inbox để nhận tư vấn\",\"2026-05-15T19:30\",\"123456789\",\"\",\"scheduled\""
  ].join("\n");
}

function validateImportRow(row) {
  const errors = [];
  const status = row.status || "scheduled";
  if (!row.caption?.trim()) errors.push("Thiếu caption");
  if (!row.scheduledAt || Number.isNaN(Date.parse(row.scheduledAt))) errors.push("Giờ đăng không hợp lệ");
  if (row.scheduledAt && Date.parse(row.scheduledAt) <= Date.now() && status === "scheduled") {
    errors.push("Giờ đăng phải ở tương lai");
  }
  if (row.pageId && !/^\d+$/.test(row.pageId)) errors.push("Page ID phải là số");
  if (row.imageUrl) {
    try {
      const parsed = new URL(row.imageUrl);
      if (parsed.hostname.includes("drive.google.com") && parsed.pathname.includes("/file/d/")) {
        errors.push("Không dùng link Google Drive dạng view");
      }
    } catch {
      errors.push("Link media không hợp lệ");
    }
  }
  if (!["draft", "scheduled", "publishing", "mock_published", "published", "failed"].includes(status)) {
    errors.push("Status không hợp lệ");
  }
  return errors;
}

function getCsvPreviewRows() {
  return parseCsv(csvInput.value).map((row, index) => ({
    row,
    line: index + 2,
    errors: validateImportRow(row)
  }));
}

function renderCsvPreview() {
  const rows = getCsvPreviewRows();
  csvPreview.hidden = !rows.length;
  csvPreview.replaceChildren();
  if (!rows.length) return;

  const summary = document.createElement("p");
  const validCount = rows.filter((item) => !item.errors.length).length;
  summary.textContent = `${validCount}/${rows.length} dòng sẵn sàng nhập. Format giờ nên dùng YYYY-MM-DDTHH:mm, ví dụ 2026-05-12T09:00.`;
  csvPreview.append(summary);

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th>Dòng</th>
        <th>Caption</th>
        <th>Giờ đăng</th>
        <th>Page ID</th>
        <th>Trạng thái</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const body = table.querySelector("tbody");
  for (const item of rows) {
    const tr = document.createElement("tr");
    tr.className = item.errors.length ? "invalid" : "valid";
    const cells = [
      item.line,
      item.row.caption || "-",
      item.row.scheduledAt || "-",
      item.row.pageId || "-",
      item.errors.length ? item.errors.join(", ") : "Sẵn sàng"
    ];
    for (const value of cells) {
      const td = document.createElement("td");
      td.textContent = value;
      tr.append(td);
    }
    body.append(tr);
  }
  csvPreview.append(table);
}

postForm.scheduledAt.value = toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000));

function updatePreview() {
  const caption = postForm.caption.value.trim();
  const mediaUrl = postForm.imageUrl.value.trim();
  const hasPreview = Boolean(caption || mediaUrl);
  const isVideo = isVideoMediaUrl(mediaUrl);
  previewEmpty.hidden = hasPreview;
  livePreview.hidden = !hasPreview;
  previewCaption.textContent = caption || "Nội dung bài đăng sẽ hiển thị ở đây.";
  previewMedia.classList.toggle("hasImage", Boolean(mediaUrl && !isVideo));
  previewMedia.classList.toggle("hasVideo", Boolean(mediaUrl && isVideo));
  previewMedia.style.backgroundImage = mediaUrl && !isVideo ? `url("${mediaUrl.replaceAll('"', "%22")}")` : "";
  previewMedia.replaceChildren();
  if (mediaUrl && isVideo) {
    const video = document.createElement("video");
    video.src = mediaUrl;
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
    previewMedia.append(video);
  } else {
    previewMedia.textContent = mediaUrl ? "Ảnh" : "Media";
  }
}

postForm.caption.addEventListener("input", updatePreview);
postForm.imageUrl.addEventListener("input", updatePreview);

function setFormMessage(message, type = "info") {
  formMessage.textContent = message;
  formMessage.className = `formMessage ${type}`;
}

function validateComposerInputs({ allowDraft = false } = {}) {
  const pageId = postForm.pageId.value.trim();
  const mediaUrl = postForm.imageUrl.value.trim();
  const scheduledAt = postForm.scheduledAt.value.trim();
  if (!allowDraft && !postForm.caption.value.trim()) {
    throw new Error("Caption không được để trống.");
  }
  if (pageId && !/^\d+$/.test(pageId)) {
    throw new Error("Page ID phải là số. Không dán URL Facebook Page vào ô này.");
  }
  if (mediaUrl && !mediaUrl.startsWith("/uploads/")) {
    let parsed;
    try {
      parsed = new URL(mediaUrl);
    } catch {
      throw new Error("Link media phải là URL hợp lệ.");
    }
    if (parsed.hostname.includes("drive.google.com") && parsed.pathname.includes("/file/d/")) {
      throw new Error("Không dùng link Google Drive dạng view. Hãy dùng direct public media URL hoặc upload file.");
    }
  }
  if (!appConfig.dryRun && mediaUrl && isVideoMediaUrl(mediaUrl)) {
    throw new Error("Video/Reel/Tin trong pilot hiện hỗ trợ upload, preview và lưu lịch dry-run. Đăng thật Facebook hiện chỉ hỗ trợ text/ảnh.");
  }
  if (!allowDraft && Date.parse(scheduledAt) <= Date.now()) {
    throw new Error("Thời điểm đăng phải ở tương lai.");
  }
}

async function savePostWithStatus(status) {
  validateComposerInputs({ allowDraft: status === "draft" });
  const form = new FormData(postForm);
  const payload = Object.fromEntries(form.entries());
  payload.status = status;
  payload.scheduledTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  payload.tags = tagsBtn.dataset.value || "";
  if (status === "draft" && !payload.scheduledAt) {
    payload.scheduledAt = toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000));
  }
  await request(editingPostId ? `/api/posts/${editingPostId}` : "/api/posts", {
    method: editingPostId ? "PUT" : "POST",
    body: JSON.stringify(payload)
  });
}

function setSelectedTag(tag = "") {
  const value = String(tag || "").trim();
  tagsBtn.dataset.value = value;
  tagsBtn.textContent = value ? `${value} ⌄` : "Nhãn⌄";
  const tip = document.createElement("span");
  tip.className = "infoTip";
  tip.tabIndex = 0;
  tip.dataset.tip = "Gắn nhãn nội bộ để lọc/nhớ mục đích bài. Nhãn không được đăng lên Facebook.";
  tip.textContent = "i";
  tagsBtn.append(" ", tip);
}

function insertAtCursor(text) {
  const textarea = postForm.caption;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  const before = textarea.value.slice(0, start);
  const after = textarea.value.slice(end);
  textarea.value = `${before}${text}${after}`;
  const cursor = start + text.length;
  textarea.setSelectionRange(cursor, cursor);
  textarea.focus();
  updatePreview();
}

function showDrawer(kind) {
  if (currentDrawer === kind && !composerDrawer.hidden) {
    composerDrawer.hidden = true;
    currentDrawer = "";
    return;
  }
  currentDrawer = kind;
  composerDrawer.hidden = false;

  if (kind === "templates") {
    composerDrawer.innerHTML = `
      <strong>Mẫu nội dung</strong>
      <div class="drawerGrid">
        ${templates.map((template, index) => `
          <button type="button" data-template-index="${index}">
            <span>${template.title}</span>
            <small>${template.body.split("\n")[0]}</small>
          </button>
        `).join("")}
      </div>
    `;
    composerDrawer.querySelectorAll("[data-template-index]").forEach((button) => {
      button.addEventListener("click", () => {
        postForm.caption.value = templates[Number(button.dataset.templateIndex)].body;
        updatePreview();
        setFormMessage("Đã chèn mẫu nội dung. Bạn có thể sửa lại trước khi lên lịch.", "success");
        composerDrawer.hidden = true;
        postForm.caption.focus();
      });
    });
    return;
  }

  if (kind === "tags") {
    composerDrawer.innerHTML = `
      <strong>Nhãn</strong>
      <div class="tagChips">
        <button type="button" data-tag="">Bỏ nhãn</button>
        ${["Campaign tháng 5", "Bán hàng", "Chăm sóc khách", "Ưu đãi", "Repost"].map((tag) => `
          <button type="button" data-tag="${tag}">${tag}</button>
        `).join("")}
      </div>
    `;
    composerDrawer.querySelectorAll("[data-tag]").forEach((button) => {
      button.addEventListener("click", () => {
        setSelectedTag(button.dataset.tag);
        setFormMessage(button.dataset.tag ? `Đã gắn nhãn "${button.dataset.tag}".` : "Đã bỏ nhãn.", "success");
        composerDrawer.hidden = true;
      });
    });
    return;
  }

  if (kind === "ai") {
    composerDrawer.innerHTML = `
      <strong>Trợ lý AI</strong>
      <p>Gợi ý mock: viết caption ngắn, rõ CTA, có một lợi ích chính.</p>
      <button type="button" id="useAiSuggestion">Chèn gợi ý</button>
    `;
    composerDrawer.querySelector("#useAiSuggestion").addEventListener("click", () => {
      insertAtCursor("Bạn đang cần một cách đơn giản hơn để lên kế hoạch nội dung?\n\nInbox page, mình gửi bạn gợi ý phù hợp trong hôm nay nhé.");
      composerDrawer.hidden = true;
    });
  }
}

function openPostModal(event) {
  event?.preventDefault();
  if (!canCreatePost()) return;
  editingPostId = "";
  closePostPopover();
  postModalTitle.textContent = "Tạo bài";
  schedulePostBtn.textContent = "Lên lịch bài";
  deleteFromEditorBtn.hidden = true;
  setFormMessage("");
  postModal.hidden = false;
  document.body.classList.add("modalOpen");
  renderPageSelect(postForm.pageId?.value || "");
  postForm.scheduledAt.value ||= toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000));
  postForm.caption.focus();
  updatePreview();
}

function closePostComposer() {
  postModal.hidden = true;
  editingPostId = "";
  document.body.classList.remove("modalOpen");
}

function openEditPost(id) {
  const post = posts.find((item) => item.id === id);
  if (!post) return;
  editingPostId = id;
  closePostPopover();
  postModalTitle.textContent = "Sửa bài";
  schedulePostBtn.textContent = "Cập nhật bài";
  deleteFromEditorBtn.hidden = false;
  postForm.caption.value = post.caption;
  postForm.scheduledAt.value = toLocalInputValue(new Date(post.scheduledAt));
  postForm.pageId.value = post.pageId || "";
  postForm.imageUrl.value = post.imageUrl || "";
  postForm.firstComment.value = post.firstComment || "";
  postForm.scheduleMode.value = post.scheduleMode || "Custom Time";
  renderPageSelect(post.pageId || "");
  const formatInput = [...postForm.format].find((input) => input.value === (post.format || "post"));
  if (formatInput) formatInput.checked = true;
  setSelectedTag(post.tags || "");
  setFormMessage("Đang chỉnh sửa bài đã lên lịch.");
  postModal.hidden = false;
  document.body.classList.add("modalOpen");
  updatePreview();
  postForm.caption.focus();
}

function openDeleteModal(id) {
  const post = posts.find((item) => item.id === id);
  if (!post) return;
  pendingDeleteId = id;
  deleteCopy.textContent = `Xóa bài "${post.caption.slice(0, 80)}" khỏi lịch? Thao tác này không thể hoàn tác.`;
  deleteModal.hidden = false;
  document.body.classList.add("modalOpen");
}

function closeDeleteModal() {
  deleteModal.hidden = true;
  pendingDeleteId = "";
  document.body.classList.remove("modalOpen");
}

function openPaywallModal() {
  paywallModal.hidden = false;
  document.body.classList.add("modalOpen");
}

function closePaywall() {
  paywallModal.hidden = true;
  document.body.classList.remove("modalOpen");
  renderPlan();
}

function openChannelModal() {
  channelModal.hidden = false;
  document.body.classList.add("modalOpen");
  renderChannelOptions();
  showChannelPicker();
}

function closeModal() {
  channelModal.hidden = true;
  document.body.classList.remove("modalOpen");
}

function showChannelPicker() {
  channelOptions.hidden = false;
  connectForm.hidden = true;
}

function showConnectForm(type) {
  const meta = getChannelMeta(type);
  selectedChannelType = type;
  channelOptions.hidden = true;
  connectForm.hidden = false;
  connectTitle.textContent = `Kết nối ${meta.name}`;
  connectCopy.textContent = meta.copy;
  connectForm.name.value = meta.name === "Facebook" ? "Facebook Page" : meta.name;
  connectForm.handle.value = "";
  if (type === "facebook") {
    connectCopy.textContent = appConfig.defaultPageId
      ? `Facebook Page is configured from .env: ${appConfig.defaultPageId}. Token is never shown in the browser.`
      : "Set FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN as server/Worker secrets, then redeploy or restart. Do not paste tokens here.";
  }
  connectForm.handle.focus();
}

function renderChannelOptions() {
  channelOptions.replaceChildren();
  for (const meta of channelTypes) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "channelOption";
    button.innerHTML = `
      <span class="networkIcon" style="background:${meta.color}">${meta.mark}</span>
      <strong>${meta.name}</strong>
      <small>${meta.detail}</small>
      ${meta.enabled ? "" : "<em>Sắp có</em>"}
    `;
    button.addEventListener("click", () => showConnectForm(meta.id));
    channelOptions.append(button);
  }
}

postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!canCreatePost()) return;
  const submitButton = schedulePostBtn;
  submitButton.disabled = true;
  setFormMessage("Đang thêm vào lịch...");
  try {
    const createAnother = new FormData(postForm).get("createAnother");
    await savePostWithStatus("scheduled");
    postForm.reset();
    postForm.scheduledAt.value = toLocalInputValue(new Date(Date.now() + 60 * 60 * 1000));
    renderPageSelect("");
    setSelectedTag("");
    updatePreview();
    await loadPosts();
    currentView = "month";
    viewButtons.forEach((item) => item.classList.toggle("selected", item.dataset.view === currentView));
    renderPosts();
    setFormMessage(editingPostId ? "Đã cập nhật bài." : "Đã thêm bài vào lịch.", "success");
    if (createAnother) {
      postForm.caption.value = "";
      postForm.imageUrl.value = "";
      postForm.firstComment.value = "";
      renderPageSelect("");
      updatePreview();
      postForm.caption.focus();
    } else {
      closePostComposer();
      document.querySelector("#calendar").scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error) {
    setFormMessage(error.message || "Không thêm được bài. Kiểm tra server rồi thử lại.", "error");
  } finally {
    submitButton.disabled = false;
  }
});

saveDraftBtn.addEventListener("click", async () => {
  try {
    setFormMessage("Đang lưu nháp...");
    await savePostWithStatus("draft");
    await loadPosts();
    closePostComposer();
  } catch (error) {
    setFormMessage(error.message || "Không lưu được nháp.", "error");
  }
});

refreshBtn.addEventListener("click", loadPosts);
runSchedulerBtn.addEventListener("click", async () => {
  runSchedulerBtn.disabled = true;
  try {
    await request("/api/scheduler/tick", { method: "POST" });
    await loadPosts();
  } catch (error) {
    alert(error.message || "Scheduler tick thất bại.");
  } finally {
    runSchedulerBtn.disabled = false;
  }
});
statusFilter.addEventListener("change", renderPosts);
prevMonthBtn.addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1);
  renderPosts();
});
nextMonthBtn.addEventListener("click", () => {
  calendarDate = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1);
  renderPosts();
});
document.querySelectorAll("[data-open-post-modal]").forEach((button) => {
  button.addEventListener("click", openPostModal);
});
document.querySelectorAll("[data-open-channel-modal]").forEach((button) => {
  button.addEventListener("click", openChannelModal);
});

closePostModal.addEventListener("click", closePostComposer);
postModal.addEventListener("click", (event) => {
  if (event.target === postModal) closePostComposer();
});
document.addEventListener("click", (event) => {
  if (postPopover && !postPopover.contains(event.target) && !event.target.closest(".monthDot")) {
    closePostPopover();
  }
});

tagsBtn.addEventListener("click", () => showDrawer("tags"));
templatesBtn.addEventListener("click", () => showDrawer("templates"));
aiAssistantBtn.addEventListener("click", () => showDrawer("ai"));
previewToggleBtn.addEventListener("click", () => {
  document.querySelector(".facebookPreview").classList.toggle("collapsed");
});

async function uploadMediaFile(file) {
  if (!file) return;
  const kind = mediaKindFromFile(file);
  if (!kind) {
    setFormMessage("Chỉ hỗ trợ ảnh jpg/png/webp hoặc video mp4/mov/webm.", "error");
    return;
  }
  const limits = mediaLimits();
  const limit = limits[kind]?.maxBytes || defaultMediaLimits[kind].maxBytes;
  if (file.size > limit) {
    setFormMessage(`${kind === "video" ? "Video" : "Ảnh"} lớn hơn giới hạn ${formatBytes(limit)}.`, "error");
    return;
  }
  const body = new FormData();
  body.set("media", file);
  setFormMessage(`Đang upload ${kind === "video" ? "video" : "ảnh"}...`);
  const uploaded = await request("/api/uploads/media", { method: "POST", body });
  postForm.imageUrl.value = uploaded.url;
  if (kind === "video" && postForm.format.value === "post") {
    const reel = [...postForm.format].find((input) => input.value === "reel");
    if (reel) reel.checked = true;
  }
  updatePreview();
  setFormMessage(`Đã upload ${kind === "video" ? "video" : "ảnh"} lên server.`, "success");
}

uploadDrop.addEventListener("click", () => {
  mediaFileInput.click();
});
uploadDrop.addEventListener("dragover", (event) => {
  event.preventDefault();
  uploadDrop.classList.add("dragging");
});
uploadDrop.addEventListener("dragleave", () => uploadDrop.classList.remove("dragging"));
uploadDrop.addEventListener("drop", async (event) => {
  event.preventDefault();
  uploadDrop.classList.remove("dragging");
  try {
    await uploadMediaFile(event.dataTransfer.files[0]);
  } catch (error) {
    setFormMessage(error.message || "Upload media thất bại.", "error");
  }
});
mediaFileInput.addEventListener("change", async () => {
  try {
    await uploadMediaFile(mediaFileInput.files[0]);
  } catch (error) {
    setFormMessage(error.message || "Upload media thất bại.", "error");
  } finally {
    mediaFileInput.value = "";
  }
});
postForm.format.forEach((radio) => {
  radio.addEventListener("change", () => {
    const formatLabels = { post: "bài viết", reel: "reel", story: "tin" };
    const format = postForm.format.value;
    previewToggleBtn.textContent = `Xem trước ${formatLabels[format] || format}`;
    const suffix = format === "post" ? "" : " Video hiện lưu lịch/preview trong pilot; đăng thật cần API video riêng.";
    setFormMessage(`Đang soạn định dạng ${formatLabels[format] || format}.${suffix}`, "info");
    updatePreview();
  });
});
document.querySelectorAll("[data-tool]").forEach((button) => {
  button.addEventListener("click", () => {
    const tool = button.dataset.tool;
    if (tool === "media") {
      imageUrlField.scrollIntoView({ behavior: "smooth", block: "center" });
      postForm.imageUrl.focus();
    }
    if (tool === "schedule") {
      postForm.scheduledAt.scrollIntoView({ behavior: "smooth", block: "center" });
      postForm.scheduledAt.focus();
    }
    if (tool === "emoji") insertAtCursor(" 😊");
    if (tool === "hashtag") insertAtCursor(" #page #content");
    if (tool === "shortlink") insertAtCursor("\n\nInbox page để nhận tư vấn nhé.");
  });
});

upgradeBtn.addEventListener("click", openPaywallModal);
closePaywallModal.addEventListener("click", closePaywall);
paywallModal.addEventListener("click", (event) => {
  if (event.target === paywallModal) closePaywall();
});
proSignupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(proSignupForm);
  const paidUntil = new Date();
  paidUntil.setMonth(paidUntil.getMonth() + 1);
  localStorage.setItem(storageKeys.proPlan, JSON.stringify({
    name: String(form.get("name") || "").trim(),
    contact: String(form.get("contact") || "").trim(),
    paidAt: new Date().toISOString(),
    paidUntil: paidUntil.toISOString(),
    amount: 20000
  }));
  closePaywall();
});

confirmDeleteBtn.addEventListener("click", async () => {
  if (!pendingDeleteId) return;
  await request(`/api/posts/${pendingDeleteId}`, { method: "DELETE" });
  closeDeleteModal();
  if (editingPostId === pendingDeleteId) closePostComposer();
  await loadPosts();
});
deleteFromEditorBtn.addEventListener("click", () => {
  if (editingPostId) openDeleteModal(editingPostId);
});
cancelDeleteBtn.addEventListener("click", closeDeleteModal);
deleteModal.addEventListener("click", (event) => {
  if (event.target === deleteModal) closeDeleteModal();
});

dismissSetup.addEventListener("click", () => {
  localStorage.setItem(storageKeys.setupDismissed, "true");
  setupCard.hidden = true;
});

setupItems.forEach((item) => {
  item.addEventListener("click", () => {
    if (item.hasAttribute("data-open-post-modal")) {
      openPostModal();
      return;
    }
    if (item.hasAttribute("data-open-channel-modal")) {
      openChannelModal();
      return;
    }
    document.querySelector(item.dataset.setupJump)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
});

closeChannelModal.addEventListener("click", closeModal);
backToChannels.addEventListener("click", showChannelPicker);
channelModal.addEventListener("click", (event) => {
  if (event.target === channelModal) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closePostPopover();
  if (!postModal.hidden) closePostComposer();
  if (!channelModal.hidden) closeModal();
  if (!paywallModal.hidden) closePaywall();
  if (!deleteModal.hidden) closeDeleteModal();
});

connectForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(connectForm);
  const meta = getChannelMeta(selectedChannelType);
  const handle = String(form.get("handle") || "").trim();
  if (selectedChannelType === "facebook") {
    alert("Facebook Page chinh duoc cau hinh bang .env tren server. Sua FB_PAGE_ID roi restart server.");
    closeModal();
    return;
  }
  if (selectedChannelType === "facebook" && handle && !/^\d+$/.test(handle)) {
    alert("Facebook Page ID phải là số. Không dán URL Page vào ô này.");
    return;
  }
  const channels = getChannels();
  channels.push({
    type: selectedChannelType,
    name: String(form.get("name") || meta.name).trim(),
    handle
  });
  saveChannels(channels);
  renderChannels();
  renderSetup();
  closeModal();
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentView = button.dataset.view;
    viewButtons.forEach((item) => item.classList.toggle("selected", item === button));
    renderPosts();
  });
});

function setActiveNav(hash) {
  navLinks.forEach((link) => {
    const isActive = link.getAttribute("href") === hash && !link.hasAttribute("data-open-post-modal");
    link.classList.toggle("active", isActive);
  });
}

navLinks.forEach((link) => {
  link.addEventListener("click", () => setActiveNav(link.getAttribute("href")));
});

const sectionObserver = new IntersectionObserver((entries) => {
  const visible = entries
    .filter((entry) => entry.isIntersecting)
    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (visible) setActiveNav(`#${visible.target.id}`);
}, { rootMargin: "-25% 0px -55% 0px", threshold: [0.1, 0.35, 0.6] });
["calendar", "import"].forEach((id) => {
  const section = document.getElementById(id);
  if (section) sectionObserver.observe(section);
});

sampleBtn.addEventListener("click", () => {
  csvInput.value = csvSampleText();
  renderCsvPreview();
});

downloadSampleBtn.addEventListener("click", () => {
  const blob = new Blob([csvSampleText()], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mau-lich-dang-facebook.csv";
  anchor.click();
  URL.revokeObjectURL(url);
});

csvInput.addEventListener("input", renderCsvPreview);

csvDropzone.addEventListener("click", () => csvFileInput.click());
csvDropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  csvDropzone.classList.add("dragging");
});
csvDropzone.addEventListener("dragleave", () => csvDropzone.classList.remove("dragging"));
csvDropzone.addEventListener("drop", async (event) => {
  event.preventDefault();
  csvDropzone.classList.remove("dragging");
  const file = event.dataTransfer.files[0];
  if (!file) return;
  csvInput.value = await file.text();
  renderCsvPreview();
});
csvFileInput.addEventListener("change", async () => {
  const file = csvFileInput.files[0];
  if (!file) return;
  csvInput.value = await file.text();
  renderCsvPreview();
  csvFileInput.value = "";
});

importBtn.addEventListener("click", async () => {
  const previewRows = getCsvPreviewRows();
  const imported = previewRows.filter((item) => !item.errors.length).map((item) => item.row);
  if (!previewRows.length) {
    alert("CSV chưa có dữ liệu.");
    return;
  }
  if (!imported.length) {
    alert("Chưa có dòng hợp lệ để nhập. Kiểm tra preview lỗi trước nhé.");
    return;
  }
  try {
    await request("/api/import", {
      method: "POST",
      body: JSON.stringify({ posts: imported })
    });
    localStorage.setItem(storageKeys.importedPlan, "true");
    csvInput.value = "";
    renderCsvPreview();
    await loadPosts();
    if (imported.length < previewRows.length) {
      alert(`Đã nhập ${imported.length} dòng hợp lệ. ${previewRows.length - imported.length} dòng lỗi vẫn cần sửa.`);
    }
  } catch (error) {
    alert(userFacingError(error, "Import thất bại."));
  }
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(loginForm);
  loginMessage.textContent = "Đang đăng nhập...";
  loginMessage.className = "formMessage";
  try {
    await request("/api/login", {
      method: "POST",
      body: JSON.stringify(Object.fromEntries(form.entries()))
    });
    hideLoginModal();
    await loadConfig();
    await loadPosts();
  } catch (error) {
    loginMessage.textContent = error.message || "Đăng nhập thất bại.";
    loginMessage.className = "formMessage error";
  }
});

setSelectedTag("");
await loadConfig();
updatePreview();
await loadPosts();
setInterval(loadPosts, 30_000);
