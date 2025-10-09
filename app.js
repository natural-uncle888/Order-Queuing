// ---------- Utilities ----------
    const $ = (id) => document.getElementById(id);
    const fmtCurrency = n => Number(n||0).toLocaleString('zh-TW', {style:'currency', currency:'TWD', maximumFractionDigits:0});
    const today = new Date();
    const pad2 = n => n.toString().padStart(2,'0');
    const SLOT_OPTS = ['平日','假日','上午','下午','皆可','日期指定'];
    const CONTACT_TIME_OPTS = ['平日','假日','上午','下午','晚上','皆可','時間指定'];
    const FLOOR_OPTS = ['1F','2F','3F','4F','5F','5F以上','透天（同樓層）','大樓（同樓層）'];
    const STATUS_FLOW = ['排定','完成','未完成'];

    function renderChecks(containerId, options, name){
      const el = $(containerId);
      el.innerHTML = options.map(opt => `<label class="checkbox"><input type="checkbox" data-name="${name}" value="${opt}"><span>${opt}</span></label>`).join('');
    }
    function getChecked(name){ return Array.from(document.querySelectorAll('input[type="checkbox"][data-name="'+name+'"]:checked')).map(x=>x.value); }
    function setChecked(name, values){ const set = new Set(values||[]); document.querySelectorAll('input[type="checkbox"][data-name="'+name+'"]').forEach(x=> x.checked = set.has(x.value)); }

    // ---------- Storage ----------
    const KEY = 'yl_clean_orders_v1';
    const STAFF_KEY = 'yl_clean_staff_v1';
    const CONTACT_KEY = 'yl_clean_contact_v1';
    const EXP_KEY = 'yl_clean_expenses_v1';
    const EXP_CAT_KEY = 'yl_clean_expense_categories_v1';
    const load = (k, fallback) => { try{ return JSON.parse(localStorage.getItem(k) || 'null') ?? fallback; }catch{ return fallback; } }
    const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    let orders = load(KEY, []);
    let staffList = load(STAFF_KEY, ['自然大叔']);
    let contactList = load(CONTACT_KEY, ['Line','Facebook粉絲團','直接線上預約','直接來電','裕良電器行','其他']);
    let expenses = load(EXP_KEY, []);
    let expCats = load(EXP_CAT_KEY, ['材料','加油','停車','工具/維修','其他']);


    const CONTACTS_KEY = 'yl_clean_contacts_v1';
    let contacts = load(CONTACTS_KEY, []); // {id,name,phone,address,lineId}
    function normalizePhone(p){ return (p||'').replace(/\D+/g,''); }

// ---------- Validation ----------
function isValidTwMobile(p){
  // Accept forms like 0912345678 or 0912-345-678
  const digits = (p||'').replace(/\D+/g, '');
  return /^09\d{8}$/.test(digits);
}

// --- Added: Taiwan landline + combined validator (v2, fixed recursion) ---
function isValidTwLandline(p){
  const digits = (p||'').replace(/\D+/g, '');
  if(!/^0\d+$/.test(digits)) return false;
  if(digits.startsWith('09')) return false; // mobile handled by isValidTwMobile
  // Taiwan landlines (w/ area code) are typically 9~10 digits, e.g. 02-xxxx-xxxx / 03-xxxxxxx / 0836-xxxxxx
  return digits.length >= 9 && digits.length <= 10;
}
function isValidTwPhone(p){ return isValidTwMobile(p) || isValidTwLandline(p);
}
// -------------------------------------------------------------------------


    function upsertContact(name, phone, address, lineId){
  const np = normalizePhone(phone);
  const lid = (lineId||'').trim();
  if(!name && !np && !lid) return;
  let idx = -1;
  if (np) idx = contacts.findIndex(c => normalizePhone(c.phone)===np);
  if (idx < 0 && lid) idx = contacts.findIndex(c => (c.lineId||'').trim()===lid);
  if(idx>=0){
    // merge
    contacts[idx].name = contacts[idx].name || name;
    contacts[idx].address = contacts[idx].address || address;
    if(lid) contacts[idx].lineId = contacts[idx].lineId || lineId;
    if(np) contacts[idx].phone = contacts[idx].phone || phone;
  } else {
    contacts.push({id: crypto.randomUUID(), name: name||'', phone: phone||'', address: address||'', lineId: lineId||''});
  }
  save(CONTACTS_KEY, contacts);
  refreshContactsDatalist();
}
function findContactByName(name){
      const n=(name||'').trim();
      if(!n) return null;
      const list = contacts.filter(c => (c.name||'')===n);
      if(list.length===1) return list[0];
      return null;
    }
    function findContactByLineId(lineId){
  const lid = (lineId||'').trim();
  if(!lid) return null;
  return contacts.find(c => (c.lineId||'').trim()===lid) || null;
}
function findContactByPhone(phone){
      const np = normalizePhone(phone);
      if(!np) return null;
      return contacts.find(c => normalizePhone(c.phone)===np) || null;
    }
    function refreshContactsDatalist(){
      const dl = document.getElementById('contactsDL');
      if(!dl) return;
      dl.innerHTML = contacts.map(c => `<option value="${(c.name||'')}" label="${(c.phone||'')} ${(c.address||'')}"></option>`).join('');
    }


    // ---------- Init ----------
    function initYearMonth(){
      const yearSel = $('yearSel'), monthSel = $('monthSel');
      const yearNow = new Date().getFullYear();
      const years = []; for(let y=yearNow-3;y<=yearNow+3;y++) years.push(y);
      yearSel.innerHTML = years.map(y=>`<option value="${y}" ${y===yearNow?'selected':''}>${y} 年</option>`).join('');
      monthSel.innerHTML = Array.from({length:12},(_,i)=>i+1).map(m=>`<option value="${m}" ${m===today.getMonth()+1?'selected':''}>${m} 月</option>`).join('');
      yearSel.onchange = monthSel.onchange = ()=>{ refreshTable(); refreshExpense(); };
      $('showUndated').onchange = refreshTable;
    }
    function initFilters(){
      $('staffFilter').innerHTML = ['全部',...staffList].map(s=>`<option value="${s==='全部'?'':s}">${s}</option>`).join('');
      $('staffFilter').onchange = refreshTable;
      $('statusFilter').onchange = refreshTable;
      $('completedRange').onchange = refreshTable;
      $('searchInput').addEventListener('input', refreshTable);
    }
    function initStaffSelects(){ $('staff').innerHTML = staffList.map(s=>`<option value="${s}">${s}</option>`).join(''); initFilters(); }
    function initContactSelect(){ $('contactMethod').innerHTML = contactList.map(c=>`<option value="${c}">${c}</option>`).join(''); }
    function initCheckboxes(){ renderChecks('slotGroup', SLOT_OPTS, 'slot'); renderChecks('contactTimesGroup', CONTACT_TIME_OPTS, 'contactTime'); renderChecks('acFloors', FLOOR_OPTS, 'acFloor'); renderChecks('washerFloors', FLOOR_OPTS, 'washerFloor'); updateAbove5Visibility(); }
    function initExpenseCats(){ $('expCategory').innerHTML = expCats.map(c=>`<option value="${c}">${c}</option>`).join(''); }

    

// ---------- Reminder Utilities ----------

function reminderFlagsForCustomer(name){
  const n=(name||'').trim(); if(!n) return {muted:false, notified:false};
  const related = orders
    .filter(o => (o.customer||'').trim()===n)
    .sort((a,b)=> new Date(b.createdAt||b.date||b.completedAt||0) - new Date(a.createdAt||a.date||a.completedAt||0));
  if(related.length===0) return {muted:false, notified:false};
  const last = related[0];
  return { muted: !!last.reminderMuted, notified: !!last.reminderNotified };
}

function addMonths(dateStr, months){
  if(!dateStr) return null;
  const d = new Date(dateStr);
  if(isNaN(d)) return null;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if(d.getDate() < day) d.setDate(0);
  return d;
}

