const imgurImageRegexp =
  /(\[)?(!\[[^[\]]*\]\()(https?:\/\/(?:i\.)?imgur\.com\/)(\w+)\.(png|jpe?g|gif)\)(]\(https?:\/\/(?:i\.)?imgur\.com\/\w+\.(?:png|jpe?g|gif)\))?/gm;

const parseImgur = (line: string): IterableIterator<RegExpMatchArray> =>
  line.matchAll(imgurImageRegexp);

export default parseImgur;
