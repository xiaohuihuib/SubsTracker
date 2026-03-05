import { getConfig, setConfig } from '../../data/config.js';
import { generateRandomSecret, sanitizeNotificationHours } from '../utils.js';

const SECRET_MASK = '********';
const SECRET_FIELDS = [
  'TG_BOT_TOKEN',
  'NOTIFYX_API_KEY',
  'WEBHOOK_URL',
  'WEBHOOK_HEADERS',
  'WECHATBOT_WEBHOOK',
  'RESEND_API_KEY',
  'BARK_DEVICE_KEY',
  'THIRD_PARTY_API_TOKEN'
];

function maskSecrets(config) {
  const masked = { ...config };
  SECRET_FIELDS.forEach((key) => {
    const value = masked[key];
    masked[key] = (typeof value === 'string' && value.trim().length > 0) ? SECRET_MASK : '';
  });
  return masked;
}

function mergeSecretField(existingConfig, newConfig, key) {
  const incoming = newConfig?.[key];
  if (typeof incoming !== 'string') return existingConfig?.[key] || '';

  const trimmed = incoming.trim();
  // 前端回显会用 ******** 作为占位，表示"不修改"
  if (trimmed === SECRET_MASK) return existingConfig?.[key] || '';

  // 允许显式清空（trim 后为空字符串）
  return trimmed;
}

async function handleGetConfig(env) {
  const config = await getConfig(env);

  // 绝不把真实密钥/令牌下发到浏览器
  const { JWT_SECRET, ADMIN_PASSWORD, ...safeConfig } = config;
  return new Response(
    JSON.stringify(maskSecrets(safeConfig)),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleUpdateConfig(request, env) {
  try {
    const config = await getConfig(env);
    const newConfig = await request.json();

    const updatedConfig = {
      ...config,
      ADMIN_USERNAME: newConfig.ADMIN_USERNAME || config.ADMIN_USERNAME,
      THEME_MODE: newConfig.THEME_MODE || 'system',

      TG_BOT_TOKEN: mergeSecretField(config, newConfig, 'TG_BOT_TOKEN'),
      TG_CHAT_ID: newConfig.TG_CHAT_ID || '',

      NOTIFYX_API_KEY: mergeSecretField(config, newConfig, 'NOTIFYX_API_KEY'),

      WEBHOOK_URL: mergeSecretField(config, newConfig, 'WEBHOOK_URL'),
      WEBHOOK_METHOD: newConfig.WEBHOOK_METHOD || 'POST',
      WEBHOOK_HEADERS: mergeSecretField(config, newConfig, 'WEBHOOK_HEADERS'),
      WEBHOOK_TEMPLATE: newConfig.WEBHOOK_TEMPLATE || '',

      SHOW_LUNAR: newConfig.SHOW_LUNAR === true,

      WECHATBOT_WEBHOOK: mergeSecretField(config, newConfig, 'WECHATBOT_WEBHOOK'),
      WECHATBOT_MSG_TYPE: newConfig.WECHATBOT_MSG_TYPE || 'text',
      WECHATBOT_AT_MOBILES: newConfig.WECHATBOT_AT_MOBILES || '',
      WECHATBOT_AT_ALL: newConfig.WECHATBOT_AT_ALL || 'false',

      RESEND_API_KEY: mergeSecretField(config, newConfig, 'RESEND_API_KEY'),
      EMAIL_FROM: newConfig.EMAIL_FROM || '',
      EMAIL_FROM_NAME: newConfig.EMAIL_FROM_NAME || '',
      EMAIL_TO: newConfig.EMAIL_TO || '',

      BARK_DEVICE_KEY: mergeSecretField(config, newConfig, 'BARK_DEVICE_KEY'),
      BARK_SERVER: newConfig.BARK_SERVER || 'https://api.day.app',
      BARK_IS_ARCHIVE: newConfig.BARK_IS_ARCHIVE || 'false',

      ENABLED_NOTIFIERS: newConfig.ENABLED_NOTIFIERS || ['notifyx'],
      TIMEZONE: newConfig.TIMEZONE || config.TIMEZONE || 'UTC',

      THIRD_PARTY_API_TOKEN: mergeSecretField(config, newConfig, 'THIRD_PARTY_API_TOKEN'),

      DEBUG_LOGS: newConfig.DEBUG_LOGS === true,
      PAYMENT_HISTORY_LIMIT: Number.isFinite(Number(newConfig.PAYMENT_HISTORY_LIMIT))
        ? Math.min(1000, Math.max(10, Math.floor(Number(newConfig.PAYMENT_HISTORY_LIMIT))))
        : (config.PAYMENT_HISTORY_LIMIT || 100)
    };

    updatedConfig.NOTIFICATION_HOURS = sanitizeNotificationHours(newConfig.NOTIFICATION_HOURS);

    if (newConfig.ADMIN_PASSWORD) {
      updatedConfig.ADMIN_PASSWORD = newConfig.ADMIN_PASSWORD;
    }

    if (!updatedConfig.JWT_SECRET || updatedConfig.JWT_SECRET === 'your-secret-key') {
      updatedConfig.JWT_SECRET = generateRandomSecret();
      console.log('[安全] 生成新的JWT密钥');
    }

    await setConfig(env, updatedConfig);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('配置保存错误:', error);
    return new Response(
      JSON.stringify({ success: false, message: '更新配置失败: ' + error.message }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export { SECRET_MASK, handleGetConfig, handleUpdateConfig };
