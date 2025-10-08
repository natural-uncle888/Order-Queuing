// ---------- Utilities ----------
const $ = (id) => document.getElementById(id);
const fmtCurrency = n => Number(n||0).toLocaleString('zh-TW', {style:'currency', currency:'TWD', maximumFractionDigits:0});
const today = new Date();
const pad2 = n => n.toString().padStart(2,'0');
const SLOT_OPTS = ['平日','假日','上午','下午','皆可','日期指定'];
const CONTACT_TIME_OPTS = ['平日','假日','上午','下午','晚上','皆可','時間指定'];
const FLOOR_OPTS = ['1F','2F','3F','4F','5F','5F以上','有電梯'];
const STATUS_FLOW = ['排定','完成','未完成'];

function renderChecks(containerId, options, name){
  const el = $(containerId);
  el.innerHTML = options.map(opt => `<label class="checkbox"><input type="checkbox" data-name="${name}" value="${opt}"><span>${opt}</span></label>`).join('');
}
function getChecked(name){ return Array.from(document.querySelectorAll('input[type="checkbox"][data-name="'+name+'"]:checked')).map(x=>x.value); }
function setChecked(name, values){ const set = new Set(values); document.querySelectorAll('input[type="checkbox"][data-name="'+name+'"]').forEach(el => { el.checked = set.has(el.value); }); }

// ---- Reminder by Item Type ----
function getNextDueDatePerItem(order) {
  const result = [];
  const baseDate = new Date(order.date);
  if (order.acSplit || order.acDuct) {
    const next = new Date(baseDate);
    next.setFullYear(next.getFullYear() + 2);  // 冷氣：2年
    result.push({ item: '冷氣', nextDue: next });
  }
  if (order.washerTop) {
    const next = new Date(baseDate);
    next.setMonth(next.getMonth() + 18); // 洗衣機：1.5年
    result.push({ item: '洗衣機', nextDue: next });
  }
  if (order.waterTank) {
    const next = new Date(baseDate);
    next.setFullYear(next.getFullYear() + 2);  // 水塔：2年
    result.push({ item: '水塔', nextDue: next });
  }
  return result;
}

function reminderFlagsForCustomerItemWise(name) {
  const matchedOrders = orders.filter(o => o.customer === name);
  const items = [];
  for (const o of matchedOrders) {
    const dueList = getNextDueDatePerItem(o);
    for (const { item, nextDue } of dueList) {
      items.push({ item, nextDue });
    }
  }
  const grouped = {};
  for (const { item, nextDue } of items) {
    if (!grouped[item] || nextDue < grouped[item]) {
      grouped[item] = nextDue;
    }
  }
  return grouped;
}

function checkUpcomingItemReminders() {
  const seen = new Set();
  const today = new Date();
  for (const o of orders) {
    const name = o.customer;
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const itemDueMap = reminderFlagsForCustomerItemWise(name);
    const upcoming = Object.entries(itemDueMap)
      .map(([item, date]) => {
        const days = Math.floor((date - today) / (1000 * 60 * 60 * 24));
        return { item, days };
      })
      .filter(({ days }) => days <= 30);
    if (upcoming.length > 0) {
      console.log(`🔔 ${name} 將到期品項：`);
      for (const { item, days } of upcoming) {
        console.log(`  - ${item} 剩 ${days} 天`);
      }
    }
  }
}

// 可在初始化階段加上呼叫
window.addEventListener('DOMContentLoaded', () => {
  checkUpcomingItemReminders();
});
