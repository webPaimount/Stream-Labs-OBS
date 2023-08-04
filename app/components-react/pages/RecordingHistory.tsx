import React, { useEffect } from 'react';
import cx from 'classnames';
import * as remote from '@electron/remote';
import { Tooltip, Menu, Button, message, Dropdown } from 'antd';
import { inject, injectState, useModule } from 'slap';
import { $t } from 'services/i18n';
import { ModalLayout } from 'components-react/shared/ModalLayout';
import {
  RecordingModeService,
  UserService,
  SharedStorageService,
  OnboardingService,
  WindowsService,
} from 'app-services';
import styles from './RecordingHistory.m.less';
import AutoProgressBar from 'components-react/shared/AutoProgressBar';
import { GetSLID } from 'components-react/highlighter/StorageUpload';

class RecordingHistoryModule {
  private RecordingModeService = inject(RecordingModeService);
  private UserService = inject(UserService);
  private SharedStorageService = inject(SharedStorageService);
  private OnboardingService = inject(OnboardingService);
  private WindowsService = inject(WindowsService);
  state = injectState({ showSLIDModal: false });

  get recordings() {
    return this.RecordingModeService.views.sortedRecordings;
  }

  get hasYoutube() {
    return this.UserService.views.linkedPlatforms.includes('youtube');
  }

  get hasSLID() {
    return !!this.UserService.views.auth?.slid?.id;
  }

  get uploadInfo() {
    return this.RecordingModeService.state.uploadInfo;
  }

  get uploadOptions() {
    const opts = [
      {
        label: $t('Clip'),
        value: 'crossclip',
        icon: 'icon-crossclip',
      },
      {
        label: $t('Transcribe'),
        value: 'typestudio',
        icon: 'icon-mic',
      },
    ];
    if (this.hasYoutube) {
      opts.unshift({
        label: $t('Upload'),
        value: 'youtube',
        icon: 'icon-youtube',
      });
    }

    return opts;
  }

  connectSLID() {
    this.OnboardingService.actions.start({ isLogin: true });
    this.WindowsService.closeChildWindow();
  }

  handleSelect(filename: string, platform: string) {
    if (this.uploadInfo.uploading) {
      message.error($t('Upload already in progress'), 5);
      return;
    }
    if (platform === 'youtube') return this.uploadToYoutube(filename);
    if (this.hasSLID) {
      this.uploadToStorage(filename, platform);
    } else {
      this.state.setShowSLIDModal(true);
    }
  }

  formattedTimestamp(timestamp: string) {
    return this.RecordingModeService.views.formattedTimestamp(timestamp);
  }

  async uploadToYoutube(filename: string) {
    const id = await this.RecordingModeService.actions.return.uploadToYoutube(filename);
    if (!id) return;
    remote.shell.openExternal(`https://youtube.com/watch?v=${id}`);
  }

  async uploadToStorage(filename: string, platform: string) {
    const id = await this.RecordingModeService.actions.return.uploadToStorage(filename, platform);
    if (!id) return;
    remote.shell.openExternal(this.SharedStorageService.views.getPlatformLink(platform, id));
  }

  showFile(filename: string) {
    remote.shell.showItemInFolder(filename);
  }

  cancelUpload() {
    this.RecordingModeService.actions.cancelUpload();
  }
}

export default function RecordingHistory() {
  const {
    recordings,
    formattedTimestamp,
    showFile,
    uploadOptions,
    handleSelect,
    uploadInfo,
  } = useModule(RecordingHistoryModule);

  useEffect(() => {
    if (
      uploadInfo.error &&
      typeof uploadInfo.error === 'string' &&
      // We don't want to surface unexpected TS errors to the user
      !/TypeError/.test(uploadInfo.error)
    ) {
      message.error(uploadInfo.error, 5);
    }
  }, [uploadInfo.error]);

  function UploadActions(p: { filename: string }) {
    return (
      <span className={styles.actionGroup}>
        {uploadOptions.map(opt => (
          <span
            className={styles.action}
            key={opt.value}
            style={{ color: `var(--${opt.value === 'youtube' ? 'button' : opt.value})` }}
            onClick={() => handleSelect(p.filename, opt.value)}
          >
            <i className={opt.icon} />
            &nbsp;
            <span>{opt.label}</span>
          </span>
        ))}
      </span>
    );
  }

  return (
    <div className={styles.container}>
      <h1>{$t('Recordings')}</h1>
      <div className={styles.recordingsContainer} id="recordingHistory">
        {recordings.map(recording => (
          <div className={styles.recording} key={recording.timestamp}>
            <span style={{ marginRight: '8px' }}>{formattedTimestamp(recording.timestamp)}</span>
            <Tooltip title={$t('Show in folder')}>
              <span onClick={() => showFile(recording.filename)} className={styles.filename}>
                {recording.filename}
              </span>
            </Tooltip>
            {uploadOptions.length > 0 && <UploadActions filename={recording.filename} />}
          </div>
        ))}
      </div>
      <ExportModal />
      <SLIDModal />
    </div>
  );
}

function SLIDModal() {
  const { showSLIDModal, connectSLID } = useModule(RecordingHistoryModule);
  if (!showSLIDModal) return <></>;

  return (
    <div className={styles.modalBackdrop}>
      <ModalLayout
        hideFooter
        wrapperStyle={{
          width: '450px',
          height: '300px',
        }}
        bodyStyle={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <GetSLID onClick={connectSLID} />
      </ModalLayout>
    </div>
  );
}

function ExportModal() {
  const { uploadInfo, cancelUpload } = useModule(RecordingHistoryModule);
  const { uploadedBytes, totalBytes } = uploadInfo;

  if (!uploadedBytes || !totalBytes) return <></>;
  return (
    <div className={styles.modalBackdrop}>
      <ModalLayout
        hideFooter
        wrapperStyle={{
          width: '300px',
          height: '100px',
        }}
        bodyStyle={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <AutoProgressBar percent={uploadedBytes / totalBytes} timeTarget={1000 * 60} />
        <button className="button button--default" onClick={cancelUpload}>
          {$t('Cancel')}
        </button>
      </ModalLayout>
    </div>
  );
}
