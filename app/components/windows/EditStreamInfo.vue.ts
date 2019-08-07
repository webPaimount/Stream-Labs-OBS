import Vue from 'vue';
import moment from 'moment';
import { Component, Watch } from 'vue-property-decorator';
import ModalLayout from '../ModalLayout.vue';
import { BoolInput, ListInput, ToggleInput } from 'components/shared/inputs/inputs';
import HFormGroup from 'components/shared/inputs/HFormGroup.vue';
import { StreamInfoService } from 'services/stream-info';
import { UserService } from '../../services/user';
import { Inject } from '../../services/core/injector';
import { getPlatformService, IChannelInfo } from 'services/platforms';
import { StreamingService } from 'services/streaming';
import { WindowsService } from 'services/windows';
import { CustomizationService } from 'services/customization';
import { $t, I18nService } from 'services/i18n';
import { FacebookService } from 'services/platforms/facebook';
import {
  VideoEncodingOptimizationService,
  IEncoderProfile,
} from 'services/video-encoding-optimizations';
import { shell } from 'electron';
import { formMetadata, IListOption, metadata } from '../shared/inputs';
import TwitchTagsInput from 'components/shared/inputs/TwitchTagsInput.vue';
import { TwitchService } from 'services/platforms/twitch';
import { TwitterService } from 'services/integrations/twitter';
import { cloneDeep } from 'lodash';
import { Debounce } from 'lodash-decorators';
import { Spinner, TextArea, Button } from 'streamlabs-beaker';
import ValidatedForm from '../shared/inputs/ValidatedForm.vue';

@Component({
  components: {
    ModalLayout,
    HFormGroup,
    BoolInput,
    ListInput,
    ToggleInput,
    TwitchTagsInput,
    ValidatedForm,
    Spinner,
    TextArea,
    Button,
  },
})
export default class EditStreamInfo extends Vue {
  @Inject() streamInfoService: StreamInfoService;
  @Inject() userService: UserService;
  @Inject() streamingService: StreamingService;
  @Inject() windowsService: WindowsService;
  @Inject() customizationService: CustomizationService;
  @Inject() videoEncodingOptimizationService: VideoEncodingOptimizationService;
  @Inject() twitchService: TwitchService;
  @Inject() twitterService: TwitterService;
  @Inject() facebookService: FacebookService;
  @Inject() i18nService: I18nService;

  // UI State Flags
  searchingGames = false;
  updatingInfo = false;
  updateError = false;
  selectedProfile: IEncoderProfile = null;

  link = '';

  gameOptions: IListOption<string>[] = [];

  doNotShowAgainModel: boolean = false;

  startTimeModel: { time: number; date: string } = {
    time: null,
    date: null,
  };

  shouldTweetModel: boolean = this.twitterService.state.tweetWhenGoingLive;
  priorTitle: string = '';
  tweetModel: string = '';

  searchProfilesPending = false;
  channelInfo: IChannelInfo = null;

  $refs: {
    form: ValidatedForm;
  };

  get hasUpdateTagsPermission() {
    return this.channelInfo.hasUpdateTagsPermission;
  }

  get hasPages() {
    return (
      !this.infoLoading &&
      this.isFacebook &&
      this.facebookService.state.facebookPages &&
      this.facebookService.state.facebookPages.pages.length
    );
  }

  get isPrime() {
    return this.twitterService.state.prime;
  }

  get hasTwitter() {
    return this.twitterService.state.linked;
  }

  get shouldTweet() {
    return this.twitterService.state.tweetWhenGoingLive;
  }

  get twitterScreenName() {
    return this.twitterService.state.screenName;
  }

  get csOnboardingComplete() {
    return this.twitterService.state.creatorSiteOnboardingComplete;
  }

  get siteUrl() {
    return this.twitterService.state.creatorSiteUrl;
  }

  get formMetadata() {
    return formMetadata({
      game: metadata.list({
        title: $t('Game'),
        placeholder: $t('Start typing to search'),
        options: this.gameOptions,
        loading: this.searchingGames,
        internalSearch: false,
        allowEmpty: true,
        noResult: $t('No matching game(s) found.'),
        required: true,
      }),
      title: metadata.text({
        title: $t('Title'),
        fullWidth: true,
        required: true,
      }),
      description: metadata.textArea({
        title: $t('Description'),
      }),
      date: metadata.text({
        title: $t('Scheduled Date'),
        dateFormat: 'MM/dd/yyyy',
        placeholder: 'MM/DD/YYYY',
        required: true,
        description: this.isFacebook
          ? $t(
              'Please schedule no further than 7 days in advance and no sooner than 10 minutes in advance.',
            )
          : undefined,
      }),
      time: metadata.timer({
        title: $t('Scheduled Time'),
        format: 'hm',
        max: 24 * 3600,
      }),
    });
  }

