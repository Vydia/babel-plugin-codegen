"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getFilename = void 0;
exports.getReplacement = getReplacement;
exports.isCodegenComment = isCodegenComment;
exports.isPropertyCall = isPropertyCall;
exports.looksLike = looksLike;
exports.replace = replace;
exports.requireFromString = requireFromString;
exports.resolveModuleContents = resolveModuleContents;

var _path = _interopRequireDefault(require("path"));

var _fs = _interopRequireDefault(require("fs"));

var _requireFromString = _interopRequireDefault(require("require-from-string"));

// istanbul ignore next because I don't know how to reproduce a situation
// where the filename doesn't exist, but TypeScript gets mad when I don't handle that case.
const getFilename = fileOpts => {
  var _fileOpts$filename;

  return (_fileOpts$filename = fileOpts.filename) != null ? _fileOpts$filename : '"unknown"';
};

exports.getFilename = getFilename;

function requireFromString(code, filename) {
  // Execute the transformed code, as if it were required
  const module = (0, _requireFromString.default)(String(code), filename);

  if (typeof module === 'string' || typeof module === 'function') {
    return module;
  } else {
    // Allow for es modules (default export)
    return module.__esModule ? module.default : module;
  }
}

function getReplacement({
  code,
  fileOpts,
  args = []
}, babel) {
  const filename = getFilename(fileOpts);
  let module = requireFromString(code, filename); // If a function is exported, call it with args

  if (typeof module === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    module = module(...args, babel);
  } else if (args.length) {
    throw new Error(`codegen module (${_path.default.relative(process.cwd(), filename)}) cannot accept arguments because it does not export a function (it exports a ${typeof module}). You passed the arguments: ${args.join(', ')}`);
  } // Convert whatever we got now (hopefully a string) into AST form


  if (typeof module !== 'string') {
    throw new Error('codegen: Must module.exports a string.');
  }

  return babel.template(module, {
    preserveComments: true,
    placeholderPattern: false,
    ...fileOpts.parserOpts,
    sourceType: 'module'
  })();
}

function applyReplacementToPath(replacement, path) {
  if (replacement) {
    // If it's not an array, wrap into an array
    // to support single import/export declarations:
    // https://github.com/kentcdodds/babel-plugin-codegen/issues/30
    path.replaceWithMultiple(Array.isArray(replacement) ? replacement : [replacement]);
  } else {
    path.remove();
  }
}

function replace({
  path,
  code,
  fileOpts,
  args
}, babel) {
  const replacement = getReplacement({
    code,
    args,
    fileOpts
  }, babel);
  applyReplacementToPath(replacement, path);
}

function resolveModuleContents({
  filename,
  module
}) {
  const resolvedPath = _path.default.resolve(_path.default.dirname(filename), module);

  const code = _fs.default.readFileSync(require.resolve(resolvedPath));

  return {
    code,
    resolvedPath
  };
}

function isCodegenComment(comment) {
  const normalisedComment = comment.value.trim().split(' ')[0].trim();
  return normalisedComment.startsWith('codegen') || normalisedComment.startsWith('@codegen');
}

function isPropertyCall(path, name) {
  return looksLike(path, {
    node: {
      type: 'CallExpression',
      callee: {
        property: {
          name
        }
      }
    }
  });
} // really difficult (impossible?) to make this work with explicit types
// but if I could, I would make it this:
// type LooksLikeTarget = Primitive | Function | {[key: string]: LooksLikeTarget}


function looksLike(a, b) {
  if (isPrimitive(b)) return a === b;
  if (typeof b === 'function') return b(a); // istanbul ignore next because we don't have this use case
  // but if anyone copy/pastes this handy utility, they might need it!

  if (isPrimitive(a) || typeof a === 'function') return false;
  return Object.keys(b).every(bKey => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    return looksLike(a[bKey], b[bKey]);
  });
}

function isPrimitive(val) {
  // eslint-disable-next-line
  return val == null || /^[sbn]/.test(typeof val);
}
/*
eslint
  @typescript-eslint/no-explicit-any: "off",
  complexity: ["error", 8],
  import/no-unassigned-import: "off",
  import/no-dynamic-require: "off",
*/