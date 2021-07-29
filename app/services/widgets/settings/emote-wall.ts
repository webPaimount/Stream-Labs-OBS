import {
  IWidgetData,
  IWidgetSettings,
  WidgetDefinitions,
  WidgetSettingsService,
  WidgetType,
} from 'services/widgets';
import { WIDGET_INITIAL_STATE } from './widget-settings';
import { InheritMutations } from 'services/core/stateful-service';
import { formMetadata, metadata } from 'components/shared/inputs';
import { $t } from 'services/i18n';

export interface IEmoteWallSettings extends IWidgetSettings {
  combo_count: number;
  combo_required: boolean;
  combo_timeframe: number; // milliseconds
  emote_animation_duration: number; // milliseconds
  emote_scale: number;
  enabled: boolean;
  ignore_duplicates: boolean;
}

export interface IEmoteWallData extends IWidgetData {
  settings: IEmoteWallSettings;
}

@InheritMutations()
export class PollService extends WidgetSettingsService<IEmoteWallData> {
  static initialState = WIDGET_INITIAL_STATE;

  getApiSettings() {
    return {
      type: WidgetType.EmoteWall,
      url: WidgetDefinitions[WidgetType.Poll].url(this.getHost(), this.getWidgetToken()),
      previewUrl: `https://${this.getHost()}/widgets/emotewall/${this.getWidgetToken()}?simulate=1`,
      dataFetchUrl: `https://${this.getHost()}/api/v5/slobs/widget/emote-wall`,
      settingsSaveUrl: `https://${this.getHost()}/api/v5/slobs/widget/emote-wall`,
      settingsUpdateEvent: 'emoteWallSettingsUpdate',
      customCodeAllowed: true,
      customFieldsAllowed: true,
      hasTestButtons: true,
    };
  }

  getMetadata() {
    return formMetadata({
      enabled: metadata.toggle({ title: $t('Enabled') }),
      duration: metadata.slider({ title: $t('Duration'), min: 1, max: 60 }),
      scale: metadata.slider({ title: $t('Title'), min: 1, max: 10 }),
      comboRequired: metadata.toggle({ title: $t('Combo Required') }),
      comboCount: metadata.slider({ title: $t('Combo Count'), min: 2, max: 100 }),
      comboTimeframe: metadata.slider({ title: $t('Combo Timeframe'), min: 1, max: 60 }),
      ignoreDuplicates: metadata.toggle({ title: $t('Ignore Duplicates') }),
    });
  }
}
