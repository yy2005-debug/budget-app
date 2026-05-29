import { useState, useEffect } from "react";

const STORAGE_KEY = "budget_data_v3";

const CATEGORIES = [
  { id: "food",          label: "🍜 餐飲",  color: "#f97316",
    sub: ["🌅 早餐","☀️ 午餐","🌙 晚餐","🌃 宵夜","🧋 飲料","🍰 點心"] },
  { id: "transport",     label: "🚌 交通",  color: "#3b82f6",
    sub: ["🚇 捷運","🚌 公車","🚕 計程車","🛵 機車","🚲 自行車","✈️ 長途"] },
  { id: "shopping",      label: "🛍️ 購物",  color: "#ec4899",
    sub: ["👕 衣物","🧴 日用品","📱 3C","📚 書籍","🎁 禮物","🛒 超市"] },
  { id: "entertainment", label: "🎮 娛樂",  color: "#8b5cf6",
    sub: ["🎬 電影","🎵 音樂","🎮 遊戲","🏃 運動","🎨 興趣","🎉 聚會"] },
  { id: "health",        label: "💊 醫療",  color: "#10b981",
    sub: ["🏥 看診","💊 藥品","🧘 保健","💆 按摩","🦷 牙科","👁️ 眼科"] },
  { id: "other",         label: "📦 其他",  color: "#6b7280", sub: [] },
];

const PAYMENT_METHODS = [
  { id: "cash",    label: "💵 現金",       excludeFromFree: false },
  { id: "post_dc", label: "🏦 郵局金融卡", excludeFromFree: false },
  { id: "cube",    label: "💳 國泰CUBE卡", excludeFromFree: false },
  { id: "post_ac", label: "📮 郵局帳戶",   excludeFromFree: false },
  { id: "icbc",    label: "🏛️ 一銀信用卡", excludeFromFree: true  },
];

const defaultData = { income:0, fixedExpenses:[], transactions:[], budgets:{}, setupDone:false };

const fmt = n => `$${Number(n).toLocaleString("zh-TW")}`;
const toDay = () => new Date().toISOString().slice(0,10);
const mKey  = d => d.slice(0,7);
const curMonth = () => new Date().toISOString().slice(0,7);
const barColor = pct => pct>=100?"#ef4444":pct>=80?"#f59e0b":"#22c55e";
const monthLabel = ym => { const [y,m]=ym.split("-"); return `${y} 年 ${parseInt(m)} 月`; };
const allMonths = txs => Array.from(new Set(txs.map(t=>mKey(t.date)))).sort((a,b)=>b.localeCompare(a));
const isExcluded = pmId => PAYMENT_METHODS.find(p=>p.id===pmId)?.excludeFromFree;

const emptyForm = { amount:"", note:"", category:"food", sub:"", payment:"cash", date:toDay() };

