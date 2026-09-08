const cloud = require("wx-server-sdk");
const { employees } = require("./config");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const COLLECTIONS = ["members", "transactions", "operation_logs", "member_phones", "counters"];

class ServiceError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}

function currentEmployee() {
  const { OPENID } = cloud.getWXContext();
  return { openid: OPENID, employee: employees.find((item) => item.openid === OPENID) };
}

function requireEmployee() {
  const identity = currentEmployee();
  if (!identity.employee) throw new ServiceError("FORBIDDEN", "当前微信没有会员管理权限");
  return identity;
}

function assertString(value, label, maxLength) {
  const text = String(value || "").trim();
  if (!text) throw new ServiceError("INVALID_INPUT", `请填写${label}`);
  if (text.length > maxLength) throw new ServiceError("INVALID_INPUT", `${label}过长`);
  return text;
}

function assertFen(value, label, allowZero = false) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0 || (!allowZero && number === 0)) {
    throw new ServiceError("INVALID_INPUT", `${label}金额不正确`);
  }
  return number;
}

function randomId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function getOrNull(reference) {
  try {
    const result = await reference.get();
    return result && result.data ? result.data : null;
  } catch (error) {
    const message = String(error.errMsg || error.message || "");
    if (error.errCode === -1 || /not exist|does not exist|不存在/i.test(message)) return null;
    throw error;
  }
}

async function login() {
  const { openid, employee } = currentEmployee();
  console.log("TC login", { openid, authorized: Boolean(employee) });
  if (!employee) return { authorized: false, role: "visitor" };
  return { authorized: true, name: employee.name, role: employee.role || "operator" };
}

async function initialize() {
  requireEmployee();
  await Promise.all(COLLECTIONS.map(async (name) => {
    try { await db.createCollection(name); }
    catch (error) {
      const message = String(error.errMsg || error.message || "");
      if (!/exist|已存在/i.test(message)) throw error;
    }
  }));
  const counter = await getOrNull(db.collection("counters").doc("memberNo"));
  if (!counter) await db.collection("counters").doc("memberNo").set({ data: { value: 0, updatedAt: new Date() } });
  return { collections: COLLECTIONS, initialized: true };
}

async function initializeCollection(event) {
  const { employee } = requireEmployee();
  if (employee.role !== "super_admin") throw new ServiceError("FORBIDDEN", "只有超级管理员可以初始化数据库");
  const name = assertString(event.name, "集合名称", 40);
  if (!COLLECTIONS.includes(name)) throw new ServiceError("INVALID_INPUT", "集合名称不正确");
  try { await db.createCollection(name); }
  catch (error) {
    const message = String(error.errMsg || error.message || "");
    if (!/exist|已存在/i.test(message)) throw error;
  }
  if (name === "counters") {
    const counter = await getOrNull(db.collection("counters").doc("memberNo"));
    if (!counter) await db.collection("counters").doc("memberNo").set({ data: { value: 0, updatedAt: new Date() } });
  }
  return { name, initialized: true };
}

