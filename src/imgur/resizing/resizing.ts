import { Editor, Notice } from "obsidian";
import ImgurSize from "./ImgurSize";
import parseImgur from "./md-image-parsing";
import ParsingRes from "./ParsingRes";

export type Replacement = {
  content: string;
  from: number;
  to: number;
};

const isMatchUnderCursor = (match: RegExpMatchArray, cursorPosition: number) =>
  cursorPosition >= match.index &&
  cursorPosition < match.index + match[0].length;

const imgurMarkdownImageRegexMatch = (str: string, cursorPosOnStr: number) =>
  Array.from(parseImgur(str)).find((match) =>
    isMatchUnderCursor(match, cursorPosOnStr)
  );

class ImgurResizer {
  constructor(private size: ImgurSize) {}

  prepareReplacement(regexMatch: RegExpMatchArray): Replacement {
    const parsed = new ParsingRes(regexMatch);

    let replacement;
    const resizedUrl = `${parsed.imgPrefix}${parsed.imgurhost}${parsed.imageId}${this.size.suffix}.${parsed.imageExt})`;

    if (parsed.isWrappedWithUrl) {
      replacement = `${parsed.urlPrefix}${resizedUrl}${parsed.urlSuffix}`;
    } else {
      replacement = `[${resizedUrl}](${parsed.imgurhost}${parsed.imageId}.${parsed.imageExt})`;
    }

    return {
      content: replacement,
      from: parsed.startIndex,
      to: parsed.endIndex,
    };
  }
}

export const editorCheckCallbackFor =
  (size: ImgurSize) => (checking: boolean, editor: Editor) => {
    const lineNumber = editor.getCursor().line;
    const match = imgurMarkdownImageRegexMatch(
      editor.getLine(lineNumber),
      editor.getCursor().ch
    );

    console.log("Checking if there is an image under cursor?");

    if (!match) return false;
    if (checking && match) return true;

    let replacement: Replacement;
    try {
      replacement = new ImgurResizer(size).prepareReplacement(match);
    } catch (e) {
      if (e instanceof Error)
        // eslint-disable-next-line no-new
        new Notice(e.message);
      // eslint-disable-next-line no-console
      else console.error(e);
      return false;
    }

    editor.replaceRange(
      replacement.content,
      { line: lineNumber, ch: replacement.from },
      { line: lineNumber, ch: replacement.to }
    );
    return true;
  };
