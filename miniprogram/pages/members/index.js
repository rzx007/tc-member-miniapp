const store = require("../../utils/data-service");
const auth = require("../../utils/auth");

Page({
  data: {
    query: "",
    levels: ["全部会员", "金卡", "银卡", "普通会员"],
    levelIndex: 0,
    members: [],
    summary: { memberCount: 0, balanceText: "0.00", consumedText: "0.00" },
    currentUserName: "员工",
    currentUserRoleText: "员工",
  },

  async onShow() {
    if (!await auth.requireEmployee()) return;
    const user = getApp().globalData.user || {};
    this.setData({
      currentUserName: user.name || "员工",
      currentUserRoleText: user.role === "super_admin" ? "超级管理员" : "员工",
    });
    this.refresh();
  },
  async onPullDownRefresh() { if (await auth.requireEmployee()) this.refresh(); wx.stopPullDownRefresh(); },

  async refresh() {
    const level = this.data.levels[this.data.levelIndex];
    try {
      const [members, summary] = await Promise.all([store.listMembers({ query: this.data.query, level }), store.getSummary()]);
      this.setData({ members, summary });
    } catch (error) { wx.showToast({ title: error.message, icon: "none" }); }
  },

  onSearchInput(event) { this.setData({ query: event.detail.value }); clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.refresh(), 250); },
  clearSearch() { this.setData({ query: "" }); this.refresh(); },
  onLevelChange(event) { this.setData({ levelIndex: Number(event.detail.value) }); this.refresh(); },
  openMember(event) { wx.navigateTo({ url: `/pages/member-detail/index?id=${event.currentTarget.dataset.id}` }); },
  addMember() { wx.navigateTo({ url: "/pages/member-form/index" }); },
  onUnload() { clearTimeout(this.searchTimer); },
});
