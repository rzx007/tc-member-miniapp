const auth = require("../../utils/auth");

Page({
  data: { loading: true, authorized: false },

  onShow() {
    this.resolveIdentity();
  },

  async resolveIdentity() {
    try {
      const user = await auth.login();
      this.setData({ loading: false, authorized: Boolean(user.authorized) });
    } catch (error) {
      console.error("登录失败", error);
      this.setData({ loading: false, authorized: false });
    }
  },

  enterMembers() {
    if (!this.data.authorized) return;
    wx.navigateTo({ url: "/pages/members/index" });
  },
});
