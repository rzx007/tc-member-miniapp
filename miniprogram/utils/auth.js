function login() {
  const app = getApp();

  if (app.globalData.useMockAuth) {
    const authorized = app.globalData.mockRole === "employee";
    const user = authorized
      ? { authorized: true, role: "operator", name: "小林", source: "mock" }
      : { authorized: false, role: "visitor", source: "mock" };
    app.globalData.user = user;
    return Promise.resolve(user);
  }

  return wx.cloud.callFunction({ name: "tcService", data: { action: "login" } }).then(({ result }) => {
    if (!result || result.success === false) throw new Error((result && result.message) || "身份验证失败");
    const user = result.data || { authorized: false, role: "visitor" };
    app.globalData.user = user;
    return user;
  });
}

async function requireEmployee() {
  const app = getApp();
  const user = app.globalData.user || await login();
  if (user.authorized) return true;
  wx.reLaunch({ url: "/pages/index/index" });
  return false;
}

module.exports = { login, requireEmployee };
