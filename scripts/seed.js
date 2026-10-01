const ts = require('typescript');
const fs = require('fs');
const path = require('path');

const seedTsPath = path.join(__dirname, '../prisma/seed.ts');
const tsCode = fs.readFileSync(seedTsPath, 'utf8');

const jsCode = ts.transpileModule(tsCode, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    esModuleInterop: true,
  },
}).outputText;

// Execute the transpiled CommonJS module
const Module = module.constructor;
const m = new Module(seedTsPath, module);
m.filename = seedTsPath;
m.paths = Module._nodeModulePaths(path.dirname(seedTsPath));
m._compile(jsCode, seedTsPath);
