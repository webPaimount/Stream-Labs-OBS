import React from 'react';
import InputWrapper from '../../shared/inputs/InputWrapper';
import { Services } from '../../service-provider';
import { $t } from '../../../services/i18n';
import { Button } from 'antd';
import { useGoLiveSettings } from './useGoLiveSettings';
import { injectWatch } from 'slap';
import { TwitterOutlined } from '@ant-design/icons';
import * as remote from '@electron/remote';

const TwitterIcon = TwitterOutlined as Function;

export default function TwitterInput() {
  const { TwitterService, UserService } = Services;
  const { tweetText } = useGoLiveSettings().extend(module => {
    function getTwitterState() {
      return {
        streamTitle: module.state.commonFields.title,
      };
    }

    return {
      get streamTitle() {
        return module.state.commonFields.title;
      },

      get platform() {
        return UserService.views.platform?.type;
      },

      get url() {
        return TwitterService.views.url;
      },

      tweetTextWatch: injectWatch(getTwitterState, () => {
        const tweetText = module.getTweetText(getTwitterState().streamTitle);
        module.updateSettings({ tweetText });
      }),
    };
  });

  const openTweetIntent = () =>
    remote.shell.openExternal(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText || '')}`,
    );

  return (
    <InputWrapper label={$t('Share Your Stream')}>
      <Button icon={<TwitterIcon />} onClick={openTweetIntent}>
        {$t('Tweet')}
      </Button>
    </InputWrapper>
  );
}
