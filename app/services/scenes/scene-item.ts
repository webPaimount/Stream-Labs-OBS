import { ScenesService, Scene, ISceneItem, ISceneItemApi, ISceneItemInfo } from './index';
import { mutation, ServiceHelper } from '../stateful-service';
import Utils from '../utils';
import { SourcesService, TSourceType, ISource } from 'services/sources';
import { VideoService } from 'services/video';
import { ScalableRectangle } from '../../util/ScalableRectangle';
import { Inject } from '../../util/injector';
import { TFormData } from '../../components/shared/forms/Input';
import * as obs from '../obs-api';


/**
 * A SceneItem is a source that contains
 * all of the information about that source, and
 * how it fits in to the given scene
 */
@ServiceHelper()
export class SceneItem implements ISceneItemApi {

  sourceId: string;
  name: string;
  type: TSourceType;
  audio: boolean;
  video: boolean;
  muted: boolean;
  width: number;
  height: number;
  properties: TFormData;
  channel?: number;

  sceneItemId: string;
  obsSceneItemId: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  visible: boolean;
  crop: ICrop;
  locked: boolean;
  rotation: number;

  // Some computed attributes

  get scaledWidth(): number {
    return this.width * this.scaleX;
  }

  get scaledHeight(): number {
    return this.height * this.scaleY;
  }

  // A visual source is visible in the editor and not locked
  get isVisualSource() {
    return (this.video && (this.width > 0) && (this.height > 0)) && !this.locked;
  }

  sceneItemState: ISceneItem;

  @Inject() private scenesService: ScenesService;
  @Inject() private sourcesService: SourcesService;
  @Inject() private videoService: VideoService;

  constructor(private sceneId: string, sceneItemId: string, sourceId: string) {

    const sceneSourceState = this.scenesService.state.scenes[sceneId].items.find(source => {
      return source.sceneItemId === sceneItemId;
    });
    const sourceState = this.sourcesService.state.sources[sourceId];
    this.sceneItemState = sceneSourceState;
    this.sceneId = sceneId;
    Utils.applyProxy(this, sourceState);
    Utils.applyProxy(this, this.sceneItemState);
  }

  getModel(): ISceneItem & ISource {
    return { ...this.sceneItemState, ...this.source.sourceState };
  }

  getScene(): Scene {
    return this.scenesService.getScene(this.sceneId);
  }

  get source() {
    return this.sourcesService.getSource(this.sourceId);
  }

  getSource() {
    return this.source;
  }

  getObsInput() {
    return this.source.getObsInput();
  }

  getObsSceneItem(): obs.ISceneItem {
    return this.getScene().getObsScene().findItem(this.obsSceneItemId);
  }

  remove() {
    this.scenesService.getScene(this.sceneId).removeItem(this.sceneItemId);
  }

  setPosition(vec: IVec2) {
    this.getObsSceneItem().position = { x: vec.x, y: vec.y };
    this.update({ sceneItemId: this.sceneItemId, x: vec.x, y: vec.y });
  }


  nudgeLeft() {
    this.setPosition({ x: this.x - 1, y: this.y });
  }


  nudgeRight() {
    this.setPosition({ x: this.x + 1, y: this.y });
  }


  nudgeUp() {
    this.setPosition({ x: this.x, y: this.y - 1 });
  }


  nudgeDown() {
    this.setPosition({ x: this.x, y: this.y + 1 });
  }


  setVisibility(visible: boolean) {
    this.getObsSceneItem().visible = visible;
    this.update({ sceneItemId: this.sceneItemId, visible });
  }


  setRotation(rotation: number) {
    // Adjusts any positve or negative rotation value into a normalized
    // value between 0 and 360.
    const effectiveRotation = ((rotation % 360) + 360) % 360;

    this.getObsSceneItem().rotation = effectiveRotation;
    this.update({ sceneItemId: this.sceneItemId, rotation: effectiveRotation });
  }


  setPositionAndScale(x: number, y: number, scaleX: number, scaleY: number) {
    const obsSceneItem = this.getObsSceneItem();
    obsSceneItem.position = { x, y };
    obsSceneItem.scale = { x: scaleX, y: scaleY };
    this.update({ sceneItemId: this.sceneItemId, x, y, scaleX, scaleY });
  }

