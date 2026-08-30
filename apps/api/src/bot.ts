import https from 'https';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8767648346:AAG3iz8Wsx50gG_9nB_hwW7bxotkwWV8KxQ';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

let lastUpdateId = 0;

// Shared active OTP store in single process memory
export const activeOtps = new Map<string, { phone: string; name: string; chatId: number; createdAt: number }>();

function callTelegramApi(method: string, data: Record<string, any>): Promise<any> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const url = new URL(`${TELEGRAM_API}/${method}`);

    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

export async function startTelegramBotPolling() {
  console.log('🤖 Telegram Bot Polling started for @microstore21_bot (Unified Memory)...');

  const poll = async () => {
    try {
      const response = await callTelegramApi('getUpdates', {
        offset: lastUpdateId + 1,
        timeout: 5,
      });

      if (response && response.ok && Array.isArray(response.result)) {
        for (const update of response.result) {
          lastUpdateId = update.update_id;

          if (!update.message) continue;

          const chatId = update.message.chat.id;
          const senderName = update.message.from?.first_name || 'Foydalanuvchi';

          // Flow A: User sent contact (Phone number)
          if (update.message.contact) {
            const phoneNumber = update.message.contact.phone_number;
            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

            console.log(`📱 Contact received from ${senderName} (${chatId}): ${formattedPhone}`);

            // Generate 4-digit OTP Code
            const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

            // Save active OTP into shared memory
            activeOtps.set(otpCode, {
              phone: formattedPhone,
              name: senderName,
              chatId,
              createdAt: Date.now(),
            });

            const replyText = `✅ Telefon raqamingiz tasdiqlandi: <b>${formattedPhone}</b>\n\n🔑 Sizning 4-xonali verifikatsiya kodingiz:\n\n👉 <b>${otpCode}</b> 👈\n\nUshbu kodni MicroStore ilovasiga kiriting.`;

            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: replyText,
              parse_mode: 'HTML',
              reply_markup: {
                remove_keyboard: true,
              },
            });

            console.log(`✅ Active OTP Code ${otpCode} registered for ${senderName} (${formattedPhone})`);
            continue;
          }

          // Flow B: User sent /start or text message -> Request Phone Number via Keyboard Button
          if (update.message.text) {
            const text = update.message.text.trim();
            console.log(`📩 Telegram msg from ${senderName} (${chatId}): ${text}`);

            const promptText = `👋 Xush kelibsiz, <b>${senderName}</b>!\n\nMicroStore ilovasiga kirish uchun quyidagi <b>"📱 Telefon raqamni yuborish"</b> tugmasini bosib telefon raqamingizni yuboring.`;

            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: promptText,
              parse_mode: 'HTML',
              reply_markup: {
                keyboard: [
                  [
                    {
                      text: '📱 Telefon raqamni yuborish',
                      request_contact: true,
                    },
                  ],
                ],
                resize_keyboard: true,
                one_time_keyboard: true,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error('Telegram polling error:', error);
    } finally {
      setTimeout(poll, 1000);
    }
  };

  poll();
}
