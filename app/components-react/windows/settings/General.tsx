import React, { useState } from 'react';
import { ObsGenericSettingsForm, ObsSettingsSection } from './ObsSettings';
import { $t, I18nService } from '../../../services/i18n';
import { alertAsync, confirmAsync } from '../../modals';
import { CheckboxInput, ListInput } from '../../shared/inputs';
import { Services } from '../../service-provider';
import fs from 'fs';
import path from 'path';
import { getDefined } from '../../../util/properties-type-guards';
import { useVuex } from 'components-react/hooks';

export function GeneralSettings() {
  return (
    <div>
      <LanguageSettings />
      <ExtraSettings />
      <ObsGenericSettingsForm />
    </div>
  );
}

GeneralSettings.page = 'General';

function LanguageSettings() {
  const i18nService = I18nService.instance as I18nService;
  const localeOptions = i18nService.state.localeList;
  const currentLocale = i18nService.state.locale;

  async function save(lang: string) {
    if (!(await confirmAsync('This action will restart the application. Continue?'))) {
      return;
    }
    i18nService.actions.setLocale(lang);
  }

  return (
    <ObsSettingsSection>
      <ListInput options={localeOptions} label={'Language'} onChange={save} value={currentLocale} />
    </ObsSettingsSection>
  );
}

function ExtraSettings() {
  const {
    UserService,
    StreamingService,
    StreamSettingsService,
    CustomizationService,
    AppService,
    OnboardingService,
    WindowsService,
    StreamlabelsService,
    RecordingModeService,
    SettingsService,
    DualOutputService,
  } = Services;
  const isLoggedIn = UserService.isLoggedIn;
  const isTwitch = isLoggedIn && getDefined(UserService.platform).type === 'twitch';
  const isFacebook = isLoggedIn && getDefined(UserService.platform).type === 'facebook';
  const isYoutube = isLoggedIn && getDefined(UserService.platform).type === 'youtube';
  const protectedMode = StreamSettingsService.state.protectedModeEnabled;
  const disableHAFilePath = path.join(AppService.appDataDirectory, 'HADisable');
  const [disableHA, setDisableHA] = useState(() => fs.existsSync(disableHAFilePath));

  const {
    isRecordingOrStreaming,
    recordingMode,
    updateStreamInfoOnLive,
    isSimpleOutputMode,
  } = useVuex(() => ({
    isRecordingOrStreaming: StreamingService.isStreaming || StreamingService.isRecording,
    recordingMode: RecordingModeService.views.isRecordingModeEnabled,
    updateStreamInfoOnLive: CustomizationService.state.updateStreamInfoOnLive,
    isSimpleOutputMode: SettingsService.views.isSimpleOutputMode,
  }));

  /**
   * Temporarily disable optimizer until migrated to the new API
   */
  const canRunOptimizer = false;
  // const canRunOptimizer =
  // HDR Settings are not compliant with the auto-optimizer
  // !SettingsService.views.hasHDRSettings &&
  // isTwitch &&
  // !isRecordingOrStreaming &&
  // protectedMode &&
  // isSimpleOutputMode;

  function restartStreamlabelsSession() {
    StreamlabelsService.restartSession().then(result => {
      if (result) {
        alertAsync($t('Stream Labels session has been successfully restarted!'));
      }
    });
  }

  function runAutoOptimizer() {
    OnboardingService.actions.start({ isOptimize: true });
    WindowsService.actions.closeChildWindow();
  }

  function configureDefaults() {
    OnboardingService.actions.start({ isHardware: true });
    WindowsService.actions.closeChildWindow();
  }

  function importFromObs() {
    OnboardingService.actions.start({ isImport: true });
    WindowsService.actions.closeChildWindow();
  }

  function disableHardwareAcceleration(val: boolean) {
    try {
      if (val) {
        // Touch the file
        fs.closeSync(fs.openSync(disableHAFilePath, 'w'));
        setDisableHA(true);
      } else {
        fs.unlinkSync(disableHAFilePath);
        setDisableHA(false);
      }
    } catch (e: unknown) {
      console.error('Error setting hardware acceleration', e);
    }
  }

  return (
    <>
      <ObsSettingsSection>
        {isLoggedIn && !isFacebook && !isYoutube && (
          <CheckboxInput
            value={updateStreamInfoOnLive}
            onChange={val => CustomizationService.setUpdateStreamInfoOnLive(val)}
            label={$t('Confirm stream title and game before going live')}
            name="stream_info_udpate"
          />
        )}
        <CheckboxInput
          label={$t('Disable hardware acceleration (requires restart)')}
          value={disableHA}
          onChange={disableHardwareAcceleration}
          name="disable_ha"
        />
        <CheckboxInput
          label={$t('Disable live streaming features (Recording Only mode)')}
          value={recordingMode}
          onChange={RecordingModeService.actions.setRecordingMode}
        />

        <div className="actions">
          <div className="input-container">
            <button className="button button--default" onClick={restartStreamlabelsSession}>
              {$t('Restart Stream Labels')}
            </button>
          </div>
        </div>
      </ObsSettingsSection>

      <ObsSettingsSection>
        <div className="actions">
          <div className="input-container">
            <button className="button button--default" onClick={configureDefaults}>
              {$t('Configure Default Devices')}
            </button>
          </div>
          {canRunOptimizer && (
            <div className="input-container">
              <button className="button button--default" onClick={runAutoOptimizer}>
                {$t('Auto Optimize')}
              </button>
            </div>
          )}

          <div className="input-container">
            <button className="button button--default" onClick={importFromObs}>
              {$t('OBS Import')}
            </button>
          </div>
        </div>
      </ObsSettingsSection>
    </>
  );
}
