const example = require("./config.example");

let local = {};
try {
  local = require("./config.private");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
}

const employees = Array.isArray(local.employees) ? local.employees : example.employees;
if (employees.length > 5) throw new Error("tcService employee allowlist cannot exceed 5 entries");

module.exports = { employees };
