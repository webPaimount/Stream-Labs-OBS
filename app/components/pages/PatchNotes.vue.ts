import Vue from 'vue';
import { Component } from 'vue-property-decorator';
import { PatchNotesService } from 'services/patch-notes';
import { Inject } from 'util/injector';
import { NavigationService } from 'services/navigation';

@Component({})
export default class Dashboard extends Vue {
  @Inject() patchNotesService: PatchNotesService;
  @Inject() navigationService: NavigationService;

  get notes() {
    return this.patchNotesService.notes;
  }

  done() {
    this.navigationService.navigate('Studio');
  }

}
