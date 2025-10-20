import { HTTPProvider } from "../http";

export class RemoteFileToBase64 {
  constructor(
    private readonly httpProvider: HTTPProvider,
  ) {}

  async convert(url: URL): Promise<string> {
    const blob = await this.httpProvider.get<Blob>(url);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.readAsDataURL(blob);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  }
}
