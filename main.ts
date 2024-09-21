import { App, Editor, Plugin, PluginSettingTab, Setting } from 'obsidian';


interface ExpandSelectPluginSettings {
	hotkey: string;
}

const DEFAULT_SETTINGS: ExpandSelectPluginSettings = {
	hotkey: 'Alt+E'
}

export default class ExpandSelectPlugin extends Plugin {
	settings: ExpandSelectPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register a command that will get the cursor position when the hotkey is pressed
		this.addCommand({
			id: "select-expand-region",
			name: "Select & Expand Region",
			editorCallback: (editor) => this.selectExpandRegion(editor),
			hotkeys: [
				{
					modifiers: ["Alt"],
					key: "E",
				},
			],
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new ExpandSelectSettingTab(this.app, this));
	}

	onunload() {
	}

	selectExpandRegion(editor: Editor) {
		if (!editor)
			return;

		const cursor = editor.getCursor();

		console.log('->: ' + editor.getLine(cursor.line)[cursor.ch]);

		const selection = editor.getSelection();
		if (selection) {

			const quoteRange = this.getQuoteRange(editor, cursor);
			if (quoteRange) {
				editor.setSelection(quoteRange.from, quoteRange.to);
				return;
			}

			const sentenceRange = this.getSentenceRange(editor, cursor);
			if (sentenceRange) {
				editor.setSelection(sentenceRange.from, sentenceRange.to);
				return;
			}

			return;
		}

		const wordRange = editor.wordAt({ line: cursor.line, ch: cursor.ch });
		if (!wordRange)
			return;
		editor.setSelection(wordRange?.from, wordRange?.to);
	}

	getQuoteRange(editor: Editor, cursor: { line: number; ch: number }) {
		const selection = editor.getSelection();
		const line_text = editor.getLine(cursor.line);
		const length = line_text.length;

		console.log('selection: ' + selection);

		const quote_op = `"\`'*|$%~[<({`;
		const quote_ed = `"\`'*|$%~]>)}`;

		// check quote bounding
		if (quote_ed.includes(line_text[cursor.ch])) {

			const index = quote_ed.indexOf(line_text[cursor.ch]);
			const op_char = quote_op.at(index) ?? '';

			const abs_start = cursor.ch - selection.length;
			const abs_end = cursor.ch;

			let start = abs_start;
			let end = abs_end;

			while (start > 0 && !op_char.includes(line_text[start - 1])) {
				start--;
			}

			if (op_char.includes(line_text[start - 1]) &&
				quote_ed.includes(line_text[end])
			) {
				return {
					from: { line: cursor.line, ch: start - 1 },
					to: { line: cursor.line, ch: end + 1 }
				};
			}

			return {
				from: { line: cursor.line, ch: abs_start },
				to: { line: cursor.line, ch: abs_end + 1 }
			};
		}


		let start = cursor.ch - selection.length;
		let end = cursor.ch;

		while (end < length && !quote_ed.includes(line_text[end])) {
			end++;
		}

		const index = quote_ed.indexOf(line_text[end]);
		const op_char = quote_op.at(index) ?? '';

		while (start > 0 && !op_char.includes(line_text[start - 1])) {
			start--;
		}

		if (
			op_char.includes(line_text[start - 1]) &&
			quote_ed.includes(line_text[end])
		) {
			return {
				from: { line: cursor.line, ch: start },
				to: { line: cursor.line, ch: end }
			};
		}

		return null;
	}

	getSentenceRange(editor: Editor, cursor: { line: number; ch: number }) {
		const lineText = editor.getLine(cursor.line);
		const length = lineText.length;

		// Find the start of the sentence
		let start = cursor.ch;
		while (start > 0 && !/[.,?!]/.test(lineText[start - 1])) {
			start--;
		}

		// Find the end of the sentence
		let end = cursor.ch;
		while (end < length && !/[.,?!]/.test(lineText[end])) {
			end++;
		}

		return { from: { line: cursor.line, ch: start }, to: { line: cursor.line, ch: end } };
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ExpandSelectSettingTab extends PluginSettingTab {
	plugin: ExpandSelectPlugin;

	constructor(app: App, plugin: ExpandSelectPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: "Select & Expand Region Settings" });

		new Setting(containerEl)
			.setName("Hotkey")
			.setDesc("Set the hotkey to trigger selection")
			.addText((text) =>
				text
					.setPlaceholder("Enter hotkey")
					.setValue(this.plugin.settings.hotkey)
					.onChange(async (value) => {
						this.plugin.settings.hotkey = value;
						await this.plugin.saveSettings();
					})
			);

	}
}
