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
  cursorPosition > match.index &&
  cursorPosition < match.index + match[0].length;

const findImgurImageUnderCursor = (str: string, cursorPosOnStr: number) =>
  Array.from(parseImgur(str)).find((match) =>
    isMatchUnderCursor(match, cursorPosOnStr)
  );

export class ImgurResizer {
  constructor(private size: ImgurSize) {}

  prepareReplacement(
    str: string,
    cursorPosOnStr: number
  ): Replacement | undefined {
    const matchUnderCusrsor = findImgurImageUnderCursor(str, cursorPosOnStr);
    if (matchUnderCusrsor === undefined) return undefined;

    const parsed = new ParsingRes(matchUnderCusrsor);
    // if (!parsed.isImageIdOfExpectedSize)
    //   return Promise.reject(
    //     new Error(`Existing image id '${parsed.imageId}' is of unexpected size`)
    //   );

    let replacement = `${parsed.imgPrefix}${parsed.imgurhost}${parsed.imageId}${this.size.suffix}.${parsed.imageExt})`;

    if (parsed.isWrappedWithUrl) {
      replacement = `${parsed.urlPrefix}${replacement}${parsed.urlSuffix}`;
    }

    return {
      content: replacement,
      from: parsed.startIndex,
      to: parsed.endIndex,
    };

    // return Promise.resolve({
    //   content: replacement,
    //   from: parsed.startIndex,
    //   to: parsed.endIndex,
    // });
  }
}

export const editorCallback = (editor: Editor) => {
  const lineNumber = editor.getCursor().line;

  const replacement = new ImgurResizer(
    ImgurSize.LARGE_THUMBNAIL
  ).prepareReplacement(editor.getLine(lineNumber), editor.getCursor().ch);

  if (!replacement) {
    // eslint-disable-next-line no-new
    new Notice("No Imgur image under cursor");
    return;
  }

  editor.replaceRange(
    replacement.content,
    { line: lineNumber, ch: replacement.from },
    { line: lineNumber, ch: replacement.to }
  );
};

export const editorCheckCallback = (_checking: boolean, editor: Editor) =>
  !!findImgurImageUnderCursor(
    editor.getLine(editor.getCursor().line),
    editor.getCursor().ch
  );
