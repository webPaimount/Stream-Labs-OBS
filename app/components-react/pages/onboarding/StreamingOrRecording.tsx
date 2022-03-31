import { Button, Tooltip } from 'antd';
import { useModule } from 'components-react/hooks/useModule';
import KevinSvg from 'components-react/shared/KevinSvg';
import React, { useState } from 'react';
import { $t } from 'services/i18n';
import { $i } from 'services/utils';
import styles from './StreamingOrRecording.m.less';
import commonStyles from './Common.m.less';
import ObsSvg from './ObsSvg';
import { OnboardingModule } from './Onboarding';
import cx from 'classnames';

export function StreamingOrRecording() {
  const { setImportFromObs, next } = useModule(OnboardingModule).select();
  const [active, setActive] = useState<'streaming' | 'recording' | null>(null);

  return (
    <div>
      <div className={styles.footer}>
        <SvgBackground />
        <img src={$i('images/onboarding/splash.png')} />
      </div>
      <div className={styles.titleContainer}>
        <h1 className={styles.title}>{$t('Welcome to Streamlabs')}</h1>
        <h3 className={styles.subtitle}>{$t('How do you plan to use Streamlabs Desktop?')}</h3>
        <div className={styles.optionContainer}>
          <div
            className={cx(styles.option, { [styles.active]: active === 'streaming' })}
            onClick={() => setActive('streaming')}
          >
            <i className="icon-broadcast"></i>
            <h2>{$t('Live Streaming')}</h2>
            <p className={styles.optionDescription}>
              {$t(
                'I want to live stream to a platform. I may also want to record my live streams.',
              )}
            </p>
          </div>
          <div
            className={cx(styles.option, { [styles.active]: active === 'recording' })}
            onClick={() => setActive('recording')}
          >
            <i className="icon-studio"></i>
            <h2>{$t('Recording Only')}</h2>
            <p className={styles.optionDescription}>
              {$t('I want to record my screen or camera. I will not be live streaming.')}
            </p>
          </div>
        </div>
        <div className={cx(styles.buttonContainer, { [styles.active]: active })}>
          <Button
            type="primary"
            shape="round"
            style={{ width: 200, height: 60, fontSize: 16 }}
            disabled={!active}
          >
            {$t('Continue')}
          </Button>
        </div>
      </div>
    </div>
  );
}

const SvgBackground = () => (
  <svg width="100%" height="100%" viewBox="0 0 1083 720" xmlns="http://www.w3.org/2000/svg">
    <path d="M918.999 140.5C971.667 9.75951 1187.91 -68.6629 1230.5 -54.9996L1253.58 124.762L1253.58 819.511L-0.000563148 726C81.0237 473.471 374.649 724.719 519 457C604.999 297.5 776.499 494.238 918.999 140.5Z" />
  </svg>
);
