import React, { useEffect, useState } from 'react';
import { TPlatform } from 'services/platforms';
import { useModule } from 'slap';
import { LoginModule } from './Connect';
import styles from './Connect.m.less';
import cx from 'classnames';
import PlatformLogo from 'components-react/shared/PlatformLogo';
import commonStyles from './Common.m.less';
import { $t } from 'services/i18n';
import { confirmAsync } from 'components-react/modals';
import Form from 'components-react/shared/inputs/Form';
import { ListInput } from 'components-react/shared/inputs';
import { Button } from 'antd';
import { Services } from 'components-react/service-provider';
import { useVuex, useWatchVuex } from 'components-react/hooks';

export function PrimaryPlatformSelect() {
  const { UserService } = Services;
  const { linkedPlatforms } = useVuex(() => ({
    linkedPlatforms: UserService.views.linkedPlatforms,
  }));
  const { loading, authInProgress, authPlatform, finishSLAuth } = useModule(LoginModule);
  const platforms = ['twitch', 'youtube', 'facebook', 'trovo'];
  const platformOptions = [
    {
      value: 'twitch',
      label: 'Twitch',
      image: <PlatformLogo platform="twitch" />,
    },
    {
      value: 'youtube',
      label: 'YouTube',
      image: <PlatformLogo platform="youtube" />,
    },
    {
      value: 'facebook',
      label: 'Facebook',
      image: <PlatformLogo platform="facebook" />,
    },
    {
      value: 'trovo',
      label: 'Trovo',
      image: <PlatformLogo platform="trovo" size={14} />,
    },
  ].filter(opt => {
    return linkedPlatforms.includes(opt.value as TPlatform);
  });
  const [selectedPlatform, setSelectedPlatform] = useState(
    platformOptions.length ? platformOptions[0].value : '',
  );

  // There's probably a better way to do this
  useEffect(() => {
    if (linkedPlatforms.length) {
      setSelectedPlatform(linkedPlatforms[0]);
    }
  }, [linkedPlatforms.length]);

  // You may be confused why this component doesn't ever call `next()` to
  // continue to the next step.  The index-based step system makes this more
  // complex than it needs to be.  Basically, the only way to see this step
  // is by being in the `isPartialSLAuth` state.  The only way to move past
  // this step is to get out of the `isPartialSLAuth` state, which will cause
  // this step to disappear from the flow, and we don't need to increment the
  // step counter.

  async function afterLogin(platform: TPlatform) {
    await finishSLAuth(platform);
  }

  async function onSkip() {
    const result = await confirmAsync({
      title: $t('Log Out?'),
      content: $t(
        'Streamlabs Desktop requires that you have a connected streaming account in order to use all of its features. By skipping this step, you will be logged out and some features may be unavailable.',
      ),
      okText: $t('Log Out'),
    });

    if (result) {
      await finishSLAuth();
    }
  }

  async function selectPrimary() {
    if (!selectedPlatform) return;

    await finishSLAuth(selectedPlatform as TPlatform);
  }

  if (linkedPlatforms.length) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.container}>
          <h1 className={commonStyles.titleContainer}>{$t('Select a Primary Platform')}</h1>
          <p style={{ marginBottom: 30, maxWidth: 400, textAlign: 'center' }}>
            {$t(
              'Your Streamlabs account has multiple connected streaming platforms. Please select the primary platform you will be streaming to using Streamlabs Desktop.',
            )}
          </p>
          <Form layout="inline" style={{ width: 300 }}>
            <ListInput
              style={{ width: '100%' }}
              onChange={setSelectedPlatform}
              allowClear={false}
              value={selectedPlatform}
              hasImage={true}
              options={platformOptions}
            />
          </Form>
          <div style={{ width: 400, marginTop: 30, textAlign: 'center' }}>
            <Button type="primary" disabled={loading} onClick={selectPrimary}>
              {loading && <i className="fas fa-spinner fa-spin" />}
              {$t('Continue')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.container}>
        <h1 className={commonStyles.titleContainer}>{$t('Connect a Streaming Platform')}</h1>
        <p style={{ marginBottom: 80 }}>
          {$t(
            'Streamlabs Desktop requires you to connect a streaming platform to your Streamlabs account',
          )}
        </p>
        <div className={styles.signupButtons}>
          {platforms.map((platform: TPlatform) => (
            <button
              className={cx(`button button--${platform}`, styles.loginButton)}
              disabled={loading || authInProgress}
              onClick={() => authPlatform(platform, () => afterLogin(platform), true)}
              key={platform}
            >
              {loading && <i className="fas fa-spinner fa-spin" />}
              {!loading && (
                <PlatformLogo
                  platform={platform}
                  size="medium"
                  color={platform === 'trovo' ? 'black' : 'white'}
                />
              )}
            </button>
          ))}
        </div>
        <p>
          <br />
          <span className={styles['link-button']} onClick={onSkip}>
            {$t('Skip')}
          </span>
        </p>
      </div>
    </div>
  );
}
