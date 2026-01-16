import https from 'https';
import { ProductInfo } from './types';

interface LineMessage {
  type: 'text';
  text: string;
}

interface LinePushRequest {
  to: string;
  messages: LineMessage[];
}

export class LineNotifier {
  private channelAccessToken: string;
  private userId: string;

  constructor() {
    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const userId = process.env.LINE_USER_ID;

    if (!token) {
      throw new Error('LINE_CHANNEL_ACCESS_TOKEN environment variable is not set');
    }
    if (!userId) {
      throw new Error('LINE_USER_ID environment variable is not set');
    }

    this.channelAccessToken = token;
    this.userId = userId;
  }

  async sendNotification(siteName: string, url: string, availableSlots?: string[]): Promise<void> {
    let message = `🎉 空き枠が見つかりました！\n\n${siteName}`;

    if (availableSlots && availableSlots.length > 0) {
      message += `\n\n📅 空き日程:\n${availableSlots.join('\n')}`;
    }

    message += `\n\n${url}`;
    await this.pushMessage(message);
  }

  async sendProductNotification(siteName: string, products: ProductInfo[]): Promise<void> {
    let message = `🎉 新商品が見つかりました！\n\n${siteName}`;

    if (products.length > 0) {
      message += '\n\n📦 商品:';
      for (const product of products) {
        message += `\n・${product.name}`;
        if (product.url) {
          // 日本語URLをエンコードしてリンク切れを防止
          message += `\n  ${encodeURI(product.url)}`;
        }
      }
    }

    await this.pushMessage(message);
  }

  async sendErrorNotification(siteName: string, errorMessage: string): Promise<void> {
    const message = `[エラー] ${siteName}\n\nチェック中にエラーが発生しました:\n${errorMessage}`;
    await this.pushMessage(message);
  }

  private async pushMessage(text: string): Promise<void> {
    const requestBody: LinePushRequest = {
      to: this.userId,
      messages: [
        {
          type: 'text',
          text,
        },
      ],
    };

    const postData = JSON.stringify(requestBody);

    const options: https.RequestOptions = {
      hostname: 'api.line.me',
      port: 443,
      path: '/v2/bot/message/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.channelAccessToken}`,
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            console.log('LINE notification sent successfully');
            resolve();
          } else {
            reject(new Error(`LINE API error: ${res.statusCode} - ${data}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Failed to send LINE notification: ${error.message}`));
      });

      req.write(postData);
      req.end();
    });
  }
}
