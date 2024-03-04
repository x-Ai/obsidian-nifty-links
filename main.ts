import {
	App,
	Editor,
	MarkdownView,
	Notice,
	Plugin,
	requestUrl
} from "obsidian";

interface ObsidianNiftyLinksPluginSettings { }

const DEFAULT_SETTINGS: ObsidianNiftyLinksPluginSettings = {};

export default class ObsidianNiftyLinksPlugin extends Plugin {
	settings: ObsidianNiftyLinksPluginSettings;

	async onload() {
		console.log("loading plugin");

		await this.loadSettings();

		this.addRibbonIcon("link", "Nifty Links", () => {
			let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (activeView) {
				let editor = activeView.editor;
				this.urlToMarkdown(editor);
			}
		});

		this.addCommand({
			id: "create-nifty-links",
			name: "Create Nifty Link",
			editorCheckCallback: (checking: boolean, editor: Editor) => {
				if (!checking) {
					this.urlToMarkdown(editor);
				}
				return true;
			},
		});

		this.registerMarkdownCodeBlockProcessor("NiftyLinks", (source, el, ctx) => {
			const data = source.split('\n').reduce((acc, line) => {
				const [key, ...value] = line.split(': ');
				acc[key.trim()] = value.join(': ').trim();
				return acc;
			}, {});

			const url = data.url;
			let title = data.title || "";
			let description = data.description || "";
			const imageLink = data.image;
			const iconLink = data.favicon;

			// 使用.replace(/\s{3,}/g, ' ').trim()处理title和description
			title = title.replace(/\s{3,}/g, ' ').trim();
			description = description.replace(/\s{3,}/g, ' ').trim();

			const cardTextStyle = imageLink ? "" : ' style="width: 100%;"';

			// 当iconLink存在时才插入图标，确保不会尝试加载未定义的图标
			const iconHTML = iconLink ? `<img class="nifty-link-icon" src="${iconLink}">` : '';

			// 构建图片容器的HTML，如果有imageLink
			const imageContainerHTML = imageLink ? `
		  <div class="nifty-link-image-container">
			<div class="nifty-link-image" style="background-image: url('${imageLink}')"></div>
		  </div>` : '';

			// 构建最终的HTML结构
			const html = `
		  <div class="nifty-link-card-container">
			<a class="nifty-link-card" href="${url}" target="_blank">
			  <div class="nifty-link-card-text"${cardTextStyle}>
				<div class="nifty-link-card-title">${title}</div>
				<div class="nifty-link-card-description">${description}</div>
				<div class="nifty-link-href">
				  ${iconHTML}${url}
				</div>
			  </div>
			  ${imageContainerHTML}
			</a>
		  </div>
		`;

			el.innerHTML = html;
		});


	}

	onunload() {
		console.log("unloading plugin");
	}

	isUrl(text) {
		const urlRegex = new RegExp("^(http:\\/\\/www\\.|https:\\/\\/www\\.|http:\\/\\/|https:\\/\\/)?[a-z0-9]+([\\-.]{1}[a-z0-9]+)*\\.[a-z]{2,5}(:[0-9]{1,5})?(\\/.*)?$");
		return urlRegex.test(text);
	}

	async urlToMarkdown(editor) {
		let selectedText = editor.somethingSelected()
			? editor.getSelection().trim()
			: false;
		if (selectedText && this.isUrl(selectedText)) {
			const url = selectedText;
			try {
				const response = await requestUrl({ url: `http://iframely.server.crestify.com/iframely?url=${url}` });
				const data = response.json;
				let imageLink = data.links.find((value) => value.type.startsWith("image") && value.rel.includes('twitter'));
				imageLink = imageLink ? imageLink.href : '';
				let iconLink = data.links.find((value) => value.type.startsWith("image") && value.rel.includes('icon'));
				iconLink = iconLink ? iconLink.href : '';

				// 根据是否有图片链接调整Markdown输出
				let markdownLink = `\n\`\`\`NiftyLinks
url: ${url}
title: ${data.meta.title || ""}
description: ${data.meta.description || ""}
favicon: ${iconLink}
${imageLink ? `image: ${imageLink}` : ""}
\`\`\`\n`;


				editor.replaceSelection(markdownLink);
				const cursorPos = editor.getCursor();
				editor.setCursor(cursorPos.line + 1, 0);
			} catch (error) {
				console.error(error);
			}
		}
		else {
			new Notice("Select a URL to convert to nifty link.");
		}
	}


	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