  setRectangle(rect: IScalableRectangle) {
    this.setPositionAndScale(
      rect.x,
      rect.y,
      rect.scaleX,
      rect.scaleY
    );
  }


  setCrop(crop: ICrop): ICrop {
    const cropModel: ICrop = {
      top: Math.round(crop.top),
      right: Math.round(crop.right),
      bottom: Math.round(crop.bottom),
      left: Math.round(crop.left)
    };
    this.getObsSceneItem().crop = cropModel;
    this.update({ sceneItemId: this.sceneItemId, crop: { ...crop } });
    return cropModel;
  }


  setPositionAndCrop(x: number, y: number, crop: ICrop) {
    const obsSceneItem = this.getObsSceneItem();
    this.setCrop(crop);
    obsSceneItem.position = { x, y };
    this.update({ sceneItemId: this.sceneItemId, x, y });
  }


  setLocked(locked: boolean) {
    const scene = this.getScene();
    if (locked && (scene.activeItemIds.includes(this.sceneItemId))) {
      scene.makeItemsActive([]);
    }

    this.update({ sceneItemId: this.sceneItemId, locked });
  }


  loadAttributes() {
    const { position, scale, visible, crop } = this.getObsSceneItem();
    this.update({
      sceneItemId: this.sceneItemId,
      scaleX: scale.x,
      scaleY: scale.y,
      visible,
      ...position,
      crop
    });
  }

  loadItemAttributes(customSceneItem: ISceneItemInfo) {
    const visible = customSceneItem.visible;
    const position = { x: customSceneItem.x, y: customSceneItem.y };
    const crop = customSceneItem.crop;

    this.update({
      sceneItemId: this.sceneItemId,
      scaleX: customSceneItem.scaleX,
      scaleY: customSceneItem.scaleY,
      visible,
      ...position,
      crop,
      locked: !!customSceneItem.locked,
      rotation: customSceneItem.rotation
    });
  }

  resetTransform() {
    this.setPositionAndScale(0, 0, 1.0, 1.0);
    this.setCrop({
      top: 0,
      left: 0,
      right: 0,
      bottom: 0
    });
    this.setRotation(0);
  }

  flipY() {
    this.preservePosition(() => {
      const rect = this.getRectangle();
      rect.flipY();
      this.setRectangle(rect);
    });
  }

  flipX() {
    this.preservePosition(() => {
      const rect = this.getRectangle();
      rect.flipX();
      this.setRectangle(rect);
    });
  }


  stretchToScreen() {
    const rect = this.getRectangle();
    rect.stretchAcross(this.videoService.getScreenRectangle());
    this.setRectangle(rect);
  }


  fitToScreen() {
    const rect = this.getRectangle();
    rect.fitTo(this.videoService.getScreenRectangle());
    this.setRectangle(rect);
  }

  centerOnScreen() {
    const rect = this.getRectangle();
    rect.centerOn(this.videoService.getScreenRectangle());
    this.setRectangle(rect);
  }

  rotate(deltaRotation: number) {
    this.preservePosition(() => {
      this.setRotation(this.rotation + deltaRotation);
    });
  }


  /**
   * A rectangle representing this sceneItem
   */
  private getRectangle(): ScalableRectangle {
    return new ScalableRectangle(this);
  }

  /**
   *   Many of these transforms can unexpectedly change the position of the
   *   object.  For example, rotations happen around the NW axis.  This function
   *   records the normalized x,y position before the operation and returns it to
   *   that position after the operation has been performed.
   */
  private preservePosition(fun: Function) {
    const rect = this.getRectangle();
    rect.normalize();
    const x = rect.x;
    const y = rect.y;

    fun();

    const newRect = this.getRectangle();
    newRect.normalized(() => {
      newRect.x = x;
      newRect.y = y;
    });

    this.setPosition({ x: newRect.x, y: newRect.y });
  }


  private update(patch: {sceneItemId: string} & Partial<ISceneItem>) {
    this.UPDATE(patch);
    this.scenesService.itemUpdated.next(this.sceneItemState);
  }


  @mutation()
  private UPDATE(patch: {sceneItemId: string} & Partial<ISceneItem>) {
    Object.assign(this.sceneItemState, patch);
  }
}
