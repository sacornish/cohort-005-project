// Mechanical checks for rules in CODING_STANDARDS.md.

const unwrap = (node) => {
  let current = node;
  while (current) {
    if (
      current.type === "TSAsExpression" ||
      current.type === "TSNonNullExpression" ||
      current.type === "ChainExpression"
    ) {
      current = current.expression;
    } else if (current.type === "LogicalExpression") {
      current = current.left;
    } else {
      return current;
    }
  }
  return current;
};

const nameOf = (node) => {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && !node.computed) {
    return node.property.name;
  }
  return null;
};

// `params.x`, `formData.get(...)`, `searchParams.get(...)`, `url.searchParams.get(...)`.
const isUntrustedInput = (node) => {
  const arg = unwrap(node);
  if (!arg) return false;
  if (arg.type === "MemberExpression") return nameOf(arg.object) === "params";
  if (arg.type !== "CallExpression") return false;
  const callee = unwrap(arg.callee);
  if (callee?.type !== "MemberExpression" || nameOf(callee) !== "get") {
    return false;
  }
  return /^(formData|searchParams)$/.test(nameOf(callee.object) ?? "");
};

const noNumberOfInput = {
  meta: {
    type: "problem",
    messages: {
      number:
        'Parse untrusted input with a zod schema (z.coerce.number()), not Number(): Number("") is 0. See CODING_STANDARDS.md, "Parse untrusted input with a schema, at the edge".',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        if (callee.type !== "Identifier") return;
        if (!["Number", "parseInt", "parseFloat"].includes(callee.name)) return;
        if (!isUntrustedInput(node.arguments[0])) return;
        context.report({ node, messageId: "number" });
      },
    };
  },
};

const isDate = (node) => node.type === "Identifier" && node.name === "Date";

const noAmbientClock = {
  meta: {
    type: "problem",
    messages: {
      clock:
        'Take the time as an argument (`now: Date`) instead of reading the clock here. See CODING_STANDARDS.md, "Inject the clock".',
    },
  },
  create(context) {
    return {
      NewExpression(node) {
        if (isDate(node.callee) && node.arguments.length === 0) {
          context.report({ node, messageId: "clock" });
        }
      },
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === "MemberExpression" &&
          !callee.computed &&
          isDate(callee.object) &&
          callee.property.name === "now"
        ) {
          context.report({ node, messageId: "clock" });
        }
      },
    };
  },
};

export default {
  meta: { name: "standards" },
  rules: {
    "no-number-of-input": noNumberOfInput,
    "no-ambient-clock": noAmbientClock,
  },
};
