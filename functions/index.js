const { Expo } = require('expo-server-sdk');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { initializeApp } = require('firebase-admin/app');

initializeApp();

const firestore = getFirestore();
const expo = new Expo();

function getRecipientTokens(profile) {
  const tokens = Array.isArray(profile.pushTokens)
    ? profile.pushTokens
    : typeof profile.pushToken === 'string'
      ? [profile.pushToken]
      : [];

  return tokens.filter((token) => typeof token === 'string' && Expo.isExpoPushToken(token));
}

async function getRecipientProfiles(message) {
  if (typeof message.recipientId === 'string' && message.recipientId !== message.senderId) {
    const recipient = await firestore.collection('users').doc(message.recipientId).get();
    if (!recipient.exists || !['OWNER', 'USER'].includes(recipient.data().role)) return [];
    return [recipient];
  }

  const users = await firestore.collection('users').get();
  return users.docs.filter((profile) => {
    const data = profile.data();
    return profile.id !== message.senderId && ['OWNER', 'USER'].includes(data.role);
  });
}

exports.notifyNewChatMessage = onDocumentCreated('messages/{messageId}', async (event) => {
  const message = event.data?.data();
  if (!message || typeof message.senderId !== 'string' || typeof message.text !== 'string' || !message.text.trim()) return;

  const recipients = await getRecipientProfiles(message);
  const tokenOwners = new Map();
  recipients.forEach((profile) => {
    getRecipientTokens(profile.data()).forEach((token) => {
      tokenOwners.set(token, profile);
    });
  });
  const tokens = [...tokenOwners.keys()];
  if (!tokens.length) return;

  const notificationMessages = tokens.map((to) => ({
    to,
    sound: 'default',
    title: `Message from ${message.senderName || 'your private world'}`,
    body: message.text.trim().slice(0, 180),
    data: { screen: 'chat', messageId: event.params.messageId },
    channelId: 'chat-messages',
  }));

  const chunks = expo.chunkPushNotifications(notificationMessages);
  const invalidTokensByProfile = new Map();

  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          const token = chunk[index].to;
          const owner = tokenOwners.get(token);
          if (owner) {
            const invalidTokens = invalidTokensByProfile.get(owner.id) || [];
            invalidTokens.push(token);
            invalidTokensByProfile.set(owner.id, invalidTokens);
          }
        }
      });
    } catch (error) {
      console.error('Expo push notification batch failed', { error });
    }
  }

  await Promise.all([...invalidTokensByProfile.entries()].map(([uid, invalidTokens]) =>
    (() => {
      const profile = recipients.find((candidate) => candidate.id === uid);
      const data = profile?.data() || {};
      const update = { pushTokens: FieldValue.arrayRemove(...invalidTokens) };
      if (invalidTokens.includes(data.pushToken)) update.pushToken = FieldValue.delete();
      return firestore.collection('users').doc(uid).update(update);
    })(),
  ));
});
