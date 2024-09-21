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
		if (!wordRange) {

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
		editor.setSelection(wordRange?.from, wordRange?.to);
	}

	getQuoteRange(editor: Editor, cursor: { line: number; ch: number }) {
		const quote_op = `"\`'*|$%~[<({`;
		const quote_ed = `"\`'*|$%~]>)}`;

		const selection = editor.getSelection();

		const line_text = editor.getLine(cursor.line);
		const length = line_text.length;

		const abs_start = cursor.ch - selection.length;
		const abs_end = cursor.ch;

		console.log('selection: ' + selection);

		// check quote end bounding
		if (quote_ed.includes(line_text[cursor.ch])) {
			const index = quote_ed.indexOf(line_text[cursor.ch]);
			const op_char = quote_op.at(index) ?? '';

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

		// check quote start bounding
		if (quote_op.includes(line_text[cursor.ch])) {
			const index = quote_op.indexOf(line_text[cursor.ch]);
			const ed_char = quote_ed.at(index) ?? '';

			let start = abs_start;
			let end = abs_end;

			while (end < length && !ed_char.includes(line_text[end])) {
				end++;
			}

			if (ed_char.includes(line_text[end])) {
				return {
					from: { line: cursor.line, ch: start },
					to: { line: cursor.line, ch: end + 1 }
				};
			}
		}

		let start = abs_start;
		let end = abs_end;

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

		console.log('quote not found');
		return null;
	}

	getSentenceRange(editor: Editor, cursor: { line: number; ch: number }) {
		const mid_sentence = `,;`;
		const sentence_terminators = `.?!`;

		const terminators = `${mid_sentence}${sentence_terminators}`;

		const selection = editor.getSelection();
		const line_text = editor.getLine(cursor.line);
		const length = line_text.length;

		const abs_start = cursor.ch - selection.length;
		const abs_end = cursor.ch;

		if (sentence_terminators.includes(line_text[cursor.ch])) {
			if (abs_start !== 0 && !terminators.includes(line_text[abs_start - 1])) {
				let start = abs_start - 1;
				while (start > 0 && !terminators.includes(line_text[start - 1])) {
					start--;
				}
				return {
					from: {line: cursor.line, ch: start},
					to: {line: cursor.line, ch: abs_end}
				};
			}
			if (mid_sentence.includes(line_text[abs_start - 1])) {
				let start = abs_start - 1;
				while (start > 0 && !terminators.includes(line_text[start - 1])) {
					start--;
				}
				return {
					from: {line: cursor.line, ch: start},
					to: {line: cursor.line, ch: abs_end}
				};
			}
			return {
				from: { line: cursor.line, ch: abs_start },
				to: { line: cursor.line, ch: abs_end + 1 }
			};
		}

		if (mid_sentence.includes(line_text[cursor.ch])) {
			console.log('Q');
			if (mid_sentence.includes(line_text[abs_start - 1])) {
				let start = abs_start - 1;
				while (start > 0 && !terminators.includes(line_text[start - 1])) {
					start--;
				}
				return {
					from: { line: cursor.line, ch: start },
					to: { line: cursor.line, ch: abs_end }
				};
			}

			if (abs_start === 0 || sentence_terminators.includes(line_text[abs_start - 1])) {
				return {
					from: { line: cursor.line, ch: abs_start },
					to: { line: cursor.line, ch: abs_end + 1 }
				};
			}

			let start = abs_start;
			while (start > 0 && !terminators.includes(line_text[start - 1])) {
				start--;
			}

			if (start <= 0 || terminators.includes(line_text[start])) {
				return {
					from: { line: cursor.line, ch: start },
					to: { line: cursor.line, ch: abs_end + 1 }
				};
			}
			return {
				from: { line: cursor.line, ch: start },
				to: { line: cursor.line, ch: abs_end }
			};
		}

		if (
			(abs_start <= 0 || sentence_terminators.includes(line_text[abs_start - 1])) &&
			(abs_end >= length || sentence_terminators.includes(line_text[abs_end - 1]))
		) {
			return { from: { line: cursor.line, ch: 0 }, to: { line: cursor.line, ch: length } };
		}

		let start = abs_start;
		let end = abs_end;

		while (start > 0 && !terminators.includes(line_text[start - 1])) {
			start--;
		}

		while (end < length && !terminators.includes(line_text[end])) {
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
