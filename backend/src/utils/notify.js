/**
 * Create an in-app notification. `client` can be the global prisma client or a
 * transaction client, so notifications can be written atomically with the change they describe.
 */
export function notify(client, userId, { type, title, message, link = null }) {
  return client.notification.create({ data: { userId, type, title, message, link } });
}
