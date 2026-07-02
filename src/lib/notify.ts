import { supabase, type NotificationType } from './supabase';

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
) {
  try {
    await supabase.rpc('create_notification', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_message: message,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Failed to create notification:', err);
  }
}
