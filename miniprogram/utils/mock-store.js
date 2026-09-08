const STORAGE_KEY = "tc_member_mock_v2";

const initialMembers = [
  {
    id: "m0001",
    memberNo: "0001",
    name: "陈女士",
    phone: "13800008026",
    level: "金卡",
    balanceFen: 128000,
    points: 360,
    remark: "偏爱清透底妆，眼妆避免暖橘色。",
    transactions: [
      { id: "t0002", type: "consume", title: "精致妆面", amountFen: -16800, createdAt: "2026-09-06T14:32:00+08:00", operator: "小林", method: "余额支付", balanceAfterFen: 128000 },
      { id: "t0001", type: "recharge", title: "会员充值", amountFen: 100000, createdAt: "2026-08-28T11:05:00+08:00", operator: "小林", method: "微信收款", balanceAfterFen: 144800 }
    ]
  },
  { id: "m0002", memberNo: "0002", name: "林先生", phone: "13900001938", level: "银卡", balanceFen: 56000, points: 180, remark: "", transactions: [] },
  { id: "m0003", memberNo: "0003", name: "王女士", phone: "13700006018", level: "金卡", balanceFen: 238000, points: 620, remark: "", transactions: [] },
  { id: "m0004", memberNo: "0004", name: "许女士", phone: "13600007216", level: "普通会员", balanceFen: 8800, points: 40, remark: "", transactions: [] },
  { id: "m0005", memberNo: "0005", name: "周先生", phone: "13500003106", level: "普通会员", balanceFen: 0, points: 20, remark: "", transactions: [] }
];

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function load() {
  const cached = wx.getStorageSync(STORAGE_KEY);
  if (cached && Array.isArray(cached.members)) return cached;
  const seeded = { members: clone(initialMembers) };
  wx.setStorageSync(STORAGE_KEY, seeded);
  return seeded;
}

function save(state) {
  wx.setStorageSync(STORAGE_KEY, state);
}

function money(fen) {
  const cents = Math.round(Number(fen || 0));
  const integer = String(Math.floor(Math.abs(cents) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const decimal = String(Math.abs(cents) % 100).padStart(2, "0");
  return `${cents < 0 ? "−" : ""}${integer}.${decimal}`;
}

function maskPhone(phone) {
  return `${phone.slice(0, 3)} ···· ${phone.slice(-4)}`;
}

function localDateKey(value) {
  const date = value ? new Date(value) : new Date();
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}

function decorateMember(member) {
  const id = member.id || member._id;
  return {
    ...clone(member),
    id,
    _id: member._id || id,
    balanceText: money(member.balanceFen),
    phoneMasked: maskPhone(member.phone),
  };
}

function listMembers({ query = "", level = "全部会员" } = {}) {
  const state = load();
  const keyword = query.trim();
  return state.members
    .filter((member) => level === "全部会员" || member.level === level)
    .filter((member) => !keyword || member.name.includes(keyword) || member.phone.includes(keyword))
    .map(decorateMember);
}

function getMember(id) {
  const member = load().members.find((item) => item.id === id);
  return member ? decorateMember(member) : null;
}

function getSummary() {
  const members = load().members;
  const today = localDateKey();
  const balanceFen = members.reduce((sum, member) => sum + member.balanceFen, 0);
  const consumedFen = members.reduce((total, member) => {
    return total + (member.transactions || []).reduce((sum, transaction) => {
      const isToday = transaction.type === "consume" && localDateKey(transaction.createdAt) === today;
      return sum + (isToday ? Math.abs(transaction.amountFen) : 0);
    }, 0);
  }, 0);
  return { memberCount: members.length, balanceText: money(balanceFen), consumedText: money(consumedFen) };
}

function addMember({ name, phone, level, remark }) {
  const state = load();
  if (state.members.some((member) => member.phone === phone)) {
    throw new Error("这个手机号已经存在，请返回会员列表搜索");
  }
  const serial = state.members.reduce((max, member) => Math.max(max, Number(member.memberNo)), 0) + 1;
  const member = {
    id: `m${Date.now()}`,
    memberNo: String(serial).padStart(4, "0"),
    name,
    phone,
    level: level || "普通会员",
    balanceFen: 0,
    points: 0,
    remark: remark || "",
    transactions: [],
  };
  state.members.unshift(member);
  save(state);
  return decorateMember(member);
}

function addTransaction({ memberId, type, amountFen, giftFen = 0, service = "", method = "", remark = "", operator = "小林" }) {
  const state = load();
  const member = state.members.find((item) => item.id === memberId);
  if (!member) throw new Error("未找到会员");
  const deltaFen = type === "recharge" ? amountFen + giftFen : -amountFen;
  if (member.balanceFen + deltaFen < 0) throw new Error("余额不足，请核对扣款金额或先登记充值");
  member.balanceFen += deltaFen;
  member.transactions.unshift({
    id: `t${Date.now()}`,
    type,
    title: type === "recharge" ? "会员充值" : service,
    amountFen: deltaFen,
    createdAt: new Date().toISOString(),
    operator,
    method: type === "recharge" ? `${method}收款${giftFen ? `（含赠送 ¥${money(giftFen)}）` : ""}` : "余额支付",
    remark,
    balanceAfterFen: member.balanceFen,
  });
  save(state);
  return decorateMember(member);
}

function formatTransaction(transaction) {
  const id = transaction.id || transaction._id;
  const date = new Date(transaction.createdAt);
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const stamp = shifted.toISOString();
  return {
    ...clone(transaction),
    id,
    _id: transaction._id || id,
    amountText: `${transaction.amountFen > 0 ? "+" : "−"}${money(Math.abs(transaction.amountFen))}`,
    positive: transaction.amountFen > 0,
    timeText: `${stamp.slice(5, 10).replace("-", "/")} ${stamp.slice(11, 16)}`,
    balanceAfterText: money(transaction.balanceAfterFen),
  };
}

function reset() {
  wx.removeStorageSync(STORAGE_KEY);
  load();
}

module.exports = { addMember, addTransaction, decorateMember, formatTransaction, getMember, getSummary, listMembers, maskPhone, money, reset };
