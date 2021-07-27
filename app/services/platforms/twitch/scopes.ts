export type TTwitchOAuthScope =
  // New Twitch API
  | 'analytics:read:extensions'
  | 'analytics:read:games'
  | 'bits:read'
  | 'clips:edit'
  | 'user:edit'
  | 'user:edit:broadcast'
  | 'user:read:broadcast'
  | 'channel:manage:polls'
  // Twitch API v5
  | 'channel_check_subscription'
  | 'channel_commercial'
  | 'channel_editor'
  | 'channel_feed_edit'
  | 'channel_feed_read'
  | 'channel_read'
  | 'channel_stream'
  | 'channel_subscriptions'
  | 'chat_login'
  | 'collections_edit'
  | 'communities_edit'
  | 'communities_moderate'
  | 'openid'
  | 'user_blocks_edit'
  | 'user_blocks_read'
  | 'user_follows_edit'
  | 'user_read'
  | 'user_subscriptions'
  | 'viewing_activity_read'
  // Chat and PubSub
  | 'channel:moderate'
  | 'chat:edit'
  | 'chat:read'
  | 'whispers:read'
  | 'whispers:edit';
