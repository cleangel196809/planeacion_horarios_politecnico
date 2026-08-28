const { cookies } = require("next/headers");
const { COOKIE_NAME } = require("@/lib/auth");
const { ok } = require("@/lib/apiHelpers");

async function POST() {
  cookies().set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return ok({ success: true });
}

module.exports = { POST };
