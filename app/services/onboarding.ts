import * as remote from '@electron/remote';
import { Subject } from 'rxjs';
import { StatefulService, mutation } from 'services/core/stateful-service';
import { NavigationService } from 'services/navigation';
import { UserService } from 'services/user';
import { Inject, ViewHandler } from 'services/core/';
import { SceneCollectionsService } from 'services/scene-collections';
import { OS } from 'util/operating-systems';
import { $t } from './i18n';
import { jfetch } from 'util/requests';
import { getPlatformService } from './platforms';
import { OutputSettingsService } from './settings';
import { ObsImporterService } from './obs-importer';
import Utils from './utils';
import { RecordingModeService } from './recording-mode';
import { THEME_METADATA, IThemeMetadata } from './onboarding/theme-metadata';
export type { IThemeMetadata } from './onboarding/theme-metadata';
import {
  StreamerKnowledgeMode,
  isBeginnerOrIntermediateOrUnselected,
  isIntermediateOrAdvancedOrUnselected,
} from './onboarding/knowledge-mode';
export { StreamerKnowledgeMode } from './onboarding/knowledge-mode';

enum EOnboardingSteps {
  MacPermissions = 'MacPermissions',
  StreamingOrRecording = 'StreamingOrRecording',
  Connect = 'Connect',
  PrimaryPlatformSelect = 'PrimaryPlatformSelect',
  FreshOrImport = 'FreshOrImport',
  ObsImport = 'ObsImport',
  HardwareSetup = 'HardwareSetup',
  ThemeSelector = 'ThemeSelector',
  Optimize = 'Optimize',
  Prime = 'Prime',
  Tips = 'Tips',
}

const isMac = () => process.platform === OS.Mac;

export const ONBOARDING_STEPS = () => ({
  [EOnboardingSteps.MacPermissions]: {
    component: 'MacPermissions',
    hideButton: true,
    isPreboarding: true,
    cond: isMac,
    isSkippable: false,
  },
  [EOnboardingSteps.StreamingOrRecording]: {
    component: 'StreamingOrRecording',
    hideButton: true,
    isPreboarding: true,
    isSkippable: false,
  },
  [EOnboardingSteps.Connect]: {
    component: 'Connect',
    isSkippable: isIntermediateOrAdvancedOrUnselected,
    hideButton: true,
    isPreboarding: true,
  },
  [EOnboardingSteps.PrimaryPlatformSelect]: {
    component: 'PrimaryPlatformSelect',
    hideButton: true,
    isPreboarding: true,
    cond: ({ isPartialSLAuth }: OnboardingStepContext) => isPartialSLAuth,
  },
  [EOnboardingSteps.FreshOrImport]: {
    component: 'FreshOrImport',
    hideButton: true,
    isPreboarding: true,
    cond: ({ isObsInstalled, recordingModeEnabled }: OnboardingStepContext) =>
      isObsInstalled && !recordingModeEnabled,
  },
  [EOnboardingSteps.ObsImport]: {
    component: 'ObsImport',
    hideButton: true,
    label: $t('Import'),
    cond: ({ importedFromObs, isObsInstalled }: OnboardingStepContext) =>
      importedFromObs && isObsInstalled,
  },
  [EOnboardingSteps.HardwareSetup]: {
    component: 'HardwareSetup',
    label: $t('Set Up Mic and Webcam'),
    cond: ({ importedFromObs }: OnboardingStepContext) => !importedFromObs,
    isSkippable: true,
  },
  [EOnboardingSteps.ThemeSelector]: {
    component: 'ThemeSelector',
    hideButton: true,
    label: $t('Add a Theme'),
    cond: ({
      isLoggedIn,
      existingSceneCollections,
      importedFromObs,
      recordingModeEnabled,
      platformSupportsThemes,
    }: OnboardingStepContext) =>
      !existingSceneCollections &&
      !importedFromObs &&
      !recordingModeEnabled &&
      ((isLoggedIn && platformSupportsThemes) || !isLoggedIn),
    isSkippable: true,
  },
  // Temporarily skip auto config until migration to new API
  // [EOnboardingSteps.Optimize]: {
  //   component: 'Optimize',
  //   disableControls: false,
  //   hideSkip: false,
  //   hideButton: true,
  //   label: $t('Optimize'),
  //   cond: ({ isTwitchAuthed, isYoutubeAuthed, recordingModeEnabled }: OnboardingStepContext) => isTwitchAuthed || isYoutubeAuthed || recordingModeEnabled,
  // },
  [EOnboardingSteps.Prime]: {
    component: 'Prime',
    hideButton: true,
    label: $t('Ultra'),
    cond: ({ isUltra }: OnboardingStepContext) => !isUltra,
    isSkippable: true,
  },
  [EOnboardingSteps.Tips]: {
    component: 'Tips',
    hideButton: true,
    cond: isBeginnerOrIntermediateOrUnselected,
    isSkippable: false,
  },
});

