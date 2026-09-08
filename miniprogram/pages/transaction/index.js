const store = require("../../utils/data-service");
const auth = require("../../utils/auth");
const config = require("../../config");

function parseFen(value, optional = false) {
  const input = String(value || "").trim();
  if (!input && optional) return 0;
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(input)) return null;
  const parts = input.split(".");
  return Number(parts[0]) * 100 + Number((parts[1] || "").padEnd(2, "0"));
}

Page({
  data: {
    memberId: "", type: "consume", isRecharge: false, member: null, amount: "", gift: "",
    services: ["精致妆面", "日常妆", "宴会妆", "新娘妆", "舞台妆", "跟妆服务", "其他服务"], serviceIndex: 0,
    methods: ["微信", "支付宝", "现金"], methodIndex: 0, remark: "", showOptional: false,
    presets: [], selectedPromotionId: "", hasGift: false, giftText: "0.00",
    afterBalanceText: "0.00", insufficient: false, error: "", showConfirm: false, reviewData: null, submitting: false,
  },
  async onLoad(options) {
    const type = options.type === "recharge" ? "recharge" : "consume";
    const presets = (config.rechargePresets || []).map((item) => ({
      ...item,
      amountYuan: String(item.amountFen / 100),
      giftYuan: String(item.giftFen / 100),
    }));
    this.setData({ memberId: options.id || "", type, isRecharge: type === "recharge", presets });
    wx.setNavigationBarTitle({ title: type === "recharge" ? "充值登记" : "消费登记" });
    if (await auth.requireEmployee()) this.refresh();
  },
  async refresh() {
    const member = await store.getMember(this.data.memberId);
    if (!member) return;
    this.setData({ member }); this.calculate();
  },
  onAmountInput(event) {
    const values = { amount: event.detail.value, error: "" };
    if (this.data.selectedPromotionId) Object.assign(values, { selectedPromotionId: "", gift: "" });
    this.setData(values); this.calculate();
  },
  onGiftInput(event) { this.setData({ gift: event.detail.value, selectedPromotionId: "", error: "" }); this.calculate(); },
  onRemarkInput(event) { this.setData({ remark: event.detail.value }); },
  onServiceChange(event) { this.setData({ serviceIndex: Number(event.detail.value) }); },
  onMethodChange(event) { this.setData({ methodIndex: Number(event.detail.value) }); },
  toggleOptional() { this.setData({ showOptional: !this.data.showOptional }); },
  choosePreset(event) {
    const preset = this.data.presets[Number(event.currentTarget.dataset.index)];
    if (!preset) return;
    this.setData({ amount: preset.amountYuan, gift: preset.giftYuan === "0" ? "" : preset.giftYuan, selectedPromotionId: preset.id, error: "" });
    this.calculate();
  },
  calculate() {
    if (!this.data.member) return;
    const amountFen = parseFen(this.data.amount) || 0;
    const giftFen = this.data.isRecharge ? (parseFen(this.data.gift, true) || 0) : 0;
    const after = this.data.member.balanceFen + (this.data.isRecharge ? amountFen + giftFen : -amountFen);
    this.setData({ afterBalanceText: store.money(Math.abs(after)), insufficient: after < 0, hasGift: giftFen > 0, giftText: store.money(giftFen) });
  },
  review() {
    const amountFen = parseFen(this.data.amount);
    const giftFen = this.data.isRecharge ? parseFen(this.data.gift, true) : 0;
    if (amountFen === null || amountFen <= 0) { this.setData({ error: "请输入大于 0 的金额，最多保留两位小数" }); return; }
    if (giftFen === null) { this.setData({ showOptional: true, error: "请检查赠送金额，最多保留两位小数" }); return; }
    if (!this.data.isRecharge && amountFen > this.data.member.balanceFen) { this.setData({ error: "余额不足，请核对扣款金额或先登记充值" }); return; }
    const changeFen = this.data.isRecharge ? amountFen + giftFen : amountFen;
    this.setData({ showConfirm: true, reviewData: { amountFen, giftFen, actualText: store.money(amountFen), giftText: store.money(giftFen), changeText: store.money(changeFen), afterText: this.data.afterBalanceText } });
  },
  cancelReview() { this.setData({ showConfirm: false }); },
  async confirm() {
    if (this.data.submitting) return;
    const reviewData = this.data.reviewData;
    try {
      this.setData({ submitting: true });
      await store.addTransaction({
        memberId: this.data.memberId, type: this.data.type, amountFen: reviewData.amountFen, giftFen: reviewData.giftFen,
        service: this.data.services[this.data.serviceIndex], method: this.data.methods[this.data.methodIndex], remark: this.data.remark.trim(),
      });
      wx.showToast({ title: "已记账", icon: "success" });
      setTimeout(() => wx.navigateBack(), 450);
    } catch (error) { this.setData({ showConfirm: false, submitting: false, error: error.message }); }
  },
});
