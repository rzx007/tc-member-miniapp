const cloud = require("wx-server-sdk");
const { employees } = require("./config");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async () => {
  const { OPENID } = cloud.getWXContext();
  const employee = employees.find((item) => item.openid === OPENID);
  console.log("TC auth login", { openid: OPENID, authorized: Boolean(employee) });
  if (!employee) return { authorized: false, role: "visitor" };
  return { authorized: true, name: employee.name, role: employee.role || "operator" };
};
