import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
  } from "obsidian";
  
  interface ObsidianNiftyLinksPluginSettings { }
  
  const DEFAULT_SETTINGS: ObsidianNiftyLinksPluginSettings = {};
  
  export default class ObsidianNiftyLinksPlugin extends Plugin {
	settings: ObsidianNiftyLinksPlugin;
  
	async onload() {
	  console.log("loading plugin");
  
	  await this.loadSettings();
  
	  this.addRibbonIcon("link", "Nifty Links", () => {
		let activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (activeView) {
		  let editor = activeView.editor;
		  this.urlToIframe(editor);
		}
	  });
  
	  this.addCommand({
		id: "create-nifty-links",
		name: "Create Nifty Link",
		editorCheckCallback: (checking: boolean, editor: Editor) => {
		  if (!checking) {
			this.urlToIframe(editor);
		  }
		  return true;
		},
	  });
	}
  
	onunload() {
		  console.log("unloading plugin");
	  }
	  isUrl(text) {
		const urlRegex = new RegExp("^(http:\\/\\/www\\.|https:\\/\\/www\\.|http:\\/\\/|https:\\/\\/)?[a-z0-9]+([\\-.]{1}[a-z0-9]+)*\\.[a-z]{2,5}(:[0-9]{1,5})?(\\/.*)?$");
		return urlRegex.test(text);
	  }
  
	  async urlToIframe(editor) {
		let selectedText = editor.somethingSelected()
			? editor.getSelection().trim()
			: false;
		if (selectedText && this.isUrl(selectedText)) {
			const url = selectedText;
			try {
				const response = await requestUrl(`http://iframely.server.crestify.com/iframely?url=${url}`);
				const data = response.json;
				let imageLink = data.links.find((value) => value.type.startsWith("image") && value.rel.includes('twitter'));
				imageLink = imageLink ? imageLink.href : '';
				let cardTextStyle = imageLink ? "" : ' style="width: 100%;"';
				let imageContainerHTML = imageLink ? `    <div class="nifty-link-image-container">
                <div class="nifty-link-image" style="background-image: url('${imageLink}')">
                </div>
            </div>` : '';
				let iconLink = data.links.find((value) => value.type.startsWith("image") && value.rel.includes('icon'));
				iconLink = iconLink ? iconLink.href : '';
				editor.replaceSelection(`
  <div class="nifty-link-card-container">
	<a class="nifty-link-card" href="${url}" target="_blank">
		<div class="nifty-link-card-text"${cardTextStyle}>
			<div class="nifty-link-card-title">${(data.meta.title || "").replace(/\s{3,}/g, ' ').trim()}</div>
			<div class="nifty-link-card-description">${(data.meta.description || "").replace(/\s{3,}/g, ' ').trim()}</div>
			<div class="nifty-link-href">
			<img class="nifty-link-icon" src="${iconLink}">
				${url}
			</div>
		</div>
		${imageContainerHTML}
	</a>
  </div>
  
  `);
			} catch (error) {
            console.error(error);
        }
    }
		else {
			new obsidian.Notice("Select a URL to convert to nifty link.");
		}
	}
  
	async loadSettings() {
	  this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
  
	async saveSettings() {
	  await this.saveData(this.settings);
	}
  }  