function fmtDate(d){
  if(!d) return '';
  const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), dd = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${dd}`;
}

function lastCompletedDateForCustomer(name){
  const n = (name||'').trim();
  if(!n) return null;
  // find latest order with status 完成 for this customer
  const done = orders
    .filter(o => (o.customer||'').trim()===n && (o.status||'')==='完成' && (o.date || o.completedAt))
    .sort((a,b)=> new Date(b.date||b.completedAt) - new Date(a.date||a.completedAt));
  if(done.length===0) return null;
  return done[0].date || done[0].completedAt;
}

function reminderMonthsForCustomer(name){
  const n = (name||'').trim();
  if(!n) return 0;
  // prefer the last completed order's reminderMonths if set; else the latest order's setting
  const related = orders
    .filter(o => (o.customer||'').trim()===n)
    .sort((a,b)=> new Date(b.createdAt||b.date||b.completedAt||0) - new Date(a.createdAt||a.date||a.completedAt||0));
  if(related.length===0) return 0;
  const lastDone = related.find(o => (o.status||'')==='完成' && +o.reminderMonths>0);
  if(lastDone) return +lastDone.reminderMonths;
  const any = related.find(o => +o.reminderMonths>0);
  return any ? +any.reminderMonths : 0;
}

function nextDueDateForCustomer(name){
  const months = reminderMonthsForCustomer(name);
  if(!months) return null;
  const last = lastCompletedDateForCustomer(name);
  if(!last) return null;
  return addMonths(last, months);
}

// ---------- Pricing (extracted constants) ----------
const PRICING = {
  acSplit: { unit: 1800, bulk3plus: 1500 },
  acDuct: { unit: 2800 },
  washerTop: { withAC: 1800, withoutAC: 2000 },
  waterTank: { unit: 1000 },
  pipesAmount: { passthrough: true }, // already in TWD
  antiMold: { unit: 300, bulk5plus: 250 },
  ozone: { unit: 200 },
  transformerCount: { unit: 500 },
  longSplitCount: { unit: 300 },
  onePieceTray: { unit: 500 },
  // 滿額規則（目前未使用，可於此調整）
  thresholds: {
    // example: freeShippingOver: 5000
  }
};

function calcTotal(f){
  const acSplit=+f.acSplit||0, acDuct=+f.acDuct||0, washerTop=+f.washerTop||0, waterTank=+f.waterTank||0;
  const pipesAmount=+f.pipesAmount||0, antiMold=+f.antiMold||0, ozone=+f.ozone||0, transformerCount=+f.transformerCount||0;
  const longSplitCount=+f.longSplitCount||0, onePieceTray=+f.onePieceTray||0;

  const splitUnit = acSplit>=3 ? PRICING.acSplit.bulk3plus : PRICING.acSplit.unit;
  const splitTotal = acSplit * splitUnit;

  const ductTotal = acDuct * PRICING.acDuct.unit;

  const washerUnit = (acSplit + acDuct) > 0 ? PRICING.washerTop.withAC : PRICING.washerTop.withoutAC;
  const washerTotal = washerTop * washerUnit;

  const tankTotal = waterTank * PRICING.waterTank.unit;

  const pipesTotal = Math.max(0, pipesAmount); // passthrough

  const antiMoldUnit = antiMold >= 5 ? PRICING.antiMold.bulk5plus : PRICING.antiMold.unit;
  const antiMoldTotal = antiMold * antiMoldUnit;

  const ozoneTotal = ozone * PRICING.ozone.unit;
  const transformerTotal = transformerCount * PRICING.transformerCount.unit;
  const longSplitTotal = longSplitCount * PRICING.longSplitCount.unit;
  const onePieceTotal = onePieceTray * PRICING.onePieceTray.unit;

  const total = splitTotal + ductTotal + washerTotal + tankTotal + pipesTotal + antiMoldTotal + ozoneTotal + transformerTotal + longSplitTotal + onePieceTotal;
  return Math.max(0, Math.round(total));
}

function gatherForm(){
      return {
    
    
        reminderEnabled: !!($('reminderEnabled')?.checked),
        reminderMonths: +$('reminderMonths')?.value || 0,

        reminderNotified: !!($('reminderNotified')?.checked),
        reminderMuted: !!($('reminderMuted')?.checked),
acFloorAbove: (document.querySelector('input[type="checkbox"][data-name="acFloor"][value="5F以上"]:checked') ? ($('acFloorAbove')?.value||'').trim() : ''),
    washerFloorAbove: (document.querySelector('input[type="checkbox"][data-name="washerFloor"][value="5F以上"]:checked') ? ($('washerFloorAbove')?.value||'').trim() : ''),
durationMinutes: +$('durationMinutes').value || 120,
        id: $('id').value || crypto.randomUUID(),
        staff:$('staff').value, date:$('date').value, time:$('time').value,
        confirmed:$('confirmed')?.checked||false, quotationOk:$('quotationOk')?.checked||false,
        customer:$('customer').value.trim(), lineId:$('lineId').value.trim(), phone:$('phone').value.trim(),
        slots:getChecked('slot'), slotNote:$('slotNote')?.value.trim()||'', address:$('address').value.trim(),
        residenceType:$('residenceType')?.value||'', residenceOther:$('residenceOther')?.value.trim()||'',
        contactTimes:getChecked('contactTime'), contactTimeNote:$('contactTimeNote')?.value.trim()||'',
        acFloors:getChecked('acFloor'), washerFloors:getChecked('washerFloor'),
        contactMethod:$('contactMethod').value, status:$('status').value,
        acSplit:+$('acSplit').value||0, acDuct:+$('acDuct').value||0, washerTop:+$('washerTop').value||0, waterTank:+$('waterTank').value||0,
        pipesAmount:+$('pipesAmount').value||0, antiMold:+$('antiMold').value||0, ozone:+$('ozone').value||0,
        transformerCount:+$('transformerCount').value||0, longSplitCount:+$('longSplitCount').value||0, onePieceTray:+$('onePieceTray').value||0,
        note:$('note').value.trim(), total:+$('total').value||0, extraCharge:+$('extraCharge').value||0, discount:+$('discount').value||0, netTotal:+$('netTotal').value||0,
        createdAt:$('id').value ? undefined : new Date().toISOString()
      };
    }
    function fillForm(o){
      $('orderAccordion').open = true; $('orderAccordion').scrollIntoView({behavior:'smooth', block:'start'});
      $('id').value=o.id||''; $('staff').value=o.staff||staffList[0];
      $('date').value=o.date||''; $('time').value=o.time||'';
      $('confirmed').checked=!!o.confirmed; $('quotationOk').checked=!!o.quotationOk;
      $('customer').value=o.customer||''; $('lineId').value=o.lineId||''; $('phone').value=o.phone||'';
      setChecked('slot', o.slots||[]); $('slotNote').value=o.slotNote||''; $('slotNote').classList.toggle('hidden', !((o.slots||[]).includes('日期指定') || (o.slots||[]).includes('時間指定'))); $('address').value=o.address||'';
      $('residenceType').value=o.residenceType||''; $('residenceOther').value=o.residenceOther||''; $('residenceOther').classList.toggle('hidden', (o.residenceType||'')!=='其他');
      setChecked('contactTime', o.contactTimes||[]); $('contactTimeNote').value=o.contactTimeNote||''; $('contactTimeNote').classList.toggle('hidden', !(o.contactTimes||[]).includes('時間指定'));
      setChecked('acFloor', o.acFloors||[]); setChecked('washerFloor', o.washerFloors||[]);
      updateAbove5Visibility();
      (function(){ const name=$('customer').value; const months=(+$('reminderMonths').value||24); const last=lastCompletedDateForCustomer(name); const nd=(last && months)? addMonths(last, months): null; $('nextReminder').value = nd ? fmtDate(nd) : ''; })();
      $('contactMethod').value=o.contactMethod||contactList[0]; $('status').value=o.status||'排定';
      $('reminderEnabled').checked=(o.reminderEnabled!==undefined? !!o.reminderEnabled : true); $('reminderMonths').value=(o.reminderMonths!==undefined? +o.reminderMonths : 24);
      $('reminderNotified').checked=!!o.reminderNotified; $('reminderMuted').checked=!!o.reminderMuted;
      $('acFloorAbove').value=o.acFloorAbove||''; $('washerFloorAbove').value=o.washerFloorAbove||'';
      $('acSplit').value=o.acSplit||0; $('acDuct').value=o.acDuct||0; $('washerTop').value=o.washerTop||0; $('waterTank').value=o.waterTank||0;
      $('pipesAmount').value=o.pipesAmount||0; $('antiMold').value=o.antiMold||0; $('ozone').value=o.ozone||0;
      $('transformerCount').value=o.transformerCount||0; $('longSplitCount').value=o.longSplitCount||0; $('onePieceTray').value=o.onePieceTray||0;
      $('note').value=o.note||''; $('discount').value=o.discount||0; $('total').value=o.total||0; $('netTotal').value=o.netTotal||0;
      $('deleteBtn').disabled=!o.id; $('formTitle').textContent=o.id?'編輯訂單':'新增訂單';
      setFormLock(!!o.locked);
      if(o.completedAt){ $('lockInfo').textContent = '完成於 ' + new Date(o.completedAt).toLocaleString(); }
    }
    function recalcTotals(){ const total=calcTotal(gatherForm()); $('total').value=total; const extra=Math.max(0,+$('extraCharge').value||0); const discount=Math.max(0,+$('discount').value||0); $('netTotal').value=Math.max(0,total+extra-discount); }

    function setFormLock(lock){
      const ids=['acSplit','acDuct','washerTop','waterTank','pipesAmount','antiMold','ozone','transformerCount','longSplitCount','onePieceTray','discount','recalc'];
      ids.forEach(id=>{ const el=$(id); if(el){ el.disabled = !!lock; el.readOnly = !!lock; }});
      $('toggleLock').textContent = lock ? '解除鎖定（允許修改）' : '解鎖金額編輯';
      $('lockInfo').textContent = lock ? '金額已鎖定（完成）' : '';
    }


    // ---------- Table & quick status ----------
    function nextStatus(s){ const i=STATUS_FLOW.indexOf(s); return STATUS_FLOW[(i+1)%STATUS_FLOW.length]; }
    function refreshTable(){
      const y=+$('yearSel').value, m=+$('monthSel').value, staffF=$('staffFilter').value, statusF=$('statusFilter').value, showUndated=$('showUndated').checked;
      const tbody=$('ordersTable').querySelector('tbody'); tbody.innerHTML='';
      const q = ($('searchInput')?.value || '').trim();
      const tokens = q ? q.split(/\s+/).map(t=>t.toLowerCase().replace(/\s|-/g,'')) : [];
      searchTokens = (q ? q.split(/\s+/) : []).filter(Boolean); // for highlight (not normalized)
      const hay = (o)=>[o.customer||'', o.phone||'', o.address||''].join(' ').toLowerCase().replace(/\s|-/g,'');
      const range=$('completedRange').value;
      const now=Date.now();
      const filtered=orders.filter(o=>{
        const s1=!staffF || o.staff===staffF; const s2=!statusF || o.status===statusF;
        const condQuery = tokens.length===0 || tokens.every(t => hay(o).includes(t));
        const condRange = !range || (o.completedAt && (now - new Date(o.completedAt).getTime()) <= (+range)*24*60*60*1000);
        if(!o.date){ return showUndated && s1 && s2 && condQuery && condRange; }
        const d=new Date(o.date); const ym=(d.getFullYear()===y && (d.getMonth()+1)===m);
        return ym && s1 && s2 && condQuery && condRange;
      }).sort((a,b)=>{
        if(!a.date && b.date) return -1;
        if(a.date && !b.date) return 1;
        const dc = (a.date||'9999-99-99').localeCompare(b.date||'9999-99-99');
        if(dc!==0) return dc;
        if(!a.time && b.time) return -1;
        if(a.time && !b.time) return 1;
        return (a.time||'').localeCompare(b.time||'');
      });

      filtered.forEach((o,idx)=>{
        const tr=document.createElement('tr');
        const dateCell = o.date ? o.date : '<span class="badge-soft">未排期</span>';
        tr.innerHTML=`
          <td class="small muted" data-label="#">${idx+1}</td>
          <td class="editable" data-label="日期">${dateCell}</td>
          <td class="editable" data-label="時間">${o.time ? o.time : '<span class=\"badge-soft\">未排定</span>'}</td>

          <td data-label="作業人員">${o.staff||''}</td>
          <td class="vtext" data-label="客戶">${o.customer||''}</td>
          <td data-label="電話">${o.phone||''}</td>
          <td data-label="時段">${(o.slots||[]).join('、')}</td>
          <td data-label="地址">${o.address||''}</td>
          <td class="vtext" data-label="狀況"></td>
          <td class="toggle-confirm vtext" data-label="確認"></td>
          <td class="toggle-quote vtext" data-label="報價單"></td>
          <td class="right-align" data-label="總金額">${fmtCurrency(o.total||0)}</td>
          <td class="right-align" data-label="折後">${fmtCurrency(o.netTotal||0)}</td>
          <td data-label="來源">${o.contactMethod||''}</td>
          <td class="op-cell" data-label="操作"></td`;
        const st=o.status||'排定';
        const span=document.createElement('span');
        span.className='status ' + (st==='排定'?'P排定': st==='完成'?'C完成':'N未完成');
        span.textContent=st; span.title='點一下快速切換狀況' + (o.completedAt? ('\n完成於：'+ new Date(o.completedAt).toLocaleString()) : '');
        span.addEventListener('click',(ev)=>{
          ev.stopPropagation();
          const i=orders.findIndex(x=>x.id===o.id);
          if(i>=0){ const prev=orders[i].status||'排定'; const next=nextStatus(prev); orders[i].status=next; if(next==='完成'){ orders[i].completedAt=new Date().toISOString(); orders[i].locked=true; } else { orders[i].completedAt=undefined; orders[i].locked=false; } save(KEY, orders); refreshTable(); }
        });
        tr.children[8].appendChild(span);
        tr.addEventListener('click', ()=>{ fillForm(o); });
        const dateTd = tr.children[1];
        const timeTd = tr.children[2];
        dateTd.addEventListener('click', (ev)=>{ ev.stopPropagation(); startInlineEdit(dateTd, 'date', o); });
        timeTd.addEventListener('click', (ev)=>{ ev.stopPropagation(); startInlineEdit(timeTd, 'time', o); });
        // highlight cells for search
        tr.children[4].innerHTML = highlightText(o.customer||'');
        tr.children[5].innerHTML = highlightPhone(o.phone||'');
        tr.children[7].innerHTML = highlightText(o.address||'');
        // render toggle confirm
        const ctd = tr.querySelector('.toggle-confirm');
        const qtd = tr.querySelector('.toggle-quote');
        const cspan = renderTogglePill(ctd, !!o.confirmed, '已確認', '未確認');
        const qspan = renderTogglePill(qtd, !!o.quotationOk, '已確認', '未確認');
        cspan.addEventListener('click', (ev)=>{ ev.stopPropagation(); const i=orders.findIndex(x=>x.id===o.id); if(i>=0){ orders[i].confirmed = !orders[i].confirmed; save(KEY, orders); refreshTable(); }});
        qspan.addEventListener('click', (ev)=>{ ev.stopPropagation(); const i=orders.findIndex(x=>x.id===o.id); if(i>=0){ orders[i].quotationOk = !orders[i].quotationOk; save(KEY, orders); refreshTable(); }});
        // quick delete button
        const op = tr.querySelector('.op-cell');
        const calBtn2 = document.createElement('button'); calBtn2.className='icon-btn'; calBtn2.textContent='📅';
        calBtn2.title = '加入 Google 日曆';
        calBtn2.addEventListener('click', (ev)=>{ ev.stopPropagation(); handleUploadWithAuth(o); });
        op.appendChild(calBtn2);
        const delBtn = document.createElement('button'); delBtn.className='icon-btn danger'; delBtn.textContent='刪';
        delBtn.addEventListener('click', (ev)=>{ ev.stopPropagation(); if(confirm('確定要刪除此訂單嗎？')){ orders = orders.filter(x=>x.id!==o.id); save(KEY, orders); refreshTable(); }});
        op.appendChild(delBtn);
        
        // === Mobile keep list ===
        // idx: 1:日期 2:時間 4:客戶 5:電話 7:地址 9:確認 10:報價單 12:折後 14:操作
        try {
          tr.children[1]?.classList.add('keep-mobile');   // 日期
          tr.children[2]?.classList.add('keep-mobile');   // 時間
          tr.children[4]?.classList.add('keep-mobile');   // 客戶
          tr.children[5]?.classList.add('keep-mobile');   // 電話
          tr.children[7]?.classList.add('keep-mobile');   // 地址
          tr.querySelector('.toggle-confirm')?.classList.add('keep-mobile'); // 確認
          tr.querySelector('.toggle-quote')?.classList.add('keep-mobile');   // 報價單
          tr.children[12]?.classList.add('keep-mobile');  // 折後
          tr.querySelector('.op-cell')?.classList.add('keep-mobile');        // 操作

          // === Permanently hidden columns (provide td class hooks) ===
          tr.children[6]?.classList.add('col-slot');      // 時段
          tr.children[8]?.classList.add('col-status');    // 狀況
          tr.children[11]?.classList.add('col-total');    // 總金額
        } catch(err) { /* noop */ }


        // Append floor info to 地址 cell
        try {
          const addrTd = tr.children[7];
          const acList = Array.isArray(o.acFloors) ? o.acFloors.slice() : [];
          const wList  = Array.isArray(o.washerFloors) ? o.washerFloors.slice() : [];
          const acExtra = (acList.includes('5F以上') && (o.acFloorAbove||'').trim()) ? `（實際：${(o.acFloorAbove||'').trim()}）` : '';
          const wExtra  = (wList.includes('5F以上') && (o.washerFloorAbove||'').trim()) ? `（實際：${(o.washerFloorAbove||'').trim()}）` : '';
          const parts = [];
          if (acList.length) parts.push(`冷氣：${acList.join('、')}${acExtra}`);
          if (wList.length)  parts.push(`洗衣：${wList.join('、')}${wExtra}`);
          const note = parts.length ? `<div class="floor-note">${parts.join('｜')}</div>` : '';
          addrTd.innerHTML = `${escapeHtml(o.address||'')}${note}`;
        } catch(err) { /* noop */ }
        tbody.appendChild(tr);
      });
// Summary
      refreshDueSoonPanel();
      const sumEl=$('summary'); sumEl.innerHTML='';
      // Only include dated orders of the selected month for sums
      const monthly = orders.filter(o=> o.date && (new Date(o.date).getFullYear()===y) && (new Date(o.date).getMonth()+1===m));
      const count=monthly.length, total=monthly.reduce((a,b)=>a+(+b.total||0),0), net=monthly.reduce((a,b)=>a+(+b.netTotal||0),0);
      const done=monthly.filter(o=>o.status==='完成').length, pending=monthly.filter(o=>o.status!=='完成').length;
      const undatedCount = orders.filter(o=>!o.date).length;
      const monthExpense=expenses.filter(e=>{ if(!e.date) return false; const d=new Date(e.date); return d.getFullYear()===y && (d.getMonth()+1)===m; }).reduce((a,b)=>a+(+b.amount||0),0);
      const mk=(t,v,h='')=>{const box=document.createElement('div');box.className='box';box.innerHTML=`<div class="small muted">${t}</div><div class="number">${v}</div>${h?`<div class="small muted">${h}</div>`:''}`;return box;};
      sumEl.appendChild(mk('本月訂單數', count));
      sumEl.appendChild(mk('本月總金額', fmtCurrency(total)));
      sumEl.appendChild(mk('本月折後總金額', fmtCurrency(net)));
      sumEl.appendChild(mk('本月花費', fmtCurrency(monthExpense)));
      sumEl.appendChild(mk('本月淨收入', fmtCurrency(Math.max(0, net - monthExpense))));
      sumEl.appendChild(mk('完成 / 未完成', `${done} / ${pending}`));
      if(undatedCount>0) sumEl.appendChild(mk('未排期訂單數', undatedCount, '可勾選上方「顯示未排期」查看'));
    }

    
    // ---------- Calendar Exports ----------
    function toTwo(n){ return n.toString().padStart(2,'0'); }
    function formatICSDateTimeLocal(dateStr, timeStr){
      // Returns YYYYMMDDTHHMMSS for local time (floating). For better TZ, user can import and choose timezone in Google Calendar.
      if(!dateStr) return '';
      const d = new Date(dateStr + 'T' + (timeStr||'09:00') + ':00');
      return d.getFullYear().toString()+toTwo(d.getMonth()+1)+toTwo(d.getDate())+'T'+toTwo(d.getHours())+toTwo(d.getMinutes())+'00';
    }
    function sanitizeText(t){ return (t||'').replace(/([,;])/g,'\\$1').replace(/\n/g,'\\n'); }

    function buildICSFromOrders(list){
      const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Yuliang Clean Scheduler//v8//ZH-TW'
      ];
      list.forEach(o=>{
        const dtStart = formatICSDateTimeLocal(o.date, o.time);
        if(!dtStart) return;
        // default duration 2 hours
        const dtEnd = formatICSDateTimeLocal(o.date, o.time ? o.time : '11:00');
        const title = sanitizeText(`${o.customer||'客戶'} 清洗安排`);
        const staff = `作業人員：${o.staff||''}`;
        const tel = `電話：${o.phone||''}`;
        const slots = `時段：${(o.slots||[]).join('、')}`;
        const price = `金額(折後)：${o.netTotal||o.total||0}`;
        const note = o.note ? `備註：${o.note}` : '';
        const desc = sanitizeText([staff, tel, slots, price, note].filter(Boolean).join('\\n'));
        const loc = sanitizeText(o.address||'');
        const uid = o.id || (dtStart + '@yl-clean');
        lines.push('BEGIN:VEVENT');
        lines.push('UID:'+uid);
        lines.push('DTSTAMP:'+formatICSDateTimeLocal(new Date().toISOString().slice(0,10), new Date().toTimeString().slice(0,5)));
        lines.push('DTSTART:'+dtStart);
        lines.push('DTEND:'+dtEnd);
        lines.push('SUMMARY:'+title);
        if(loc) lines.push('LOCATION:'+loc);
        if(desc) lines.push('DESCRIPTION:'+desc);
        lines.push('END:VEVENT');
      });
      lines.push('END:VCALENDAR');
      return lines.join('\r\n');
    }

    function exportICS(){
      // rule: only include orders with date & time present, and either 已確認時間 或 狀況為「排定/完成」
      const y=+$('yearSel').value, m=+$('monthSel').value;
      const list = orders.filter(o=>{
        if(!o.date || !o.time) return false;
        const d=new Date(o.date);
        const inMonth = d.getFullYear()===y && (d.getMonth()+1)===m;
        const okStatus = ['排定','完成'].includes(o.status||'排定');
        const okConfirm = !!o.confirmed;
        return inMonth && okStatus && okConfirm;
      });
      if(list.length===0){ alert('本月沒有符合條件（已確認且有日期與時間）的訂單可匯出。'); return; }
      const ics = buildICSFromOrders(list);
      download(`行事曆_${y}-${toTwo(m)}.ics`, ics);
    }

    function exportGCalCsv(){
      // Google Calendar CSV columns: Subject, Start Date, Start Time, End Date, End Time, All Day Event, Description, Location
      const y=+$('yearSel').value, m=+$('monthSel').value;
      const headers = ['Subject','Start Date','Start Time','End Date','End Time','All Day Event','Description','Location'];
      const list = orders.filter(o=>{
        if(!o.date || !o.time) return false;
        const d=new Date(o.date);
        const inMonth = d.getFullYear()===y && (d.getMonth()+1)===m;
        const okStatus = ['排定','完成'].includes(o.status||'排定');
        const okConfirm = !!o.confirmed;
        return inMonth && okStatus && okConfirm;
      });
      if(list.length===0){ alert('本月沒有符合條件（已確認且有日期與時間）的訂單可匯出。'); return; }
      const rows = list.map(o=>{
        const startDate = o.date.replace(/-/g,'/'); // mm/dd/yyyy also works; we'll keep yyyy/mm/dd is okay for import in Google Calendar if locale matches
        const startTime = o.time || '09:00';
        // default 2 hours duration
        const [hh,mm] = startTime.split(':').map(Number);
        const endH = (hh+2)%24; const endDate = o.date; // simplistic; if crossing midnight, ignore for now
        const endTime = (endH.toString().padStart(2,'0'))+':'+(mm.toString().padStart(2,'0'));
        const subject = `${o.customer||'客戶'} 清洗安排`;
        const staff = `作業人員：${o.staff||''}`;
        const tel = `電話：${o.phone||''}`;
        const slots = `時段：${(o.slots||[]).join('、')}`;
        const price = `金額(折後)：${o.netTotal||o.total||0}`;
        const note = o.note ? `備註：${o.note}` : '';
        const desc = [staff, tel, slots, price, note].filter(Boolean).join('\\n');
        const loc = o.address||'';
        return [subject, startDate, startTime, endDate, endTime, 'False', desc, loc];
      });
      const csv = [headers.join(','), ...rows.map(r=>r.map(x=>{
        const s=(x??'').toString();
        return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
      }).join(','))].join('\n');
      download(`GoogleCalendar_${y}-${toTwo(m)}.csv`, csv);
    }

    
    
        // ---------- Excel Export (.xlsx) ----------
    function exportXLSX(){
      if (typeof XLSX === 'undefined'){
        alert('Excel 程式庫尚未載入，請稍後或改用「匯出JSON」備份。');
        return;
      }
      const y=+$('yearSel').value, m=+$('monthSel').value;
      const pad2 = n => String(n).padStart(2,'0');

      const inMonth = (dstr) => {
        if(!dstr) return false;
        const d = new Date(dstr);
        return !isNaN(d) && d.getFullYear()===y && (d.getMonth()+1)===m;
      };

      // 訂單表（只取該年該月有日期者；未排期通常不列入月報表）
      const orderHeaders = [
        'id','作業人員','日期','時間','確認','報價單','姓名','LINE_ID','電話',
        '安排時段(多選)','日期/時段備註','地址',
        '居住地型態','居住地型態(其他)','方便聯繫時間(多選)','方便聯繫備註',
        '冷氣樓層(多選)','洗衣機樓層(多選)','聯繫方式','狀況','完成時間','金額鎖定',
        '分離式室內機','吊隱式','直立式洗衣機','水塔','自來水管金額','防霉噴劑','臭氧殺菌','變形金剛加價','長度>182cm加價','一體式水盤',
        '備註','總金額','折扣金額','折後總金額','建立時間'
      ];

      const includeUndated = !!($('showUndated') && $('showUndated').checked);
    const ORDERS_SRC = (typeof orders!=='undefined' && Array.isArray(orders)?orders:[]);
    const orderRows = ORDERS_SRC
      .filter(o => o.date ? inMonth(o.date) : includeUndated)
        .sort((a,b)=> (a.date||'').localeCompare(b.date||''))
        .map(o => [
          o.id||'',
          o.staff||'',
          o.date||'',
          o.time||'',
          o.confirmed?'是':'否',
          o.quotationOk?'是':'否',
          o.customer||'',
          o.lineId||'',
          o.phone||'',
          (o.slots||[]).join('|')||'',
          o.slotNote||'',
          o.address||'',
          o.residenceType||'',
          o.residenceOther||'',
          (o.contactTimes||[]).join('|')||'',
          o.contactTimeNote||'',
          (o.acFloors||[]).join('|')||'',
          (o.washerFloors||[]).join('|')||'',
          o.contactMethod||'',
          o.status||'',
          o.completedAt||'',
          o.locked?'是':'否',
          +o.acSplit||0,
          +o.acDuct||0,
          +o.washerTop||0,
          +o.waterTank||0,
          +o.pipesAmount||0,
          +o.antiMold||0,
          +o.ozone||0,
          +o.transformerCount||0,
          +o.longSplitCount||0,
          +o.onePieceTray||0,
          (o.note||'').replace(/\n/g,' '),
          +o.total||0,
          +o.discount||0,
          +o.netTotal||0,
          o.createdAt||''
        ]);

      // 花費表
      const expHeaders = ['id','日期','類別','說明','金額','建立時間'];
      const expRows = (expenses||[])
        .filter(e => inMonth(e.date))
        .sort((a,b)=> (a.date||'').localeCompare(b.date||''))
        .map(e => [ e.id||'', e.date||'', e.category||'', (e.note||'').replace(/\n/g,' '), +e.amount||0, e.createdAt||'' ]);

      const wb = XLSX.utils.book_new();
      const wsOrders = XLSX.utils.aoa_to_sheet([orderHeaders, ...orderRows]);
      const wsExp = XLSX.utils.aoa_to_sheet([expHeaders, ...expRows]);

      wsOrders['!cols'] = orderHeaders.map((_,i)=>({wch:[10,10,10,8,6,6,12,12,12,16,16,20,12,14,16,14,14,14,10,8,10,8,8,8,8,10,8,8,8,10,10,12,20,10,10,10,16][i]||12}));
      wsExp['!cols'] = expHeaders.map((_,i)=>({wch:[10,10,10,24,10,16][i]||12}));

      XLSX.utils.book_append_sheet(wb, wsOrders, '訂單');
      XLSX.utils.book_append_sheet(wb, wsExp, '花費');
      XLSX.writeFile(wb, `訂單_${y}-${pad2(m)}.xlsx`);
    }

    // ---------- Search highlight helpers ----------
    let searchTokens = [];
    function escapeHtml(s){ return (s||'').toString().replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
    function highlightText(s){
      let out = escapeHtml(s||'');
      if(!searchTokens || searchTokens.length===0) return out;
      searchTokens.forEach(tok => {
        if(!tok) return;
        const pattern = tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const re = new RegExp(`(${pattern})`, 'ig');
        out = out.replace(re, '<mark>$1</mark>');
      });
      return out;
    }
    function highlightPhone(s){
      const src = escapeHtml(s||'');
      if(!searchTokens || searchTokens.length===0) return src;
      let out = src;
      searchTokens.forEach(tok => {
        const digits = tok.replace(/\D+/g,'');
        if(digits.length<3) return; // avoid over-highlighting
        // Build a pattern that allows optional separators between each digit
        const parts = digits.split('').map(ch => ch.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
        const pattern = parts.join('[\\s-]*');
        const re = new RegExp(`(${pattern})`, 'ig');
        out = out.replace(re, '<mark>$1</mark>');
      });
      return out;
    }

    // ---------- Inline edit for date/time in table ----------
    // ---------- Quick toggle for Confirm / Quotation and quick delete ----------
    function renderTogglePill(td, value, onText='已確認', offText='未確認'){
      td.innerHTML = '';
      const span = document.createElement('span');
      span.className = 'checkpill ' + (value ? 'on' : 'off');
      span.textContent = value ? onText : offText;
      td.appendChild(span);
      return span;
    }

    function startInlineEdit(td, kind, order){
      if(td.querySelector('input')) return; // already editing
      const input = document.createElement('input');
      input.type = (kind === 'date') ? 'date' : 'time';
      input.value = (kind === 'date') ? (order.date || '') : (order.time || '');
      input.style.width = kind === 'date' ? '140px' : '110px';
      input.addEventListener('click', e => e.stopPropagation());
      td.innerHTML = '';
      td.appendChild(input);
      input.focus();
      const commit = () => {
        const val = (input.value || '').trim();
        const idx = orders.findIndex(x => x.id === order.id);
        if(idx >= 0){
          if(kind === 'date') orders[idx].date = val;
          else orders[idx].time = val;
          save(KEY, orders);
          refreshTable();
        }
      };
      const cancel = () => refreshTable();
      input.addEventListener('keydown', (e)=>{
        if(e.key === 'Enter') commit();
        if(e.key === 'Escape') cancel();
      });
      input.addEventListener('blur', commit);
    }

    // ---------- Orders save/delete/export/import ----------
    function saveOrder(e){
      e.preventDefault();
      
      
      // Contact validation: phone optional; LINE 可替代
      const phoneVal = $('phone')?.value?.trim() || '';
      const lineVal = $('lineId')?.value?.trim() || '';
      if (phoneVal && !isValidTwPhone(phoneVal)){
        if (typeof Swal !== 'undefined' && Swal.fire){
          Swal.fire('電話格式不正確', '請輸入台灣電話（手機 0912345678/0912-345-678，或市話如 02-xxxx-xxxx、03-xxxxxxx），或改填 LINE 聯絡方式', 'warning');
        } else {
          alert('電話格式不正確，請輸入：手機 0912345678/0912-345-678，或市話（如 02-xxxx-xxxx、03-xxxxxxx），或改填 LINE 聯絡方式');
        }
        $('phone')?.focus();
        return;
      }
recalcTotals();
      const data=gatherForm(); // 日期可留空
      // handle completedAt & lock
      if(data.status==='完成'){
        data.completedAt = data.completedAt || new Date().toISOString();
        data.locked = (data.locked!==false); // default lock when completed
      } else {
        data.completedAt = undefined; data.locked = false;
      }
      const idx=orders.findIndex(x=>x.id===data.id);
      if(idx>=0){ orders[idx]={...orders[idx], ...data}; } else { orders.push(data); }
      // upsert contact
      upsertContact(data.customer, data.phone, data.address, data.lineId);
      save(KEY, orders); refreshTable(); fillForm({}); refreshContactsDatalist();
      window.scrollTo({top:0, behavior:'smooth'});
    }
    function deleteOrder(){
      const id=$('id').value; if(!id) return;
      if(confirm('確定要刪除這筆訂單嗎？')){
        orders=orders.filter(o=>o.id!==id); save(KEY, orders); refreshTable(); fillForm({});
      }
    }
    function resetForm(){ fillForm({}); }
    function download(filename, text){ const blob=new Blob([text],{type:'application/octet-stream'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); }
    function exportCSV(){
      const headers=['id','作業人員','日期','時間','確認','報價單','姓名','LINE_ID','電話','安排時段(多選)','地址','冷氣樓屯(多選)','洗衣機樓層(多選)','聯繫方式','狀況','完成時間','金額鎖定','分離式室內機','吊隱式','直立式洗衣機','水塔','自來水管金額','防霉噴劑','臭氧殺菌','變形金剛加價','長度>182cm加價','一體式水盤','備註','總金額','折扣金額','折後總金額','建立時間'];
      const rows=orders.map(o=>[o.id,o.staff,o.date||'',o.time,o.confirmed?'是':'否',o.quotationOk?'是':'否',o.customer,o.lineId,o.phone,(o.slots||[]).join('|'),o.address,(o.acFloors||[]).join('|'),(o.washerFloors||[]).join('|'),o.contactMethod,o.status,o.completedAt||'',o.locked?'是':'否',o.acSplit,o.acDuct,o.washerTop,o.waterTank,o.pipesAmount,o.antiMold,o.ozone,o.transformerCount,o.longSplitCount,o.onePieceTray,(o.note||'').replace(/\n/g,' '),o.total,o.discount,o.netTotal,o.createdAt||'']);
      const csv=[headers.join(','),...rows.map(r=>r.map(x=>{const s=(x??'').toString();return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}).join(','))].join('\n');
      download(`訂單_${$('yearSel').value}-${pad2($('monthSel').value)}.csv`, csv);
    }
    function exportJSON(){ download(`訂單資料備份.json`, JSON.stringify({orders, staffList, contactList}, null, 2)); }
    function importJSON(){ $('filePicker').click(); }
    $('filePicker')?.addEventListener('change',(e)=>{
      const file=e.target.files[0]; if(!file) return;
      const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result);
        if(data.orders && Array.isArray(data.orders)){ orders=data.orders; save(KEY, orders); }
        if(data.staffList && Array.isArray(data.staffList)){ staffList=data.staffList; save(STAFF_KEY, staffList); initStaffSelects(); }
        if(data.contactList && Array.isArray(data.contactList)){ contactList=data.contactList; save(CONTACT_KEY, contactList); initContactSelect(); }
        refreshTable(); alert('匯入完成！'); }catch{ alert('匯入失敗：檔案格式不正確。'); } };
      reader.readAsText(file,'utf-8'); e.target.value='';
    });

    // add staff/contact
    function addStaff(){ const name=prompt('輸入新作業人員名稱：')?.trim(); if(!name) return; if(!staffList.includes(name)){ staffList.push(name); save(STAFF_KEY, staffList); initStaffSelects(); } $('staff').value=name; $('staffFilter').value=''; }
    function addContact(){ const name=prompt('輸入新聯繫方式：')?.trim(); if(!name) return; if(!contactList.includes(name)){ contactList.push(name); save(CONTACT_KEY, contactList); initContactSelect(); } $('contactMethod').value=name; }

    // ---------- Expense module ----------
    function refreshExpense(){
      const y = +$('yearSel').value, m = +$('monthSel').value;
      const tbody = $('expenseTable').querySelector('tbody');
      tbody.innerHTML = '';
      const list = expenses
        .filter(e => {
          if(!e.date) return false;
          const d = new Date(e.date);
          if (isNaN(d)) return false;
          return d.getFullYear()===y && (d.getMonth()+1)===m;
        })
        .sort((a,b)=> (a.date||'').localeCompare(b.date));
      list.forEach((e, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td>${idx+1}</td>
                        <td>${escapeHtml(e.date||'')}</td>
                        <td>${escapeHtml(e.category||'')}</td>
                        <td>${escapeHtml(e.note||'')}</td>
                        <td class="right-align">${fmtCurrency(e.amount||0)}</td>`;
        tr.addEventListener('click', ()=>fillExpForm(e));
        
        // === Mobile keep list ===
        // idx: 1:日期 2:時間 4:客戶 5:電話 7:地址 9:確認 10:報價單 12:折後 14:操作
        try {
          tr.children[1]?.classList.add('keep-mobile');   // 日期
          tr.children[2]?.classList.add('keep-mobile');   // 時間
          tr.children[4]?.classList.add('keep-mobile');   // 客戶
          tr.children[5]?.classList.add('keep-mobile');   // 電話
          tr.children[7]?.classList.add('keep-mobile');   // 地址
          tr.querySelector('.toggle-confirm')?.classList.add('keep-mobile'); // 確認
          tr.querySelector('.toggle-quote')?.classList.add('keep-mobile');   // 報價單
          tr.children[12]?.classList.add('keep-mobile');  // 折後
          tr.querySelector('.op-cell')?.classList.add('keep-mobile');        // 操作

          // === Permanently hidden columns (provide td class hooks) ===
          tr.children[6]?.classList.add('col-slot');      // 時段
          tr.children[8]?.classList.add('col-status');    // 狀況
          tr.children[11]?.classList.add('col-total');    // 總金額
        } catch(err) { /* noop */ }

        tbody.appendChild(tr);
      });
}
    function gatherExpForm(){ return { id:$('expId').value || crypto.randomUUID(), date:$('expDate').value, category:$('expCategory').value, note:$('expNote').value.trim(), amount:+$('expAmount').value||0, createdAt:$('expId').value?undefined:new Date().toISOString() }; }
    function fillExpForm(e){ $('expId').value=e.id||''; $('expDate').value=e.date||''; $('expCategory').value=e.category||expCats[0]; $('expNote').value=e.note||''; $('expAmount').value=e.amount||0; $('expDelete').disabled=!e.id; }
    function saveExpense(ev){ ev.preventDefault(); const data=gatherExpForm(); if(!data.date){ alert('請輸入日期'); return; } const i=expenses.findIndex(x=>x.id===data.id); if(i>=0){ expenses[i]={...expenses[i], ...data}; } else { expenses.push(data); } save(EXP_KEY, expenses); fillExpForm({}); refreshExpense(); }
    function deleteExpense(){ const id=$('expId').value; if(!id) return; if(confirm('確定要刪除這筆花費嗎？')){ expenses=expenses.filter(x=>x.id!==id); save(EXP_KEY, expenses); fillExpForm({}); refreshExpense(); } }
    function expExportCsv(){ const headers=['id','日期','類別','說明','金額','建立時間']; const rows=expenses.map(e=>[e.id,e.date,e.category,(e.note||'').replace(/\n/g,' '),e.amount,e.createdAt||'']); const csv=[headers.join(','),...rows.map(r=>r.map(x=>{const s=(x??'').toString();return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s;}).join(','))].join('\n'); download(`花費_${$('yearSel').value}-${pad2($('monthSel').value)}.csv`, csv); }
    function expExportJson(){ download(`花費資料備份.json`, JSON.stringify({expenses, expCats}, null, 2)); }
    function expImportJson(){ $('filePickerExp').click(); }
    $('filePickerExp')?.addEventListener('change',(e)=>{
      const file=e.target.files[0]; if(!file) return;
      const reader=new FileReader(); reader.onload=()=>{ try{ const data=JSON.parse(reader.result);
        if(data.expenses && Array.isArray(data.expenses)){ expenses=data.expenses; save(EXP_KEY, expenses); }
        if(data.expCats && Array.isArray(data.expCats)){ expCats=data.expCats; save(EXP_CAT_KEY, expCats); initExpenseCats(); }
        refreshExpense(); alert('花費匯入完成！'); }catch{ alert('匯入失敗：檔案格式不正確。'); } };
      reader.readAsText(file,'utf-8'); e.target.value='';
    });
    function addExpCat(){ const name=prompt('輸入新花費類別：')?.trim(); if(!name) return; if(!expCats.includes(name)){ expCats.push(name); save(EXP_CAT_KEY, expCats); initExpenseCats(); } $('expCategory').value=name; }

    
