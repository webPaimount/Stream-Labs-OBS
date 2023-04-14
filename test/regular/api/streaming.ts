import { TExecutionContext, useWebdriver, test } from '../../helpers/webdriver';
import { getApiClient } from '../../helpers/api-client';
import {
  IStreamingServiceApi,
  EStreamingState,
  ERecordingState,
} from '../../../app/services/streaming/streaming-api';
import { SettingsService } from '../../../app/services/settings';
import { reserveUserFromPool } from '../../helpers/webdriver/user';

useWebdriver({ restartAppAfterEachTest: true });

test('Streaming to Twitch via API', async t => {
  const streamKey = (await reserveUserFromPool(t, 'twitch')).streamKey;
  const client = await getApiClient();
  const streamingService = client.getResource<IStreamingServiceApi>('StreamingService');
  const settingsService = client.getResource<SettingsService>('SettingsService');

  const streamSettings = settingsService.state.Stream.formData;
  streamSettings.forEach(subcategory => {
    subcategory.parameters.forEach(setting => {
      if (setting.name === 'service') setting.value = 'Twitch';
      if (setting.name === 'key') setting.value = streamKey;
    });
  });
  settingsService.setSettings('Stream', streamSettings);

  let streamingStatus = streamingService.getModel().streamingStatus;

  streamingService.streamingStatusChange.subscribe(() => void 0);

  t.is(streamingStatus, EStreamingState.Offline);

  streamingService.toggleStreaming();

  streamingStatus = (await client.fetchNextEvent()).data;
  t.is(streamingStatus, EStreamingState.Starting);

  streamingStatus = (await client.fetchNextEvent()).data;
  t.is(streamingStatus, EStreamingState.Live);

  streamingService.toggleStreaming();

  streamingStatus = (await client.fetchNextEvent()).data;
  t.is(streamingStatus, EStreamingState.Ending);

  streamingStatus = (await client.fetchNextEvent()).data;
  t.is(streamingStatus, EStreamingState.Offline);
});

test('Recording via API', async (t: TExecutionContext) => {
  const client = await getApiClient();
  const streamingService = client.getResource<IStreamingServiceApi>('StreamingService');
  const settingsService = client.getResource<SettingsService>('SettingsService');

  const outputSettings = settingsService.state.Output.formData;
  outputSettings.forEach(subcategory => {
    subcategory.parameters.forEach(setting => {
      if (setting.name === 'FilePath') setting.value = t.context.cacheDir;
    });
  });
  settingsService.setSettings('Output', outputSettings);

  let recordingStatus = streamingService.getModel().recordingStatus;

  streamingService.recordingStatusChange.subscribe(() => void 0);

  t.is(recordingStatus, ERecordingState.Offline);

  streamingService.toggleRecording();

  recordingStatus = (await client.fetchNextEvent()).data;
  t.is(recordingStatus, ERecordingState.Recording);

  streamingService.toggleRecording();

  recordingStatus = (await client.fetchNextEvent()).data;
  t.is(recordingStatus, ERecordingState.Stopping);

  recordingStatus = (await client.fetchNextEvent()).data;
  t.is(recordingStatus, ERecordingState.Offline);
});

test('Stop Recording and Replay Buffer manually', async (t: TExecutionContext) => {
  const streamKey = (await reserveUserFromPool(t, 'twitch')).streamKey;
  const client = await getApiClient();
  const streamingService = client.getResource<IStreamingServiceApi>('StreamingService');
  const settingsService = client.getResource<SettingsService>('SettingsService');

  // set settings
  const streamSettings = settingsService.state.Stream.formData;
  streamSettings.forEach(subcategory => {
    subcategory.parameters.forEach(setting => {
      if (setting.name === 'service') setting.value = 'Twitch';
      if (setting.name === 'key') setting.value = streamKey;
    });
  });
  settingsService.setSettings('Stream', streamSettings);

  const outputSettings = settingsService.state.Output.formData;
  outputSettings.forEach(subcategory => {
    subcategory.parameters.forEach(setting => {
      if (setting.name === 'FilePath') setting.value = t.context.cacheDir;
    });
  });
  settingsService.setSettings('Output', outputSettings);

  const generalSettings = settingsService.state.General.formData;
  generalSettings.forEach(subcategory => {
    subcategory.parameters.forEach(setting => {
      if (
        [
          'KeepRecordingWhenStreamStops',
          'RecordWhenStreaming',
          'ReplayBufferWhileStreaming',
          'KeepReplayBufferStreamStops',
        ].includes(setting.name)
      ) {
        setting.value = true;
      }
    });
  });
  settingsService.setSettings('General', generalSettings);

  //

  let streamingStatus = streamingService.getModel().streamingStatus;
  let recordingStatus = streamingService.getModel().recordingStatus;

  streamingService.streamingStatusChange.subscribe(() => void 0);
  streamingService.recordingStatusChange.subscribe(() => void 0);

  t.is(recordingStatus, ERecordingState.Offline);
  t.is(streamingStatus, EStreamingState.Offline);

  streamingService.toggleStreaming();

  streamingStatus = (await client.fetchNextEvent()).data;
  t.is(streamingStatus, EStreamingState.Starting);

  streamingStatus = (await client.fetchNextEvent()).data;
  t.is(streamingStatus, EStreamingState.Live);

  streamingService.toggleStreaming();

  streamingStatus = (await client.fetchNextEvent()).data;
  t.is(streamingStatus, EStreamingState.Ending);

  streamingStatus = (await client.fetchNextEvent()).data;
  t.is(streamingStatus, EStreamingState.Offline);

  //

  // let recordingStatus = streamingService.getModel().recordingStatus;

  // streamingService.recordingStatusChange.subscribe(() => void 0);

  t.is(recordingStatus, ERecordingState.Offline);

  streamingService.toggleRecording();

  recordingStatus = (await client.fetchNextEvent()).data;
  t.is(recordingStatus, ERecordingState.Recording);

  streamingService.toggleRecording();

  recordingStatus = (await client.fetchNextEvent()).data;
  t.is(recordingStatus, ERecordingState.Stopping);

  recordingStatus = (await client.fetchNextEvent()).data;
  t.is(recordingStatus, ERecordingState.Offline);
});
