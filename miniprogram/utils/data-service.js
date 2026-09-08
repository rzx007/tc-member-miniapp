const config = require("../config");
const mock = require("./mock-store");

async function call(action, data = {}) {
  const { result } = await wx.cloud.callFunction({ name: "tcService", data: { action, ...data } });
  if (!result || result.success === false) {
    throw new Error((result && result.message) || "服务暂时不可用，请稍后重试");
  }
  return result.data;
}

const cloud = {
  async listMembers(options) {
    const members = await call("listMembers", options);
    return members.map(mock.decorateMember);
  },
  async getMember(id) {
    const data = await call("getMember", { id });
    return data ? mock.decorateMember({ ...data.member, transactions: data.transactions }) : null;
  },
  async getSummary() {
    const data = await call("getSummary");
    return { memberCount: data.memberCount, balanceText: mock.money(data.balanceFen), consumedText: mock.money(data.consumedFen) };
  },
  async addMember(data) {
    return mock.decorateMember(await call("createMember", data));
  },
  async addTransaction(data) {
    const requestId = data.requestId || `tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    return mock.decorateMember(await call("createTransaction", { ...data, requestId }));
  },
};

const local = {
  listMembers: async (options) => mock.listMembers(options),
  getMember: async (id) => mock.getMember(id),
  getSummary: async () => mock.getSummary(),
  addMember: async (data) => mock.addMember(data),
  addTransaction: async (data) => mock.addTransaction(data),
};

const source = config.useCloudData ? cloud : local;

module.exports = {
  ...source,
  formatTransaction: mock.formatTransaction,
  money: mock.money,
};