// --- Above-5F toggles ---
function updateAbove5Visibility(){
  const acChecked = !!document.querySelector('input[type="checkbox"][data-name="acFloor"][value="5F以上"]:checked');
  const wChecked  = !!document.querySelector('input[type="checkbox"][data-name="washerFloor"][value="5F以上"]:checked');
  const acWrap = document.getElementById('acFloorAboveWrap');
  const wWrap  = document.getElementById('washerFloorAboveWrap');
  if(acWrap) acWrap.classList.toggle('hidden', !acChecked);
  if(wWrap)  wWrap.classList.toggle('hidden', !wChecked);
}
document.addEventListener('change', (e)=>{
  if(e.target && e.target.matches('input[type="checkbox"][data-name="acFloor"], input[type="checkbox"][data-name="washerFloor"]')){
    updateAbove5Visibility();
  }
});


// ---------- Due Soon Panel ----------
function findLatestOrderByCustomer(name){
  const n=(name||'').trim();
  if(!n) return null;
  const related = orders
    .filter(o => (o.customer||'').trim()===n)
    .sort((a,b)=> new Date(b.createdAt||b.date||b.completedAt||0) - new Date(a.createdAt||a.date||a.completedAt||0));
  return related[0] || null;
}

function refreshDueSoonPanel(){
  const panel = document.getElementById('dueSoonPanel');
  const listEl = document.getElementById('dueSoonList');
  if(!panel || !listEl) return;
  const today = new Date(); today.setHours(0,0,0,0);
  const seen = new Set();
  const items = [];
  orders.forEach(o => {
    if(!o.reminderEnabled) return;
    const name = (o.customer||'').trim();
    if(!name || seen.has(name)) return;
    seen.add(name);
    const flags = reminderFlagsForCustomer(name);
    if(flags.muted) return;
          const nd = nextDueDateForCustomer(name);
    if(!nd) return;
    const days = Math.floor((nd - today)/(24*60*60*1000));
    if(days <= 30){
      const latest = findLatestOrderByCustomer(name) || {};
      items.push({
        name,
        due: nd,
        days,
        phone: latest.phone||'',
        address: latest.address||'',
        last: lastCompletedDateForCustomer(name) || '',
        obj: latest
      });
    }
  });
  items.sort((a,b)=> a.days - b.days);
  const top = items.slice(0, 20);
  if(top.length === 0){
    listEl.classList.add('empty');
    listEl.innerHTML = '目前沒有 30 天內將到期的客戶';
    return;
  }
  listEl.classList.remove('empty');
  listEl.innerHTML = top.map(it => {
    const dueStr = fmtDate(it.due);
    const badge = it.days <= 0 ? `<span class="badge due">⚠️ 到期 ${dueStr}</span>` : `<span class="badge soon">⏰ ${it.days} 天後到期</span>`;
    const notified = reminderFlagsForCustomer(it.name).notified ? `<span class="badge muted">已通知</span>` : '';
    const lastStr = it.last ? `最近完成：${(it.last||'').slice(0,10)}` : '';
    const phoneStr = it.phone ? it.phone : '';
    const addrStr = it.address ? it.address : '';
    return `<div class="row">
      <div class="name">${it.name} ${badge} ${notified}</div>
      <div class="muted">${lastStr}</div>
      <div class="muted">${phoneStr}</div>
      <div class="muted">${addrStr}</div>
      <div><button class="inline-btn" data-open="${it.obj?.id||''}">開啟</button></div>
    </div>`;
  }).join('');
  // Attach open handlers
  listEl.querySelectorAll('button[data-open]').forEach(btn => {
    btn.addEventListener('click', (ev)=>{
      ev.stopPropagation();
      const id = btn.getAttribute('data-open');
      const target = orders.find(x=> x.id===id) || null;
      if(target){ fillForm(target); }
      else {
        // 若找不到特定訂單，就新建一筆以該客戶為基底
        fillForm({ customer: btn.closest('.row').querySelector('.name')?.textContent.trim().split(' ')[0] || '' });
      }
      document.getElementById('orderAccordion').open = true;
      document.getElementById('orderAccordion').scrollIntoView({behavior:'smooth', block:'start'});
    });
  });
}

