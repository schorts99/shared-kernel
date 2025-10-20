"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RemoteFileToBase64 = void 0;
class RemoteFileToBase64 {
    httpProvider;
    constructor(httpProvider) {
        this.httpProvider = httpProvider;
    }
    async convert(url) {
        const blob = await this.httpProvider.get(url);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onload = () => resolve(reader.result);
            reader.onerror = (error) => reject(error);
        });
    }
}
exports.RemoteFileToBase64 = RemoteFileToBase64;
//# sourceMappingURL=remote-file-to-base64.js.map