// See https://github.com/sveltejs/rollup-plugin-svelte 
// and https://dev.to/ardc_overflow/setting-up-svelte-and-tailwind-with-minimal-extra-dependencies-1g5a
// and https://github.com/toerndev/svelte-ts-eslint-tailwind/blob/master/rollup.config.js
// for examples of using tailwind, rollup, svelte together
import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import css from 'rollup-plugin-css-only';
import commonjs from '@rollup/plugin-commonjs';
import {terser} from 'rollup-plugin-terser';
import pkg from './package.json';
import sveltePreprocess from "svelte-preprocess";
import replace from '@rollup/plugin-replace';

const fs = require('fs'), path = require('path');
const production = !process.env.ROLLUP_WATCH;


// pkg is the package.json structure, so pkg.name is the name 
// property in that file, same with pkg.main
const name = pkg.name
	.replace(/^(@\S+\/)?(svelte-)?(\S+)/, '$3')
	.replace(/^\w/, m => m.toUpperCase())
	.replace(/-\w/g, m => m[1].toUpperCase());

export default {
	input: 'src/index.js',
	output: [
		{ file: pkg.module, 
      format: 'es' },
    { file: pkg.main, 
      format: 'umd', 
      name: 'PageSupportBot' },
    { file: pkg.main.replace('.js','.min.js'), 
      format: 'iife', 
      name: 'PageSupportBot', 
      plugins: [terser()]
    }
	],
	plugins: [
		svelte({
      // See https://svelte.dev/docs#svelte_compile for all compiler options
			compilerOptions: {
        // enable run-time checks when not in production
				dev: !production
      },
  
      // 
      preprocess: sveltePreprocess({ 
        sourceMap: !production,
				postcss: true,
      }),

    }),  // ------ END svelte section ---------//

    // we'll extract any component CSS out into
		// a separate file - better for performance
		css({ output: 'page-support-bot-bundle.css' }),

    // If you have external dependencies installed from
    // npm, you'll most likely need these plugins. In
    // some cases you'll need additional configuration -
    // consult the documentation for details:
    // https://github.com/rollup/plugins/tree/master/packages/commonjs
    // preferBuiltins:false is to prevent error
    // `Plugin node-resolve: preferring built-in module 'assert' over local alternative`
    // and a bunch of errors around missing shims.
    resolve({
      browser: true,
      dedupe: ['svelte'],
      preferBuiltins: false
    }),
    
    commonjs({
      // needed for the 'require' of const Parser = require('expr-eval').Parser;
      // in BotConfig.js: browser console will error 'require not defined' without it
      // See https://www.npmjs.com/package/@rollup/plugin-commonjs#transformmixedesmodules
      transformMixedEsModules: true  
    }),

    replace({
      __botConfigVersion__: readPackageVersion(),
      preventAssignment: true
    }),

    // NOTE: no serve or livereload options here because Bot is 
    // only a component - embed in storybook or rails or publisher
    // to run it using ES6 module or iife by running
    // "npm run build" to generate the needed files.
	]
};



/* Read the package.json file and return its version number as a String */
function readPackageVersion() {
  const pkgJSON = fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgJSON);
  return pkg.version;
}
