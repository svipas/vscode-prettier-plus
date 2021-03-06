import * as vscode from "vscode";
import { errorHandlerDisposables } from "./errorHandler";
import { ignoreFileHandler } from "./ignoreFileHandler";
import { allVSCodeLanguageIds } from "./parser";
import { prettierConfigFileWatcher } from "./prettierConfigFileWatcher";
import { PrettierEditProvider } from "./PrettierEditProvider";
import { getVSCodeConfig } from "./utils";

let formatterHandler: vscode.Disposable | undefined;

function disposeFormatterHandler() {
	formatterHandler?.dispose();
	formatterHandler = undefined;
}

function formatterSelector(): string[] | vscode.DocumentFilter[] {
	const { disableLanguages } = getVSCodeConfig();
	let globalLanguageSelector: string[] = [];

	if (disableLanguages.length !== 0) {
		for (const lang of allVSCodeLanguageIds) {
			if (!disableLanguages.includes(lang)) {
				globalLanguageSelector.push(lang);
			}
		}
	} else {
		globalLanguageSelector = allVSCodeLanguageIds;
	}

	// No workspace opened.
	if (!vscode.workspace.workspaceFolders) {
		return globalLanguageSelector;
	}

	const specialLanguageSelector: vscode.DocumentFilter[] = [
		{ language: "jsonc", scheme: "vscode-userdata" },
	];
	const untitledLanguageSelector: vscode.DocumentFilter[] = [];
	const fileLanguageSelector: vscode.DocumentFilter[] = [];
	for (const lang of globalLanguageSelector) {
		untitledLanguageSelector.push({ language: lang, scheme: "untitled" });
		fileLanguageSelector.push({ language: lang, scheme: "file" });
	}

	return [
		...untitledLanguageSelector,
		...fileLanguageSelector,
		...specialLanguageSelector,
	];
}

export async function activate(context: vscode.ExtensionContext) {
	const { fileIsIgnored } = ignoreFileHandler(context.subscriptions);
	const prettierEditProvider = new PrettierEditProvider(fileIsIgnored);

	const registerFormatter = () => {
		disposeFormatterHandler();

		const languageSelector = formatterSelector();
		formatterHandler = vscode.languages.registerDocumentFormattingEditProvider(
			languageSelector,
			prettierEditProvider
		);
	};

	registerFormatter();

	context.subscriptions.push(
		vscode.workspace.onDidChangeWorkspaceFolders(registerFormatter),
		{ dispose: disposeFormatterHandler },
		prettierConfigFileWatcher,
		...errorHandlerDisposables
	);
}