export interface OnboardingStepContext {
  streamerKnowledgeMode: StreamerKnowledgeMode | null;
  isPartialSLAuth: boolean;
  existingSceneCollections: boolean;
  isObsInstalled: boolean;
  recordingModeEnabled: boolean;
  importedFromObs: boolean;
  isLoggedIn: boolean;
  isUltra: boolean;
  platformSupportsThemes: boolean;
}

export interface IOnboardingStep {
  component: string;
  hideButton?: boolean;
  label?: string;
  isPreboarding?: boolean;
  /** Predicate that returns whether this step should run, keeps steps declarative */
  cond?: (ctx: OnboardingStepContext) => boolean;
  isSkippable?: boolean | ((ctx: OnboardingStepContext) => boolean);
}

interface IOnboardingOptions {
  isLogin: boolean; // When logging into a new account after onboarding
  isOptimize: boolean; // When re-running the optimizer after onboarding
  // about our security upgrade.
  isHardware: boolean; // When configuring capture defaults
  isImport: boolean; // When users are importing from OBS
}

interface IOnboardingServiceState {
  options: IOnboardingOptions;
  importedFromObs: boolean;
  existingSceneCollections: boolean;
  streamerKnowledgeMode: StreamerKnowledgeMode | null;
}

class OnboardingViews extends ViewHandler<IOnboardingServiceState> {
  get singletonStep(): IOnboardingStep {
    if (this.state.options.isLogin) {
      if (this.getServiceViews(UserService).isPartialSLAuth) {
        return ONBOARDING_STEPS()[EOnboardingSteps.PrimaryPlatformSelect];
      }

      return ONBOARDING_STEPS()[EOnboardingSteps.Connect];
    }
    if (this.state.options.isOptimize) return ONBOARDING_STEPS()[EOnboardingSteps.Optimize];
    if (this.state.options.isHardware) return ONBOARDING_STEPS()[EOnboardingSteps.HardwareSetup];
    if (this.state.options.isImport) return ONBOARDING_STEPS()[EOnboardingSteps.ObsImport];
  }

  get steps() {
    const userViews = this.getServiceViews(UserService);
    const isOBSinstalled = this.getServiceViews(ObsImporterService).isOBSinstalled();
    const recordingModeEnabled = this.getServiceViews(RecordingModeService).isRecordingModeEnabled;

    const streamerKnowledgeMode = this.streamerKnowledgeMode;

    const { existingSceneCollections, importedFromObs } = this.state;
    const { isLoggedIn, isPrime: isUltra } = userViews;

    const ctx: OnboardingStepContext = {
      streamerKnowledgeMode,
      recordingModeEnabled,
      existingSceneCollections,
      importedFromObs,
      isLoggedIn,
      isUltra,
      isObsInstalled: isOBSinstalled,
      isPartialSLAuth: userViews.auth && userViews.isPartialSLAuth,
      platformSupportsThemes:
        isLoggedIn && getPlatformService(userViews.platform?.type)?.hasCapability('themes'),
    };

    return this.getStepsForMode(streamerKnowledgeMode)(ctx);
  }

  get totalSteps() {
    return this.steps.length;
  }

