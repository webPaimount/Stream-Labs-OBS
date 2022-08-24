import React, { useEffect } from 'react';
import moment from 'moment';
import cx from 'classnames';
import { useRenderInterval, useVuex } from 'components-react/hooks';
import { Services } from 'components-react/service-provider';
import Scrollable from 'components-react/shared/Scrollable';
import { ModalLayout } from 'components-react/shared/ModalLayout';
import { INotification } from 'services/notifications';
import { $t } from 'services/i18n';
import styles from './Notifications.m.less';

export default function Notifications() {
  const { NotificationsService } = Services;

  // Re-render every minute to refresh timestamps
  useRenderInterval(() => {}, 60 * 1000);
  useEffect(() => () => NotificationsService.actions.markAllAsRead(), []);

  const { notificationGroups, notificationsCount } = useVuex(() => ({
    notificationGroups: {
      unread: NotificationsService.views.getUnread(),
      read: NotificationsService.views.getRead(),
    },
    notificationsCount: NotificationsService.views.getAll().length,
  }));

  function onNotificationClickHandler(id: number) {
    NotificationsService.actions.applyAction(id);
  }

  function momentize(time: number): string {
    return moment(time).fromNow();
  }

  return (
    <ModalLayout bodyStyle={{ paddingBottom: '53px' }}>
      {/* 53px is the default size of antd's Modal component, so we're including the footer and offsetting with padding so that the entire component's content can be seen */}
      {/* Hiding the footer in this instance cuts off some of the component's content */}
      <Scrollable style={{ height: '100%' }}>
        {!notificationsCount && <h4>{$t("You don't have any notifications")}</h4>}

        {Object.keys(notificationGroups).map((groupName: string) => (
          <div key={groupName}>
            {notificationGroups[groupName].length > 0 && (
              <h4>{groupName === 'unread' ? $t('New Notifications') : $t('Log')}</h4>
            )}
            {notificationGroups[groupName].map((notify: INotification) => (
              <div
                key={notify.id}
                onClick={() => onNotificationClickHandler(notify.id)}
                className={cx(styles.notification, {
                  [styles.unread]: notify.unread,
                  [styles.hasAction]: notify.action,
                })}
                data-name={notify.action && 'hasAction'}
              >
                <div className="icon">
                  {notify.type === 'INFO' && <span className="fa fa-info-circle" />}
                  {notify.type === 'WARNING' && <span className="fa fa-warning" />}
                </div>
                <div className="message">{notify.message}</div>
                <div className={styles.date}>{momentize(notify.date)}</div>
              </div>
            ))}
          </div>
        ))}
      </Scrollable>
    </ModalLayout>
  );
}
