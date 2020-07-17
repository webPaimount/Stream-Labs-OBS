import { Inject, ViewHandler } from '../core';
import { IGoLiveSettings, IStreamingServiceState, IStreamSettings } from './streaming-api';
import { StreamSettingsService } from '../settings/streaming';
import { UserService } from '../user';
import { RestreamService } from '../restream';
import { TwitchService } from '../platforms/twitch';
import { VideoEncodingOptimizationService } from '../video-encoding-optimizations';
import { getPlatformService, TPlatform, TPlatformCapability } from '../platforms';
import { $t } from '../i18n';
import { cloneDeep, difference } from 'lodash';

/**
 * The stream info view is responsible for keeping
 * reliable, up-to-date information about the user's
 * channel and current stream in the Vuex store for
 * components to make use of.
 */
export class StreamInfoView extends ViewHandler<IStreamingServiceState> {
  @Inject() private streamSettingsService: StreamSettingsService;
  @Inject() private userService: UserService;
  @Inject() private restreamService: RestreamService;
  @Inject() private twitchService: TwitchService;
  @Inject() private videoEncodingOptimizationService: VideoEncodingOptimizationService;

  get info() {
    return this.state.info;
  }

  /**
   * Returns a sorted list of all platforms (linked and unlinked)
   */
  get allPlatforms(): TPlatform[] {
    return this.sortPlatforms(['twitch', 'mixer', 'facebook', 'youtube']);
  }

  /**
   * Returns a list of linked platforms
   */
  get linkedPlatforms(): TPlatform[] {
    if (!this.userService.state.auth) return [];
    return this.allPlatforms.filter(p => this.isPlatformLinked(p));
  }

  /**
   * Returns a list of enabled for streaming platforms
   */
  get enabledPlatforms(): TPlatform[] {
    const goLiveSettings = this.goLiveSettings;
    return Object.keys(goLiveSettings.destinations).filter(
      (platform: TPlatform) =>
        this.linkedPlatforms.includes(platform) && goLiveSettings.destinations[platform].enabled,
    ) as TPlatform[];
  }

  get isMutliplatformMode(): boolean {
    return (
      this.streamSettingsService.state.protectedModeEnabled && this.enabledPlatforms.length > 1
    );
  }

  get isMidStreamMode(): boolean {
    return this.state.streamingStatus !== 'offline';
  }

  /**
   * Returns total viewer count for all enabled platforms
   */
  get viewerCount(): number {
    if (!this.enabledPlatforms.length) return 0;
    return this.enabledPlatforms
      .map(platform => getPlatformService(platform).state.viewersCount)
      .reduce((c1, c2) => c1 + c2);
  }

  /**
   * Chat url of a primary platform
   */
  get chatUrl(): string {
    if (!this.userService.state.auth) return '';
    return getPlatformService(this.userService.state.auth.primaryPlatform).chatUrl;
  }

  /**
   * Prepares and returns the initial settings for the GoLive window
   */
  get goLiveSettings(): IGoLiveSettings {
    const destinations = {};
    this.linkedPlatforms.forEach(platform => {
      destinations[platform] = this.getPlatformSettings(platform);
    });

    return {
      destinations: destinations as IGoLiveSettings['destinations'],
      advancedMode: !!this.streamSettingsService.state.goLiveSettings?.advancedMode,
      optimizedProfile: undefined,
      tweetText: '',
    };
  }

  /**
   * Returns common fields for the stream such as title, description, game
   */
  getCommonFields(settings: IStreamSettings) {
    const commonFields = {
      title: '',
      description: '',
      game: '',
    };
    const destinations = Object.keys(settings.destinations) as TPlatform[];
    const enabledDestinations = destinations.filter(dest => settings.destinations[dest].enabled);
    const destinationsWithCommonSettings = enabledDestinations.filter(
      dest => !settings.destinations[dest].useCustomFields,
    );
    const destinationWithCustomSettings = difference(
      enabledDestinations,
      destinationsWithCommonSettings,
    );

    // search fields in platforms that don't use custom settings first
    destinationsWithCommonSettings.forEach(platform => {
      const destSettings = settings.destinations[platform];
      Object.keys(commonFields).forEach(fieldName => {
        if (commonFields[fieldName] || !destSettings[fieldName]) return;
        commonFields[fieldName] = destSettings[fieldName];
      });
    });

    // search fields in platforms that have custom fields
    destinationWithCustomSettings.forEach(platform => {
      const destSettings = settings.destinations[platform];
      Object.keys(commonFields).forEach(fieldName => {
        if (commonFields[fieldName] || !destSettings[fieldName]) return;
        commonFields[fieldName] = destSettings[fieldName];
      });
    });

    return commonFields;
  }

  /**
   * return common fields for the stream such title, description, game
   */
  get commonFields(): { title: string; description: string; game: string } {
    return this.getCommonFields(this.goLiveSettings);
  }

  /**
   * Sort the platform list
   * - the primary platform is always first
   * - linked platforms are always on the top of the list
   * - the rest has an alphabetic sort
   */
  sortPlatforms(platforms: TPlatform[]): TPlatform[] {
    platforms = platforms.sort();
    return [
      ...platforms.filter(p => this.isPrimaryPlatform(p)),
      ...platforms.filter(p => !this.isPrimaryPlatform(p) && this.isPlatformLinked(p)),
      ...platforms.filter(p => !this.isPlatformLinked(p)),
    ];
  }

  /**
   * returns `true` if all target platforms have prepopulated their settings
   */
  isPrepopulated(platforms: TPlatform[]): boolean {
    for (const platform of platforms) {
      if (!getPlatformService(platform).state.isPrepopulated) return false;
    }
    return true;
  }

  /**
   * Returns true if given platforms have a capability
   */
  supports(capability: TPlatformCapability, targetPlatforms?: TPlatform[]): boolean {
    const platforms = targetPlatforms || this.enabledPlatforms;
    for (const platform of platforms) {
      if (getPlatformService(platform).capabilities.has(capability)) return true;
    }
  }

  isPlatformLinked(platform: TPlatform): boolean {
    if (!this.userService.state.auth?.platforms) return false;
    return !!this.userService.state.auth?.platforms[platform];
  }

  isPrimaryPlatform(platform: TPlatform) {
    return platform === this.userService.state.auth?.primaryPlatform;
  }

  /**
   * Validates settings and returns an error string
   */
  validateSettings<T extends IStreamSettings>(settings: T): string {
    const platforms = Object.keys(settings.destinations) as TPlatform[];
    for (const platform of platforms) {
      const platformSettings = settings.destinations[platform];
      if (!platformSettings.enabled) continue;
      const platformName = getPlatformService(platform).displayName;
      if (platform === 'twitch' || platform === 'facebook') {
        if (!platformSettings['game']) {
          return $t('You must select a game for %{platformName}', { platformName });
        }
      }
    }
    return '';
  }

  /**
   * Returns Go-Live settings for a given platform
   */
  private getPlatformSettings(platform: TPlatform) {
    const service = getPlatformService(platform);
    const savedDestinations = this.streamSettingsService.state.goLiveSettings?.destinations;
    const { enabled, useCustomFields } = (savedDestinations && savedDestinations[platform]) || {
      enabled: false,
      useCustomFields: false,
    };
    const settings = cloneDeep(service.state.settings);

    // don't reuse broadcastId for Youtube
    if (settings && settings['broadcastId']) settings['broadcastId'] = '';

    return {
      ...settings,
      useCustomFields,
      enabled: enabled || this.isPrimaryPlatform(platform),
    };
  }
}
