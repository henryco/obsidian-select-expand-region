import {App, Editor, Modifier, Plugin, PluginSettingTab, Setting} from 'obsidian';

interface ExpandSelectPluginSettings {
	hotkey?: string;
	quote_op: string;
	quote_ed: string;
	mid_term: string;
	end_term: string;
	url_regex: string;
}

const DEFAULT_SETTINGS: ExpandSelectPluginSettings = {
	hotkey: undefined,
	quote_op: `"\`'*|$%~[<({`,
	quote_ed: `"\`'*|$%~]>)}`,
	mid_term: `,;`,
	end_term: `.?!`,
	url_regex: '^(https?:\\/\\/[^\\s\\/$.?#].\\S*)$',
}

export default class ExpandSelectPlugin extends Plugin {
	settings: ExpandSelectPluginSettings;

	get_quote_op(): string {
		return this.settings.quote_op;
	}

	get_quote_ed(): string {
		return this.settings.quote_ed;
	}

	get_mid_term(): string {
		return this.settings.mid_term;
	}

	get_end_term(): string {
		return this.settings.end_term;
	}

	get_url_regex(): string[] {
		return [
			this.settings.url_regex
		];
	}

	async onload() {
		await this.loadSettings();

		let extra: any = {};
		if (this.settings.hotkey) {
			extra = {
				hotkeys: [{
					modifiers: this.parseModifiers(this.settings.hotkey),
					key: this.parseKey(this.settings.hotkey),
				}]
			}
		}

		this.addCommand({
			id: "select-expand-region",
			name: "Select & Expand Region",
			editorCallback: (editor) => this.selectExpandRegion(editor),
			...extra
		});

		this.addSettingTab(new ExpandSelectSettingTab(this.app, this));
	}

	onunload() {
	}

	parseModifiers(hotkey: string): Modifier[] {
		const parts = hotkey.split('+');
		// @ts-ignore
		return parts.slice(0, parts.length - 1);
	}

	parseKey(hotkey: string): string {
		const parts = hotkey.split('+');
		return parts[parts.length - 1];  // Last part is the key
	}