  get useOptimizedProfile() {
    return this.videoEncodingOptimizationService.state.useOptimizedProfile;
  }

  set useOptimizedProfile(enabled: boolean) {
    this.videoEncodingOptimizationService.useOptimizedProfile(enabled);
  }

  async created() {
    await this.refreshStreamInfo();
  }

  @Debounce(500)
  async onGameSearchHandler(searchString: string) {
    if (searchString !== '') {
      this.searchingGames = true;
      const platform = this.userService.platform.type;
      const service = getPlatformService(platform);

      this.gameOptions = [];

      return service.searchGames(searchString).then(games => {
        this.searchingGames = false;
        if (games && games.length) {
          games.forEach(game => {
            this.gameOptions.push({
              title: game.name,
              value: game.name,
            });
          });
        }
      });
    }
  }

  async loadAvailableProfiles() {
    if (this.midStreamMode) return;
    this.searchProfilesPending = true;
    this.selectedProfile = await this.videoEncodingOptimizationService.fetchOptimizedProfile(
      this.channelInfo.game,
    );
    this.searchProfilesPending = false;
  }

  // For some reason, v-model doesn't work with ListInput
  onGameInput(gameModel: string) {
    this.channelInfo.game = gameModel;
    this.loadAvailableProfiles();
  }

  updateAndGoLive() {
    this.updatingInfo = true;

    if (this.doNotShowAgainModel) {
      alert(
        $t('You will not be asked again to update your stream info when going live. ') +
          $t('You can re-enable this from the settings.'),
      );

      this.customizationService.setUpdateStreamInfoOnLive(false);
    }

    if (this.hasTwitter && this.shouldTweet) {
      this.twitterService.postTweet(this.tweetModel);
    }

    this.videoEncodingOptimizationService.useOptimizedProfile(this.useOptimizedProfile);

    this.streamInfoService
      .setChannelInfo(this.channelInfo)
      .then(success => {
        if (success) {
          if (this.midStreamMode) {
            this.windowsService.closeChildWindow();
          } else {
            this.goLive();
          }
        } else {
          this.updateError = true;
          this.updatingInfo = false;
        }
      })
      .catch(e => {
        this.$toasted.show(e, {
          position: 'bottom-center',
          className: 'toast-alert',
          duration: 1000,
          singleton: true,
        });
        this.updatingInfo = false;
      });

    if (this.selectedProfile && this.useOptimizedProfile) {
      this.videoEncodingOptimizationService.applyProfile(this.selectedProfile);
    }
  }

  async scheduleStream() {
    this.updatingInfo = true;

    const scheduledStartTime = this.formatDateString();
    const service = getPlatformService(this.userService.platform.type);
    if (scheduledStartTime) {
      await service
        .scheduleStream(scheduledStartTime, this.channelInfo)
        .then(() => (this.startTimeModel = { time: null, date: null }))
        .then(() => {
          this.$toasted.show(
            $t(
              'Your stream has been scheduled for %{time} from now.' +
                " If you'd like to make another schedule please enter a different time",
              { time: moment().to(scheduledStartTime, true) },
            ),
            {
              position: 'bottom-center',
              fullWidth: true,
              className: 'toast-success toast-success__schedule',
              duration: 0,
              action: {
                text: $t('Close'),
                class: 'toast-action',
                onClick: (_e, toastedObject) => toastedObject.goAway(),
              },
            },
          );
        })
        .catch(e => {
          this.$toasted.show(e.error.message, {
            position: 'bottom-center',
            className: 'toast-alert',
            duration: 50 * e.error.message.length,
            singleton: true,
          });
        });
    }

    this.updatingInfo = false;
  }

  async handleSubmit() {
    if (await this.$refs.form.validateAndGetErrorsCount()) return;
    if (this.isSchedule) return this.scheduleStream();
    if (this.hasTwitter && this.shouldTweet) {
      const tweetedSuccessfully = await this.handlePostTweet();
      if (!tweetedSuccessfully) return;
    }
    this.updateAndGoLive();
  }

  async handlePostTweet() {
    this.updatingInfo = true;
    let success = false;
    try {
      await this.twitterService.postTweet(this.tweetModel);
      success = true;
    } catch {
      this.$toasted.show($t('Failed to post tweet'), {
        position: 'bottom-center',
        className: 'toast-alert',
        duration: 1000,
        singleton: true,
      });
      success = false;
      this.updateError = true;
    }
    this.updatingInfo = false;
    return success;
  }

  async goLive() {
    try {
      await this.streamingService.toggleStreaming();
      this.windowsService.closeChildWindow();
    } catch (e) {
      this.$toasted.show(e, {
        position: 'bottom-center',
        className: 'toast-alert',
        duration: 1000,
        singleton: true,
      });
      this.updatingInfo = false;
    }
  }

