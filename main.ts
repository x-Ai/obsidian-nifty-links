import {
    App,
    Editor,
    MarkdownView,
    Notice,
    Plugin,
    moment,
    requestUrl
} from "obsidian";

interface ObsidianNiftyLinksPluginSettings {
    fixedWidth: boolean;
}

const DEFAULT_SETTINGS: ObsidianNiftyLinksPluginSettings = {
    fixedWidth: false
};

import { PluginSettingTab, Setting } from "obsidian";

class NiftyLinksSettingTab extends PluginSettingTab {
    plugin: ObsidianNiftyLinksPlugin;

    constructor(app: App, plugin: ObsidianNiftyLinksPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    async display(): Promise<void> {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName(this.plugin.t('Fixed width'))
            .setDesc(this.plugin.t('Set the width of Nifty Links cards to a fixed 700px'))
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.fixedWidth)
                .onChange(async (value) => {
                    this.plugin.settings.fixedWidth = value;
                    await this.plugin.saveSettings();
                    this.plugin.updateStyles();
                }));
    }
}

export default class ObsidianNiftyLinksPlugin extends Plugin {
    settings: ObsidianNiftyLinksPluginSettings;
    translations: {[key: string]: string} = {};

	t(key: string): string {
		return this.translations[key] || key;
	}

	async loadTranslations() {
		const lang = moment.locale();
		try {
			const content = await (this.app.vault as any).adapter.read(
				`${this.manifest.dir}/locales/${lang}.json`
			);
			this.translations = JSON.parse(content);
		} catch (error) {
			console.error(`Failed to load translations for ${lang}`, error);
		}
	}

	async onload() {
		console.log("loading plugin");

		await this.loadSettings();
		await this.loadTranslations();

		this.addSettingTab(new NiftyLinksSettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("editor-menu", (menu, editor: Editor) => {
				const selection = editor.getSelection();
				if (selection && this.isUrl(selection.trim())) {
					menu.addItem((item) => {
						item
							.setTitle(this.t("Convert to Nifty Link"))
							.setIcon("link")
							.onClick(async () => {
								await this.urlToMarkdown(editor);
							});
					});
				}
			})
		);

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

			title = title.replace(/\s{3,}/g, ' ').trim();
			description = description.replace(/\s{3,}/g, ' ').trim();

			const cardTextStyle = imageLink ? "" : ' style="width: 100%;"';

			const iconHTML = iconLink ? `<img class="nifty-link-icon" src="${iconLink}">` : '';

			const imageContainerHTML = imageLink ? `
		  <div class="nifty-link-image-container">
			<div class="nifty-link-image" style="background-image: url('${imageLink}')"></div>
		  </div>` : '';

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

		this.updateStyles();
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
			let url = selectedText;
			let api = "";
			const specialDomains = ["medium.com"];
			let isSpecialDomain = specialDomains.some(domain => url.includes(domain));
			if (isSpecialDomain) {
				api = `https://api.microlink.io/?url=${url}`;
			} else {
				api = `http://iframely.server.crestify.com/iframely?url=${url}`;
			}

			try {
				let response = await requestUrl({ url: api });
				let data = isSpecialDomain ? response.json.data : response.json;
				if (!isSpecialDomain && data.code === 403) {
					api = `https://api.microlink.io/?url=${url}`;
					response = await requestUrl({ url: api });
					data = response.json.data;
					isSpecialDomain = true;
				}
				const imageLink = isSpecialDomain ? (data.image ? data.image.url : '') : data.links.find((value) => value.type.startsWith("image") && value.rel.includes('twitter'))?.href || '';
				const iconLink = isSpecialDomain ? (data.logo ? data.logo.url : '') : data.links.find((value) => value.type.startsWith("image") && value.rel.includes('icon'))?.href || '';

				let markdownLink = `\n\`\`\`NiftyLinks
url: ${isSpecialDomain ? (data.url || url) : url}
title: ${isSpecialDomain ? data.title : data.meta.title || ""}
description: ${isSpecialDomain ? data.description : data.meta.description || ""}
favicon: ${iconLink}
${imageLink ? `image: ${imageLink}` : ""}
\`\`\`\n`;

            editor.replaceSelection(markdownLink);
            return true;
        } catch (error) {
            console.error(error);
            new Notice(await this.t("Failed to fetch data."));
            return false;
        }
    } else {
        new Notice(await this.t("Select a URL to convert to nifty link."));
        return false;
    }
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	updateStyles() {
		document.body.classList.toggle('nifty-links-fixed-width', this.settings.fixedWidth);
	}
}
