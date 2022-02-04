import { IMGUR_API_BASE } from "src/imgur/constants";
import { ImgurPostData } from "../../imgur/imgurResponseTypes";
import ImageUploader from "../ImageUploader";
import { handleImgurErrorResponse } from "../../imgur/ImgurClient";

export default class ImgurAnonymousUploader implements ImageUploader {
  private readonly clientId!: string;

  constructor(clientId: string) {
    this.clientId = clientId;
  }

  async upload(): Promise<string> {
    return Promise.resolve("https://i.imgur.com/m3RpPCV.png");
  }
}
