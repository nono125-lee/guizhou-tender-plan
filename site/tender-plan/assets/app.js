const FUND_TAG_ORDER = [
  "政府投资",
  "财政资金",
  "上级补助",
  "地方自筹",
  "专项债",
  "企业自筹",
  "银行贷款",
  "社会资本",
  "国有资金",
  "其他",
  "未载明"
];
const state = { items: [], payload: null };
const $ = (selector) => document.querySelector(selector);

function valueOrBlank(value) {
  return value && String(value).trim() ? String(value).trim() : "未载明";
}

function parseDate(value) {
  const text = (value || "").slice(0, 10);
  const date = new Date(`${text}T00:00:00+08:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysAgo(days) {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - Number(days));
  return date;
}

function optionList(select, values) {
  const current = select.value;
  select.querySelectorAll("option:not([value=''])").forEach((option) => option.remove());
  values.filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-CN")).forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.append(option);
  });
  if ([...select.options].some((option) => option.value === current)) select.value = current;
}

function populateFilters(items) {
  optionList($("#region"), [...new Set(items.map((item) => item.region))]);
  optionList($("#source"), [...new Set(items.map((item) => item.source_name))]);
  const tags = [...new Set(items.flatMap((item) => item.fund_source_tags || ["未载明"]))];
  optionList($("#fund-tag"), tags);
}

function updateStats(payload) {
  const stats = payload.stats || {};
  $("#stat-total").textContent = stats.total || 0;
  $("#stat-source").textContent = stats.source_total || 0;
  $("#stat-new").textContent = stats.new_today || 0;
  $("#stat-regions").textContent = stats.regions || 0;
  $("#source-link").href = payload.source_url || $("#source-link").href;
  const updated = payload.updated_at ? new Date(payload.updated_at) : null;
  $("#updated-at").textContent = updated
    ? `更新 ${updated.toLocaleString("zh-CN", { hour12: false })}`
    : "更新未知";
  if (payload.warnings?.length) {
    $("#warning").hidden = false;
    $("#warning").textContent = payload.warnings.slice(0, 6).join("；");
  }
}

function passFilters(item) {
  const query = $("#search").value.trim().toLowerCase();
  const region = $("#region").value;
  const source = $("#source").value;
  const dateRange = $("#date-range").value;
  const plannedMonth = $("#planned-month").value;
  const fundTag = $("#fund-tag").value;
  const haystack = [
    item.title,
    item.project_name,
    item.buyer,
    item.agency,
    item.project_content,
    item.project_location,
    item.fund_source,
    ...(item.fund_source_tags || [])
  ].join(" ").toLowerCase();
  const published = parseDate(item.published_at);
  const passDate = dateRange === "all" || (published && published >= daysAgo(dateRange));
  const passPlanned = !plannedMonth || (item.planned_bid_time || "").startsWith(plannedMonth);
  const passFundTag = !fundTag || (item.fund_source_tags || []).includes(fundTag);
  return (!query || haystack.includes(query))
    && (!region || item.region === region)
    && (!source || item.source_name === source)
    && passDate
    && passPlanned
    && passFundTag;
}

function renderFundStrip() {
  const counts = new Map();
  state.items.forEach((item) => {
    (item.fund_source_tags || ["未载明"]).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  });
  const strip = $("#fund-strip");
  strip.replaceChildren();
  const allTags = [...new Set([...FUND_TAG_ORDER, ...counts.keys()])];
  allTags
    .sort((a, b) => {
      const ai = FUND_TAG_ORDER.indexOf(a);
      const bi = FUND_TAG_ORDER.indexOf(b);
      if (ai >= 0 || bi >= 0) return (ai < 0 ? 999 : ai) - (bi < 0 ? 999 : bi);
      return a.localeCompare(b, "zh-CN");
    })
    .forEach((tag) => {
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `<span>${tag}</span><strong>${counts.get(tag) || 0}</strong>`;
      button.className = $("#fund-tag").value === tag ? "active" : "";
      button.addEventListener("click", () => {
        $("#fund-tag").value = $("#fund-tag").value === tag ? "" : tag;
        render();
      });
      strip.append(button);
    });
}

function renderCard(item, index) {
  const template = $("#plan-card").content.cloneNode(true);
  const article = template.querySelector(".plan-card");
  if (item.is_new) article.classList.add("is-new");
  template.querySelector(".card-no").textContent = String(index + 1).padStart(2, "0");
  template.querySelector("time").textContent = valueOrBlank((item.published_at || "").slice(0, 10));
  template.querySelector(".region").textContent = valueOrBlank(item.region);
  template.querySelector(".notice-type").textContent = valueOrBlank(item.notice_type);
  const title = template.querySelector("h2 a");
  title.href = item.url;
  title.textContent = item.project_name || item.title;
  template.querySelector(".buyer").textContent = valueOrBlank(item.buyer);
  template.querySelector(".agency").textContent = valueOrBlank(item.agency);
  template.querySelector(".planned-time").textContent = valueOrBlank(item.planned_bid_time);
  template.querySelector(".budget").textContent = valueOrBlank(item.budget);
  template.querySelector(".fund-source").textContent = valueOrBlank(item.fund_source);
  template.querySelector(".location").textContent = valueOrBlank(item.project_location || item.region);
  template.querySelector(".content").textContent = valueOrBlank(item.project_content);
  const tags = template.querySelector(".tag-row");
  (item.fund_source_tags || ["未载明"]).forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = tag;
    tags.append(chip);
  });
  if (item.planned_tender_content) {
    const chip = document.createElement("span");
    chip.textContent = item.planned_tender_content;
    tags.append(chip);
  }
  const open = template.querySelector(".open-link");
  open.href = item.url;
  article.style.animationDelay = `${Math.min(index * 24, 260)}ms`;
  return template;
}

function render() {
  const items = state.items.filter(passFilters);
  const list = $("#list");
  list.replaceChildren();
  $("#result-count").textContent = items.length;
  $("#empty").hidden = items.length > 0;
  renderFundStrip();
  items.forEach((item, index) => list.append(renderCard(item, index)));
}

async function load() {
  try {
    const response = await fetch(`./data/latest.json?v=${Date.now()}`);
    if (!response.ok) throw new Error("数据读取失败");
    const payload = await response.json();
    state.payload = payload;
    state.items = payload.items || [];
    updateStats(payload);
    populateFilters(state.items);
    render();
  } catch (error) {
    $("#warning").hidden = false;
    $("#warning").textContent = `${error.message}。`;
  }
}

["search", "region", "date-range", "source", "planned-month", "fund-tag"].forEach((id) => {
  const element = $(`#${id}`);
  element.addEventListener(element.tagName === "INPUT" ? "input" : "change", render);
});

$("#reset").addEventListener("click", () => {
  ["search", "region", "source", "planned-month", "fund-tag"].forEach((id) => { $(`#${id}`).value = ""; });
  $("#date-range").value = "all";
  render();
});

load();
