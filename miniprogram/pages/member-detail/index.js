const store = require("../../utils/data-service");
const auth = require("../../utils/auth");

Page({
  data: { memberId: "", member: null, transactions: [], expandedId: "" },
  onLoad(options) { this.setData({ memberId: options.id || "" }); },
  async onShow() { if (await auth.requireEmployee()) this.refresh(); },
  async refresh() {
    if (!this.data.memberId) return;
    const member = await store.getMember(this.data.memberId);
    if (!member) { wx.showToast({ title: "会员不存在", icon: "none" }); return; }
    this.setData({ member, transactions: (member.transactions || []).map(store.formatTransaction) });
  },
  toggleTransaction(event) {
    const id = event.currentTarget.dataset.id;
    this.setData({ expandedId: this.data.expandedId === id ? "" : id });
  },
  goRecharge() { wx.navigateTo({ url: `/pages/transaction/index?type=recharge&id=${this.data.memberId}` }); },
  goConsume() { wx.navigateTo({ url: `/pages/transaction/index?type=consume&id=${this.data.memberId}` }); },
});
