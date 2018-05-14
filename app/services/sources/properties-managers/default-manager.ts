import { PropertiesManager } from './properties-manager';
import { Inject } from 'util/injector';
import { MediaBackupService } from 'services/media-backup';
import * as input from 'components/shared/forms/Input';
import * as fi from 'node-fontinfo';
import { FontLibraryService } from 'services/font-library';
import { EFontStyle } from 'obs-studio-node';
import fs from 'fs';
import path from 'path';
import { UserService } from 'services/user';

export interface IDefaultManagerSettings {
  mediaBackup?: {
    localId?: string;
    serverId?: number;
    originalPath?: string;
  };
}

/**
 * This properties manager simply exposes all properties
 * and does not modify them.
 */
export class DefaultManager extends PropertiesManager {
  @Inject() mediaBackupService: MediaBackupService;
  @Inject() fontLibraryService: FontLibraryService;
  @Inject() userService: UserService;

  settings: IDefaultManagerSettings;

  mediaBackupFileSetting: string;
  currentMediaPath: string;

  init() {
    if (!this.settings.mediaBackup) this.settings.mediaBackup = {};
    this.initializeMediaBackup();
    this.downloadGoogleFont();
  }

  setPropertiesFormData(properties: input.TFormData) {
    super.setPropertiesFormData(properties);
    if (this.obsSource.settings[this.mediaBackupFileSetting] !== this.currentMediaPath) {
      this.uploadNewMediaFile();
    }
  }

  initializeMediaBackup() {
    if (!this.userService.isLoggedIn()) return;

    if (this.obsSource.id === 'ffmpeg_source') {
      this.mediaBackupFileSetting = 'local_file';
    } else if (this.obsSource.id === 'image_source') {
      this.mediaBackupFileSetting = 'file';
    } else {
      return;
    }

    this.ensureMediaBackupId();
    this.currentMediaPath = this.obsSource.settings[this.mediaBackupFileSetting];

    if (this.settings.mediaBackup.serverId && this.settings.mediaBackup.originalPath) {
      this.mediaBackupService.syncFile(
        this.settings.mediaBackup.localId,
        this.settings.mediaBackup.serverId,
        this.settings.mediaBackup.originalPath
      ).then(file => {
        this.currentMediaPath = file.filePath;
        this.obsSource.update({ [this.mediaBackupFileSetting]: file.filePath });
      });
    } else {
      this.uploadNewMediaFile();
    }
  }

  uploadNewMediaFile() {
    if (!this.mediaBackupFileSetting) return;

    console.log(this.obsSource.settings);

    this.mediaBackupService.createNewFile(
      this.settings.mediaBackup.localId,
      this.obsSource.settings[this.mediaBackupFileSetting]
    ).then(file => {
      if (file) {
        // debugger;
        this.settings.mediaBackup.serverId = file.serverId;
        this.settings.mediaBackup.originalPath = this.obsSource.settings[this.mediaBackupFileSetting];
      }
    });
  }

  ensureMediaBackupId() {
    if (this.settings.mediaBackup.localId) return;
    this.settings.mediaBackup.localId = this.mediaBackupService.getLocalFileId();
  }

  isMediaBackupSource() {
    return this.obsSource.id === 'ffmpeg_source';
  }

  async downloadGoogleFont() {
    if (this.obsSource.id !== 'text_gdiplus') return;

    const settings = this.obsSource.settings;
    const newSettings: Dictionary<any> = {};

    if (!settings['custom_font']) return;
    if (fs.existsSync(settings.custom_font)) return;

    const filename = path.parse(settings['custom_font']).base;

    const fontPath =
      await this.fontLibraryService.downloadFont(filename);

    const fontInfo = fi.getFontInfo(fontPath);

    if (!fontInfo) {
      // Fall back to Arial
      newSettings['custom_font'] = null;
      newSettings['font']['face'] = 'Arial';
      newSettings['font']['flags'] = 0;
      this.obsSource.update(newSettings);
      return;
    }

    newSettings['custom_font'] = fontPath;
    newSettings['font'] = { ...settings['font'] };
    newSettings['font'] = newSettings['font'] || {};
    newSettings['font']['face'] = fontInfo.family_name;
    newSettings['font']['flags'] =
      (fontInfo.italic ? EFontStyle.Italic : 0) |
      (fontInfo.bold ? EFontStyle.Bold : 0);

    this.obsSource.update(newSettings);
  }

}
