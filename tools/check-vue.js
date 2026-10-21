#!/usr/bin/env node
/**
 * Compiles every single file component of the app.
 *
 * `tsc` does not look at a template, and a template that does not compile
 * fails silently at runtime: the component simply renders nothing. This
 * script compiles the template and the script of every `.vue` file, so a
 * broken template is caught before it reaches the device.
 *
 *     node tools/check-vue.js
 */
const fs = require('fs');
const path = require('path');
const { parse, compileTemplate, compileScript } = require('@vue/compiler-sfc');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

/** Every `.vue` file below a folder. */
function collect(folder) {
  const found = [];
  for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      found.push(...collect(full));
    } else if (entry.name.endsWith('.vue')) {
      found.push(full);
    }
  }
  return found;
}

let failures = 0;

for (const file of collect(SRC)) {
  const source = fs.readFileSync(file, 'utf8');
  const { descriptor, errors } = parse(source, { filename: file });

  if (errors.length) {
    failures += 1;
    console.error(`✗ ${path.relative(ROOT, file)}`);
    errors.forEach((error) => console.error(`   ${error.message}`));
    continue;
  }

  try {
    if (descriptor.script || descriptor.scriptSetup) {
      compileScript(descriptor, { id: 'check' });
    }
  } catch (error) {
    failures += 1;
    console.error(`✗ ${path.relative(ROOT, file)} (script)`);
    console.error(`   ${error.message}`);
    continue;
  }

  if (descriptor.template) {
    const result = compileTemplate({
      source: descriptor.template.content,
      filename: file,
      id: 'check',
    });
    if (result.errors.length) {
      failures += 1;
      console.error(`✗ ${path.relative(ROOT, file)} (template)`);
      result.errors.forEach((error) => console.error(`   ${error.message || error}`));
      continue;
    }
  }

  console.log(`✓ ${path.relative(ROOT, file)}`);
}

if (failures) {
  console.error(`\n${failures} component(s) did not compile.`);
  process.exit(1);
}

console.log('\nEvery component compiles.');
