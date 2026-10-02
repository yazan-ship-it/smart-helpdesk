// Run a TypeScript file with plain Node: transpile .ts files on require().
// Usage: node scripts/run-ts.js <file.ts>   (relative imports only, no "@/" aliases)
const ts = require('typescript');
const fs = require('fs');
const path = require('path');

require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  module._compile(outputText, filename);
};

if (require.main === module) {
  const file = process.argv[2];
  if (!file) {
    console.error('Usage: node scripts/run-ts.js <file.ts>');
    process.exit(1);
  }
  require(path.resolve(file));
}
