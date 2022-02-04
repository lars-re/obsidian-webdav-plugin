/* eslint-disable no-param-reassign */
/* eslint-disable no-underscore-dangle */
import { Editor, MarkdownView, Notice, Plugin } from "obsidian";
import ImageUploader from "./uploader/ImageUploader";
// eslint-disable-next-line import/no-cycle
import ImgurPluginSettingsTab from "./ui/ImgurPluginSettingsTab";
import ApiError from "./uploader/ApiError";
import UploadStrategy from "./UploadStrategy";
import buildUploaderFrom from "./uploader/imgUploaderFactory";
import RemoteUploadConfirmationDialog from "./ui/RemoteUploadConfirmationDialog";
import PasteEventCopy from "./aux-event-classes/PasteEventCopy";
import DragEventCopy from "./aux-event-classes/DragEventCopy";

// (!\[[^[\]]*\]\(https?:\/\/(?:i\.)?imgur\.com\/)(\w{8})(\.(?:png|jpe?g|gif)\))
// (!\[[^\[\]]*\]\(https?:\/\/(?:i\.)?imgur\.com\/)(\w{7})(\.(?:png|jpe?g|gif)\))
// ![](https://i.imgur.com/m3RpPCVl.png)![](https://i.imgur.com/m3RpPCVx.png)

// ![](https://i.imgur.com/m3RpPCV.png)
//
// ![](https://i.imgur.com/m3RpPCV.png)

const imgurImageRegexp =
  /(\[)?(!\[[^[\]]*\]\()(https?:\/\/(?:i\.)?imgur\.com\/)(\w+)\.(png|jpe?g|gif)\)(]\(https?:\/\/(?:i\.)?imgur\.com\/\w+\.(?:png|jpe?g|gif)\))?/gm;

declare module "obsidian" {
  interface MarkdownSubView {
    clipboardManager: ClipboardManager;
  }
}

interface ClipboardManager {
  handlePaste(e: ClipboardEvent): void;
  handleDrop(e: DragEvent): void;
}

export interface ImgurPluginSettings {
  uploadStrategy: string;
  clientId: string;
  showRemoteUploadConfirmation: boolean;
}

const DEFAULT_SETTINGS: ImgurPluginSettings = {
  uploadStrategy: UploadStrategy.ANONYMOUS_IMGUR.id,
  clientId: null,
  showRemoteUploadConfirmation: true,
};

export default class ImgurPlugin extends Plugin {
  settings: ImgurPluginSettings;

  private imgUploaderField: ImageUploader;

  private customPasteEventCallback = async (
    e: ClipboardEvent,
    _: Editor,
    markdownView: MarkdownView
  ) => {
    if (e instanceof PasteEventCopy) return;

    if (!this.imgUploader) {
      ImgurPlugin.showUnconfiguredPluginNotice();
      return;
    }

    const { files } = e.clipboardData;
    if (files.length === 0 || !files[0].type.startsWith("image")) {
      return;
    }

    e.preventDefault();

    if (this.settings.showRemoteUploadConfirmation) {
      const modal = new RemoteUploadConfirmationDialog(this.app);
      modal.open();

      const userResp = await modal.response();
      switch (userResp.shouldUpload) {
        case undefined:
          return;
        case true:
          if (userResp.alwaysUpload) {
            this.settings.showRemoteUploadConfirmation = false;
            this.saveSettings()
              .then(() => {})
              .catch(() => {});
          }
          break;
        case false:
          markdownView.currentMode.clipboardManager.handlePaste(
            new PasteEventCopy(e)
          );
          return;
        default:
          return;
      }
    }

    for (let i = 0; i < files.length; i += 1) {
      this.uploadFileAndEmbedImgurImage(files[i]).catch(() => {
        markdownView.currentMode.clipboardManager.handlePaste(
          new PasteEventCopy(e)
        );
      });
    }
  };

