import { Component, Prop } from 'vue-property-decorator';
import cx from 'classnames';
import moment from 'moment';
import { RecentEventsService, IRecentEvent } from 'services/recent-events';
import TsxComponent from './tsx-component';
import { Inject } from 'services/core';
import { $t } from 'services/i18n';
import styles from './RecentEvents.m.less';

const getName = (event: IRecentEvent) => {
  if (event.gifter) return event.gifter;
  if (event.from) return event.from;
  return event.name;
};

@Component({})
export default class RecentEvents extends TsxComponent<{}> {
  @Inject() recentEventsService: RecentEventsService;

  get recentEvents() {
    return this.recentEventsService.state.recentEvents;
  }

  get muted() {
    return this.recentEventsService.state.muted;
  }

  formatMoney(amount: string, type: string) {
    const prefix = type === 'donation' ? '$' : '';
    const numAmount = Number.parseFloat(amount);
    return `${prefix}${type === 'donation' ? numAmount.toFixed(2) : numAmount.toFixed(0)}`;
  }

  eventString(event: IRecentEvent) {
    return this.recentEventsService.getEventString(event);
  }

  repeatAlert(event: IRecentEvent) {
    return this.recentEventsService.repeatAlert(event);
  }

  popoutRecentEvents() {
    return this.recentEventsService.openRecentEventsWindow();
  }

  popoutMediaShare() {
    return this.recentEventsService.openRecentEventsWindow(true);
  }

  muteEvents() {
    return this.recentEventsService.toggleMuteEvents();
  }

  render(h: Function) {
    return (
      <div class={styles.container}>
        <Toolbar
          popoutMediaShare={() => this.popoutMediaShare()}
          popoutRecentEvents={() => this.popoutRecentEvents()}
          muteEvents={() => this.muteEvents()}
          muted={this.muted}
        />
        <div class={styles.eventContainer}>
          {this.recentEvents &&
            this.recentEvents.map(event => (
              <EventCell
                event={event}
                repeatAlert={this.repeatAlert.bind(this)}
                eventString={this.eventString.bind(this)}
              />
            ))}
        </div>
      </div>
    );
  }
}

interface IToolbarProps {
  popoutMediaShare: Function;
  popoutRecentEvents: Function;
  muteEvents: Function;
  muted: boolean;
}

// TODO: Refactor into stateless functional component
@Component({})
class Toolbar extends TsxComponent<IToolbarProps> {
  @Prop() popoutMediaShare: Function;
  @Prop() popoutRecentEvents: Function;
  @Prop() muteEvents: Function;
  @Prop() muted: boolean;

  render(h: Function) {
    return (
      <div class={styles.topBar}>
        <h2 class="studio-controls__label">{$t('Recent Events')}</h2>
        <i
          class="icon-music action-icon"
          onClick={this.popoutMediaShare}
          v-tooltip={{ content: $t('Popout Media Share Controls'), placement: 'bottom' }}
        />
        <i
          class="icon-pop-out-2 action-icon"
          onClick={this.popoutRecentEvents}
          v-tooltip={{ content: $t('Popout Recent Events'), placement: 'bottom' }}
        />
        <i
          class="icon-pause action-icon"
          onClick={() => {}}
          v-tooltip={{ content: $t('Pause Alert Queue'), placement: 'bottom' }}
        />
        <i
          class="icon-skip action-icon"
          onClick={() => {}}
          v-tooltip={{ content: $t('Skip Alert'), placement: 'bottom' }}
        />
        <i
          class={cx('icon-mute action-icon', { [styles.red]: this.muted })}
          onClick={this.muteEvents}
          v-tooltip={{ content: $t('Mute Event Sounds'), placement: 'bottom' }}
        />
      </div>
    );
  }
}

// TODO: Refactor into stateless functional component
@Component({})
class EventCell extends TsxComponent<{
  event: IRecentEvent;
  eventString: Function;
  repeatAlert: Function;
}> {
  @Prop() event: IRecentEvent;
  @Prop() eventString: Function;
  @Prop() repeatAlert: Function;

  render(h: Function) {
    return (
      <div class={styles.cell}>
        <span class={styles.timestamp}>{moment(this.event.created_at).fromNow(true)}</span>
        <span class={styles.name}>{getName(this.event)}</span>
        <span>{this.eventString(this.event)}</span>
        {this.event.gifter && (
          <span class={styles.name}>{this.event.from ? this.event.from : this.event.name}</span>
        )}
        {this.event.formatted_amount && (
          <span class={styles.money}>{this.event.formatted_amount}</span>
        )}
        {(this.event.comment || this.event.message) && (
          <span class={styles.whisper}>
            {this.event.comment ? this.event.comment : this.event.message}
          </span>
        )}
        <i
          class="icon-repeat action-icon"
          onClick={() => this.repeatAlert(this.event)}
          v-tooltip={{ content: $t('Repeat Alert'), placement: 'left' }}
        />
      </div>
    );
  }
}
