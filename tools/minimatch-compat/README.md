# ESLint minimatch compatibility

Legacy ESLint dependencies require minimatch as a callable CommonJS export.
The fixed upstream version exposes a named `minimatch` function instead.
This adapter preserves the callable export and forwards matching, constructors,
and helpers to the real upstream minimatch 11.0.1 via an npm alias.
It contains no copy of the old matching implementation.

The removed `makeRe()` API is supported only as the `.test(path)` matcher used
by existing import rules. It delegates to the nonrecursive upstream matcher,
not a generated regular expression. RegExp source/exec APIs are not supported.

The root override installs a checked-in npm tarball to avoid relative symlink
resolution problems in nested dependencies. ESM named exports remain available.
Regenerate it with `npm pack ./tools/minimatch-compat --pack-destination tools`
after changing the adapter. The root override targets legacy and modern imports.
Both must remain covered by `npm audit` and `npm run test:glob-compat`.
Remove this adapter once ESLint and its plugins support the fixed upstream API.
