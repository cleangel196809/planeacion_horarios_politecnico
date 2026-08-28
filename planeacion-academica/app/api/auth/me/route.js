const { getCurrentUser } = require("@/lib/session");
const { ok } = require("@/lib/apiHelpers");

async function GET() {
  const user = getCurrentUser();
  return ok({ user });
}

module.exports = { GET };