  private customDropEventListener = async (
    e: DragEvent,
    _: Editor,
    markdownView: MarkdownView
  ) => {
    if (e instanceof DragEventCopy) return;

    if (!this.imgUploader) {
      ImgurPlugin.showUnconfiguredPluginNotice();
      return;
    }

    if (
      e.dataTransfer.types.length !== 1 ||
      e.dataTransfer.types[0] !== "Files"
    ) {
      return;
    }

    // Preserve files before showing modal, otherwise they will be lost from the event
    const { files } = e.dataTransfer;

    e.preventDefault();

    if (this.settings.showRemoteUploadConfirmation) {
      const modal = new RemoteUploadConfirmationDialog(this.app);
      modal.open();

      const userResp = await modal.response();
      switch (userResp.shouldUpload) {
        case undefined:
          return;
        case true:
          if (userResp.alwaysUpload) {
            this.settings.showRemoteUploadConfirmation = false;
            this.saveSettings()
              .then(() => {})
              .catch(() => {});
          }
          break;
        case false: {
          markdownView.currentMode.clipboardManager.handleDrop(
            DragEventCopy.create(e, files)
          );
          return;
        }
        default:
          return;
      }
    }

    for (let i = 0; i < files.length; i += 1) {
      if (!files[i].type.startsWith("image")) {
        return;
      }
    }

    // Adding newline to avoid messing images pasted via default handler
    // with any text added by the plugin
    this.getEditor().replaceSelection("\n");

    const promises: Promise<void>[] = [];
    const filesFailedToUpload: File[] = [];
    for (let i = 0; i < files.length; i += 1) {
      const image = files[i];
      const uploadPromise = this.uploadFileAndEmbedImgurImage(image).catch(
        () => {
          filesFailedToUpload.push(image);
        }
      );
      promises.push(uploadPromise);
    }

    await Promise.all(promises);

    if (filesFailedToUpload.length === 0) {
      return;
    }

    markdownView.currentMode.clipboardManager.handleDrop(
      DragEventCopy.create(e, filesFailedToUpload)
    );
  };

  get imgUploader(): ImageUploader {
    return this.imgUploaderField;
  }

  private async loadSettings() {
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...((await this.loadData()) as ImgurPluginSettings),
    };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  // static isMatchUnderCursor(arr: RegExpMatchArray, cursor: number): boolean {
  //   console.log("Cursor at", cursor);
  //   console.log("Match start at", arr.index);
  //   console.log("Match end at", arr.index + arr[0].length);

  //   return cursor > arr.index && cursor < arr.index + arr[0].length;
  // }

  async onload(): Promise<void> {
    this.addCommand({
      id: "imgur-resize-l-command",
      name: "Resize to Large",
      editorCallback: (editor: Editor) => {
        const lineNumber = editor.getCursor().line;
        const cursorPos = editor.getCursor().ch;

        const line = editor.getLine(lineNumber);

        const isMatchUnderCursor = (match: RegExpMatchArray) =>
          cursorPos > match.index && cursorPos < match.index + match[0].length;

        const matchUnderCursor: RegExpMatchArray = Array.from(
          line.matchAll(imgurImageRegexp)
        ).find((match) => isMatchUnderCursor(match));

        if (!matchUnderCursor) {
          // eslint-disable-next-line no-new
          new Notice("No Imgur image under cursor");
          return;
        }

        const potentialImageId = matchUnderCursor[4];

        if (potentialImageId.length !== 7 && potentialImageId.length !== 8) {
          // eslint-disable-next-line no-new
          new Notice(
            `Existing image id '${potentialImageId}' is of unexpected size. Abodring...`
          );
          return;
        }

        const imageId = potentialImageId.substring(0, 7);

        const prefix = matchUnderCursor[3];
        const ext = matchUnderCursor[5];

        let replacement = `${matchUnderCursor[2]}${prefix}${imageId}l.${ext})`;

        console.log(matchUnderCursor);

        if (matchUnderCursor[1] && matchUnderCursor[6]) {
          replacement = `${matchUnderCursor[1]}${replacement}${matchUnderCursor[6]}`;
        } else {
          replacement = `[${replacement}](${prefix}${imageId}.${ext})`;
        }

        editor.replaceRange(
          replacement,
          { line: lineNumber, ch: matchUnderCursor.index },
          {
            line: lineNumber,
            ch: matchUnderCursor.index + matchUnderCursor[0].length,
          }
        );

        // console.log(line.matchAll(imgurImageRegexp));

        // if (match.groups)
        // console.log(editor.getValue());
        // console.log(editor.getClickableTokenAt(editor.getCursor()));

        // console.log(line);

        // const clickable = editor.getClickableTokenAt(editor.getCursor());
        // console.log(clickable);

        // const lt = parseLinktext(clickable.text);
      },
    });
    await this.loadSettings();
    this.addSettingTab(new ImgurPluginSettingsTab(this.app, this));
    this.setupImgurHandlers();
    this.setupImagesUploader();
  }

