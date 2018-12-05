import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { Inject } from 'util/injector';
import { CustomizationService } from 'services/customization';
import { NavigationService } from 'services/navigation';
import { UserService } from 'services/user';
import electron from 'electron';
import Login from 'components/Login.vue';
import { SettingsService } from 'services/settings';
import { WindowsService } from 'services/windows';
import Utils from 'services/utils';
import { TransitionsService } from 'services/transitions';
import { PlatformAppsService, EAppPageSlot } from 'services/platform-apps';
import { IncrementalRolloutService, EAvailableFeatures } from 'services/incremental-rollout';
import { AppService } from '../services/app';

@Component({
  components: {
    Login
  }
})
export default class TopNav extends Vue {
  @Inject() appService: AppService;
  @Inject() settingsService: SettingsService;
  @Inject() customizationService: CustomizationService;
  @Inject() navigationService: NavigationService;
  @Inject() userService: UserService;
  @Inject() transitionsService: TransitionsService;
  @Inject() windowsService: WindowsService;
  @Inject() platformAppsService: PlatformAppsService;
  @Inject() incrementalRolloutService: IncrementalRolloutService;

  slideOpen = false;

  studioModeTooltip = 'Studio Mode';

  get availableFeatures() {
    return EAvailableFeatures;
  }

  @Prop()
  locked: boolean;

  navigateStudio() {
    this.navigationService.navigate('Studio');
  }

  navigateChatBot() {
    this.navigationService.navigate('Chatbot');
  }

  navigateDashboard() {
    this.navigationService.navigate('Dashboard');
  }

  navigatePlatformAppStore() {
    this.navigationService.navigate('PlatformAppStore');
  }

  navigateOverlays() {
    this.navigationService.navigate('BrowseOverlays');
  }

  navigateLive() {
    this.navigationService.navigate('Live');
  }

  navigateOnboarding() {
    this.navigationService.navigate('Onboarding');
  }

  navigateDesignSystem() {
    this.navigationService.navigate('DesignSystem');
  }

  navigateHelp() {
    this.navigationService.navigate('Help');
  }

  featureIsEnabled(feature: EAvailableFeatures) {
    return this.incrementalRolloutService.featureIsEnabled(feature);
  }

  studioMode() {
    if (this.transitionsService.state.studioMode) {
      this.transitionsService.disableStudioMode();
    } else {
      this.transitionsService.enableStudioMode();
    }
  }

  get studioModeEnabled() {
    return this.transitionsService.state.studioMode;
  }

  openSettingsWindow() {
    this.settingsService.showSettings();
  }

  toggleNightTheme() {
    this.customizationService.nightMode = !this.customizationService.nightMode;
  }

  openDiscord() {
    electron.remote.shell.openExternal('https://discordapp.com/invite/stream');
  }

  get isDevMode() {
    return Utils.isDevMode();
  }

  openDevTools() {
    electron.ipcRenderer.send('openDevTools');
  }

  get page() {
    return this.navigationService.state.currentPage;
  }

  get isUserLoggedIn() {
    return this.userService.state.auth;
  }

  get appStoreVisible() {
    return (this.platformAppsService.state.storeVisible
      || this.featureIsEnabled(this.availableFeatures.platform))
      && this.userService.isLoggedIn()
      && this.userService.platform.type === 'twitch';
  }

  get loading() {
    return this.appService.state.loading;
  }
}
