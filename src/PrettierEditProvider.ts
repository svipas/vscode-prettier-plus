import * as childProcess from "child_process";
import * as prettier from "prettier";
import { promisify } from "util";
import * as vscode from "vscode";
import { logMessage, safeExecution, setUsedModule } from "./errorHandler";
import {
	eslintLanguageIds,
	prettierEslintFormat,
	prettierStylelintFormat,
	prettierTslintFormat,
	stylelintLanguageIds,
	tslintLanguageIds,
} from "./integration";
import {
	getParserByLangIdAndFilename,
	VSCodePluginLanguageIds,
} from "./parser";
import { getVSCodeConfig } from "./utils";

export class PrettierEditProvider
	implements vscode.DocumentFormattingEditProvider {
	private _cachedGlobalNodeModulesPaths?: (string | undefined)[];
	private readonly _fileIsIgnored: (filePath: string) => Promise<boolean>;

	constructor(fileIsIgnored: (filePath: string) => Promise<boolean>) {
		this._fileIsIgnored = fileIsIgnored;
	}

	provideDocumentFormattingEdits(
		document: vscode.TextDocument
	): Promise<vscode.TextEdit[]> {
		return this._provideEdits(document);
	}

	/**
	 * Format the given text with user's configuration.
	 * @param text text to format.
	 * @param path formatting file's path.
	 * @returns formatted text.
	 */
	private async _format(
		text: string,
		{ fileName, languageId, uri, isUntitled }: vscode.TextDocument
	): Promise<string> {
		const vscodeConfig: prettier.PrettierVSCodeConfig = getVSCodeConfig(uri);
		const workspaceFolderPaths: string[] = [];

		// This has to stay, as it allows to skip in sub workspaceFolders. Sadly noop.
		// wf1  (with "lang") -> glob: "wf1/**"
		// wf1/wf2  (without "lang") -> match "wf1/**"
		if (vscodeConfig.disableLanguages.includes(languageId)) {
			return text;
		}

		if (VSCodePluginLanguageIds.includes(languageId)) {
			vscode.workspace.workspaceFolders?.forEach((wf) => {
				workspaceFolderPaths.push(wf.uri.fsPath);
			});

			if (!this._cachedGlobalNodeModulesPaths) {
				this._cachedGlobalNodeModulesPaths = await this._globalNodeModulesPaths();
			}
			this._cachedGlobalNodeModulesPaths.forEach((globalPath) => {
				globalPath && workspaceFolderPaths.push(globalPath);
			});
		}

		let parser: prettier.AllParsers = vscodeConfig.parser;
		if (parser === "") {
			parser = getParserByLangIdAndFilename(
				languageId,
				isUntitled ? undefined : fileName
			);
		}

		let configOptions: prettier.PrettierConfig | undefined;
		let hasConfig = false;
		if (vscodeConfig.requireConfig) {
			const { config, error } = await this._resolvePrettierConfig(fileName, {
				editorconfig: true,
			});
			if (error != null) {
				logMessage(
					`Failed to resolve config for ${fileName}. Falling back to the default settings.`
				);
			} else if (config == null) {
				logMessage(
					`Prettier config is empty. Falling back to the default settings.`
				);
			} else {
				configOptions = config;
				hasConfig = true;
			}
		}

		const prettierOptions = this._mergeConfig(hasConfig, configOptions || {}, {
			printWidth: vscodeConfig.printWidth,
			tabWidth: vscodeConfig.tabWidth,
			singleQuote: vscodeConfig.singleQuote,
			trailingComma: vscodeConfig.trailingComma,
			bracketSpacing: vscodeConfig.bracketSpacing,
			jsxBracketSameLine: vscodeConfig.jsxBracketSameLine,
			semi: vscodeConfig.semi,
			useTabs: vscodeConfig.useTabs,
			proseWrap: vscodeConfig.proseWrap,
			arrowParens: vscodeConfig.arrowParens,
			jsxSingleQuote: vscodeConfig.jsxSingleQuote,
			htmlWhitespaceSensitivity: vscodeConfig.htmlWhitespaceSensitivity,
			vueIndentScriptAndStyle: vscodeConfig.vueIndentScriptAndStyle,
			endOfLine: vscodeConfig.endOfLine,
			quoteProps: vscodeConfig.quoteProps,
			filepath: fileName,
			pluginSearchDirs: workspaceFolderPaths,
			parser,
		});

		const sendToOutput = (name: string, version: string) => {
			logMessage(
				`Using ${name}@${version}${
					hasConfig ? " with Prettier config" : ""
				} to format code with ${parser} parser for ${languageId} language.`,
				fileName
			);
			setUsedModule(name, version);
		};

		if (
			vscodeConfig.tslintIntegration &&
			tslintLanguageIds.includes(languageId)
		) {
			return safeExecution(
				() => {
					sendToOutput("prettier-tslint", "0.4.2");
					return prettierTslintFormat()({
						text,
						filePath: fileName,
						fallbackPrettierOptions: prettierOptions,
					});
				},
				text,
				fileName
			);
		}

		if (
			vscodeConfig.eslintIntegration &&
			eslintLanguageIds.includes(languageId)
		) {
			return safeExecution(
				() => {
					sendToOutput("prettier-eslint", "11.0.0");
					return prettierEslintFormat()({
						text,
						filePath: fileName,
						fallbackPrettierOptions: prettierOptions,
					});
				},
				text,
				fileName
			);
		}

		if (
			vscodeConfig.stylelintIntegration &&
			stylelintLanguageIds.includes(languageId)
		) {
			sendToOutput("prettier-stylelint", "0.4.2");
			return safeExecution(
				prettierStylelintFormat()({
					text,
					filePath: fileName,
					prettierOptions,
				}),
				text,
				fileName
			);
		}

		return safeExecution(
			() => {
				sendToOutput("prettier", prettier.version);
				return prettier.format(text, prettierOptions);
			},
			text,
			fileName
		);
	}

	private async _globalNodeModulesPaths(): Promise<(string | undefined)[]> {
		const promisifiedExec = promisify(childProcess.exec);
		const executeCommand = async (cmd: string): Promise<string | undefined> => {
			try {
				let nodeModulesPath = (await promisifiedExec(cmd)).stdout.trim();
				if (nodeModulesPath.endsWith("node_modules")) {
					nodeModulesPath = nodeModulesPath.replace("node_modules", "");
				}
				return nodeModulesPath;
			} catch {}
		};

		return Promise.all([
			executeCommand("yarn global dir"),
			executeCommand("npm -g root"),
		]);
	}

	/**
	 * Resolves the prettier config for the given file.
	 * @param filePath file's path.
	 */
	private async _resolvePrettierConfig(
		filePath: string,
		options?: { editorconfig?: boolean }
	): Promise<{ config?: prettier.PrettierConfig; error: Error | null }> {
		try {
			const config = await prettier.resolveConfig(filePath, options);
			return { config, error: null };
		} catch (error) {
			return { error };
		}
	}

	/**
	 * Define which config should be used.
	 * @param hasPrettierConfig a prettier config exists.
	 * @param prettierConfig config from prettier's config file.
	 * @param vscodeConfig vscode config.
	 */
	private _mergeConfig(
		hasPrettierConfig: boolean,
		prettierConfig: Partial<prettier.PrettierConfig>,
		vscodeConfig: Partial<prettier.PrettierConfig>
	) {
		if (hasPrettierConfig) {
			// Always merge our inferred parser in.
			return { parser: vscodeConfig.parser, ...prettierConfig };
		}
		return { ...vscodeConfig, ...prettierConfig };
	}

	private _fullDocumentRange(document: vscode.TextDocument): vscode.Range {
		const lastLineId = document.lineCount - 1;
		return new vscode.Range(
			0,
			0,
			lastLineId,
			document.lineAt(lastLineId).text.length
		);
	}

	private async _provideEdits(
		document: vscode.TextDocument
	): Promise<vscode.TextEdit[]> {
		if (
			!document.isUntitled &&
			(await this._fileIsIgnored(document.fileName))
		) {
			return [];
		}

		const formattedText = await this._format(document.getText(), document);
		return [
			vscode.TextEdit.replace(this._fullDocumentRange(document), formattedText),
		];
	}
}
