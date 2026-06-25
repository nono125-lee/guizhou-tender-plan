const FUND_TAG_ORDER = [
  "超长期",
  "政府投资",
  "财政资金",
  "上级补助",
  "国有资金",
  "专项债",
  "地方自筹",
  "企业自筹",
  "银行贷款",
  "社会资本",
  "其他",
  "未载明"
];
const PREFECTURE_LABELS = {
  "贵阳市": "贵阳",
  "六盘水市": "六盘水",
  "遵义市": "遵义",
  "安顺市": "安顺",
  "毕节市": "毕节",
  "铜仁市": "铜仁",
  "黔西南布依族苗族自治州": "黔西南",
  "黔东南苗族侗族自治州": "黔东南",
  "黔南布依族苗族自治州": "黔南",
  "贵安新区": "贵安"
};
const state = { items: [], payload: null, activeButton: "" };
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

function locationParts(item) {
  const parts = (item.project_location || "").split("-").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 3 && parts[0] === "贵州省") return { prefectureRaw: parts[1], district: parts[2] };
  if (parts.length >= 2) return { prefectureRaw: parts.at(-2), district: parts.at(-1) };
  return { prefectureRaw: "", district: item.region || "" };
}

function prefectureOf(item) {
  const raw = locationParts(item).prefectureRaw;
  return PREFECTURE_LABELS[raw] || raw || "未载明";
}

function districtOf(item) {
  return locationParts(item).district || item.region || "未载明";
}

function isUltraLongBond(item) {
  return /超长期(?:特别)?国债|特别国债/.test(item.fund_source || "");
}

function populateFilters(items) {
  optionList($("#prefecture"), [...new Set(items.map(prefectureOf))]);
  updateDistrictOptions();
  optionList($("#source"), [...new Set(items.map((item) => item.source_name))]);
}

function updateDistrictOptions() {
  const prefecture = $("#prefecture").value;
  const values = state.items
    .filter((item) => !prefecture || prefectureOf(item) === prefecture)
    .map(districtOf);
  optionList($("#district"), [...new Set(values)]);
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
  const prefecture = $("#prefecture").value;
  const district = $("#district").value;
  const source = $("#source").value;
  const dateRange = $("#date-range").value;
  const plannedMonth = $("#planned-month").value;
  const button = state.activeButton;
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
  const passButton = !button
    || (button === "超长期" ? isUltraLongBond(item) : (item.fund_source_tags || []).includes(button));
  return (!query || haystack.includes(query))
    && (!prefecture || prefectureOf(item) === prefecture)
    && (!district || districtOf(item) === district)
    && (!source || item.source_name === source)
    && passDate
    && passPlanned
    && passButton;
}

function renderFundStrip() {
  const counts = new Map();
  state.items.forEach((item) => {
    (item.fund_source_tags || ["未载明"]).forEach((tag) => counts.set(tag, (counts.get(tag) || 0) + 1));
  });
  counts.set("超长期", state.items.filter(isUltraLongBond).length);
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
      button.className = state.activeButton === tag ? "active" : "";
      button.addEventListener("click", () => {
        state.activeButton = state.activeButton === tag ? "" : tag;
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
  template.querySelector(".planned-content").textContent = `拟招标内容：${valueOrBlank(item.planned_tender_content)}`;
  template.querySelector(".fund-source").textContent = valueOrBlank(item.fund_source);
  template.querySelector(".location").textContent = valueOrBlank(item.project_location || item.region);
  template.querySelector(".content").textContent = valueOrBlank(item.project_content);
  const tags = template.querySelector(".tag-row");
  (item.fund_source_tags || ["未载明"]).forEach((tag) => {
    const chip = document.createElement("span");
    chip.textContent = tag;
    tags.append(chip);
  });
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

["search", "district", "date-range", "source", "planned-month"].forEach((id) => {
  const element = $(`#${id}`);
  element.addEventListener(element.tagName === "INPUT" ? "input" : "change", render);
});

$("#prefecture").addEventListener("change", () => {
  updateDistrictOptions();
  render();
});

$("#reset").addEventListener("click", () => {
  ["search", "prefecture", "district", "source", "planned-month"].forEach((id) => { $(`#${id}`).value = ""; });
  $("#date-range").value = "all";
  state.activeButton = "";
  updateDistrictOptions();
  render();
});

load();
