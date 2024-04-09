import React from 'react';
import { Tooltip } from 'antd';
import cx from 'classnames';
import { useVuex } from '../hooks';
import { Services } from '../service-provider';
import cloneDeep from 'lodash/cloneDeep';
import styles from './PerformanceMetrics.module.less';
import { $t } from '../../services/i18n';
import { useRealmObject } from 'components-react/hooks/realm';

type TPerformanceMetricsMode = 'full' | 'limited';

export default function PerformanceMetrics(props: {
  mode: TPerformanceMetricsMode;
  className?: string;
}) {
  const { CustomizationService, PerformanceService } = Services;
  const pinnedStats = useRealmObject(CustomizationService.state.pinnedStatistics);

  const stats = useRealmObject(PerformanceService.state);

  function showAttribute(attribute: string) {
    return props.mode === 'full' || pinnedStats[attribute];
  }

  function pinTooltip(stat: string) {
    return props.mode === 'full' ? $t('Click to add %{stat} info to your footer', { stat }) : '';
  }

  function classForStat(stat: string) {
    if (props.mode === 'limited') return '';
    return `clickable ${pinnedStats[stat] ? 'active' : ''}`;
  }

  function updatePinnedStats(key: string, value: boolean) {
    if (props.mode === 'limited') return;
    CustomizationService.actions.setSettings({ pinnedStatistics: { [key]: value } });
  }

  const metadata = {
    cpu: { value: `${stats.cpuPercent}%`, label: $t('CPU'), icon: 'icon-cpu' },
    fps: { value: stats.frameRateFixed, label: 'FPS', icon: 'icon-fps' },
    droppedFrames: {
      value: `${stats.droppedFrames} (${stats.percentDropped}%)`,
      label: $t('Dropped Frames'),
      icon: 'icon-dropped-frames',
    },
    bandwidth: { value: stats.bandwidth, label: 'kb/s', icon: 'icon-bitrate' },
  };

  const shownCells = ['cpu', 'fps', 'droppedFrames', 'bandwidth'].filter((val: string) =>
    showAttribute(val),
  );

  function showLabel(attribute: string) {
    if (attribute !== 'droppedFrames') return true;
    return props.mode === 'full';
  }

  return (
    <div
      className={cx(
        styles.performanceMetrics,
        'performance-metrics',
        'flex flex--center',
        props.className,
      )}
    >
      {shownCells.map(attribute => {
        const data = metadata[attribute];
        return (
          <Tooltip placement="bottom" title={pinTooltip(data.label)} key={attribute}>
            <span
              className={cx(
                styles.performanceMetricWrapper,
                classForStat(attribute),
                'performance-metric-wrapper',
              )}
              onClick={() => updatePinnedStats(attribute, !pinnedStats[attribute])}
            >
              <i className={cx(styles.performanceMetricIcon, data.icon)} />
              <span className={styles.performanceMetric}>
                <span className={styles.performanceMetricValue} role={`metric-${attribute}`}>
                  {data.value}
                </span>
                {showLabel(attribute) && (
                  <span className={styles.performanceMetricLabel}> {data.label}</span>
                )}
              </span>
            </span>
          </Tooltip>
        );
      })}
    </div>
  );
}
