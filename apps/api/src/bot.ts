import https from 'https';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8767648346:AAG3iz8Wsx50gG_9nB_hwW7bxotkwWV8KxQ';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

let lastUpdateId = 0;
let latestChatId: number | null = null;

// Shared active OTP store in single process memory
export const activeOtps = new Map<string, { phone: string; name: string; chatId: number; createdAt: number }>();

export function getLatestChatId(): number | null {
  return latestChatId;
}

export async function sendTelegramNotification(chatId: number | string, message: string): Promise<any> {
  return callTelegramApi('sendMessage', {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
  });
}

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

// Shared map for pending store invitations (chatId -> storeId)
export const pendingStoreInvites = new Map<number, { storeId: string; role: string }>();

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
          latestChatId = chatId;
          const senderName = update.message.from?.first_name || 'Foydalanuvchi';

          // Flow A: User sent contact (Phone number)
          if (update.message.contact) {
            const phoneNumber = update.message.contact.phone_number;
            const formattedPhone = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

            console.log(`📱 Contact received from ${senderName} (${chatId}): ${formattedPhone}`);

            // Generate 4-digit OTP Code
            const otpCode = Math.floor(1000 + Math.random() * 9000).toString();

            // Check if seller was invited to a specific store
            const invitedStore = pendingStoreInvites.get(chatId);
            let userRecord = registeredUsers.get(formattedPhone);
            let replyText = '';

            if (invitedStore) {
              const targetStoreId = invitedStore.storeId;
              if (!userRecord) {
                userRecord = {
                  id: `cashier-${Date.now()}`,
                  phone: formattedPhone,
                  name: senderName,
                  role: 'cashier',
                  storeId: targetStoreId,
                  chatId: chatId,
                };
              } else {
                userRecord.storeId = targetStoreId;
                userRecord.role = 'cashier';
                userRecord.chatId = chatId;
              }
              registeredUsers.set(formattedPhone, userRecord);

              console.log(`🎉 User ${senderName} (${formattedPhone}) auto-assigned to Store ID: ${targetStoreId} as role: cashier`);

              replyText = `✅ Siz do'konga sotuvchi sifatida qo'shildingiz! Endi saytga kirib o'z telefon raqamingiz orqali avtorizatsiyadan o'ting.\n\n🔑 Sizning 4-xonali kiring kodingiz:\n\n👉 <b>${otpCode}</b> 👈`;
              pendingStoreInvites.delete(chatId);
            } else {
              if (!userRecord) {
                userRecord = {
                  id: `owner-${Date.now()}`,
                  phone: formattedPhone,
                  name: senderName,
                  role: 'owner',
                  storeId: 'store_main',
                  chatId: chatId,
                };
                registeredUsers.set(formattedPhone, userRecord);
              }
              replyText = `✅ Telefon raqamingiz tasdiqlandi: <b>${formattedPhone}</b>\n\n🔑 Sizning 4-xonali verifikatsiya kodingiz:\n\n👉 <b>${otpCode}</b> 👈\n\nUshbu kodni MicroStore ilovasiga kiriting.`;
            }

            // Save active OTP into shared memory
            activeOtps.set(otpCode, {
              phone: formattedPhone,
              name: userRecord.name,
              chatId,
              role: userRecord.role,
              storeId: userRecord.storeId,
              createdAt: Date.now(),
            });

            await callTelegramApi('sendMessage', {
              chat_id: chatId,
              text: replyText,
              parse_mode: 'HTML',
              reply_markup: {
                remove_keyboard: true,
              },
            });

            console.log(`✅ Active OTP Code ${otpCode} registered for ${senderName} (${formattedPhone}) [role: ${userRecord.role}]`);
            continue;
          }

          // Flow B: User sent /start or text message -> Check Deep Link Invite Parameters
          if (update.message.text) {
            const text = update.message.text.trim();
            console.log(`📩 Telegram msg from ${senderName} (${chatId}): ${text}`);

            let promptText = '';

            // Check if start command contains invite parameter: /start invite_store_123 or /start cashier_store_123
            if (text.startsWith('/start invite_store_') || text.startsWith('/start cashier_store_')) {
              const storeId = text.replace('/start invite_store_', '').replace('/start cashier_store_', '').trim();
              pendingStoreInvites.set(chatId, { storeId, role: 'cashier' });

              console.log(`📥 Seller ${senderName} (${chatId}) initiated invite for Store: ${storeId}`);

              promptText = `👋 Xush kelibsiz, <b>${senderName}</b>!\n\nSiz <b>MicroStore</b> do'koniga <b>sotuvchi (kassir)</b> sifatida taklif qilindingiz. 🏪\n\nDo'konga biriktirishni yakunlash va telefoningizni tasdiqlash uchun pastdagi <b>"📱 Telefon raqamni yuborish"</b> tugmasini bosing.`;
            } else {
              promptText = `👋 Xush kelibsiz, <b>${senderName}</b>!\n\nMicroStore ilovasiga kirish uchun quyidagi <b>"📱 Telefon raqamni yuborish"</b> tugmasini bosib telefon raqamingizni yuboring.`;
            }

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