  setupImagesUploader(): void {
    this.imgUploaderField = buildUploaderFrom(this.settings);
  }

  private setupImgurHandlers() {
    this.registerEvent(
      this.app.workspace.on("editor-paste", this.customPasteEventCallback)
    );
    this.registerEvent(
      this.app.workspace.on("editor-drop", this.customDropEventListener)
    );
  }

  private static showUnconfiguredPluginNotice() {
    const fiveSecondsMillis = 5_000;
    // eslint-disable-next-line no-new
    new Notice(
      "⚠️ Please configure Imgur plugin or disable it",
      fiveSecondsMillis
    );
  }

  private async uploadFileAndEmbedImgurImage(file: File) {
    const pasteId = (Math.random() + 1).toString(36).substr(2, 5);
    this.insertTemporaryText(pasteId);

    let imgUrl: string;
    try {
      imgUrl = await this.imgUploaderField.upload(file);
    } catch (e) {
      if (e instanceof ApiError) {
        this.handleFailedUpload(
          pasteId,
          `Upload failed, remote server returned an error: ${e.message}`
        );
      } else {
        // eslint-disable-next-line no-console
        console.error("Failed imgur request: ", e);
        this.handleFailedUpload(
          pasteId,
          "⚠️Imgur upload failed, check dev console"
        );
      }
      throw e;
    }
    this.embedMarkDownImage(pasteId, imgUrl);
  }

  private insertTemporaryText(pasteId: string) {
    const progressText = ImgurPlugin.progressTextFor(pasteId);
    this.getEditor().replaceSelection(`${progressText}\n`);
  }

  private static progressTextFor(id: string) {
    return `![Uploading file...${id}]()`;
  }

  private embedMarkDownImage(pasteId: string, imageUrl: string) {
    const progressText = ImgurPlugin.progressTextFor(pasteId);
    const markDownImage = `![](${imageUrl})`;

    ImgurPlugin.replaceFirstOccurrence(
      this.getEditor(),
      progressText,
      markDownImage
    );
  }

  private handleFailedUpload(pasteId: string, message: string) {
    const progressText = ImgurPlugin.progressTextFor(pasteId);
    ImgurPlugin.replaceFirstOccurrence(
      this.getEditor(),
      progressText,
      `<!--${message}-->`
    );
  }

  private getEditor(): Editor {
    const mdView = this.app.workspace.activeLeaf.view as MarkdownView;
    return mdView.editor;
  }

  private static replaceFirstOccurrence(
    editor: Editor,
    target: string,
    replacement: string
  ) {
    const lines = editor.getValue().split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const ch = lines[i].indexOf(target);
      if (ch !== -1) {
        const from = { line: i, ch };
        const to = { line: i, ch: ch + target.length };
        editor.replaceRange(replacement, from, to);
        break;
      }
    }
  }
}
