import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { Inject } from 'services/core/injector';
import { VideoService, Display as OBSDisplay } from 'services/video';
import { WindowsService } from 'services/windows';
import { CustomizationService } from 'services/customization';

@Component({})
export default class Display extends Vue {
  @Inject() videoService: VideoService;
  @Inject() windowsService: WindowsService;
  @Inject() customizationService: CustomizationService;

  @Prop() sourceId: string;
  @Prop({ default: 0 }) paddingSize: number;
  @Prop({ default: false }) drawUI: boolean;
  @Prop() clickHandler: boolean;
  @Prop() renderingMode: number;

  $refs: {
    display: HTMLElement;
  };

  display: OBSDisplay;

  mounted() {
    this.createDisplay();
  }

  onClickHandler(event: MouseEvent) {
    this.$emit('click', event);
  }

  get paddingColor() {
    return this.customizationService.displayBackground;
  }

  createDisplay() {
    debugger;
    const displayId = this.videoService.getRandomDisplayId();
    this.display = new OBSDisplay(displayId, {
      sourceId: this.sourceId,
      paddingSize: this.paddingSize,
      paddingColor: this.paddingColor,
      renderingMode: this.renderingMode,
    });
    this.display.setShoulddrawUI(this.drawUI);

    this.display.onOutputResize(region => {
      this.$emit('outputResize', region);
    });

    this.display.trackElement(this.$refs.display);
  }

  destroyDisplay() {
    this.display.destroy();
  }

  @Watch('sourceId')
  changeSource() {
    this.updateDisplay();
  }

  @Watch('paddingColor')
  updateDisplay() {
    this.destroyDisplay();
    this.createDisplay();
  }

  beforeDestroy() {
    this.destroyDisplay();
  }
}
