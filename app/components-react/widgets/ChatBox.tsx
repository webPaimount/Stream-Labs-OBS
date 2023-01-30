import React from 'react';
import { IWidgetCommonState, useWidget, WidgetModule } from './common/useWidget';
import { WidgetLayout } from './common/WidgetLayout';
import { $t } from '../../services/i18n';
import { metadata } from '../shared/inputs/metadata';
import FormFactory, { TInputValue } from 'components-react/shared/inputs/FormFactory';

interface IChatBoxSettings extends Dictionary<TInputValue> {
  theme: string;
  always_show_messages: boolean;
  message_hide_delay: number;
  message_show_delay: number;
  disable_message_animations: boolean;
  show_platform_icons: boolean;
  show_moderator_icons: boolean;
  show_subscriber_icons: boolean;
  show_turbo_icons: boolean;
  show_premium_icons: boolean;
  show_bits_icons: boolean;
  show_coin_icons: boolean;
  show_bttv_emotes: boolean;
  show_franker_emotes: boolean;
  show_7tv_emotes: boolean;
  text_color: string;
  text_size: number;
  background_color: string;
  hide_common_chat_bots: boolean;
  hide_commands: boolean;
  muted_chatters: string;
}

interface IChatBoxState extends IWidgetCommonState {
  data: {
    settings: IChatBoxSettings;
  };
}

export function ChatBox() {
  const { isLoading, settings, meta, updateSetting } = useChatBox();

  return (
    <WidgetLayout>
      {!isLoading && <FormFactory metadata={meta} values={settings} onChange={updateSetting} />}
    </WidgetLayout>
  );
}

export class ChatBoxModule extends WidgetModule<IChatBoxState> {
  get meta() {
    return {
      theme: metadata.list({
        label: $t('Theme'),
        options: [
          { label: 'Clean', value: 'clean' },
          { label: 'Boxed', value: 'boxed' },
          { label: 'Twitch', value: 'twitch' },
          { label: 'Old School', value: 'oldschool' },
          { label: 'Chunky', value: 'chunky' },
        ],
      }),
      always_show_messages: metadata.switch({ label: $t('Always Show Messages') }),
      message_hide_delay: metadata.seconds({
        label: $t('Hide Delay'),
        min: 0,
        max: 200000,
      }),
      message_show_delay: metadata.seconds({
        label: $t('Chat Delay'),
        min: 0,
        max: 6000,
      }),
      disable_message_animations: metadata.bool({ label: $t('Disable Message Animations') }),
      show_platform_icons: metadata.switch({ label: $t('Show Platform Icons') }),
      show_badges: {
        type: 'checkboxGroup',
        label: $t('Badges'),
        children: {
          show_moderator_icons: metadata.bool({ label: $t('Show Moderator Badges') }),
          show_subscriber_icons: metadata.bool({ label: $t('Show Subscriber Badges') }),
          show_turbo_icons: metadata.bool({ label: $t('Show Turbo Badges') }),
          show_premium_icons: metadata.bool({ label: $t('Show Twitch Prime Badges') }),
          show_bits_icons: metadata.bool({ label: $t('Show Bits Badges') }),
          show_coin_icons: metadata.bool({ label: $t('Show Top Coin Holder Badges') }),
        },
      },
      show_emotes: {
        type: 'checkboxGroup',
        label: $t('Extra Emotes'),
        children: {
          show_bttv_emotes: metadata.bool({ label: $t('Enable BetterTTV Emotes') }),
          show_franker_emotes: metadata.bool({ label: $t('Enable FrankerFaceZ Emotes') }),
          show_7tv_emotes: metadata.bool({ label: $t('Enable 7TV Emotes') }),
        },
      },
      text_color: metadata.color({
        label: $t('Text Color'),
        tooltip: $t('A hex code for the base text color.'),
      }),
      text_size: metadata.fontSize({ label: $t('Font Size'), min: 10, max: 80 }),
      background_color: metadata.color({
        label: $t('Background Color'),
        tooltip: $t(
          'A hex code for the widget background. This is for preview purposes only. It will not be shown in your stream.',
        ),
      }),
      hide_characters: {
        type: 'checkboxGroup',
        label: $t('Hide Characters'),
        children: {
          hide_common_chat_bots: metadata.bool({ label: $t('Hide Common Chat Bots') }),
          hide_commands: metadata.bool({ label: $t('Hide commands starting with `!`') }),
        },
      },
      muted_chatters: metadata.textarea({ label: $t('Muted Chatters') }),
    };
  }

  protected patchBeforeSend(settings: IChatBoxState) {
    // settings.
  }
}

function useChatBox() {
  return useWidget<ChatBoxModule>();
}