  getStepsForMode(mode: StreamerKnowledgeMode) {
    const { getSteps } = this;

    switch (mode) {
      case StreamerKnowledgeMode.BEGINNER:
        return getSteps([
          EOnboardingSteps.MacPermissions,
          EOnboardingSteps.StreamingOrRecording,
          EOnboardingSteps.Connect,
          EOnboardingSteps.PrimaryPlatformSelect,
          EOnboardingSteps.FreshOrImport,
          EOnboardingSteps.ObsImport,
          EOnboardingSteps.HardwareSetup,
          EOnboardingSteps.ThemeSelector,
          EOnboardingSteps.Prime,
          EOnboardingSteps.Tips,
        ]);
      case StreamerKnowledgeMode.INTERMEDIATE:
        /*
         * Yes, these are the same as beginner, only inner screens are supposed to differ,
         * but the one screen that was provided is currently disabled (Optimizer).
         * Nevertheless, this sets the foundation for future changes.
         */
        return getSteps([
          EOnboardingSteps.MacPermissions,
          EOnboardingSteps.StreamingOrRecording,
          EOnboardingSteps.Connect,
          EOnboardingSteps.PrimaryPlatformSelect,
          EOnboardingSteps.FreshOrImport,
          EOnboardingSteps.ObsImport,
          EOnboardingSteps.HardwareSetup,
          EOnboardingSteps.ThemeSelector,
          EOnboardingSteps.Prime,
          EOnboardingSteps.Tips,
        ]);
      case StreamerKnowledgeMode.ADVANCED:
        return getSteps([
          EOnboardingSteps.MacPermissions,
          EOnboardingSteps.StreamingOrRecording,
          EOnboardingSteps.FreshOrImport,
          EOnboardingSteps.ObsImport,
          EOnboardingSteps.HardwareSetup,
          EOnboardingSteps.Prime,
        ]);
      default:
        return getSteps([
          EOnboardingSteps.MacPermissions,
          EOnboardingSteps.StreamingOrRecording,
          EOnboardingSteps.Connect,
          EOnboardingSteps.PrimaryPlatformSelect,
          EOnboardingSteps.FreshOrImport,
          EOnboardingSteps.ObsImport,
          EOnboardingSteps.HardwareSetup,
          EOnboardingSteps.ThemeSelector,
          EOnboardingSteps.Prime,
        ]);
    }
  }

  getSteps(stepNames: EOnboardingSteps[]) {
    return (ctx: OnboardingStepContext): IOnboardingStep[] => {
      const steps = stepNames.map(step => ONBOARDING_STEPS()[step]);

      return steps.reduce((acc, step: IOnboardingStep) => {
        if (!step.cond || (step.cond && step.cond(ctx))) {
          // Lazy eval `isSkippable` in function form if the step's condition is met
          const isSkippable =
            typeof step.isSkippable === 'function' ? step.isSkippable(ctx) : step.isSkippable;

          acc.push({ ...step, isSkippable });
        }

        return acc;
      }, [] as IOnboardingStep[]);
    };
  }

  get streamerKnowledgeMode() {
    return this.state.streamerKnowledgeMode;
  }
}

export class OnboardingService extends StatefulService<IOnboardingServiceState> {
  static initialState: IOnboardingServiceState = {
    options: {
      isLogin: false,
      isOptimize: false,
      isHardware: false,
      isImport: false,
    },
    importedFromObs: false,
    existingSceneCollections: false,
    streamerKnowledgeMode: null,
  };

  localStorageKey = 'UserHasBeenOnboarded';

  onboardingCompleted = new Subject();

  @Inject() navigationService: NavigationService;
  @Inject() userService: UserService;
  @Inject() sceneCollectionsService: SceneCollectionsService;
  @Inject() outputSettingsService: OutputSettingsService;

  @mutation()
  SET_OPTIONS(options: Partial<IOnboardingOptions>) {
    Object.assign(this.state.options, options);
  }

  @mutation()
  SET_OBS_IMPORTED(val: boolean) {
    this.state.importedFromObs = val;
  }

  @mutation()
  SET_EXISTING_COLLECTIONS(val: boolean) {
    this.state.existingSceneCollections = val;
  }

  @mutation()
  SET_STREAMER_KNOWLEDGE_MODE(val: StreamerKnowledgeMode) {
    this.state.streamerKnowledgeMode = val;
  }

  async fetchThemeData(id: string) {
    const url = `https://overlays.streamlabs.com/api/overlay/${id}`;
    return jfetch<IThemeMetadata>(url);
  }

  async fetchThemes() {
    return await Promise.all(Object.keys(this.themeMetadata).map(id => this.fetchThemeData(id)));
  }

