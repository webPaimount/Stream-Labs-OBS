import { GenericGoalService } from './generic-goal';
import { WIDGET_INITIAL_STATE } from './widget-settings';
import { WidgetType } from 'services/widgets';

import { InheritMutations } from 'services/stateful-service';

@InheritMutations()
export class DonationGoalService extends GenericGoalService {
  static initialState = WIDGET_INITIAL_STATE;

  getApiSettings() {
    return {
      type: WidgetType.DonationGoal,
      url: `https://${this.getHost()}/widgets/donation-goal?token=${this.getWidgetToken()}`,
      previewUrl: `https://${this.getHost()}/widgets/donation-goal?token=${this.getWidgetToken()}`,
      dataFetchUrl: `https://${this.getHost()}/api/v5/slobs/widget/donationgoal/settings/new`,
      settingsSaveUrl: `https://${this.getHost()}/api/v5/slobs/widget/donationgoal/settings/new`,
      goalUrl: `https://${this.getHost()}/api/v5/slobs/widget/donationgoal/new`,
      settingsUpdateEvent: 'donationGoalSettingsUpdate',
      goalCreateEvent: 'donationGoalStart',
      goalResetEvent: 'donationGoalEnd',
      hasTestButtons: true,
      customCodeAllowed: true,
      customFieldsAllowed: true,
    };
  }
}
