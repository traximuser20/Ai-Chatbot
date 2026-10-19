const webpack = require("@nativescript/webpack");
const webpackCore = require("webpack");
const path = require("path");

module.exports = (env) => {
	webpack.init(env);

	const config = webpack.resolveConfig();

	// Resolve Node.js core modules that may be pulled in by dependencies but
	// are not available in the NativeScript mobile environment.
	// NOTE: spread the existing fallback so we do not drop the entries that
	// @nativescript/webpack already configured (e.g. the 'module' polyfill).
	config.resolve.fallback = {
		...(config.resolve.fallback || {}),
		"tty": false,
		"util": false,
		"os": false,
		"zlib": false,
		"stream": false,
		"net": false,
		"tls": false,
		"crypto": false,
		"http": false,
		"https": false,
		"fs": false,
		"child_process": false,
		"url": false,
		"buffer": false,
	};

	// Ensure 'process' is available globally
	config.plugins.push(
		new webpackCore.ProvidePlugin({
			process: [path.resolve(__dirname, 'src/process-shim'), 'default'],
		})
	);

	return config;
};