	selectExpandRegion(editor: Editor) {
		if (!editor)
			return;

		const cursor = editor.getCursor();
		const selection = editor.getSelection();
		const link = this.getLink(editor, cursor);
		const line_range = this.getLineRange(editor, cursor);

		if (line_range) {
			editor.setSelection(line_range.from, line_range.to);
			return;
		}

		if (link) {
			editor.setSelection(link.from, link.to);
			const selection_new = editor.getSelection();
			if (selection !== selection_new)
				return;
		}

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

	getLink(editor: Editor, cursor: { line: number; ch: number }) {
		const mid_sentence = this.get_mid_term();
		const terminators = `${mid_sentence} `;

		const selection = editor.getSelection();

		const line_text = editor.getLine(cursor.line);
		const length = line_text.length;

		const abs_start = cursor.ch - selection.length;
		const abs_end = cursor.ch;

		let start = abs_start;
		let end = abs_end;

		while (start > 0 && !terminators.includes(line_text[start - 1])) {
			start--;
		}

		while (end < length && !terminators.includes(line_text[end])) {
			end++;
		}

		let word = '';
		for (let i = start; i < end; i++) {
			word += line_text.charAt(i);
		}

		return this.isURL(word) ? {
			from: { line: cursor.line, ch: start },
			to: { line: cursor.line, ch: end },
		} : null;
	}

	isURL(word: string): boolean {
		const exp = this.get_url_regex();
		const w = word.trim();

		for (let s of exp) {
			if (new RegExp(s, 'i').test(w))
				return true;
		}

		return false;
		// const urlRegex = /^(https?:\/\/[^\s\/$.?#].\S*)$/i;
		// return urlRegex.test(word.trim());
	}

	getQuoteRange(editor: Editor, cursor: { line: number; ch: number }) {
		const quote_op = this.get_quote_op();
		const quote_ed = this.get_quote_ed();

		const selection = editor.getSelection();

		const line_text = editor.getLine(cursor.line);
		const length = line_text.length;

		const abs_start = cursor.ch - selection.length;
		const abs_end = cursor.ch;

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

		return null;
	}

	getLineRange(editor: Editor, cursor: { line: number; ch: number }) {
		const from_cursor = editor.getCursor('from');
		const to_cursor = editor.getCursor('to');
		const selection = editor.getSelection();

		const line_text = editor.getLine(cursor.line);

		if (selection.length >= line_text.length) {
			return {
				from: {line: Math.max(0, from_cursor.line - 1), ch: 0},
				to: {line: to_cursor.line + 2, ch: editor.getLine(to_cursor.line + 2).length}
			}
		}

		return null;
	}

	getSentenceRange(editor: Editor, cursor: { line: number; ch: number }) {
		const mid_sentence = this.get_mid_term();
		const sentence_terminators = this.get_end_term();

		const terminators = `${mid_sentence}${sentence_terminators}`;

		const selection = editor.getSelection();
		const line_text = editor.getLine(cursor.line);
		const length = line_text.length;

		const abs_start = cursor.ch - selection.length;
		const abs_end = cursor.ch;

		if (sentence_terminators.includes(line_text[cursor.ch])) {
			if (this.firstWordInSentence(line_text, abs_start - 1, sentence_terminators)) {
				return {
					from: { line: cursor.line, ch: abs_start },
					to: { line: cursor.line, ch: abs_end + 1 }
				};
			}
			if (abs_start !== 0 && !terminators.includes(line_text[abs_start - 1])) {
				let start = abs_start - 1;
				while (start > 0 && !sentence_terminators.includes(line_text[start - 1])) {
					start--;
				}

				while (`${line_text[start]}`.trim() === '' && start < abs_end && start < length) {
					start++;
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
			if (!this.firstWordInSentence(line_text, abs_start - 1, terminators)) {
				let start = abs_start;
				while (start > 0 && !terminators.includes(line_text[start - 1])) {
					start--;
				}

				while (`${line_text[start]}`.trim() === '' && start < abs_end && start < length) {
					start++;
				}

				return {
					from: { line: cursor.line, ch: start },
					to: { line: cursor.line, ch: abs_end }
				};
			}

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

			while (`${line_text[start]}`.trim() === '' && start < abs_end && start < length) {
				start++;
			}

			return {
				from: { line: cursor.line, ch: start },
				to: { line: cursor.line, ch: abs_end + 1 }
			};
		}

		if (
			(abs_start <= 0 || this.firstWordInSentence(line_text, abs_start - 1, sentence_terminators) ) &&
			(abs_end >= length || sentence_terminators.includes(line_text[abs_end - 1]))
		) {
			return {
				from: { line: cursor.line, ch: 0 },
				to: { line: cursor.line, ch: length }
			};
		}

		let start = abs_start;
		let end = abs_end;

		while (start > 0 && !terminators.includes(line_text[start - 1])) {
			start--;
		}

		while (end < length && !terminators.includes(line_text[end])) {
			end++;
		}

		while (`${line_text[start]}`.trim() === '' && start < end && start < length) {
			start++;
		}

		return {
			from: { line: cursor.line, ch: start },
			to: { line: cursor.line, ch: end }
		};
	}

	firstWordInSentence(line_text: string, pos: number, terminators: string) {
		let n = pos;

		while (n > 0) {
			if (terminators.includes(line_text[n])) {
				return true;
			}

			if (`${line_text[n]}`.trim() === '') {
				n--;
				continue;
			}

			return false;
		}

		return true;
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

		new Setting(containerEl)
			.setName("Select & Expand Region Settings")
			.setHeading();

		new Setting(containerEl)
			.setName("Hotkey (Plugin restart required)")
			.setDesc("Set the hotkey to trigger selection (requires restart)")
			.addText((text) =>
				text
					.setPlaceholder("Enter hotkey")
					.setValue(this.plugin.settings.hotkey ?? '')
					.onChange(async (value) => {
						this.plugin.settings.hotkey = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Quote op")
			.setDesc("")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.quote_op)
					.onChange(async (value) => {
						this.plugin.settings.quote_op = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Quote ed")
			.setDesc("")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.quote_ed)
					.onChange(async (value) => {
						this.plugin.settings.quote_ed = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Mid sentence terminators")
			.setDesc("")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.mid_term)
					.onChange(async (value) => {
						this.plugin.settings.mid_term = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("Sentence terminators")
			.setDesc("")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.end_term)
					.onChange(async (value) => {
						this.plugin.settings.end_term = value;
						await this.plugin.saveSettings();
					})
			);

		new Setting(containerEl)
			.setName("URL Regex")
			.setDesc("")
			.addText((text) =>
				text
					.setValue(this.plugin.settings.url_regex)
					.onChange(async (value) => {
						this.plugin.settings.url_regex = value;
						await this.plugin.saveSettings();
					})
			);
	}
}
