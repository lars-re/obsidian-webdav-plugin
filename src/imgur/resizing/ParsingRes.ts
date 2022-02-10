const IMGUR_IMAGE_ID_LENGTH = 7;

export default class ParsingRes {
  readonly urlPrefix?: string;

  readonly imgPrefix: string;

  readonly imgurhost: string;

  readonly imageId: string;

  readonly imageExt: string;

  readonly urlSuffix?: string;

  readonly startIndex: number;

  readonly endIndex: number;

  constructor(arr: RegExpMatchArray) {
    [
      ,
      this.urlPrefix,
      this.imgPrefix,
      this.imgurhost,
      this.imageId,
      this.imageExt,
      this.urlSuffix,
    ] = arr;
    this.startIndex = arr.index;
    this.endIndex = arr.index + arr[0].length;
    if (!this.isImageIdOfExpectedSize)
      throw Error("Imgur image id is of unexpcted size");
    this.imageId = this.imageId.slice(0, IMGUR_IMAGE_ID_LENGTH);
  }

  private get isImageIdOfExpectedSize() {
    return [7, 8].includes(this.imageId.length);
  }

  get isWrappedWithUrl() {
    return !!this.urlPrefix && !!this.urlSuffix;
  }
}