// ---------- Events ----------
    function attachEvents(){
      // order form
      $('orderForm').addEventListener('submit', saveOrder);
      $('deleteBtn').addEventListener('click', deleteOrder);
      $('resetBtn').addEventListener('click', resetForm);
      $('recalc').addEventListener('click', recalcTotals);
      ['acSplit','acDuct','washerTop','waterTank','pipesAmount','antiMold','ozone','transformerCount','longSplitCount','onePieceTray','discount']
        .forEach(id => $(id).addEventListener('input', recalcTotals));
      $('newBtn').addEventListener('click', ()=>{ fillForm({}); });
$('exportJson').addEventListener('click', exportJSON);
$('importJson').addEventListener('click', importJSON);
      $('clearAll').addEventListener('click', ()=>{ if(confirm('確定要清空所有訂單資料嗎？此動作無法復原。')){ orders=[]; save(KEY, orders); refreshTable(); } });
      $('addStaffBtn').addEventListener('click', addStaff);
      $('addContactMethod').addEventListener('click', addContact);
      
      // Autofill from contacts when name/phone entered
      $('customer').addEventListener('blur', ()=>{ const c = findContactByName($('customer').value); if(c){ if ($('phone').dataset.touched !== '1' && !$('phone').value) $('phone').value = c.phone||''; if(!$('address').value) $('address').value = c.address||''; if(!$('lineId').value) $('lineId').value = c.lineId||''; }
      });
      // ---- phone touched guard (so user can keep it empty) ----
try {
  $('phone').dataset.touched = $('phone').dataset.touched || '0';
  $('phone').addEventListener('input', ()=>{ $('phone').dataset.touched = '1'; });
} catch(e) { /* ignore if element missing */ }
// ---------------------------------------------------------
$('phone').addEventListener('blur', ()=>{
        const c2 = findContactByLineId($('lineId').value);
        if(c2){ if(!$('customer').value) $('customer').value = c2.name||''; if(!$('address').value) $('address').value = c2.address||''; if ($('phone').dataset.touched !== '1' && !$('phone').value) $('phone').value = c2.phone || ''; }
      });
      $('lineId').addEventListener('blur', ()=>{
        const c3 = findContactByLineId($('lineId').value);
        if(c3){ if(!$('customer').value) $('customer').value = c3.name||''; if(!$('address').value) $('address').value = c3.address||''; if ($('phone').dataset.touched !== '1' && !$('phone').value) $('phone').value = c3.phone || ''; }
      });
      $('phone').addEventListener('blur', ()=>{
        const c = findContactByPhone($('phone').value);
        if(c){ if(!$('customer').value) $('customer').value = c.name||''; if(!$('address').value) $('address').value = c.address||''; if(!$('lineId').value) $('lineId').value = c.lineId||''; }
      });



      // Recompute nextReminder when customer/reminderMonths change
      $('customer').addEventListener('blur', ()=>{ const name=$('customer').value; const months=(+$('reminderMonths').value||24); const last=lastCompletedDateForCustomer(name); const nd=(last && months)? addMonths(last, months): null; $('nextReminder').value = nd ? fmtDate(nd) : ''; });
      $('reminderMonths').addEventListener('input', ()=>{ const name=$('customer').value; const months=(+$('reminderMonths').value||24); const last=lastCompletedDateForCustomer(name); const nd=(last && months)? addMonths(last, months): null; $('nextReminder').value = nd ? fmtDate(nd) : ''; });

      // expenses
      $('expenseForm').addEventListener('submit', saveExpense);
      $('expDelete').addEventListener('click', deleteExpense);
      $('expReset').addEventListener('click', ()=>fillExpForm({}));
      $('expExportCsv').addEventListener('click', expExportCsv);
      $('expExportJson').addEventListener('click', expExportJson);
      $('expImportJson').addEventListener('click', expImportJson);
      $('expClear').addEventListener('click', ()=>{ if(confirm('確定要清空所有花費資料嗎？此動作無法復原。')){ expenses=[]; save(EXP_KEY, expenses); refreshExpense(); } });
      $('addExpCat').addEventListener('click', addExpCat);

      $('toggleLock').addEventListener('click', ()=>{
        const id=$('id').value; if(!id){ alert('請先選擇或儲存一筆訂單'); return; }
        const i=orders.findIndex(o=>o.id===id); if(i<0) return;
        const wantUnlock = orders[i].locked;
        if(wantUnlock && !confirm('確定要解除金額鎖定嗎？解除後可修改金額與折扣。')) return;
        orders[i].locked = !orders[i].locked;
        save(KEY, orders);
        setFormLock(orders[i].locked);
      });

      // 複製相關
      function copyOrderToForm(o){
        const t={...o};
        delete t.id; t.status='排定'; t.confirmed=false; t.quotationOk=false; t.completedAt=undefined; t.locked=false; t.date=''; t.time='';
        fillForm(t); recalcTotals();
        $('orderAccordion').open = true; $('orderAccordion').scrollIntoView({behavior:'smooth', block:'start'});
      }
      function copyOrderFrom(o){ copyOrderToForm(o); }
      $('copyLastBtn').addEventListener('click', ()=>{
        if(orders.length===0){ alert('目前沒有可複製的訂單'); return; }
        const last = [...orders].sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''))[0];
        if(!last){ alert('找不到上一筆'); return; }
        copyOrderToForm(last);
      });
      $('copyFromHistoryBtn').addEventListener('click', ()=>{
        const np = normalizePhone($('phone').value);
        let cand = null;
        if(np){ cand = [...orders].filter(o=> normalizePhone(o.phone)===np).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''))[0]; }
        if(!cand && $('customer').value){ cand = [...orders].filter(o=> (o.customer||'')=== $('customer').value.trim()).sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''))[0]; }
        if(!cand){ alert('找不到此客戶的舊單（請先輸入姓名或電話）'); return; }
        copyOrderToForm(cand);
      });


      // Accordion behavior: auto-collapse on small screens
      function adjustAccordion(){
        const acc = $('expenseAcc');
        if(!acc) return;
        if(window.innerWidth < 900){ acc.open = false; } else { acc.open = true; }
      }
      window.addEventListener('resize', adjustAccordion);
      adjustAccordion();
    
      
    
      // residenceType toggle
      $('residenceType')?.addEventListener('change', ()=>{
        $('residenceOther').classList.toggle('hidden', $('residenceType').value!=='其他');
      });
      // contact time "時間指定" toggle
      document.addEventListener('change', (e)=>{
        if(e.target && e.target.matches('input[type="checkbox"][data-name="contactTime"]')){
          const specified = Array.from(document.querySelectorAll('input[type="checkbox"][data-name="contactTime"]'))
                              .some(x=> x.checked && (x.value==='日期指定' || x.value==='時間指定'));
          $('contactTimeNote').classList.toggle('hidden', !specified);
        }
      });
    
    
      // slot "時間指定" toggle
      document.addEventListener('change', (e)=>{
        if(e.target && e.target.matches('input[type="checkbox"][data-name="slot"]')){
          const specified = Array.from(document.querySelectorAll('input[type="checkbox"][data-name="slot"]'))
                              .some(x=> x.checked && (x.value==='日期指定' || x.value==='時間指定'));
          $('slotNote').classList.toggle('hidden', !specified);
        }
      });
    
    
      // auto-open orderAccordion when buttons clicked
      ;['saveBtn','resetBtn','copyLastBtn','copyFromHistoryBtn'].forEach(id=>{
        $(id)?.addEventListener('click', ()=>{ $('orderAccordion').open = true; $('orderAccordion').scrollIntoView({behavior:'smooth', block:'start'}); });
      });
    
    
      // 新增花費按鈕：切到花費區塊頂部並重置表單
      $('newExpenseBtn')?.addEventListener('click', ()=>{
        if (typeof fillExpForm === 'function') fillExpForm({});
        const exp = $('expenseAcc');
        if (exp){ exp.open = true; exp.scrollIntoView({behavior:'smooth', block:'start'}); }
      });
    
    
      // 新增訂單：展開並捲動到區塊開頭
      $('newBtn')?.addEventListener('click', ()=>{
        $('orderAccordion').open = true;
        $('orderAccordion').scrollIntoView({behavior:'smooth', block:'start'});
      });
        
    
      $('exportXlsx')?.addEventListener('click', exportXLSX);
    }

    // ---------- Boot ----------
    (function boot(){
      setTimeout(refreshDueSoonPanel, 0);

      // Reminder summary (non-intrusive console + optional alert)
      try{
        const today = new Date(); today.setHours(0,0,0,0);
        let due=0, soon=0;
        const seen = new Set();
        orders.forEach(o=>{
          if(!o.reminderEnabled) return;
          const name = (o.customer||'').trim();
          if(!name || seen.has(name)) return;
          seen.add(name);
          const flags = reminderFlagsForCustomer(name);
    if(flags.muted) return;
          const nd = nextDueDateForCustomer(name);
          if(!nd) return;
          const days = Math.floor((nd - today)/(24*60*60*1000));
          if(days <= 0) due++;
          else if(days <= 30) soon++;
        });
        if(due>0 || soon>0){
          console.log(`[提醒] 到期:${due}，將到期(30天內):${soon}`);
        }
      }catch(e){}

      initYearMonth(); initStaffSelects(); initContactSelect(); initCheckboxes(); initExpenseCats();
      attachEvents(); refreshContactsDatalist(); fillForm({}); fillExpForm({}); refreshTable(); refreshExpense();
    })();