  get themeMetadata() {
    return this.userService.views.isPrime ? THEME_METADATA.PAID : THEME_METADATA.FREE;
  }

  themeUrl(id: number) {
    return this.themeMetadata[id];
  }

  get views() {
    return new OnboardingViews(this.state);
  }

  get options() {
    return this.state.options;
  }

  get existingSceneCollections() {
    return !(
      this.sceneCollectionsService.loadableCollections.length === 1 &&
      this.sceneCollectionsService.loadableCollections[0].auto
    );
  }

  init() {
    this.setExistingCollections();
  }

  setObsImport(val: boolean) {
    this.SET_OBS_IMPORTED(val);
  }

  setExistingCollections() {
    this.SET_EXISTING_COLLECTIONS(this.existingSceneCollections);
  }

  setStreamerKnowledgeMode(val: StreamerKnowledgeMode | null) {
    this.SET_STREAMER_KNOWLEDGE_MODE(val);
  }

  start(options: Partial<IOnboardingOptions> = {}) {
    const actualOptions: IOnboardingOptions = {
      isLogin: false,
      isOptimize: false,
      isHardware: false,
      isImport: false,
      ...options,
    };

    this.SET_OPTIONS(actualOptions);
    this.navigationService.navigate('Onboarding');
  }

  // Ends the onboarding process
  finish() {
    localStorage.setItem(this.localStorageKey, 'true');
    remote.session.defaultSession.flushStorageData();
    console.log('Set onboarding key successful.');

    // setup a custom resolution if the platform requires that
    const platformService = getPlatformService(this.userService.views.platform?.type);
    if (platformService && platformService.hasCapability('resolutionPreset')) {
      const { inputResolution, outputResolution } = platformService;
      this.outputSettingsService.setSettings({
        mode: 'Advanced',
        inputResolution,
        streaming: { outputResolution },
      });
    }

    this.navigationService.navigate('Studio');
    this.onboardingCompleted.next();
  }

  get isTwitchAuthed() {
    return this.userService.isLoggedIn && this.userService.platform.type === 'twitch';
  }

  get isFacebookAuthed() {
    return this.userService.isLoggedIn && this.userService.platform.type === 'facebook';
  }

  startOnboardingIfRequired() {
    this.start();
    return true;
    // Useful for testing in dev env
    if (Utils.env.SLD_FORCE_ONBOARDING_STEP) {
      this.start();
      return true;
    }

    if (localStorage.getItem(this.localStorageKey)) {
      return false;
    }

    this.start();
    return true;
  }
}
/*
import { createMachine, assign, actions } from 'xstate';
const onboardingMachine = createMachine(
  {
    id: 'onboarding',
    initial: 'starting',
    predictableActionArguments: true,
    context: {
      usageMode: null,
    },
    states: {
      starting: {
        on: {
          NEXT: [{ target: 'macPermissions', cond: 'isMac' }, { target: 'chooseOnboardingModes' }],
        },
      },
      macPermissions: {
        on: {
          NEXT: { target: 'chooseOnboardingModes' },
        },
      },
      chooseOnboardingModes: {
        initial: 'chooseUsageMode',
        states: {
          chooseUsageMode: {
            description: 'Choose Streaming or Recording Mode',
            on: {
              CHOOSE_STREAMING: {
                target: '.streaming',
                description: 'Choose Streaming Mode',
              },
              CHOOSE_RECORDING: {
                target: '.recording',
                description: 'Choose Recording Mode',
              },
            },
            states: {
              streaming: {
                always: '../chooseKnowledgeLevel',
              },
              recording: {
                always: '../chooseKnowledgeLevel',
              },
            },
          },
          chooseKnowledgeLevel: {
            description: 'Choose Streamer Knowledge Level',
            on: {
              CHOOSE_BEGINNER: '../beginnerOnboarding',
              CHOOSE_INTERMEDIATE: '../intermediateOnboarding',
              CHOOSE_ADVANCED: '../advancedOnboarding',
            },
          },
        },
      },
      loginOrSignup: {},
      beginnerOnboarding: {
        on: {
          NEXT: 'loginOrSignup',
        },
      },
      intermediateOnboarding: {},
      advancedOnboarding: {},
    },
  },
  {
    guards: {
      isMac: (context, event) => {
        return process.platform === OS.Mac;
      },
    },
  },
);
*/
