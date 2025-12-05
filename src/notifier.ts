import https from 'https';

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

  async sendNotification(siteName: string, url: string): Promise<void> {
    const message = `${siteName}\n\n空きが見つかりました！\n\n${url}`;
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
