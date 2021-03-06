declare module "prettier" {
	type ParserOption =
		| ""
		| "babel"
		| "babel-flow"
		| "babel-ts"
		| "flow"
		| "typescript"
		| "css"
		| "scss"
		| "less"
		| "json"
		| "json5"
		| "json-stringify"
		| "graphql"
		| "markdown"
		| "mdx"
		| "html"
		| "vue"
		| "angular"
		| "lwc"
		| "yaml";

	type PluginParserOption = "php" | "pug" | "ruby" | "swift" | "xml";

	type AllParsers = ParserOption | PluginParserOption;

	interface PrettierConfig {
		printWidth: number;
		tabWidth: number;
		singleQuote: boolean;
		trailingComma: "es5" | "none" | "all";
		bracketSpacing: boolean;
		jsxBracketSameLine: boolean;
		parser: AllParsers;
		semi: boolean;
		useTabs: boolean;
		proseWrap: "preserve" | "always" | "never";
		arrowParens: "always" | "avoid";
		filepath: string;
		jsxSingleQuote: boolean;
		htmlWhitespaceSensitivity: "css" | "strict" | "ignore";
		vueIndentScriptAndStyle: boolean;
		endOfLine: "lf" | "crlf" | "cr" | "auto";
		quoteProps: "as-needed" | "consistent" | "preserve";
		pluginSearchDirs: string[];
		plugins: string[];
	}

	interface PrettierSupportInfo {
		languages: {
			name: string;
			since: string;
			parsers: ParserOption[];
			tmScope: string;
			aceMode: string;
			codemirrorMode: string;
			codemirrorMimeType: string;
			extensions: string[];
			linguistLanguageId: number;
			filenames?: string[];
			aliases?: string[];
			group?: string;
			vscodeLanguageIds?: string[]; // Since prettier v1.14.0
		}[];
	}

	function format(text: string, options?: Partial<PrettierConfig>): string;

	function resolveConfig(
		filePath: string,
		options?: {
			/**
			 * Use cache, defaults to true.
			 */
			useCache?: boolean;
			/**
			 * Read `.editorconfig`, defaults to false.
			 */
			editorconfig?: boolean;
		}
	): Promise<PrettierConfig>;

	function clearConfigCache(): void;

	function getSupportInfo(): PrettierSupportInfo;

	const version: string;

	/**
	 * Extension specific configuration
	 */
	interface ExtensionConfig {
		/**
		 * Use `prettier-eslint` to format JavaScript, TypeScript and Vue.
		 */
		eslintIntegration: boolean;
		/**
		 * Use `prettier-tslint` to format TypeScript.
		 */
		tslintIntegration: boolean;
		/**
		 * Use `prettier-stylelint` to format CSS, SCSS and Less.
		 */
		stylelintIntegration: boolean;
		/**
		 * Path to a `.prettierignore` or similar file such as `.gitignore`.
		 */
		ignorePath: string;
		/**
		 * Require a config to format code.
		 */
		requireConfig: boolean;
		/**
		 * List of languages IDs to ignore.
		 */
		disableLanguages: string[];
	}

	type PrettierVSCodeConfig = ExtensionConfig & PrettierConfig;
}