async function listMembers(event) {
  requireEmployee();
  const result = await db.collection("members").where({ status: "active" }).limit(100).get();
  const query = String(event.query || "").trim();
  const level = String(event.level || "全部会员");
  return result.data.filter((member) => {
    const levelMatch = level === "全部会员" || member.level === level;
    const queryMatch = !query || member.name.includes(query) || member.phone.includes(query);
    return levelMatch && queryMatch;
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function getMember(event) {
  requireEmployee();
  const id = assertString(event.id, "会员编号", 80);
  const member = await getOrNull(db.collection("members").doc(id));
  if (!member) throw new ServiceError("NOT_FOUND", "会员不存在");
  const transactions = await db.collection("transactions").where({ memberId: id }).limit(100).get();
  transactions.data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return { member, transactions: transactions.data.slice(0, 50) };
}

function shanghaiDayRange() {
  const day = 24 * 60 * 60 * 1000;
  const offset = 8 * 60 * 60 * 1000;
  const now = Date.now();
  const start = Math.floor((now + offset) / day) * day - offset;
  return { start: new Date(start), end: new Date(start + day) };
}

async function getSummary() {
  requireEmployee();
  const { start, end } = shanghaiDayRange();
  const [memberResult, transactionResult] = await Promise.all([
    db.collection("members").where({ status: "active" }).limit(100).get(),
    db.collection("transactions").where({ type: "consume" }).limit(1000).get(),
  ]);
  return {
    memberCount: memberResult.data.length,
    balanceFen: memberResult.data.reduce((sum, member) => sum + Number(member.balanceFen || 0), 0),
    consumedFen: transactionResult.data.filter((item) => item.createdAt >= start && item.createdAt < end).reduce((sum, item) => sum + Math.abs(Number(item.amountFen || 0)), 0),
  };
}

async function createMember(event) {
  const { openid, employee } = requireEmployee();
  const name = assertString(event.name, "会员姓名", 20);
  const phone = assertString(event.phone, "手机号", 11);
  if (!/^1[3-9]\d{9}$/.test(phone)) throw new ServiceError("INVALID_INPUT", "手机号格式不正确");
  const level = ["普通会员", "银卡", "金卡"].includes(event.level) ? event.level : "普通会员";
  const remark = String(event.remark || "").trim().slice(0, 200);
  const memberId = randomId("m");
  const now = new Date();

  return db.runTransaction(async (transaction) => {
    const phoneReference = transaction.collection("member_phones").doc(phone);
    if (await getOrNull(phoneReference)) throw new ServiceError("DUPLICATE_PHONE", "这个手机号已经存在，请返回会员列表搜索");

    const counterReference = transaction.collection("counters").doc("memberNo");
    const counter = await getOrNull(counterReference);
    const nextNumber = Number((counter && counter.value) || 0) + 1;
    await counterReference.set({ data: { value: nextNumber, updatedAt: now } });

    const member = { memberNo: String(nextNumber).padStart(4, "0"), name, phone, level, balanceFen: 0, points: 0, remark, status: "active", version: 1, createdBy: openid, createdAt: now, updatedAt: now };
    await transaction.collection("members").doc(memberId).set({ data: member });
    await phoneReference.set({ data: { memberId, createdAt: now } });
    await transaction.collection("operation_logs").doc(randomId("log")).set({ data: { operatorOpenId: openid, operatorName: employee.name, action: "member.create", targetType: "member", targetId: memberId, summary: { memberNo: member.memberNo }, createdAt: now } });
    return { _id: memberId, ...member };
  });
}

async function createTransaction(event) {
  const { openid, employee } = requireEmployee();
  const memberId = assertString(event.memberId, "会员编号", 80);
  const requestId = assertString(event.requestId, "请求编号", 100);
  if (!/^[a-zA-Z0-9_-]+$/.test(requestId)) throw new ServiceError("INVALID_INPUT", "请求编号格式不正确");
  const type = event.type === "recharge" ? "recharge" : event.type === "consume" ? "consume" : "";
  if (!type) throw new ServiceError("INVALID_INPUT", "交易类型不正确");
  const actualFen = assertFen(event.amountFen, type === "recharge" ? "充值" : "消费");
  const giftFen = type === "recharge" ? assertFen(event.giftFen || 0, "赠送", true) : 0;
  const title = type === "recharge" ? "会员充值" : assertString(event.service, "服务项目", 30);
  const method = type === "recharge" ? assertString(event.method, "收款方式", 20) : "余额支付";
  const remark = String(event.remark || "").trim().slice(0, 100);
  const now = new Date();

  return db.runTransaction(async (transaction) => {
    const transactionReference = transaction.collection("transactions").doc(requestId);
    const existing = await getOrNull(transactionReference);
    if (existing && existing.resultMemberSnapshot) return existing.resultMemberSnapshot;

    const memberReference = transaction.collection("members").doc(memberId);
    const member = await getOrNull(memberReference);
    if (!member || member.status !== "active") throw new ServiceError("NOT_FOUND", "会员不存在或已停用");
    const deltaFen = type === "recharge" ? actualFen + giftFen : -actualFen;
    const balanceAfterFen = Number(member.balanceFen || 0) + deltaFen;
    if (balanceAfterFen < 0) throw new ServiceError("INSUFFICIENT_BALANCE", "余额不足，请核对扣款金额或先登记充值");

    const updatedMember = { ...member, _id: memberId, balanceFen: balanceAfterFen, version: Number(member.version || 0) + 1, updatedAt: now };
    await memberReference.update({ data: { balanceFen: balanceAfterFen, version: _.inc(1), updatedAt: now } });
    await transactionReference.set({ data: { memberId, type, title, amountFen: deltaFen, actualFen, giftFen, balanceBeforeFen: Number(member.balanceFen || 0), balanceAfterFen, pointsDelta: 0, pointsBefore: Number(member.points || 0), pointsAfter: Number(member.points || 0), paymentMethod: method, remark, operatorOpenId: openid, operatorName: employee.name, createdAt: now, resultMemberSnapshot: updatedMember } });
    await transaction.collection("operation_logs").doc(randomId("log")).set({ data: { operatorOpenId: openid, operatorName: employee.name, action: `transaction.${type}`, targetType: "member", targetId: memberId, summary: { requestId, deltaFen }, createdAt: now } });
    return updatedMember;
  });
}

const handlers = { initialize, initializeCollection, listMembers, getMember, getSummary, createMember, createTransaction };

exports.main = async (event = {}) => {
  if (event.action === "login") {
    try { return { success: true, data: await login() }; }
    catch (error) {
      console.error("TC login initialization error", { message: error.message, stack: error.stack });
      return { success: false, code: "INITIALIZE_FAILED", message: "数据库初始化失败，请稍后重试" };
    }
  }
  try {
    const handler = handlers[event.action];
    if (!handler) throw new ServiceError("UNKNOWN_ACTION", "未知操作");
    return { success: true, data: await handler(event) };
  } catch (error) {
    console.error("TC service error", { action: event.action, code: error.code, message: error.message, stack: error.stack });
    const known = error instanceof ServiceError;
    return { success: false, code: known ? error.code : "INTERNAL_ERROR", message: known ? error.message : "服务暂时不可用，请稍后重试" };
  }
};
