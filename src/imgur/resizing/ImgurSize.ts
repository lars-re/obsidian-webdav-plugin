export default class ImgurSize {
  private static VALUES: ImgurSize[] = [];

  public static SMALL_SQUARE = new ImgurSize("s", "Small square", "90x90");

  public static BIG_SQUARE = new ImgurSize("b", "Big square", "160x160");

  public static SMALL_THUMBNAIL = new ImgurSize(
    "t",
    "Small Thumbnail",
    "160x160"
  );

  public static MEDIUM_THUMBNAIL = new ImgurSize(
    "m",
    "Medium Thumbnail",
    "320x320"
  );

  public static LARGE_THUMBNAIL = new ImgurSize(
    "l",
    "Large Thumbnail",
    "640x640"
  );

  public static HUGE_THUMBNAIL = new ImgurSize(
    "h",
    "Huge Thumbnail",
    "1024x1024"
  );

  private constructor(
    public readonly suffix: string,
    public readonly description: string,
    public readonly sizeHint: string
  ) {
    ImgurSize.VALUES.push(this);
  }

  public static values() {
    return ImgurSize.VALUES;
  }
}
