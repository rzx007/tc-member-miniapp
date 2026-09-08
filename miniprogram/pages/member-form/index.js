const store = require("../../utils/data-service");
const auth = require("../../utils/auth");

Page({
  data: { name: "", phone: "", levels: ["普通会员", "银卡", "金卡"], levelIndex: 0, remark: "", showOptional: false, error: "", saving: false },
  async onLoad() { await auth.requireEmployee(); },
  onNameInput(event) { this.setData({ name: event.detail.value, error: "" }); },
  onPhoneInput(event) { this.setData({ phone: event.detail.value, error: "" }); },
  onLevelChange(event) { this.setData({ levelIndex: Number(event.detail.value) }); },
  onRemarkInput(event) { this.setData({ remark: event.detail.value }); },
  toggleOptional() { this.setData({ showOptional: !this.data.showOptional }); },
  async save() {
    if (this.data.saving) return;
    const name = this.data.name.trim();
    const phone = this.data.phone.trim();
    if (!name) { this.setData({ error: "请填写会员姓名" }); return; }
    if (!/^1[3-9]\d{9}$/.test(phone)) { this.setData({ error: "请填写正确的 11 位手机号" }); return; }
    try {
      this.setData({ saving: true });
      const member = await store.addMember({ name, phone, level: this.data.levels[this.data.levelIndex], remark: this.data.remark.trim() });
      wx.redirectTo({ url: `/pages/member-detail/index?id=${member.id}` });
    } catch (error) { this.setData({ error: error.message, saving: false }); }
  },
});