export default function App() {
  const [data, setData]                 = useState(defaultData);
  const [page, setPage]                 = useState("home");
  const [form, setForm]                 = useState(emptyForm);
  const [editId, setEditId]             = useState(null); // null=新增, id=編輯
  const [fixedForm, setFixedForm]       = useState({ name:"", amount:"" });
  const [incomeInput, setIncomeInput]   = useState("");
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [budgetInputs, setBudgetInputs] = useState({});
  const [historyMonth, setHistoryMonth] = useState("");
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem("budget_data_v2");
      if (raw) {
        const parsed = JSON.parse(raw);
        const merged = { ...defaultData, ...parsed, budgets: parsed.budgets||{} };
        setData(merged);
        setIncomeInput(String(merged.income||""));
        setBudgetInputs(Object.fromEntries(CATEGORIES.map(c=>[c.id, String(merged.budgets[c.id]||"")])));
        if (!merged.setupDone) setPage("setup");
      } else {
        setPage("setup");
        setBudgetInputs(Object.fromEntries(CATEGORIES.map(c=>[c.id,""])));
      }
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  function notify(msg, type="success") {
    setNotification({msg,type});
    setTimeout(()=>setNotification(null), 2500);
  }

  const thisMonth   = curMonth();
  const thisMonthTx = data.transactions.filter(t=>mKey(t.date)===thisMonth);
  const totalFixed  = data.fixedExpenses.reduce((s,e)=>s+Number(e.amount),0);
  const freeTotal   = Math.max(0, Number(data.income)-totalFixed);
  const freeTx      = thisMonthTx.filter(t=>!isExcluded(t.payment));
  const icbcTx      = thisMonthTx.filter(t=>isExcluded(t.payment));
  const spent       = freeTx.reduce((s,t)=>s+Number(t.amount),0);
  const icbcSpent   = icbcTx.reduce((s,t)=>s+Number(t.amount),0);
  const remaining   = freeTotal-spent;
  const overallPct  = freeTotal>0?Math.min(110,(spent/freeTotal)*100):0;
  const overallLvl  = overallPct>=100?"danger":overallPct>=80?"warn":"safe";

  function catSpent(catId, txList=thisMonthTx) {
    return txList.filter(t=>t.category===catId&&!isExcluded(t.payment)).reduce((s,t)=>s+Number(t.amount),0);
  }
  function catBudget(catId) { return Number(data.budgets[catId]||0); }
  const budgetedCats = CATEGORIES.filter(c=>catBudget(c.id)>0);
  const getCatInfo = id => CATEGORIES.find(c=>c.id===id)||CATEGORIES[5];
  const getPayInfo = id => PAYMENT_METHODS.find(p=>p.id===id)||PAYMENT_METHODS[0];

  // Open add page (new)
  function openAdd() {
    setForm({...emptyForm, date:toDay()});
    setEditId(null);
    setPage("add");
  }

  // Open edit page with existing tx data
  function openEdit(tx) {
    setForm({
      amount: String(tx.amount),
      note: tx.note||"",
      category: tx.category||"food",
      sub: tx.sub||"",
      payment: tx.payment||"cash",
      date: tx.date||toDay(),
    });
    setEditId(tx.id);
    setPage("add");
  }

  function saveTransaction() {
    const amt = Number(form.amount);
    if (!amt||amt<=0) { notify("請輸入有效金額","error"); return; }
    const tx = { id: editId||Date.now(), amount:amt, note:form.note,
      category:form.category, sub:form.sub, payment:form.payment, date:form.date };

    setData(d => {
      let txs;
      if (editId) {
        // replace existing
        txs = d.transactions.map(t=>t.id===editId?tx:t);
      } else {
        txs = [tx, ...d.transactions];
      }
      // sort by date desc
      txs.sort((a,b)=>b.date.localeCompare(a.date)||(b.id-a.id));
      return {...d, transactions:txs};
    });

    if (!isExcluded(form.payment)) {
      const budget = catBudget(form.category);
      if (budget>0) {
        // recalc after save (approximate using current catSpent minus old if editing)
        const oldAmt = editId ? (data.transactions.find(t=>t.id===editId)?.amount||0) : 0;
        const newSpent = catSpent(form.category) - oldAmt + amt;
        const cat = getCatInfo(form.category);
        const catName = cat.label.split(" ")[1];
        if (newSpent>budget) notify(`⚠️ ${catName} 預算已超支！`,"error");
        else if (newSpent/budget>=0.8) notify(`注意：${catName} 預算已用 ${Math.round(newSpent/budget*100)}%`,"warn");
        else notify(editId?"已更新！":"已記錄！");
      } else notify(editId?"已更新！":"已記錄！");
    } else {
      notify(editId?"已更新（一銀）":"已記錄（一銀，不計自由金）");
    }

    setForm({...emptyForm, date:toDay()});
    setEditId(null);
    setPage("home");
  }

  function deleteTx(id) {
    setData(d=>({...d, transactions:d.transactions.filter(t=>t.id!==id)}));
    notify("已刪除");
  }
  function addFixed() {
    if (!fixedForm.name||!fixedForm.amount) { notify("請填寫名稱與金額","error"); return; }
    setData(d=>({...d, fixedExpenses:[...d.fixedExpenses,{id:Date.now(),name:fixedForm.name,amount:Number(fixedForm.amount)}]}));
    setFixedForm({name:"",amount:""}); setShowAddFixed(false); notify("已新增固定支出");
  }
  function deleteFixed(id) { setData(d=>({...d,fixedExpenses:d.fixedExpenses.filter(e=>e.id!==id)})); }
  function saveBudgets() {
    const nb={};
    CATEGORIES.forEach(c=>{ const v=Number(budgetInputs[c.id]); if(v>0) nb[c.id]=v; });
    setData(d=>({...d,budgets:nb})); notify("預算已儲存");
  }
  function saveSetup() {
    const inc=Number(incomeInput);
    if (!inc||inc<=0) { notify("請輸入有效的收入金額","error"); return; }
    setData(d=>({...d,income:inc,setupDone:true}));
    setPage("home"); notify("設定完成！");
  }

  // ── STYLES ────────────────────────────────────────────────────────────────
  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;700;900&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Noto Sans TC',sans-serif;background:#0f0f13;color:#f0f0f0;min-height:100vh}
    .app{max-width:430px;margin:0 auto;min-height:100vh;display:flex;flex-direction:column}
    .header{padding:20px 20px 0;display:flex;align-items:center;justify-content:space-between}
    .content{flex:1;padding:16px 20px 90px}
    .setup-wrap{padding:40px 24px}
    .setup-title{font-size:28px;font-weight:900;margin-bottom:8px}
    .setup-sub{color:#888;font-size:14px;margin-bottom:36px;line-height:1.6}
    .lbl{font-size:12px;color:#aaa;letter-spacing:.08em;margin-bottom:8px}
    .setup-input{width:100%;background:#1c1c24;border:1.5px solid #2a2a35;border-radius:12px;color:#fff;font-size:22px;font-family:'Noto Sans TC',sans-serif;padding:16px 18px;outline:none;transition:border-color .2s;margin-bottom:28px}
    .setup-input:focus{border-color:#6366f1}
    .btn-primary{width:100%;background:#6366f1;color:#fff;border:none;border-radius:14px;padding:16px;font-size:16px;font-weight:700;font-family:'Noto Sans TC',sans-serif;cursor:pointer;transition:background .15s,transform .1s}
    .btn-primary:active{transform:scale(.97);background:#4f46e5}
    .card{background:#1c1c24;border-radius:20px;padding:20px;margin-bottom:14px}
    .free-label{font-size:12px;color:#888;letter-spacing:.08em;margin-bottom:4px}
    .free-amount{font-size:42px;font-weight:900;letter-spacing:-1px;line-height:1;margin-bottom:4px}
    .free-amount.danger{color:#ef4444}.free-amount.warn{color:#f59e0b}.free-amount.safe{color:#22c55e}
    .free-sub{font-size:13px;color:#888;margin-bottom:18px}
    .bar-bg{height:8px;background:#2a2a35;border-radius:99px;overflow:hidden}
    .bar-thin{height:6px;background:#2a2a35;border-radius:99px;overflow:hidden}
    .bar-fill{height:100%;border-radius:99px;transition:width .6s cubic-bezier(.4,0,.2,1)}
    .bar-labels{display:flex;justify-content:space-between;margin-top:8px;font-size:11px;color:#666}
    .section-title{font-size:12px;color:#888;letter-spacing:.08em;margin-bottom:12px}
    .icbc-pill{display:flex;align-items:center;gap:6px;background:#1c1c24;border-radius:12px;padding:10px 16px;margin-bottom:14px}
    .icbc-pill-label{font-size:12px;color:#888;flex:1}
    .icbc-pill-amt{font-size:16px;font-weight:700;color:#f59e0b}
    .budget-row{margin-bottom:14px}.budget-row:last-child{margin-bottom:0}
    .budget-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
    .budget-cat{font-size:13px;font-weight:500}
    .budget-nums{font-size:11px;color:#888}.budget-nums.over{color:#ef4444;font-weight:700}
    /* Tx */
    .tx-item{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid #23232e;cursor:pointer;transition:background .1s;border-radius:8px;margin:0 -8px;padding-left:8px;padding-right:0}
    .tx-item:last-child{border-bottom:none}
    .tx-item:active{background:#23232e}
    .tx-icon{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
    .tx-info{flex:1;min-width:0}
    .tx-note{font-size:14px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .tx-meta{font-size:11px;color:#666;margin-top:2px}
    .tx-right{text-align:right;flex-shrink:0}
    .tx-amount{font-size:15px;font-weight:700}
    .tx-amount.excluded{color:#f59e0b}
    .tx-del{background:none;border:none;color:#333;font-size:16px;cursor:pointer;padding:4px 8px;flex-shrink:0}
    .tx-del:active{color:#ef4444}
    .empty{text-align:center;color:#555;font-size:14px;padding:30px 0}
    /* Add/Edit */
    .add-wrap{padding:20px}
    .add-title{font-size:22px;font-weight:900;margin-bottom:20px}
    .big-input{width:100%;background:#1c1c24;border:1.5px solid #2a2a35;border-radius:12px;color:#fff;font-size:28px;font-weight:700;font-family:'Noto Sans TC',sans-serif;padding:16px 18px;outline:none;transition:border-color .2s;margin-bottom:16px}
    .big-input:focus{border-color:#6366f1}
    .sm-input{width:100%;background:#1c1c24;border:1.5px solid #2a2a35;border-radius:12px;color:#fff;font-size:16px;font-family:'Noto Sans TC',sans-serif;padding:14px 16px;outline:none;transition:border-color .2s;margin-bottom:16px}
    .sm-input:focus{border-color:#6366f1}
    .date-input{width:100%;background:#1c1c24;border:1.5px solid #2a2a35;border-radius:12px;color:#fff;font-size:16px;font-family:'Noto Sans TC',sans-serif;padding:13px 16px;outline:none;transition:border-color .2s;margin-bottom:16px;appearance:none;-webkit-appearance:none}
    .date-input:focus{border-color:#6366f1}
    .cat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
    .sub-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:16px}
    .pay-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px}
    .grid-btn{background:#1c1c24;border:2px solid #2a2a35;border-radius:14px;padding:10px 4px;cursor:pointer;text-align:center;font-size:10px;color:#aaa;font-family:'Noto Sans TC',sans-serif;transition:all .15s;line-height:1.4}
    .grid-btn span{display:block;font-size:20px;margin-bottom:3px}
    .grid-btn.selected{border-color:#6366f1;color:#fff;background:#1e1e2e}
    .sub-btn{background:#13131a;border:1.5px solid #2a2a35;border-radius:10px;padding:8px 4px;cursor:pointer;text-align:center;font-size:11px;color:#888;font-family:'Noto Sans TC',sans-serif;transition:all .15s}
    .sub-btn.selected{border-color:#6366f1;color:#fff;background:#1e1e2e}
    .pay-btn{background:#1c1c24;border:2px solid #2a2a35;border-radius:12px;padding:11px 8px;cursor:pointer;text-align:center;font-size:12px;color:#aaa;font-family:'Noto Sans TC',sans-serif;transition:all .15s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pay-btn.selected{border-color:#6366f1;color:#fff;background:#1e1e2e}
    .pay-btn.icbc-sel{border-color:#f59e0b;color:#f59e0b;background:#1c1a10}
    .icbc-notice{background:#f59e0b18;border:1px solid #f59e0b44;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#f59e0b}
    .budget-warn-box{background:#f59e0b18;border:1px solid #f59e0b44;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#f59e0b}
    .budget-warn-box.over{background:#ef444418;border-color:#ef444444;color:#ef4444}
    .del-row{margin-top:12px}
    .btn-del-tx{width:100%;background:none;color:#ef4444;border:1.5px solid #2a2a35;border-radius:12px;padding:13px;font-size:14px;font-family:'Noto Sans TC',sans-serif;cursor:pointer}
    /* Settings */
    .settings-wrap{padding:20px}
    .settings-title{font-size:22px;font-weight:900;margin-bottom:24px}
    .income-edit-row{display:flex;gap:8px;margin-bottom:20px}
    .income-edit-input{flex:1;background:#1c1c24;border:1.5px solid #2a2a35;border-radius:10px;color:#fff;font-size:18px;font-family:'Noto Sans TC',sans-serif;padding:12px 14px;outline:none}
    .income-edit-input:focus{border-color:#6366f1}
    .btn-sm{background:#6366f1;color:#fff;border:none;border-radius:10px;padding:12px 16px;font-size:14px;font-weight:700;font-family:'Noto Sans TC',sans-serif;cursor:pointer;white-space:nowrap}
    .fixed-item{display:flex;align-items:center;justify-content:space-between;padding:12px 0;border-bottom:1px solid #1c1c24}
    .fixed-del{background:none;border:none;color:#444;font-size:18px;cursor:pointer}
    .add-fixed-form{background:#1c1c24;border-radius:16px;padding:16px;margin-top:14px}
    .inline-row{display:flex;gap:8px}
    .sm-input-inline{flex:1;background:#13131a;border:1.5px solid #2a2a35;border-radius:10px;color:#fff;font-size:14px;font-family:'Noto Sans TC',sans-serif;padding:12px;outline:none}
    .sm-input-inline:focus{border-color:#6366f1}
    .btn-outline{background:none;color:#888;border:1.5px solid #2a2a35;border-radius:12px;padding:12px 16px;font-size:14px;font-family:'Noto Sans TC',sans-serif;cursor:pointer;display:block;width:100%;text-align:center;margin-top:8px}
    .btn-outline:hover{color:#fff;border-color:#6366f1}
    .btn-danger{background:none;color:#ef4444;border:1.5px solid #2a2a35;border-radius:12px;padding:12px 16px;font-size:14px;font-family:'Noto Sans TC',sans-serif;cursor:pointer;display:block;width:100%;text-align:center;margin-top:8px}
    .total-divider{display:flex;justify-content:space-between;font-size:12px;color:#666;padding:10px 0 0;border-top:1px solid #2a2a35;margin-top:8px}
    .budget-setting-row{display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #1c1c24}
    .budget-setting-label{flex:1;font-size:14px}
    .budget-setting-input{width:110px;background:#13131a;border:1.5px solid #2a2a35;border-radius:10px;color:#fff;font-size:14px;font-family:'Noto Sans TC',sans-serif;padding:10px 12px;outline:none;text-align:right}
    .budget-setting-input:focus{border-color:#6366f1}
    /* History */
    .history-wrap{padding:20px}
    .history-title{font-size:22px;font-weight:900;margin-bottom:20px}
    .month-tabs{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;margin-bottom:20px;scrollbar-width:none}
    .month-tabs::-webkit-scrollbar{display:none}
    .month-tab{background:#1c1c24;border:1.5px solid #2a2a35;border-radius:99px;padding:8px 16px;font-size:13px;color:#888;white-space:nowrap;cursor:pointer;font-family:'Noto Sans TC',sans-serif;flex-shrink:0;transition:all .15s}
    .month-tab.active{background:#6366f1;border-color:#6366f1;color:#fff}
    .history-summary{display:flex;gap:10px;margin-bottom:16px}
    .history-stat{flex:1;background:#1c1c24;border-radius:14px;padding:14px;text-align:center}
    .history-stat-val{font-size:18px;font-weight:700}
    .history-stat-lbl{font-size:11px;color:#666;margin-top:3px}
    /* Nav */
    .nav{position:fixed;bottom:0;left:50%;transform:translateX(-50%);width:100%;max-width:430px;background:#13131a;border-top:1px solid #1c1c24;display:flex;padding:8px 0 20px}
    .nav-btn{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;font-size:10px;color:#555;background:none;border:none;cursor:pointer;padding:6px 0;font-family:'Noto Sans TC',sans-serif;letter-spacing:.05em;transition:color .15s}
    .nav-btn.active{color:#6366f1}
    .nav-btn.add-btn{color:#6366f1}
    .nav-icon{font-size:22px}
    .nav-add-circle{width:44px;height:44px;background:#6366f1;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;box-shadow:0 2px 12px rgba(99,102,241,.45);margin-bottom:1px}
    /* Notif */
    .notif{position:fixed;top:20px;left:50%;transform:translateX(-50%);background:#22c55e;color:#fff;border-radius:99px;padding:10px 22px;font-size:14px;font-weight:600;z-index:999;animation:slideIn .2s ease;white-space:nowrap}
    .notif.error{background:#ef4444}.notif.warn{background:#f59e0b}
    @keyframes slideIn{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
    .back-btn{background:none;border:none;color:#888;font-size:15px;font-family:'Noto Sans TC',sans-serif;cursor:pointer;padding:0;display:flex;align-items:center;gap:6px;margin-bottom:20px}
    .divider{height:1px;background:#1c1c24;margin:20px 0}
  `;

  // ── NAV ───────────────────────────────────────────────────────────────────
  const Nav = ({ active }) => (
    <div className="nav">
      <button className="nav-btn add-btn" onClick={openAdd}>
        <div className="nav-add-circle">＋</div>記帳
      </button>
      <button className={`nav-btn${active==="home"?" active":""}`} onClick={()=>setPage("home")}>
        <span className="nav-icon">🏠</span>首頁
      </button>
      <button className={`nav-btn${active==="history"?" active":""}`} onClick={()=>{ const ms=allMonths(data.transactions); setHistoryMonth(ms[0]||curMonth()); setPage("history"); }}>
        <span className="nav-icon">📅</span>歷史
      </button>
      <button className={`nav-btn${active==="settings"?" active":""}`} onClick={()=>setPage("settings")}>
        <span className="nav-icon">⚙️</span>設定
      </button>
    </div>
  );

  // ── TX LIST (shared) ──────────────────────────────────────────────────────
  const TxList = ({ txList }) => (
    <>
      {txList.length===0 && <div className="empty">沒有記錄</div>}
      {txList.map(tx => {
        const cat = getCatInfo(tx.category);
        const pay = getPayInfo(tx.payment);
        const excluded = pay.excludeFromFree;
        const label = tx.sub ? tx.sub : (tx.note||cat.label.split(" ")[1]);
        const extra = tx.sub && tx.note ? ` · ${tx.note}` : "";
        return (
          <div key={tx.id} className="tx-item" onClick={()=>openEdit(tx)}>
            <div className="tx-icon" style={{background:cat.color+"22"}}>{cat.label.split(" ")[0]}</div>
            <div className="tx-info">
              <div className="tx-note">{label}{extra}</div>
              <div className="tx-meta">{tx.date}　{pay.label}</div>
            </div>
            <div className="tx-right">
              <div className={`tx-amount${excluded?" excluded":""}`}>−{fmt(tx.amount)}</div>
            </div>
            <button className="tx-del" onClick={e=>{e.stopPropagation();deleteTx(tx.id);}}>✕</button>
          </div>
        );
      })}
    </>
  );

  // ── SETUP ─────────────────────────────────────────────────────────────────
  if (page==="setup") return (
    <div className="app"><style>{css}</style>
      {notification && <div className={`notif ${notification.type}`}>{notification.msg}</div>}
      <div className="setup-wrap">
        <div className="setup-title">👋 嗨，歡迎！</div>
        <div className="setup-sub">先告訴我你每個月的收入，我幫你算出你有多少可以自由花用的錢。</div>
        <div className="lbl">每月收入（薪水等）</div>
        <input className="setup-input" type="number" placeholder="例：30000" value={incomeInput}
          onChange={e=>setIncomeInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveSetup()} />
        <button className="btn-primary" onClick={saveSetup}>開始記帳 →</button>
      </div>
    </div>
  );

  // ── ADD / EDIT ─────────────────────────────────────────────────────────────
  if (page==="add") {
    const pm = PAYMENT_METHODS.find(p=>p.id===form.payment);
    const isIcbc = pm?.excludeFromFree;
    const selCat = getCatInfo(form.category);
    const selBudget = catBudget(form.category);
    const selSpent  = catSpent(form.category);
    const oldAmt = editId ? (data.transactions.find(t=>t.id===editId)?.amount||0) : 0;
    const preview   = selSpent - oldAmt + Number(form.amount||0);
    const budgetPct = selBudget>0 ? preview/selBudget*100 : 0;
    const showHint  = !isIcbc && selBudget>0 && Number(form.amount)>0 && budgetPct>=80;
    const isOver    = budgetPct>=100;

    return (
      <div className="app"><style>{css}</style>
        {notification && <div className={`notif ${notification.type}`}>{notification.msg}</div>}
        <div className="add-wrap">
          <button className="back-btn" onClick={()=>{setPage(editId?"home":"home");setEditId(null);}}>← 返回</button>
          <div className="add-title">{editId?"編輯支出":"記一筆支出"}</div>

          <div className="lbl">金額</div>
          <input className="big-input" type="number" placeholder="0" value={form.amount} autoFocus
            onChange={e=>setForm(f=>({...f,amount:e.target.value}))} />

          <div className="lbl">日期</div>
          <input className="date-input" type="date" value={form.date}
            onChange={e=>setForm(f=>({...f,date:e.target.value}))} />

          <div className="lbl">備註（可省略）</div>
          <input className="sm-input" type="text" placeholder="在哪花的？" value={form.note}
            onChange={e=>setForm(f=>({...f,note:e.target.value}))} />

          <div className="lbl" style={{marginBottom:10}}>分類</div>
          <div className="cat-grid">
            {CATEGORIES.map(c=>(
              <button key={c.id} className={`grid-btn${form.category===c.id?" selected":""}`}
                onClick={()=>setForm(f=>({...f,category:c.id,sub:""}))}>
                <span>{c.label.split(" ")[0]}</span>{c.label.split(" ")[1]}
              </button>
            ))}
          </div>

          {selCat?.sub?.length>0 && (
            <>
              <div className="lbl" style={{marginBottom:8}}>細項（可跳過）</div>
              <div className="sub-grid">
                <button className={`sub-btn${form.sub===""?" selected":""}`}
                  onClick={()=>setForm(f=>({...f,sub:""}))}>不細分</button>
                {selCat.sub.map(s=>(
                  <button key={s} className={`sub-btn${form.sub===s?" selected":""}`}
                    onClick={()=>setForm(f=>({...f,sub:s}))}>{s}</button>
                ))}
              </div>
            </>
          )}

          <div className="lbl" style={{marginBottom:10}}>支付方式</div>
          <div className="pay-grid">
            {PAYMENT_METHODS.map(p=>{
              const sel = form.payment===p.id;
              const cls = sel ? (p.excludeFromFree?"pay-btn icbc-sel":"pay-btn selected") : "pay-btn";
              return <button key={p.id} className={cls} onClick={()=>setForm(f=>({...f,payment:p.id}))}>{p.label}</button>;
            })}
          </div>

          {isIcbc && <div className="icbc-notice">🏛️ 此筆將獨立追蹤，不計入自由金餘額</div>}
          {showHint && (
            <div className={`budget-warn-box${isOver?" over":""}`}>
              {isOver
                ? `⚠️ 記完後 ${selCat.label.split(" ")[1]} 將超支 ${fmt(preview-selBudget)}`
                : `注意：記完後 ${selCat.label.split(" ")[1]} 預算將用掉 ${budgetPct.toFixed(0)}%`}
            </div>
          )}

          <button className="btn-primary" onClick={saveTransaction}>
            {editId?"儲存修改":"記錄支出"}
          </button>

          {editId && (
            <div className="del-row">
              <button className="btn-del-tx" onClick={()=>{
                if(window.confirm("確定要刪除這筆記錄嗎？")){
                  deleteTx(editId); setEditId(null); setPage("home");
                }
              }}>刪除這筆記錄</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── HISTORY ───────────────────────────────────────────────────────────────
  if (page==="history") {
    const months = allMonths(data.transactions);
    if (months.length===0) return (
      <div className="app"><style>{css}</style>
        <div className="header"><div style={{fontSize:13,color:"#888",letterSpacing:"0.1em"}}>歷史記錄</div></div>
        <div className="content"><div className="empty" style={{paddingTop:60}}>還沒有任何記錄</div></div>
        <Nav active="history" />
      </div>
    );
    const hm = historyMonth||months[0];
    const hmTx   = data.transactions.filter(t=>mKey(t.date)===hm);
    const hmFree = hmTx.filter(t=>!isExcluded(t.payment));
    const hmIcbc = hmTx.filter(t=>isExcluded(t.payment));
    const hmSpent     = hmFree.reduce((s,t)=>s+Number(t.amount),0);
    const hmIcbcSpent = hmIcbc.reduce((s,t)=>s+Number(t.amount),0);
    return (
      <div className="app"><style>{css}</style>
        {notification && <div className={`notif ${notification.type}`}>{notification.msg}</div>}
        <div className="header">
          <div style={{fontSize:13,color:"#888",letterSpacing:"0.1em"}}>歷史記錄</div>
        </div>
        <div className="content">
          <div className="month-tabs">
            {months.map(m=>(
              <button key={m} className={`month-tab${hm===m?" active":""}`} onClick={()=>setHistoryMonth(m)}>
                {monthLabel(m)}
              </button>
            ))}
          </div>
          <div className="history-summary">
            <div className="history-stat"><div className="history-stat-val">{fmt(hmSpent)}</div><div className="history-stat-lbl">自由金支出</div></div>
            <div className="history-stat"><div className="history-stat-val" style={{color:"#f59e0b"}}>{fmt(hmIcbcSpent)}</div><div className="history-stat-lbl">一銀信用卡</div></div>
            <div className="history-stat"><div className="history-stat-val">{hmTx.length}</div><div className="history-stat-lbl">筆數</div></div>
          </div>
          <div className="card" style={{padding:"4px 16px"}}>
            <TxList txList={hmTx} />
          </div>
        </div>
        <Nav active="history" />
      </div>
    );
  }

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  if (page==="settings") return (
    <div className="app"><style>{css}</style>
      {notification && <div className={`notif ${notification.type}`}>{notification.msg}</div>}
      <div className="settings-wrap">
        <div className="settings-title">設定</div>
        <div className="section-title">每月收入</div>
        <div className="income-edit-row">
          <input className="income-edit-input" type="number" value={incomeInput}
            onChange={e=>setIncomeInput(e.target.value)} placeholder="每月收入" />
          <button className="btn-sm" onClick={()=>{
            const inc=Number(incomeInput);
            if(!inc||inc<=0){notify("請輸入有效金額","error");return;}
            setData(d=>({...d,income:inc})); notify("已更新收入");
          }}>儲存</button>
        </div>
        <div className="section-title">每月固定支出</div>
        <div style={{fontSize:12,color:"#555",marginBottom:12}}>目前：{fmt(totalFixed)}，自由金總額：{fmt(freeTotal)}</div>
        {data.fixedExpenses.length===0&&<div className="empty" style={{padding:"12px 0"}}>尚未設定</div>}
        {data.fixedExpenses.map(e=>(
          <div key={e.id} className="fixed-item">
            <span style={{fontSize:14}}>{e.name}</span>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:14,color:"#888"}}>{fmt(e.amount)}</span>
              <button className="fixed-del" onClick={()=>deleteFixed(e.id)}>✕</button>
            </div>
          </div>
        ))}
        {data.fixedExpenses.length>0&&<div className="total-divider"><span>合計</span><span>{fmt(totalFixed)}</span></div>}
        {showAddFixed ? (
          <div className="add-fixed-form">
            <div className="lbl" style={{marginBottom:10}}>新增固定支出</div>
            <div className="inline-row" style={{marginBottom:10}}>
              <input className="sm-input-inline" placeholder="名稱（如：房租）" value={fixedForm.name} onChange={e=>setFixedForm(f=>({...f,name:e.target.value}))} />
              <input className="sm-input-inline" type="number" placeholder="金額" value={fixedForm.amount} onChange={e=>setFixedForm(f=>({...f,amount:e.target.value}))} style={{width:110,flex:"none"}} />
            </div>
            <div className="inline-row">
              <button className="btn-sm" style={{flex:1}} onClick={addFixed}>新增</button>
              <button className="btn-sm" style={{background:"#2a2a35"}} onClick={()=>setShowAddFixed(false)}>取消</button>
            </div>
          </div>
        ) : (
          <button className="btn-outline" onClick={()=>setShowAddFixed(true)}>＋ 新增固定支出</button>
        )}
        <div className="divider" />
        <div className="section-title">各分類每月預算</div>
        <div style={{fontSize:12,color:"#555",marginBottom:14}}>不填代表該分類不設限</div>
        {CATEGORIES.map(c=>(
          <div key={c.id} className="budget-setting-row">
            <span className="budget-setting-label">{c.label}</span>
            <input className="budget-setting-input" type="number" placeholder="不限"
              value={budgetInputs[c.id]||""} onChange={e=>setBudgetInputs(b=>({...b,[c.id]:e.target.value}))} />
          </div>
        ))}
        <button className="btn-sm" style={{width:"100%",marginTop:14}} onClick={saveBudgets}>儲存預算設定</button>
        <div className="divider" />
        <button className="btn-danger" onClick={()=>{
          if(window.confirm("確定要清除所有記錄嗎？")){setData(d=>({...d,transactions:[]}));notify("已清除所有記錄");}
        }}>清除所有記錄</button>
      </div>
      <Nav active="settings" />
    </div>
  );

  // ── HOME ──────────────────────────────────────────────────────────────────
  return (
    <div className="app"><style>{css}</style>
      {notification && <div className={`notif ${notification.type}`}>{notification.msg}</div>}
      <div className="header">
        <div style={{fontSize:13,color:"#888",letterSpacing:"0.1em"}}>本月自由金</div>
        <div style={{fontSize:12,color:"#555"}}>{monthLabel(thisMonth)}</div>
      </div>
      <div className="content">
        <div className="card">
          <div className="free-label">剩餘可用</div>
          <div className={`free-amount ${overallLvl}`}>{fmt(remaining)}</div>
          <div className="free-sub">本月已花 {fmt(spent)} ／ 共 {fmt(freeTotal)}</div>
          <div className="bar-bg">
            <div className="bar-fill" style={{width:`${Math.min(100,overallPct)}%`,background:barColor(overallPct)}} />
          </div>
          <div className="bar-labels">
            <span>{overallPct.toFixed(0)}% 已使用</span>
            <span>還剩 {Math.max(0,100-Math.round(overallPct))}%</span>
          </div>
        </div>

        {icbcSpent>0 && (
          <div className="icbc-pill">
            <span className="icbc-pill-label">🏛️ 一銀信用卡本月消費</span>
            <span className="icbc-pill-amt">{fmt(icbcSpent)}</span>
          </div>
        )}

        {budgetedCats.length>0 && (
          <>
            <div className="section-title">各分類預算</div>
            <div className="card" style={{padding:"16px 20px"}}>
              {budgetedCats.map((c,i)=>{
                const sp=catSpent(c.id); const bgt=catBudget(c.id);
                const pct=Math.min(110,(sp/bgt)*100); const over=sp>bgt;
                return (
                  <div key={c.id} className="budget-row" style={i===budgetedCats.length-1?{marginBottom:0}:{}}>
                    <div className="budget-header">
                      <span className="budget-cat">{c.label}</span>
                      <span className={`budget-nums${over?" over":""}`}>
                        {over?`超支 ${fmt(sp-bgt)}`:`${fmt(sp)} / ${fmt(bgt)}`}
                      </span>
                    </div>
                    <div className="bar-thin">
                      <div className="bar-fill" style={{width:`${Math.min(100,pct)}%`,background:barColor(pct)}} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div className="section-title" style={{marginTop:4}}>最近記錄</div>
        <div className="card" style={{padding:"4px 16px"}}>
          {thisMonthTx.length===0&&<div className="empty">本月還沒有記錄，按記帳開始！</div>}
          <TxList txList={thisMonthTx.slice(0,20)} />
        </div>
      </div>
      <Nav active="home" />
    </div>
  );
}