  async getTwitterStatus() {
    await this.twitterService.getTwitterStatus();
  }

  cancel() {
    this.windowsService.closeChildWindow();
  }

  async refreshStreamInfo() {
    // This should have been pre-fetched, but we can force a refresh
    await this.streamInfoService.refreshStreamInfo();

    // set a local state of the channelInfo
    this.channelInfo = cloneDeep(this.streamInfoService.state.channelInfo);

    // the ListInput component requires the selected game to be in the options list
    if (this.channelInfo.game) {
      this.gameOptions = [{ value: this.channelInfo.game, title: this.channelInfo.game }];
    }

    // check available profiles for the selected game
    await this.loadAvailableProfiles();

    // Get up-to-date twitter status
    await this.getTwitterStatus();
    this.setInitialTweetBody();
  }

  get isTwitch() {
    return this.userService.platform.type === 'twitch';
  }

  get isYoutube() {
    return this.userService.platform.type === 'youtube';
  }

  get isMixer() {
    return this.userService.platform.type === 'mixer';
  }

  get isFacebook() {
    return this.userService.platform.type === 'facebook';
  }

  get isServicedPlatform() {
    return this.isFacebook || this.isYoutube || this.isTwitch || this.isMixer;
  }

  get submitText() {
    if (this.midStreamMode) return $t('Update');
    if (this.isSchedule) return $t('Schedule');
    if (this.hasTwitter && this.shouldTweet) return $t('Tweet & Go Live');

    return $t('Confirm & Go Live');
  }

  get midStreamMode() {
    return this.streamingService.isStreaming;
  }

  get isSchedule() {
    return this.windowsService.getChildWindowQueryParams().isSchedule;
  }

  get infoLoading() {
    return !this.channelInfo || this.streamInfoService.state.fetching;
  }

  get infoError() {
    return this.streamInfoService.state.error;
  }

  get primeButtonText() {
    return $t('Customize your URL');
  }

  get composeTweetText() {
    return $t('Compose Tweet');
  }

  linkTwitter() {
    this.twitterService.openLinkTwitterDialog();
  }

  unlinkTwitter() {
    this.twitterService.unlinkTwitter().then(() => this.getTwitterStatus());
  }

  tweet() {
    this.twitterService.postTweet(this.tweetModel);
  }

  setInitialTweetBody() {
    let url = `${this.siteUrl}/home`;
    if (!this.csOnboardingComplete && this.isTwitch) {
      url = `https://twitch.tv/${this.userService.platform.username}`;
    }
    this.tweetModel = `${this.channelInfo.title} ${url}`;
  }

  @Watch('channelInfo.title')
  onTitleUpdate(item: string) {
    if (this.tweetModel.indexOf(this.priorTitle) !== -1 && this.tweetModel.length < 280) {
      this.tweetModel = this.tweetModel.replace(this.priorTitle, item);
    }
    this.priorTitle = item;
  }

  @Watch('shouldTweetModel')
  onShouldTweetChange() {
    this.twitterService.setTweetPreference(this.shouldTweetModel);
  }

  @Watch('siteUrl')
  onSiteUrlChange() {
    this.setInitialTweetBody();
  }

  @Watch('doNotShowAgainModel')
  onDoNotShow(doNotShow: boolean) {
    if (doNotShow) {
      this.shouldTweetModel = false;
    }
  }

  openFBPageCreateLink() {
    shell.openExternal('https://www.facebook.com/pages/creation/');
    this.windowsService.closeChildWindow();
  }

  openPrime() {
    shell.openExternal('https://streamlabs.com/editor/domain?ref=slobs_twitter&redirect=false');
  }

  get optimizedProfileMetadata() {
    const game = this.selectedProfile.game !== 'DEFAULT' ? `for ${this.channelInfo.game}` : '';
    return {
      title: $t('Use optimized encoder settings ') + game,
      tooltip: $t(
        'Optimized encoding provides better quality and/or lower cpu/gpu usage. Depending on the game, ' +
          'resolution may be changed for a better quality of experience',
      ),
    };
  }

  private formatDateString() {
    try {
      const dateArray = this.startTimeModel.date.split('/');
      let hours: string | number = Math.floor(this.startTimeModel.time / 3600);
      hours = hours < 10 ? `0${hours}` : hours;
      let minutes: string | number = (this.startTimeModel.time % 3600) / 60;
      minutes = minutes < 10 ? `0${minutes}` : minutes;
      return `${dateArray[2]}-${dateArray[0]}-${
        dateArray[1]
      }T${hours}:${minutes}:00.0${moment().format('Z')}`;
    } catch {
      this.$toasted.show($t('Please enter a valid date'), {
        position: 'bottom-center',
        className: 'toast-alert',
        duration: 1000,
        singleton: true,
      });
    }
  }
}
