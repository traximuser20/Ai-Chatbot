/**
 * Compiles every single file component the way the bundler does.
 *
 * `tsc` reads the TypeScript of a component but not its template, and a
 * template that does not compile is not an error anywhere - the component
 * simply renders nothing. This script catches that before the change reaches
 * the device.
 *
 *     node tools/check-components.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const components = join(root, 'src', 'components');

let broken = 0;

for (const file of readdirSync(components).filter((name) => name.endsWith('.vue'))) {
  const path = join(components, file);
  const source = readFileSync(path, 'utf8');
  const { descriptor, errors } = parse(source, { filename: file });

  if (errors.length) {
    console.log(`${file}  PARSE`, errors.map((error) => error.message));
    broken += 1;
    continue;
  }

  try {
    compileScript(descriptor, { id: file });
  } catch (error) {
    console.log(`${file}  SCRIPT`, error.message);
    broken += 1;
    continue;
  }

  const result = compileTemplate({
    source: descriptor.template.content,
    filename: file,
    id: file,
  });

  if (result.errors.length) {
    console.log(`${file}  TEMPLATE`, result.errors.map((error) => error.message || error));
    broken += 1;
    continue;
  }

  console.log(`${file}  ok`);
}

if (broken) {
  console.error(`\n${broken} component(s) do not compile.`);
  process.exit(1);
}

console.log('\nEvery component compiles.');