// ---- concatenated from inline <script> blocks ----

/* ===== Offline .xlsx exporter (no external deps) =====
   Builds a minimal XLSX (2 sheets) using uncompressed ZIP.
   Sheets: 訂單 / 花費, with inline strings (no sharedStrings).
*/
(function(){
  // --- helpers ---
  const enc = new TextEncoder();
  const toBytes = (s)=> enc.encode(s);

  // CRC32
  const CRC_TABLE = (()=>{
    let c, table = new Uint32Array(256);
    for (let n=0; n<256; n++){
      c = n;
      for (let k=0; k<8; k++){
        c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
      }
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(buf){
    let c = 0 ^ (-1);
    for (let i=0; i<buf.length; i++){
      c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xFF];
    }
    return (c ^ (-1)) >>> 0;
  }
  function strToXml(s){
    return (s||'').toString()
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/\r?\n/g, '&#10;');
  }
  function colName(col){ // 1->A, 2->B, ...
    let s='', n=col;
    while(n>0){ const m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=Math.floor((n-1)/26); }
    return s;
  }
  function sheetXML(headers, rows){
    let r=1, out = ['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
      '<sheetData>'];
    // header row
    let cells = headers.map((h,i)=>`<c r="${colName(i+1)}${r}" t="inlineStr"><is><t>${strToXml(h)}</t></is></c>`).join('');
    out.push(`<row r="${r}">${cells}</row>`); r++;
    // data rows
    for(const row of rows){
      let cs=[];
      for(let i=0;i<row.length;i++){
        const v = row[i];
        const ref = `${colName(i+1)}${r}`;
        if(typeof v === 'number' && isFinite(v)){
          cs.push(`<c r="${ref}"><v>${v}</v></c>`);
        }else{
          cs.push(`<c r="${ref}" t="inlineStr"><is><t>${strToXml(v)}</t></is></c>`);
        }
      }
      out.push(`<row r="${r}">${cs.join('')}</row>`); r++;
    }
    out.push('</sheetData></worksheet>');
    return out.join('');
  }

  // Minimal ZIP (store only)
  function buildZip(files){ // files: [{name, data(Uint8Array)}]
    const LFH = 0x04034b50, CDH=0x02014b50, EOCD=0x06054b50;
    const arrs=[];
    let offset=0;
    const cdEntries=[];
    function pushUint32(v){ const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,v,true); arrs.push(b); offset+=4; }
    function pushUint16(v){ const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,v,true); arrs.push(b); offset+=2; }
    function pushBytes(b){ arrs.push(b); offset+=b.length; }

    for(const f of files){
      const nameBytes = toBytes(f.name);
      const data = f.data;
      const crc = crc32(data);
      const comp = 0; // store
      const modTime = 0, modDate = 0;

      // local file header
      { pushUint32(LFH);
        pushUint16(20);      // version needed
        pushUint16(0);       // flags
        pushUint16(comp);    // method
        pushUint16(modTime); // time
        pushUint16(modDate); // date
        pushUint32(crc);
        pushUint32(data.length); // compressed size (store)
        pushUint32(data.length); // uncompressed size
        pushUint16(nameBytes.length);
        pushUint16(0); // extra len
        pushBytes(nameBytes);
        pushBytes(data);
      }
      const lfhEnd = offset;

      // central directory entry
      const cdStart = offset; // not used
      const cd = [];
      function push32(v){ const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,v,true); cd.push(b); }
      function push16(v){ const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,v,true); cd.push(b); }
      push32(CDH);
      push16(20); // version made by
      push16(20); // version needed
      push16(0);  // flags
      push16(comp);
      push16(modTime); push16(modDate);
      push32(crc);
      push32(data.length); push32(data.length);
      push16(nameBytes.length); push16(0); push16(0); // name, extra, comment
      push16(0); push16(0); // disk start, int attrs
      push32(0); // ext attrs
      // relative offset of local header -> need to compute; we track by sum of previous arrays, so we store now:
      const relOffset = lfhEnd - (30 + nameBytes.length + data.length);
      push32(relOffset);
      cd.push(nameBytes);
      cdEntries.push(cd);
    }

    const cdOffset = offset;
    for(const parts of cdEntries){ for(const b of parts){ arrs.push(b); offset+=b.length; } }
    const cdSize = offset - cdOffset;

    // EOCD
    pushUint32(EOCD);
    pushUint16(0); pushUint16(0); // disk numbers
    pushUint16(files.length); pushUint16(files.length);
    pushUint32(cdSize);
    pushUint32(cdOffset);
    pushUint16(0); // comment length

    // concat
    let total = 0; for(const a of arrs) total += a.length;
    const out = new Uint8Array(total);
    let p=0; for(const a of arrs){ out.set(a,p); p+=a.length; }
    return out;
  }

  // Workbook XML pieces
  function contentTypes(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;
  }
  function rootRels(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  }
  function workbook(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="訂單" sheetId="1" r:id="rId1"/>
    <sheet name="花費" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`;
  }
  function workbookRels(){
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`;
  }

  // Override existing function name
  window.exportXLSX = function(){
    const y = +$('yearSel').value, m = +$('monthSel').value;
    const pad2 = n => String(n).padStart(2,'0');

    const inMonth = (dstr) => {
      if(!dstr) return false;
      const d = new Date(dstr);
      return !isNaN(d) && d.getFullYear()===y && (d.getMonth()+1)===m;
    };

    const orderHeaders = [
      'id','作業人員','日期','時間','確認','報價單','姓名','LINE_ID','電話',
      '安排時段(多選)','日期/時段備註','地址',
      '居住地型態','居住地型態(其他)','方便聯繫時間(多選)','方便聯繫備註',
      '冷氣樓層(多選)','洗衣機樓層(多選)','聯繫方式','狀況','完成時間','金額鎖定',
      '分離式室內機','吊隱式','直立式洗衣機','水塔','自來水管金額','防霉噴劑','臭氧殺菌','變形金剛加價','長度>182cm加價','一體式水盤',
      '備註','總金額','折扣金額','折後總金額','建立時間'
    ];
    const orderRows = (typeof orders!=='undefined' && Array.isArray(orders)?orders:[])
      .filter(o => inMonth(o.date))
      .sort((a,b)=> (a.date||'').localeCompare(b.date||''))
      .map(o => [
        o.id||'', o.staff||'', o.date||'', o.time||'',
        o.confirmed?'是':'否', o.quotationOk?'是':'否', o.customer||'',
        o.lineId||'', o.phone||'',
        (o.slots||[]).join('|')||'', o.slotNote||'', o.address||'',
        o.residenceType||'', o.residenceOther||'',
        (o.contactTimes||[]).join('|')||'', o.contactTimeNote||'',
        (o.acFloors||[]).join('|')||'', (o.washerFloors||[]).join('|')||'',
        o.contactMethod||'', o.status||'', o.completedAt||'', o.locked?'是':'否',
        +o.acSplit||0, +o.acDuct||0, +o.washerTop||0, +o.waterTank||0, +o.pipesAmount||0,
        +o.antiMold||0, +o.ozone||0, +o.transformerCount||0, +o.longSplitCount||0, +o.onePieceTray||0,
        (o.note||'').replace(/\n/g,' '), +o.total||0, +o.discount||0, +o.netTotal||0, o.createdAt||''
      ]);

    const expHeaders = ['id','日期','類別','說明','金額','建立時間'];
    const expRows = (typeof expenses!=='undefined' && Array.isArray(expenses)?expenses:[])
      .filter(e => inMonth(e.date))
      .sort((a,b)=> (a.date||'').localeCompare(b.date||''))
      .map(e => [e.id||'', e.date||'', e.category||'', (e.note||'').replace(/\n/g,' '), +e.amount||0, e.createdAt||'']);

    // Build files
    const files = [
      {name:'[Content_Types].xml', data: toBytes(contentTypes())},
      {name:'_rels/.rels', data: toBytes(rootRels())},
      {name:'xl/workbook.xml', data: toBytes(workbook())},
      {name:'xl/_rels/workbook.xml.rels', data: toBytes(workbookRels())},
      {name:'xl/worksheets/sheet1.xml', data: toBytes(sheetXML(orderHeaders, orderRows))},
      {name:'xl/worksheets/sheet2.xml', data: toBytes(sheetXML(expHeaders, expRows))},
    ];
    const zip = buildZip(files);
    const blob = new Blob([zip], {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `訂單_${y}-${pad2(m)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
})();

// ---- concatenated from inline <script> blocks ----

// 重新綁定「匯出Excel」按鈕，避免沿用舊的 SheetJS 事件處理器
window.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('exportXlsx');
  if (btn && typeof window.exportXLSX === 'function') {
    const clone = btn.cloneNode(true);           // 移除既有所有 listener
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', () => window.exportXLSX());
  }
});

// ---- concatenated from inline <script> blocks ----

let tokenClient;

function initGoogle() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: '894514639805-g3073pmjvadbasfp1g25r24rjhl9iacb.apps.googleusercontent.com',
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      setTimeout(() => {
        Swal.fire({
          title: '請選擇操作',
          input: 'radio',
          inputOptions: {
            '1': '備份至 Google 雲端',
            '2': '從 Google 雲端還原'
          },
          inputValidator: (value) => {
            if (!value) return '請選擇一項操作';
          },
          confirmButtonText: '確定'
        }).then(async (result) => {
          if (result.isConfirmed) {
            const choice = result.value;
            if (choice === '1') await backupToDrive(token);
            else if (choice === '2') await restoreFromDrive(token);
          }
        });
      }, 0);
    }
  });
}

function initGoogleBackup() {
  if (!tokenClient) initGoogle();
  tokenClient.requestAccessToken();
}
function extractCityDistrict(address) {
  if (!address) return { city: '', district: '' };
  const match = address.match(/^(.*?[市縣])\s*([\u4e00-\u9fa5]{1,4}[區鄉鎮市])/);
  if (match) {
    return { city: match[1], district: match[2] };
  }
  return { city: '', district: '' };
}
function getOrderItems(o) {
  let items = [];
  if (+o.acSplit > 0) items.push(`分離式冷氣${o.acSplit}台`);
  if (+o.acDuct > 0) items.push(`吊隱式冷氣${o.acDuct}台`);
  if (+o.washerTop > 0) items.push(`直立式洗衣機${o.washerTop}台`);
  if (+o.waterTank > 0) items.push(`水塔${o.waterTank}顆`);
  if (+o.pipesAmount > 0) items.push(`自來水管`);
  if (+o.antiMold > 0) items.push(`防霉${o.antiMold}台`);
  if (+o.ozone > 0) items.push(`臭氧殺菌${o.ozone}間`);
  if (+o.transformerCount > 0) items.push(`變形金剛${o.transformerCount}台`);
  if (+o.longSplitCount > 0) items.push(`分離式>182cm ${o.longSplitCount}台`);
  if (+o.onePieceTray > 0) items.push(`一體式水盤${o.onePieceTray}台`);
  return items.join('、');
}

// ---- concatenated from inline <script> blocks ----

async function backupToDrive(token) {
  try {
    const content = JSON.stringify(localStorage, null, 2);
    const file = new Blob([content], { type: 'application/json' });

    // 使用 localStorage 控制輪替（1或2）
    let index = parseInt(localStorage.getItem('backupIndex') || '1');
    const filename = `清洗訂單_備份_${index}.json`;

    // 查找同名舊檔案（如有則刪除）
    const searchRes = await fetch("https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(`name='${filename}' and trashed=false`), {
      headers: new Headers({ Authorization: 'Bearer ' + token })
    });
    const searchJson = await searchRes.json();
    const existingFile = searchJson.files?.[0];
    if (existingFile) {
      await fetch("https://www.googleapis.com/drive/v3/files/" + existingFile.id, {
        method: 'DELETE',
        headers: new Headers({ Authorization: 'Bearer ' + token })
      });
    }

    // 上傳新檔案（相同檔名）
    const metadata = { name: filename, mimeType: 'application/json' };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
      method: 'POST',
      headers: new Headers({ Authorization: 'Bearer ' + token }),
      body: form
    });

    if (res.ok) {
      Swal.fire('✅ 備份成功', filename, 'success');
      const next = index === 1 ? 2 : 1;
      localStorage.setItem('backupIndex', next.toString());
    } else {
      const err = await res.json();
      Swal.fire('❌ 備份失敗', err.error.message, 'error');
    }
  } catch (e) {
    Swal.fire('❌ 備份錯誤', e.message, 'error');
  }
}

// ---- concatenated from inline <script> blocks ----

async function restoreFromDrive(token) {
  try {
    // 搜尋兩個備份檔案
    const query = "name contains '清洗訂單_備份_' and trashed=false";
    const listRes = await fetch("https://www.googleapis.com/drive/v3/files?q=" + encodeURIComponent(query) + "&fields=files(id,name,modifiedTime)&orderBy=modifiedTime desc", {
      headers: new Headers({ Authorization: 'Bearer ' + token })
    });
    const listJson = await listRes.json();
    const files = listJson.files || [];

    if (files.length === 0) {
      return Swal.fire('⚠️ 找不到任何備份檔', '', 'warning');
    }

    const inputOptions = {};
    files.slice(0, 2).forEach(file => {
      const time = new Date(file.modifiedTime).toLocaleString();
      inputOptions[file.id] = `${file.name}（${time}）`;
    });

    const { value: fileId } = await Swal.fire({
      title: '選擇要還原的備份檔',
      input: 'radio',
      inputOptions,
      inputValidator: (value) => !value && '請選擇一個檔案',
      confirmButtonText: '還原'
    });

    if (!fileId) return;

    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: new Headers({ Authorization: 'Bearer ' + token })
    });
    const data = await downloadRes.json();

    localStorage.clear();
    for (const [key, value] of Object.entries(data)) {
      localStorage.setItem(key, value);
    }

    Swal.fire('✅ 還原成功', '', 'success').then(() => location.reload());
  } catch (e) {
    Swal.fire('❌ 還原錯誤', e.message, 'error');
  }
}

// ---- concatenated from inline <script> blocks ----

const CLIENT_ID = '894514639805-g3073pmjvadbasfp1g25r24rjhl9iacb.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';
let gToken = null;

function handleUploadWithAuth(orderData) {
  if (!orderData.date || !orderData.time) {
    alert('請先填寫此訂單的日期與時間');
    return;
  }
  if (gToken) {
    uploadEventToCalendar(orderData);
  } else {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (tokenResponse) => {
        gToken = tokenResponse.access_token;
        uploadEventToCalendar(orderData);
      }
    });
    tokenClient.requestAccessToken();
  }
}

async function uploadEventToCalendar(o) {
  const start = new Date(`${o.date}T${o.time}:00`);
  const duration = +o.durationMinutes || 120;
  const end = new Date(start.getTime() + duration * 60 * 1000);

  // 新增：自動組合縣市區＋姓名＋清洗項目
  const { city, district } = extractCityDistrict(o.address || '');
  const orderItems = getOrderItems(o);
  const summary = `${city}${district} ${o.customer || ''} ${orderItems}`;

  const event = {
    summary,
    location: o.address || '',
    description: [
      `姓名：${o.customer || ''}`,
      `電話：${o.phone || ''}`,
      (o.acFloors && o.acFloors.length > 0) ? `冷氣位於樓層：${o.acFloors.join('、')}${ (o.acFloors.includes('5F以上') && (o.acFloorAbove||'').trim() ? `（實際：${(o.acFloorAbove||'').trim()}）` : '') }` : '',
      (o.washerFloors && o.washerFloors.length > 0) ? `洗衣機位於樓層：${o.washerFloors.join('、')}${ (o.washerFloors.includes('5F以上') && (o.washerFloorAbove||'').trim() ? `（實際：${(o.washerFloorAbove||'').trim()}）` : '') }` : ''
    ].filter(Boolean).join('\n'),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() }
  };

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + gToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });

  if (res.ok) {
    alert(`\u2705 已成功加入 Google 日曆！`);
  } else {
    const err = await res.json();
    alert(`\u274C 上傳失敗：${err.error?.message || '未知錯誤'}`);
  }
}

// ---- concatenated from inline <script> blocks ----

// （已改為由操作列的第一顆按鈕提供📅上傳功能）
// ---- concatenated from inline <script> blocks ----

// 強制手風琴預設收合（解決部分瀏覽器 <details> 預設展開問題）
window.addEventListener('DOMContentLoaded', () => {
  const order = document.getElementById('orderAccordion');
  const exp = document.getElementById('expenseAcc');
  if (order) order.open = false;
  if (exp) exp.open = false;
});


// 🧔 顯示作業人員時自動轉換 icon
function displayStaff(name) {
  if (name === "自然大叔") {
    return '<img src="https://res.cloudinary.com/dijzndzw2/image/upload/v1757176751/logo-3_hddq08.png" alt="自然大叔" style="height:20px;width:20px;border-radius:50%;vertical-align:middle;">';
  }
  return name;
}

// 🧑‍🔧 修改所有需要渲染 staff 的欄位，可使用 innerHTML 而不是 innerText，例如：
const renderStaffCell = (cell, staffName) => {
  cell.innerHTML = displayStaff(staffName);
};
