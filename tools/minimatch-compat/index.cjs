// Older ESLint plugins call the module directly; all matching uses patched minimatch.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const modern = require("minimatch-modern");

const compatible = Object.assign(function minimatch(path, pattern, options) {
  return modern.minimatch(path, pattern, options);
}, modern);

// Existing import rules only use makeRe(...).test(...); keep matching nonrecursive.
compatible.makeRe = (pattern, options) => {
  const matcher = new modern.Minimatch(pattern, options);
  return { test: (path) => matcher.match(path) };
};

module.exports = compatible;
